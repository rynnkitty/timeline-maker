// 엔진 단위 테스트 — timeline · track · camera · trail · hud · frame (DOM 없이)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packTrack, parseTimeline, unpackTrack } from '../../src/data/index.ts';
import {
  DEFAULT_CAMERA,
  GREEN,
  HUD_GLYPHS,
  TILE_PX,
  buildScene,
  computeCameras,
  computeFrame,
  paceAt,
  bboxForCamera,
  fitBBox,
  softCap,
  formatThousands,
  frameCount,
  headAt,
  latToY,
  lngToX,
  makeTimeline,
  makeTrack,
  markerScale,
  outroMoveProgress,
  strokeForAge,
  subtitleText,
  titleText,
  xToLng,
  yToLat,
  type Track,
} from '../../src/engine/index.ts';

const fx = (n: string) => readFileSync(join(import.meta.dirname, '..', 'fixtures', n), 'utf8');
const sample = (): Track => makeTrack(packTrack(parseTimeline(fx('android-sample.json')).points));
const MIN = 60_000;
const tiny = (pts: [number, number, number][]): Track =>
  makeTrack(packTrack(pts.map(([m, lat, lng]) => ({ t: m * MIN, tz: 540, lat, lng }))));

describe('timeline (D-05)', () => {
  it('15초 → 396프레임 (레퍼런스와 동일) · 30초 → 756 · 60초 → 1476', () => {
    expect(frameCount(15)).toBe(396);
    expect(frameCount(30)).toBe(756);
    expect(frameCount(60)).toBe(1476);
  });
  it('진행은 선형 (D-24 거리 기준): f0 = 0 · f359 = 끝(레퍼런스 km 마지막 변화 f359) · 이후 고정', () => {
    const tl = makeTimeline(11574, 15);
    expect(paceAt(tl, 0)).toBe(0);
    expect(paceAt(tl, 179.5)).toBeCloseTo(11574 / 2, 9);
    expect(paceAt(tl, 358)).toBeLessThan(11574);
    expect(paceAt(tl, 359)).toBe(11574);
    expect(paceAt(tl, 360)).toBe(11574);
    expect(paceAt(tl, 395)).toBe(11574);
    expect(tl.perVideoS).toBeCloseTo(771.6, 1); // 레퍼런스 초당 ≈772 km
  });
  it('아웃트로 이동 f361→f381, 마커 축소 f361→f364 (어두운 채로 작아짐)', () => {
    const tl = makeTimeline(1, 15);
    expect(outroMoveProgress(tl, 360)).toBe(0);
    expect(outroMoveProgress(tl, 361)).toBeGreaterThan(0);
    expect(outroMoveProgress(tl, 381)).toBe(1);
    expect(markerScale(tl, 360)).toBe(1);
    expect(markerScale(tl, 361)).toBeGreaterThan(0.99);
    expect(markerScale(tl, 363)).toBeGreaterThan(0.6);
    expect(markerScale(tl, 364)).toBe(0);
  });
});

describe('mercator', () => {
  it('왕복 · 알려진 값', () => {
    expect(lngToX(0)).toBe(0.5);
    expect(latToY(0)).toBeCloseTo(0.5, 12);
    expect(xToLng(lngToX(126.978))).toBeCloseTo(126.978, 9);
    expect(yToLat(latToY(37.566))).toBeCloseTo(37.566, 9);
  });
});

describe('packed track (C-13)', () => {
  it('pack → unpack 왕복', () => {
    const pts = parseTimeline(fx('edge-zero-coords.android.json')).points;
    expect(unpackTrack(packTrack(pts))).toEqual(pts);
  });
});

describe('track.headAt (진행 축 = km)', () => {
  const tr = tiny([
    [0, 37.5, 127.0],
    [10, 37.5, 127.1],
    [100, 37.6, 127.1],
  ]);
  it('pace = km, 두 점 사이를 진행 비율로 보간 — 위치·km·시각 연속', () => {
    expect(tr.paceKind).toBe('km');
    const h = headAt(tr, tr.km[1] / 2);
    expect(h.i).toBe(0);
    expect(h.frac).toBeCloseTo(0.5, 12);
    expect(h.km).toBeCloseTo(tr.km[1] / 2, 9);
    expect(h.t).toBeCloseTo(5 * MIN, 6);
    expect(headAt(tr, tr.km[1]).km).toBeCloseTo(tr.km[1], 9);
  });
  it('범위 밖은 끝점에 고정', () => {
    expect(headAt(tr, -1).i).toBe(0);
    expect(headAt(tr, 1e12).km).toBe(tr.km[2]);
  });
  it('이동 거리 0 트랙은 점 순번으로 폴백 (NaN 없음)', () => {
    const still = tiny([
      [0, 37.5, 127],
      [5, 37.5, 127],
      [9, 37.5, 127],
    ]);
    expect(still.paceKind).toBe('index');
    const sc = buildScene(still, { animS: 15, width: 480, height: 854, name: '테스트' });
    for (const i of [0, 100, 360, 395]) {
      const f = computeFrame(sc, i);
      for (const v of [f.camera.x, f.camera.y, f.camera.zoom, f.head.t]) expect(Number.isFinite(v)).toBe(true);
    }
    expect(computeFrame(sc, 360).head.t).toBe(9 * MIN);
  });
});

