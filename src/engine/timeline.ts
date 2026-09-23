/**
 * 영상 시간 ↔ 진행량 (D-05 · D-24). 모든 계산은 **프레임 인덱스** 기준 (H-6).
 *
 * D-24: 진행은 **누적 거리에 선형** — 레퍼런스 km 카운터가 초당 거의 일정(≈772 km/s)하고, 거리 선형 가설이
 * 12개 기준 프레임의 월 표기 10/10 · km 평균 오차 1.7% 로 맞는다 (시간 선형은 6/10 · 10.4%). docs/phase3-lookfeel.md §1.
 * 이동 거리가 0 인 트랙은 점 순번 선형으로 폴백한다 (track.ts pace).
 *
 * 레퍼런스 실측 (docs/reference-spec.md §2): km 마지막 변화 f359 · f360 부터 고정 · 아웃트로 줌 f361→f381 · 마커 소멸 f361→f364.
 * → 진행은 애니메이션 **마지막 프레임(animFrames−1 = f359)** 에서 끝, f360 은 정지 프레임 (Phase 4 MP4 재측정).
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
  /** 애니메이션 구간 프레임 수 (= animS·FPS). 이 프레임에서 진행 = 끝 */
  animFrames: number;
  /** 총 진행량 (pace 단위 — km 또는 점 순번) */
  total: number;
  /** 영상 1초당 진행량 */
  perVideoS: number;
};

export function makeTimeline(total: number, animS: number): Timeline {
  if (!(total >= 0)) throw new Error('timeline: total < 0');
  return { animS, frames: frameCount(animS), animFrames: Math.round(animS * FPS), total, perVideoS: total / animS };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 프레임 i 의 진행량 — 선형, 애니메이션 마지막 프레임(animFrames−1)에서 끝, 이후 고정 */
export const paceAt = (tl: Timeline, i: number) => clamp01(i / Math.max(1, tl.animFrames - 1)) * tl.total;

/** 아웃트로 카메라 이동 진행률 0→1 (f=animFrames 에서 0, +21 에서 1) */
export const outroMoveProgress = (tl: Timeline, i: number) => clamp01((i - tl.animFrames) / OUTRO_MOVE_FRAMES);

/**
 * 마커 크기 배율 1→0 (아웃트로 첫 4프레임). 레퍼런스 MP4 의 검정 코어 면적 93→86→80→56→0 —
 * 어두운 채로 **작아진다**(알파 페이드면 첫 프레임부터 밝아짐) → 반지름 배율 1 − p⁴
 */
export const markerScale = (tl: Timeline, i: number) => 1 - clamp01((i - tl.animFrames) / MARKER_FADE_FRAMES) ** 4;

export const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
