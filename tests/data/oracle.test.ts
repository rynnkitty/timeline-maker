// 오라클 테스트 — tests/fixtures/expected.json (scripts/make-fixtures.ts 가 생성 시점의 정답으로 산출)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ParseError, parseTimeline } from '../../src/data/index.ts';

type TrackExp = {
  expect: 'track';
  format: 'android' | 'ios';
  points: number;
  firstTime: string;
  lastTime: string;
  totalKm: number;
  localMonths: Record<string, number>;
  injected: { sameTimestampDuplicates: number; speedOutliers: number };
};
type ErrorExp = { expect: 'error'; error: string };

const dir = join(import.meta.dirname, '..', 'fixtures');
const oracle = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as {
  fixtures: Record<string, TrackExp | ErrorExp>;
};
const read = (name: string) => readFileSync(join(dir, name), 'utf8');

/** 오라클은 km 을 소수 3자리로 반올림 → 작은 값은 절대 오차가 지배 */
const kmClose = (actual: number, expected: number) => Math.abs(actual - expected) <= Math.max(expected * 1e-6, 5e-4);

describe('oracle: expected.json', () => {
  for (const [name, exp] of Object.entries(oracle.fixtures)) {
    if (exp.expect === 'error') {
      it(`${name} → ${exp.error}`, () => {
        let err: unknown;
        try {
          parseTimeline(read(name));
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(ParseError);
        expect((err as ParseError).code).toBe(exp.error);
      });
      continue;
    }
    it(`${name} → ${exp.points} points`, () => {
      const r = parseTimeline(read(name));
      expect(r.format).toBe(exp.format);
      expect(r.points.length).toBe(exp.points);
      expect(new Date(r.points[0].t).toISOString()).toBe(exp.firstTime);
      expect(new Date(r.points[r.points.length - 1].t).toISOString()).toBe(exp.lastTime);
      expect(r.stats.localMonths).toEqual(exp.localMonths);
      expect(r.stats.duplicatesDropped).toBe(exp.injected.sameTimestampDuplicates);
      expect(r.stats.outliersDropped).toBe(exp.injected.speedOutliers);
      expect(kmClose(r.totalKm, exp.totalKm), `km ${r.totalKm} vs ${exp.totalKm}`).toBe(true);
      // 시간 오름차순 · 같은 t 없음
      for (let i = 1; i < r.points.length; i++) expect(r.points[i].t).toBeGreaterThan(r.points[i - 1].t);
    });
  }
});
