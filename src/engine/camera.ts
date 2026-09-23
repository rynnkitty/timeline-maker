/**
 * 카메라 (에이전트 §2.4 · §5 · D-25): 최근 창 bbox 를 **평활**한 뒤 현재 헤드를 합쳐 fit (+ 헤더 패딩 · 줌 클램프).
 * - 카메라 자체가 아니라 bbox 네 모서리를 평활 → 평활 지연 중에도 헤드는 항상 패딩 안.
 * - 시작 이전(프레임 < 0)의 창 = 첫 점을 화면 정중앙·startZoom 으로 보이게 하는 가상 박스 (C-2 가설 c, 레퍼런스 f000 일치).
 * - 아웃트로: camera(animFrames) → 전체 경로 fit 을 ease-out (f361→f381), 이후 고정.
 * 모든 값은 프레임 인덱스의 순수 함수로 **미리 계산** → 임의 프레임 접근 = 순차 계산 (H-6).
 * 튜닝 근거: docs/phase3-lookfeel.md
 */
import { BASE_H, BASE_W, TILE_PX } from './mercator.ts';
import { easeOutCubic, outroMoveProgress, paceAt, type Timeline } from './timeline.ts';
import { headAt, indexAtOrBefore, type Track } from './track.ts';
import type { Camera } from './types.ts';

export type Padding = { top: number; bottom: number; left: number; right: number };

export type CameraParams = {
  /** 창: 헤드 기준 과거 몇 영상초 분량 (진행 축 기준) */
  windowBackS: number;
  /** 창: 헤드 기준 앞으로 몇 영상초 분량 */
  windowAheadS: number;
  /** 평활 커널 반폭 (프레임). 박스 두 번 = 삼각형 길이 2K−1 */
  smoothFrames: number;
  minZoom: number;
  maxZoom: number;
  /** 시작 이전 줌 (C-2) */
  startZoom: number;
  /** 헤드 union 후 카메라 후평활 (프레임) — 헤드가 bbox 경계를 넘는 순간의 꺾임 완화 */
  postSmoothFrames: number;
  /** 480×854 기준 px. top 에 헤더 카드 포함 */
  pad: Padding;
  /** 아웃트로 전체 경로 fit 패딩 — 레퍼런스 f394 는 경로 둘레 여백이 더 넓다 */
  outroPad: Padding;
};

export const DEFAULT_CAMERA: CameraParams = {
  windowBackS: 1.5,
  windowAheadS: 0.5,
  smoothFrames: 12,
  minZoom: 3,
  maxZoom: 9,
  startZoom: 7.7,
  postSmoothFrames: 1,
  pad: { top: 110, bottom: 40, left: 30, right: 30 },
  outroPad: { top: 150, bottom: 110, left: 60, right: 60 },
};

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

const avail = (p: CameraParams) => ({ aw: BASE_W - p.pad.left - p.pad.right, ah: BASE_H - p.pad.top - p.pad.bottom });

/** 패딩된 박스 중심이 화면 중심에서 벗어난 정도 (월드 단위, 줌 z) */
function padShift(p: CameraParams, zoom: number) {
  const { aw, ah } = avail(p);
  const s = TILE_PX * 2 ** zoom;
  return { dx: (p.pad.left + aw / 2 - BASE_W / 2) / s, dy: (p.pad.top + ah / 2 - BASE_H / 2) / s };
}

/**
 * 부드러운 상한: z < cap−w 는 그대로, cap+w 이상은 cap, 사이는 2차 전이 (C¹ 연속 · 항상 ≤ z).
 * 딱딱한 min() 은 줌이 상한에 닿는 순간 속도가 끊겨 보인다.
 */
export function softCap(z: number, cap: number, w: number): number {
  if (z <= cap - w) return z;
  if (z >= cap + w) return cap;
  return z - (z - (cap - w)) ** 2 / (4 * w);
}
const SOFT_CAP_W = 0.6;
const smaxZ = (a: number, b: number, w: number) => (a + b + Math.sqrt((a - b) ** 2 + w * w)) / 2;

/** bbox 를 패딩 안쪽에 맞추는 카메라 (480×854 기준). 크기 0 이면 maxZoom (부드러운 상한) */
export function fitBBox(b: BBox, p: CameraParams): Camera {
  const { aw, ah } = avail(p);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const zx = bw > 0 ? Math.log2(aw / (bw * TILE_PX)) : Infinity;
  const zy = bh > 0 ? Math.log2(ah / (bh * TILE_PX)) : Infinity;
  // 폭/높이 제약 전환(min) 도 부드럽게 — 부드러운 최소는 항상 ≤ min 이라 bbox 는 여전히 패딩 안
  const zc = Math.min(zx, zy, p.maxZoom + SOFT_CAP_W);
  const zxy = Number.isFinite(zx) && Number.isFinite(zy) ? -smaxZ(-zx, -zy, 0.3) : zc;
  const zoom = Math.max(p.minZoom, softCap(Math.min(zxy, zc), p.maxZoom, SOFT_CAP_W));
  const { dx, dy } = padShift(p, zoom);
  return { x: (b.minX + b.maxX) / 2 - dx, y: (b.minY + b.maxY) / 2 - dy, zoom };
}

