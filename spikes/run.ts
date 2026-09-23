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
if (!['encode', 'map'].includes(name) || !BROWSERS[browserName]) {
  console.error('usage: node spikes/run.ts encode|map chrome|edge [--headless]');
  process.exit(2);
}
const outDir = join(dirname(fileURLToPath(import.meta.url)), name, 'out');
mkdirSync(outDir, { recursive: true });
const tag = `${browserName}${headless ? '-headless' : ''}`;

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
  await page.goto(`http://localhost:5173/timeline-maker/spikes/${name}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.spike && window.spike.ready', { timeout: 60_000 });
  const version = await browser.version();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await page.evaluate('window.spike.run()');
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
  const summary = { browser: browserName, headless, version, ...res };
  writeFileSync(join(outDir, `${tag}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('files:\n' + files.join('\n'));
} finally {
  await browser.close();
}
