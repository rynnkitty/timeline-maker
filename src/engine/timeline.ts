/**
 * 영상 시간 ↔ 데이터 시간 (D-05 · 에이전트 §5 시간 매핑). 모든 계산은 **프레임 인덱스** 기준 (H-6).
 * 레퍼런스 실측 (docs/reference-spec.md §2): km 마지막 변화 f359 · f360 부터 고정 · 아웃트로 줌 f361→f381 ·
 * 마커 소멸 f361→f364.
 */
export const FPS = 24;
export const OUTRO_S = 1.5;
/** 아웃트로 카메라 이동 프레임 수 (f361→f381) */
export const OUTRO_MOVE_FRAMES = 21;
/** 아웃트로 마커 페이드 프레임 수 (f361→f364) */
export const MARKER_FADE_FRAMES = 4;

export const frameCount = (animS: number) => Math.round((animS + OUTRO_S) * FPS);

export type Timeline = {
  animS: number;
  /** 전체 프레임 수 N */
  frames: number;
  /** 애니메이션 구간 프레임 수 (= animS·FPS). 이 프레임에서 데이터 시간 = 끝 */
  animFrames: number;
  /** 데이터 시간 범위 (epoch ms) */
  t0: number;
  t1: number;
  /** 영상 1초당 데이터 ms */
  msPerVideoS: number;
};

export function makeTimeline(t0: number, t1: number, animS: number): Timeline {
  if (!(t1 >= t0)) throw new Error('timeline: t1 < t0');
  return { animS, frames: frameCount(animS), animFrames: Math.round(animS * FPS), t0, t1, msPerVideoS: (t1 - t0) / animS };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 프레임 i 의 데이터 시간 — 선형 압축, 애니메이션 끝 이후 고정. 음수 i 는 시작 이전(카메라 평활용)으로 외삽 */
export function dataTimeAt(tl: Timeline, i: number): number {
  const p = Math.min(1, i / tl.animFrames);
  return tl.t0 + p * (tl.t1 - tl.t0);
}

/** 아웃트로 카메라 이동 진행률 0→1 (f=animFrames 에서 0, +21 에서 1) */
export const outroMoveProgress = (tl: Timeline, i: number) => clamp01((i - tl.animFrames) / OUTRO_MOVE_FRAMES);

/** 마커 불투명도 1→0 (아웃트로 첫 4프레임) */
export const markerAlpha = (tl: Timeline, i: number) => 1 - clamp01((i - tl.animFrames) / MARKER_FADE_FRAMES);

export const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
