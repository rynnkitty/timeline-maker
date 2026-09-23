# Reference Spec — `ref/Output_semple.mp4` 역설계 사양 · 입력 스키마 실측

> **위상**: Phase 0 산출물. 에이전트 문서 `.claude/agents/timeline-maker.md` §2 의 측정값을 **검증 가능한 체크리스트**로 풀어 쓰고, 재측정 결과와 측정 방법을 붙인다. 규칙·결정은 `CLAUDE.md` 가 SSOT 이며 여기서 재정의하지 않는다.
>
> **측정일** 2026-09-23 · **도구** Python 3.13 + OpenCV 4.12 (`scripts/video-check.py`) · Node 22.19 (구조 조사)
>
> ⚠ 기준 프레임 이미지(`docs/reference/`)와 실파일 상세 집계(`docs/reference/survey-android.txt`)는 **실존 인물 데이터에서 나온 것이므로 gitignore** (H-2). 이 문서에는 좌표·장소 ID·이름·주소를 적지 않는다. 헤더의 실명은 `{이름}` 으로 표기한다.

---

## 0. 재현 명령

```bash
python scripts/video-check.py probe  ref/Output_semple.mp4 --expect 480x854@24:396   # §1
python scripts/video-check.py timing ref/Output_semple.mp4                           # §2
python scripts/video-check.py frames ref/Output_semple.mp4 docs/reference            # §5
node scripts/make-fixtures.ts                                                        # §7 픽스처
```

같은 스크립트를 Phase 4 산출 MP4 에 그대로 적용한다 (`probe --expect 480x854@24:396`, `720x1280@24:396`, `1080x1920@24:396`).

---

## 1. 컨테이너 체크리스트

| # | 항목 | 기대값 | 실측 (2026-09-23) | 방법 |
|---|---|---|---|---|
| C1 | 해상도 | 480×854 (9:16) | 480×854 ✅ | `CAP_PROP_FRAME_WIDTH/HEIGHT` |
| C2 | fps | 24 | 24.000 ✅ | `CAP_PROP_FPS` |
| C3 | 프레임 수 | 396 (=16.5s×24) | 메타 396 · **디코드 396** ✅ | 끝까지 `read()` |
| C4 | 코덱 | H.264 | fourcc `h264`, `avc1` 샘플 엔트리 ✅ | fourcc + 박스 검색 |
| C5 | 오디오 | 없음 | `hdlr` = `vide`, `mdir` 만 (`soun` 없음) ✅ | `hdlr` handler_type |
| C6 | mux | (참고) | `Lavf62.12.100` | 문자열 검색 — 우리는 Mediabunny 로 mux 하므로 일치 불필요 |

---

## 2. 타이밍 체크리스트

| # | 항목 | 기대값 | 실측 | 방법 |
|---|---|---|---|---|
| T1 | 애니메이션 구간 | 0.0 ~ 15.0s | 부제(km) **마지막 변화 f359 (14.958s)**, f360(15.000s)부터 고정 ✅ | 부제 영역(y55–85, x120–360) 프레임 차분 |
| T2 | km 카운터 시작 | 0 km | f0 부제 `2026년 1월 · 0 km` ✅ | 육안 (헤더 크롭) |
| T3 | km 카운터 끝 | 11,574 km, 고정 | f394 부제 `2026년 9월 · 11,574 km` ✅ | 육안 |
| T4 | 아웃트로 줌아웃 | 15.0 ~ ≈16.0s | 전체 모션 급증 **f361 (15.04s)** → 감쇠, 모션<1.2 **f381 (15.875s)** 부터 ✅ | 전 프레임 평균 절대차 |
| T5 | 정지 | ≈16.0 ~ 16.5s | 16.0–16.5s 평균 모션 0.38 (인코딩 노이즈 수준) ✅ | 〃 |
| T6 | **마커 소멸** (신규) | — | 코어 면적 f360 93px → f361 86 → f362 80 → f363 56 → **f364 부터 0 (15.17s)** — 아웃트로 시작 후 ≈0.17s 에 걸쳐 사라짐 | 검정 원형 블롭 면적 |

