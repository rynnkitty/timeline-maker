/**
 * Phase 4 하네스 (제품 코드 아님) — 제품 파이프라인 그대로: 워커 파싱 → buildScene → exportMp4.
 * ⚠ 실파일로 만든 MP4 는 실궤적 → 러너 --out 을 docs/reference/ (gitignore) 로만.
 * 반환: 수치(시간·크기·프레임) + MP4 base64. 좌표 없음.
 */
import { filterByLocalDate, packTrack, unpackTrack } from '../../src/data/index.ts';
import { DEFAULT_CAMERA, buildScene, makeTrack, type CameraParams } from '../../src/engine/index.ts';
import { checkExportSupport, exportFileName, exportMp4 } from '../../src/export/index.ts';
import { parseInWorker } from '../../src/workers/parse-client.ts';

type RunOpts = {
  animS?: number;
  width?: number;
  height?: number;
  from?: string;
  cancelAt?: number;
  label?: string;
  camera?: Partial<CameraParams>;
};

async function b64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
const liveMaps = () => document.querySelectorAll('.maplibregl-map').length;

async function exportRun(o: RunOpts = {}) {
  const f = document.querySelector<HTMLInputElement>('#file')!.files?.[0];
  if (!f) throw new Error('no file');
  const parsed = await parseInWorker(f);
  if (!parsed.ok) return { error: parsed.code };
  const pts = filterByLocalDate(unpackTrack(parsed.result.track), o.from);
  const W = o.width ?? 480;
  const H = o.height ?? 854;
  const support = await checkExportSupport(W, H);
  if (!support.ok) return { support };
  const scene = buildScene(makeTrack(packTrack(pts)), {
    animS: o.animS ?? 15,
    width: W,
    height: H,
    name: '테스트',
    camera: { ...DEFAULT_CAMERA, ...o.camera },
  });
  const ac = new AbortController();
  let events = 0;
  let lastFrame = 0;
  const mapsBefore = liveMaps();
  try {
    const out = await exportMp4({
      scene,
      signal: ac.signal,
      onProgress: (p) => {
        events++;
        lastFrame = p.frame;
        if (o.cancelAt && p.frame >= o.cancelAt) ac.abort();
      },
    });
    return {
      results: [{ label: o.label ?? `${W}x${H}-${o.animS ?? 15}s`, ext: 'mp4', base64: await b64(out.blob) }],
      ms: Math.round(out.ms),
      frames: out.frames,
      bytes: out.bytes,
      codec: out.codec,
      progressEvents: events,
      fileName: exportFileName(scene.title, W, H),
      mapsBefore,
      mapsAfter: liveMaps(),
    };
  } catch (e) {
    return {
      canceled: e instanceof DOMException && e.name === 'AbortError',
      error: `${(e as Error).name}`,
      lastFrame,
      mapsBefore,
      mapsAfter: liveMaps(),
    };
  }
}

async function supportProbe() {
  const out: Record<string, unknown> = {};
  for (const [w, h] of [
    [480, 854],
    [720, 1280],
    [1080, 1920],
  ])
    out[`${w}x${h}`] = await checkExportSupport(w, h);
  return out;
}

/** 입력 파일(MP4)을 <video> 로 끝까지 재생 — 브라우저가 실제로 디코드·표시한 프레임 수 (DoD: Chrome·Edge 재생) */
async function playCheck() {
  const f = document.querySelector<HTMLInputElement>('#file')!.files?.[0];
  if (!f) throw new Error('no file');
  const v = document.createElement('video');
  v.muted = true;
  v.src = URL.createObjectURL(f);
  document.body.append(v);
  await new Promise((r, j) => ((v.onloadedmetadata = r), (v.onerror = () => j(new Error('video error')))));
  let presented = 0;
  const count = () => {
    presented++;
    v.requestVideoFrameCallback(count);
  };
  v.requestVideoFrameCallback(count);
  v.playbackRate = 4;
  await v.play();
  await new Promise((r) => (v.onended = r));
  const q = v.getVideoPlaybackQuality();
  return {
    width: v.videoWidth,
    height: v.videoHeight,
    duration: v.duration,
    presented,
    totalVideoFrames: q.totalVideoFrames,
    dropped: q.droppedVideoFrames,
  };
}

(window as unknown as { spike: unknown }).spike = { exportRun, supportProbe, playCheck, ready: true };
document.querySelector('#log')!.textContent = 'ready';
