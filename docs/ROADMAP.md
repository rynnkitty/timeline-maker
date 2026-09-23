# ROADMAP — TimelineMaker

> 세션 간 연속성의 SSOT (`CLAUDE.md` §1). Task 완료마다 **현황 · 다음 명령 · 미해결·Carry-over** 를 갱신한다.
> Phase 절차·DoD 원문은 `.claude/agents/timeline-maker.md` §3. 규칙·결정은 `CLAUDE.md`.

## 현황

| Phase | 이름 | 상태 | 완료일 |
|---|---|---|---|
| 0 | 사양 고정 & 스키마 확인 | ✅ 완료 (main `1d76d3b`) | 2026-09-23 |
| 1 | 스캐폴딩 + 기술 스파이크 | ✅ 완료 (main `515dc69` 머지) | 2026-09-23 |
| 2 | 파서 & 정규화 (TDD) | ✅ 완료 (main `6ca5591` 머지) | 2026-09-23 |
| 3 | 애니메이션 엔진 | ✅ 완료 (main `2d1f558` 머지) | 2026-09-23 |
| 4 | MP4 내보내기 | ✅ 완료 (`feat/phase-4` → main 머지) | 2026-09-23 |
| 5 | UI/UX | ⬜ | |
| 6 | 배포 | ⬜ | |

## 다음 세션 명령

```
timeline-maker 에이전트로 모드 A · Phase 5 (UI/UX)를 진행하라 (D-23 위임 진행).
입력: src/main.ts 최소 화면(파일·이름·길이·해상도·미리보기·내보내기·취소) → frontend-design 으로 재설계.
확정 필요: O-05(기본 기간·연도 넘김 제목) · O-06(테마 프리셋) · O-07(iOS 베타 표기) — 권고안으로.
Carry-over: C-9 · C-11 · C-12 · C-14 · C-17 · C-18(탭 가림 안내 UX) · C-19(예상 소요 시간 표시) · C-20(내보내기 중 미리보기 지도) · C-21.
```

---

## Phase 0 — 사양 고정 & 스키마 확인 ✅

| Task | 상태 | 산출물 |
|---|---|---|
| 0-1 레퍼런스 사양 체크리스트 + 재측정 | ✅ | `docs/reference-spec.md` §1~§4, §8 |
| 0-2 기준 프레임 12장 추출 | ✅ | `docs/reference/ref_*.png` (gitignore · 로컬 전용) |
| 0-3 영상 검증 도구 | ✅ | `scripts/video-check.py` (`probe` / `frames` / `timing`) — Phase 3·4 DoD 에서 재사용 |
| 0-4 Android 실파일 구조 조사 (좌표 없이) | ✅ | `docs/reference-spec.md` §6 · 상세 집계 `docs/reference/survey-android.txt` (gitignore) |
| 0-5 에이전트 §2.5 검증·수정 | ✅ | `.claude/agents/timeline-maker.md` v1.2 |
| 0-6 합성 픽스처 생성기 | ✅ | `scripts/make-fixtures.ts` → `tests/fixtures/*.json` 12개 + `expected.json` 오라클 |
| 0-7 ROADMAP | ✅ | 이 문서 |

DoD: reference-spec 완성 ✅ · §2.5 실파일 일치 확인(수정 반영) ✅ · 픽스처 2종 + 엣지 케이스 ✅ · ROADMAP 존재 ✅

## Phase 1 — 스캐폴딩 + 기술 스파이크