→ `CLAUDE.md` D-05 (`N = round((T_anim + 1.5) × 24)`, 15초 → 396) 와 정확히 일치. `t ≥ T_anim` 부터 데이터 시간은 끝에서 고정된다.

---

## 3. 화면 요소 체크리스트 (좌표는 480 폭 기준, 다른 해상도는 `W/480` 배율)

| # | 요소 | 기대값 | 재측정 / 비고 |
|---|---|---|---|
| S1 | 헤더 카드 | 흰색 반투명 둥근 사각형 x≈20–460, y≈17–88, r≈12 | 시간 표준편차<6 & 밝기>235 영역 = rows 18–86, cols 24–455. 임계값 때문에 모서리 AA 픽셀이 빠져 2~5px 좁게 나온 것 — **불일치 아님** |
| S2 | 제목 | `{YYYY}년 {이름}의 타임라인`, 굵게 ≈20px, 중앙, 거의 검정 | 형식 ✅. 휘도<60 픽셀 평균 RGB≈(38,30,33) — 글자 AA 경계가 섞인 평균이라 `#110A0D` 보다 밝게 나온다(코어는 `#110A0D` 부근) |
| S3 | 부제 | `{YYYY}년 {M}월 · {km 천 단위 콤마} km`, ≈12px, 회색, 중앙 | 형식 ✅ — 구분자 `·` 앞뒤 공백 있음 |
| S4 | 배경지도 톤 | 육지 ≈ rgb(248,248,245), 바다 ≈ rgb(211,217,220) | f0 우세색(2단계 양자화) rgb(250,250,246)·rgb(210,216,220) ✅ |
| S5 | 지도 라벨 | 영문/로마자, 대도시 대문자 | ✅ 대도시 대문자·중소도시 혼합 대소문자, 아웃트로 줌에서 도시 옆 작은 사각 점(■) |
| S6 | Attribution | 우하단 `© OpenStreetMap contributors © CARTO`, 모든 프레임 | f394 에서 확인 ✅ (하단 30px, 우측 절반) |
| S7 | 트레일 (재생 중) | 최근 = 굵고 진함 ≈rgb(17,93,48) 폭≈6 → 오래될수록 얇고 옅게 ≈rgb(158,222,184), 중앙값 ≈rgb(33,124,72) | 재측정 안 함 (기존값 신뢰). f070 육안: 최근 구간 진함→과거 옅음 ✅ |
| S8 | 트레일 (아웃트로) | 균일 중간 톤 ≈rgb(90,151,117), 폭≈2.5 | f394 육안 균일 ✅ |
| S9 | **현재 위치 마커** | ~~검은 원점 r≈5~~ → **검정 코어 r≈5.5 + 녹색 링(외경 r≈10)** | 방사 프로파일: r0–4 거의 검정(≈rgb(30,25,30)), r6–10 녹색 ≈rgb(35,115,70), r11 부터 배경. 코어 면적 ≈92px(등가 반경 5.4). **전 구간 동일 모양** (f0~f360 표본 13개) → 에이전트 §2.3 수정 |
| S10 | 마커 (아웃트로) | — | **표시 안 함** — T6 참조 |

---

## 4. 카메라 (정성 관찰 · 수치 튜닝은 Phase 3)

