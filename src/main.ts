/**
 * 진입점 — Phase 4 최소 화면: 파일 선택 → 워커 파싱 → 미리보기 → MP4 내보내기. (디자인·전체 옵션 UI 는 Phase 5)
 * H-1: 파일은 브라우저 안에서만 처리. 외부 요청은 지도 타일·스타일·글리프뿐 (폰트는 자체 호스팅).
 */
import './ui/app.css';
import { buildScene, computeFrame, makeTrack, type Track } from './engine/index.ts';
import { ANIM_LENGTHS, ExportError, RESOLUTIONS, checkExportSupport, downloadBlob, exportFileName, exportMp4 } from './export/index.ts';
import { ko } from './i18n/ko.ts';
import { createMapLayer, type MapLayer } from './map/map-layer.ts';
import { ensureFonts } from './render/fonts.ts';
import { createPreviewPlayer, type PreviewPlayer } from './ui/preview.ts';
import { parseInWorker } from './workers/parse-client.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}
const labeled = (text: string, control: HTMLElement) => {
  const l = el('label', { textContent: text + ' ' });
  l.append(control);
  return l;
};

const app = document.querySelector<HTMLDivElement>('#app')!;
const file = el('input', { type: 'file', accept: '.json,application/json' });
const name = el('input', { type: 'text', maxLength: 20, value: ko.app.defaultName });
const length = el('select');
for (const s of ANIM_LENGTHS) length.append(el('option', { value: String(s), textContent: ko.export.lengthOption(s) }));
const res = el('select');
RESOLUTIONS.forEach((r, i) => res.append(el('option', { value: String(i), textContent: `${r.label} (${r.width}×${r.height})` })));
const exportBtn = el('button', { type: 'button', textContent: ko.export.start, disabled: true });
const cancelBtn = el('button', { type: 'button', textContent: ko.export.cancel, hidden: true });
const progress = el('progress', { max: 1, value: 0, hidden: true });
const status = el('p', { className: 'status' });
status.setAttribute('role', 'status');
const stage = el('div');
app.append(
  el('h1', { textContent: ko.appTitle }),
  el('p', { className: 'privacy', textContent: ko.app.privacy }),
  labeled(ko.app.pickFile, file),
  labeled(ko.app.name, name),
  labeled(ko.export.length, length),
  labeled(ko.export.resolution, res),
  el('div', { className: 'export-row' }),
  status,
  stage,
);
app.querySelector('.export-row')!.append(exportBtn, cancelBtn, progress);

let track: Track | null = null;
let player: PreviewPlayer | null = null;
let previewMap: MapLayer | null = null;
let abort: AbortController | null = null;

const sceneFor = (width: number, height: number) =>
  buildScene(track!, { animS: Number(length.value), width, height, name: name.value.trim() || ko.app.defaultName });

async function refreshPreview() {
  if (!track) return;
  player?.destroy();
  previewMap ??= await createMapLayer(480, 854);
  const scene = sceneFor(480, 854);
  const subs = [0, scene.timeline.animFrames].map((i) => computeFrame(scene, i).subtitle);
  await ensureFonts([scene.title, ...subs, previewMap.attribution]);
  player = createPreviewPlayer(scene, previewMap);
  stage.replaceChildren(player.element);
  (window as unknown as { __preview?: PreviewPlayer }).__preview = player; // 개발 검증용 핸들 (데이터 없음)
}

file.addEventListener('change', async () => {
  const f = file.files?.[0];
  if (!f) return;
  exportBtn.disabled = true;
  status.textContent = ko.app.loading;
  const o = await parseInWorker(f);
  if (!o.ok) {
    status.textContent = ko.errors[o.code];
    return;
  }
  track = makeTrack(o.result.track);
  status.textContent = ko.app.preparing;
  await refreshPreview();
  status.textContent = '';
  exportBtn.disabled = false;
});
for (const c of [name, length]) c.addEventListener('change', () => void refreshPreview());

exportBtn.addEventListener('click', async () => {
  if (!track) return;
  const r = RESOLUTIONS[Number(res.value)];
  const support = await checkExportSupport(r.width, r.height);
  if (!support.ok) {
    status.textContent = ko.export.errors[support.reason];
    return;
  }
  player?.pause();
  abort = new AbortController();
  exportBtn.disabled = true;
  cancelBtn.hidden = false;
  progress.hidden = false;
  progress.value = 0;
  const scene = sceneFor(r.width, r.height);
  try {
    const out = await exportMp4({
      scene,
      signal: abort.signal,
      onProgress: (p) => {
        progress.value = p.frame / p.frames;
        status.textContent = ko.export.progress(p.frame, p.frames, Math.ceil(p.etaMs / 1000));
      },
    });
    status.textContent = ko.export.done((out.bytes / 1024 / 1024).toFixed(1), (out.ms / 1000).toFixed(1));
    downloadBlob(out.blob, exportFileName(scene.title, r.width, r.height));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') status.textContent = ko.export.canceled;
    else if (e instanceof ExportError) status.textContent = ko.export.errors[e.code];
    else status.textContent = ko.export.errors.ENCODE_FAILED;
  } finally {
    abort = null;
    exportBtn.disabled = false;
    cancelBtn.hidden = true;
    progress.hidden = true;
  }
});
cancelBtn.addEventListener('click', () => abort?.abort());
