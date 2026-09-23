/**
 * 프레임 합성 — 미리보기와 내보내기가 **같은** renderFrame 을 쓴다 (H-6).
 *   buildScene()   : 트랙 + 옵션 → 장면 (카메라 전 프레임 사전 계산)
 *   computeFrame() : 프레임 인덱스 → 상태 (순수 · 테스트 대상)
 *   drawFrame()    : 상태 + 지도 이미지 → 캔버스 (렌더 순서: 지도 → 트레일(오래된 것 먼저) → 마커 → 헤더 → attribution)
 *   renderFrame()  : 지도 렌더(타일 로딩 완료 대기) + drawFrame
 * 엔진 내부에서 Date.now·performance.now·Math.random 금지 (eslint 로 강제).
 */
import { DEFAULT_CAMERA, computeCameras, type CameraParams } from './camera.ts';
import { FONT_FAMILY, HUD, localYearMonth, subtitleText, titleText, type HudLayout } from './hud.ts';
import { worldScale } from './mercator.ts';
import { dataTimeAt, makeTimeline, markerAlpha, outroMoveProgress, type Timeline } from './timeline.ts';
import { GREEN, TRAIL_BANDS, bandEdgesS, mixOutro, rgbCss, strokeForAge, type Stroke, type TrailTheme } from './trail.ts';
import { headAt, indexAtOrBefore, type Head, type Track } from './track.ts';
import type { Camera, MapRenderer } from './types.ts';

export type SceneOptions = {
  animS: number;
  width: number;
  height: number;
  name: string;
  theme?: TrailTheme;
  camera?: CameraParams;
  hud?: HudLayout;
};

export type Scene = {
  track: Track;
  timeline: Timeline;
  cameras: Camera[];
  width: number;
  height: number;
  /** 출력 배율 W/480 */
  s: number;
  title: string;
  theme: TrailTheme;
  hud: HudLayout;
};

export function buildScene(track: Track, o: SceneOptions): Scene {
  if (track.n === 0) throw new Error('empty track');
  const timeline = makeTimeline(track.t[0], track.t[track.n - 1], o.animS);
  const { year } = localYearMonth(track.t[0], track.tz[0]);
  return {
    track,
    timeline,
    cameras: computeCameras(track, timeline, o.camera ?? DEFAULT_CAMERA),
    width: o.width,
    height: o.height,
    s: o.width / 480,
    title: titleText(year, o.name),
    theme: o.theme ?? GREEN,
    hud: o.hud ?? HUD,
  };
}

/** 트레일 밴드: 점 인덱스 [from, to] (+ 마지막 밴드는 헤드까지) 를 한 스타일로 */
export type Band = { from: number; to: number; toHead: boolean; stroke: Stroke };

export type FrameState = {
  i: number;
  dataT: number;
  camera: Camera;
  head: Head;
  subtitle: string;
  bands: Band[];
  markerAlpha: number;
  outroMix: number;
};

