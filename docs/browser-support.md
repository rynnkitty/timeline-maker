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

→ 480×854 는 자동 레벨이 프레임 크기만 보고 낮게 잡힌다. Chrome·Edge 는 재생에 문제가 없지만 엄격한 디코더(일부 모바일·SNS 업로드 파이프라인)에 대비해 Phase 4 에서 **`avc1.64001e` 명시**를 권장.

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
