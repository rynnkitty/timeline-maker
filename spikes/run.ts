/**
 * 스파이크 러너 — 로컬 Chrome/Edge 를 puppeteer-core 로 띄워 스파이크 페이지를 실행하고 산출물을 저장한다.
 *   node spikes/run.ts encode chrome|edge [--headless]
 *   node spikes/run.ts map    chrome|edge [--headless]
 * 전제: `npm run dev` (http://localhost:5173/timeline-maker/) 실행 중.
 * 산출물: spikes/<name>/out/ (gitignore). 외부로 나가는 요청은 스파이크 페이지가 여는 타일 요청뿐(H-1).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const BROWSERS: Record<string, string> = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const [name, browserName = 'chrome'] = process.argv.slice(2);
const headless = process.argv.includes('--headless');
// --fn=<window.spike 의 함수 이름> (기본 run)
const fn = (process.argv.find((a) => a.startsWith('--fn=')) ?? '--fn=run').slice(5);
// --base=<URL> (기본 dev 서버). 빌드 검증 시 http://localhost:4173/timeline-maker/
const baseUrl = (process.argv.find((a) => a.startsWith('--base=')) ?? '--base=http://localhost:5173/timeline-maker/').slice(7);
// --file=<로컬 경로>: 페이지의 <input type=file> 에 넣는다 (업로드 아님 · H-1)
const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice(7);
// --args=<JSON>: 페이지 함수 인자
const fnArgs = process.argv.find((a) => a.startsWith('--args='))?.slice(7) ?? '';
// --out=<dir>: 산출물 디렉터리 (기본 spikes/<name>/out)
const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
if (!['encode', 'map', 'render'].includes(name) || !BROWSERS[browserName]) {
  console.error('usage: node spikes/run.ts encode|map chrome|edge [--headless]');
  process.exit(2);
}
const outDir = outArg ?? join(dirname(fileURLToPath(import.meta.url)), name, 'out');
mkdirSync(outDir, { recursive: true });
const tag = `${browserName}${headless ? '-headless' : ''}${fn === 'run' ? '' : '-' + fn}`;

const browser = await puppeteer.launch({
  executablePath: BROWSERS[browserName],
  headless,
  protocolTimeout: 600_000,
  args: ['--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1200, height: 900 },
});
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[page ${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[pageerror] ${e}`));
  // H-1 점검: 페이지가 연 요청의 호스트별 개수
  const hosts: Record<string, number> = {};
  page.on('response', (r) => {
    if (r.status() >= 400) console.log(`[http ${r.status()}] ${r.url().slice(0, 160)}`);
  });
  page.on('request', (r) => {
    const h = new URL(r.url()).host || new URL(r.url()).protocol;
    hosts[h] = (hosts[h] ?? 0) + 1;
  });
  await page.goto(`${baseUrl}spikes/${name}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.spike && window.spike.ready', { timeout: 60_000 });
  if (fileArg) {
    const input = await page.$('input[type=file]');
    await input!.uploadFile(fileArg);
  }
  const version = await browser.version();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await page.evaluate(`window.spike.${fn}(${fnArgs})`);
  const files: string[] = [];
  for (const r of res.results ?? []) {
    if (r.base64) {
      const ext = r.ext ?? 'mp4';
      const f = join(outDir, `${tag}-${r.label ?? `${r.width}x${r.height}`}.${ext}`);
      writeFileSync(f, Buffer.from(r.base64, 'base64'));
      files.push(f);
      delete r.base64;
    }
  }
  const summary = { browser: browserName, headless, version, requestHosts: hosts, ...res };
  writeFileSync(join(outDir, `${tag}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('files:\n' + files.join('\n'));
} finally {
  await browser.close();
}
