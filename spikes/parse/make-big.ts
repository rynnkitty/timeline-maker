/**
 * O-04 스케일 시험용 합성 대용량 Android 파일 — tests/fixtures/android-sample.json(가짜 좌표)을
 * 시간을 밀어 가며 반복해 목표 크기까지 키운다. 실데이터 파생 없음.
 *   node spikes/parse/make-big.ts <targetMB> [out]
 * 산출: spikes/parse/out/ (gitignore). 스트리밍 쓰기 — 이 스크립트 자체는 큰 문자열을 만들지 않는다.
 */
import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const targetMB = Number(process.argv[2] ?? '150');
const out = process.argv[3] ?? join(here, 'out', `big-${targetMB}mb.json`);
const src = JSON.parse(readFileSync(join(here, '..', '..', 'tests', 'fixtures', 'android-sample.json'), 'utf8')) as {
  semanticSegments: unknown[];
};

const ISO = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})([+-]\d{2}:\d{2})/g;
const SHIFT_MS = 130 * 86_400_000; // 샘플 기간(120일)보다 길게 → 복제본끼리 시간이 겹치지 않음
const segJson = src.semanticSegments.map((s) => JSON.stringify(s));

function shifted(json: string, k: number): string {
  if (k === 0) return json;
  return json.replace(ISO, (_m, Y, Mo, D, h, mi, s, ms, off) => {
    const t = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s, +ms) + k * SHIFT_MS;
    return new Date(t).toISOString().slice(0, 23) + off; // 현지 벽시계를 그대로 민다 (오프셋 유지)
  });
}

const fd = openSync(out, 'w');
let bytes = 0;
const w = (s: string) => {
  bytes += writeSync(fd, s);
};
w('{"semanticSegments":[');
let k = 0;
let first = true;
while (bytes < targetMB * 1024 * 1024) {
  for (const s of segJson) {
    w((first ? '' : ',') + shifted(s, k));
    first = false;
  }
  k++;
}
w('],"rawSignals":[],"userLocationProfile":{}}');
closeSync(fd);
console.log(`${out} ${(bytes / 1024 / 1024).toFixed(1)} MB, copies=${k}`);
