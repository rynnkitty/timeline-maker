// 스파이크 전용 프로덕션 빌드 — MapLibre 워커(?worker&url) 가 빌드 산출물에서도 로드되는지 확인용.
// 제품 빌드(vite.config.ts)는 index.html 만 입력으로 쓰므로 스파이크가 섞이지 않는다.
import { resolve } from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: resolve(import.meta.dirname, 'build/out'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          map: resolve(import.meta.dirname, 'map/index.html'),
          encode: resolve(import.meta.dirname, 'encode/index.html'),
          parse: resolve(import.meta.dirname, 'parse/index.html'),
        },
      },
    },
    preview: { port: 4173, strictPort: true },
  }),
);