- [x] 1-1 `git init -b main` · `git status --ignored` 로 ref/·docs/reference/ ignored 확인 · Phase 0 첫 커밋 `1d76d3b` · H-2 자동화(`scripts/privacy-check.ts` + `.githooks/pre-commit` + `npm run privacy-check`, 음성 테스트로 차단 확인)
- [x] 1-2 Vite 8.3.0 + TS 6.0.3(7.x 는 typescript-eslint 미지원) · Vitest 5.0.1 · ESLint 10 + typescript-eslint · Prettier — `npm run dev/build/test/typecheck/lint` 통과
- [x] 1-3 scripts `fixtures`·`privacy-check`·`prepare`(hooksPath) · `engines.node >=22.18`
- [x] 1-4 `.github/workflows/deploy.yml` — SHA 고정(checkout v7.0.1 · setup-node v7.0.0 · configure-pages v6.0.0 · upload-pages-artifact v5.0.0 · deploy-pages v5.0.1, GitHub API 대조), Node 22 (push 없음)
- [x] 1-5 스파이크 A → `spikes/map/` · `docs/spike-results.md` §1 (제공자 비교표·캡처 방식·결정론·워커 로딩 해결)
- [x] 1-6 스파이크 B → `spikes/encode/` · `docs/browser-support.md` (Chrome·Edge·headless·빌드 5/5 PASS)
- [x] 1-7 **O-01 · O-02 사용자 확정** (D-19 · D-20) → `CLAUDE.md` §3 (권장안 `docs/spike-results.md` §4)

DoD: dev·build·test 통과 ✅ · 스파이크 A/B 산출물과 비교표 ✅ · 스파이크 코드 `spikes/` 격리 ✅ · **O-01·O-02 확정 ✅**

## Phase 2 — 파서 & 정규화 (TDD)

- [x] 2-1 `detectFormat` — android · ios · 빈 배열(→ `NO_DATA`, D-18) · legacy(Records/Semantic) · unknown
- [x] 2-2 `extractAndroid` / `extractIos` → `TrackPoint { t, tz, lat, lng }` (D-16 timelinePath 만) — **계약 확장: `tz`(분)** 추가 (현지 월 표기용)
- [x] 2-3 `cleanTrack`: 안정 정렬 → 같은 t 첫 점(D-17) → 직전 유효점 대비 ≥1,000 km/h 제거 (+ 첫 점 이상치 방어)
- [x] 2-4 haversine 누적(D-14, R 6371.0088) · 현지 월/날짜(ISO 접미 오프셋) · `filterByLocalDate`
- [x] 2-5 Web Worker (`src/workers/`) + 브라우저 실측 → `docs/browser-support.md` §4. `FILE_TOO_LARGE` 수정
- [x] 2-6 실파일 스모크 (요약만 · `docs/reference/phase2-real-smoke.txt`, gitignore) — Phase 0 수치와 일치
- [x] 2-7 **O-04 사용자 확정** (D-22)

DoD: 픽스처 오라클 12/12 ✅ (vitest 41/41) · 엣지 케이스 전부 명시적 결과 ✅ · 좌표 0 통과 ✅ · iOS 문자열 숫자 ✅ · 실파일 스모크 ✅ · 브라우저 워커 = 오라클 ✅

## Phase 3 — 애니메이션 엔진 ✅

- [x] 3-1 `src/engine/` — timeline(프레임 인덱스·진행 축) · mercator · track(열 배열·헤드 보간) · camera · trail · hud · frame(`computeFrame`/`drawFrame`/`renderFrame`)
- [x] 3-2 `src/map/` — 제공자 인터페이스(CARTO 기본·OFM 예비, D-19) · 라벨 배율 k · MapLibre 캡처(`idle`·`preserveDrawingBuffer`) · 투영 정합 ≤0.42 px
- [x] 3-3 한글 웹폰트(Noto Sans KR 자체 호스팅) 로드 후 렌더 (`src/ui/fonts.ts`)
- [x] 3-4 미리보기 플레이어 (재생·일시정지·스크럽, 프레임 격자 스냅) + 최소 `main.ts`
- [x] 3-5 결정론: eslint 로 `src/engine` 의 `Date.now`·`Math.random`·`performance.now`·`new Date()` 금지
- [x] 3-6 기준 프레임 12장 대조 6회 반복 → `docs/phase3-lookfeel.md` (이미지 `docs/reference/phase3/`, gitignore)
- [x] 3-7 C-13: 워커 결과를 `PackedTrack` transfer (D-30)

DoD: §2 체크리스트 전 항목 판정 ✅ (S5 라벨 서체만 🟡) · 실파일 렌더 vs 기준 프레임 나란히 비교 ✅ (D-23: 에이전트 판정 + advisor) · timeline·camera·trail 단위 테스트 ✅ (vitest 64/64)

