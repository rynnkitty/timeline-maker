/**
 * 미리보기 플레이어 브라우저 검증 — 합성 픽스처(가짜 좌표)만 사용.
 *   node spikes/render/check-preview.ts [base]
 * 출력: 재생/스크럽 후 프레임 번호, 스크린샷 spikes/render/out/preview-*.png (gitignore)
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5175/timeline-maker/';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  protocolTimeout: 300_000,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1100 });
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('pageerror', (e) => console.log('[pageerror]', (e as Error).message));
  await page.goto(base, { waitUntil: 'load' });
  const input = await page.$('input[type=file]');
  await input!.uploadFile(resolve(here, '..', '..', 'tests', 'fixtures', 'android-sample.json'));
  await page.waitForFunction('window.__preview && window.__preview.frame === 0', { timeout: 120_000 });
  await page.screenshot({ path: join(out, 'preview-f0.png') });
  await page.click('.preview-controls button');
  await new Promise((r) => setTimeout(r, 3000));
  const afterPlay = await page.evaluate('window.__preview.frame');
  const btnText = await page.$eval('.preview-controls button', (b) => b.textContent);
  await page.evaluate('window.__preview.seek(200)');
  const afterSeek = await page.evaluate('window.__preview.frame');
  const rangeVal = await page.$eval('.preview-controls input', (i) => (i as HTMLInputElement).value);
  await page.screenshot({ path: join(out, 'preview-f200.png') });
  await page.evaluate('window.__preview.seek(395)');
  await page.evaluate('window.__preview.play()');
  await new Promise((r) => setTimeout(r, 1500));
  const endFrame = await page.evaluate('window.__preview.frame');
  await page.screenshot({ path: join(out, 'preview-end.png') });
  console.log(
    JSON.stringify({
      afterPlay3s: afterPlay,
      buttonWhilePlaying: btnText,
      afterSeek200: afterSeek,
      rangeValue: rangeVal,
      playFromEnd1_5s: endFrame,
      hosts: [...hosts],
    }),
  );
} finally {
  await browser.close();
}
