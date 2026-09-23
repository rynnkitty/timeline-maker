/**
 * O-04 측정 전용 워커 — 제품 파이프라인(src/data/parse.ts)과 같은 단계를 **한 단계씩** 실행하고
 * 단계 사이에 멈춘다. 멈춘 동안 러너가 CDP(Runtime.getHeapUsage)로 이 워커의 힙을 읽는다.
 * 결과는 개수·시간만 돌려준다 (좌표 없음 · H-1/H-2).
 */
import { cleanTrack, cumulativeKm, detectFormat, extractAndroid, extractIos } from '../../src/data/index.ts';
import type { TrackPoint } from '../../src/data/index.ts';

type State = {
  file?: Blob;
  text?: string;
  root?: unknown;
  points?: TrackPoint[];
  kept?: TrackPoint[];
};
const s: State = {};
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ op: string; file?: Blob }>) => void) | null;
  postMessage(msg: unknown): void;
};

ctx.onmessage = async (e) => {
  const t0 = performance.now();
  const info: Record<string, unknown> = {};
  try {
    switch (e.data.op) {
      case 'init':
        s.file = e.data.file;
        break;
      case 'read':
        s.text = await s.file!.text();
        info.chars = s.text.length;
        break;
      case 'parse':
        s.root = JSON.parse(s.text!);
        info.kind = detectFormat(s.root);
        break;
      case 'drop-text':
        s.text = undefined;
        break;
      case 'extract': {
        const kind = detectFormat(s.root);
        const ex =
          kind === 'android'
            ? extractAndroid((s.root as { semanticSegments: unknown[] }).semanticSegments)
            : extractIos(s.root as unknown[]);
        s.root = undefined; // 원본(rawSignals 포함) 해제
        s.points = ex.points;
        info.rawPoints = ex.rawPoints;
        break;
      }
      case 'clean': {
        const c = cleanTrack(s.points!);
        s.points = undefined;
        s.kept = c.points;
        info.kept = c.points.length;
        info.km = Math.round(cumulativeKm(c.points).at(-1) ?? 0);
        break;
      }
      default:
        throw new Error('unknown op');
    }
    ctx.postMessage({ op: e.data.op, ok: true, ms: Math.round(performance.now() - t0), ...info });
  } catch (err) {
    ctx.postMessage({
      op: e.data.op,
      ok: false,
      ms: Math.round(performance.now() - t0),
      error: `${(err as Error).name}: ${(err as Error).message}`,
    });
  }
};
