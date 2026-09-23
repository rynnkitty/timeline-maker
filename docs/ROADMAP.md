# ROADMAP — TimelineMaker

> 세션 간 연속성의 SSOT (`CLAUDE.md` §1). Task 완료마다 **현황 · 다음 명령 · 미해결·Carry-over** 를 갱신한다.
> Phase 절차·DoD 원문은 `.claude/agents/timeline-maker.md` §3. 규칙·결정은 `CLAUDE.md`.

## 현황

| Phase | 이름 | 상태 | 완료일 |
|---|---|---|---|
| 0 | 사양 고정 & 스키마 확인 | ✅ 완료 (커밋은 Phase 1 `git init` 후) | 2026-09-23 |
| 1 | 스캐폴딩 + 기술 스파이크 | ⏭ 다음 | |
| 2 | 파서 & 정규화 (TDD) | ⬜ | |
| 3 | 애니메이션 엔진 | ⬜ | |
| 4 | MP4 내보내기 | ⬜ | |
| 5 | UI/UX | ⬜ | |
| 6 | 배포 | ⬜ | |

## 다음 세션 명령

```
timeline-maker 에이전트로 모드 A · Phase 1 (스캐폴딩 + 기술 스파이크)을 진행하라.
먼저 docs/ROADMAP.md 의 "미해결·Carry-over" 와 "질문" 을 확인하고, Phase 0 산출물을 첫 커밋에 포함하라
(git init 직후 H-2 점검: git status 에 ref/·docs/reference/·Timeline*.json 이 보이지 않아야 한다).
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

- [ ] 1-1 `git init` · `.gitignore` 재확인(`git status` 로 ref/·docs/reference/ 미표시 확인) · Phase 0 산출물 첫 커밋
- [ ] 1-2 Vite + TS · Vitest · ESLint/Prettier(최소) · `npm run dev/build/test`
- [ ] 1-3 `package.json` scripts 에 `fixtures: node scripts/make-fixtures.ts` 등록 (Node ≥22.18 `engines` 명시)
- [ ] 1-4 `.github/workflows/deploy.yml` (actions major 버전 공식 문서 확인 — H-4)
- [ ] 1-5 스파이크 A (지도): CARTO 벡터 Positron vs OpenFreeMap Positron — 1080×1920 오프스크린, 타일 로딩 대기, 캡처 방식(`preserveDrawingBuffer` vs render 이벤트), CORS·약관·라벨·톤 비교 → `spikes/map/`
- [ ] 1-6 스파이크 B (인코딩): Mediabunny H.264 2초 → `python scripts/video-check.py probe <out> --expect 480x854@24:48` → `docs/browser-support.md`
- [ ] 1-7 O-01 · O-02 확정 요청 → `CLAUDE.md` §3

## Phase 2 — 파서 & 정규화 (TDD)

- [ ] 2-1 `detectFormat` (에러 코드는 `expected.json` `errorCodes` 기준)
- [ ] 2-2 `parseAndroid` / `parseIos` → `TrackPoint[]`
- [ ] 2-3 정제: 범위 검사 · 동일 타임스탬프 처리(Q2) · 속도 이상치(1,000 km/h) · 정렬
- [ ] 2-4 파생: haversine 누적(D-14, R = 6371.0088 km) · 현지 월(ISO 접미 오프셋) · 기간 필터
- [ ] 2-5 Web Worker 파싱 + 브라우저 실측(54MB) → O-04 확정
- [ ] 2-6 실파일 1회 스모크 (요약 통계만)

## Phase 3 — 애니메이션 엔진 · Phase 4 — MP4 내보내기 · Phase 5 — UI/UX · Phase 6 — 배포

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
| C-2 | 카메라 t=0 광역 줌의 원인 불명 (줌 상한 클램프 vs 선행/첫 창) | 중간 — 초반 몇 초의 룩앤필 | reference-spec K1 — 두 가설로 렌더해 f000·f034 와 대조 | 3 |
| C-3 | 트레일 팔레트(S7·S8) 재측정 안 함 | 낮음 | Phase 3 튜닝 시 기준 프레임에서 재측정 | 3 |
| C-4 | 브라우저 메모리 (Node 대리 지표만 있음: parse 125ms · heap +102MB) | 중간 — 수년치 파일 | Phase 2 에서 Worker 실측 → O-04 확정. rawSignals 는 파싱 직후 참조 해제 | 2 |
| C-5 | Phase 0 산출물 미커밋 (git 미초기화) | 낮음 | Phase 1-1 에서 첫 커밋. 커밋 전 H-2 점검 | 1 |
| C-6 | 아웃트로 중 마커 소멸 방식(페이드 vs 축소) 미판별 | 낮음 | 코어 면적 감소만 확인(f361~f364). Phase 3 에서 페이드로 구현 후 대조 | 3 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-09-23 | Q1~Q4 사용자 결정 — 전부 (a) 채택, `CLAUDE.md` v1.2 (D-16~D-18 · H-2) 반영 |
| 2026-09-23 | 생성 — Phase 0 완료 기록, Phase 1~2 Task, 질문 Q1~Q3, Carry-over C-1~C-6 |
