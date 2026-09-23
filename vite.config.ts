import { defineConfig } from 'vitest/config';

// D-08: GitHub Pages 프로젝트 사이트 → https://<계정>.github.io/timeline-maker/
// https://vite.dev/guide/static-deploy#github-pages
export default defineConfig({
  base: '/timeline-maker/',
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
