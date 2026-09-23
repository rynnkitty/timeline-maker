/**
 * 내보내기 중 탭이 가려지면(다른 탭 전환) 진행이 멈추는지 — 합성 픽스처만.
 *   node spikes/export/check-background.ts [base]
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5176/timeline-maker/';
const here = dirname(fileURLToPath(import.meta.url));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  protocolTimeout: 600_000,
});
try {
  const page = await browser.newPage();
  const dl = join(here, 'out', 'dl-bg');
  rmSync(dl, { recursive: true, force: true });
  mkdirSync(dl, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await page.goto(base, { waitUntil: 'load' });
  await (await page.$('input[type=file]'))!.uploadFile(resolve(here, '..', '..', 'tests', 'fixtures', 'android-sample.json'));
  await page.waitForFunction('window.__preview && window.__preview.frame === 0', { timeout: 120_000 });
  // 기준 파일(spikes/export main.ts)과 같은 이름 → 전체 프레임 비교가 가능하도록
  const name = await page.$('input[type=text]');
  await name!.click({ count: 3 });
  await name!.type('테스트');
  await page.keyboard.press('Tab');
  await page.waitForFunction('window.__preview && window.__preview.frame === 0', { timeout: 120_000 });
  const frame = () => page.$eval('.status', (e) => Number((e.textContent ?? '').match(/(\d+) \/ \d+/)?.[1] ?? -1));
  await (await page.$$('.export-row button'))[0].click();
  await new Promise((r) => setTimeout(r, 2000));
  const f0 = await frame();
  const other = await browser.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await new Promise((r) => setTimeout(r, 8000));
  const hiddenState = await page.evaluate(() => document.visibilityState);
  const hiddenMsg = await page.$eval('.status', (e) => e.textContent ?? '');
  const f1 = await frame();
  await page.bringToFront();
  await new Promise((r) => setTimeout(r, 3000));
  const f2 = await frame();
  await page.waitForFunction(() => /완료/.test(document.querySelector('.status')?.textContent ?? ''), { timeout: 300_000 });
  await new Promise((r) => setTimeout(r, 2000));
  console.log(
    JSON.stringify({ visibleAt2s: f0, afterHidden8s: f1, hiddenState, hiddenMsg, afterVisibleAgain3s: f2, downloaded: readdirSync(dl) }),
  );
} finally {
  await browser.close();
}
