/**
 * 엔진용 열(column) 트랙 — 워커가 transfer 한 PackedTrack 을 그대로 소비한다 (C-13).
 * x,y 는 단위 메르카토르 좌표로 미리 변환, km 은 D-14 haversine 누적.
 * pace = 진행 축 (D-24): 누적 km. 총 이동 0 이면 점 순번.
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
  /** 단조 비감소 진행 축 */
  pace: Float64Array;
  paceKind: 'km' | 'index';
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
  const km = cumulativeKm(ll);
  const moved = n > 0 && km[n - 1] > 0;
  const pace = moved ? km : Float64Array.from({ length: n }, (_, i) => i);
  return { n, t: p.t, x, y, tz: p.tz, km, pace, paceKind: moved ? 'km' : 'index' };
}

/** pace[i] ≤ v 인 가장 큰 i (없으면 −1) — 이분 탐색 */
export function indexAtOrBefore(tr: Track, v: number): number {
  if (tr.n === 0 || v < tr.pace[0]) return -1;
  let lo = 0;
  let hi = tr.n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tr.pace[mid] <= v) lo = mid;
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
  /** 헤드 위치의 (보간된) 시각 — 월 표기용 */
  t: number;
  tz: number;
  pace: number;
};

/**
 * 트레일 헤드 — 진행량 v 에서 점 사이를 보간 (에이전트 §5: 긴 공백에서 순간이동 없이 전진).
 * km·시각도 같은 보간 위치 (§5 거리 계약).
 */
export function headAt(tr: Track, v: number): Head {
  const i = Math.max(0, indexAtOrBefore(tr, v));
  const at = (f: number): Head => {
    const j = Math.min(i + 1, tr.n - 1);
    return {
      i,
      frac: f,
      x: tr.x[i] + (tr.x[j] - tr.x[i]) * f,
      y: tr.y[i] + (tr.y[j] - tr.y[i]) * f,
      km: tr.km[i] + (tr.km[j] - tr.km[i]) * f,
      t: tr.t[i] + (tr.t[j] - tr.t[i]) * f,
      tz: tr.tz[i],
      pace: tr.pace[i] + (tr.pace[j] - tr.pace[i]) * f,
    };
  };
  if (i >= tr.n - 1 || v <= tr.pace[i]) return at(0);
  const d = tr.pace[i + 1] - tr.pace[i];
  return at(d > 0 ? Math.min(1, (v - tr.pace[i]) / d) : 0);
}
