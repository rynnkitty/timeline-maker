/**
 * 정규화된 트랙 포인트.
 * - `t`  : epoch ms (UTC)
 * - `tz` : 그 시각의 현지 UTC 오프셋(분). ISO 문자열 접미사에서 얻는다 — timelinePath 에는 tz 필드가 없다.
 *          현지 월/날짜 표기(에이전트 §5 "월 표기")에 쓰인다. 에이전트 §5 의 `{t, lat, lng}` 를 확장한 계약.
 */
export type TrackPoint = { t: number; tz: number; lat: number; lng: number };

export type LatLng = { lat: number; lng: number };

export type SourceFormat = 'android' | 'ios';

export type ParseStats = {
  /** timelinePath 에 있던 원소 수 (정제 전) */
  rawPoints: number;
  /** 좌표·시간 형식 오류 또는 범위 밖으로 버린 수 */
  invalidDropped: number;
  /** 같은 타임스탬프 그룹에서 버린 수 (D-17: 파일 순서상 첫 점만 유지) */
  duplicatesDropped: number;
  /** 속도 이상치로 버린 수 */
  outliersDropped: number;
  /** 현지 월(YYYY-MM)별 점 개수 */
  localMonths: Record<string, number>;
};

export type ParseResult = {
  format: SourceFormat;
  /** 시간 오름차순, 같은 t 없음 */
  points: TrackPoint[];
  /** D-14: 정제된 점의 haversine 누적 (km) */
  totalKm: number;
  stats: ParseStats;
};
