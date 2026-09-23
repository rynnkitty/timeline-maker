/**
 * 내보내기 예상 소요 (C-19). 실측(docs/browser-support.md §5.2): 프레임당 ≈20~24 ms, 해상도와 거의 무관,
 * 병목은 프레임마다 지도 타일 idle 대기. 준비(지도 생성·폰트) ≈1 s. 여유 있게 25 ms/프레임.
 */
export const estimateExportSeconds = (frames: number) => Math.ceil(1 + frames * 0.025);
