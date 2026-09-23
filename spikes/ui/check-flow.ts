/**
 * Phase 5 전 흐름 검증 — **합성 픽스처(가짜 좌표)만** 사용. 프로덕션 빌드(CSP 적용)를 대상으로.
 *   npx vite build && npx vite preview --port 4176
 *   node spikes/ui/check-flow.ts http://localhost:4176/timeline-maker/
 * 산출: docs/screenshots/*.png (합성 데이터 — 커밋 가능), 콘솔에 결과 JSON
 */
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type ElementHandle, type Page } from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:4176/timeline-maker/';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const shots = join(root, 'docs', 'screenshots');
const dl = join(here, 'out', 'dl');
mkdirSync(shots, { recursive: true });
rmSync(dl, { recursive: true, force: true });
mkdirSync(dl, { recursive: true });
const fx = (n: string) => join(root, 'tests', 'fixtures', n);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  protocolTimeout: 900_000,
});
const hosts: Record<string, number> = {};
const csp: string[] = [];
const pageErrors: string[] = [];
const result: Record<string, unknown> = {};

async function open(opts: { width: number; height: number; mobile?: boolean; noWebCodecs?: boolean }): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({
    width: opts.width,
    height: opts.height,
    deviceScaleFactor: opts.mobile ? 2 : 1,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  page.on('request', (r) => {
    const u = new URL(r.url());
    const h = u.protocol === 'blob:' || u.protocol === 'data:' ? u.protocol : u.host;
    hosts[h] = (hosts[h] ?? 0) + 1;
  });
  page.on('pageerror', (e) => pageErrors.push(String((e as Error).message)));
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 200));
  });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to (CSP) ${e.violatedDirective} ${e.blockedURI}`));
  });
  if (opts.noWebCodecs) await page.evaluateOnNewDocument('delete window.VideoEncoder; delete window.VideoFrame;');
  await page.goto(base, { waitUntil: 'networkidle0' });
  return page;
}
const upload = async (page: Page, path: string) => ((await page.$('#file-input')) as ElementHandle<HTMLInputElement>).uploadFile(path);
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent ?? '');
const waitPreview = (page: Page) =>
  page.waitForFunction("document.querySelector('.frame')?.dataset.state === 'preview' && window.__preview && window.__preview.frame >= 0", {
    timeout: 120_000,
  });
const pick = async (page: Page, name: string, value: string) => page.click(`input[name=${name}][value="${value}"] + .choice-face`);

try {
  // ── 데스크톱: 빈 화면 → 파일 → 미리보기 → 설정 → 내보내기 ──
  const d = await open({ width: 1366, height: 940 });
  await page0(d);
  async function page0(page: Page) {
    await page.screenshot({ path: join(shots, 'desktop-empty.png') });
    result.privacyText = await page.$$eval('.privacy p', (ps) => ps.map((p) => p.textContent));
    await upload(page, fx('android-sample.json'));
    await waitPreview(page);
    result.summary = await text(page, '.step .msg:not(.msg-error):not(.msg-note):not(.msg-warn)');
    result.period = await page.evaluate(() => [
      (document.querySelector('#opt-from') as HTMLInputElement).value,
      (document.querySelector('#opt-to') as HTMLInputElement).value,
    ]);
    await page.evaluate('window.__preview.seek(250)');
    await page.screenshot({ path: join(shots, 'desktop-preview.png') });
    await pick(page, 'theme', 'sea');
    await pick(page, 'length', '30');
    await new Promise((r) => setTimeout(r, 400));
    await waitPreview(page);
    result.estimate30 = await text(page, '.step:last-child .hint');
    await page.evaluate('window.__preview.seek(500)');
    await page.screenshot({ path: join(shots, 'desktop-theme-sea.png') });
    await pick(page, 'theme', 'forest');
    await pick(page, 'length', '15');
    await new Promise((r) => setTimeout(r, 400));
    await waitPreview(page);
    const t0 = Date.now();
    await page.click('.btn-primary');
    await page.waitForFunction(() => /프레임/.test(document.querySelector('.step:last-child [role=status]')?.textContent ?? ''), {
      timeout: 60_000,
    });
    await new Promise((r) => setTimeout(r, 3500));
    result.liveMapsDuringExport = await page.evaluate(() => document.querySelectorAll('.maplibregl-map').length);
    await page.screenshot({ path: join(shots, 'desktop-exporting.png') });
    await page.waitForFunction(() => /다 만들었습니다/.test(document.querySelector('.step:last-child [role=status]')?.textContent ?? ''), {
      timeout: 300_000,
    });
    result.exportDone = await text(page, '.step:last-child [role=status]');
    result.exportWallS = (Date.now() - t0) / 1000;
    await new Promise((r) => setTimeout(r, 2500));
    result.downloads = readdirSync(dl).map((f) => ({ f, bytes: statSync(join(dl, f)).size }));
    result.againLink = await page.$eval('.download', (a) => ({
      hidden: (a as HTMLAnchorElement).hidden,
      download: (a as HTMLAnchorElement).download,
    }));
    await waitPreview(page);
    result.liveMapsAfterExport = await page.evaluate(() => document.querySelectorAll('.maplibregl-map').length);
    await page.screenshot({ path: join(shots, 'desktop-done.png') });

    // 기간 내 데이터 없음
    await page.evaluate(() => {
      const f = document.querySelector('#opt-from') as HTMLInputElement;
      const t = document.querySelector('#opt-to') as HTMLInputElement;
      f.value = '2026-04-30';
      t.value = '2026-04-29';
      f.dispatchEvent(new Event('change'));
      t.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction("document.querySelector('.frame')?.dataset.state === 'nodata'", { timeout: 30_000 });
    result.err_NO_DATA_IN_PERIOD = await page.$eval('.options .msg-error', (e) => e.textContent);
    result.makeDisabledOnNoData = await page.$eval('.btn-primary', (b) => (b as HTMLButtonElement).disabled);
  }

  // 파일 오류들 (같은 페이지에서 차례로)
  const e = await open({ width: 1366, height: 940 });
  for (const [code, file] of [
    ['LEGACY_TAKEOUT', fx('edge-legacy-records.json')],
    ['NOT_JSON', fx('edge-not-json.json')],
    ['NO_DATA', fx('edge-empty-android.json')],
    ['EMPTY_FILE', fx('edge-empty.json')],
    ['FILE_TOO_LARGE', join(here, '..', 'parse', 'out', 'big-600mb.json')],
  ] as const) {
    await upload(e, file);
    await e.waitForFunction(() => (document.querySelector('.step [role=alert]')?.textContent ?? '').length > 0, { timeout: 120_000 });
    result[`err_${code}`] = await text(e, '.step [role=alert]');
    await e.evaluate(() => ((document.querySelector('.step [role=alert]') as HTMLElement).textContent = ''));
  }
  // 200MB 이상 경고 → 그만두기
  await upload(e, join(here, '..', 'parse', 'out', 'big-400mb.json'));
  await e.waitForFunction(() => !(document.querySelector('.confirm') as HTMLElement).hidden, { timeout: 30_000 });
  result.bigWarn = await text(e, '.confirm .msg-warn');
  await e.click('.confirm .btn-quiet');
  result.bigWarnDismissed = await e.$eval('.confirm', (c) => (c as HTMLElement).hidden);
  await e.screenshot({ path: join(shots, 'desktop-error.png') });

  // 미지원 브라우저 (VideoEncoder 없음)
  const n = await open({ width: 1366, height: 940, noWebCodecs: true });
  await upload(n, fx('android-sample.json'));
  await waitPreview(n);
  await n.click('.btn-primary');
  await n.waitForFunction(() => (document.querySelector('.step:last-child [role=alert]')?.textContent ?? '').length > 0, {
    timeout: 60_000,
  });
  result.err_NO_WEBCODECS = await text(n, '.step:last-child [role=alert]');

  // iOS 베타 표기
  await upload(n, fx('ios-sample.json'));
  await waitPreview(n);
  result.iosNoteVisible = await n.$eval('.msg-note', (m) => !(m as HTMLElement).hidden);

  // ── 모바일 폭 ──
  const m = await open({ width: 390, height: 844, mobile: true });
  await m.screenshot({ path: join(shots, 'mobile-empty.png') });
  await upload(m, fx('android-sample.json'));
  await waitPreview(m);
  await m.evaluate('window.__preview.seek(250)');
  await m.screenshot({ path: join(shots, 'mobile-preview.png'), fullPage: true });
  result.mobileOverflowX = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  result.hosts = hosts;
  result.cspViolations = csp;
  result.pageErrors = pageErrors;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
