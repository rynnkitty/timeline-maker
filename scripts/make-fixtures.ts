/**
 * 합성 픽스처 생성기 — **가짜 좌표만** 사용한다 (CLAUDE.md H-2 · D-11).
 *
 * 실행:  node scripts/make-fixtures.ts
 *        (Node ≥ 22.18 은 타입 스트리핑이 기본 활성. 외부 의존성 없음.
 *         그래서 enum·namespace·parameter property 같은 non-erasable 문법을 쓰지 않는다.)
 *
 * 좌표 원천: 아래 PUBLIC 의 공개 도시·역·공항 좌표 + 시드 난수. ref/private 실파일에서 파생한 값은 없다.
 * 구조 원천: docs/reference-spec.md §4 (실파일 구조 조사 — 키·타입·분포만).
 * iOS 구조는 공개 문서·이슈 기반 **미검증 가정** (CLAUDE.md O-07).
 *
 * 산출: tests/fixtures/*.json + tests/fixtures/expected.json (Phase 2 파서 테스트의 오라클).
 * 오라클은 파서 알고리즘을 재실행해 얻은 값이 아니라 **생성 시점의 정답**(어느 점이 진짜이고
 * 어느 점이 주입된 중복·이상치인지)으로부터 계산한다.
 * 결정론: 같은 SEED → 바이트 동일 산출.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ───────────────────────── 상수 (오라클 정책 — expected.json 에 함께 기록) ─────────────────────────
const SEED = 20260923;
const EARTH_RADIUS_KM = 6371.0088; // IUGG 평균 반경
const SPEED_LIMIT_KMH = 1000; // 이 속도 이상으로 직전 유효점에서 튀는 점 = 순간이동 이상치
const TRACK_POLICY =
  'timelinePath 포인트만 트랙 소스로 사용 · 같은 타임스탬프 그룹은 파일 순서상 첫 점만 유지 · ' +
  '직전 유효점 대비 속도 >= SPEED_LIMIT_KMH 인 점 제거 · 시간순 정렬. (Phase 2 정책 확정 대기 — ROADMAP Q1/Q2)';
const KST = 540;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
const MIN = 60_000;
const HOUR = 60 * MIN;

// ───────────────────────── PRNG (mulberry32) ─────────────────────────
type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const intBetween = (r: Rng, a: number, b: number) => Math.floor(between(r, a, b + 1));
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const round = (x: number, d: number) => Number(x.toFixed(d));
/** 실파일: probability·confidence 같은 float 필드에 정수(1 등)가 드물게 섞인다 */
const prob = (r: Rng, a: number, b: number) => (r() < 0.04 ? 1 : round(between(r, a, b), 9));

