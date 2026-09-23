/**
 * 파싱 Web Worker — 파일 읽기(File.text)와 JSON 파싱을 메인 스레드 밖에서 한다.
 * 로직은 전부 src/data (vitest 로 검증). 이 파일은 메시지 배관만 — 브라우저에서만 검증된다.
 * H-1: 네트워크 요청 없음 · 좌표를 로그로 남기지 않는다.
 */
import { ParseError, parseTimeline } from '../data/index.ts';
import type { ParseOutcome, ParseRequest } from './protocol.ts';
import { checkDecodedText } from './read-guard.ts';

// tsconfig 는 DOM lib 기준이라 워커 전역을 최소 형태로 좁혀 쓴다
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ParseRequest>) => void) | null;
  postMessage(msg: ParseOutcome): void;
};

ctx.onmessage = async (e) => {
  let outcome: ParseOutcome;
  try {
    const t0 = performance.now();
    const text = await e.data.file.text();
    const t1 = performance.now();
    const tooLarge = checkDecodedText(e.data.file.size, text);
    if (tooLarge) {
      ctx.postMessage({ ok: false, code: tooLarge });
      return;
    }
    const result = parseTimeline(text);
    const t2 = performance.now();
    outcome = { ok: true, result, timings: { readMs: t1 - t0, parseMs: t2 - t1 } };
  } catch (err) {
    outcome = { ok: false, code: err instanceof ParseError ? err.code : 'WORKER_FAILED' };
  }
  ctx.postMessage(outcome);
};
