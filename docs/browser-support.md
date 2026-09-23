# Browser Support — 실측 매트릭스

> Phase 1 스파이크 B·A 실측 (2026-09-23). 재현: `npm run dev` 후 `node spikes/run.ts encode|map chrome|edge [--headless]` → `python scripts/video-check.py probe spikes/encode/out/<file>.mp4 --expect <W>x<H>@24:48`.
> 측정 머신: Windows 11 Enterprise (데스크톱). 결정 기준은 `CLAUDE.md` D-10 (Chrome/Edge 필수, 나머지 best-effort). **O-02 는 미확정** — 권장안은 `docs/spike-results.md` §4.

## 1. H.264 인코딩 (WebCodecs + Mediabunny 1.59.0)

48프레임(2초) @24fps, 단색 + 프레임 카운터. `Quality('high')`, `Mp4OutputFormat({ fastStart: 'in-memory' })`.

| 브라우저 | 480×854 | 720×1280 | 1080×1920 | 인코딩 시간 (48f, 480/720/1080) | video-check probe |
|---|---|---|---|---|---|
| Chrome 153.0.8010.53 (창 모드) | ✅ `avc1.640016` | ✅ `avc1.64001f` | ✅ `avc1.640028` | 251 / 248 / 368 ms | 3개 해상도 모두 **5/5 PASS** (해상도·24fps·48프레임·avc1·오디오 없음) |
| Chrome 153 (headless) | ✅ | ✅ | ✅ | 256 / 250 / 361 ms | 5/5 PASS ×3 |
| Edge 153.0.4234.48 | ✅ | ✅ | ✅ | 237 / 294 / 354 ms | 5/5 PASS ×3 |
| Chrome 153 — **Vite 프로덕션 빌드**에서 | ✅ | ✅ | ✅ | — | 480 5/5 PASS |
| Firefox | **미검증** — 이 머신에 설치되어 있지 않음 | | | | |
| Safari (macOS/iOS) | **미검증** — 테스트 장비 없음 | | | | |
| 모바일 Chrome (Android) | **미검증** — 1080p 메모리 한도(O-02) 포함 | | | | |

- 프레임 순서 검증: 디코드한 프레임의 배경 hue(= i×7°)가 프레임 인덱스 순서와 일치(최대 오차 8°, 코덱 양자화), 카운터 000/001/023/047 육안 확인.
- 같은 입력을 세 브라우저로 인코딩한 파일 크기는 같았고 바이트 해시는 달랐다(컨테이너 메타 차이로 추정). 프레임 픽셀 결정론은 Phase 4 DoD 에서 확인.

### 1.1 코덱 문자열 · 레벨

| 해상도 | 매크로블록/프레임 | ×24fps | 규격상 최소 레벨 | Mediabunny 자동 선택 | 명시 지정 시 |
|---|---|---|---|---|---|
| 480×854 | 30×54 = 1,620 | 38,880 MB/s | **3.0** (MaxMBPS 40,500) | `avc1.640016` = **L2.2 (MaxMBPS 20,250 초과)** ⚠ | `fullCodecString: 'avc1.64001e'` (L3.0) → Chrome·Edge 5/5 PASS |
| 720×1280 | 45×80 = 3,600 | 86,400 | 3.1 | `avc1.64001f` = L3.1 ✅ | — |
| 1080×1920 | 68×120 = 8,160 | 195,840 | 4.0 | `avc1.640028` = L4.0 ✅ | — |

→ (§5.4 정정: 이것은 요청 문자열이고, 실제 비트스트림은 L3.0 이었다) 480×854 는 자동 레벨이 프레임 크기만 보고 낮게 잡힌다. Chrome·Edge 는 재생에 문제가 없지만 엄격한 디코더(일부 모바일·SNS 업로드 파이프라인)에 대비해 Phase 4 에서 **`avc1.64001e` 명시**를 권장.

### 1.2 `VideoEncoder.isConfigSupported` 원시 결과 (Chrome 153 · Edge 153 동일)

`prefer-hardware` / `prefer-software` 둘 다 같은 결과.

| 코덱 문자열 | 480×854 | 720×1280 | 1080×1920 |
|---|---|---|---|
| `avc1.42001f` (Baseline 3.1) | yes | yes | **no** |
| `avc1.4d001f` (Main 3.1) | yes | yes | **no** |
| `avc1.64001f` (High 3.1) | yes | yes | **no** |
| `avc1.640028` (High 4.0) | yes | yes | yes |
| `avc1.640032` (High 5.0) | yes | yes | yes |
| `avc1.640033` (High 5.1) | yes | yes | yes |

