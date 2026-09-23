/**
 * 앱 화면 (Phase 5). 흐름: 파일 선택/끌어 놓기 → 영상 설정 → 미리보기 → MP4 만들기 → 다운로드.
 * - 결과 영상이 주인공: 빈 영상 프레임 자체가 드롭 영역이고, 같은 프레임이 미리보기·내보내기 화면이 된다
 * - H-1: 파일은 워커 안에서만 읽는다. 외부 요청은 지도 타일·스타일·글리프뿐 (폰트·이미지는 자체 호스팅)
 * - H-5: 개인정보 안내는 파일 선택 바로 옆 (ko.privacy)
 * - 사용자 문자열은 전부 i18n/ko.ts (D-09), DOM 텍스트는 textContent 로만
 */
import { filterPackedByLocalDate, type PackedTrack, type SourceFormat } from '../data/index.ts';
import { THEMES, buildScene, computeFrame, makeTrack, themeById, type Scene } from '../engine/index.ts';
import {
  ANIM_LENGTHS,
  ExportError,
  RESOLUTIONS,
  checkExportSupport,
  estimateExportSeconds,
  exportFileName,
  exportMp4,
} from '../export/index.ts';
import { ko, type LoadErrorCode } from '../i18n/ko.ts';
import { createMapLayer, type MapLayer } from '../map/map-layer.ts';
import { DEFAULT_PROVIDER, PROVIDERS } from '../map/providers.ts';
import { ensureFonts } from '../render/fonts.ts';
import { parseInWorker } from '../workers/parse-client.ts';
import { el, koDate } from './dom.ts';
import { NAME_MAX, checkFileSize, defaultPeriod, sanitizeName, type Period } from './logic.ts';
import { createPreviewPlayer, type PreviewPlayer } from './preview.ts';

const PREVIEW_W = 480;
const PREVIEW_H = 854;
const BASE = import.meta.env.BASE_URL;
/** 활성 타일 제공자 — 안내·attribution 문구가 실제 동작과 같게 (D-19 · H-3 · H-5) */
const PROVIDER = PROVIDERS[DEFAULT_PROVIDER];

type FrameState = 'empty' | 'loading' | 'preview' | 'exporting' | 'nodata';