export function computeFrame(sc: Scene, i: number): FrameState {
  const { track: tr, timeline: tl, theme: th } = sc;
  const fi = Math.max(0, Math.min(tl.frames - 1, i));
  const dataT = dataTimeAt(tl, fi);
  const head = headAt(tr, dataT);
  const outroMix = outroMoveProgress(tl, fi);

  // 나이 경계 → 시간 경계 → 인덱스 경계. 나이는 인덱스에 대해 단조라 밴드 = 연속 구간
  const edges = bandEdgesS(th, TRAIL_BANDS);
  const bands: Band[] = [];
  let start = 0;
  for (let b = TRAIL_BANDS; b >= 0; b--) {
    const endT = dataT - edges[b] * tl.msPerVideoS; // 이 밴드에 속하는 가장 늦은 시간
    const end = b === 0 ? head.i : Math.min(head.i, indexAtOrBefore(tr, endT));
    if (end < start && b !== 0) continue;
    const ageMid = b === TRAIL_BANDS ? th.rampS : (edges[b] + edges[b + 1]) / 2;
    const from = Math.max(0, start - 1); // 앞 밴드의 마지막 점과 겹쳐 이음매 없이
    bands.push({ from, to: Math.max(from, end), toHead: b === 0, stroke: mixOutro(strokeForAge(ageMid, th), outroMix, th) });
    start = end + 1;
  }

  return {
    i: fi,
    dataT,
    camera: sc.cameras[fi],
    head,
    subtitle: subtitleText(dataT, head.tz, head.km),
    bands,
    markerAlpha: markerAlpha(tl, fi),
    outroMix,
  };
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawFrame(ctx: Ctx2D, sc: Scene, st: FrameState, mapImage: CanvasImageSource | null, attribution: string): void {
  const { width: W, height: H, s, track: tr, theme: th, hud } = sc;
  const cam = st.camera;
  const k = worldScale(cam.zoom, W);
  const px = (x: number) => W / 2 + (x - cam.x) * k;
  const py = (y: number) => H / 2 + (y - cam.y) * k;

  if (mapImage) ctx.drawImage(mapImage, 0, 0, W, H);
  else {
    ctx.fillStyle = '#fafaf8';
    ctx.fillRect(0, 0, W, H);
  }

  // 트레일 — 오래된 밴드부터
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const b of st.bands) {
    ctx.beginPath();
    let lx = px(tr.x[b.from]);
    let ly = py(tr.y[b.from]);
    ctx.moveTo(lx, ly);
    let n = 0;
    for (let j = b.from + 1; j <= b.to; j++) {
      const x = px(tr.x[j]);
      const y = py(tr.y[j]);
      // 0.7px 이내 점 생략 (대용량 트랙 그리기 비용 — C-13)
      if (Math.abs(x - lx) + Math.abs(y - ly) < 0.7 && j !== b.to) continue;
      ctx.lineTo(x, y);
      lx = x;
      ly = y;
      n++;
    }
    if (b.toHead) {
      ctx.lineTo(px(st.head.x), py(st.head.y));
      n++;
    }
    if (n === 0) ctx.lineTo(lx + 0.01, ly); // 한 점만 있어도 round cap 으로 점을 찍는다
    ctx.strokeStyle = rgbCss(b.stroke.rgb, b.stroke.alpha);
    ctx.lineWidth = b.stroke.width * s;
    ctx.stroke();
  }

  // 현재 위치 마커: 녹색 링 + 검정 코어 (아웃트로에서 페이드아웃)
  if (st.markerAlpha > 0) {
    const hx = px(st.head.x);
    const hy = py(st.head.y);
    ctx.fillStyle = rgbCss(th.recent, st.markerAlpha);
    ctx.beginPath();
    ctx.arc(hx, hy, th.markerRingR * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgbCss(th.markerCore, st.markerAlpha);
    ctx.beginPath();
    ctx.arc(hx, hy, th.markerCoreR * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // 헤더 카드
  const c = hud.card;
  ctx.fillStyle = rgbCss(c.rgb, c.alpha);
  ctx.beginPath();
  ctx.roundRect(c.x * s, c.y * s, c.w * s, c.h * s, c.r * s);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgbCss(hud.title.rgb);
  ctx.font = `${hud.title.weight} ${hud.title.size * s}px ${FONT_FAMILY}`;
  ctx.fillText(sc.title, W / 2, hud.title.y * s);
  ctx.fillStyle = rgbCss(hud.subtitle.rgb);
  ctx.font = `${hud.subtitle.weight} ${hud.subtitle.size * s}px ${FONT_FAMILY}`;
  ctx.fillText(st.subtitle, W / 2, hud.subtitle.y * s);

  // attribution — 항상 최상단 (H-3)
  const a = hud.attribution;
  ctx.textAlign = 'right';
  ctx.fillStyle = rgbCss(a.rgb);
  ctx.font = `400 ${a.size * s}px ${FONT_FAMILY}`;
  ctx.fillText(attribution, a.right * s, a.y * s);
}

/** 지도(타일 로딩 완료까지 대기) + 합성. 반환: 그린 상태 */
export async function renderFrame(ctx: Ctx2D, sc: Scene, map: MapRenderer, i: number): Promise<FrameState> {
  const st = computeFrame(sc, i);
  const img = await map.render(st.camera, st.i);
  drawFrame(ctx, sc, st, img, map.attribution);
  return st;
}