// ───────────────────────── 지리 ─────────────────────────
type LatLng = { lat: number; lng: number };
function haversineKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** 방위 무작위, 거리 m 만큼 이동 (소거리 근사) */
function offsetM(r: Rng, p: LatLng, meters: number): LatLng {
  const th = r() * 2 * Math.PI;
  const dLat = (meters * Math.cos(th)) / 111_320;
  const dLng = (meters * Math.sin(th)) / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

// ───────────────────────── 형식화 ─────────────────────────
/** Android: 소수 7자리 후 끝자리 0 제거 (실파일의 가변 자릿수 3~7 분포가 이 방식과 부합) */
function fmtDeg(x: number): string {
  let s = x.toFixed(7).replace(/0+$/, '');
  if (s.endsWith('.')) s += '0';
  if (s === '-0.0') s = '0.0';
  return s;
}
const androidLatLng = (p: LatLng) => `${fmtDeg(p.lat)}°, ${fmtDeg(p.lng)}°`;
const iosGeo = (p: LatLng) => `geo:${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
/** 형식화된 문자열을 다시 숫자로 — 오라클은 파서가 보게 될 값(반올림 후)으로 계산한다 */
function parseAndroid(s: string): LatLng {
  const m = s.match(/^(-?\d+(?:\.\d+)?)°, (-?\d+(?:\.\d+)?)°$/);
  if (!m) throw new Error('bad android latlng ' + s);
  return { lat: Number(m[1]), lng: Number(m[2]) };
}
function parseIos(s: string): LatLng {
  const m = s.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error('bad ios geo ' + s);
  return { lat: Number(m[1]), lng: Number(m[2]) };
}
function offStr(offMin: number): string {
  const sign = offMin < 0 ? '-' : '+';
  const a = Math.abs(offMin);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
/** 실파일 형식: YYYY-MM-DDTHH:mm:ss.SSS+HH:MM (Z 형식 없음) */
function iso(ms: number, offMin: number): string {
  return new Date(ms + offMin * MIN).toISOString().replace('Z', offStr(offMin));
}
const localMonth = (ms: number, offMin: number) => new Date(ms + offMin * MIN).toISOString().slice(0, 7);
const utcMonth = (ms: number) => new Date(ms).toISOString().slice(0, 7);
/** 현지 시각 → epoch ms */
const at = (y: number, mo: number, d: number, h: number, mi: number, offMin = KST) =>
  Date.UTC(y, mo - 1, d, h, mi) - offMin * MIN;

function placeId(r: Rng): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let s = 'ChIJ';
  while (s.length < 27) s += A[Math.floor(r() * A.length)];
  return s;
}

// ───────────────────────── 공개 좌표 (가짜 데이터의 원천) ─────────────────────────
const PUBLIC = {
  seoulCityHall: { lat: 37.5665, lng: 126.978 },
  seoulStation: { lat: 37.5547, lng: 126.9707 },
  gimpoAirport: { lat: 37.5587, lng: 126.7945 },
  busanStation: { lat: 35.1151, lng: 129.0419 },
  haeundae: { lat: 35.1587, lng: 129.1604 },
  gangneung: { lat: 37.7519, lng: 128.8761 },
  gyeongpo: { lat: 37.7956, lng: 128.9087 },
  jejuAirport: { lat: 33.5066, lng: 126.4929 },
  seogwipo: { lat: 33.2541, lng: 126.5601 },
  seongsan: { lat: 33.4581, lng: 126.9425 },
  dongdaegu: { lat: 35.8797, lng: 128.6286 },
  daeguCenter: { lat: 35.8714, lng: 128.6014 },
  greenwich: { lat: 51.4779, lng: 0 },
  mitadDelMundo: { lat: 0, lng: -78.4558 },
} as const;

// ───────────────────────── 일정 모델 ─────────────────────────
type Mode = 'WALKING' | 'IN_SUBWAY' | 'IN_BUS' | 'IN_PASSENGER_VEHICLE' | 'IN_TRAIN' | 'FLYING';
type Sem = 'INFERRED_HOME' | 'INFERRED_WORK' | 'UNKNOWN' | 'SEARCHED_ADDRESS';
type Place = { id: string; p: LatLng; sem: Sem; off: number };
type Stay = { kind: 'stay'; place: Place; start: number; end: number };
type Move = { kind: 'move'; from: Place; to: Place; start: number; end: number; mode: Mode; bend: number };
type Ev = Stay | Move;

const SPEED_KMH: Record<Mode, number> = {
  WALKING: 4.5,
  IN_SUBWAY: 30,
  IN_BUS: 20,
  IN_PASSENGER_VEHICLE: 35,
  IN_TRAIN: 150,
  FLYING: 420,
};

function itinerary(r: Rng, start: Place, t0: number) {
  const ev: Ev[] = [];
  let here = start;
  let t = t0;
  return {
    ev,
    now: () => t,
    here: () => here,
    stayUntil(end: number) {
      if (end <= t) end = t + intBetween(r, 10, 30) * MIN;
      end += intBetween(r, 0, 59_999); // 경계 시각에 초·밀리초 잡음
      ev.push({ kind: 'stay', place: here, start: t, end });
      t = end;
    },
    stayFor(minutes: number) {
      this.stayUntil(t + minutes * MIN);
    },
    move(to: Place, mode: Mode) {
      const km = haversineKm(here.p, to.p);
      let v = SPEED_KMH[mode];
      if (mode === 'IN_PASSENGER_VEHICLE' && km > 50) v = 80; // 고속도로
      const minutes = Math.max(5, (km / v) * 60 * between(r, 1.05, 1.25) + (mode === 'FLYING' ? 0 : 3));
      const end = t + Math.round(minutes * MIN) + intBetween(r, 0, 59_999);
      const bend = km * between(r, 0.02, 0.08) * (r() < 0.5 ? -1 : 1);
      ev.push({ kind: 'move', from: here, to, start: t, end, mode, bend });
      here = to;
      t = end;
    },
  };
}
type It = ReturnType<typeof itinerary>;

// ───────────────────────── 포인트 스트림 ─────────────────────────
type Pt = { t: number; off: number; p: LatLng; tag: 'true' | 'dup' | 'outlier' };

/** 이벤트 → 진짜 경로 포인트 (시간 엄격 증가) */
function pathPoints(r: Rng, ev: Ev[], wholeMinutes: boolean): Pt[] {
  const out: Pt[] = [];
  for (const e of ev) {
    if (e.kind === 'stay') {
      // 머무는 동안: 드문드문 (실파일 간격 분포의 15~60분 꼬리)
      let t = e.start + intBetween(r, 1, 3) * MIN;
      while (t < e.end - MIN) {
        out.push({ t, off: e.place.off, p: offsetM(r, e.place.p, between(r, 0, 25)), tag: 'true' });
        t += intBetween(r, 20, 75) * MIN + intBetween(r, 0, 59) * 1000;
      }
    } else {
      if (e.mode === 'FLYING') continue; // 실파일 FLYING 구간은 경로점이 희소 — 기내 점 없음
      const hiway = e.mode === 'IN_TRAIN' || (e.mode === 'IN_PASSENGER_VEHICLE' && haversineKm(e.from.p, e.to.p) > 50);
      const [a, b] = e.mode === 'WALKING' ? [1, 3] : hiway ? [3, 8] : [1, 5];
      let t = e.start + intBetween(r, 30, 90) * 1000;
      const dLat = e.to.p.lat - e.from.p.lat;
      const dLng = e.to.p.lng - e.from.p.lng;
      const len = Math.hypot(dLat, dLng) || 1;
      while (t < e.end - 30_000) {
        const f = (t - e.start) / (e.end - e.start);
        const bendDeg = (e.bend / 111.32) * Math.sin(Math.PI * f);
        const base = {
          lat: e.from.p.lat + dLat * f + (-dLng / len) * bendDeg,
          lng: e.from.p.lng + dLng * f + (dLat / len) * bendDeg,
        };
        out.push({ t, off: e.from.off, p: offsetM(r, base, between(r, 0, 12)), tag: 'true' });
        t += intBetween(r, a, b) * MIN + intBetween(r, 0, 59) * 1000;
      }
    }
  }
  let res = out.sort((x, y) => x.t - y.t);
  if (wholeMinutes) {
    // iOS: durationMinutesOffsetFromStartTime 가 정수 분 → 분 단위로 양자화하고 충돌 제거
    res = res.map((q) => ({ ...q, t: Math.round(q.t / MIN) * MIN }));
  }
  const strict: Pt[] = [];
  for (const q of res) if (!strict.length || q.t > strict[strict.length - 1].t) strict.push(q);
  return strict;
}

/** 오라클: 진짜 점만, 시간순 */
function oracle(points: Pt[], fmt: 'android' | 'ios') {
  const truth = points.filter((q) => q.tag === 'true').sort((a, b) => a.t - b.t);
  let km = 0;
  let maxKmh = 0;
  const localMonths: Record<string, number> = {};
  const utcMonths: Record<string, number> = {};
  for (let i = 0; i < truth.length; i++) {
    const q = truth[i];
    localMonths[localMonth(q.t, q.off)] = (localMonths[localMonth(q.t, q.off)] || 0) + 1;
    utcMonths[utcMonth(q.t)] = (utcMonths[utcMonth(q.t)] || 0) + 1;
    if (i > 0) {
      const d = haversineKm(truth[i - 1].p, q.p);
      km += d;
      maxKmh = Math.max(maxKmh, d / ((q.t - truth[i - 1].t) / HOUR));
    }
  }
  if (maxKmh >= SPEED_LIMIT_KMH * 0.9) throw new Error(`true track too fast (${maxKmh} km/h) — generator bug`);
  return {
    format: fmt,
    expect: 'track' as const,
    points: truth.length,
    firstTime: truth.length ? new Date(truth[0].t).toISOString() : null,
    lastTime: truth.length ? new Date(truth[truth.length - 1].t).toISOString() : null,
    totalKm: round(km, 3),
    maxTrueSpeedKmh: round(maxKmh, 1),
    localMonths,
    utcMonths,
    injected: {
      sameTimestampDuplicates: points.filter((q) => q.tag === 'dup').length,
      speedOutliers: points.filter((q) => q.tag === 'outlier').length,
    },
  };
}

/** 형식화 후 재파싱한 좌표로 교체 (오라클과 파서가 같은 수치를 보게) */
function normalize(points: Pt[], fmt: 'android' | 'ios'): Pt[] {
  return points.map((q) => ({ ...q, p: fmt === 'android' ? parseAndroid(androidLatLng(q.p)) : parseIos(iosGeo(q.p)) }));
}

/** 2시간 정렬 창(현지 시각 짝수 시)으로 묶기 — 실파일: 창 시작 전부 :00:00.000, span 1~2h, 창 간 겹침 0 */
function windows(points: Pt[]): { start: number; off: number; pts: Pt[] }[] {
  const m = new Map<number, { start: number; off: number; pts: Pt[] }>();
  for (const q of points) {
    const local = q.t + q.off * MIN;
    const ws = Math.floor(local / (2 * HOUR)) * 2 * HOUR - q.off * MIN;
    let w = m.get(ws);
    if (!w) m.set(ws, (w = { start: ws, off: q.off, pts: [] }));
    w.pts.push(q);
  }
  return [...m.values()].sort((a, b) => a.start - b.start);
}

// ───────────────────────── Android 직렬화 ─────────────────────────
type Json = unknown;
function androidTz(off: number) {
  return { startTimeTimezoneUtcOffsetMinutes: off, endTimeTimezoneUtcOffsetMinutes: off };
}
function androidSegments(r: Rng, ev: Ev[], points: Pt[], extra: { memories?: Json[]; nested?: boolean } = {}) {
  const segs: { k: number; o: number; v: Json }[] = [];
  let order = 0;
  const push = (k: number, v: Json) => segs.push({ k, o: order++, v });
  for (const e of ev) {
    if (e.kind === 'stay') {
      push(e.start, {
        startTime: iso(e.start, e.place.off),
        endTime: iso(e.end, e.place.off),
        ...androidTz(e.place.off),
        visit: {
          hierarchyLevel: 0,
          probability: round(between(r, 0.4, 0.95), 9),
          topCandidate: {
            placeId: e.place.id,
            semanticType: e.place.sem,
            probability: prob(r, 0.3, 0.99),
            placeLocation: { latLng: androidLatLng(e.place.p) },
          },
        },
      });
      // 중첩 방문(hierarchyLevel 1): 실파일 visit~visit 겹침 273건 모사
      if (extra.nested && e.place.sem === 'INFERRED_WORK' && r() < 0.15) {
        push(e.start, {
          startTime: iso(e.start, e.place.off),
          endTime: iso(e.end, e.place.off),
          ...androidTz(e.place.off),
          visit: {
            hierarchyLevel: 1,
            probability: round(between(r, 0.4, 0.95), 9),
            topCandidate: {
              placeId: placeId(r),
              semanticType: 'UNKNOWN',
              probability: prob(r, 0.3, 0.99),
              placeLocation: { latLng: androidLatLng(offsetM(r, e.place.p, 120)) },
            },
          },
        });
      }
    } else {
      const km = haversineKm(e.from.p, e.to.p);
      const act: Record<string, Json> = {
        start: { latLng: androidLatLng(e.from.p) },
        end: { latLng: androidLatLng(e.to.p) },
        distanceMeters: r() < 0.01 ? Math.round(km * 1000) : round(km * 1000 * between(r, 1.1, 1.35), 6),
        probability: round(between(r, 0.5, 0.99), 9),
        topCandidate: { type: e.mode === 'IN_BUS' ? 'IN_BUS' : e.mode, probability: prob(r, 0.4, 0.99) },
      };
      if (e.mode === 'IN_PASSENGER_VEHICLE') {
        act.parking = {
          location: { latLng: androidLatLng(offsetM(r, e.to.p, 60)) },
          startTime: iso(e.end - intBetween(r, 1, 4) * MIN, e.to.off),
        };
      }
      push(e.start, { startTime: iso(e.start, e.from.off), endTime: iso(e.end, e.to.off), ...androidTz(e.from.off), activity: act });
    }
  }
  for (const w of windows(points)) {
    // 실파일: timelinePath 세그먼트에는 tz 필드가 없다 (0/4200)
    push(w.start, {
      startTime: iso(w.start, w.off),
      endTime: iso(w.start + 2 * HOUR, w.off),
      timelinePath: w.pts.map((q) => ({ point: androidLatLng(q.p), time: iso(q.t, q.off) })),
    });
  }
  for (const m of extra.memories ?? []) push(Date.parse((m as { startTime: string }).startTime), m);
  return segs.sort((a, b) => a.k - b.k || a.o - b.o).map((s) => s.v);
}

// ───────────────────────── iOS 직렬화 (문서 기반 가정) ─────────────────────────
const IOS_SEM: Record<Sem, string> = { INFERRED_HOME: 'Home', INFERRED_WORK: 'Work', UNKNOWN: 'Unknown', SEARCHED_ADDRESS: 'Searched Address' };
const IOS_MODE: Record<Mode, string> = {
  WALKING: 'walking',
  IN_SUBWAY: 'in subway',
  IN_BUS: 'in bus',
  IN_PASSENGER_VEHICLE: 'in passenger vehicle',
  IN_TRAIN: 'in train',
  FLYING: 'flying',
};
function iosSegments(r: Rng, ev: Ev[], points: Pt[]) {
  const segs: { k: number; o: number; v: Json }[] = [];
  let order = 0;
  const push = (k: number, v: Json) => segs.push({ k, o: order++, v });
  for (const e of ev) {
    if (e.kind === 'stay') {
      push(e.start, {
        endTime: iso(e.end, e.place.off),
        startTime: iso(e.start, e.place.off),
        visit: {
          hierarchyLevel: '0',
          topCandidate: {
            probability: between(r, 0.3, 0.99).toFixed(6),
            semanticType: IOS_SEM[e.place.sem],
            placeID: e.place.id,
            placeLocation: iosGeo(e.place.p),
          },
          probability: between(r, 0.4, 0.95).toFixed(6),
        },
      });
    } else {
      push(e.start, {
        endTime: iso(e.end, e.to.off),
        startTime: iso(e.start, e.from.off),
        activity: {
          probability: between(r, 0.5, 0.99).toFixed(6),
          end: iosGeo(e.to.p),
          topCandidate: { type: IOS_MODE[e.mode], probability: between(r, 0.4, 0.99).toFixed(6) },
          distanceMeters: String(Math.round(haversineKm(e.from.p, e.to.p) * 1000 * between(r, 1.1, 1.35))),
          start: iosGeo(e.from.p),
        },
      });
    }
  }
  for (const w of windows(points)) {
    push(w.start, {
      endTime: iso(w.start + 2 * HOUR, w.off),
      startTime: iso(w.start, w.off),
      timelinePath: w.pts.map((q) => ({ point: iosGeo(q.p), durationMinutesOffsetFromStartTime: String(Math.round((q.t - w.start) / MIN)) })),
    });
  }
  return segs.sort((a, b) => a.k - b.k || a.o - b.o).map((s) => s.v);
}

// ───────────────────────── 서울 생활 + 장거리 여행 일정 ─────────────────────────
function mkPlace(r: Rng, p: LatLng, sem: Sem = 'UNKNOWN', off = KST): Place {
  return { id: placeId(r), p, sem, off };
}
function seoulWorld(r: Rng) {
  const c = PUBLIC.seoulCityHall;
  const home = mkPlace(r, offsetM(r, c, between(r, 4000, 7000)), 'INFERRED_HOME');
  const work = mkPlace(r, offsetM(r, c, between(r, 2000, 5000)), 'INFERRED_WORK');
  const spots = Array.from({ length: 8 }, () => mkPlace(r, offsetM(r, c, between(r, 800, 14000))));
  const P = (k: keyof typeof PUBLIC) => mkPlace(r, PUBLIC[k]);
  const hub = {
    seoulStation: P('seoulStation'),
    gimpo: P('gimpoAirport'),
    busanStation: P('busanStation'),
    haeundae: P('haeundae'),
    gangneung: P('gangneung'),
    gyeongpo: P('gyeongpo'),
    jejuAirport: P('jejuAirport'),
    seogwipo: P('seogwipo'),
    seongsan: P('seongsan'),
    dongdaegu: P('dongdaegu'),
    daegu: P('daeguCenter'),
  };
  return { home, work, spots, hub };
}
type World = ReturnType<typeof seoulWorld>;

const cityMode = (r: Rng, a: Place, b: Place): Mode =>
  haversineKm(a.p, b.p) < 2 ? 'WALKING' : pick(r, ['IN_SUBWAY', 'IN_SUBWAY', 'IN_BUS', 'IN_PASSENGER_VEHICLE'] as const);

function weekday(r: Rng, it: It, w: World, y: number, mo: number, d: number) {
  it.stayUntil(at(y, mo, d, 8, intBetween(r, 0, 40)));
  it.move(w.work, cityMode(r, it.here(), w.work));
  it.stayUntil(at(y, mo, d, 18, intBetween(r, 0, 90)));
  if (r() < 0.3) {
    const s = pick(r, w.spots);
    it.move(s, cityMode(r, it.here(), s));
    it.stayFor(intBetween(r, 60, 150));
  }
  it.move(w.home, cityMode(r, it.here(), w.home));
}
function weekend(r: Rng, it: It, w: World, y: number, mo: number, d: number) {
  it.stayUntil(at(y, mo, d, 10, intBetween(r, 0, 120)));
  if (r() < 0.75) {
    const s = pick(r, w.spots);
    it.move(s, cityMode(r, it.here(), s));
    it.stayFor(intBetween(r, 120, 240));
    it.move(w.home, cityMode(r, it.here(), w.home));
  }
}

type Trip = (r: Rng, it: It, w: World, y: number, mo: number, d: number) => { days: number; memory?: { start: number; end: number; dests: Place[]; km: number } };
const trips: Record<string, Trip> = {
  busanKtx: (r, it, w, y, mo, d) => {
    const t0 = it.now();
    it.stayUntil(at(y, mo, d, 8, 30));
    it.move(w.hub.seoulStation, 'IN_SUBWAY');
    it.stayFor(20);
    it.move(w.hub.busanStation, 'IN_TRAIN');
    it.stayFor(15);
    it.move(w.hub.haeundae, 'IN_PASSENGER_VEHICLE');
    it.stayUntil(at(y, mo, d + 1, 11, 0));
    it.move(w.hub.busanStation, 'IN_PASSENGER_VEHICLE');
    it.stayFor(20);
    it.move(w.hub.seoulStation, 'IN_TRAIN');
    it.stayFor(10);
    it.move(w.home, 'IN_SUBWAY');
    return { days: 2, memory: { start: t0, end: it.now(), dests: [w.hub.haeundae], km: 325 } };
  },
  gangneungCar: (r, it, w, y, mo, d) => {
    const t0 = it.now();
    it.stayUntil(at(y, mo, d, 9, 0));
    it.move(w.hub.gangneung, 'IN_PASSENGER_VEHICLE');
    it.stayFor(90);
    it.move(w.hub.gyeongpo, 'IN_PASSENGER_VEHICLE');
    it.stayUntil(at(y, mo, d + 1, 13, 0));
    it.move(w.home, 'IN_PASSENGER_VEHICLE');
    return { days: 2, memory: { start: t0, end: it.now(), dests: [w.hub.gangneung, w.hub.gyeongpo], km: 165 } };
  },
  /** 정당한 장거리 고속 이동 — 속도 필터가 지우면 안 된다 (Phase 2 계약) */
  jejuFlight: (r, it, w, y, mo, d) => {
    const t0 = it.now();
    it.stayUntil(at(y, mo, d, 7, 30));
    it.move(w.hub.gimpo, 'IN_PASSENGER_VEHICLE');
    it.stayFor(70);
    it.move(w.hub.jejuAirport, 'FLYING');
    it.stayFor(25);
    it.move(w.hub.seogwipo, 'IN_PASSENGER_VEHICLE');
    it.stayUntil(at(y, mo, d + 1, 9, 30));
    it.move(w.hub.seongsan, 'IN_PASSENGER_VEHICLE');
    it.stayFor(180);
    it.move(w.hub.seogwipo, 'IN_PASSENGER_VEHICLE');
    it.stayUntil(at(y, mo, d + 2, 12, 0));
    it.move(w.hub.jejuAirport, 'IN_PASSENGER_VEHICLE');
    it.stayFor(80);
    it.move(w.hub.gimpo, 'FLYING');
    it.stayFor(20);
    it.move(w.home, 'IN_PASSENGER_VEHICLE');
    return { days: 3, memory: { start: t0, end: it.now(), dests: [w.hub.seogwipo, w.hub.seongsan], km: 450 } };
  },
  daeguDay: (r, it, w, y, mo, d) => {
    it.stayUntil(at(y, mo, d, 7, 40));
    it.move(w.hub.seoulStation, 'IN_SUBWAY');
    it.stayFor(15);
    it.move(w.hub.dongdaegu, 'IN_TRAIN');
    it.stayFor(10);
    it.move(w.hub.daegu, 'IN_SUBWAY');
    it.stayFor(200);
    it.move(w.hub.dongdaegu, 'IN_SUBWAY');
    it.stayFor(15);
    it.move(w.hub.seoulStation, 'IN_TRAIN');
    it.stayFor(10);
    it.move(w.home, 'IN_SUBWAY');
    return { days: 1 };
  },
};

function buildLife(r: Rng, w: World, y: number, mo: number, d0: number, nDays: number, plan: Record<string, keyof typeof trips>) {
  const it = itinerary(r, w.home, at(y, mo, d0, 0, 0));
  const memories: { start: number; end: number; dests: Place[]; km: number }[] = [];
  let i = 0;
  while (i < nDays) {
    const day = new Date(Date.UTC(y, mo - 1, d0 + i));
    const [Y, M, D] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const key = `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`;
    const trip = plan[key];
    if (trip) {
      const res = trips[trip](r, it, w, Y, M, D);
      if (res.memory) memories.push(res.memory);
      i += res.days;
      continue;
    }
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) weekend(r, it, w, Y, M, D);
    else weekday(r, it, w, Y, M, D);
    i++;
  }
  const last = new Date(Date.UTC(y, mo - 1, d0 + nDays - 1));
  it.stayUntil(at(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate(), 23, 30));
  return { ev: it.ev, memories };
}

// ───────────────────────── 주입 (중복 타임스탬프 · 순간이동) ─────────────────────────
/** 실파일: 동일 타임스탬프 1,539쌍 전부 좌표가 다름, 200m~1km(96%)·1~10km(4%) */
function injectSameTimestamp(r: Rng, pts: Pt[], rate: number): Pt[] {
  const out: Pt[] = [];
  for (const q of pts) {
    out.push(q);
    if (r() < rate) out.push({ ...q, p: offsetM(r, q.p, r() < 0.95 ? between(r, 200, 950) : between(r, 1200, 6000)), tag: 'dup' });
  }
  return out;
}
/** 순간이동 이상치: 두 진짜 점 사이(간격 >= 4분)에 150km 이상 떨어진 점 1개 */
function injectSpikes(r: Rng, pts: Pt[], n: number, far: readonly LatLng[]): Pt[] {
  const out = pts.slice();
  let done = 0;
  let guard = 0;
  while (done < n && guard++ < 10_000) {
    const i = intBetween(r, 50, out.length - 50);
    const a = out[i];
    const b = out[i + 1];
    if (a.tag !== 'true' || b.tag !== 'true' || b.t - a.t < 4 * MIN) continue;
    if (haversineKm(a.p, PUBLIC.seoulCityHall) > 30) continue; // 서울 생활 중에만
    const t = a.t + Math.round((b.t - a.t) / 2 / 1000) * 1000;
    out.splice(i + 1, 0, { t, off: a.off, p: offsetM(r, far[done % far.length], between(r, 0, 3000)), tag: 'outlier' });
    done++;
  }
  if (done < n) throw new Error('spike injection failed');
  return out;
}

// ───────────────────────── 픽스처 조립 ─────────────────────────
const files: Record<string, string> = {};
const expected: Record<string, Json> = {};
const put = (name: string, body: Json | string, exp: Json) => {
  files[name] = typeof body === 'string' ? body : JSON.stringify(body, null, 2) + '\n';
  expected[name] = exp;
};

function androidRoot(segments: Json[], rawSignals: Json[], profile: Json) {
  return { semanticSegments: segments, rawSignals, userLocationProfile: profile };
}

// ── 1) android-sample.json : 2026-01-01 ~ 2026-04-30 서울 일상 + 부산(KTX)·강릉(차)·제주(비행)·대구(당일) ──
{
  const r = mulberry32(SEED);
  const w = seoulWorld(r);
  const life = buildLife(r, w, 2026, 1, 1, 120, {
    '2026-01-17': 'busanKtx',
    '2026-02-14': 'gangneungCar',
    '2026-03-20': 'jejuFlight',
    '2026-04-11': 'daeguDay',
  });
  let pts = normalize(pathPoints(r, life.ev, false), 'android');
  pts = injectSameTimestamp(r, pts, 0.012);
  pts = normalize(injectSpikes(r, pts, 2, [PUBLIC.busanStation, PUBLIC.gangneung]), 'android');
  const memories = life.memories.map((m) => ({
    startTime: iso(m.start, KST),
    endTime: iso(m.end, KST),
    ...androidTz(KST),
    timelineMemory: { trip: { distanceFromOriginKms: m.km, destinations: m.dests.map((p) => ({ identifier: { placeId: p.id } })) } },
  }));
  const segments = androidSegments(r, life.ev, pts, { memories, nested: true });

  // rawSignals: 실파일은 최근 약 2개월만 존재 → 마지막 14일만. 트랙 소스가 아니다.
  const rawFrom = at(2026, 4, 17, 0, 0);
  const raw: { t: number; v: Json }[] = [];
  for (const q of pts) {
    if (q.tag !== 'true' || q.t < rawFrom) continue;
    if (r() < 0.35) {
      raw.push({
        t: q.t,
        v: {
          position: {
            LatLng: androidLatLng(offsetM(r, q.p, between(r, 5, 40))),
            accuracyMeters: intBetween(r, 5, 60),
            altitudeMeters: round(between(r, 20, 90), 1),
            source: pick(r, ['WIFI', 'GPS', 'WIFI_ONLY', 'CELL'] as const),
            speedMetersPerSecond: r() < 0.6 ? 0 : round(between(r, 0.3, 15), 2),
            timestamp: iso(q.t + 1234, KST),
          },
        },
      });
    }
    if (r() < 0.4) {
      raw.push({
        t: q.t + 500,
        v: {
          activityRecord: {
            probableActivities: [
              { type: pick(r, ['STILL', 'IN_ROAD_VEHICLE', 'WALKING', 'ON_FOOT'] as const), confidence: r() < 0.04 ? 1 : round(between(r, 0.3, 0.99), 6) },
              { type: 'UNKNOWN', confidence: round(between(r, 0.01, 0.2), 6) },
            ],
            timestamp: iso(q.t + 500, KST),
          },
        },
      });
    }
    if (r() < 0.25) {
      raw.push({
        t: q.t + 900,
        v: {
          wifiScan: {
            deliveryTime: iso(q.t + 900, KST),
            ...(r() < 0.55
              ? { devicesRecords: Array.from({ length: intBetween(r, 1, 8) }, () => ({ mac: intBetween(r, 1e12, 2.8e14), rawRssi: intBetween(r, -90, -35) })) }
              : {}),
          },
        },
      });
    }
  }
  raw.sort((a, b) => a.t - b.t);

  const profile = {
    frequentPlaces: [
      { placeId: w.home.id, placeLocation: androidLatLng(w.home.p), label: 'HOME' },
      { placeId: w.work.id, placeLocation: androidLatLng(w.work.p), label: 'WORK' },
      ...w.spots.slice(0, 2).map((s) => ({ placeId: s.id, placeLocation: androidLatLng(s.p) })),
    ],
    frequentTrips: [
      {
        waypointIds: [w.home.id, w.work.id],
        modeDistribution: [
          { mode: 'IN_PASSENGER_VEHICLE', rate: 0.6 },
          { mode: 'WALKING', rate: 0.4 },
        ],
        startTimeMinutes: 480,
        endTimeMinutes: 525,
        durationMinutes: 45,
        confidence: 0.72,
        commuteDirection: 'COMMUTE_DIRECTION_HOME_TO_WORK',
      },
      {
        waypointIds: [w.work.id, w.home.id],
        modeDistribution: [{ mode: 'IN_PASSENGER_VEHICLE', rate: 1 }],
        startTimeMinutes: 1110,
        endTimeMinutes: 1155,
        durationMinutes: 45,
        confidence: 0.64,
        commuteDirection: 'COMMUTE_DIRECTION_WORK_TO_HOME',
      },
    ],
    persona: {
      travelModeAffinities: [
        { mode: 'IN_PASSENGER_VEHICLE', affinity: 0.55 },
        { mode: 'WALKING', affinity: 0.3 },
        { mode: 'IN_SUBWAY', affinity: 0.15 },
      ],
    },
  };
  const kinds = (k: string) => segments.filter((s) => k in (s as object)).length;
  put('android-sample.json', androidRoot(segments, raw.map((x) => x.v), profile), {
    purpose:
      '실파일 구조 모사(Android). 서울 일상 4개월 + 부산 KTX·강릉 자동차·제주 FLYING(정당한 ~400km/h, 기내 경로점 없음)·대구 당일. ' +
      '동일 타임스탬프 중복(좌표 다름)과 순간이동 이상치 2개 주입. timelinePath 세그먼트엔 tz 필드 없음, visit/activity/timelineMemory 엔 있음. ' +
      'hierarchyLevel 1 중첩 visit, parking, rawSignals(position.LatLng 대문자), userLocationProfile 포함.',
    segmentCounts: { visit: kinds('visit'), activity: kinds('activity'), timelinePath: kinds('timelinePath'), timelineMemory: kinds('timelineMemory') },
    rawSignals: raw.length,
    rawPathPoints: pts.length,
    ...oracle(pts, 'android'),
  });
}

// ── 2) ios-sample.json : 2026-01-01 ~ 2026-02-28 (문서 기반 가정 구조) ──
{
  const r = mulberry32(SEED + 1);
  const w = seoulWorld(r);
  const life = buildLife(r, w, 2026, 1, 1, 59, { '2026-01-24': 'busanKtx', '2026-02-21': 'gangneungCar' });
  const pts = normalize(pathPoints(r, life.ev, true), 'ios');
  const segments = iosSegments(r, life.ev, pts);
  const kinds = (k: string) => segments.filter((s) => k in (s as object)).length;
  put('ios-sample.json', segments, {
    purpose:
      'iOS 구조(배열 루트 · geo: URI · 숫자 문자열 · placeID · durationMinutesOffsetFromStartTime 정수 분 문자열). ' +
      '⚠ 실파일 미검증 가정 — activity type 값 표기(소문자·공백)와 timelinePath 창 길이(2h)는 추정.',
    segmentCounts: { visit: kinds('visit'), activity: kinds('activity'), timelinePath: kinds('timelinePath'), timelineMemory: 0 },
    rawPathPoints: pts.length,
    ...oracle(pts, 'ios'),
  });
}

// ── 3) 엣지 케이스 ──
put('edge-empty.json', '', { purpose: '0바이트 파일', expect: 'error', error: 'EMPTY_FILE' });
put('edge-not-json.json', '<!doctype html><title>Not a timeline</title>\n', { purpose: 'JSON 아님', expect: 'error', error: 'NOT_JSON' });
put(
  'edge-legacy-records.json',
  {
    locations: [
      { latitudeE7: 375665000, longitudeE7: 1269780000, accuracy: 20, source: 'WIFI', deviceTag: 12345, timestamp: '2019-03-01T08:00:00.000Z' },
      { latitudeE7: 375547000, longitudeE7: 1269707000, accuracy: 15, source: 'GPS', deviceTag: 12345, timestamp: '2019-03-01T08:10:00.000Z' },
    ],
  },
  { purpose: '구 Takeout Records.json (latitudeE7) — 범위 외, 안내만 (D-03)', expect: 'error', error: 'LEGACY_TAKEOUT' },
);
put(
  'edge-legacy-semantic.json',
  {
    timelineObjects: [
      {
        placeVisit: {
          location: { latitudeE7: 375665000, longitudeE7: 1269780000, placeId: 'ChIJAAAAAAAAAAAAAAAAAAAAAAA', address: 'Fake address' },
          duration: { startTimestamp: '2019-03-01T08:00:00.000Z', endTimestamp: '2019-03-01T09:00:00.000Z' },
        },
      },
    ],
  },
  { purpose: '구 Takeout Semantic Location History (timelineObjects) — 범위 외, 안내만 (D-03)', expect: 'error', error: 'LEGACY_TAKEOUT' },
);
put('edge-empty-android.json', androidRoot([], [], {}), { purpose: 'Android 구조지만 세그먼트 0개', format: 'android', expect: 'error', error: 'NO_DATA' });
put('edge-empty-ios.json', [], { purpose: '빈 배열 — 형식 판별 불가하지만 사용자에겐 "데이터 없음"으로 안내 (권장안, Phase 2 확정)', expect: 'error', error: 'NO_DATA' });

// 좌표 0 · tz 0 · 값 0 — truthiness 함정 (Android)
{
  const r = mulberry32(SEED + 2);
  const pts: Pt[] = [];
  // 그리니치 자오선을 따라 걷기 (lng 정확히 0) · 2026-02-27 · UTC+0 (tz 필드 0 = falsy 함정)
  for (let i = 0; i < 12; i++) pts.push({ t: at(2026, 2, 27, 22, i * 4, 0), off: 0, p: { lat: 51.4755 + i * 0.0004, lng: 0 }, tag: 'true' });
  // 적도를 따라 걷기 (lat 정확히 0) · 2026-02-28 21:00~23:50 · UTC-5 — 현지 2월 / UTC 3월 (월 경계 함정)
  for (let i = 0; i < 12; i++) pts.push({ t: at(2026, 2, 28, 21, i * 15, -300), off: -300, p: { lat: 0, lng: -78.4575 + i * 0.0003 }, tag: 'true' });
  // 서울 · 2026-04-01 02:00 KST = 3월 31일 UTC — 현지 4월 / UTC 3월
  for (let i = 0; i < 6; i++) pts.push({ t: at(2026, 4, 1, 2, i * 5), off: KST, p: offsetM(r, PUBLIC.seoulCityHall, 30 + i * 80), tag: 'true' });
  const np = normalize(pts, 'android');
  const g = mkPlace(r, PUBLIC.greenwich, 'UNKNOWN', 0);
  const q = mkPlace(r, PUBLIC.mitadDelMundo, 'UNKNOWN', -300);
  const segs: Json[] = [
    {
      startTime: iso(at(2026, 2, 27, 21, 50, 0), 0),
      endTime: iso(at(2026, 2, 27, 21, 58, 0), 0),
      ...androidTz(0),
      visit: { hierarchyLevel: 0, probability: 0, topCandidate: { placeId: g.id, semanticType: 'UNKNOWN', probability: 0, placeLocation: { latLng: '51.4779°, 0°' } } },
    },
    {
      startTime: iso(at(2026, 2, 27, 21, 58, 0), 0),
      endTime: iso(at(2026, 2, 27, 23, 59, 0), 0),
      ...androidTz(0),
      activity: {
        start: { latLng: '51.4755°, 0.0°' },
        end: { latLng: '51.4799°, 0.0°' },
        distanceMeters: 0,
        probability: 0,
        topCandidate: { type: 'WALKING', probability: 0 },
      },
    },
    {
      startTime: iso(at(2026, 2, 28, 20, 50, -300), -300),
      endTime: iso(at(2026, 2, 28, 23, 59, -300), -300),
      ...androidTz(-300),
      visit: { hierarchyLevel: 0, probability: 0.5, topCandidate: { placeId: q.id, semanticType: 'UNKNOWN', probability: 0.5, placeLocation: { latLng: androidLatLng(q.p) } } },
    },
  ];
  const tl = windows(np).map((w) => ({
    startTime: iso(w.start, w.off),
    endTime: iso(w.start + 2 * HOUR, w.off),
    timelinePath: w.pts.map((p, i) => ({
      // 정수 표기 "0°" 와 "0.0°" 를 둘 다 등장시킨다 (실파일에서는 미관측 — 파서 견고성)
      point: p.p.lng === 0 && i === 0 ? `${fmtDeg(p.p.lat)}°, 0°` : androidLatLng(p.p),
      time: iso(p.t, p.off),
    })),
  }));
  const all = [...segs, ...tl].sort((a, b) => Date.parse((a as { startTime: string }).startTime) - Date.parse((b as { startTime: string }).startTime));
  put('edge-zero-coords.android.json', androidRoot(all, [], {}), {
    purpose:
      '좌표 0(lng=0 그리니치, lat=0 적도)·"0°"/"0.0°" 두 표기·음수 좌표·tz 필드 0(falsy)·distanceMeters 0·probability 0·hierarchyLevel 0. ' +
      '현지 월 ≠ UTC 월 인 점(적도 UTC-5 저녁, 서울 새벽) 포함 → localMonths 로 판정해야 한다.',
    ...oracle(np, 'android'),
  });
}

// 값 0 — iOS 문자열 숫자 함정
{
  const r = mulberry32(SEED + 3);
  const q = mkPlace(r, PUBLIC.mitadDelMundo, 'UNKNOWN', -300);
  const ws = at(2026, 3, 10, 8, 0, -300);
  const pts: Pt[] = Array.from({ length: 10 }, (_, i) => ({ t: ws + i * 6 * MIN, off: -300, p: { lat: 0, lng: -78.4575 + i * 0.0002 }, tag: 'true' as const }));
  const np = normalize(pts, 'ios');
  const segs = [
    {
      endTime: iso(ws, -300),
      startTime: iso(ws - HOUR, -300),
      visit: { hierarchyLevel: '0', topCandidate: { probability: '0.000000', semanticType: 'Unknown', placeID: q.id, placeLocation: iosGeo(q.p) }, probability: '0.000000' },
    },
    {
      endTime: iso(ws + 2 * HOUR, -300),
      startTime: iso(ws, -300),
      activity: { probability: '0.000000', end: iosGeo(np[9].p), topCandidate: { type: 'walking', probability: '0.000000' }, distanceMeters: '0', start: iosGeo(np[0].p) },
    },
    {
      endTime: iso(ws + 2 * HOUR, -300),
      startTime: iso(ws, -300),
      timelinePath: np.map((p) => ({ point: iosGeo(p.p), durationMinutesOffsetFromStartTime: String(Math.round((p.t - ws) / MIN)) })),
    },
  ];
  put('edge-zero-values.ios.json', segs, {
    purpose: 'iOS: 첫 점 durationMinutesOffsetFromStartTime "0"(문자열 falsy 아님·숫자 0 falsy), distanceMeters "0", hierarchyLevel "0", probability "0.000000", lat 0, UTC-5.',
    ...oracle(np, 'ios'),
  });
}

// 시간 역순 — 세그먼트 배열과 각 timelinePath 내부를 모두 뒤집음
{
  const r = mulberry32(SEED + 4);
  const w = seoulWorld(r);
  const life = buildLife(r, w, 2026, 5, 4, 2, {});
  const pts = normalize(pathPoints(r, life.ev, false), 'android');
  const segs = androidSegments(r, life.ev, pts).reverse() as Record<string, Json>[];
  for (const s of segs) if (Array.isArray(s.timelinePath)) s.timelinePath = (s.timelinePath as Json[]).slice().reverse();
  put('edge-reversed.android.json', androidRoot(segs, [], {}), {
    purpose: '세그먼트·경로점 모두 시간 역순. 파서는 시간순으로 정렬해야 하며 결과는 순방향과 같아야 한다 (실파일은 정렬돼 있음 — 방어용).',
    ...oracle(pts, 'android'),
  });
}

// 순간이동 이상치 vs 경계 근처의 정당한 고속 이동
{
  const r = mulberry32(SEED + 5);
  const pts: Pt[] = [];
  const base = PUBLIC.seoulCityHall;
  let t = at(2026, 6, 1, 9, 0);
  for (let i = 0; i < 20; i++, t += 2 * MIN) pts.push({ t, off: KST, p: { lat: base.lat + i * 0.0006, lng: base.lng + i * 0.0004 }, tag: 'true' });
  // 순간이동: 10번째 점 1분 뒤 부산역 (~325km/1min ≈ 19,500 km/h) → 제거
  pts.splice(10, 0, { t: pts[9].t + MIN, off: KST, p: PUBLIC.busanStation, tag: 'outlier' });
  // 정당한 고속: 마지막 점에서 11분 뒤 약 150km 떨어진 점 (≈ 820 km/h, 임계 1,000 미만) → 유지
  const last = pts[pts.length - 1];
  const far = { lat: last.p.lat - 1.35, lng: last.p.lng };
  const t2 = last.t + 11 * MIN;
  for (let i = 0; i < 6; i++) pts.push({ t: t2 + i * 3 * MIN, off: KST, p: { lat: far.lat - i * 0.0008, lng: far.lng }, tag: 'true' });
  const np = normalize(pts, 'android');
  const tl = windows(np).map((w) => ({
    startTime: iso(w.start, w.off),
    endTime: iso(w.start + 2 * HOUR, w.off),
    timelinePath: w.pts.map((p) => ({ point: androidLatLng(p.p), time: iso(p.t, p.off) })),
  }));
  void r;
  put('edge-teleport.android.json', androidRoot(tl, [], {}), {
    purpose: '1분 만에 ~325km 튀는 점 1개(제거 대상)와 11분에 ~150km(≈820km/h, 유지 대상)를 함께 둔다 — 임계값 1,000km/h 경계 검증.',
    rawPathPoints: np.length,
    ...oracle(np, 'android'),
  });
}

// ───────────────────────── 기록 ─────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(OUT_DIR, name), body, 'utf8');
const meta = {
  generator: 'scripts/make-fixtures.ts',
  seed: SEED,
  earthRadiusKm: EARTH_RADIUS_KM,
  speedLimitKmh: SPEED_LIMIT_KMH,
  trackPolicy: TRACK_POLICY,
  kmTolerance: 'relative 1e-6 (같은 반경·같은 점 순서일 때). 반경을 바꾸면 재생성',
  errorCodes: {
    EMPTY_FILE: '0바이트/공백만',
    NOT_JSON: 'JSON.parse 실패',
    LEGACY_TAKEOUT: '구 Takeout(Records.json · Semantic Location History) — D-03 범위 외',
    UNKNOWN_FORMAT: 'JSON 이지만 Android/iOS/구 Takeout 어느 것도 아님',
    NO_DATA: '형식은 맞지만 유효 트랙 포인트 0개',
  },
  fixtures: expected,
};
writeFileSync(join(OUT_DIR, 'expected.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
for (const [name, body] of Object.entries(files)) console.log(`${name.padEnd(34)} ${(Buffer.byteLength(body) / 1024).toFixed(1).padStart(8)} KB`);
console.log('expected.json written');