describe('camera', () => {
  it('단일 점 → maxZoom 클램프, 점은 패딩 박스 중앙', () => {
    const x = lngToX(127);
    const y = latToY(37.5);
    const c = fitBBox({ minX: x, maxX: x, minY: y, maxY: y }, DEFAULT_CAMERA);
    expect(c.zoom).toBe(DEFAULT_CAMERA.maxZoom);
    const s = TILE_PX * 2 ** c.zoom;
    const sy = 854 / 2 + (y - c.y) * s;
    const p = DEFAULT_CAMERA.pad;
    expect(sy).toBeCloseTo(p.top + (854 - p.top - p.bottom) / 2, 6);
  });
  it('softCap: 상한 아래는 그대로, 위는 상한, 사이는 연속·단조·원래 값 이하', () => {
    expect(softCap(8, 9, 0.6)).toBe(8);
    expect(softCap(10, 9, 0.6)).toBe(9);
    let prev = softCap(8.3, 9, 0.6);
    for (let z = 8.31; z <= 9.7; z += 0.01) {
      const v = softCap(z, 9, 0.6);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(v).toBeLessThanOrEqual(z + 1e-12);
      expect(v - prev).toBeLessThan(0.0101);
      prev = v;
    }
  });
  it('bboxForCamera ∘ fitBBox ≈ 항등 (시작 카메라 재현)', () => {
    const cam = { x: lngToX(127), y: latToY(37.5), zoom: 7.7 };
    const c = fitBBox(bboxForCamera(cam, DEFAULT_CAMERA), DEFAULT_CAMERA);
    expect(c.zoom).toBeCloseTo(7.7, 1);
    const s = TILE_PX * 2 ** c.zoom;
    expect(Math.abs((cam.x - c.x) * s)).toBeLessThan(1);
    expect(Math.abs((cam.y - c.y) * s)).toBeLessThan(1);
  });
  it('bbox 는 패딩된 뷰포트 안에 들어간다', () => {
    const b = { minX: lngToX(126), maxX: lngToX(129.5), minY: latToY(38), maxY: latToY(34.8) };
    const c = fitBBox(b, DEFAULT_CAMERA);
    const s = TILE_PX * 2 ** c.zoom;
    const p = DEFAULT_CAMERA.pad;
    const sx = (x: number) => 240 + (x - c.x) * s;
    const sy = (y: number) => 427 + (y - c.y) * s;
    expect(sx(b.minX)).toBeGreaterThanOrEqual(p.left - 1e-6);
    expect(sx(b.maxX)).toBeLessThanOrEqual(480 - p.right + 1e-6);
    expect(sy(b.minY)).toBeGreaterThanOrEqual(p.top - 1e-6);
    expect(sy(b.maxY)).toBeLessThanOrEqual(854 - p.bottom + 1e-6);
  });
  it('android-sample 전 프레임: NaN 없음 · 연속·부드러움(|Δzoom|<0.5, |Δ²zoom|<0.25) · 마지막 = 전체 fit · 결정론', () => {
    const tr = sample();
    const tl = makeTimeline(tr.pace[tr.n - 1], 15);
    const cams = computeCameras(tr, tl);
    expect(cams.length).toBe(396);
    for (let i = 0; i < cams.length; i++) {
      for (const v of [cams[i].x, cams[i].y, cams[i].zoom]) expect(Number.isFinite(v)).toBe(true);
      if (i > 0 && i <= 360) expect(Math.abs(cams[i].zoom - cams[i - 1].zoom)).toBeLessThan(0.5);
      // 부드러움 = 가속도 제한 (속도 불연속 없음). 0.25 는 경로점 없는 450km 비행 구간에서 헤드가 선행 창보다
      // 빨리 나아가 박스를 미는 경우 — 헤드 운동 자체라 카메라로 없앨 수 없다 (나머지 구간은 < 0.12)
      if (i > 1 && i <= 360) expect(Math.abs(cams[i].zoom - 2 * cams[i - 1].zoom + cams[i - 2].zoom)).toBeLessThan(0.25);
    }
    // 아웃트로: ease-out — 전체 fit 쪽으로 단조 이동, 첫 프레임이 가장 빠름 (레퍼런스 f361 모션 최대)
    const dz = (i: number) => Math.abs(cams[i].zoom - cams[i - 1].zoom);
    for (let i = 362; i <= 381; i++) expect(dz(i)).toBeLessThanOrEqual(dz(i - 1) + 1e-12);
    expect(cams[395]).toEqual(cams[381]); // f381 이후 정지
    // 헤드는 애니메이션 전 구간에서 패딩된 뷰포트 안 (D-25: bbox 평활 + 선행 창 + 헤드 union)
    const p = DEFAULT_CAMERA.pad;
    for (let i = 0; i <= 360; i++) {
      const h = headAt(tr, paceAt(tl, i));
      const s = TILE_PX * 2 ** cams[i].zoom;
      const sx = 240 + (h.x - cams[i].x) * s;
      const sy = 427 + (h.y - cams[i].y) * s;
      expect(sx).toBeGreaterThanOrEqual(p.left - 1e-6);
      expect(sx).toBeLessThanOrEqual(480 - p.right + 1e-6);
      expect(sy).toBeGreaterThanOrEqual(p.top - 1e-6);
      expect(sy).toBeLessThanOrEqual(854 - p.bottom + 1e-6);
    }
    expect(computeCameras(tr, tl)).toEqual(cams);
  });
  it('f0 은 첫 점을 화면 중앙 가까이에 둔다 (C-2 가설 c: 시작 이전 목표 = 첫 점·startZoom)', () => {
    const tr = sample();
    const tl = makeTimeline(tr.pace[tr.n - 1], 15);
    const c = computeCameras(tr, tl)[0];
    const s = TILE_PX * 2 ** c.zoom;
    expect(Math.abs((tr.x[0] - c.x) * s)).toBeLessThan(40);
    expect(Math.abs((tr.y[0] - c.y) * s)).toBeLessThan(40);
    expect(Math.abs(c.zoom - DEFAULT_CAMERA.startZoom)).toBeLessThan(0.1);
  });
});

