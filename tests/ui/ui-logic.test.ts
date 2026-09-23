// Phase 5 순수 로직 — 기본 기간(O-05) · 제목 연도 범위 · 테마(O-06) · 입력 검증 · 예상 시간
import { describe, expect, it } from 'vitest';
import { THEMES, titleText } from '../../src/engine/index.ts';
import { estimateExportSeconds } from '../../src/export/index.ts';
import { FILE_LIMITS, checkFileSize, defaultPeriod, sanitizeName, NAME_MAX } from '../../src/ui/logic.ts';
import {
  filterByLocalDate,
  filterPackedByLocalDate,
  packTrack,
  parseTimeline,
  unpackTrack,
  type TrackPoint,
} from '../../src/data/index.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const p = (iso: string, tz = 540): TrackPoint => ({ t: Date.parse(iso), tz, lat: 0, lng: 0 });

describe('defaultPeriod (O-05 → 최신 연도 1월 1일 ~ 마지막 기록)', () => {
  it('데이터가 연도를 넘으면 마지막 연도만', () => {
    const r = defaultPeriod([p('2025-02-03T10:00:00+09:00'), p('2026-09-20T23:30:00+09:00')]);
    expect(r).toEqual({ from: '2026-01-01', to: '2026-09-20', min: '2025-02-03', max: '2026-09-20' });
  });
  it('한 해 안이면 그 해 1월 1일부터 (min 은 실제 첫 날)', () => {
    const r = defaultPeriod([p('2026-03-01T01:00:00+09:00'), p('2026-04-02T00:30:00+09:00')]);
    expect(r.from).toBe('2026-01-01');
    expect(r.min).toBe('2026-03-01');
    expect(r.to).toBe('2026-04-02');
  });
  it('현지 날짜 기준 (UTC 로는 전날인 새벽)', () => {
    expect(defaultPeriod([p('2026-01-01T00:10:00+09:00')]).min).toBe('2026-01-01');
  });
});

describe('titleText (O-05 연도 범위)', () => {
  it('같은 해', () => expect(titleText(2026, 2026, '홍길동')).toBe('2026년 홍길동의 타임라인'));
  it('해를 넘으면 en dash 범위', () => expect(titleText(2025, 2026, '홍길동')).toBe('2025–2026년 홍길동의 타임라인'));
});

describe('THEMES (O-06)', () => {
  it('기본 = 숲(레퍼런스 녹색) + 4종, 모두 필수 색 보유', () => {
    expect(THEMES[0].id).toBe('forest');
    expect(THEMES[0].theme.recent).toEqual([30, 118, 69]);
    expect(THEMES.length).toBe(5);
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      const lum = (c: number[]) => (c[0] + c[1] + c[2]) / 3;
      // 최근 색은 진하고 old 는 옅다 (레퍼런스 램프의 관계 유지)
      expect(lum(t.theme.recent)).toBeLessThan(lum(t.theme.outro));
      expect(lum(t.theme.outro)).toBeLessThan(lum(t.theme.old));
    }
  });
});

describe('입력 검증 (security-and-hardening)', () => {
  it('이름: 제어문자 제거·공백 정리·길이 상한', () => {
    expect(sanitizeName('  홍\u0000길동  ')).toBe('홍길동');
    expect(sanitizeName('a   b')).toBe('a b');
    expect([...sanitizeName('가'.repeat(50))].length).toBe(NAME_MAX);
    expect(sanitizeName('')).toBe('');
  });
  it('파일 크기: 0 → empty, 200MB 이상 경고, 500MB 초과 거부 (D-22)', () => {
    const MB = 1024 * 1024;
    expect(checkFileSize(0)).toBe('empty');
    expect(checkFileSize(54 * MB)).toBe('ok');
    expect(checkFileSize(FILE_LIMITS.warnBytes)).toBe('warn');
    expect(checkFileSize(FILE_LIMITS.maxBytes + 1)).toBe('too-large');
  });
});

describe('estimateExportSeconds (C-19)', () => {
  it('프레임 수에 비례 (실측 ≈20~24 ms/프레임, 해상도 무관)', () => {
    expect(estimateExportSeconds(396)).toBeGreaterThanOrEqual(9);
    expect(estimateExportSeconds(396)).toBeLessThanOrEqual(12);
    expect(estimateExportSeconds(1476)).toBeGreaterThanOrEqual(29);
    expect(estimateExportSeconds(1476)).toBeLessThanOrEqual(40);
  });
});

describe('filterPackedByLocalDate', () => {
  it('filterByLocalDate 와 같은 결과 (android-sample, 2월)', () => {
    const pts = parseTimeline(readFileSync(join(import.meta.dirname, '..', 'fixtures', 'android-sample.json'), 'utf8')).points;
    expect(unpackTrack(filterPackedByLocalDate(packTrack(pts), '2026-02-01', '2026-02-28'))).toEqual(
      filterByLocalDate(pts, '2026-02-01', '2026-02-28'),
    );
    expect(filterPackedByLocalDate(packTrack(pts), '2030-01-01').t.length).toBe(0);
  });
});