| # | 관찰 | 계약 영향 |
|---|---|---|
| K1 | **포인트 1개(0.0s)일 때 줌 상한**: 세로 약 250km 가 보이는 광역 줌(시·도 여러 개가 보이는 수준 — 대략 MapLibre zoom 7.5~8 @480 폭 추정). 단일 점에 시·구 단위까지 확대하지 **않는다** | 원인 후보 두 가지 — (a) 최대 줌 클램프 상한이 이 수준, (b) 카메라 창이 **앞으로 올 데이터**도 포함(중앙/선행 창)하거나 첫 창 전체로 시작. 영상만으로는 구분 불가 → Phase 3 에서 두 가설로 렌더해 대조. 2.9s 는 세로 ≈90~100km(zoom ≈9 추정). 480 폭·512px 타일 기준 환산: 세로 250km/854px ≈ 293 m/px → zoom ≈ 7.7. 최대 줌 상한과 "창 bbox fit" 의 관계는 Phase 3 에서 튜닝 |
| K2 | 2.9s: 최근 창의 경로가 화면 상단~중앙에 fit, 창 밖 과거 경로(옅은 선)는 화면 밖으로 나가 있음 | §2.4 와 일치 |
| K3 | 16.4s: 전체 경로 bbox fit, 헤더 카드 아래로 경로가 들어옴 (카드와 겹치지 않음) | 헤더 영역을 fit 패딩에 포함 (§5 카메라 계약) |

---

## 5. 기준 프레임 (로컬 전용 — `docs/reference/`, gitignore)

| 시각 | 프레임 | 파일 |
|---|---|---|
| 0.0s | f000 | `ref_00.0s_f000.png` |
| 1.4s | f034 | `ref_01.4s_f034.png` |
| 2.9s | f070 | `ref_02.9s_f070.png` |
| 4.3s | f103 | `ref_04.3s_f103.png` |
| 5.7s | f137 | `ref_05.7s_f137.png` |
| 7.2s | f173 | `ref_07.2s_f173.png` |
| 8.6s | f206 | `ref_08.6s_f206.png` |
| 10.0s | f240 | `ref_10.0s_f240.png` |
| 11.5s | f276 | `ref_11.5s_f276.png` |
| 12.9s | f310 | `ref_12.9s_f310.png` |
| 14.3s | f343 | `ref_14.3s_f343.png` |
| 16.4s | f394 | `ref_16.4s_f394.png` |

프레임 인덱스 = `round(t × 24)` (Python `round`). Phase 3 에서 같은 t 로 렌더한 프레임과 나란히 비교한다.

---

## 6. 입력 스키마 — Android 실파일 구조 (좌표 없음)

### 6.1 규모 · 파싱 비용 (O-04 근거)

| 항목 | 값 |
|---|---|
| 파일 크기 | 54.2 MB (56,860,149 B) |
| 기간 | 약 20개월 (월 단위: 2025-02 ~ 2026-09) — 거의 매일 경로점 있음 |
| 세그먼트 | 7,492 (timelinePath 4,200 · visit 1,653 · activity 1,627 · timelineMemory 12) |
| timelinePath 포인트 | 53,825 |
| rawSignals | 65,690 (activityRecord 32,155 · wifiScan 18,241 · position 15,294) — **최근 약 2개월만** 존재 |
| Node 22 `readFileSync(utf8)` | 578 ms |
| Node 22 `JSON.parse` | **125 ms** |
| 힙 증가 | +102 MB (heapUsed) · RSS +134 MB |

- Node 수치는 브라우저의 **대리 지표**다. 브라우저에서는 `File.text()` 결과 문자열(최대 UTF-16 2배)과 파싱 객체가 공존 → Worker 힙 **수백 MB 안팎** 예상.
- 용량의 큰 몫은 트랙에 쓰지 않는 `rawSignals`(특히 `wifiScan.devicesRecords` 21만 개)다 → 파싱 직후 트랙만 추출하고 원본 참조를 해제한다.
- 판단 근거 요약: **Worker + `JSON.parse` 로 시작해도 충분**(수년치·수백 MB 파일은 Phase 2 브라우저 실측 후 재검토). O-04 확정은 Phase 2.

### 6.2 키 트리 · 타입 (실측)

