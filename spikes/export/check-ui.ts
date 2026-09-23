/**
 * 제품 화면(main.ts)의 내보내기 흐름 검증 — 합성 픽스처(가짜 좌표)만.
 *   node spikes/export/check-ui.ts [base]
 * 확인: 내보내기 완료 → 다운로드 파일명·크기, 취소 → 안내 문구. 다운로드는 spikes/export/out/dl (gitignore)
 */
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5176/timeline-maker/';
const here = dirname(fileURLToPath(import.meta.url));
const dl = join(here, 'out', 'dl');
rmSync(dl, { recursive: true, force: true });
mkdirSync(dl, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  protocolTimeout: 600_000,
});
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  page.on('pageerror', (e) => console.log('[pageerror]', (e as Error).message));
  await page.goto(base, { waitUntil: 'load' });
  await (await page.$('input[type=file]'))!.uploadFile(resolve(here, '..', '..', 'tests', 'fixtures', 'android-sample.json'));
  await page.waitForFunction('window.__preview && window.__preview.frame === 0', { timeout: 120_000 });
  const name = await page.$('input[type=text]');
  await name!.click({ count: 3 });
  await name!.type('홍길동/테스트');
  await page.keyboard.press('Tab');
  await page.waitForFunction('window.__preview && window.__preview.frame === 0', { timeout: 120_000 });
  const status = () => page.$eval('.status', (e) => e.textContent ?? '');
  const buttons = await page.$$('.export-row button');
  await buttons[0].click();
  await page.waitForFunction(() => /완료/.test(document.querySelector('.status')?.textContent ?? ''), { timeout: 300_000 });
  const done = await status();
  await new Promise((r) => setTimeout(r, 2000));
  const files = readdirSync(dl).map((f) => ({ f, bytes: statSync(join(dl, f)).size }));
  // 취소
  await buttons[0].click();
  await page.waitForFunction(() => /영상 만드는 중/.test(document.querySelector('.status')?.textContent ?? ''), { timeout: 60_000 });
  await buttons[1].click();
  await page.waitForFunction(() => /취소/.test(document.querySelector('.status')?.textContent ?? ''), { timeout: 60_000 });
  const canceled = await status();
  const maps = await page.evaluate(() => document.querySelectorAll('.maplibregl-map').length);
  console.log(JSON.stringify({ done, files, canceled, liveMapsAfterCancel: maps }));
} finally {
  await browser.close();
}
