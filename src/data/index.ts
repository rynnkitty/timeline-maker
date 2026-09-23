// src/data — 파서·정규화 (DOM 비의존). 의존 방향: ui → export → engine → data
export type { LatLng, ParseResult, ParseStats, SourceFormat, TrackPoint } from './types.ts';
export { PARSE_ERROR_CODES, ParseError, isParseErrorCode, type ParseErrorCode } from './errors.ts';
export { parseAndroidLatLng, parseGeoUri } from './coords.ts';
export { parseIsoWithOffset } from './iso.ts';
export { detectFormat, type DetectedFormat } from './detect.ts';
export { extractAndroid, extractIos } from './extract.ts';
export { SPEED_LIMIT_KMH, cleanTrack } from './clean.ts';
export { EARTH_RADIUS_KM, cumulativeKm, haversineKm } from './distance.ts';
export { countByLocalMonth, filterByLocalDate, localDateKey, localMonthKey } from './period.ts';
export { parseTimeline } from './parse.ts';
export { filterPackedByLocalDate, packTrack, packedBuffers, unpackTrack, type PackedTrack } from './packed.ts';
