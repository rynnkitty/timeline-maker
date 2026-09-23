import type { LatLng } from './types.ts';

// 실측(docs/reference-spec.md §6.3): 소수 자릿수 가변 3~7. 정수 표기("0°")는 미관측이지만 허용한다.
const ANDROID = /^(-?\d+(?:\.\d+)?)°,\s*(-?\d+(?:\.\d+)?)°$/;
const GEO = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function inRange(lat: number, lng: number): LatLng | null {
  // 0 은 유효값 — truthiness 가 아니라 범위로만 판정한다
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return { lat, lng };
}

/** Android: "<lat>°, <lng>°" (예: "37.566°, 126.978°") */
export function parseAndroidLatLng(s: string): LatLng | null {
  const m = ANDROID.exec(s);
  return m ? inRange(Number(m[1]), Number(m[2])) : null;
}

/** iOS: "geo:<lat>,<lng>" (예: "geo:37.566,126.978") */
export function parseGeoUri(s: string): LatLng | null {
  const m = GEO.exec(s);
  return m ? inRange(Number(m[1]), Number(m[2])) : null;
}
