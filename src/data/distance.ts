import type { LatLng } from './types.ts';

/** IUGG 평균 지구 반경 (km) — D-14. 픽스처 오라클(scripts/make-fixtures.ts)과 같은 값 */
export const EARTH_RADIUS_KM = 6371.0088;

const RAD = Math.PI / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 누적 거리 — c[i] = 0..i 구간 합 (c[0] = 0). HUD 카운터는 이 값을 헤드 위치까지 보간해 쓴다 */
export function cumulativeKm(points: readonly LatLng[]): Float64Array {
  const c = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) c[i] = c[i - 1] + haversineKm(points[i - 1], points[i]);
  return c;
}
