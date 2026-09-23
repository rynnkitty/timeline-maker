/**
 * HUD — 헤더 카드 · 제목 · 부제(월·누적 km) · attribution (에이전트 §2.3, 재측정 docs/phase3-lookfeel.md).
 * 좌표는 480×854 기준, 출력은 s = W/480 배율. 문자열 포맷은 로케일 비의존 (결정론).
 */
import type { RGB } from './trail.ts';

export const FONT_FAMILY = '"Noto Sans KR", sans-serif';

export type HudLayout = {
  card: { x: number; y: number; w: number; h: number; r: number; rgb: RGB; alpha: number };
  title: { y: number; size: number; weight: number; rgb: RGB };
  subtitle: { y: number; size: number; weight: number; rgb: RGB };
  attribution: { right: number; y: number; size: number; rgb: RGB };
};

export const HUD: HudLayout = {
  card: { x: 20, y: 17, w: 440, h: 71, r: 12, rgb: [255, 250, 252], alpha: 0.74 },
  title: { y: 39, size: 20, weight: 700, rgb: [20, 13, 16] },
  subtitle: { y: 67, size: 12, weight: 400, rgb: [95, 87, 91] },
  attribution: { right: 471, y: 844, size: 9, rgb: [117, 120, 120] },
};

/** 천 단위 콤마 — Intl/toLocaleString 은 로케일 의존이라 쓰지 않는다 */
export function formatThousands(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 현지 연·월 (점 자신의 tz 기준) */
export function localYearMonth(t: number, tzMin: number): { year: number; month: number } {
  const d = new Date(t + tzMin * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** `{YYYY}년 {이름}의 타임라인` — 기간이 해를 넘으면 `{YYYY}–{YYYY}년` (O-05 → D-32, en dash) */
export const titleText = (yearFrom: number, yearTo: number, name: string) =>
  `${yearFrom === yearTo ? yearFrom : `${yearFrom}–${yearTo}`}년 ${name}의 타임라인`;

/** `{YYYY}년 {M}월 · {km} km` — km 은 내림 정수 (레퍼런스: 시작 0 km) */
export function subtitleText(t: number, tzMin: number, km: number): string {
  const { year, month } = localYearMonth(t, tzMin);
  return `${year}년 ${month}월 · ${formatThousands(Math.floor(km))} km`;
}

/** 폰트 사전 로딩에 쓸 문자 집합 (숫자·콤마 포함) */
export const HUD_GLYPHS = '0123456789,·년월의 타임라인km';
