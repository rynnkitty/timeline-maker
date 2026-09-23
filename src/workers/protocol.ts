import type { ParseResult } from '../data/index.ts';
import type { LoadErrorCode } from '../i18n/ko.ts';

export type ParseRequest = { file: Blob };

export type ParseTimings = { readMs: number; parseMs: number };

export type ParseOutcome = { ok: true; result: ParseResult; timings: ParseTimings } | { ok: false; code: LoadErrorCode };
