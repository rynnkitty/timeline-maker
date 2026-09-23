import type { TrackPoint } from './types.ts';

/** 점 자신의 오프셋 기준 현지 시각을 ISO 문자열로 (UTC 월을 쓰면 월 경계에서 튄다 — 에이전트 §7 증상 체크리스트) */
const localIso = (p: Pick<TrackPoint, 't' | 'tz'>) => new Date(p.t + p.tz * 60_000).toISOString();

/** 현지 "YYYY-MM" */
export const localMonthKey = (p: Pick<TrackPoint, 't' | 'tz'>) => localIso(p).slice(0, 7);

/** 현지 "YYYY-MM-DD" */
export const localDateKey = (p: Pick<TrackPoint, 't' | 'tz'>) => localIso(p).slice(0, 10);

/** 현지 월별 개수 */
export function countByLocalMonth(points: readonly TrackPoint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) {
    const k = localMonthKey(p);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * 기간 필터 — 현지 날짜 [from, to] 양끝 포함. 생략한 쪽은 열린 구간.
 * 날짜 문자열("YYYY-MM-DD")은 사전순 = 시간순이므로 문자열 비교로 충분하다.
 */
export function filterByLocalDate(points: readonly TrackPoint[], from?: string, to?: string): TrackPoint[] {
  return points.filter((p) => {
    const d = localDateKey(p);
    return (from === undefined || d >= from) && (to === undefined || d <= to);
  });
}
