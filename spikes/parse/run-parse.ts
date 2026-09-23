/**
 * O-04 실측 러너 — 로컬 Chrome/Edge 로 측정 페이지를 열고 <input type=file> 에 로컬 파일을 넣는다(업로드 아님 · H-1).
 *   node spikes/parse/run-parse.ts <file> [chrome|edge] [--label=name] [--headless] [--base=http://localhost:5173/timeline-maker/]
 * 전제: dev 서버 실행 중 (`npm run dev`, 다른 포트면 --base).
 * 출력: 요약 통계만 (점 수·월 범위·km·ms·힙). 좌표를 출력하지 않는다 (H-1/H-2).
 *   실파일 결과 JSON 은 spikes/parse/out/ (gitignore) 에만 둔다.
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type CDPSession, type Page } from 'puppeteer-core';

const BROWSERS: Record<string, string> = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [filePath, browserName = 'chrome'] = args;
const label = (process.argv.find((a) => a.startsWith('--label=')) ?? '--label=run').slice(8);
const headless = process.argv.includes('--headless');
const baseUrl = (process.argv.find((a) => a.startsWith('--base=')) ?? '--base=http://localhost:5173/timeline-maker/').slice(7);
if (!filePath || !BROWSERS[browserName]) {
  console.error('usage: node spikes/parse/run-parse.ts <file> [chrome|edge] [--label=name] [--headless]');
  process.exit(2);
}
const abs = resolve(filePath);
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(outDir, { recursive: true });
const MB = (b: number) => Math.round((b / 1024 / 1024) * 10) / 10;

async function workerHeap(page: Page): Promise<CDPSession> {
  for (let i = 0; i < 200; i++) {
    const ws = page.workers();
    if (ws.length) return ws[ws.length - 1].client;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('worker not found');
}
async function heap(client: CDPSession, gc: boolean) {
  if (gc) await client.send('HeapProfiler.collectGarbage');
  const h = await client.send('Runtime.getHeapUsage');
  return { usedMB: MB(h.usedSize), totalMB: MB(h.totalSize), backingMB: MB(h.backingStorageSize ?? 0) };
}
async function mainHeap(page: Page) {
  return MB((await page.metrics()).JSHeapUsedSize ?? 0);
}

const browser = await puppeteer.launch({
  executablePath: BROWSERS[browserName],
  headless,
  protocolTimeout: 900_000,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const hosts: Record<string, number> = {};
try {
  const page = await browser.newPage();
  page.on('request', (r) => {
    const h = new URL(r.url()).host;
    hosts[h] = (hosts[h] ?? 0) + 1;
  });
  page.on('pageerror', (e) => console.log(`[pageerror] ${(e as Error).name}`));
  await page.goto(`${baseUrl}spikes/parse/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.spike && window.spike.ready', { timeout: 60_000 });
  const input = await page.$('input[type=file]');
  await input!.uploadFile(abs);

  // 1) 제품 경로 (parseInWorker) — 메인 스레드 힙 전후
  const mainBefore = await mainHeap(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product: any = await page.evaluate('window.spike.product()');
  const mainAfter = await mainHeap(page);

  // 2) 단계별 — 각 단계 후 워커 힙 (GC 전 used / GC 후 retained)
  const stages: Record<string, unknown>[] = [];
  await page.evaluate('window.spike.stagedInit()');
  const client = await workerHeap(page);
  stages.push({ op: 'init', ...(await heap(client, true)) });
  for (const op of ['read', 'parse', 'drop-text', 'extract', 'clean']) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await page.evaluate(`window.spike.step(${JSON.stringify(op)})`);
    const before = await heap(client, false);
    const after = await heap(client, true);
    stages.push({
      ...r,
      heapUsedMB: before.usedMB,
      heapRetainedMB: after.usedMB,
      heapTotalMB: after.totalMB,
      backingMB: after.backingMB,
    });
    if (!r.ok) break;
  }
  await page.evaluate('window.spike.stagedEnd()');

  const summary = {
    label,
    browser: browserName,
    version: await browser.version(),
    fileMB: MB(statSync(abs).size),
    mainHeapMB: { before: mainBefore, afterProductParse: mainAfter },
    product,
    stages,
    requestHosts: hosts,
  };
  writeFileSync(join(outDir, `${label}-${browserName}.json`), JSON.stringify(summary, null, 2));
  // 콘솔에는 월별 분포 없이 요약만
  const { localMonths: _omit, ...p } = product ?? {};
  void _omit;
  console.log(JSON.stringify({ ...summary, product: p }, null, 2));
} finally {
  await browser.close();
}