```
$ (object) keys: semanticSegments, rawSignals, userLocationProfile
$.semanticSegments[]                     — 각 원소는 아래 4종 중 정확히 하나의 키를 가짐(혼합 0건), startTime 오름차순(역순 0건)
  .startTime / .endTime                  string  "YYYY-MM-DDTHH:mm:ss.SSS+HH:MM" (전부 이 형식, Z 형식 0건)
  .startTimeTimezoneUtcOffsetMinutes     int     visit·activity·timelineMemory 에만 존재 — timelinePath 에는 0/4200
  .endTimeTimezoneUtcOffsetMinutes       int     〃  (ISO 접미 오프셋과 불일치 0건)
  .timelinePath[]                        span 전부 1~2h, 창 시작은 정시(:00:00.000), 창끼리 겹침 0
     .point                              string  "<lat>°, <lng>°"
     .time                               string  ISO(위와 같은 형식) — 세그먼트 범위 밖 0건, 세그먼트 내 정렬됨
  .visit
     .hierarchyLevel                     int     0 또는 1 (1 = 중첩 방문 — visit 끼리 시간 겹침 있음)
     .probability                        float
     .topCandidate.placeId               string  "ChIJ…" 27자
     .topCandidate.semanticType          enum    {UNKNOWN, INFERRED_HOME, INFERRED_WORK, SEARCHED_ADDRESS}
     .topCandidate.probability           float (가끔 int)
     .topCandidate.placeLocation.latLng  string  "<lat>°, <lng>°"
  .activity
     .start.latLng / .end.latLng         string  "<lat>°, <lng>°"
     .distanceMeters                     float (가끔 int)
     .probability                        float
     .topCandidate.type                  enum    {IN_PASSENGER_VEHICLE, WALKING, IN_SUBWAY, IN_BUS, IN_TRAIN, FLYING, MOTORCYCLING}
     .topCandidate.probability           float (가끔 int)
     .parking?.location.latLng           string  (자동차 이동 일부)
     .parking?.startTime                 string  ISO
  .timelineMemory.trip
     .distanceFromOriginKms              int
     .destinations[].identifier.placeId  string
$.rawSignals[]                           — 각 원소는 아래 3종 중 하나
  .position { LatLng ⚠대문자 L, accuracyMeters int, altitudeMeters float|int, source enum{WIFI,GPS,WIFI_ONLY,CELL,UNKNOWN}, speedMetersPerSecond, timestamp ISO }
  .activityRecord { probableActivities[]{type enum, confidence float|int}, timestamp ISO }
  .wifiScan { deliveryTime ISO, devicesRecords?[]{mac int, rawRssi int} }
$.userLocationProfile
  .frequentPlaces[] { placeId, placeLocation ⚠ "<lat>°, <lng>°" 문자열 직접(객체 아님), label? enum{HOME,WORK} }
  .frequentTrips[]  { waypointIds[], modeDistribution[]{mode, rate}, startTimeMinutes, endTimeMinutes, durationMinutes, confidence, commuteDirection enum }
  .persona.travelModeAffinities[] { mode, affinity }
```

### 6.3 좌표 문자열 형식

| 항목 | 실측 |
|---|---|
| 정규식 | `^-?\d{1,3}\.\d+°, -?\d{1,3}\.\d+°$` — 모든 좌표 문자열(timelinePath 53,825 · visit · activity · parking · position · frequentPlaces) 100% 매치 |
| 소수 자릿수 | **가변 3~7** (7/7 이 79%, 나머지는 끝자리 0 이 잘린 형태로 보임) → 고정 자릿수 가정 금지 |
| 정수 표기 (`37°`) | 관측 0건 — 파서는 `\d+(\.\d+)?` 로 둘 다 허용 권장 |

### 6.4 파서 설계에 영향을 주는 사실

