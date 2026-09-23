/**
 * 출력 W×H 에 맞춘 MapLibre 컨테이너 기하 (순수 · 테스트 가능).
 *
 * 라벨 배율 k (C-7): 레퍼런스 라벨은 CARTO GL 기본보다 ≈1.35배 크다. 컨테이너를 480/k CSS px 로 줄이고
 * pixelRatio 를 키우면 라벨(CSS px 단위)이 k배로 보인다. 같은 지리 범위를 유지하려고 MapLibre 줌을 −log2(k) 보정.
 * k 는 정수 컨테이너 폭에서 역산해(k = 480 / cw) 엔진 투영과 정확히 일치시킨다.
 */
import { BASE_W } from '../engine/mercator.ts';

export type MapGeometry = {
  /** 컨테이너 CSS 크기 (정수) */
  cssW: number;
  cssH: number;
  pixelRatio: number;
  /** 실효 라벨 배율 = 480 / cssW */
  k: number;
  /** 엔진 줌 → MapLibre 줌 보정 (−log2 k) */
  zoomOffset: number;
};

export function mapGeometry(W: number, H: number, labelScale: number): MapGeometry {
  const cssW = Math.round(BASE_W / labelScale);
  const k = BASE_W / cssW;
  // MapLibre 는 캔버스 = floor(CSS × pixelRatio). 부동소수 오차로 W−1 이 되지 않게 아주 조금 키운다
  const pixelRatio = (W / cssW) * (1 + 1e-9);
  const cssH = Math.ceil(H / pixelRatio);
  return { cssW, cssH, pixelRatio, k, zoomOffset: -Math.log2(k) };
}
