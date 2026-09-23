/**
 * 진입점 — 화면 조립은 src/ui/app.ts.
 * H-1: 파일은 브라우저 안에서만 처리. 외부 요청은 지도 타일·스타일·글리프뿐 (폰트·이미지는 자체 호스팅).
 */
import './ui/app.css';
import { mountApp } from './ui/app.ts';

mountApp(document.querySelector<HTMLDivElement>('#app')!);
