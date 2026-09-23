// src/data 단위 테스트 — 픽스처와 무관한 경계 조건
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_KM,
  SPEED_LIMIT_KMH,
  ParseError,
  cleanTrack,
  cumulativeKm,
  detectFormat,
  filterByLocalDate,
  haversineKm,
  localDateKey,
  localMonthKey,
  parseAndroidLatLng,
  parseGeoUri,
  parseIsoWithOffset,
  parseTimeline,
  type TrackPoint,
} from '../../src/data/index.ts';

describe('coords', () => {
  it('Android "<lat>°, <lng>°" — 가변 소수·정수·음수·0', () => {
    expect(parseAndroidLatLng('37.566°, 126.978°')).toEqual({ lat: 37.566, lng: 126.978 });
    expect(parseAndroidLatLng('51.477°, 0°')).toEqual({ lat: 51.477, lng: 0 });
    expect(parseAndroidLatLng('0.0°, -78.455°')).toEqual({ lat: 0, lng: -78.455 });
  });
  it('Android 형식 오류·범위 밖은 null', () => {
    expect(parseAndroidLatLng('')).toBeNull();
    expect(parseAndroidLatLng('37.5, 126.9')).toBeNull();
    expect(parseAndroidLatLng('°, °')).toBeNull();
    expect(parseAndroidLatLng('91.0°, 10.0°')).toBeNull();
    expect(parseAndroidLatLng('10.0°, 180.5°')).toBeNull();
  });
  it('iOS geo: URI', () => {
    // 소수 6자리 실형식은 ios 픽스처 오라클이 검증 — 여기선 H-2 검사 패턴(소수 4자리+)을 피해 3자리로
    expect(parseGeoUri('geo:37.566,126.978')).toEqual({ lat: 37.566, lng: 126.978 });
    expect(parseGeoUri('geo:0.000,-78.455')).toEqual({ lat: 0, lng: -78.455 });
    expect(parseGeoUri('geo:,')).toBeNull();
    expect(parseGeoUri('37.5,126.9')).toBeNull();
    expect(parseGeoUri('geo:-90.5,0')).toBeNull();
  });
});

describe('iso', () => {
  it('오프셋 접미사를 분으로 (+09:00 · -05:00 · +00:00 · Z)', () => {
    expect(parseIsoWithOffset('2026-01-01T00:00:00.000+09:00')).toEqual({ t: Date.UTC(2025, 11, 31, 15), tz: 540 });
    expect(parseIsoWithOffset('2026-02-28T21:00:00.000-05:00')).toEqual({ t: Date.UTC(2026, 2, 1, 2), tz: -300 });
    expect(parseIsoWithOffset('2026-02-27T22:00:00.000+00:00')).toEqual({ t: Date.UTC(2026, 1, 27, 22), tz: 0 });
    expect(parseIsoWithOffset('2026-02-27T22:00:00Z')).toEqual({ t: Date.UTC(2026, 1, 27, 22), tz: 0 });
  });
  it('오프셋 없음·잘못된 값은 null', () => {
    expect(parseIsoWithOffset('2026-01-01T00:00:00')).toBeNull();
    expect(parseIsoWithOffset('not a date+09:00')).toBeNull();
    expect(parseIsoWithOffset('')).toBeNull();
  });
});

