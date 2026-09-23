import type { ParseOutcome, ParseRequest } from './protocol.ts';

/**
 * Timeline.json 을 전용 Web Worker 에서 파싱한다. 요청마다 워커를 새로 만들고 끝나면 종료한다
 * (파싱 중 커진 워커 힙을 통째로 반납 — O-04).
 * File 은 구조화 복제 시 내용이 아니라 핸들만 넘어가므로 메인 스레드에 큰 문자열이 생기지 않는다.
 */
export function parseInWorker(file: Blob): Promise<ParseOutcome> {
  return new Promise((resolve) => {
    // Vite: new URL() 은 new Worker() 안에 직접, 옵션은 리터럴 (https://vite.dev/guide/features.html#web-workers)
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
    const done = (o: ParseOutcome) => {
      worker.terminate();
      resolve(o);
    };
    worker.onmessage = (e: MessageEvent<ParseOutcome>) => done(e.data);
    worker.onerror = () => done({ ok: false, code: 'WORKER_FAILED' });
    worker.onmessageerror = () => done({ ok: false, code: 'WORKER_FAILED' });
    const req: ParseRequest = { file };
    worker.postMessage(req);
  });
}
