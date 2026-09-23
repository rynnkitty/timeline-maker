/**
 * MapLibre 배경 렌더러 (브라우저 전용) — engine/types.ts 의 MapRenderer 구현.
 * 근거: docs/spike-results.md §1 · §3 (워커 URL · preserveDrawingBuffer + idle · 새 인스턴스 순차 렌더 · 크롭)
 * API: node_modules/maplibre-gl/dist/maplibre-gl.d.ts (v6.11.0)
 */
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { xToLng, yToLat } from '../engine/mercator.ts';
import type { Camera, MapRenderer } from '../engine/types.ts';
import { mapGeometry, type MapGeometry } from './geometry.ts';
import { DEFAULT_PROVIDER, PROVIDERS, type ProviderId } from './providers.ts';

// MapLibre v6 워커는 new URL(변수) 로 만들어져 Vite 가 추적 못 함 → 의존성째 번들한 URL 주입
setWorkerUrl(workerUrl);

/** 레퍼런스 라벨 크기 배율 (C-7, docs/phase3-lookfeel.md) */
export const LABEL_SCALE = 1.35;
const IDLE_TIMEOUT_MS = 60_000;

export type MapLayerOptions = { provider?: ProviderId; labelScale?: number };

export type MapLayer = MapRenderer & {
  readonly geometry: MapGeometry;
  /** 투영 검증용: 경위도 → 출력 픽스셀 (MapLibre 기준) */
  projectLngLat(lng: number, lat: number): [number, number];
};

/**
 * 탭이 **보이는 동안만** 시간을 세는 타임아웃. 가려진 탭에서는 requestAnimationFrame 이 멈춰 MapLibre 가 렌더하지 않으므로
 * (Phase 4 실측: 가려진 8 s 동안 진행 0) 그 시간을 실패로 치지 않는다. 다시 보이면 이어서 렌더된다.
 */
function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer = 0;
  const guard = new Promise<T>((_, rej) => {
    let visibleMs = 0;
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') visibleMs += 250;
      if (visibleMs >= ms) rej(new Error(`${what} timeout`));
    }, 250);
  });
  return Promise.race([p, guard]).finally(() => clearInterval(timer));
}

export async function createMapLayer(W: number, H: number, opts: MapLayerOptions = {}): Promise<MapLayer> {
  const provider = PROVIDERS[opts.provider ?? DEFAULT_PROVIDER];
  const g = mapGeometry(W, H, opts.labelScale ?? LABEL_SCALE);

  const style = provider.transform((await (await fetch(provider.styleUrl)).json()) as StyleSpecification);
  // 시간 기반 전환 제거 → 렌더가 벽시계에 의존하지 않음 (H-6). setNow 대신 이 방식을 쓴다 (D-27)
  style.transition = { duration: 0, delay: 0 };

  const el = document.createElement('div');
  // display:none 이면 크기 0 → 렌더 안 됨. 화면 밖에 실제 크기로 둔다
  el.style.cssText = `position:fixed;left:-30000px;top:0;width:${g.cssW}px;height:${g.cssH}px;pointer-events:none;`;
  document.body.append(el);

  const map = new MapLibreMap({
    container: el,
    style,
    center: [0, 0],
    zoom: 1,
    pixelRatio: g.pixelRatio,
    interactive: false,
    attributionControl: false, // attribution 은 HUD 에 직접 굽는다 (H-3)
    fadeDuration: 0,
    renderWorldCopies: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  await timeout(map.once('load'), IDLE_TIMEOUT_MS, 'map load');

  const src = map.getCanvas();
  if (src.width < W || src.height < H) throw new Error(`map canvas ${src.width}x${src.height} < ${W}x${H}`);
  // MapLibre 는 컨테이너 중앙에 카메라를 둔다 → 가운데를 잘라 출력 크기로
  const offX = Math.round((src.width - W) / 2);
  const offY = Math.round((src.height - H) / 2);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;

  return {
    width: W,
    height: H,
    attribution: provider.attribution,
    geometry: g,
    async render(cam: Camera): Promise<CanvasImageSource> {
      const idle = map.once('idle'); // 먼저 등록 → 정지 구간에서도 repaint 후 반드시 idle
      map.jumpTo({ center: [xToLng(cam.x), yToLat(cam.y)], zoom: cam.zoom + g.zoomOffset });
      map.triggerRepaint();
      await timeout(idle, IDLE_TIMEOUT_MS, 'map idle');
      octx.clearRect(0, 0, W, H);
      octx.drawImage(src, offX, offY, W, H, 0, 0, W, H);
      return out;
    },
    projectLngLat(lng: number, lat: number): [number, number] {
      const p = map.project([lng, lat]);
      return [p.x * g.pixelRatio - offX, p.y * g.pixelRatio - offY];
    },
    destroy() {
      map.remove();
      el.remove();
    },
  };
}
