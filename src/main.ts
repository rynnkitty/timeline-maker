/**
 * 진입점 — Phase 3 최소 화면: 파일 선택 → 워커 파싱 → 장면 → 미리보기. (디자인·옵션 UI 는 Phase 5)
 * H-1: 파일은 브라우저 안에서만 처리. 외부 요청은 지도 타일·스타일·글리프뿐 (폰트는 자체 호스팅).
 */
import './ui/app.css';
import { buildScene, computeFrame, makeTrack } from './engine/index.ts';
import { ko } from './i18n/ko.ts';
import { createMapLayer, type MapLayer } from './map/map-layer.ts';
import { ensureFonts } from './ui/fonts.ts';
import { createPreviewPlayer, type PreviewPlayer } from './ui/preview.ts';
import { parseInWorker } from './workers/parse-client.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const h1 = document.createElement('h1');
h1.textContent = ko.appTitle;
const privacy = document.createElement('p');
privacy.className = 'privacy';
privacy.textContent = ko.app.privacy;
const fileLabel = document.createElement('label');
fileLabel.textContent = ko.app.pickFile + ' ';
const file = document.createElement('input');
file.type = 'file';
file.accept = '.json,application/json';
fileLabel.append(file);
const nameLabel = document.createElement('label');
nameLabel.textContent = ko.app.name + ' ';
const name = document.createElement('input');
name.type = 'text';
name.maxLength = 20;
name.value = ko.app.defaultName;
nameLabel.append(name);
const status = document.createElement('p');
status.className = 'status';
status.setAttribute('role', 'status');
const stage = document.createElement('div');
app.append(h1, privacy, fileLabel, nameLabel, status, stage);

let player: PreviewPlayer | null = null;
let map: MapLayer | null = null;

file.addEventListener('change', async () => {
  const f = file.files?.[0];
  if (!f) return;
  player?.destroy();
  map?.destroy();
  status.textContent = ko.app.loading;
  const o = await parseInWorker(f);
  if (!o.ok) {
    status.textContent = ko.errors[o.code];
    return;
  }
  const scene = buildScene(makeTrack(o.result.track), {
    animS: 15,
    width: 480,
    height: 854,
    name: name.value.trim() || ko.app.defaultName,
  });
  status.textContent = ko.app.preparing;
  map = await createMapLayer(480, 854);
  const subs = [0, scene.timeline.animFrames].map((i) => computeFrame(scene, i).subtitle);
  await ensureFonts([scene.title, ...subs, map.attribution]);
  player = createPreviewPlayer(scene, map);
  stage.replaceChildren(player.element);
  status.textContent = '';
  (window as unknown as { __preview?: PreviewPlayer }).__preview = player; // 개발 검증용 핸들 (데이터 없음)
});