describe('period', () => {
  const p = (iso: string): TrackPoint => ({ ...parseIsoWithOffset(iso)!, lat: 0, lng: 0 });
  it('현지 월·날짜는 점 자신의 오프셋 기준 (UTC 아님)', () => {
    const a = p('2026-02-01T05:00:00.000+09:00'); // UTC 1월 31일
    expect(localMonthKey(a)).toBe('2026-02');
    expect(localDateKey(a)).toBe('2026-02-01');
    const b = p('2026-02-28T23:30:00.000-05:00'); // UTC 3월 1일
    expect(localMonthKey(b)).toBe('2026-02');
  });
  it('filterByLocalDate 는 [from, to] 양끝 포함', () => {
    const pts = ['2026-01-31T23:59:00.000+09:00', '2026-02-01T00:00:00.000+09:00', '2026-02-28T23:59:59.000+09:00', '2026-03-01T00:00:00.000+09:00'].map(p);
    expect(filterByLocalDate(pts, '2026-02-01', '2026-02-28').length).toBe(2);
    expect(filterByLocalDate(pts, undefined, '2026-01-31').length).toBe(1);
    expect(filterByLocalDate(pts, '2026-03-01', undefined).length).toBe(1);
  });
  it('android-sample 을 2026-01 로 거르면 오라클 localMonths["2026-01"] 과 같다', () => {
    const dir = join(import.meta.dirname, '..', 'fixtures');
    const exp = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')).fixtures['android-sample.json'];
    const r = parseTimeline(readFileSync(join(dir, 'android-sample.json'), 'utf8'));
    expect(filterByLocalDate(r.points, '2026-01-01', '2026-01-31').length).toBe(exp.localMonths['2026-01']);
  });
});