## Phase 4 — MP4 내보내기 ✅

- [x] 4-1 `src/export/exporter.ts` — 새 지도 인스턴스·프레임 0 부터 순차(D-28) · 프레임마다 `idle` 대기 · `CanvasSource.add` await 백프레셔 · `source.close()` · 취소(`output.cancel()` + 지도 제거) · 진행률/ETA
- [x] 4-2 H.264 레벨 표(Table A-1)로 `fullCodecString` (480→3.0·720→3.1·1080→4.0) · `video-check.py probe --expect-level` 로 avcC/SPS 레벨 실측 (C-10)
- [x] 4-3 기능 감지 + 안내 (D-20) · 파일명 정리 · Blob 다운로드
- [x] 4-4 MP4 재측정으로 진행 끝 f359 · 마커 축소 교정 (레퍼런스와 프레임 단위 일치)
- [x] 4-5 가려진 탭 대응 (보이는 시간만 세는 타임아웃 + 안내)
- [x] 4-6 해상도별 소요 시간 기록 (`docs/browser-support.md` §5.2)

DoD: 15 s × 3 해상도 **396프레임·24 fps·H.264·오디오 없음·레벨** 6/6 PASS ✅ · 30 s(756)·60 s(1,476) 공식 일치 ✅ · Chrome·Edge `<video>` 재생 ✅ · 2회 내보내기 **396/396 픽셀 동일** ✅ · 취소 후 지도 인스턴스 0 ✅ · 실파일 내보내기(출력 `docs/reference/phase4/`, gitignore) ✅

## Phase 5 — UI/UX · Phase 6 — 배포

Task 는 각 Phase 진입 시 에이전트 §3 을 기준으로 분해해 여기에 추가한다.

---

## 질문 (사용자 확정 필요 — 해당 Phase 진입 시 `AskUserQuestion`)

| ID | 질문 | 선택지 | 권장안 | 근거 | 확정 시점 |
|---|---|---|---|---|---|
| ~~**Q1**~~ ✅ (a) 확정 → `CLAUDE.md` D-16 (2026-09-23) | 트랙(트레일·거리)의 좌표 소스 | (a) **timelinePath 포인트만** (b) timelinePath + visit/activity 시작·끝 좌표 병합 (c) timelinePath 가 없는 구간만 visit/activity 로 보충 | **(a) (Recommended)** — 단순·지그재그 없음. 레퍼런스 km 대비 −1.3% | 실측: (a) −1.3% · (b) +0.5% · `distanceMeters` 합 −2.3%. timelinePath 는 visit 과 5,489쌍·activity 와 2,182쌍 시간 겹침 → (b) 는 같은 시각 두 위치 위험. 경로점 커버리지 579/582일 | Phase 2 시작 |
| ~~**Q2**~~ ✅ (a) 확정 → `CLAUDE.md` D-17 (2026-09-23) | 같은 타임스탬프·다른 좌표(200m~1km) 쌍 처리 | (a) **파일 순서상 첫 점만 유지** (b) 둘 다 유지하고 속도 계산 dt 하한(예: 60초) 적용 (c) 두 점 평균 | **(a) (Recommended)** — 결정론적·단순, 거리 영향 −1.4%p | 실측 1,539쌍(경로점의 ≈3%), 좌표 완전 동일 0건. dt=0 이면 속도 필터가 ∞ 로 오판 → 어느 쪽이든 명시 처리 필수. 픽스처 오라클은 (a) 기준 | Phase 2 시작 |
| ~~**Q3**~~ ✅ (a) 확정 → `CLAUDE.md` D-18 (2026-09-23) | `edge-empty-ios.json` (`[]`) 의 결과 | (a) **`NO_DATA`** (b) `UNKNOWN_FORMAT` | **(a) (Recommended)** — 사용자에겐 "데이터 없음" 이 더 정확한 안내 | 빈 배열은 형식 판별 근거가 없음 | Phase 2 |
| ~~**Q4**~~ ✅ (a) 확정 → `CLAUDE.md` H-2 v1.2 (2026-09-23) | H-2 커밋 전 점검 패턴 — 현재 키워드(`semanticSegments`·`geo:`·`°, `)는 스키마를 설명하는 `CLAUDE.md`·에이전트 문서·reference-spec·make-fixtures.ts 에도 걸린다 | (a) **키워드 대신 숫자 좌표 패턴**(`\d{1,3}\.\d{4,}°` · `geo:-?\d+\.\d{4,}`)으로 검사하고 `tests/fixtures/`·`scripts/make-fixtures.ts` 는 예외 (b) 현행 유지 + 파일별 수동 확인 | **(a) (Recommended)** — 오탐 없이 실좌표만 잡음 | Phase 0 점검에서 문서 4개가 키워드에 걸림(실좌표는 0) | Phase 1 첫 커밋 전 (`CLAUDE.md` H-2 문구 변경 = 사용자 승인 필요) |

