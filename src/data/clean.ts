import { haversineKm } from './distance.ts';
import type { TrackPoint } from './types.ts';

/**
 * 속도 이상치 임계 (km/h). 실파일 연속점 속도 최대 구간은 300~600 km/h, 1,000 이상 0건
 * (docs/reference-spec.md §6.4 P4) — 비행기 이동은 지우지 않고 순간이동만 지운다.
 */
export const SPEED_LIMIT_KMH = 1000;

const speedKmh = (a: TrackPoint, b: TrackPoint) => haversineKm(a, b) / ((b.t - a.t) / 3_600_000);

export type Cleaned = { points: TrackPoint[]; duplicatesDropped: number; outliersDropped: number };

/**
 * 1) 안정 정렬(t 오름차순, 같은 t 는 파일 순서 유지)
 * 2) 같은 t 그룹은 첫 점만 (D-17) — 속도 필터의 dt=0 오판 방지
 * 3) 속도 이상치: **마지막으로 유지된 점** 대비 속도 ≥ SPEED_LIMIT_KMH 이면 제거
 *    (스파이크 다음의 정상점을 스파이크와 비교하지 않기 위해)
 *    단, 첫 점 자체가 이상치면 이후가 모두 지워지므로 앞쪽은 "p0→p1 이 빠르고 p1→p2 는 정상" 이면 p0 을 버린다.
 */
export function cleanTrack(input: readonly TrackPoint[]): Cleaned {
  const sorted = input.slice().sort((a, b) => a.t - b.t); // Array.prototype.sort 는 안정 정렬 (ES2019)

  const unique: TrackPoint[] = [];
  for (const p of sorted) if (unique.length === 0 || p.t !== unique[unique.length - 1].t) unique.push(p);
  const duplicatesDropped = sorted.length - unique.length;

  let start = 0;
  while (
    unique.length - start >= 3 &&
    speedKmh(unique[start], unique[start + 1]) >= SPEED_LIMIT_KMH &&
    speedKmh(unique[start + 1], unique[start + 2]) < SPEED_LIMIT_KMH
  ) {
    start++;
  }

  const points: TrackPoint[] = [];
  for (let i = start; i < unique.length; i++) {
    const p = unique[i];
    if (points.length === 0 || speedKmh(points[points.length - 1], p) < SPEED_LIMIT_KMH) points.push(p);
  }
  return { points, duplicatesDropped, outliersDropped: unique.length - points.length };
}
