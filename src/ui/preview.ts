/**
 * 미리보기 플레이어 — 재생 · 일시정지 · 스크럽 (Phase 3; 디자인은 Phase 5).
 * 내보내기와 **같은 renderFrame** 을 쓰고 (H-6), 항상 **프레임 격자**(i = ⌊경과초 × FPS⌋)에 스냅한다.
 * 렌더가 실시간보다 느리면 중간 프레임을 건너뛴다(미리보기 전용). 지도 인스턴스 하나를 재사용하므로
 * 스크럽 시 라벨 배치가 내보내기(새 인스턴스·순차)와 미세하게 다를 수 있다 (C-8 · D-28).
 */
import { FPS, renderFrame, type MapRenderer, type Scene } from '../engine/index.ts';
import { ko } from '../i18n/ko.ts';

export type PreviewPlayer = {
  readonly element: HTMLElement;
  /** 영상 캔버스 (프레임 안에 배치) */
  readonly canvas: HTMLCanvasElement;
  /** 재생·스크럽 조작부 (프레임 아래에 배치) */
  readonly controls: HTMLElement;
  seek(i: number): Promise<void>;
  play(): void;
  pause(): void;
  /** 마지막으로 화면에 그린 프레임 */
  readonly frame: number;
  destroy(): void;
};

export function createPreviewPlayer(scene: Scene, map: MapRenderer): PreviewPlayer {
  const N = scene.timeline.frames;
  const root = document.createElement('div');
  root.className = 'preview';
  const canvas = document.createElement('canvas');
  canvas.width = scene.width;
  canvas.height = scene.height;
  canvas.className = 'preview-canvas';
  const ctx = canvas.getContext('2d')!;
  const bar = document.createElement('div');
  bar.className = 'preview-controls';
  const btn = document.createElement('button');
  btn.type = 'button';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = String(N - 1);
  range.step = '1';
  range.value = '0';
  range.setAttribute('aria-label', ko.preview.scrub);
  const time = document.createElement('span');
  time.className = 'preview-time';
  bar.append(btn, range, time);
  root.append(canvas, bar);

  let shown = -1;
  let pending: number | null = null;
  let rendering = false;
  let playing = false;
  let raf = 0;
  let startWall = 0;
  let disposed = false;
  let idleResolvers: (() => void)[] = [];

  const label = (i: number) => `${(i / FPS).toFixed(1)}s / ${(N / FPS).toFixed(1)}s`;
  const syncUi = () => {
    btn.textContent = playing ? ko.preview.pause : ko.preview.play;
    range.value = String(Math.max(0, shown));
    time.textContent = label(Math.max(0, shown));
  };

  async function pump() {
    if (rendering) return;
    rendering = true;
    while (pending !== null && !disposed) {
      const i = pending;
      pending = null;
      try {
        await renderFrame(ctx, scene, map, i);
        shown = i;
      } catch {
        // 지도 타임아웃 등 — 미리보기는 다음 요청으로 계속
      }
      syncUi();
    }
    rendering = false;
    const rs = idleResolvers;
    idleResolvers = [];
    for (const r of rs) r();
  }

  function request(i: number): Promise<void> {
    pending = Math.max(0, Math.min(N - 1, Math.round(i)));
    const p = new Promise<void>((r) => idleResolvers.push(r));
    void pump();
    return p;
  }

  function tick() {
    if (!playing) return;
    const target = Math.floor(((performance.now() - startWall) / 1000) * FPS);
    if (target >= N - 1) {
      void request(N - 1);
      pause();
      return;
    }
    if (target !== shown && !rendering) void request(target);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    if (shown >= N - 1) shown = 0;
    playing = true;
    startWall = performance.now() - (Math.max(0, shown) / FPS) * 1000;
    syncUi();
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    syncUi();
  }

  btn.addEventListener('click', () => (playing ? pause() : play()));
  range.addEventListener('input', () => {
    pause();
    void request(Number(range.value));
  });

  syncUi();
  void request(0);

  return {
    element: root,
    canvas,
    controls: bar,
    seek: (i) => {
      pause();
      return request(i);
    },
    play,
    pause,
    get frame() {
      return shown;
    },
    destroy() {
      disposed = true;
      pause();
      root.remove();
      canvas.remove();
      bar.remove();
    },
  };
}
