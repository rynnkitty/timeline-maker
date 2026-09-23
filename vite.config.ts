import { defineConfig } from 'vitest/config';

// D-08: GitHub Pages 프로젝트 사이트 → https://<계정>.github.io/timeline-maker/
// https://vite.dev/guide/static-deploy#github-pages
export default defineConfig({
  base: '/timeline-maker/',
  build: {
    target: 'es2023',
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