describe('distance', () => {
  it('haversine — 평균 반경 6371.0088 km, 적도 1° ≈ 111.195 km', () => {
    expect(EARTH_RADIUS_KM).toBe(6371.0088);
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19508, 4);
    expect(haversineKm({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0);
  });
  it('cumulativeKm 은 첫 원소 0, 단조 증가, 마지막 = 합', () => {
    const pts: TrackPoint[] = [0, 1, 2].map((i) => ({ t: i, tz: 0, lat: 0, lng: i }));
    const c = cumulativeKm(pts);
    expect(c[0]).toBe(0);
    expect(c[2]).toBeCloseTo(2 * 111.19508, 3);
  });
});

describe('cleanTrack', () => {
  const MIN = 60_000;
  const pt = (m: number, lat: number, lng: number): TrackPoint => ({ t: m * MIN, tz: 540, lat, lng });
  it('안정 정렬 후 같은 t 는 파일 순서상 첫 점만 (D-17)', () => {
    const r = cleanTrack([pt(2, 37.5, 127), pt(1, 37.5, 127), pt(2, 37.51, 127)]);
    expect(r.points.map((p) => [p.t / MIN, p.lat])).toEqual([
      [1, 37.5],
      [2, 37.5],
    ]);
    expect(r.duplicatesDropped).toBe(1);
  });
  it('스파이크는 직전 유효점 기준으로 제거, 다음 정상점은 유지', () => {
    const r = cleanTrack([pt(0, 37.5, 127), pt(1, 35.1, 129), pt(2, 37.501, 127), pt(3, 37.502, 127)]);
    expect(r.points.length).toBe(3);
    expect(r.outliersDropped).toBe(1);
  });
  it(`임계 ${SPEED_LIMIT_KMH} km/h 미만의 빠른 이동은 유지 (비행기)`, () => {
    // 11분에 ~150km ≈ 820 km/h
    const r = cleanTrack([pt(0, 37.5, 127), pt(11, 36.15, 127), pt(14, 36.149, 127)]);
    expect(r.points.length).toBe(3);
  });
  it('첫 점이 이상치여도 트랙 전체를 잃지 않는다', () => {
    const r = cleanTrack([pt(0, 35.1, 129), pt(1, 37.5, 127), pt(2, 37.501, 127), pt(3, 37.502, 127)]);
    expect(r.points.map((p) => p.t / MIN)).toEqual([1, 2, 3]);
    expect(r.outliersDropped).toBe(1);
  });
  it('빈 입력', () => {
    expect(cleanTrack([]).points).toEqual([]);
  });
});

describe('detectFormat / 에러', () => {
  it('판별', () => {
    expect(detectFormat({ semanticSegments: [] })).toBe('android');
    expect(detectFormat([{ startTime: 'x', endTime: 'y' }])).toBe('ios');
    expect(detectFormat([])).toBe('empty-array');
    expect(detectFormat({ locations: [{ latitudeE7: 1, longitudeE7: 2 }] })).toBe('legacy');
    expect(detectFormat({ timelineObjects: [] })).toBe('legacy');
    expect(detectFormat({ foo: 1 })).toBe('unknown');
    expect(detectFormat([1, 2])).toBe('unknown');
    expect(detectFormat(null)).toBe('unknown');
    expect(detectFormat('str')).toBe('unknown');
  });
  const code = (text: string) => {
    try {
      parseTimeline(text);
    } catch (e) {
      return e instanceof ParseError ? e.code : 'other';
    }
    return 'none';
  };
  it('공백뿐 → EMPTY_FILE · 깨진 JSON → NOT_JSON · 모르는 구조 → UNKNOWN_FORMAT', () => {
    expect(code('  \n ')).toBe('EMPTY_FILE');
    expect(code('{"semanticSegments": [')).toBe('NOT_JSON');
    expect(code('{"hello": 1}')).toBe('UNKNOWN_FORMAT');
    expect(code('42')).toBe('UNKNOWN_FORMAT');
  });
  it('형식은 맞지만 유효 점 0 → NO_DATA (visit/activity 만 있는 경우 포함 — D-16)', () => {
    const onlyVisit = {
      semanticSegments: [
        {
          startTime: '2026-01-01T00:00:00.000+09:00',
          endTime: '2026-01-01T01:00:00.000+09:00',
          visit: { topCandidate: { placeLocation: { latLng: '37.5°, 127.0°' } } },
        },
      ],
    };
    expect(code(JSON.stringify(onlyVisit))).toBe('NO_DATA');
  });
  it('잘못된 경로점은 버리고 세어 둔다', () => {
    const doc = {
      semanticSegments: [
        {
          startTime: '2026-01-01T00:00:00.000+09:00',
          endTime: '2026-01-01T02:00:00.000+09:00',
          timelinePath: [
            { point: '37.5°, 127.0°', time: '2026-01-01T00:10:00.000+09:00' },
            { point: 'bad', time: '2026-01-01T00:20:00.000+09:00' },
            { point: '37.5°, 127.0°', time: 'bad' },
            { time: '2026-01-01T00:40:00.000+09:00' },
            { point: '37.501°, 127.0°', time: '2026-01-01T00:50:00.000+09:00' },
          ],
        },
      ],
    };
    const r = parseTimeline(JSON.stringify(doc));
    expect(r.points.length).toBe(2);
    expect(r.stats.invalidDropped).toBe(3);
  });
  it('iOS 오프셋은 숫자 문자열 — 숫자 아닌 값은 버림', () => {
    const doc = [
      {
        startTime: '2026-01-01T00:00:00.000+09:00',
        endTime: '2026-01-01T02:00:00.000+09:00',
        timelinePath: [
          { point: 'geo:37.5,127.0', durationMinutesOffsetFromStartTime: '0' },
          { point: 'geo:37.501,127.0', durationMinutesOffsetFromStartTime: '' },
          { point: 'geo:37.502,127.0', durationMinutesOffsetFromStartTime: 'x' },
          { point: 'geo:37.503,127.0', durationMinutesOffsetFromStartTime: '5' },
        ],
      },
    ];
    const r = parseTimeline(JSON.stringify(doc));
    expect(r.points.map((p) => (p.t - r.points[0].t) / 60_000)).toEqual([0, 5]);
    expect(r.stats.invalidDropped).toBe(2);
  });
});

describe('i18n', () => {
  it('모든 파서 에러 코드에 한국어 문구가 있다 (D-09)', async () => {
    const { ko } = await import('../../src/i18n/ko.ts');
    const { PARSE_ERROR_CODES } = await import('../../src/data/index.ts');
    for (const c of PARSE_ERROR_CODES) expect(ko.errors[c].length).toBeGreaterThan(5);
  });
});
