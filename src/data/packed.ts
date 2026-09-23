import { localDateKey } from './period.ts';
import type { TrackPoint } from './types.ts';

/**
 * 열 배열 트랙 — 워커 → 메인 스레드로 **transfer**(복사 없음)하기 위한 형태 (C-13).
 * 점 객체 배열을 구조화 복제하면 점당 ≈90B·수백 ms 가 든다 (docs/browser-support.md §4).
 */
export type PackedTrack = { t: Float64Array; lat: Float64Array; lng: Float64Array; tz: Int16Array };

export function packTrack(points: readonly TrackPoint[]): PackedTrack {
  const n = points.length;
  const p: PackedTrack = { t: new Float64Array(n), lat: new Float64Array(n), lng: new Float64Array(n), tz: new Int16Array(n) };
  for (let i = 0; i < n; i++) {
    const q = points[i];
    p.t[i] = q.t;
    p.lat[i] = q.lat;
    p.lng[i] = q.lng;
    p.tz[i] = q.tz;
  }
  return p;
}

export function unpackTrack(p: PackedTrack): TrackPoint[] {
  const out = new Array<TrackPoint>(p.t.length);
  for (let i = 0; i < p.t.length; i++) out[i] = { t: p.t[i], tz: p.tz[i], lat: p.lat[i], lng: p.lng[i] };
  return out;
}

/** postMessage transfer 목록 */
export const packedBuffers = (p: PackedTrack): ArrayBuffer[] => [p.t.buffer, p.lat.buffer, p.lng.buffer, p.tz.buffer] as ArrayBuffer[];

/** 현지 날짜 [from, to] 양끝 포함 필터 — 점 객체를 만들지 않고 열 배열에서 바로 (filterByLocalDate 와 같은 규칙) */
export function filterPackedByLocalDate(p: PackedTrack, from?: string, to?: string): PackedTrack {
  const keep: number[] = [];
  for (let i = 0; i < p.t.length; i++) {
    const d = localDateKey({ t: p.t[i], tz: p.tz[i] });
    if ((from === undefined || d >= from) && (to === undefined || d <= to)) keep.push(i);
  }
  const out: PackedTrack = {
    t: new Float64Array(keep.length),
    lat: new Float64Array(keep.length),
    lng: new Float64Array(keep.length),
    tz: new Int16Array(keep.length),
  };
  keep.forEach((i, k) => {
    out.t[k] = p.t[i];
    out.lat[k] = p.lat[i];
    out.lng[k] = p.lng[i];
    out.tz[k] = p.tz[i];
  });
  return out;
}
