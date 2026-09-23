// 픽스처 배관 스모크 — Phase 2 파서 테스트가 같은 오라클(expected.json)을 쓴다.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(import.meta.dirname, 'fixtures');
const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as {
  fixtures: Record<string, { expect: 'track' | 'error'; error?: string; points?: number }>;
};
const load = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), 'utf8'));

describe('fixtures', () => {
  it('expected.json 에 적힌 픽스처가 전부 존재한다', () => {
    const names = Object.keys(expected.fixtures);
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const n of names) expect(existsSync(join(dir, n)), n).toBe(true);
  });

  it('Android 샘플은 객체 루트 + semanticSegments', () => {
    const root = load('android-sample.json') as Record<string, unknown>;
    expect(Array.isArray(root.semanticSegments)).toBe(true);
    expect(expected.fixtures['android-sample.json'].points).toBeGreaterThan(0);
  });

  it('iOS 샘플은 배열 루트', () => {
    expect(Array.isArray(load('ios-sample.json'))).toBe(true);
  });

  it('에러 케이스는 에러 코드를 가진다', () => {
    for (const [n, e] of Object.entries(expected.fixtures)) if (e.expect === 'error') expect(e.error, n).toMatch(/^[A-Z_]+$/);
  });
});
