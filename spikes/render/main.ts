/**
 * Phase 3 하네스 (제품 코드 아님)
 * - projection(): 엔진 메르카토르 투영 vs MapLibre map.project — 오차(px)
 * - renderRef(opts): 입력 파일 → 제품 파이프라인(워커 → 엔진 → 지도)으로 기준 시각 프레임 렌더 → PNG
 *   ⚠ 실파일로 돌린 결과 이미지는 실궤적 → 러너 --out 을 docs/reference/ (gitignore) 로만.
 * 카메라·점은 공개 좌표만 (projection).
 */
import { filterByLocalDate, packTrack, unpackTrack } from '../../src/data/index.ts';
import {
  DEFAULT_CAMERA,
  GREEN,
  HUD,
  buildScene,
  computeFrame,
  latToY,
  lngToX,
  makeTrack,
  renderFrame,
  worldScale,
  type CameraParams,
  type HudLayout,
  type TrailTheme,
} from '../../src/engine/index.ts';
import { createMapLayer } from '../../src/map/map-layer.ts';
import { ensureFonts } from '../../src/ui/fonts.ts';
import { parseInWorker } from '../../src/workers/parse-client.ts';

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
  return { results: out };
}

async function pngBase64(c: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob!.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

type RefOpts = {
  from?: string;
  to?: string;
  width?: number;
  height?: number;
  animS?: number;
  frames?: number[];
  camera?: Partial<CameraParams>;
  theme?: Partial<TrailTheme>;
  hud?: Partial<HudLayout>;
  labelScale?: number;
  provider?: 'carto' | 'openfreemap';
};

const REF_FRAMES = [0, 34, 70, 103, 137, 173, 206, 240, 276, 310, 343, 394];

async function renderRef(o: RefOpts = {}) {
  const f = document.querySelector<HTMLInputElement>('#file')!.files?.[0];
  if (!f) throw new Error('no file');
  const parsed = await parseInWorker(f);
  if (!parsed.ok) return { error: parsed.code };
  const pts = filterByLocalDate(unpackTrack(parsed.result.track), o.from, o.to);
  const track = makeTrack(packTrack(pts));
  const W = o.width ?? 480;
  const H = o.height ?? 854;
  const scene = buildScene(track, {
    animS: o.animS ?? 15,
    width: W,
    height: H,
    name: '테스트', // 플레이스홀더 — 실명 금지 (H-2)
    camera: { ...DEFAULT_CAMERA, ...o.camera },
    theme: { ...GREEN, ...o.theme },
    hud: { ...HUD, ...o.hud },
  });
  const map = await createMapLayer(W, H, { labelScale: o.labelScale, provider: o.provider });
  const subs = (o.frames ?? REF_FRAMES).map((i) => computeFrame(scene, i).subtitle);
  await ensureFonts([scene.title, ...subs, map.attribution]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const results: Record<string, unknown>[] = [];
  for (const i of o.frames ?? REF_FRAMES) {
    const st = await renderFrame(ctx, scene, map, i);
    results.push({
      label: `ours_f${String(i).padStart(3, '0')}`,
      ext: 'png',
      frame: i,
      zoom: +st.camera.zoom.toFixed(3),
      subtitle: st.subtitle.replace(/^\d{4}년 /, ''), // 월·km 만 (이름 없음)
      base64: await pngBase64(canvas),
    });
  }
  map.destroy();
  return { points: track.n, results };
}

(window as unknown as { spike: unknown }).spike = { projection, renderRef, ready: true };
document.querySelector('#log')!.textContent = 'ready';
