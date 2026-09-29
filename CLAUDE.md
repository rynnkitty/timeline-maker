# TimelineMaker — 프로젝트 규칙 (Root)

> [!info] 본 문서의 위상
> 이 파일은 **결정·규칙의 단일 진실 공급원(SSOT)** 이다. 실행 절차는 [`.claude/agents/timeline-maker.md`](.claude/agents/timeline-maker.md) 에 있으며, 두 문서는 서로의 내용을 **중복 기재하지 않는다** (같은 사실을 두 곳에 두면 반드시 어긋난다 — `ref/CLAUDE.md` v2.3 의 교훈).
>
> 본 문서의 §3 결정 · §5 하드 룰(개인정보 H-1·H-2·H-5 포함)을 바꾸려면 **사용자 명시 승인** 후 본 문서를 먼저 갱신한다.

---

## 0. 프로젝트 정체성

| 항목 | 값 |
|---|---|
| 산출물 | 구글 타임라인 `Timeline.json` 을 올리면 **이동 경로 애니메이션 MP4**(레퍼런스: `ref/Output_semple.mp4`)를 만들어 주는 정적 웹사이트 |
| 실행 환경 | 100% 브라우저 (서버 없음) — Vite + TypeScript |
| 호스팅 | GitHub Pages (공개 저장소 `rynnkitty/timeline-maker`, GitHub Actions 배포) — **라이브 https://rynnkitty.github.io/timeline-maker/ (2026-09-29)** |
| 팀 | 1인 + Claude Code |
| 시작일 | 2026-09-23 |

---

## 1. 시작 체크리스트

- [ ] **`docs/ROADMAP.md`** 를 읽어 현재 Phase·완료 항목·다음 Task·`미해결·Carry-over` 확인 (최우선 · 없으면 Phase 0 이다)
- [ ] §4 미결 중 이번 작업을 막는 항목이 있는지 확인 — 있으면 먼저 확정 (`AskUserQuestion`)
- [ ] 이번 작업 관련 `feedback` 메모리 **본문** 펼쳐 읽기 (`MEMORY.md` 인덱스 한 줄로 판단 금지)
- [ ] 작업이 2단계 이상이면 Task로 분해

> ROADMAP.md 는 세션 간 연속성의 SSOT 다. Task 완료 후 현황·다음 명령·Carry-over 를 반드시 갱신한다.

---

## 2. 로컬 개발 환경 (2026-09-23 실측)

| 도구 | 상태 |
|---|---|
| OS | Windows 11 · 셸: PowerShell 5.1 (주) / Git Bash |
| Node.js | v22.19.0 |
| Python | 3.13 + **OpenCV 4.12** (영상 프레임 추출·검증에 사용) |
| git / gh | git 2.50.1 · gh 2.90.0 — gh 로그인 `rynnkitty`(2026-09-29, 스코프 `repo`·`gist`·`read:org` — **`workflow` 없음**: 워크플로 파일을 바꾸는 push 는 거부될 수 있다 → `! gh auth refresh -h github.com -s workflow`). 저장소 로컬 `user.email` = noreply (D-35) |
| ffmpeg | **없음** — 영상 검증은 Python+OpenCV 로 한다 |
| 브라우저 | Chrome 설치됨 (`claude-in-chrome` 로 UI 검증 가능) |

---

## 3. 확정 결정 (D-xx)

