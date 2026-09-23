/**
 * MP4 내보내기 (에이전트 §3 Phase 4 · D-01 · D-04 · D-20 · D-28 · H-6).
 *
 * - **새 지도 인스턴스**를 만들어 프레임 0 부터 **순차** 렌더 (지도 출력이 카메라 이력에 의존 — 같은 입력 → 같은 출력, D-28)
 * - 프레임 i 는 t = i / FPS 로만 계산 — 벽시계 무관 (H-6). performance.now 는 진행률 표시에만 쓴다
 * - renderFrame 은 타일 로딩 완료(idle)까지 기다린 뒤 합성 → 미완성 프레임을 인코딩하지 않는다 (H-6)
 * - `await source.add()` = 인코더·writer 백프레셔 (대기 프레임 무한 증가 방지)
 * - VideoFrame 은 CanvasSource 가 캔버스에서 만들고 인코딩 후 스스로 닫는다 — 여기서 들고 있는 프레임 없음
 * - 취소: AbortSignal → output.cancel() (인코더 해제) + 지도 인스턴스 제거
 * API 근거: node_modules/mediabunny/dist/mediabunny.d.ts (v1.59.0)
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import { FPS, computeFrame, renderFrame, type MapRenderer, type Scene } from '../engine/index.ts';
import { createMapLayer } from '../map/map-layer.ts';
import { ensureFonts } from '../render/fonts.ts';
import { avcCodecString } from './codec.ts';

export type ExportErrorCode = 'MAP_TIMEOUT' | 'ENCODE_FAILED';

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  constructor(code: ExportErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'ExportError';
    this.code = code;
  }
}

export type ExportProgress = { frame: number; frames: number; elapsedMs: number; etaMs: number };

export type ExportOptions = {
  scene: Scene;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
  /** 테스트·다른 제공자용 주입 (기본: createMapLayer — 매번 새 인스턴스) */
  createMap?: (width: number, height: number) => Promise<MapRenderer>;
};

export type ExportResult = { blob: Blob; frames: number; ms: number; codec: string; bytes: number };

const abortError = () => new DOMException('export canceled', 'AbortError');

export async function exportMp4(o: ExportOptions): Promise<ExportResult> {
  const { scene, signal } = o;
  const W = scene.width;
  const H = scene.height;
  const N = scene.timeline.frames;
  const codec = avcCodecString(W, H, FPS);
  if (signal?.aborted) throw abortError();

  const t0 = performance.now();
  const map = await (o.createMap ?? createMapLayer)(W, H);
  let output: Output | null = null;
  try {
    const subtitles = [0, scene.timeline.animFrames].map((i) => computeFrame(scene, i).subtitle);
    await ensureFonts([scene.title, ...subtitles, map.attribution]);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality('high'), fullCodecString: codec });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();

    for (let i = 0; i < N; i++) {
      if (signal?.aborted) throw abortError();
      try {
        await renderFrame(ctx, scene, map, i);
      } catch (e) {
        throw new ExportError('MAP_TIMEOUT', e);
      }
      try {
        await source.add(i / FPS, 1 / FPS); // 백프레셔
      } catch (e) {
        throw new ExportError('ENCODE_FAILED', e);
      }
      if (o.onProgress) {
        const elapsedMs = performance.now() - t0;
        o.onProgress({ frame: i + 1, frames: N, elapsedMs, etaMs: (elapsedMs / (i + 1)) * (N - i - 1) });
      }
    }
    source.close();
    try {
      await output.finalize();
    } catch (e) {
      throw new ExportError('ENCODE_FAILED', e);
    }
    const buf = (output.target as BufferTarget).buffer!;
    return { blob: new Blob([buf], { type: 'video/mp4' }), frames: N, ms: performance.now() - t0, codec, bytes: buf.byteLength };
  } catch (e) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw e;
  } finally {
    map.destroy();
  }
}
