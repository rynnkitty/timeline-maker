import { defineConfig, type Plugin } from 'vitest/config';
import { PROVIDERS } from './src/map/providers.ts';

/**
 * H-1: CSP 메타 태그 — 외부 요청은 지도 제공자(CARTO · OpenFreeMap)뿐.
 * 개발 서버에는 넣지 않는다 (Vite HMR 이 인라인 스크립트·WebSocket 을 쓴다). 프로덕션 빌드에서 검증 — docs/browser-support.md §6.
 * - worker-src 'self': 파싱 워커 · MapLibre 워커는 같은 출처 파일
 * - img-src blob: data:: MapLibre 스프라이트·타일 이미지 처리, 다운로드 링크 미리보기 없음
 * - style-src 'unsafe-inline': 요소 style 속성(지도 컨테이너 배치). 사용자 입력은 textContent 로만 넣는다
 */
function cspPlugin(): Plugin {
  const tileHosts = [...new Set(Object.values(PROVIDERS).flatMap((p) => p.hosts))].join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "worker-src 'self' blob:",
    `connect-src 'self' ${tileHosts}`,
    `img-src 'self' data: blob: ${tileHosts}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'timeline-maker-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  };
}

// D-08: GitHub Pages 프로젝트 사이트 → https://rynnkitty.github.io/timeline-maker/
// https://vite.dev/guide/static-deploy#github-pages
export default defineConfig({
  base: '/timeline-maker/',
  plugins: [cspPlugin()],
  build: {
    target: 'es2023',
  },
  // MapLibre 워커는 module worker(new Worker(url, {type:'module'})) — ?worker&url 번들을 ES 형식으로
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