| ID | 결정 | 근거·출처 |
|---|---|---|
| **D-01** | 렌더링·인코딩 **100% 브라우저**: Canvas 합성 → WebCodecs(H.264) → MP4. 서버 코드 없음 | 인터뷰 R1 (2026-09-23) · GitHub Pages 정적 호스팅 제약 |
| **D-02** | 레퍼런스 사양은 **영상 역설계**로 고정한다 (원본 제작 스크립트 없음). 목표는 **룩앤필 동등**이지 픽셀 동등이 아니다. 측정값은 에이전트 §2 | 인터뷰 R1 |
| **D-03** | 입력 포맷: **Android 기기 내보내기**(객체 루트 + `semanticSegments`) · **iOS 기기 내보내기**(배열 루트) 둘 다 지원. 구 Takeout(`Records.json`·`latitudeE7`)은 **범위 외** — 감지 시 안내 메시지만. ⚠ 실파일은 **Android 만 확보** — iOS 경로는 공개 문서 기반·**실파일 미검증** | 인터뷰 R1 · 사용자 확인(2026-09-23: Android 추출) · [time-mile 필드 레퍼런스](https://time-mile.com/guides/timeline-json-format/) |
| **D-04** | 출력: **9:16 고정**, 해상도 480×854(샘플 동일·기본) / 720×1280 / 1080×1920 선택, **24fps**, H.264 MP4, **오디오 없음** | 인터뷰 R2 · 샘플 실측 |
| **D-05** | 길이: 애니메이션 **15 / 30 / 60초** 선택 + **아웃트로 1.5초 고정**(전체 경로 fit 줌아웃 ≈1.0s + 정지 ≈0.5s). "15초" = 총 16.5초 = 샘플과 동일. 기간이 얼마든 선택 길이에 **선형 압축** | 인터뷰 R2 · 샘플 실측(15.0s 이후 누적 km 고정) |
| **D-06** | 사용자 조절 항목: **이름/제목**, **기간(시작·종료일)**, **색상 테마**(기본 = 샘플 녹색), **실시간 미리보기** | 인터뷰 R2 |
| **D-07** | 스택: **Vite + TypeScript (프레임워크 없음)** · 테스트 **Vitest** | 인터뷰 R3 |
| **D-08** | 배포: 공개 저장소 **`timeline-maker`** · **GitHub Actions → Pages** · Vite `base = '/timeline-maker/'` | 인터뷰 R1·R3 |
| **D-09** | UI 언어: **한국어 전용**. 사용자 노출 문자열은 `src/i18n/ko.ts` 한 파일에 모은다 (다국어 여지만 남김) | 인터뷰 R3 |
| **D-10** | 지원 브라우저: **데스크톱 Chrome/Edge 기준 검증**. Safari·Firefox·모바일은 best-effort — **기능 감지**(`VideoEncoder.isConfigSupported`) 후 미지원 시 안내 | 인터뷰 R3 |
| **D-11** | 샘플 데이터: 실파일은 **`ref/private/`**(gitignore)에 두고 **스키마 확인용으로만** 사용. 테스트·데모는 **가짜 좌표 합성 픽스처**(`tests/fixtures/`)만 커밋 | 인터뷰 R2 |
| **D-12** | MP4 muxer: **Mediabunny** (`mp4-muxer` 는 deprecated — Mediabunny 가 후속). 설치 시 버전 고정 | Claude 제안 → **사용자 승인 2026-09-23** · [Mediabunny](https://mediabunny.dev/guide/introduction) · [mp4-muxer 폐기 공지](https://vanilagy.github.io/mp4-muxer/) |
| **D-13** | 지도 렌더링: **MapLibre GL JS (벡터 타일)**. CARTO **래스터** 타일은 API 키 필수 + 은퇴 중이라 배제. 스타일은 Positron 계열(샘플과 동일 톤) | Claude 제안 → **사용자 승인 2026-09-23** · [CARTO Basemaps FAQ](https://docs.carto.com/faqs/carto-basemaps) (2026-09-23 확인) |
| **D-14** | 누적 거리 = 정규화·이상치 제거된 트랙 포인트의 **haversine 누적**(그려지는 선과 일치). `activity.distanceMeters` 와 `timelinePath` 를 **합산하지 않는다**(이중 계산). 계산 대상 트랙은 D-16 | Claude 제안 → **사용자 승인 2026-09-23** · time-mile 레퍼런스 |
| **D-15** | Git: 작업은 `feat/<phase-or-topic>` 단기 브랜치 → `main` 머지 = **배포**. 커밋은 Claude 가 로컬 실행 가능, **push·저장소 생성·Pages/Settings 변경은 매번 사용자 승인** (§5 H-7) | Claude 제안 → **사용자 승인 2026-09-23** (로컬 커밋 상시 허용) · 1인 프로젝트 — `ref/CLAUDE.md` 의 3-tier/MR 체계는 채택하지 않음 |
| **D-16** | 트랙(트레일·거리·카메라) 좌표 소스 = **`timelinePath` 포인트만**. visit·activity 좌표는 병합하지 않는다 (시간 겹침으로 같은 시각 두 위치 → 지그재그 방지) | 사용자 결정 2026-09-23 (ROADMAP Q1) · 실측: 레퍼런스 km 대비 −1.3% |
| **D-17** | 같은 타임스탬프·다른 좌표 쌍은 **파일 순서상 첫 점만 유지** (속도 필터의 dt=0 오판 방지) | 사용자 결정 2026-09-23 (ROADMAP Q2) · 실파일 1,539쌍 |
| **D-18** | 빈 배열 `[]` 입력 = **`NO_DATA`**("데이터 없음" 안내). `UNKNOWN_FORMAT` 아님 | 사용자 결정 2026-09-23 (ROADMAP Q3) |
| **D-19** | 타일 제공자: **CARTO 벡터 Positron 기본 + OpenFreeMap Positron 예비**. 제공자는 인터페이스 뒤에 두어 설정 한 곳으로 전환 가능하게 한다 (CARTO 키 요구·장애 대비). attribution 은 활성 제공자에 맞춰 바뀐다 (H-3) | 사용자 결정 2026-09-23 (O-01) · 근거 `docs/spike-results.md` — CARTO 벡터가 레퍼런스와 색·라벨·attribution 일치 |
| **D-20** | H.264 인코딩 미지원 브라우저: **폴백 없이 안내만** ("Chrome 또는 Edge 를 사용해 주세요"). 출력은 MP4 단일 사양 유지. 판정은 `VideoEncoder.isConfigSupported` 기능 감지 (D-10) | 사용자 결정 2026-09-23 (O-02) · Chrome/Edge 153 에서 3개 해상도 실측 통과 |
| **D-21** | GitHub 계정 **`rynnkitty`** → 저장소 `rynnkitty/timeline-maker`, 배포 URL **`https://rynnkitty.github.io/timeline-maker/`**. 인증은 Phase 6 에서 사용자가 `! gh auth login`(브라우저 인증)으로 직접 수행 — **토큰·자격 증명은 파일·커밋·로그·에이전트 프롬프트에 절대 기록하지 않는다** | 사용자 제공 2026-09-23 (O-03) |
| **D-22** | 대용량 입력: **Web Worker + `JSON.parse` 유지**, 스트리밍 파서 없음. 상한 ≈ **500MB**(V8 문자열 한계) 초과 시 `FILE_TOO_LARGE` 안내. Phase 5 에서 **읽기 전 파일 크기 사전 검사** + 큰 파일(예: 200MB+) 경고 추가 | 사용자 결정 2026-09-23 (O-04) · 실측 `docs/browser-support.md` §4 — 실파일 54MB 파싱 ≈0.2s·워커 최대 ≈85MB, 합성 400MB 5.5s 동작, 600MB 는 `File.text()` 가 빈 문자열 반환 |
| **D-23** | **Phase 3~6 위임 진행**: 사용자가 최종 완성까지 **승인 없이 권고안(Recommended)대로** 진행하도록 위임. 범위: (1) 남은 O-xx 는 권고안으로 확정·기록, (2) Phase 3 룩앤필 확인은 비교 이미지를 남기고 에이전트 판단으로 통과, (3) feat 브랜치 → main 로컬 머지, (4) Phase 6 의 **`rynnkitty/timeline-maker` 저장소 생성·push·Pages 설정**(H-7 의 해당 작업 사전 승인). 범위 밖(다른 저장소·계정 설정·자격 증명 처리·삭제/force push)은 여전히 승인 필요. GitHub 인증(`gh auth login`)은 사용자 작업이며 미완료면 Phase 6 에서 멈추고 보고 | 사용자 지시 2026-09-23 |
| **D-24** | **진행 축 = 누적 거리**: D-05 의 "선택 길이에 선형 압축" 을 **시간이 아니라 누적 이동 거리(km)에 선형**으로 구현한다 (이동 0 이면 점 순번). km 카운터가 일정 속도로 늘고, 이동 없는 기간은 빠르게 지나간다. 진행은 애니메이션 **마지막 프레임(15초 → f359)** 에서 끝나고 f360 은 정지 (Phase 4 MP4 재측정: 레퍼런스 km 고정 f360·마커 소멸 f364 와 프레임 단위 일치). 승인된 D-05 의 해석을 구체화한 결정 | D-23 위임, 권고안 채택 (2026-09-23 Phase 3) · 레퍼런스 실측: 초당 ≈772 km 일정, 거리 선형 가설이 월 10/10·km 오차 1.7% (시간 선형 6/10·10.4%) — `docs/phase3-lookfeel.md` §1 · **오케스트레이터 검토 수용 2026-09-23 — 최종 보고에서 사용자에게 고지** |
| **D-25** | **카메라 모델**: 최근 창 bbox(과거 1.5 s·선행 0.5 s, 영상초·진행 축 기준)를 삼각형 커널(K=12)로 평활 → 헤드를 부드럽게 합쳐 fit. 패딩 상 110·하 40·좌우 30 (480 기준), 줌 부드러운 상한 9, 시작 이전 = 첫 점 화면 중앙·z7.7, 아웃트로 = 전체 경로 fit(여백 확대) ease-out f361→f381 | D-23 위임, 권고안 채택 · 기준 프레임 대조 (C-2 해소: f000 줌 7.66·마커 중앙) — `docs/adrs/0001-engine-map-boundary.md` |
| **D-26** | **트레일 모델**: 나이 = 헤드 대비 영상초(진행 축). 불투명 색·폭 램프 — 0~0.15 s 진한 녹색 rgb(30,118,69)·6 px → 1.2 s 에 민트 rgb(218,247,228)·2 px → **≈3 s 에 사라짐**(에이전트 §5 "완전히 사라지지 않음" 을 레퍼런스 실측으로 대체). 아웃트로는 전 구간 rgb(95,155,122)·2.5 px 균일로 크로스페이드. 마커 = 검정 코어 r5.5 + 녹색 링 r10, 아웃트로에서 **어두운 채로 축소**(반지름 1−p⁴, f361→f364 — 레퍼런스 코어 면적 93→86→80→56→0) | D-23 위임, 권고안 채택 · 레퍼런스 대조: 약 1.4 s 무렵 장거리 이동이 f070(나이 ≈1.5 s)에는 옅게 보이고 f103(나이 ≈2.9 s, 해당 지역이 화면 안)에는 없음 → ≈3 s 소멸. 녹색 픽셀 히스토그램 대조 — `docs/phase3-lookfeel.md` §3.1 · **오케스트레이터 검토 수용 2026-09-23 — 최종 보고에서 사용자에게 고지** |
| **D-27** | **지도 렌더**: `setNow` 대신 `fadeDuration 0` + 스타일 `transition 0` 로 시간 의존 제거. 라벨 배율 k≈1.35 (컨테이너 480/k + pixelRatio + 줌 −log2 k). CARTO 라벨 `coalesce(name_en, name)` · 대도시 대문자 경계 조정 | D-23 위임, 권고안 채택 · 투영 정합 ≤0.42 px 실측 · `docs/spike-results.md` §1.6 |
| **D-28** | **미리보기와 내보내기의 지도 인스턴스**: 내보내기 = 새 인스턴스·프레임 0 부터 순차(픽셀 결정론). 미리보기 = 인스턴스 재사용 — 스크럽 시 라벨 배치가 내보내기와 미세하게 다를 수 있음을 허용 (C-8). 미리보기도 프레임 격자에 스냅 | D-23 위임, 권고안 채택 · Phase 1 결정론 실측 (재생 16/16 동일, 경유 복귀 시 ≈1.4% 차) |
| **D-29** | **HUD·폰트**: Noto Sans KR 400/700 **자체 호스팅**(@fontsource, OFL — 외부 폰트 요청 없음), 첫 렌더 전 실제 문자열로 로드 대기. 카드 rgb(255,250,252) α0.74, 제목 700 20 px rgb(20,13,16) y39, 부제 400 12 px rgb(95,87,91) y67, attribution 400 9 px 우측 471·y844 (480 기준). 숫자 포맷은 로케일 비의존 | D-23 위임, 권고안 채택 · 레퍼런스 재측정 (카드 색 ±3, 텍스트 잉크 박스 일치) |
| **D-30** | **워커 → 메인 결과 전달**: 점 배열 구조화 복제 대신 열 배열 `PackedTrack`(Float64Array·Int16Array) **transfer** (C-13) | D-23 위임, 권고안 채택 · 점당 ≈90 B 복제 비용 실측 (`docs/browser-support.md` §4) |
| **D-31** | **MP4 내보내기 파이프라인**: 새 지도 인스턴스에서 프레임 0 부터 순차 → 프레임마다 타일 `idle` 대기 → `CanvasSource.add` await(백프레셔) → `source.close()` → `finalize`. 취소 = AbortSignal → `output.cancel()` + 지도 제거. H.264 High · **레벨은 Table A-1 로 계산해 명시**(480→3.0·720→3.1·1080→4.0), `Quality('high')`, 키프레임 기본 2 s, `fastStart: 'in-memory'`. 파일명 = 사용자 입력 제목 기반(금지 문자·예약어·80자). 가려진 탭에서는 지도 렌더가 멈추므로 **대기 타임아웃은 보이는 시간만** 세고 안내 문구를 띄운다 | D-23 위임, 권고안 채택 (Phase 4) · 실측 `docs/browser-support.md` §5 — 3 해상도·3 길이 6/6 PASS, 2회 내보내기 396/396 동일, 탭 가림 후 재개도 동일 |
| **D-32** | **기본 기간·제목·테마·iOS 표기** (O-05 · O-06 · O-07 확정): 기본 기간 = 데이터의 **최신 연도 1월 1일 ~ 마지막 기록**(현지 날짜), 사용자가 시작·종료일 변경 가능. 기간이 해를 넘으면 제목 `2025–2026년 {이름}의 타임라인`(en dash). 테마 프리셋 = **숲(기본·레퍼런스 녹색)·바다·노을·제비꽃·먹** 5종 — 각 테마는 최근(진함) < 아웃트로 < old(아주 옅음) 명도 관계 유지. iOS 파일은 **"베타" 안내 문구** 표시 (합성 픽스처 테스트 통과 · 실파일 미검증) | D-23 위임, 권고안 채택 (Phase 5) · O-05/O-06/O-07 권장안 그대로 |
| **D-33** | **UI·입력 제한·CSP**: 영상 프레임이 드롭 영역 → 미리보기 → 내보내기 실시간 화면을 겸한다. 이름 최대 20자(제어문자 제거), 파일은 **읽기 전** 크기 검사 — 512 MiB 초과 거부(`FILE_TOO_LARGE`)·200 MB 이상 확인 후 진행(D-22). 내보내는 동안 미리보기 지도 해제(WebGL 컨텍스트 1개). **CSP 는 프로덕션 빌드에만 메타 태그로 주입**(개발 서버 HMR 호환) — `connect-src`·`img-src` = self + CARTO + OpenFreeMap, `worker-src` self, `font-src` self, `object-src` none. OG 이미지·빈 화면 배경은 **합성 픽스처 렌더만** | D-23 위임, 권고안 채택 (Phase 5) · 프로덕션 빌드 검증: CSP 위반 0·페이지 오류 0·외부 호스트 = CARTO 뿐 (`docs/browser-support.md` §6) |
| **D-34** | **라이선스**: 코드 = **MIT** (`LICENSE`, 저작권자 `rynnkitty`). 서드파티는 각자 라이선스 유지 — MapLibre GL JS BSD-3-Clause · Mediabunny MPL-2.0(수정 없이 사용) · Noto Sans KR OFL-1.1 원문을 `public/licenses/` 로 배포본에 동봉. 지도 데이터 © OpenStreetMap contributors (ODbL), 타일 © CARTO / 예비 OpenMapTiles·OpenFreeMap | D-23 위임, 권고안 채택 (Phase 6) · 기존 라이선스 미지정 |
| **D-35** | **커밋 작성자 = GitHub noreply** `29746092+rynnkitty@users.noreply.github.com` (저장소 로컬 `user.email`). 첫 push 전에 `git filter-repo` 로 전체 이력 재작성(mailmap + 도메인 문자열 치환). 재작성 전 전체 bundle 백업 보관 | 사용자 결정 2026-09-28 (ROADMAP C-23 (b)) |
| ~~**D-36**~~ | ~~Claude 개발 설정 비공개~~ → **D-37 로 번복 (2026-09-29)**. 2026-09-28 에 `CLAUDE.md`·`.claude/` 를 이력에서 제거·gitignore 했던 결정 | 사용자 결정 2026-09-28 · 번복 2026-09-29 |
| **D-37** | **Claude 개발 설정 공개**: `CLAUDE.md`·`.claude/`(에이전트·스킬·agent-memory)를 공개 저장소에 커밋한다 — 유사 에이전트 제작 참고용. 제외는 `.claude/settings.local.json`·`.claude/scheduled_tasks.lock` 뿐(gitignore·privacy-check). 2026-09-29 이전 이력에는 두 경로가 없다(D-35 재작성). **공개 문서이므로 실명·실좌표·실데이터 세부 집계·자격 증명·타 사내 프로젝트 정보를 적지 않는다** (H-2) | 사용자 결정 2026-09-29 · 공개 전 스캔: 실명·회사명·토큰·좌표 0건 |

---

## 4. 미결 (O-xx) — 확정 시 §3 으로 이동

| ID | 질문 | 확정 시점 | 현재 권장안 |
|---|---|---|---|
| — | 현재 미결 없음 (O-01~O-07 모두 §3 으로 이동, 2026-09-23) | — | — |

---

## 5. 하드 룰 (H-xx)

| ID | 규칙 |
|---|---|
| **H-1** | **위치 데이터는 브라우저 밖으로 나가지 않는다.** 좌표·파일 내용·파생 통계를 담은 `fetch`/XHR/beacon/분석 스크립트 금지. 외부 요청은 **지도 타일·폰트·정적 자산**뿐. CSP `connect-src` 를 self + 타일 제공자로 제한 |
| **H-2** | **실제 위치 데이터와 사내 자료를 커밋하지 않는다.** `ref/` 전체(샘플 영상에는 실존 인물의 이동 궤적이 있고, `ref/CLAUDE.md` 는 타 사내 프로젝트 문서)·`.claude/settings.local.json`·루트/임의 위치의 `Timeline*.json`·`Records.json` 은 gitignore. `.claude/` 에는 이 프로젝트용 에이전트·스킬만 둔다(타 프로젝트 자료는 2026-09-23 삭제됨 — 새로 들여올 때 내부 정보 여부 확인). **`CLAUDE.md`·`.claude/` 는 공개 문서다(D-37) — 여기에도 실명·실좌표·실데이터 세부 집계·자격 증명을 적지 않는다.** 커밋 전 staged 파일을 **숫자 좌표 패턴**(`\d{1,3}\.\d{4,}°` · `geo:-?\d+\.\d{4,}`)으로 검사하고, `tests/fixtures/`·`scripts/make-fixtures.ts`(가짜 좌표) 외에서 걸리면 중단 (스키마 설명 문서의 키워드는 허용 — 2026-09-23 사용자 결정, ROADMAP Q4) |
| **H-3** | 지도 **attribution(`© OpenStreetMap contributors © <제공자>`)을 모든 출력 프레임에 굽는다** — 미리보기에도 표시. 라이선스 요구사항이며 샘플에도 있다 |
| **H-4** | **라이브러리 API를 추측하지 않는다** — MapLibre GL · Mediabunny · WebCodecs · Vite 설정은 공식 문서로 확인 (`source-driven-development`) |
| **H-5** | **개인정보 안내 문구와 실제 동작을 일치시킨다.** "파일은 업로드되지 않습니다"와 함께 **"지도 타일 요청 시 보이는 지역 정보가 타일 제공자에게 전달됩니다"** 를 명시한다. 동작이 바뀌면 같은 변경 안에서 문구를 고친다 |
| **H-6** | **렌더 결정론**: 내보내기 프레임은 벽시계가 아니라 **프레임 인덱스**(`t = i / fps`)로 계산한다. 미리보기와 내보내기는 **같은 `renderFrame(t)`** 를 쓴다. 타일 로딩 미완료 프레임을 인코딩하지 않는다 |
| **H-7** | **외부로 나가는 작업은 매번 사용자 승인**: `git push`, `gh repo create`, 저장소 Settings/Pages 변경, 공개 URL 게시. 한 번의 승인은 그 작업에만 유효. *예외: D-23 이 정한 범위(2026-09-23 위임)* |
| **H-8** | Phase **DoD 미충족 상태로 다음 Phase 진입 금지**. 미충족 항목은 ROADMAP `미해결·Carry-over` 에 기록 |

---

## 6. Claude Code 워크플로

### 6.1 Plan → Code → Review
1. **Plan**: `writing-plans` 또는 Task 분해. 2개 파일 이상 → `incremental-implementation`
2. **Code**: 로직(파서·거리·카메라·타이밍)은 `test-driven-development`
3. **Review**: `code-review-and-quality` 자체 점검 → 종료 전 **`advisor` 1회 (필수)**

### 6.2 스킬 매트릭스

| 상황 | 스킬 |
|---|---|
| 라이브러리/브라우저 API 사용 | `source-driven-development` |
| 파서·알고리즘 구현 | `test-driven-development` · `karpathy-guidelines` |
| UI 설계 | `frontend-design:frontend-design` |
| 파일 입력·CSP·외부 요청 | `security-and-hardening` |
| 렌더/인코딩 속도·메모리 | `performance-optimization` |
| 버그 | `debugging-and-error-recovery` |
| 결정 기록 | `documentation-and-adrs` (`docs/adrs/`) |
| 브라우저 실동작 확인 | `run` · `claude-in-chrome` |

> 스킬·에이전트가 목록에 없으면 `.claude/skills/<이름>/SKILL.md` · `.claude/agents/<이름>.md` 를 파일로 직접 읽어 적용한다.

### 6.3 모호성 처리 — `AskUserQuestion` 우선 (하드 룰)
- 해석이 2개 이상이거나 §3·§4 에 없는 영역이면 임의 판단하지 않고 묻는다
- 묻기 전 **읽기 전용 조사(≤1분)** 로 자명한 부분은 스스로 해결
- 같은 결정 흐름의 질문 **2~4개를 한 호출로**, 권장안에 `(Recommended)`
- 답변 후 결정을 요약하고 §3 에 기록
- 예외: 단일 해석이 명백하거나 조사로 답이 나오는 질문

---

## 7. 커뮤니케이션 톤
- 사용자 텍스트 한글, 식별자·API 영문
- 간결하게 — "Done", "Updated `src/parse/android.ts:42`"
- 트레이드오프는 양쪽 제시, 실패는 출력과 함께 사실대로

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v1.14 | 2026-09-29 | **D-37** — `CLAUDE.md`·`.claude/` 공개로 전환(D-36 번복, 사용자 결정: 유사 에이전트 제작 참고용). H-2 문구 갱신. 본 문서는 다시 git 으로 추적된다 |
| v1.13 | 2026-09-29 | **Phase 6 완료** — 저장소 생성·Pages(Actions)·push, Actions 2회 성공, 라이브 전 흐름·MP4 검증. §0·§2 갱신 (gh 로그인·workflow 스코프 부재 기록) |
| v1.12 | 2026-09-28 | **D-35**(커밋 작성자 noreply · 이력 재작성) · **D-36**(Claude 개발 설정 로컬 전용 — 이력 제거·gitignore) 신설, H-2 에 D-36 반영. 본 문서는 이제 git 으로 추적되지 않는다 |
| v1.11 | 2026-09-23 | Phase 6(로컬) — **D-34** 라이선스(MIT + 서드파티 원문 동봉) |
| v1.10 | 2026-09-23 | Phase 5 — O-05·O-06·O-07 → **D-32**, UI·입력 제한·CSP → **D-33** (D-23 위임, 권고안). §4 에서 O-05~O-07 제거 |
| v1.9 | 2026-09-23 | Phase 4 — **D-31**(내보내기 파이프라인) 신설, D-24 에 진행 끝 프레임(f359), D-26 에 마커 축소 방식 추가 (MP4 재측정) |
| v1.8 | 2026-09-23 | D-24·D-26 오케스트레이터 검토 수용 (D-02·D-23 범위) — 최종 보고에서 사용자에게 고지 |
| v1.7 | 2026-09-23 | Phase 3 결정 D-24~D-30 기록 (D-23 위임, 권고안 채택). **D-24(진행 축 = 누적 거리)는 승인된 D-05 해석 변경, D-26(트레일 ≈3 s 소멸)은 에이전트 §5 계약 변경 — 둘 다 사용자 확인 권장** |
| v1.6 | 2026-09-23 | **D-23** 신설 — 사용자가 Phase 3~6 최종 완성까지 권고안대로 무승인 진행 위임(범위 한정). H-7 에 D-23 예외 명시 |
| v1.5 | 2026-09-23 | Phase 2 실측으로 O-04 → **D-22**(Worker+JSON.parse, ≈500MB 상한, Phase 5 사전 크기 검사) 확정 (사용자 결정). §4 에서 O-04 제거 |
| v1.4 | 2026-09-23 | O-03 → **D-21** GitHub 계정 `rynnkitty` 확정, 자격 증명 비기록 원칙 명시. §4 에서 O-03 제거 |
| v1.3 | 2026-09-23 | Phase 1 스파이크 결과로 O-01 → **D-19**(CARTO 벡터 + OpenFreeMap 예비), O-02 → **D-20**(미지원 브라우저는 안내만) 확정 (사용자 결정). §4 에서 O-01·O-02 제거 |
| v1.2 | 2026-09-23 | Phase 0 질문 Q1~Q4 사용자 결정 반영 — D-16(트랙 = timelinePath 만)·D-17(동일 타임스탬프 첫 점 유지)·D-18(빈 배열 = NO_DATA) 신설, D-14 에 트랙 참조 추가, H-2 커밋 전 검사를 키워드 → 숫자 좌표 패턴으로 변경 |
| v1.1 | 2026-09-23 | 사용자 결정 반영 — D-12~D-15(Claude 제안) **전부 승인**, D-15 로컬 커밋 상시 허용. D-03 실파일은 Android 만 확보(iOS 미검증) → O-07 신설. 타 사내 프로젝트 자료 삭제(`readmd-aspnet.md`·`design-merge/`·`settings.local.json`, `sprint-close.md` 전용 섹션 제거) → H-2 문구 정리 |
| v1.0 | 2026-09-23 | 최초 작성 — 3라운드 인터뷰(렌더링 위치·데이터 포맷·배포·해상도·길이·조절 항목·샘플 데이터·스택·저장소명·언어·브라우저) 결과를 D-01~D-15 로 확정. 외부 사실 확인: CARTO 래스터 API 키 필수화(→D-13·O-01), Timeline.json Android/iOS 차이(→D-03), mp4-muxer 폐기(→D-12). `ref/CLAUDE.md` 에서 AskUserQuestion 룰·advisor·Plan→Code→Review·SSOT 분리만 계승, 3인 역할 매트릭스·3-tier 브랜치·MR 승인은 1인 프로젝트에 부적합하여 제외 |
