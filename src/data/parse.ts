import { cleanTrack } from './clean.ts';
import { detectFormat } from './detect.ts';
import { cumulativeKm } from './distance.ts';
import { ParseError } from './errors.ts';
import { extractAndroid, extractIos, type Extracted } from './extract.ts';
import { countByLocalMonth } from './period.ts';
import type { ParseResult, SourceFormat } from './types.ts';

/**
 * Timeline.json 텍스트 → 정규화된 트랙. 실패는 ParseError(code) 로 던진다.
 * 판정 순서: 공백뿐 EMPTY_FILE → JSON 실패 NOT_JSON → 구 Takeout LEGACY_TAKEOUT → 판별 불가 UNKNOWN_FORMAT
 *           → 빈 배열(D-18) 또는 유효 점 0 NO_DATA
 * DOM·네트워크 비의존 — Web Worker 와 Node(vitest) 양쪽에서 돈다. 좌표를 로그로 남기지 않는다.
 */
export function parseTimeline(text: string): ParseResult {
  const { format, ex } = extract(text);
  const c = cleanTrack(ex.points);
  if (c.points.length === 0) throw new ParseError('NO_DATA');

  const cum = cumulativeKm(c.points);
  return {
    format,
    points: c.points,
    totalKm: cum[cum.length - 1],
    stats: {
      rawPoints: ex.rawPoints,
      invalidDropped: ex.invalidDropped,
      duplicatesDropped: c.duplicatesDropped,
      outliersDropped: c.outliersDropped,
      localMonths: countByLocalMonth(c.points),
    },
  };
}

/**
 * JSON 파싱·판별·timelinePath 추출. 파싱된 원본(rawSignals 등 트랙에 쓰지 않는 대용량 부분 포함)은
 * 이 함수 스코프에만 존재하므로 반환 즉시 GC 대상이 된다 (O-04 메모리).
 */
function extract(text: string): { format: SourceFormat; ex: Extracted } {
  if (!/\S/.test(text)) throw new ParseError('EMPTY_FILE');

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new ParseError('NOT_JSON');
  }

  const kind = detectFormat(root);
  if (kind === 'legacy') throw new ParseError('LEGACY_TAKEOUT');
  if (kind === 'unknown') throw new ParseError('UNKNOWN_FORMAT');
  if (kind === 'empty-array') throw new ParseError('NO_DATA');
  return kind === 'android'
    ? { format: kind, ex: extractAndroid((root as { semanticSegments: unknown[] }).semanticSegments) }
    : { format: kind, ex: extractIos(root as unknown[]) };
}
