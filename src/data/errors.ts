/** 파서 에러 코드 — 사용자 문구는 src/i18n/ko.ts (D-09). 코드 목록은 tests/fixtures/expected.json 의 errorCodes 와 같다. */
export const PARSE_ERROR_CODES = ['EMPTY_FILE', 'NOT_JSON', 'LEGACY_TAKEOUT', 'UNKNOWN_FORMAT', 'NO_DATA'] as const;
export type ParseErrorCode = (typeof PARSE_ERROR_CODES)[number];

export class ParseError extends Error {
  readonly code: ParseErrorCode;
  constructor(code: ParseErrorCode) {
    super(code);
    this.name = 'ParseError';
    this.code = code;
  }
}

export const isParseErrorCode = (v: unknown): v is ParseErrorCode =>
  typeof v === 'string' && (PARSE_ERROR_CODES as readonly string[]).includes(v);
