export type DetectedFormat = 'android' | 'ios' | 'empty-array' | 'legacy' | 'unknown';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 루트 구조로 형식 판별 (에이전트 §2.5).
 * - Android: 객체 + semanticSegments 배열
 * - iOS: 배열 + 원소에 startTime/endTime
 * - 빈 배열: 판별 근거 없음 → 호출자가 NO_DATA 로 처리 (D-18)
 * - 구 Takeout: Records.json(locations) · Semantic Location History(timelineObjects) → 범위 외 (D-03)
 */
export function detectFormat(root: unknown): DetectedFormat {
  if (Array.isArray(root)) {
    if (root.length === 0) return 'empty-array';
    return root.some((e) => isObj(e) && 'startTime' in e && 'endTime' in e) ? 'ios' : 'unknown';
  }
  if (!isObj(root)) return 'unknown';
  if (Array.isArray(root.semanticSegments)) return 'android';
  if (Array.isArray(root.timelineObjects) || Array.isArray(root.locations)) return 'legacy';
  return 'unknown';
}
