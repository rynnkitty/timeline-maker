/**
 * Phase 3 하네스 (제품 코드 아님)
 * - projection(): 엔진 메르카토르 투영 vs MapLibre map.project — 오차(px)
 * 카메라·점은 공개 좌표만 (실궤적 아님).
 */
import { BASE_W, latToY, lngToX, worldScale } from '../../src/engine/mercator.ts';
import { createMapLayer } from '../../src/map/map-layer.ts';

const PTS: [number, number][] = [
  [126.978, 37.5665], // 서울시청
  [129.0419, 35.1151], // 부산역
  [126.4929, 33.5066], // 제주공항
  [128.8761, 37.7519], // 강릉
  [127.9, 36.3],
  [126.5, 38.3],
];
const CAMS = [
  { lng: 127.9, lat: 36.3, zoom: 6.3 },
  { lng: 126.978, lat: 37.5665, zoom: 7.7 },
  { lng: 127.2, lat: 37.2, zoom: 9.5 },
  { lng: 126.99, lat: 37.56, zoom: 12 },
];

async function projection() {
  const out: Record<string, unknown>[] = [];
  for (const [W, H, ls] of [
    [480, 854, 1.35],
    [1080, 1920, 1.35],
    [720, 1280, 1.35],
    [480, 854, 1],
  ] as const) {
    const layer = await createMapLayer(W, H, { labelScale: ls });
    for (const c of CAMS) {
      const cam = { x: lngToX(c.lng), y: latToY(c.lat), zoom: c.zoom };
      await layer.render(cam, 0);
      let maxErr = 0;
      for (const [lng, lat] of PTS) {
        const s = worldScale(cam.zoom, W);
        const ex = W / 2 + (lngToX(lng) - cam.x) * s;
        const ey = H / 2 + (latToY(lat) - cam.y) * s;
        const [mx, my] = layer.projectLngLat(lng, lat);
        maxErr = Math.max(maxErr, Math.hypot(ex - mx, ey - my));
      }
      out.push({ W, H, labelScale: ls, zoom: c.zoom, geometry: layer.geometry, maxErrPx: +maxErr.toFixed(4) });
    }
    layer.destroy();
  }
  void BASE_W;
  return { results: out };
}

(window as unknown as { spike: unknown }).spike = { projection, ready: true };
document.querySelector('#log')!.textContent = 'ready';
