# Phase 1 스파이크 결과 — 지도(A) · 인코딩(B)

> 2026-09-23 · 코드 `spikes/` (제품 코드와 격리 — `vite.config.ts` 빌드 입력은 `index.html` 뿐) · 산출물 `spikes/**/out/` (gitignore, 재생성 가능)
> 레퍼런스 프레임과 나란히 놓은 비교 이미지는 실궤적이 포함되므로 `docs/reference/spike-a/side-by-side.png` (gitignore) 에만 있다.
> **O-01 · O-02 는 이 문서로 확정하지 않는다** — §4 의 권장안을 사용자가 결정한다.

## 재현

```bash
npm run dev                                   # http://localhost:5173/timeline-maker/
node spikes/run.ts encode chrome              # 스파이크 B → spikes/encode/out/*.mp4 + chrome.json
node spikes/run.ts map chrome                 # 스파이크 A → spikes/map/out/*.png + chrome.json
node spikes/run.ts map chrome --fn=determinism
python scripts/video-check.py probe spikes/encode/out/chrome-480x854.mp4 --expect 480x854@24:48
# 프로덕션 빌드 검증
npx vite build --config spikes/vite.spikes.config.ts && npx vite preview --config spikes/vite.spikes.config.ts
node spikes/run.ts map chrome --fn=determinism --base=http://localhost:4173/timeline-maker/
```

`spikes/run.ts` 는 `puppeteer-core` 로 **로컬에 설치된** Chrome/Edge 를 띄워(브라우저 다운로드 없음) 페이지 함수를 실행하고, 산출물을 base64 로 받아 저장한다. 페이지가 연 요청의 호스트별 개수도 기록한다(H-1 점검).

---

## 1. 스파이크 A — 지도 (MapLibre GL JS 6.11.0)

### 1.1 API 근거 (H-4 — 설치된 `maplibre-gl.d.ts`)

| 항목 | 확인 결과 |
|---|---|
| `preserveDrawingBuffer` | 최상위 옵션 **아님** → `canvasContextAttributes: { preserveDrawingBuffer }` (기본 false) |
| `'idle'` 이벤트 | "카메라 전환 없음 · 요청한 타일 전부 로드 · 페이드/전환 애니메이션 완료" 후 마지막 프레임 — **H-6 "타일 로딩 완료" 조건과 동일** |
| `once(type)` | 리스너 생략 시 Promise 반환 |
| `redraw()` | 동기 재렌더 |
| `localIdeographFontFamily` | 기본 `'sans-serif'` — **한중일 문자는 스타일 글리프 대신 로컬 OS 폰트로 그림**. `false` 로 스타일 글리프 사용 |
| `setNow(ms)` / `restoreNow()` | "프레임 단위 영상 캡처용 결정론적 시간 고정" API 존재 — Phase 3/4 에서 사용 검토 |

### 1.2 ⚠ 워커 로딩 (Vite) — 해결됨

MapLibre v6 는 워커를 `new Worker(new URL(변수, import.meta.url), { type: 'module' })` 로 만든다. URL 이 변수라 Vite 가 추적하지 못해 **dev 서버에서 404 → `load` 이벤트가 영원히 오지 않음**(첫 실행이 10분 타임아웃으로 멈춤). 워커는 `./maplibre-gl-shared.mjs` 를 import 하므로 단순 `?url` 로도 빌드가 깨진다.

해결 (dev · 프로덕션 빌드 둘 다 검증):

```ts
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'; // 의존성째 번들
setWorkerUrl(workerUrl);
// vite.config.ts: worker: { format: 'es' }
```

빌드 결과: `maplibre-gl-worker-*.js` 510 kB, 지도 페이지 청크 1,020 kB (gzip 276 kB) — Phase 5 에서 코드 분할 검토.

### 1.3 제공자 비교 (O-01 근거)

