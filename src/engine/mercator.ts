/**
 * Web Mercator — MapLibre 와 같은 좌표계를 엔진이 직접 계산한다 (엔진은 MapLibre 비의존 · 테스트 가능).
 * 단위 월드 좌표: x,y ∈ [0,1] (x = 경도, y = 북→남). 줌 z 에서 월드 한 변 = TILE_PX · 2^z (CSS px).
 * 엔진 카메라 줌은 **출력 폭 480 기준(BASE_W)** 으로 정의한다 — 다른 해상도는 W/480 배율.
 * 정합 검증: spikes/render (map.project 와 0.5px 이내 — docs/adrs/0001-engine-map-boundary.md).
 */
export const TILE_PX = 512;
export const BASE_W = 480;
export const BASE_H = 854;
const RAD = Math.PI / 180;
/** MapLibre 가 쓰는 메르카토르 위도 한계 */
export const MAX_LAT = 85.051129;

export const lngToX = (lng: number) => (lng + 180) / 360;
export function latToY(lat: number): number {
  const s = Math.sin(Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * RAD);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
export const xToLng = (x: number) => x * 360 - 180;
export const yToLat = (y: number) => (Math.atan(Math.exp(Math.PI * (1 - 2 * y))) * 2 - Math.PI / 2) / RAD;

/** 출력 폭 W 에서 월드 단위 1 이 차지하는 픽셀 수 */
export const worldScale = (zoom: number, W: number) => TILE_PX * 2 ** zoom * (W / BASE_W);
