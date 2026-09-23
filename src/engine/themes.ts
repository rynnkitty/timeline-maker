/**
 * 색상 테마 프리셋 (O-06 → D-32). 기본 = 숲 = 레퍼런스 녹색 (D-26).
 * 각 테마는 레퍼런스 램프의 명도 관계를 유지한다: 최근(진함) < 아웃트로(중간) < old(아주 옅음, 지도 위에서 겨우 보임).
 */
import { GREEN, type TrailTheme } from './trail.ts';

export type ThemePreset = { id: string; label: string; theme: TrailTheme };

const tint = (recent: TrailTheme['recent'], old: TrailTheme['old'], outro: TrailTheme['outro']): TrailTheme => ({
  ...GREEN,
  recent,
  old,
  outro,
});

export const THEMES: readonly ThemePreset[] = [
  { id: 'forest', label: '숲', theme: GREEN },
  { id: 'sea', label: '바다', theme: tint([28, 86, 150], [214, 232, 250], [96, 138, 186]) },
  { id: 'sunset', label: '노을', theme: tint([184, 70, 38], [252, 226, 214], [212, 126, 98]) },
  { id: 'violet', label: '제비꽃', theme: tint([98, 60, 156], [234, 224, 250], [146, 118, 190]) },
  { id: 'ink', label: '먹', theme: tint([38, 42, 46], [222, 224, 226], [110, 114, 118]) },
];

export const themeById = (id: string): TrailTheme => (THEMES.find((t) => t.id === id) ?? THEMES[0]).theme;