| 항목 | **CARTO 벡터 Positron** | **OpenFreeMap Positron** | OpenFreeMap + 스타일 오버라이드 (실험) |
|---|---|---|---|
| 스타일 URL | `basemaps.cartocdn.com/gl/positron-gl-style/style.json` | `tiles.openfreemap.org/styles/positron` | 위 스타일을 fetch 해 배경·물·라벨 필드만 교체 |
| 약관 (원문 확인 2026-09-23) | 벡터는 **현재 API 키 불필요**, "향후 벡터에도 키 요구 가능 — 지금 키 발급 권장". 무료 fair use **월 500만 타일 요청**. 초과 시 비상업은 보통 무료 상향, 상업은 계약. 키는 고객별·프로젝트 간 공유 금지 · [FAQ](https://docs.carto.com/faqs/carto-basemaps) | **무료 · 요청 한도 없음 · 키/가입/쿠키 없음 · 상업 이용 허용**, SLA 없음, MIT · [openfreemap.org](https://openfreemap.org/) | 같음 |
| Attribution (H-3) | `© CARTO, © OpenStreetMap contributors` — **레퍼런스와 같은 문구** | `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` | 같음 |
| CORS | style·TileJSON `Access-Control-Allow-Origin: *` | 같음 | 같음 |
| tainted canvas | 없음 (`toBlob` 성공, Chrome·Edge) | 없음 | 없음 |
| 배경 / 물 색 | `#fafaf8` / `#d4dadc` → 캡처 우세색 (250,250,248) / (212,218,220) — **레퍼런스 실측 (250,250,246) / (210,216,220) 과 사실상 동일** | rgb(242,243,240) / rgb(194,200,202) — 눈에 띄게 회색 | CARTO 값으로 교체 → 거의 동일 |
| 라벨 (z<13) | `name_en` 영문 · 라벨 목록이 레퍼런스와 같음 (Kaesong·Cheonan·Seosan·Cheongju…) | **"로마자 + 한글" 병기** (`Seoul 서울특별시`) — 레퍼런스와 다름 | 영문만 가능. 단 라벨 스타일(굵기·대도시 강조)이 레퍼런스와 다름 |
| 라벨 (z≥13) | **`name`(한글)로 전환** — CARTO 글리프 서버에 한글이 없어 `localIdeographFontFamily:false` 면 라벨 **사라짐**, 기본값이면 OS 폰트 → 기기 의존 | 글리프 서버에 한글 있음 (스타일 글리프 = 로컬 폰트 결과 동일) | — |
| 톤 (육안) | 레퍼런스와 같은 지도 | 도로·경계가 진하고 전체적으로 어두움 | 레퍼런스에 가깝지만 도로 위계·북한 경계 표현이 다름 |
| 첫 로드 후 idle | 수~수백 ms | 수백~1,000 ms | 비슷 |
| 결정론 | 새 인스턴스 2개 0 px · 경로 재생 16/16 동일 | 같음 | 같음 |
| 향후 위험 | 키 요구 시 공개 사이트 클라이언트에 키 노출 · fair use 초과 | 단일 운영자 · SLA 없음 · 타일 버전 URL(`planet/2026…`) 이 주기적으로 바뀜 | 스타일 구조 변경 시 오버라이드 깨짐 |

→ 요청량 참고: 결정론 실행(뷰 36회 전환)에서 CARTO 벡터 타일 요청 ≈70건. 396프레임 내보내기 1회는 카메라 이동량에 따라 수백 건 수준으로 추정(Phase 4 실측) — 월 500만 한도 대비 여유가 크다.

### 1.4 캡처 방식 (480×854)

| 방식 | 결과 | 채택 |
|---|---|---|
| (A) `canvasContextAttributes.preserveDrawingBuffer: true` → `await once('idle')` → `drawImage(map.getCanvas())` | ✅ 불투명 100%, 기대 색 | **권장** — 표준이 보장하는 방식 |
| (B) preserve `false`, idle 후 다른 태스크에서 `drawImage` | Chromium 에서는 **우연히** 내용이 남아 있음 | ✗ — 표준상 버퍼가 비워질 수 있음, 브라우저 의존 |
| (C) preserve `false`, `map.redraw()` 직후 같은 태스크에서 `drawImage` | ✅ | 대안 (성능이 문제될 때 Phase 4 에서 비교) |

### 1.5 결정론 (H-6)

| 시험 | CARTO | OFM |
|---|---|---|
| 새 지도 인스턴스 2개, 같은 뷰(z7.7) | 0 px | 0 px |
| 같은 카메라 경로 16뷰를 새 인스턴스로 2회 재생, 프레임별 비교 | **16/16 동일** | **16/16 동일** |
| 같은 인스턴스에서 **다른 곳에 갔다가** 같은 뷰로 복귀 | z12 0 px · z7.7 5,812 px (최대 채널차 20) | z12 0 px · z7.7 6,467 px (최대 46) |
| Chrome ↔ Edge 같은 뷰 | 0 px | 0 px |
| Vite 프로덕션 빌드 | 위와 동일 | 위와 동일 |

**해석**: 출력은 "현재 뷰"만이 아니라 **카메라 이력**(타일 캐시·라벨 배치 이력)에 의존한다. 같은 경로를 처음부터 재생하면 완전히 같다. → 내보내기는 **새 지도 인스턴스에서 프레임 0부터 순서대로** 렌더하면 결정론이 성립한다. 미리보기 스크럽(임의 t 접근)은 라벨 배치가 내보내기와 미세하게 다를 수 있다(Phase 3 위험 — ROADMAP C-8).

### 1.6 해상도·라벨 크기 (Phase 3 입력)

- **1080×1920 을 만드는 두 방식**:
  - (a) 컨테이너 480×854 + `pixelRatio: 2.25` → 라벨 비율이 480 출력과 같음(레퍼런스 룩 유지). 단 캔버스가 **1080×1921** (854×2.25=1921.5 내림) → 목표 크기로 잘라 복사해야 함. 720 도 854×1.5=1281 로 같은 문제.
  - (b) 컨테이너 1080×1920 + zoom+log2(2.25) → 라벨이 상대적으로 작아짐.
  - **(a) 권장**.
- **레퍼런스 라벨은 CARTO GL 기본보다 약 1.35배 크고**(같은 라벨 폭 비교: Kaesong 68 vs 51px, Cheongju 76 vs 55px), 대도시가 대문자(SEOUL·SUWON·DAEJEON)이며 약간 흐리다.
  - 레퍼런스는 래스터 Positron 을 확대해 렌더한 것으로 추정된다.
  - 근사 방법: 컨테이너를 `480/1.35` 로 줄이고 `pixelRatio` 를 올려 라벨을 키운다. 필요하면 도시 라벨 `text-transform`·`text-size` 를 오버라이드한다. **Phase 3 에서 기준 프레임 대조로 튜닝**(ROADMAP C-7).
- CARTO 를 쓰면 **z≥13 한글 라벨 문제**가 있다. 대응은 둘 중 하나:
  - text-field 를 모든 줌에서 `name_en` 으로 고정한다(레퍼런스도 영문만 씀) — **권장**.
  - 최대 줌을 13 미만으로 클램프한다.
  - 어느 쪽이든 로컬 폰트 의존(기기별 차이)이 없어진다.

### 1.7 개인정보 (H-1)

스파이크 페이지가 연 요청 호스트 = `localhost` + `basemaps.cartocdn.com`·`tiles(-a..d).basemaps.cartocdn.com` + `tiles.openfreemap.org` 뿐. 그 외 요청 0건. 오류 응답은 `favicon.ico` 404 한 건(Phase 5 에서 파비콘 추가).

---

## 2. 스파이크 B — 인코딩 (Mediabunny 1.59.0)

### 2.1 API 근거 (H-4 — 설치된 `mediabunny.d.ts`)

`new Output({ format: new Mp4OutputFormat({ fastStart }), target: new BufferTarget() })` · `new CanvasSource(canvas, { codec: 'avc', quality: new Quality('high'), fullCodecString?, onEncoderConfig? })` · `output.addVideoTrack(source, { frameRate: 24 })` · `await output.start()` · **`await source.add(timestampSec, durationSec)`** (반환 Promise = 인코더·writer 백프레셔) · `await output.finalize()` · `target.buffer: ArrayBuffer | null` · `canEncodeVideo(codec, {width,height})` · `getFirstEncodableVideoCodec(codecs, {width,height})` · `QUALITY_*` 상수는 deprecated → `new Quality('high')`.

### 2.2 결과

상세는 `docs/browser-support.md` §1. 요약:
- Chrome 153 · Edge 153 · headless Chrome 에서 3개 해상도 모두 인코딩에 성공했다.
- `scripts/video-check.py probe` 결과 **해상도·24fps·48프레임·H.264·오디오 없음 5/5 PASS**.
- Vite 프로덕션 빌드에서도 동작한다.
- 480×854 자동 레벨(L2.2)은 규격 미달이고, `fullCodecString: 'avc1.64001e'`(L3.0)로 교정하면 PASS 한다.

---

## 3. Phase 3·4 로 넘기는 설계 입력

1. 워커: `setWorkerUrl(?worker&url)` + `worker.format: 'es'` (§1.2) — `src/map/` 에 그대로 이식
2. 캡처: `preserveDrawingBuffer: true` + `once('idle')` + `drawImage` (§1.4)
3. 내보내기는 새 지도 인스턴스 · 프레임 0 부터 순차 (§1.5)
4. 출력 해상도 = 컨테이너 480×854 기준 + `pixelRatio = W/480` + 목표 크기로 잘라 복사 (§1.6)
5. `fadeDuration: 0` · `interactive: false` · `attributionControl: false`(attribution 은 HUD 에 직접 굽는다, H-3) · `renderWorldCopies: false`
6. CARTO 채택 시 text-field `name_en` 고정 (§1.6)
7. 480×854 는 `fullCodecString: 'avc1.64001e'` (§2.2)
8. 기능 감지: `VideoEncoder` 존재 + `isSecureContext` + `canEncodeVideo('avc', {w,h})` + WebGL2

---

## 4. 결정 요청 (사용자 확정 — 이 문서에서는 권장안만)

### O-01 타일 제공자

| 선택지 | 장점 | 단점 |
|---|---|---|
| **(a) CARTO 벡터 Positron + OFM 을 예비 제공자로 추상화 (Recommended)** | 레퍼런스와 **같은 지도**(색·라벨 목록·attribution 문구 일치) · 현재 키 불필요 · 한도 여유 | 향후 키 요구·약관 변경 위험 → 제공자를 `src/map/` 인터페이스 뒤에 두고 OFM(스타일 오버라이드)로 전환 가능하게 |
| (b) OpenFreeMap Positron 단독 (스타일 오버라이드) | 무제한·무키·상업 허용 · 한글 글리프 제공 | 레퍼런스와 톤·라벨 스타일이 다름 · SLA 없음 |
| (c) CARTO API 키 발급 | 약관상 가장 안전 | 공개 정적 사이트라 키가 클라이언트에 노출 · 사용자 계정 작업 필요 |

### O-02 브라우저 H.264 미지원 시

| 선택지 | 장점 | 단점 |
|---|---|---|
| **(a) 거부 + 안내 (Chrome/Edge 데스크톱 권장 문구), 폴백 없음 (Recommended)** | 출력 사양(D-04 MP4·H.264)을 하나로 유지 · 코드 단순 · 실측된 Chrome/Edge 는 3개 해상도 모두 지원 | Firefox·Safari 사용자가 H.264 인코딩을 못 하면 사용 불가 (미검증) |
| (b) WebM(VP9) 폴백 | 더 많은 브라우저에서 동작 가능성 | 사양이 둘로 갈림 · iOS 재생·SNS 업로드 호환 문제 · 테스트 매트릭스 2배 |

모바일 1080p 메모리 한도는 측정 장비가 없어 **미검증**이다(ROADMAP C-9).