/** fitBBox 의 역: 이 박스를 fit 하면 (거의) 정확히 cam 이 된다 */
export function bboxForCamera(cam: Camera, p: CameraParams): BBox {
  const { aw, ah } = avail(p);
  const s = TILE_PX * 2 ** cam.zoom;
  const { dx, dy } = padShift(p, cam.zoom);
  const cx = cam.x + dx;
  const cy = cam.y + dy;
  // 높이는 절반만 채운다 → 폭 제약 하나만 걸려 부드러운 최소의 치우침(두 값이 같을 때 w/2)이 생기지 않는다
  return { minX: cx - aw / s / 2, maxX: cx + aw / s / 2, minY: cy - ah / s / 4, maxY: cy + ah / s / 4 };
}

/** 진행 [a, b] 안의 점 + 헤드 위치의 bbox */
export function windowBBox(tr: Track, a: number, b: number, headX: number, headY: number): BBox {
  const bb: BBox = { minX: headX, minY: headY, maxX: headX, maxY: headY };
  const i0 = indexAtOrBefore(tr, a) + 1;
  const i1 = indexAtOrBefore(tr, b);
  for (let i = Math.max(0, i0); i <= i1; i++) {
    const x = tr.x[i];
    const y = tr.y[i];
    if (x < bb.minX) bb.minX = x;
    if (x > bb.maxX) bb.maxX = x;
    if (y < bb.minY) bb.minY = y;
    if (y > bb.maxY) bb.maxY = y;
  }
  return bb;
}

export function trackBBox(tr: Track): BBox {
  return windowBBox(tr, -Infinity, Infinity, tr.x[0], tr.y[0]);
}

/** 부드러운 최대 — 항상 ≥ max(a, b) (헤드가 박스 안이라는 보장 유지), C∞ 연속 */
const smax = (a: number, b: number, w: number) => (a + b + Math.sqrt((a - b) ** 2 + w * w)) / 2;

/** 박스에 헤드를 부드럽게 합친다. 딱딱한 min/max 는 헤드가 경계를 넘는 순간 줌 속도가 꺾인다 */
function softUnion(b: BBox, x: number, y: number): BBox {
  const w = 0.15 * Math.max(b.maxX - b.minX, b.maxY - b.minY, 1e-9);
  return { minX: -smax(-b.minX, -x, w), maxX: smax(b.maxX, x, w), minY: -smax(-b.minY, -y, w), maxY: smax(b.maxY, y, w) };
}

function boxSmooth(src: BBox[], K: number): BBox[] {
  const out: BBox[] = [];
  // 매 프레임 직접 평균 — 누적합의 부동소수 오차 없이 임의 접근 = 순차 계산
  for (let j = K - 1; j < src.length; j++) {
    const m: BBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    for (let q = j - K + 1; q <= j; q++) {
      m.minX += src[q].minX;
      m.minY += src[q].minY;
      m.maxX += src[q].maxX;
      m.maxY += src[q].maxY;
    }
    out.push({ minX: m.minX / K, minY: m.minY / K, maxX: m.maxX / K, maxY: m.maxY / K });
  }
  return out;
}

export function computeCameras(tr: Track, tl: Timeline, p: CameraParams = DEFAULT_CAMERA): Camera[] {
  const K = Math.max(1, p.smoothFrames);
  const pre = 2 * (K - 1);
  const startBox = bboxForCamera({ x: tr.x[0], y: tr.y[0], zoom: p.startZoom }, p);
  const back = p.windowBackS * tl.perVideoS;
  const ahead = p.windowAheadS * tl.perVideoS;
  const heads = Array.from({ length: tl.animFrames + 1 }, (_, i) => headAt(tr, paceAt(tl, i)));

  const raw: BBox[] = [];
  for (let i = -pre; i <= tl.animFrames; i++) {
    if (i < 0) raw.push(startBox);
    else raw.push(windowBBox(tr, heads[i].pace - back, heads[i].pace + ahead, heads[i].x, heads[i].y));
  }
  const smooth = boxSmooth(boxSmooth(raw, K), K); // 삼각형 커널 — smooth[i] = 프레임 i

  const fit = smooth.map((b, i) => fitBBox(softUnion(b, heads[i].x, heads[i].y), p));
  // 후평활: 과거 쪽 박스 평균 (시작 부분은 있는 만큼만)
  const K2 = Math.max(1, p.postSmoothFrames);
  const cams: Camera[] = new Array(tl.frames);
  for (let i = 0; i <= tl.animFrames; i++) {
    const a = Math.max(0, i - K2 + 1);
    let x = 0;
    let y = 0;
    let z = 0;
    for (let q = a; q <= i; q++) {
      x += fit[q].x;
      y += fit[q].y;
      z += fit[q].zoom;
    }
    const n = i - a + 1;
    cams[i] = { x: x / n, y: y / n, zoom: z / n };
  }

  const from = cams[tl.animFrames];
  const to = fitBBox(trackBBox(tr), { ...p, pad: p.outroPad, maxZoom: Math.min(p.maxZoom, from.zoom) });
  for (let i = tl.animFrames + 1; i < tl.frames; i++) {
    const e = easeOutCubic(outroMoveProgress(tl, i));
    cams[i] = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom + (to.zoom - from.zoom) * e };
  }
  return cams;
}
