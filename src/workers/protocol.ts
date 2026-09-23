import type { PackedTrack, ParseStats, SourceFormat } from '../data/index.ts';
import type { LoadErrorCode } from '../i18n/ko.ts';

export type ParseRequest = { file: Blob };

export type ParseTimings = { readMs: number; parseMs: number };

/**
 * 워커 → 메인 결과. 점은 열 배열(PackedTrack)로 **transfer** 한다 — 구조화 복제 없음 (C-13).
 */
export type ParsedTrack = { format: SourceFormat; totalKm: number; stats: ParseStats; track: PackedTrack };

export type ParseOutcome = { ok: true; result: ParsedTrack; timings: ParseTimings } | { ok: false; code: LoadErrorCode };
