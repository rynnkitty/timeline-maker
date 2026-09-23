import { ko } from './i18n/ko.ts';

// Phase 1 스캐폴딩 자리표시자. 실제 UI 는 Phase 5.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  const h1 = document.createElement('h1');
  h1.textContent = ko.appTitle;
  const p = document.createElement('p');
  p.textContent = ko.placeholder;
  app.append(h1, p);
}