describe('trail (D-26)', () => {
  it('나이에 대해 폭·알파 단조 비증가 · 색은 옅어짐 · holdS 까지 최근 색 유지', () => {
    let prev = strokeForAge(0, GREEN);
    expect(prev.width).toBe(GREEN.recentWidth);
    expect(strokeForAge(GREEN.holdS, GREEN)).toEqual(prev);
    for (let a = 0.05; a <= 4; a += 0.05) {
      const s = strokeForAge(a, GREEN);
      expect(s.width).toBeLessThanOrEqual(prev.width + 1e-12);
      expect(s.alpha).toBeLessThanOrEqual(prev.alpha + 1e-12);
      expect(s.rgb[1]).toBeGreaterThanOrEqual(prev.rgb[1] - 1e-12);
      prev = s;
    }
  });
  it('rampS 까지 불투명, fadeS 에서 사라짐', () => {
    expect(strokeForAge(GREEN.rampS, GREEN).alpha).toBe(1);
    expect(strokeForAge(GREEN.fadeS, GREEN).alpha).toBe(0);
    expect(strokeForAge(GREEN.rampS, GREEN).rgb).toEqual(GREEN.old);
  });
});

describe('hud', () => {
  it('천 단위 콤마 (로케일 비의존)', () => {
    expect(formatThousands(0)).toBe('0');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(11574)).toBe('11,574');
    expect(formatThousands(1234567.9)).toBe('1,234,567');
  });
  it('부제는 현지 월 · km 내림 (UTC 로는 1월인 2월 1일 새벽)', () => {
    const t = Date.UTC(2026, 0, 31, 20, 0); // = 2026-02-01 05:00 KST
    expect(subtitleText(t, 540, 2187.9)).toBe('2026년 2월 · 2,187 km');
    expect(titleText(2026, 2026, '홍길동')).toBe('2026년 홍길동의 타임라인');
    expect(HUD_GLYPHS).toContain('·');
  });
});

describe('frame', () => {
  const tr = sample();
  const sc = buildScene(tr, { animS: 15, width: 480, height: 854, name: '테스트' });
  it('f0: 0 km · 트레일 없음(헤드=첫 점) · 마커 보임', () => {
    const f = computeFrame(sc, 0);
    expect(f.subtitle.endsWith('· 0 km')).toBe(true);
    expect(f.head.i).toBe(0);
    expect(f.markerScale).toBe(1);
  });
  it('밴드는 오래된 것부터, 미래 점을 포함하지 않는다', () => {
    for (const i of [1, 50, 137, 240, 359, 360, 370, 395]) {
      const f = computeFrame(sc, i);
      for (const b of f.bands) {
        expect(b.to).toBeLessThanOrEqual(f.head.i);
        expect(b.from).toBeLessThanOrEqual(b.to);
      }
      for (let k = 1; k < f.bands.length; k++) expect(f.bands[k].from).toBeGreaterThanOrEqual(f.bands[k - 1].from);
      expect(f.bands.at(-1)!.toHead).toBe(true);
    }
  });
  it('km 는 단조 증가, f359 이후 고정 · 마커는 f364 부터 0', () => {
    let prev = -1;
    const km = (i: number) =>
      Number(
        computeFrame(sc, i)
          .subtitle.split('· ')[1]
          .replace(/[^0-9]/g, ''),
      );
    for (let i = 0; i < 396; i += 3) {
      const v = km(i);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(km(359)).toBe(km(395));
    expect(km(359)).toBe(Math.floor(tr.km[tr.n - 1]));
    expect(km(358)).toBeLessThan(km(359));
    expect(computeFrame(sc, 364).markerScale).toBe(0);
  });
  it('같은 프레임은 같은 상태 (결정론)', () => {
    expect(computeFrame(sc, 200)).toEqual(computeFrame(sc, 200));
  });
});
