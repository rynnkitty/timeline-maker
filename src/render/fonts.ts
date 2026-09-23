/**
 * 한글 웹폰트 — Noto Sans KR (OFL-1.1, @fontsource 로 자체 호스팅 → 외부 요청 없음 · H-1).
 * 캔버스 텍스트는 폰트가 아직 없으면 **조용히 대체 폰트로** 그린다 → 첫 렌더 전에 실제 문자열로 로드를 기다린다.
 * unicode-range 서브셋이라 쓰는 글자가 든 조각만 받는다.
 */
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import { FONT_FAMILY, HUD_GLYPHS } from '../engine/index.ts';

export async function ensureFonts(texts: string[]): Promise<void> {
  const sample = texts.join('') + HUD_GLYPHS;
  await Promise.all([document.fonts.load(`700 20px ${FONT_FAMILY}`, sample), document.fonts.load(`400 12px ${FONT_FAMILY}`, sample)]);
  if (!document.fonts.check(`700 20px ${FONT_FAMILY}`, sample)) throw new Error('font not loaded');
}
