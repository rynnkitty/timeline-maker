/** D-04 출력 해상도 (9:16 고정) · D-05 애니메이션 길이 */
export type Resolution = { width: number; height: number; label: string };
export const RESOLUTIONS: readonly Resolution[] = [
  { width: 480, height: 854, label: '480p' },
  { width: 720, height: 1280, label: '720p' },
  { width: 1080, height: 1920, label: '1080p' },
];
export const ANIM_LENGTHS = [15, 30, 60] as const;
