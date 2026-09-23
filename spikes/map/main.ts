/**
 * Spike A — MapLibre 오프스크린 렌더 → 타일 로딩 완료(idle) 대기 → 2D 캔버스로 복사 → PNG (Phase 1, 제품 코드 아님).
 * API 근거: node_modules/maplibre-gl/dist/maplibre-gl.d.ts (v6.11.0)
 *   MapOptions.canvasContextAttributes.preserveDrawingBuffer (기본 false) · pixelRatio · fadeDuration · interactive
 *   attributionControl · renderWorldCopies · localIdeographFontFamily(string | false)
 *   'idle' = 카메라 전환 없음 + 요청 타일 전부 로드 + 페이드 완료 · once(type) → Promise · redraw() = 동기 재렌더
 * 시간 고정: setNow()/restoreNow() 존재 (결정론용 — Phase 3 에서 사용 검토)
 * 카메라는 공개 좌표(서울시청 등)만 사용 — 실궤적 아님.
 */
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
// MapLibre v6 는 워커를 new URL(변수, import.meta.url) 로 만든다 → Vite 가 추적 못 해 404.
// ?worker&url 로 워커(+ maplibre-gl-shared.mjs 의존성)를 번들링해 URL 을 넘긴다. vite.config worker.format='es'.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);

const STYLES = {
  carto: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  ofm: 'https://tiles.openfreemap.org/styles/positron',
} as const;
type Provider = keyof typeof STYLES | 'ofm-tuned';

const SEOUL: [number, number] = [126.978, 37.5665]; // [lng, lat] 서울시청
const KOREA: [number, number] = [127.9, 36.3];
// 레퍼런스(480 폭) 기준 줌. f000 ≈ 7.7, f394 ≈ 6.3 (docs/reference-spec.md K1)
const VIEWS = [
  { id: 'wide-z7.7', center: SEOUL, zoom: 7.7 },
  { id: 'overview-z6.3', center: KOREA, zoom: 6.3 },
  { id: 'city-z10', center: SEOUL, zoom: 10 },
  { id: 'district-z12', center: SEOUL, zoom: 12 },
  { id: 'street-z13.5', center: SEOUL, zoom: 13.5 },
];

const log = (s: string) => {
  document.querySelector('#log')!.textContent += s + '\n';
  console.log(s);
};

/** OFM 을 레퍼런스 톤에 맞춰 보는 실험: 라벨 영문 우선 · 배경/물 색을 CARTO 값으로 */
async function tunedOfmStyle(): Promise<StyleSpecification> {
  const style = (await (await fetch(STYLES.ofm)).json()) as StyleSpecification;
  for (const l of style.layers) {
    if (l.type === 'background') l.paint = { ...l.paint, 'background-color': '#fafaf8' };
    if (l.type === 'fill' && /^water/.test(l.id)) l.paint = { ...l.paint, 'fill-color': '#d4dadc' };
    if (l.type === 'symbol' && l.layout && 'text-field' in l.layout && JSON.stringify(l.layout['text-field']).includes('name')) {
      l.layout['text-field'] = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
    }
  }
  return style;
}