| # | 사실 | 영향 |
|---|---|---|
| P1 | timelinePath 세그먼트에 tz 필드가 **없다** | 현지 월 계산은 **ISO 문자열의 오프셋 접미사**를 1차 소스로 쓴다 (tz 필드 기대 금지) |
| P2 | timelinePath 는 visit·activity 와 **별개 세그먼트**이며 시간이 겹친다 (visit~timelinePath 5,489쌍, activity~timelinePath 2,182쌍) | visit/activity 좌표를 트랙에 섞으면 같은 시각에 두 위치가 생길 수 있음 → 트랙 소스 정책 결정 필요 (ROADMAP Q1) |
| P3 | 세그먼트 내 **동일 타임스탬프 1,539쌍 — 전부 좌표가 다름**(200m~1km 96%, 1~10km 4%). 좌표까지 같은 완전 중복은 0건 | "중복 제거" 는 dt=0 처리 정책 문제. 속도 필터에서 dt=0 → ∞ km/h 로 오판하지 않게 (ROADMAP Q2) |
| P4 | 연속 포인트 속도 분포: <150 km/h 99.9%, 최대 구간 300~600 km/h 4건, **≥1,000 km/h 0건** | 이상치 임계 1,000 km/h 는 이 데이터에서 정당한 이동을 지우지 않는다 |
| P5 | `FLYING` activity 존재 · 비행 구간은 경로점이 희소 | 헤드 보간(§5 트레일 계약)이 긴 공백을 매끄럽게 이어야 함 |
| P6 | rawSignals 는 최근 약 2개월만 | 트랙 소스로 쓰지 않는다 |
| P7 | D-14 방식(timelinePath haversine 누적)으로 2026-01~ 을 합산하면 레퍼런스 11,574 km 대비 **−1.3%**. path+activity+visit 병합 시 +0.5%, `activity.distanceMeters` 합 −2.3% | D-14 가 레퍼런스 km 를 2% 이내로 재현 — 방식 타당 |

### 6.5 iOS — **문서 기반 · 실파일 미검증** (CLAUDE.md O-07)

