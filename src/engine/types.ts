/** 카메라 — 중심은 단위 메르카토르 월드 좌표, 줌은 출력 폭 480 기준 (mercator.ts) */
export type Camera = { x: number; y: number; zoom: number };

/**
 * 지도 배경 렌더러 — 엔진은 이 인터페이스만 안다 (구현: src/map/map-layer.ts, MapLibre).
 * render 는 해당 카메라의 타일이 **전부 로드된 뒤**(H-6) 출력 크기 W×H 와 같은 크기의 이미지를 돌려준다.
 */
export interface MapRenderer {
  readonly width: number;
  readonly height: number;
  /** 활성 제공자 attribution (H-3 · D-19) */
  readonly attribution: string;
  render(camera: Camera, frameIndex: number): Promise<CanvasImageSource>;
  destroy(): void;
}