`canEncodeVideo('avc'|'vp9', {width,height})` 는 세 해상도 모두 true, `getFirstEncodableVideoCodec(['avc','vp9','av1','vp8'])` = `avc`.

## 2. 지도 렌더 (MapLibre GL JS 6.11.0 · 오프스크린 WebGL → 2D 캔버스 복사)

| 브라우저 | 렌더 | tainted canvas | 캡처 (`preserveDrawingBuffer:true` + `idle`) | 결정론 (새 인스턴스 2개 · 같은 경로 16뷰 재생 2회) |
|---|---|---|---|---|
| Chrome 153 (dev 서버) | ✅ CARTO · OFM | 없음 (`toBlob` 성공) | ✅ | 0 px 차이 · 16/16 동일 |
| Chrome 153 (**프로덕션 빌드**) | ✅ | 없음 | ✅ | 0 px 차이 · 16/16 동일 |
| Edge 153 | ✅ | 없음 | ✅ | 0 px 차이 · 16/16 동일 |
| Chrome ↔ Edge 교차 | — | — | 같은 뷰 캡처가 **픽셀 동일**(4개 뷰 비교) | — |
| Firefox · Safari · 모바일 | **미검증** | | | |

## 3. 기능 감지 (D-10) — 제품에서 쓸 검사

1. `typeof VideoEncoder !== 'undefined' && isSecureContext` (GitHub Pages 는 HTTPS → 충족)
2. `await canEncodeVideo('avc', { width, height })` — 선택한 해상도별로
3. WebGL2 컨텍스트 생성 가능 여부 (MapLibre 기본 `contextType: 'webgl2'`)

미지원 시 동작(거부+안내 vs WebM 폴백)은 **O-02 결정 대기**.

## 4. 대용량 파싱 (Phase 2 · O-04 근거)

> 재현: `npx vite --port 5174` 후 `node spikes/parse/run-parse.ts <file> chrome --base=http://localhost:5174/timeline-maker/`.
> 파일은 `<input type=file>` 에 로컬로 넣는다(업로드 없음). 워커 힙은 CDP `Runtime.getHeapUsage`, 문자열은 `backingStorageSize`(외부 문자열) 로 측정.
> 합성 파일은 `spikes/parse/make-big.ts` 가 가짜 좌표 픽스처를 시간 이동해 반복한 것 — 경로점 밀도가 실파일의 약 20배라 **점 수·메모리 기준으로는 최악 조건**이다.

| 입력 | 브라우저 | 점 수 | 워커: 읽기 / 파싱+정제 | 워커 최대 (힙 + 원문 문자열) | 추출 후 남는 힙 | 결과 |
|---|---|---|---|---|---|---|
| 실파일 Android 54.2 MB | Chrome 153 | 52,274 | 75 ms / 144 ms (처음 읽기는 1.4 s) | 31 MB + 54 MB | 3.9 MB | ✅ |
| 실파일 Android 54.2 MB | Edge 153 | 52,274 | 69 ms / 143 ms | 31 MB + 54 MB | 3.9 MB | ✅ |
| 합성 150 MB | Chrome 153 | 1,066,418 | 0.2 s / 1.3 s | 270 MB + 148 MB | 71 MB | ✅ |
| 합성 400 MB | Chrome 153 | 2,841,949 | 0.5 s / 3.6 s | 721 MB + 394 MB | 187 MB | ✅ |
| 합성 600 MB | Chrome 153 | — | `File.text()` 가 **예외 없이 `""`** 반환 | — | — | `FILE_TOO_LARGE` 로 안내 (수정 전엔 `EMPTY_FILE` 오안내) |

- 메인 스레드는 파일 내용을 갖지 않는다(`File` 핸들만 전달). 메인 스레드 힙 증가 = 결과 점 배열 구조화 복제분뿐(실파일 +3.5 MB, 합성 150 MB 에서 +92 MB ≈ 점당 90 B).
- 한계는 메모리가 아니라 **V8 문자열 최대 길이 2²⁹−24 자(≈ 537 M 자)**. 400 MB 까지는 여유가 있다.
- 결과는 제품 워커(`src/workers/parse.worker.ts`)와 Vite 프로덕션 번들 모두에서 픽스처 오라클과 일치했다(android-sample 5,497점).

## 5. MP4 내보내기 (Phase 4 · 제품 파이프라인 `src/export/exporter.ts`)

