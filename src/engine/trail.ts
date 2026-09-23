/**
 * 트레일 스타일 (에이전트 §2.3 · §5 트레일 페이드 · D-26).
 * 나이 = (헤드 진행량 − 점 진행량) / 초당 진행량 → **영상초** (기간·길이 옵션과 무관하게 같은 룩).
 * 불투명 색·폭 램프: 0~holdS 진한 녹색·굵게 유지 → rampS 까지 연한 민트·가늘게 → (fadeS 가 유한하면) 그 뒤 사라짐.
 * 반투명 겹침은 중간톤 덩어리를 만든다 → 알파는 소멸 구간과 아웃트로 전환에만 쓴다.
 * 파라미터 근거: docs/phase3-lookfeel.md (기준 프레임 녹색 픽셀 휘도 5구간 히스토그램 대조).
 */
export type RGB = [number, number, number];

export type TrailTheme = {
  recent: RGB;
  old: RGB;
  recentWidth: number;
  oldWidth: number;
  /** 최근 색을 유지하는 나이 (영상초) */
  holdS: number;
  /** old 색·폭에 도달하는 나이 */
  rampS: number;
  /** 이 나이에 완전히 사라진다 (rampS→fadeS 알파 감소). Infinity 면 old 로 남는다 */
  fadeS: number;
  /** 아웃트로 균일 톤 */
  outro: RGB;
  outroWidth: number;
  /** 현재 위치 마커 */
  markerCore: RGB;
  markerCoreR: number;
  markerRingR: number;
};

export const GREEN: TrailTheme = {
  recent: [30, 118, 69],
  old: [218, 247, 228],
  recentWidth: 6,
  oldWidth: 2,
  holdS: 0.15,
  rampS: 1.2,
  fadeS: 3,
  outro: [95, 155, 122],
  outroWidth: 2.5,
  markerCore: [20, 20, 20],
  markerCoreR: 5.5,
  markerRingR: 10,
};

export type Stroke = { rgb: RGB; alpha: number; width: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 나이(영상초) → 선 스타일 (480 기준 폭). 색은 옅어지고 폭·알파는 단조 비증가 */
export function strokeForAge(ageS: number, th: TrailTheme): Stroke {
  const u = clamp01((ageS - th.holdS) / (th.rampS - th.holdS));
  const alpha = Number.isFinite(th.fadeS) ? 1 - clamp01((ageS - th.rampS) / (th.fadeS - th.rampS)) : 1;
  return { rgb: mixRgb(th.recent, th.old, u), alpha, width: lerp(th.recentWidth, th.oldWidth, u) };
}

/** 아웃트로 크로스페이드 m ∈ [0,1] — 사라졌던 오래된 구간도 m 에 따라 나타난다 (전체 경로 균일 톤) */
export function mixOutro(s: Stroke, m: number, th: TrailTheme): Stroke {
  if (m <= 0) return s;
  return { rgb: mixRgb(s.rgb, th.outro, m), alpha: lerp(s.alpha, 1, m), width: lerp(s.width, th.outroWidth, m) };
}

export const TRAIL_BANDS = 24;

/** 밴드가 덮는 최대 나이 — 그 이상은 한 밴드(사라짐 또는 old) */
export const maxBandAge = (th: TrailTheme) => (Number.isFinite(th.fadeS) ? th.fadeS : th.rampS);

/** 밴드 경계 (영상초). 밴드 b = [edges[b], edges[b+1]), 마지막 밴드(B) = maxBandAge 이상 */
export function bandEdgesS(th: TrailTheme, bands = TRAIL_BANDS): number[] {
  const m = maxBandAge(th);
  return Array.from({ length: bands + 1 }, (_, b) => (b * m) / bands);
}

export const rgbCss = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(4)})`;
