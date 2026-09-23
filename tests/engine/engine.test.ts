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
  dataTimeAt,
  fitBBox,
  formatThousands,
  frameCount,
  headAt,
  latToY,
  lngToX,
  makeTimeline,
  makeTrack,
  markerAlpha,
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
  it('f0 = 시작 · f360 = 끝 · 이후 고정 (레퍼런스 km 고정 f360)', () => {
    const tl = makeTimeline(1000, 5000, 15);
    expect(dataTimeAt(tl, 0)).toBe(1000);
    expect(dataTimeAt(tl, 359)).toBeLessThan(5000);
    expect(dataTimeAt(tl, 360)).toBe(5000);
    expect(dataTimeAt(tl, 395)).toBe(5000);
  });
  it('아웃트로 이동 f361→f381, 마커 페이드 f361→f364', () => {
    const tl = makeTimeline(0, 1, 15);
    expect(outroMoveProgress(tl, 360)).toBe(0);
    expect(outroMoveProgress(tl, 361)).toBeGreaterThan(0);
    expect(outroMoveProgress(tl, 381)).toBe(1);
    expect(markerAlpha(tl, 360)).toBe(1);
    expect(markerAlpha(tl, 363)).toBeGreaterThan(0);
    expect(markerAlpha(tl, 364)).toBe(0);
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

describe('track.headAt', () => {
  const tr = tiny([
    [0, 37.5, 127.0],
    [10, 37.5, 127.1],
    [100, 37.6, 127.1],
  ]);
  it('두 점 사이를 시간 비율로 보간 — 위치·km 연속', () => {
    const h = headAt(tr, 5 * MIN);
    expect(h.i).toBe(0);
    expect(h.frac).toBeCloseTo(0.5, 12);
    expect(h.km).toBeCloseTo(tr.km[1] / 2, 9);
    expect(headAt(tr, 10 * MIN).km).toBeCloseTo(tr.km[1], 9);
  });
  it('범위 밖은 끝점에 고정', () => {
    expect(headAt(tr, -1).i).toBe(0);
    expect(headAt(tr, 1e12).km).toBe(tr.km[2]);
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
  it('android-sample 전 프레임: NaN 없음 · 연속·부드러움(|Δzoom|<0.5, |Δ²zoom|<0.05) · 마지막 = 전체 fit · 결정론', () => {
    const tr = sample();
    const tl = makeTimeline(tr.t[0], tr.t[tr.n - 1], 15);
    const cams = computeCameras(tr, tl);
    expect(cams.length).toBe(396);
    for (let i = 0; i < cams.length; i++) {
      for (const v of [cams[i].x, cams[i].y, cams[i].zoom]) expect(Number.isFinite(v)).toBe(true);
      if (i > 0 && i <= 360) expect(Math.abs(cams[i].zoom - cams[i - 1].zoom)).toBeLessThan(0.5);
      // 부드러움 = 가속도 제한 (속도 불연속 없음)
      if (i > 1 && i <= 360) expect(Math.abs(cams[i].zoom - 2 * cams[i - 1].zoom + cams[i - 2].zoom)).toBeLessThan(0.05);
    }
    // 아웃트로: ease-out — 전체 fit 쪽으로 단조 이동, 첫 프레임이 가장 빠름 (레퍼런스 f361 모션 최대)
    const dz = (i: number) => Math.abs(cams[i].zoom - cams[i - 1].zoom);
    for (let i = 362; i <= 381; i++) expect(dz(i)).toBeLessThanOrEqual(dz(i - 1) + 1e-12);
    expect(cams[395]).toEqual(cams[381]); // f381 이후 정지
    expect(computeCameras(tr, tl)).toEqual(cams);
  });
  it('f0 은 첫 점을 화면 중앙 가까이에 둔다 (C-2 가설 c: 시작 이전 목표 = 첫 점·startZoom)', () => {
    const tr = sample();
    const tl = makeTimeline(tr.t[0], tr.t[tr.n - 1], 15);
    const c = computeCameras(tr, tl)[0];
    const s = TILE_PX * 2 ** c.zoom;
    expect(Math.abs((tr.x[0] - c.x) * s)).toBeLessThan(40);
    expect(Math.abs((tr.y[0] - c.y) * s)).toBeLessThan(40);
    expect(Math.abs(c.zoom - DEFAULT_CAMERA.startZoom)).toBeLessThan(0.5);
  });
});

describe('trail', () => {
  it('나이에 대해 폭 단조 감소 · 색은 옅어짐 · rampS 이후 상수', () => {
    let prev = strokeForAge(0, GREEN);
    expect(prev.width).toBe(GREEN.recentWidth);
    for (let a = 0.1; a <= 3; a += 0.1) {
      const s = strokeForAge(a, GREEN);
      expect(s.width).toBeLessThanOrEqual(prev.width + 1e-12);
      expect(s.rgb[1]).toBeGreaterThanOrEqual(prev.rgb[1] - 1e-12);
      prev = s;
    }
    expect(strokeForAge(GREEN.rampS, GREEN)).toEqual(strokeForAge(GREEN.rampS * 5, GREEN));
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
    expect(titleText(2026, '홍길동')).toBe('2026년 홍길동의 타임라인');
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
    expect(f.markerAlpha).toBe(1);
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
  it('km 는 단조 증가, f360 이후 고정 · 마커는 f364 부터 0', () => {
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
    expect(km(360)).toBe(km(395));
    expect(km(360)).toBe(Math.floor(tr.km[tr.n - 1]));
    expect(computeFrame(sc, 364).markerAlpha).toBe(0);
  });
  it('같은 프레임은 같은 상태 (결정론)', () => {
    expect(computeFrame(sc, 200)).toEqual(computeFrame(sc, 200));
  });
});