> 재현: `npx vite --port 5176` → `node spikes/run.ts export chrome --fn=exportRun --args='{"width":480,"height":854,"animS":15}' --file=<Timeline.json> --base=http://localhost:5176/timeline-maker/` → `python scripts/video-check.py probe <mp4> --expect 480x854@24:396 --expect-level 30`.
> 측정 머신: Windows 11 데스크톱 · Chrome 153 (창 모드, 새 프로필 = 타일 캐시 없음).

### 5.1 사양 검증 (video-check.py probe · 6항목: 해상도·24fps·프레임 수·H.264·오디오 없음·avcC/SPS 레벨)

| 입력 | 길이 | 해상도 | 프레임 (기대 = (T+1.5)×24) | 레벨 | 결과 |
|---|---|---|---|---|---|
| 합성 픽스처 | 15 s | 480×854 | 396 | 3.0 | 6/6 PASS |
| 합성 픽스처 | 15 s | 720×1280 | 396 | 3.1 | 6/6 PASS |
| 합성 픽스처 | 15 s | 1080×1920 | 396 | 4.0 | 6/6 PASS |
| 합성 픽스처 | 30 s | 480×854 | 756 | 3.0 | 6/6 PASS |
| 합성 픽스처 | 60 s | 480×854 | 1,476 | 3.0 | 6/6 PASS |
| 실파일 (2026-01-01~) | 15 s | 480 / 720 / 1080 | 396 | 3.0 / 3.1 / 4.0 | 6/6 PASS ×3 |
| 실파일 | 60 s | 1080×1920 | 1,476 | 4.0 | 6/6 PASS |

### 5.2 소요 시간·크기 (UX 판단 근거)

| 입력 · 길이 · 해상도 | 소요 | 파일 크기 |
|---|---|---|
| 실파일 · 15 s · 480×854 | 9.1 s | 5.0 MB |
| 실파일 · 15 s · 720×1280 | 9.0 s | 8.3 MB |
| 실파일 · 15 s · 1080×1920 | 9.3 s | 13.7 MB |
| 실파일 · 60 s · 1080×1920 | 28.8 s | 39.3 MB |
| 픽스처 · 30 s · 480 / 60 s · 480 | 16.3 s / 29.5 s | — |

- 소요 시간은 **해상도와 거의 무관**하고 프레임 수에 비례한다(≈20 ms/프레임). 병목은 인코딩이 아니라 프레임마다 지도 타일 `idle` 을 기다리는 쪽이다.
- 메인 스레드 힙: GC 후 내보내기 전 9.9 MB → 후 13.8 MB (1080 · 60 s). MP4 는 `BufferTarget` 에 모인다 — 60 s · 1080 에서 약 40 MB.

### 5.3 결정론 · 취소 · 재생

| 시험 | 결과 |
|---|---|
| 같은 입력 2회 내보내기 (각각 새 브라우저 프로필) — 디코드 프레임 비교 | **396/396 픽셀 동일** (최대 채널차 0). 파일 바이트는 다름 (컨테이너 메타) |
| 프레임 50 에서 취소 | `AbortError` · 지도 인스턴스 0 개 · 인코더 `output.cancel()` |
| 제품 화면: 내보내기 → 다운로드 → 취소 (dev · **프로덕션 빌드** 둘 다) | 파일명 `…_480x854.mp4` (입력 `/` → `_`), 취소 문구, 남은 지도 = 미리보기 1개 |
| `<video>` 재생 (Chrome 153 · Edge 153, 480·1080) | 396 프레임 디코드 · 16.5 s · 해상도 일치 |
| 기능 감지 (`VideoEncoder` 제거 시뮬레이션) | 3 해상도 모두 `NO_WEBCODECS` → 안내 문구 (D-20) |
| 내보내기 중 **탭 가림** 8 s (다른 탭 전환) | 진행 **정지**(rAF 중단 → MapLibre 렌더 없음) · 안내 문구 · 돌아오면 재개 → 결과가 중단 없는 내보내기와 **396/396 픽셀 동일**. 지도 대기 타임아웃은 보이는 시간만 셈 (C-18) |

### 5.4 레벨 정정 (C-10)

§1.1 의 "Mediabunny 자동 선택 L2.2" 는 **요청한 코덱 문자열**이었다. 실제 비트스트림(avcC·SPS)을 읽어 보니 자동 선택으로 만든 Phase 1 파일에도 **레벨 3.0** 이 기록돼 있었다 — Chrome 인코더가 레벨을 바로잡는다. 레퍼런스 영상도 High·L3.0. 제품은 레벨 표로 계산한 문자열을 명시해 요청과 결과를 일치시킨다.
