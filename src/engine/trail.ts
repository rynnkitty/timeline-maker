/**
 * 트레일 스타일 (에이전트 §2.3 · §5 트레일 페이드).
 * 나이 = 헤드 데이터 시간 − 점 시간, **영상초** 단위 (기간·길이 옵션과 무관하게 같은 룩).
 * 색·폭 램프: 최근 = 진한 녹색·굵게 → rampS 영상초에 걸쳐 옅은 민트·가늘게. 그 뒤 상수 또는 사라짐.
 * 파라미터 근거: docs/phase3-lookfeel.md (기준 프레임 녹색 픽셀 휘도 히스토그램 대조).
 */
export type RGB = [number, number, number];

export type TrailTheme = {
  recent: RGB;
  old: RGB;
  recentWidth: number;
  oldWidth: number;
  /** 최근 → old 로 가는 데 걸리는 나이 (영상초) */
  rampS: number;
  /** rampS 이후 불투명도. 0 이면 사라짐 모델 */
  oldAlpha: number;
  /** 아웃트로 균일 톤 */
  outro: RGB;
  outroWidth: number;
  outroAlpha: number;
  /** 현재 위치 마커 */
  markerCore: RGB;
  markerCoreR: number;
  markerRingR: number;
};

export const GREEN: TrailTheme = {
  recent: [30, 118, 69],
  old: [150, 205, 175],
  recentWidth: 6,
  oldWidth: 2.5,
  rampS: 2,
  oldAlpha: 0.9,
  outro: [30, 118, 69],
  outroWidth: 2.5,
  outroAlpha: 0.7,
  markerCore: [20, 20, 20],
  markerCoreR: 5.5,
  markerRingR: 10,
};

export type Stroke = { rgb: RGB; alpha: number; width: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** 나이(영상초) → 선 스타일 (480 기준 폭). 나이에 대해 색은 옅어지고 폭은 단조 감소 */
export function strokeForAge(ageS: number, th: TrailTheme): Stroke {
  const u = Math.max(0, Math.min(1, ageS / th.rampS));
  const e = u * (2 - u); // ease-out: 최근 쪽이 빠르게 옅어짐
  return {
    rgb: mixRgb(th.recent, th.old, e),
    alpha: lerp(1, th.oldAlpha, e),
    width: lerp(th.recentWidth, th.oldWidth, e),
  };
}

/** 아웃트로 크로스페이드 m ∈ [0,1] */
export function mixOutro(s: Stroke, m: number, th: TrailTheme): Stroke {
  if (m <= 0) return s;
  return { rgb: mixRgb(s.rgb, th.outro, m), alpha: lerp(s.alpha, th.outroAlpha, m), width: lerp(s.width, th.outroWidth, m) };
}

export const TRAIL_BANDS = 16;

/**
 * 나이 밴드 경계 — 밴드 b 는 나이 [b·rampS/B, (b+1)·rampS/B), 마지막 밴드(B)는 rampS 이상 전부.
 * 나이는 인덱스에 대해 단조 → 각 밴드는 연속 인덱스 구간이라 경로 하나로 그린다.
 */
export function bandEdgesS(th: TrailTheme, bands = TRAIL_BANDS): number[] {
  return Array.from({ length: bands + 1 }, (_, b) => (b * th.rampS) / bands);
}

export const rgbCss = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(4)})`;
