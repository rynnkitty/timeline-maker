/** UI 의 순수 로직 — DOM 비의존 (tests/ui) */
import { localDateKey, type TrackPoint } from '../data/index.ts';
import { MAX_TEXT_CHARS } from '../workers/read-guard.ts';

/** 제목에 들어가는 이름 길이 상한 (코드 포인트) */
export const NAME_MAX = 20;

/** D-22: 읽기 전 크기 검사. 한 번에 문자열로 읽을 수 있는 한계 = V8 문자열 최대 길이 */
export const FILE_LIMITS = { warnBytes: 200 * 1024 * 1024, maxBytes: MAX_TEXT_CHARS } as const;

export function checkFileSize(bytes: number): 'empty' | 'ok' | 'warn' | 'too-large' {
  if (bytes <= 0) return 'empty';
  if (bytes > FILE_LIMITS.maxBytes) return 'too-large';
  return bytes >= FILE_LIMITS.warnBytes ? 'warn' : 'ok';
}

// 제어문자는 제목·파일명에 들어가면 안 된다 — 의도적으로 매칭
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** 사용자가 입력한 이름 → 제목용 (textContent/캔버스 fillText 로만 쓰므로 HTML 이스케이프 불필요) */
export function sanitizeName(raw: string): string {
  const s = raw.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

export type Period = { from: string; to: string; min: string; max: string };

/** O-05 → D-32: 기본 기간 = 데이터의 최신 연도 1월 1일 ~ 마지막 기록 (현지 날짜). points 는 시간순 */
export function defaultPeriod(points: readonly TrackPoint[]): Period {
  const min = localDateKey(points[0]);
  const max = localDateKey(points[points.length - 1]);
  return { from: `${max.slice(0, 4)}-01-01`, to: max, min, max };
}
