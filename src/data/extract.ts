/**
 * 형식별 timelinePath 추출 (D-16: 트랙 소스 = timelinePath 포인트만. visit·activity 좌표는 쓰지 않는다).
 * 결과는 파일 순서 그대로 — 정렬·중복·이상치 처리는 clean.ts.
 */
import { parseAndroidLatLng, parseGeoUri } from './coords.ts';
import { parseIsoWithOffset } from './iso.ts';
import type { TrackPoint } from './types.ts';

export type Extracted = { points: TrackPoint[]; rawPoints: number; invalidDropped: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Android: semanticSegments[].timelinePath[] { point: "<lat>°, <lng>°", time: ISO } */
export function extractAndroid(segments: unknown[]): Extracted {
  const points: TrackPoint[] = [];
  let rawPoints = 0;
  let invalidDropped = 0;
  for (const seg of segments) {
    if (!isObj(seg) || !Array.isArray(seg.timelinePath)) continue;
    for (const e of seg.timelinePath) {
      rawPoints++;
      const c = isObj(e) && typeof e.point === 'string' ? parseAndroidLatLng(e.point) : null;
      const tt = isObj(e) && typeof e.time === 'string' ? parseIsoWithOffset(e.time) : null;
      if (!c || !tt) {
        invalidDropped++;
        continue;
      }
      points.push({ t: tt.t, tz: tt.tz, lat: c.lat, lng: c.lng });
    }
  }
  return { points, rawPoints, invalidDropped };
}

// iOS 는 숫자가 문자열("0", "12") — 빈 문자열은 Number('')===0 함정이라 형식으로 먼저 거른다
const NUM = /^-?\d+(?:\.\d+)?$/;
function minutes(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && NUM.test(v)) return Number(v);
  return null;
}

/** iOS (문서 기반 · 실파일 미검증, O-07): [].timelinePath[] { point: "geo:…", durationMinutesOffsetFromStartTime: "분" } */
export function extractIos(elements: unknown[]): Extracted {
  const points: TrackPoint[] = [];
  let rawPoints = 0;
  let invalidDropped = 0;
  for (const el of elements) {
    if (!isObj(el) || !Array.isArray(el.timelinePath)) continue;
    const base = typeof el.startTime === 'string' ? parseIsoWithOffset(el.startTime) : null;
    for (const e of el.timelinePath) {
      rawPoints++;
      const c = isObj(e) && typeof e.point === 'string' ? parseGeoUri(e.point) : null;
      const m = isObj(e) ? minutes(e.durationMinutesOffsetFromStartTime) : null;
      if (!base || !c || m === null) {
        invalidDropped++;
        continue;
      }
      points.push({ t: base.t + Math.round(m * 60_000), tz: base.tz, lat: c.lat, lng: c.lng });
    }
  }
  return { points, rawPoints, invalidDropped };
}
