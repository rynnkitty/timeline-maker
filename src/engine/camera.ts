/**
 * 카메라 (에이전트 §2.4 · §5): 최근 창 bbox fit + 패딩(헤더 포함) + 줌 클램프 + 평활.
 * 모든 값은 프레임 인덱스의 순수 함수로 **미리 계산**한다 → 임의 프레임 접근·결정론 (H-6).
 * 모델·파라미터 근거: docs/phase3-lookfeel.md · docs/adrs/0001-engine-map-boundary.md
 */
import { BASE_H, BASE_W, TILE_PX } from './mercator.ts';
import { easeOutCubic, dataTimeAt, outroMoveProgress, type Timeline } from './timeline.ts';
import { headAt, indexAtOrBefore, type Track } from './track.ts';
import type { Camera } from './types.ts';

export type Padding = { top: number; bottom: number; left: number; right: number };

export type CameraParams = {
  /** 창: 헤드 기준 과거 몇 영상초 분량의 데이터 */
  windowBackS: number;
  /** 창: 헤드 기준 앞으로 몇 영상초 분량 (선행) */
  windowAheadS: number;
  /** 평활: 과거 몇 프레임의 목표 카메라를 평균 */
  smoothFrames: number;
  minZoom: number;
  maxZoom: number;
  /** t<0 (시작 이전) 목표 줌 — 평활 창이 처음에 끌고 들어온다 (C-2) */
  startZoom: number;
  /** 480×854 기준 px. top 에 헤더 카드 포함 */
  pad: Padding;
};

export const DEFAULT_CAMERA: CameraParams = {
  windowBackS: 0.9,
  windowAheadS: 0,
  smoothFrames: 12,
  minZoom: 3,
  maxZoom: 11,
  startZoom: 7.7,
  pad: { top: 110, bottom: 40, left: 30, right: 30 },
};

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

/** bbox 를 패딩 안쪽에 맞추는 카메라 (480×854 기준). 크기 0 이면 maxZoom */
export function fitBBox(b: BBox, p: CameraParams): Camera {
  const aw = BASE_W - p.pad.left - p.pad.right;
  const ah = BASE_H - p.pad.top - p.pad.bottom;
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const zx = bw > 0 ? Math.log2(aw / (bw * TILE_PX)) : Infinity;
  const zy = bh > 0 ? Math.log2(ah / (bh * TILE_PX)) : Infinity;
  const zoom = Math.max(p.minZoom, Math.min(p.maxZoom, zx, zy));
  const s = TILE_PX * 2 ** zoom;
  // 패딩된 박스의 중심이 화면 중심에서 벗어난 만큼 카메라를 반대로 민다
  const dx = (p.pad.left + aw / 2 - BASE_W / 2) / s;
  const dy = (p.pad.top + ah / 2 - BASE_H / 2) / s;
  return { x: (b.minX + b.maxX) / 2 - dx, y: (b.minY + b.maxY) / 2 - dy, zoom };
}

/** 데이터 시간 [a, b] 안의 점 + 헤드 위치의 bbox */
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

function targetAt(tr: Track, tl: Timeline, p: CameraParams, i: number): Camera {
  // 시작 이전: 첫 점을 화면 정중앙, startZoom (레퍼런스 f000 마커 = 프레임 중심 — C-2 가설 c)
  if (i < 0) return { x: tr.x[0], y: tr.y[0], zoom: p.startZoom };
  const dt = dataTimeAt(tl, i);
  const h = headAt(tr, dt);
  return fitBBox(windowBBox(tr, dt - p.windowBackS * tl.msPerVideoS, dt + p.windowAheadS * tl.msPerVideoS, h.x, h.y), p);
}

/**
 * 전 프레임 카메라. 애니메이션 구간: 목표 카메라를 과거 쪽 삼각형 커널(2·smoothFrames−1 프레임)로 평균.
 * 아웃트로: camera(animFrames) → 전체 경로 fit 을 ease-out (f361→f381), 이후 고정.
 */
export function computeCameras(tr: Track, tl: Timeline, p: CameraParams = DEFAULT_CAMERA): Camera[] {
  const K = Math.max(1, p.smoothFrames);
  // 박스 평균을 두 번 = 삼각형 커널 (길이 2K−1). 한 번만 쓰면 줌이 일정 속도로 출발·정지해 끊겨 보인다
  const pre = 2 * (K - 1);
  const targets: Camera[] = [];
  for (let i = -pre; i <= tl.animFrames; i++) targets.push(targetAt(tr, tl, p, i));
  const box = (src: Camera[]): Camera[] => {
    const out: Camera[] = [];
    // 매 프레임 직접 평균 — 누적합의 부동소수 오차 없이 임의 접근 = 순차 계산
    for (let j = K - 1; j < src.length; j++) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (let q = j - K + 1; q <= j; q++) {
        x += src[q].x;
        y += src[q].y;
        z += src[q].zoom;
      }
      out.push({ x: x / K, y: y / K, zoom: z / K });
    }
    return out;
  };
  const smooth = box(box(targets)); // 길이 = animFrames + 1, smooth[i] = 프레임 i
  const cams: Camera[] = new Array(tl.frames);
  for (let i = 0; i <= tl.animFrames; i++) cams[i] = smooth[i];
  const from = cams[tl.animFrames];
  const to = fitBBox(trackBBox(tr), { ...p, maxZoom: Math.min(p.maxZoom, from.zoom) });
  for (let i = tl.animFrames + 1; i < tl.frames; i++) {
    const e = easeOutCubic(outroMoveProgress(tl, i));
    cams[i] = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom + (to.zoom - from.zoom) * e };
  }
  return cams;
}