async function makeMap(provider: Provider, w: number, h: number, opts: { preserve: boolean; pixelRatio: number; localCjk: boolean }) {
  const el = document.createElement('div');
  // display:none 이면 clientWidth=0 → 렌더 안 됨. 화면 밖에 실제 크기로 둔다.
  el.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px;`;
  document.body.append(el);
  const style = provider === 'ofm-tuned' ? await tunedOfmStyle() : STYLES[provider];
  const map = new MapLibreMap({
    container: el,
    style,
    center: SEOUL,
    zoom: 7.7,
    pixelRatio: opts.pixelRatio,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    renderWorldCopies: false,
    canvasContextAttributes: { preserveDrawingBuffer: opts.preserve },
    ...(opts.localCjk ? {} : { localIdeographFontFamily: false as const }),
  });
  await Promise.race([map.once('load'), new Promise((_, rej) => setTimeout(() => rej(new Error('load timeout')), 60_000))]);
  return { map, el };
}

async function settle(map: MapLibreMap, timeoutMs = 60_000) {
  const t0 = performance.now();
  await Promise.race([map.once('idle'), new Promise((_, rej) => setTimeout(() => rej(new Error('idle timeout')), timeoutMs))]);
  return { ms: Math.round(performance.now() - t0), tilesLoaded: map.areTilesLoaded() };
}

type Method = 'preserve' | 'no-preserve' | 'redraw-sync';
function copy(map: MapLibreMap, method: Method): HTMLCanvasElement {
  const src = map.getCanvas();
  if (method === 'redraw-sync') map.redraw(); // 같은 태스크 안에서 곧바로 복사 → 버퍼가 아직 유효한지 확인
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

function stats(c: HTMLCanvasElement) {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let opaque = 0;
  let sum = 0;
  const colors = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) opaque++;
    sum += d[i] + d[i + 1] + d[i + 2];
    if (i % 64 === 0) {
      const k = ((d[i] >> 1) << 16) | ((d[i + 1] >> 1) << 8) | (d[i + 2] >> 1);
      colors.set(k, (colors.get(k) ?? 0) + 1);
    }
  }
  const n = d.length / 4;
  const top = [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => [((k >> 16) & 255) * 2, ((k >> 8) & 255) * 2, (k & 255) * 2]);
  return { opaqueRatio: +(opaque / n).toFixed(4), meanRgb: +(sum / n / 3).toFixed(1), dominantRgb: top };
}

function diff(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const x = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
  const y = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
  let px = 0;
  let max = 0;
  for (let i = 0; i < x.length; i += 4) {
    const m = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
    if (m > 0) px++;
    if (m > max) max = m;
  }
  return { differingPixels: px, maxChannelDiff: max };
}

/** toBlob 가 SecurityError 없이 되면 tainted 아님 */
async function png(c: HTMLCanvasElement): Promise<{ base64?: string; tainted: boolean; error?: string }> {
  try {
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    const buf = new Uint8Array(await blob!.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { base64: btoa(bin), tainted: false };
  } catch (e) {
    return { tainted: (e as Error).name === 'SecurityError', error: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

async function run() {
  const results: Record<string, unknown>[] = [];
  const push = async (label: string, c: HTMLCanvasElement, extra: Record<string, unknown>) => {
    const p = await png(c);
    results.push({ label, ext: 'png', width: c.width, height: c.height, ...stats(c), ...extra, ...p });
    log(`${label} ${JSON.stringify({ ...extra, tainted: p.tainted })}`);
  };

  for (const provider of ['carto', 'ofm', 'ofm-tuned'] as const) {
    // 1) 캡처 방식 비교 (preserveDrawingBuffer on/off, redraw 동기 복사)
    for (const preserve of [true, false]) {
      const { map, el } = await makeMap(provider, 480, 854, { preserve, pixelRatio: 1, localCjk: true });
      const s = await settle(map);
      const methods: Method[] = preserve ? ['preserve'] : ['no-preserve', 'redraw-sync'];
      for (const m of methods) {
        // idle 이후 한 태스크 쉬고 복사 — rAF 밖에서의 일반적인 호출 상황 재현
        await new Promise((r) => setTimeout(r, 50));
        await push(`${provider}-capture-${m}`, copy(map, m), { method: m, idleMs: s.ms, tilesLoaded: s.tilesLoaded });
      }
      if (preserve) {
        // 2) 뷰별 캡처 (라벨·톤 비교) + 3) 결정론: 다른 곳에 갔다가 같은 뷰로 돌아와 다시 캡처해 픽셀 비교
        for (const v of VIEWS) {
          map.jumpTo({ center: v.center, zoom: v.zoom });
          const s1 = await settle(map);
          const a = copy(map, 'preserve');
          await push(`${provider}-${v.id}`, a, { view: v.id, idleMs: s1.ms, tilesLoaded: s1.tilesLoaded });
          if (v.id === 'wide-z7.7' || v.id === 'district-z12') {
            map.jumpTo({ center: KOREA, zoom: 8.5 });
            await settle(map);
            map.jumpTo({ center: v.center, zoom: v.zoom });
            await settle(map);
            const d = diff(a, copy(map, 'preserve'));
            results.push({ label: `${provider}-${v.id}-determinism`, ...d });
            log(`${provider}-${v.id} determinism ${JSON.stringify(d)}`);
          }
        }
      }
      map.remove();
      el.remove();
    }
    // 4) 1080×1920: (a) 컨테이너 480×854 + pixelRatio 2.25 (라벨 비율 유지) (b) 컨테이너 1080×1920 + zoom+log2(2.25)
    {
      const { map, el } = await makeMap(provider, 480, 854, { preserve: true, pixelRatio: 1080 / 480, localCjk: true });
      map.jumpTo({ center: SEOUL, zoom: 7.7 });
      const s = await settle(map);
      await push(`${provider}-1080-pr2.25-wide`, copy(map, 'preserve'), { idleMs: s.ms });
      map.remove();
      el.remove();
    }
    {
      const { map, el } = await makeMap(provider, 1080, 1920, { preserve: true, pixelRatio: 1, localCjk: true });
      map.jumpTo({ center: SEOUL, zoom: 7.7 + Math.log2(1080 / 480) });
      const s = await settle(map);
      await push(`${provider}-1080-container-wide`, copy(map, 'preserve'), { idleMs: s.ms });
      map.remove();
      el.remove();
    }
    // 5) 한글 라벨 글리프: 로컬 폰트(기본) vs 스타일 글리프(localIdeographFontFamily:false) — z13.5
    {
      const { map, el } = await makeMap(provider, 480, 854, { preserve: true, pixelRatio: 1, localCjk: false });
      map.jumpTo({ center: SEOUL, zoom: 13.5 });
      const s = await settle(map);
      await push(`${provider}-street-z13.5-styleglyphs`, copy(map, 'preserve'), { idleMs: s.ms, tilesLoaded: s.tilesLoaded });
      map.remove();
      el.remove();
    }
  }
  return { results };
}

/**
 * 결정론 심화: (1) 새 인스턴스 2개 같은 뷰 (2) 같은 카메라 경로 재생 2회 → 프레임별 픽셀 비교.
 * 경로는 서울시청 주변 공개 좌표를 줌·중심을 바꿔 가며 이동 (실궤적 아님).
 */
function diffMask(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = a.width;
  c.height = a.height;
  const g = c.getContext('2d')!;
  g.drawImage(a, 0, 0);
  const x = a.getContext('2d')!.getImageData(0, 0, a.width, a.height);
  const y = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] !== y[i] || x.data[i + 1] !== y[i + 1] || x.data[i + 2] !== y[i + 2]) {
      x.data[i] = 255;
      x.data[i + 1] = 0;
      x.data[i + 2] = 0;
    }
  }
  g.putImageData(x, 0, 0);
  return c;
}

const PATH = Array.from({ length: 16 }, (_, i) => ({
  center: [SEOUL[0] + Math.sin(i / 3) * 0.6, SEOUL[1] - i * 0.05] as [number, number],
  zoom: 7.2 + (i % 5) * 0.8,
}));

async function determinism(opts: { providers?: Provider[]; nameEn?: boolean } = {}) {
  const results: Record<string, unknown>[] = [];
  for (const provider of opts.providers ?? (['carto', 'ofm'] as Provider[])) {
    // (1) 새 인스턴스 두 개
    const shots: HTMLCanvasElement[] = [];
    for (let k = 0; k < 2; k++) {
      const { map, el } = await makeMap(provider, 480, 854, { preserve: true, pixelRatio: 1, localCjk: true });
      map.jumpTo({ center: SEOUL, zoom: 7.7 });
      await settle(map);
      shots.push(copy(map, 'preserve'));
      map.remove();
      el.remove();
    }
    const d1 = diff(shots[0], shots[1]);
    results.push({ label: `${provider}-fresh-vs-fresh-z7.7`, ...d1 });
    log(`${provider} fresh-vs-fresh ${JSON.stringify(d1)}`);
    // (2) 경로 재생 2회
    const runs: HTMLCanvasElement[][] = [];
    for (let k = 0; k < 2; k++) {
      const { map, el } = await makeMap(provider, 480, 854, { preserve: true, pixelRatio: 1, localCjk: true });
      const frames: HTMLCanvasElement[] = [];
      for (const v of PATH) {
        map.jumpTo(v);
        await settle(map);
        frames.push(copy(map, 'preserve'));
      }
      runs.push(frames);
      map.remove();
      el.remove();
    }
    const per = runs[0].map((f, i) => diff(f, runs[1][i]));
    const bad = per.map((d, i) => ({ i, ...d })).filter((d) => d.differingPixels > 0);
    results.push({ label: `${provider}-path-replay`, frames: per.length, framesDiffering: bad.length, worst: bad.sort((a, b) => b.differingPixels - a.differingPixels).slice(0, 3) });
    log(`${provider} path-replay framesDiffering=${bad.length}/${per.length}`);
    if (bad.length) {
      const i = bad[0].i;
      const p = await png(diffMask(runs[0][i], runs[1][i]));
      results.push({ label: `${provider}-path-replay-diffmask-f${i}`, ext: 'png', base64: p.base64 });
    }
    if (d1.differingPixels) {
      const p = await png(diffMask(shots[0], shots[1]));
      results.push({ label: `${provider}-fresh-diffmask`, ext: 'png', base64: p.base64 });
    }
  }
  return { results };
}

(window as unknown as { spike: unknown }).spike = { run, determinism, ready: true };
log('ready');