근거: [time-mile 필드 레퍼런스](https://time-mile.com/guides/timeline-json-format/) · [google-maps-timeline-viewer #11 (iOS 예시)](https://github.com/kurupted/google-maps-timeline-viewer/issues/11) · [epk gist (iOS 파서 구현)](https://gist.github.com/epk/a70dd9b7a2d5bf8e5d86ebdcaefb6b32)

| 항목 | 근거 있는 사실 | 추정(미확인) |
|---|---|---|
| 루트 | 배열, 원소에 `startTime`/`endTime` | — |
| 시간 | `"2014-01-28T11:38:41.825+11:00"` (밀리초 + 오프셋) | — |
| visit | `hierarchyLevel:"0"`, `probability:"0.640000"`, `topCandidate{probability, semanticType:"Home", placeID, placeLocation:"geo:…"}` — 숫자 전부 문자열, semanticType 타이틀 케이스 | `Work`·`Unknown` 표기 |
| activity | `start`/`end` = `"geo:…"`, `topCandidate.type`, `distanceMeters:"3850"` | type 값 표기(소문자·공백 추정: `"in passenger vehicle"`) |
| timelinePath | `point:"geo:…"`, `durationMinutesOffsetFromStartTime` (문자열, 세그먼트 startTime 기준 분) | 정수 분만 오는지, 창 길이(2h?) |
| timelineMemory·rawSignals·profile | 문서 없음 | 없거나 다른 형태일 수 있음 → 파서는 모르는 키를 무시 |

---

## 7. 합성 픽스처 (`tests/fixtures/`, 커밋 대상 — 가짜 좌표)

생성: `node scripts/make-fixtures.ts` (Node ≥22.18 타입 스트리핑, 의존성 없음, 시드 고정 → 2회 실행 바이트 동일 확인). 좌표 원천은 공개 도시·역·공항 좌표 + 난수 — 실파일에서 파생한 값 없음.

- **구조 충실도 검증**: §6 조사 스크립트를 `android-sample.json` 에 돌린 결과, 키 경로 집합 **완전 일치**, 경로별 타입·문자열 형식 클래스 **완전 일치**.
- **오라클**: `tests/fixtures/expected.json` — 픽스처별 기대 포인트 수·시간 범위·현지/UTC 월별 개수·haversine 누적 km·에러 코드. 파서를 재실행한 값이 아니라 **생성 시점의 정답**(진짜 점 / 주입된 중복·이상치 구분)으로 계산. 트랙 정책은 파일 안 `trackPolicy` 에 명시(ROADMAP Q1·Q2 확정 시 생성기 상수만 바꿔 재생성).

| 파일 | 검증 대상 |
|---|---|
| `android-sample.json` | 실구조 모사 4개월(2026-01~04): 서울 일상 + 부산 KTX·강릉 자동차·**제주 FLYING(정당한 고속, 기내 점 없음)**·대구 당일. 동일 타임스탬프 중복(좌표 다름) 62·**순간이동 이상치 2** 주입. 1월 1일 새벽 점 → UTC 월 ≠ 현지 월 |
| `ios-sample.json` | iOS 가정 구조 2개월 · 숫자 문자열 · 분 오프셋 |
| `edge-empty.json` | 0바이트 → `EMPTY_FILE` |
| `edge-not-json.json` | HTML → `NOT_JSON` |
| `edge-legacy-records.json` · `edge-legacy-semantic.json` | 구 Takeout 2종 → `LEGACY_TAKEOUT` |
| `edge-empty-android.json` · `edge-empty-ios.json` | 형식 맞지만 비어 있음 → `NO_DATA` |
| `edge-zero-coords.android.json` | lng=0(그리니치)·lat=0(적도)·`"0°"`/`"0.0°"`·음수·**tz 필드 0**·distanceMeters 0·probability 0·UTC−5 저녁/KST 새벽의 월 경계 |
| `edge-zero-values.ios.json` | 첫 점 오프셋 `"0"`·distanceMeters `"0"`·hierarchyLevel `"0"`·lat 0 |
| `edge-reversed.android.json` | 세그먼트·경로점 모두 역순 → 정렬 후 순방향과 동일 |
| `edge-teleport.android.json` | 1분 ~325km 스파이크(제거) vs 11분 ~150km ≈820km/h(유지) — 임계 경계 |

---

## 8. 에이전트 §2 대비 변경점 (2026-09-23 재측정)

| 항목 | 기존 | 변경 | 반영 |
|---|---|---|---|
| §2.3 마커 | 검은 원점 r≈5 | 검정 코어 r≈5.5 + 녹색 링 외경 r≈10 | 에이전트 v1.2 |
| §2.2/§2.3 아웃트로 마커 | (없음) | 아웃트로 시작 후 ≈0.17s 에 걸쳐 사라짐, 이후 미표시 | 에이전트 v1.2 |
| §2.5 Android | — | tz 필드 위치, `rawSignals.position.LatLng` 대문자, `frequentPlaces.placeLocation` 문자열 직접, `timelineMemory`, 가변 소수 자릿수, 동일 타임스탬프 쌍 | 에이전트 v1.2 |
| Phase 2 월 경계 | tz 필드 있으면 사용 | ISO 접미 오프셋 1차 소스 | 에이전트 v1.2 |
| T1 압축 기준 (Phase 3) | 시간 선형 ("월당 ≈1.7s") | **누적 거리 선형** — km 카운터 초당 ≈772 km 일정, 월 10/10 일치 | `CLAUDE.md` D-24 · `docs/phase3-lookfeel.md` §1 |
| T1 진행 끝 프레임 (Phase 4) | — | 진행은 f359 에서 끝, f360 정지 (우리 MP4 에서 km 마지막 변화 f359·고정 f360 — 레퍼런스와 동일) | `CLAUDE.md` D-24 |
| T6 마커 소멸 방식 (Phase 4) | 사라짐 (방식 미판별, C-6) | **어두운 채로 축소** (코어 면적 93→86→80→56→0 · 알파 페이드면 f361 에 이미 밝아짐) — 우리 MP4 도 f364 부터 0 | `CLAUDE.md` D-26 |
| S7 트레일 하한 (Phase 3) | 오래된 선도 옅게 남음 | **≈3 영상초 뒤 사라짐** (f070 나이 1.5 s 보임 · f103 나이 2.9 s 없음), 아웃트로에서 전 경로 복귀 | `CLAUDE.md` D-26 · `docs/phase3-lookfeel.md` §3 |
