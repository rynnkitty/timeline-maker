# ROADMAP — TimelineMaker

> 세션 간 연속성의 SSOT (`CLAUDE.md` §1). Task 완료마다 **현황 · 다음 명령 · 미해결·Carry-over** 를 갱신한다.
> Phase 절차·DoD 원문은 `.claude/agents/timeline-maker.md` §3. 규칙·결정은 `CLAUDE.md`.

## 현황

| Phase | 이름 | 상태 | 완료일 |
|---|---|---|---|
| 0 | 사양 고정 & 스키마 확인 | ✅ 완료 (main `1d76d3b`) | 2026-09-23 |
| 1 | 스캐폴딩 + 기술 스파이크 | 🟡 **O-01·O-02 확정 대기** — 나머지 DoD 충족 (`feat/phase-1`) | |
| 2 | 파서 & 정규화 (TDD) | ⬜ | |
| 3 | 애니메이션 엔진 | ⬜ | |
| 4 | MP4 내보내기 | ⬜ | |
| 5 | UI/UX | ⬜ | |
| 6 | 배포 | ⬜ | |

## 다음 세션 명령

```
(사용자) O-01·O-02 를 docs/spike-results.md §4 에서 결정 → CLAUDE.md §3 에 기록
timeline-maker 에이전트로 Phase 1 마무리(O-01·O-02 반영, feat/phase-1 → main 머지 여부 확인) 후
모드 A · Phase 2 (파서 & 정규화, TDD)를 진행하라. 오라클은 tests/fixtures/expected.json, 결정은 D-16~D-18.
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
- [ ] 1-7 **O-01 · O-02 사용자 확정** → `CLAUDE.md` §3 (권장안 `docs/spike-results.md` §4)

DoD: dev·build·test 통과 ✅ · 스파이크 A/B 산출물과 비교표 ✅ · 스파이크 코드 `spikes/` 격리 ✅ · **O-01·O-02 확정 ⏳**

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
| ~~C-5~~ ✅ | Phase 0 산출물 미커밋 | — | main `1d76d3b` 로 커밋 (2026-09-23) | 1 |
| C-7 | 레퍼런스 라벨이 CARTO GL 기본보다 ≈1.35배 크고 대도시 대문자 (래스터 추정) | 중간 — 룩앤필 | 컨테이너 축소 + `pixelRatio` 확대, 필요 시 text-size/transform 오버라이드 — 기준 프레임 대조 튜닝 (`docs/spike-results.md` §1.6) | 3 |
| C-8 | 지도 출력이 카메라 이력에 의존 (다른 뷰 경유 시 z7.7 에서 ≈1.4% 픽셀 차) — 미리보기 스크럽과 내보내기의 라벨 배치가 다를 수 있음 | 중간 — H-6 해석 | 내보내기는 새 인스턴스·프레임 0 부터 순차(재생 16/16 동일 확인). 미리보기 차이는 허용할지 Phase 3 에서 판단 | 3 · 4 |
| C-9 | Firefox·Safari·모바일 인코딩/메모리 미검증 (장비 없음) | 중간 | O-02 결정에 따라 기능 감지 안내. 가능하면 실기기 확인 | 4 · 5 |
| C-10 | 480×854 자동 H.264 레벨 L2.2 (규격 미달) | 낮음 | Phase 4 에서 `fullCodecString: 'avc1.64001e'` 명시 (검증 완료) | 4 |
| C-11 | 지도 번들 크기 (map 청크 1.0 MB / gzip 276 kB + 워커 510 kB) | 낮음 | Phase 5 코드 분할·지연 로딩 | 5 |
| C-6 | 아웃트로 중 마커 소멸 방식(페이드 vs 축소) 미판별 | 낮음 | 코어 면적 감소만 확인(f361~f364). Phase 3 에서 페이드로 구현 후 대조 | 3 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-09-23 | Phase 1 — 스캐폴딩·워크플로·스파이크 A/B 완료, O-01·O-02 확정 대기. Carry-over C-5 해소, C-7~C-11 추가 |
| 2026-09-23 | Q1~Q4 사용자 결정 — 전부 (a) 채택, `CLAUDE.md` v1.2 (D-16~D-18 · H-2) 반영 |
| 2026-09-23 | 생성 — Phase 0 완료 기록, Phase 1~2 Task, 질문 Q1~Q3, Carry-over C-1~C-6 |