export function mountApp(root: HTMLElement): void {
  // ─── 상태 ───
  let packed: PackedTrack | null = null;
  let format: SourceFormat | null = null;
  let period: Period | null = null;
  let previewMap: MapLayer | null = null;
  let previewMapPending: Promise<MapLayer> | null = null;
  let player: PreviewPlayer | null = null;
  let exporting = false;
  let abort: AbortController | null = null;
  let buildToken = 0;
  let lastUrl: string | null = null;

  // ─── 영상 프레임 (주인공) ───
  const sample = el('img', { className: 'frame-sample', src: `${BASE}sample-frame.png`, alt: '', width: 480, height: 854 });
  sample.setAttribute('aria-hidden', 'true');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', className: 'visually-hidden', id: 'file-input' });
  const dropButton = el('button', { type: 'button', className: 'btn btn-quiet', textContent: ko.file.dropButton });
  const drop = el('div', { className: 'frame-drop' }, el('p', { className: 'frame-drop-text', textContent: ko.file.drop }), dropButton);
  const busy = el('p', { className: 'frame-busy', role: 'status' });
  const live = el('canvas', { className: 'frame-canvas frame-live', width: PREVIEW_W, height: PREVIEW_H });
  const liveCtx = live.getContext('2d')!;
  const frame = el('div', { className: 'frame' }, sample, drop, busy, live);
  const transport = el('div', { className: 'transport' });
  const stage = el('section', { className: 'stage', ariaLabel: '영상' }, frame, transport);

  // ─── 1 파일 ───
  const chooseButton = el('button', { type: 'button', className: 'btn', textContent: ko.file.choose });
  const fileError = el('p', { className: 'msg msg-error', role: 'alert' });
  const fileSummary = el('p', { className: 'msg' });
  const iosNote = el('p', { className: 'msg msg-note', textContent: ko.file.iosBeta, hidden: true });
  const bigText = el('p', { className: 'msg msg-warn' });
  const bigContinue = el('button', { type: 'button', className: 'btn', textContent: ko.file.bigContinue });
  const bigCancel = el('button', { type: 'button', className: 'btn btn-quiet', textContent: ko.file.bigCancel });
  const bigBox = el('div', { className: 'confirm', hidden: true }, bigText, el('div', { className: 'row' }, bigContinue, bigCancel));
  const privacy = el('div', { className: 'privacy' }, ...ko.privacy(PROVIDER.label).map((t) => el('p', { textContent: t })));
  const fileSection = el(
    'section',
    { className: 'step' },
    stepTitle(1, ko.step.file),
    el('div', { className: 'row' }, chooseButton, fileInput),
    privacy,
    bigBox,
    fileSummary,
    iosNote,
    fileError,
    ...ko.file.howTo.map((t) => el('p', { className: 'hint', textContent: t })),
  );

  // ─── 2 영상 설정 ───
  const nameInput = el('input', {
    type: 'text',
    id: 'opt-name',
    maxLength: NAME_MAX,
    value: ko.options.defaultName,
    placeholder: ko.options.namePlaceholder,
    autocomplete: 'off',
    spellcheck: false,
  });
  const fromInput = el('input', { type: 'date', id: 'opt-from' });
  const toInput = el('input', { type: 'date', id: 'opt-to' });
  const periodError = el('p', { className: 'msg msg-error', role: 'alert' });
  const themeGroup = radioGroup(
    'theme',
    ko.options.theme,
    THEMES.map((t) => ({ value: t.id, label: t.label, swatch: t.theme })),
    THEMES[0].id,
  );
  const lengthGroup = radioGroup(
    'length',
    ko.options.length,
    ANIM_LENGTHS.map((s) => ({ value: String(s), label: ko.options.lengthOption(s) })),
    '15',
  );
  const resGroup = radioGroup(
    'res',
    ko.options.resolution,
    RESOLUTIONS.map((r, i) => ({ value: String(i), label: r.label, sub: `${r.width}×${r.height}` })),
    '0',
  );
  const options = el(
    'fieldset',
    { className: 'step options', disabled: true },
    el('legend', {}, stepTitle(2, ko.step.options)),
    field(ko.options.name, nameInput, ko.options.nameHint(NAME_MAX)),
    el(
      'div',
      { className: 'field' },
      el('span', { className: 'field-label', textContent: ko.options.period }),
      el(
        'div',
        { className: 'row period' },
        el(
          'label',
          { className: 'period-part' },
          el('span', { className: 'visually-hidden', textContent: ko.options.periodFrom }),
          fromInput,
        ),
        el('span', { className: 'period-sep', textContent: '~' }),
        el('label', { className: 'period-part' }, el('span', { className: 'visually-hidden', textContent: ko.options.periodTo }), toInput),
      ),
      periodError,
    ),
    themeGroup.element,
    lengthGroup.element,
    el('p', { className: 'hint', textContent: ko.options.lengthHint(1.5) }),
    resGroup.element,
  );

  // ─── 3 만들기 ───
  const estimate = el('p', { className: 'hint' });
  const makeButton = el('button', { type: 'button', className: 'btn btn-primary', textContent: ko.export.start, disabled: true });
  const cancelButton = el('button', { type: 'button', className: 'btn btn-quiet', textContent: ko.export.cancel, hidden: true });
  const progress = el('progress', { max: 1, value: 0, hidden: true });
  const makeStatus = el('p', { className: 'msg', role: 'status' });
  const makeError = el('p', { className: 'msg msg-error', role: 'alert' });
  const again = el('a', { className: 'download', textContent: ko.export.download, hidden: true });
  const makeSection = el(
    'section',
    { className: 'step' },
    stepTitle(3, ko.step.make),
    estimate,
    el('div', { className: 'row' }, makeButton, cancelButton),
    progress,
    makeStatus,
    makeError,
    again,
  );

  const panel = el(
    'div',
    { className: 'panel' },
    el('p', { className: 'intro', textContent: ko.intro }),
    fileSection,
    options,
    makeSection,
  );
  const header = el('header', { className: 'brand' }, brandMark(), el('span', { textContent: ko.appTitle }));
  const footer = el(
    'footer',
    { className: 'foot' },
    el('p', { textContent: ko.footer.attribution(PROVIDER.attribution) }),
    el('p', { textContent: ko.footer.note }),
  );
  root.replaceChildren(header, el('main', { className: 'layout' }, stage, panel), footer);
  setFrame('empty');

  // ─── 동작 ───
  function setFrame(s: FrameState, text = '') {
    frame.dataset.state = s;
    busy.textContent = text;
  }
  const currentName = () => sanitizeName(nameInput.value) || ko.options.defaultName;
  const animS = () => Number(lengthGroup.value());
  const resolution = () => RESOLUTIONS[Number(resGroup.value())];

  function filtered(): PackedTrack | null {
    if (!packed) return null;
    const f = filterPackedByLocalDate(packed, fromInput.value || undefined, toInput.value || undefined);
    return f.t.length ? f : null;
  }
  function sceneFor(track: PackedTrack, width: number, height: number): Scene {
    return buildScene(makeTrack(track), { animS: animS(), width, height, name: currentName(), theme: themeById(themeGroup.value()) });
  }
  function updateEstimate(frames: number) {
    estimate.textContent = ko.export.estimate(estimateExportSeconds(frames));
  }

  async function rebuildPreview() {
    if (!packed || exporting) return;
    const token = ++buildToken;
    periodError.textContent = '';
    const track = filtered();
    if (!track) {
      player?.destroy();
      player = null;
      transport.replaceChildren();
      periodError.textContent = ko.errors.NO_DATA_IN_PERIOD;
      makeButton.disabled = true;
      estimate.textContent = '';
      setFrame('nodata', ko.errors.NO_DATA_IN_PERIOD);
      return;
    }
    const scene = sceneFor(track, PREVIEW_W, PREVIEW_H);
    if (!previewMap) {
      setFrame(frame.dataset.state === 'preview' ? 'preview' : 'loading', ko.file.preparing);
      // 동시에 두 번 불려도 지도는 하나만 (WebGL 컨텍스트 누수 방지)
      previewMapPending ??= createMapLayer(PREVIEW_W, PREVIEW_H);
      const m = await previewMapPending;
      previewMapPending = null;
      if (exporting) {
        m.destroy(); // 기다리는 사이 내보내기가 시작됨 — C-20 유지
        return;
      }
      previewMap = m;
    }
    const subs = [0, scene.timeline.animFrames].map((i) => computeFrame(scene, i).subtitle);
    await ensureFonts([scene.title, ...subs, previewMap.attribution]);
    if (token !== buildToken || exporting) return; // 더 새 요청이 있음
    player?.destroy();
    player = createPreviewPlayer(scene, previewMap);
    frame.append(player.canvas);
    transport.replaceChildren(player.controls);
    setFrame('preview');
    makeButton.disabled = false;
    updateEstimate(scene.timeline.frames);
    (window as unknown as { __preview?: PreviewPlayer }).__preview = player; // 검증용 핸들 (데이터 없음)
  }
  let debounce = 0;
  const schedule = () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void rebuildPreview(), 200);
  };

  function showLoadError(code: LoadErrorCode) {
    fileError.textContent = ko.errors[code];
    setFrame(packed ? 'preview' : 'empty');
  }

  async function confirmBig(bytes: number): Promise<boolean> {
    bigText.textContent = ko.file.bigWarn(bytes / 1024 / 1024);
    bigBox.hidden = false;
    return new Promise((resolve) => {
      const done = (v: boolean) => {
        bigBox.hidden = true;
        bigContinue.onclick = bigCancel.onclick = null;
        resolve(v);
      };
      bigContinue.onclick = () => done(true);
      bigCancel.onclick = () => done(false);
      bigContinue.focus();
    });
  }

  async function handleFile(f: File) {
    if (exporting) return;
    fileError.textContent = '';
    // D-22: 읽기 전에 크기 검사
    const size = checkFileSize(f.size);
    if (size === 'empty') return showLoadError('EMPTY_FILE');
    if (size === 'too-large') return showLoadError('FILE_TOO_LARGE');
    if (size === 'warn' && !(await confirmBig(f.size))) return;

    setFrame('loading', ko.file.loading);
    const o = await parseInWorker(f);
    if (!o.ok) return showLoadError(o.code);
    packed = o.result.track;
    format = o.result.format;
    period = defaultPeriod(unpackEnds(packed));
    for (const i of [fromInput, toInput]) {
      i.min = period.min;
      i.max = period.max;
    }
    fromInput.value = period.from;
    toInput.value = period.to;
    fileSummary.textContent = ko.file.summary(packed.t.length, koDate(period.min), koDate(period.max));
    iosNote.hidden = format !== 'ios';
    chooseButton.textContent = ko.file.change;
    options.disabled = false;
    await rebuildPreview();
  }

  async function runExport() {
    const track = filtered();
    if (!track || exporting) return;
    const r = resolution();
    makeError.textContent = '';
    makeStatus.textContent = '';
    const support = await checkExportSupport(r.width, r.height);
    if (!support.ok) {
      makeError.textContent = ko.export.errors[support.reason];
      return;
    }
    exporting = true;
    abort = new AbortController();
    options.disabled = true;
    chooseButton.disabled = dropButton.disabled = makeButton.disabled = true;
    cancelButton.hidden = false;
    progress.hidden = false;
    progress.value = 0;
    again.hidden = true;
    // C-20: 내보내는 동안 미리보기 지도 해제 (WebGL 컨텍스트 하나만)
    player?.destroy();
    player = null;
    transport.replaceChildren();
    previewMap?.destroy();
    previewMap = null;
    liveCtx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    setFrame('exporting');

    const scene = sceneFor(track, r.width, r.height);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') makeStatus.textContent = ko.export.hidden; // C-18
    };
    document.addEventListener('visibilitychange', onVisibility);
    try {
      const out = await exportMp4({
        scene,
        signal: abort.signal,
        onFrame: (c, i) => {
          if (i % 2 === 0) liveCtx.drawImage(c, 0, 0, PREVIEW_W, PREVIEW_H); // 만드는 중인 영상을 프레임에 그대로
        },
        onProgress: (p) => {
          progress.value = p.frame / p.frames;
          if (document.visibilityState === 'visible')
            makeStatus.textContent = ko.export.progress(p.frame, p.frames, Math.ceil(p.etaMs / 1000));
        },
      });
      makeStatus.textContent = ko.export.done((out.bytes / 1024 / 1024).toFixed(1), (out.ms / 1000).toFixed(1));
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(out.blob);
      again.href = lastUrl;
      again.download = exportFileName(scene.title, r.width, r.height);
      again.hidden = false;
      again.click(); // 자동 다운로드 (브라우저 안에서만 — 외부 전송 없음)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') makeStatus.textContent = ko.export.canceled;
      else if (e instanceof ExportError) makeError.textContent = ko.export.errors[e.code];
      else makeError.textContent = ko.export.errors.ENCODE_FAILED;
    } finally {
      document.removeEventListener('visibilitychange', onVisibility);
      exporting = false;
      abort = null;
      options.disabled = false;
      chooseButton.disabled = dropButton.disabled = false;
      cancelButton.hidden = true;
      progress.hidden = true;
      await rebuildPreview();
    }
  }

  // ─── 이벤트 ───
  chooseButton.addEventListener('click', () => fileInput.click());
  dropButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) void handleFile(f);
  });
  frame.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!exporting) frame.classList.add('is-dragging');
  });
  frame.addEventListener('dragleave', () => frame.classList.remove('is-dragging'));
  frame.addEventListener('drop', (e) => {
    e.preventDefault();
    frame.classList.remove('is-dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  });
  // 프레임 밖에 떨어뜨려도 브라우저가 파일을 열어 버리지 않게
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  nameInput.addEventListener('input', schedule);
  for (const i of [fromInput, toInput]) i.addEventListener('change', schedule);
  themeGroup.onChange(schedule);
  lengthGroup.onChange(schedule);
  resGroup.onChange(() => undefined); // 해상도는 미리보기에 영향 없음 (내보내기에서만)
  makeButton.addEventListener('click', () => void runExport());
  cancelButton.addEventListener('click', () => abort?.abort());
}

/** 기본 기간 계산에 필요한 첫·마지막 점만 (전체를 객체로 풀지 않는다 — C-13) */
function unpackEnds(p: PackedTrack) {
  const at = (i: number) => ({ t: p.t[i], tz: p.tz[i], lat: p.lat[i], lng: p.lng[i] });
  return [at(0), at(p.t.length - 1)];
}

function stepTitle(no: number, text: string) {
  return el('h2', { className: 'step-title' }, el('span', { className: 'step-no', textContent: String(no) }), text);
}

function field(label: string, control: HTMLInputElement, hint?: string) {
  return el(
    'div',
    { className: 'field' },
    el('label', { className: 'field-label', htmlFor: control.id, textContent: label }),
    control,
    hint ? el('p', { className: 'hint', textContent: hint }) : null,
  );
}

type RadioItem = { value: string; label: string; sub?: string; swatch?: { recent: number[]; old: number[] } };

function radioGroup(name: string, legend: string, items: RadioItem[], initial: string) {
  const set = el('fieldset', { className: `choice choice-${name}` }, el('legend', { className: 'field-label', textContent: legend }));
  const inputs: HTMLInputElement[] = [];
  const wrap = el('div', { className: 'choice-items' });
  for (const it of items) {
    const input = el('input', { type: 'radio', name, value: it.value, checked: it.value === initial, className: 'visually-hidden' });
    inputs.push(input);
    const face = el('span', { className: 'choice-face' });
    if (it.swatch) {
      const sw = el('span', { className: 'swatch' });
      sw.setAttribute('aria-hidden', 'true');
      const c = (v: number[]) => `rgb(${v.join(',')})`;
      sw.style.setProperty('--sw-a', c(it.swatch.recent));
      sw.style.setProperty('--sw-b', c(it.swatch.old));
      face.append(sw);
    }
    face.append(el('span', { className: 'choice-label', textContent: it.label }));
    if (it.sub) face.append(el('span', { className: 'choice-sub', textContent: it.sub }));
    wrap.append(el('label', { className: 'choice-item' }, input, face));
  }
  set.append(wrap);
  return {
    element: set,
    value: () => inputs.find((i) => i.checked)?.value ?? initial,
    onChange: (fn: () => void) => inputs.forEach((i) => i.addEventListener('change', fn)),
  };
}

/** 트레일이 점으로 끝나는 작은 표식 (파비콘과 같은 모양) */
function brandMark() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M5 25c4-1 5-7 9-8s6 3 9-1 3-7 4-9');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '3.2');
  path.setAttribute('stroke-linecap', 'round');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', '27');
  dot.setAttribute('cy', '7');
  dot.setAttribute('r', '3.6');
  dot.setAttribute('fill', '#141414');
  svg.append(path, dot);
  return svg;
}
