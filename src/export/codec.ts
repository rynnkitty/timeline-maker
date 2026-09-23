/**
 * H.264 레벨 선택 (ITU-T H.264 Table A-1 · MaxMBPS / MaxFS).
 * Mediabunny 자동 선택은 프레임 크기만 봐서 480×854@24 를 L2.2 로 잡는다 (MaxMBPS 20,250 < 38,880 → 규격 미달, C-10).
 * 그래서 fullCodecString 을 직접 준다 — 근거 docs/browser-support.md §1.1.
 */
const LEVELS: [level: number, maxMBPS: number, maxFS: number][] = [
  [10, 1485, 99],
  [11, 3000, 396],
  [12, 6000, 396],
  [13, 11880, 396],
  [20, 11880, 396],
  [21, 19800, 792],
  [22, 20250, 1620],
  [30, 40500, 1620],
  [31, 108000, 3600],
  [32, 216000, 5120],
  [40, 245760, 8192],
  [41, 245760, 8192],
  [42, 522240, 8704],
  [50, 589824, 22080],
  [51, 983040, 36864],
  [52, 2073600, 36864],
];

/** level_idc (예: 30 = 레벨 3.0) */
export function avcLevel(width: number, height: number, fps: number): number {
  const fs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const mbps = fs * fps;
  const hit = LEVELS.find(([, maxMBPS, maxFS]) => fs <= maxFS && mbps <= maxMBPS);
  if (!hit) throw new Error(`no H.264 level for ${width}x${height}@${fps}`);
  return hit[0];
}

/** High profile(0x64) · 제약 플래그 0 · 레벨 */
export const avcCodecString = (width: number, height: number, fps: number) =>
  `avc1.6400${avcLevel(width, height, fps).toString(16).padStart(2, '0')}`;