---

## 미해결·Carry-over

| # | 항목 | 위험 | 대응 | 담당 Phase |
|---|---|---|---|---|
| C-1 | **iOS 파서 실파일 미검증** (O-07) | 높음 — iOS 사용자는 첫 사용에 실패할 수 있음. activity type 표기·timelinePath 창 길이·timelineMemory 존재 여부·분 오프셋이 정수인지 전부 추정 | 합성 픽스처(`ios-sample.json`·`edge-zero-values.ios.json`) 통과 + 모르는 키 무시 + 필수 필드만 의존. UI "iOS 베타" 표기 여부는 O-07 로 Phase 5 확정. 실파일 제보 시 픽스처 보강 | 2 · 5 |
| ~~C-2~~ ✅ | 카메라 t=0 줌 | — | 가설 (c) 시작 이전 = 첫 점 중앙·z7.7 확정 (f000 줌 7.66·마커 ±3px) — D-25 | 3 |
| ~~C-3~~ ✅ | 트레일 팔레트 재측정 | — | 휘도 5구간 히스토그램 대조 → D-26 (민트색 자체·3 s 소멸) | 3 |
| ~~C-4~~ ✅ | 브라우저 메모리 | — | Phase 2 실측 (`docs/browser-support.md` §4): 실파일 워커 최대 ≈85 MB, 400 MB 합성까지 동작, 600 MB 는 V8 문자열 한계 → `FILE_TOO_LARGE`. O-04 확정 대기 | 2 |
| C-12 | 파일 크기 사전 차단 없음 (현재는 읽은 뒤 `FILE_TOO_LARGE` 판정) | 낮음 | Phase 5 입력 검증에서 크기 상한 안내 (D-22: 읽기 전 크기 검사 + 200MB+ 경고) | 5 |
| ~~C-13~~ ✅ | 대용량 결과 복제 비용 | — | `PackedTrack` transfer (D-30) + 그리기 시 0.7px 이내 점 생략 | 3 |
| C-14 | iOS 경로는 여전히 합성 픽스처로만 검증 (C-1 과 동일 위험) | 높음 | O-07 (Phase 5) | 5 |
| ~~C-15~~ ✅ | D-24 (진행 축 = 누적 거리) 확인 | — | 오케스트레이터 검토 수용 2026-09-23 (D-26 포함) — 최종 보고에서 사용자에게 고지 | — |
| C-16 | 일부 프레임의 이동 배치가 레퍼런스와 다름 (같은 km 에 다른 이동) | 낮음 | 레퍼런스 제작 데이터·정제 차이로 판정 — 엔진 수정 대상 아님 (`docs/phase3-lookfeel.md` §4) | — |
| C-17 | 최소 UI (파일·이름·길이·해상도·내보내기만 — 기간·테마 없음, 디자인 없음) | 낮음 | Phase 5 에서 설계. O-05(기본 기간)·O-06(테마) 확정 필요 | 5 |
| C-18 | 탭이 가려지면 내보내기 정지 (rAF) | 중간 — UX | 현재: 타임아웃 제외 + 안내 문구 (결과는 동일). Phase 5 에서 시작 전 안내·진행률 옆 고지 설계 | 5 |
| C-19 | 내보내기 소요 ≈20 ms/프레임 (15 s ≈9 s · 60 s ≈29 s, 해상도 무관) | 낮음 | Phase 5 에서 시작 전 예상 시간 표시 | 5 |
| C-20 | 내보내기 중 미리보기 지도 인스턴스도 살아 있음 → WebGL 컨텍스트 2개 동시 (1080 + 480) | 낮음 (데스크톱) · 모바일은 C-9 | Phase 5 에서 내보내기 동안 미리보기 지도 해제·복원 검토 | 5 |
| C-21 | 가려진 탭에서 누른 취소는 다시 보일 때 반영 (abort 검사는 프레임 루프 선두, idle 대기는 보이는 시간만 셈) | 낮음 — 가려진 탭에선 버튼을 누를 수 없음 | Phase 5 UX 메모 (필요하면 idle 대기에 AbortSignal 연결) | 5 |
| ~~C-5~~ ✅ | Phase 0 산출물 미커밋 | — | main `1d76d3b` 로 커밋 (2026-09-23) | 1 |
| C-7 | 라벨 서체 굵기·크기·점 표기가 레퍼런스(래스터 추정)와 약간 다름 | 낮음 | 라벨 배율 k 1.35 · 대문자 경계 조정 적용(D-27). 잔여는 수용 — 필요 시 Phase 5 이후 | 5+ |
| ~~C-8~~ ✅ | 지도 출력이 카메라 이력에 의존 | — | 내보내기 2회(새 프로필) 396/396 픽셀 동일, 탭 가림 후 재개도 동일 (Phase 4) | 4 |
| C-9 | Firefox·Safari·모바일 인코딩/메모리 미검증 (장비 없음) | 중간 | O-02 결정에 따라 기능 감지 안내. 가능하면 실기기 확인 | 4 · 5 |
| ~~C-10~~ ✅ | 480×854 H.264 레벨 | — | 레벨 표로 명시 · 실제 avcC/SPS = 3.0/3.1/4.0 확인. 자동 선택 파일도 실제로는 3.0 이었음 (요청 문자열만 2.2) | 4 |
| C-11 | 번들 크기 — 메인 JS 1.19 MB(MapLibre + Mediabunny) + 지도 워커 498 kB, 폰트 서브셋 248개 4.1 MB(쓰는 조각만 로드) | 낮음 | Phase 5 에서 파일 선택 후 지연 로딩 검토 | 5 |
| ~~C-6~~ ✅ | 아웃트로 마커 소멸 | — | 알파 페이드 f361→f364 구현, f394 마커 없음 레퍼런스 일치 | 3 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-09-23 | Phase 1 종료 — O-01→D-19, O-02→D-20 사용자 확정, `feat/phase-1` → `main` 머지 |
| 2026-09-23 | Phase 2 종료 — O-04→D-22 사용자 확정, `feat/phase-2` → `main` 머지 |
| 2026-09-23 | Phase 4 — MP4 내보내기 파이프라인(D-31), MP4 재측정으로 진행 끝 f359·마커 축소 교정, 탭 가림 대응. C-8·C-10 해소, C-18~C-21 추가 |
| 2026-09-23 | Phase 3 — 엔진·지도 계층·미리보기 구현, 기준 프레임 6회 대조로 튜닝·판정(D-23), D-24~D-30. C-2·C-3·C-6·C-13 해소, C-15~C-17 추가 |
| 2026-09-23 | Phase 2 — 파서·정규화·워커 구현(TDD, 오라클 12/12), O-04 실측, 픽스처 생성기 스파이크 시각 버그 수정. C-4 해소, C-12~C-14 추가 |
| 2026-09-23 | Phase 1 — 스캐폴딩·워크플로·스파이크 A/B 완료, O-01·O-02 확정 대기. Carry-over C-5 해소, C-7~C-11 추가 |
| 2026-09-23 | Q1~Q4 사용자 결정 — 전부 (a) 채택, `CLAUDE.md` v1.2 (D-16~D-18 · H-2) 반영 |
| 2026-09-23 | 생성 — Phase 0 완료 기록, Phase 1~2 Task, 질문 Q1~Q3, Carry-over C-1~C-6 |
