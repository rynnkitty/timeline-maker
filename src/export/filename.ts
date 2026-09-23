/**
 * 다운로드 파일명 — 사용자가 입력한 제목 기반 (좌표·실명 자동 삽입 없음).
 * Windows·macOS·Linux 에서 못 쓰는 문자와 예약어를 피한다.
 */
// 제어문자(U+0000–U+001F, U+007F)는 파일명에 쓸 수 없어 의도적으로 매칭한다
// eslint-disable-next-line no-control-regex
const INVALID = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_CHARS = 80;

function clean(s: string): string {
  return s
    .replace(INVALID, '_')
    .replace(/_+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[\s._]+|[\s._]+$/g, '');
}

export function exportFileName(title: string, width: number, height: number): string {
  let base = clean(title);
  // 코드 포인트 단위로 자른다 (UTF-16 서로게이트가 반으로 잘려 깨지지 않게)
  base = clean([...base].slice(0, MAX_CHARS).join(''));
  if (!base) base = 'timeline';
  if (RESERVED.test(base)) base += '_video';
  return `${base}_${width}x${height}.mp4`;
}
