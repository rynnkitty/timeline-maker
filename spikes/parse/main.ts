/**
 * Phase 2 측정 하네스 (제품 코드 아님).
 * - product(): 제품 워커(src/workers/parse-client.ts)로 파싱 → **요약 통계만** 반환
 * - staged*(): 측정 전용 워커를 단계별로 실행 (러너가 단계 사이에 워커 힙을 CDP 로 읽음)
 * 반환값에 좌표·bbox 를 넣지 않는다 (H-1/H-2).
 */
import { filterByLocalDate, cumulativeKm } from '../../src/data/index.ts';
import { parseInWorker } from '../../src/workers/parse-client.ts';

const input = document.querySelector<HTMLInputElement>('#file')!;
const file = () => {
  const f = input.files?.[0];
  if (!f) throw new Error('no file');
  return f;
};

async function product() {
  const f = file();
  const t0 = performance.now();
  const o = await parseInWorker(f);
  const wallMs = Math.round(performance.now() - t0);
  if (!o.ok) return { ok: false, code: o.code, wallMs, bytes: f.size };
  const r = o.result;
  const months = Object.keys(r.stats.localMonths).sort();
  const since2026 = filterByLocalDate(r.points, '2026-01-01');
  return {
    ok: true,
    bytes: f.size,
    format: r.format,
    points: r.points.length,
    rawPoints: r.stats.rawPoints,
    invalidDropped: r.stats.invalidDropped,
    duplicatesDropped: r.stats.duplicatesDropped,
    outliersDropped: r.stats.outliersDropped,
    firstMonth: months[0],
    lastMonth: months.at(-1),
    monthCount: months.length,
    localMonths: r.stats.localMonths,
    totalKm: Math.round(r.totalKm * 1000) / 1000,
    kmSince2026: since2026.length ? Math.round((cumulativeKm(since2026).at(-1) ?? 0) * 1000) / 1000 : 0,
    readMs: Math.round(o.timings.readMs),
    parseMs: Math.round(o.timings.parseMs),
    wallMs,
  };
}

let w: Worker | undefined;
function stagedInit() {
  w = new Worker(new URL('./measure.worker.ts', import.meta.url), { type: 'module' });
  return step('init');
}
function step(op: string): Promise<unknown> {
  return new Promise((resolve) => {
    w!.onmessage = (e) => resolve(e.data);
    w!.postMessage(op === 'init' ? { op, file: file() } : { op });
  });
}
function stagedEnd() {
  w?.terminate();
  w = undefined;
  return true;
}

(window as unknown as { spike: unknown }).spike = { product, stagedInit, step, stagedEnd, ready: true };
document.querySelector('#log')!.textContent = 'ready';
