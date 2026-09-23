/**
 * V8 의 문자열 최대 길이 (64-bit: 2^29 − 24 자). 이를 넘는 파일은 한 번에 문자열로 읽을 수 없다.
 * Chrome 153 실측: 600MB 파일의 `File.text()` 는 예외 없이 "" 를 돌려준다 (docs/browser-support.md §4).
 */
export const MAX_TEXT_CHARS = 2 ** 29 - 24;

/**
 * 디코딩 결과가 비었는데 파일이 문자열 한계보다 크다 = 한계 초과.
 * UTF-8 바이트 수 ≥ UTF-16 코드 유닛 수이므로 한계 이하 크기의 파일은 한계를 넘을 수 없다
 * (BOM 만 있는 작은 파일도 "" 로 디코딩되지만 이는 파서가 EMPTY_FILE 로 처리).
 */
export function checkDecodedText(fileBytes: number, text: string): 'FILE_TOO_LARGE' | null {
  return fileBytes > MAX_TEXT_CHARS && text.length === 0 ? 'FILE_TOO_LARGE' : null;
}
