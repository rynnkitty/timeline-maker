/**
 * 엔진용 열(column) 트랙 — 워커가 transfer 한 PackedTrack 을 그대로 소비한다 (C-13).
 * x,y 는 단위 메르카토르 좌표로 미리 변환, km 은 D-14 haversine 누적.
 */
import { cumulativeKm, type PackedTrack } from '../data/index.ts';
import { latToY, lngToX } from './mercator.ts';

export type Track = {
  n: number;
  t: Float64Array;
  x: Float64Array;
  y: Float64Array;
  tz: Int16Array;
  km: Float64Array;
};

export function makeTrack(p: PackedTrack): Track {
  const n = p.t.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const ll = new Array<{ lat: number; lng: number }>(n);
  for (let i = 0; i < n; i++) {
    x[i] = lngToX(p.lng[i]);
    y[i] = latToY(p.lat[i]);
    ll[i] = { lat: p.lat[i], lng: p.lng[i] };
  }
  return { n, t: p.t, x, y, tz: p.tz, km: cumulativeKm(ll) };
}

/** t[i] ≤ dataT 인 가장 큰 i (없으면 −1) — 이분 탐색 */
export function indexAtOrBefore(tr: Track, dataT: number): number {
  let lo = 0;
  let hi = tr.n - 1;
  if (tr.n === 0 || dataT < tr.t[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tr.t[mid] <= dataT) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type Head = {
  /** 마지막으로 지난 점 */
  i: number;
  /** i→i+1 사이 보간 비율 */
  frac: number;
  x: number;
  y: number;
  km: number;
  tz: number;
};

/**
 * 트레일 헤드 — 마지막 점과 다음 점 사이를 시간 비율로 보간 (에이전트 §5: 긴 공백에서 순간이동 없이 전진).
 * km 도 같은 보간 위치까지 (§5 거리 계약).
 */
export function headAt(tr: Track, dataT: number): Head {
  const i = Math.max(0, indexAtOrBefore(tr, dataT));
  if (i >= tr.n - 1 || dataT <= tr.t[i]) return { i, frac: 0, x: tr.x[i], y: tr.y[i], km: tr.km[i], tz: tr.tz[i] };
  const f = (dataT - tr.t[i]) / (tr.t[i + 1] - tr.t[i]);
  return {
    i,
    frac: f,
    x: tr.x[i] + (tr.x[i + 1] - tr.x[i]) * f,
    y: tr.y[i] + (tr.y[i + 1] - tr.y[i]) * f,
    km: tr.km[i] + (tr.km[i + 1] - tr.km[i]) * f,
    tz: tr.tz[i],
  };
}
