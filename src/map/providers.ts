/**
 * 타일 제공자 (D-19: CARTO 벡터 Positron 기본 · OpenFreeMap Positron 예비). 전환은 DEFAULT_PROVIDER 한 곳.
 * 근거: docs/spike-results.md §1.3 (약관·CORS·톤·라벨 비교).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type ProviderId = 'carto' | 'openfreemap';

export type TileProvider = {
  id: ProviderId;
  /** 사용자 안내에 쓰는 이름 (H-5 문구) */
  label: string;
  styleUrl: string;
  /** 프레임에 굽는 attribution (H-3) */
  attribution: string;
  /** 스타일 JSON 후처리 — 레퍼런스 룩에 맞춘다 */
  transform(style: StyleSpecification): StyleSpecification;
  /** H-1 CSP connect-src 에 넣을 호스트 */
  hosts: string[];
};

/** 레퍼런스는 영문 라벨 — 영문명이 없는 피처만 현지명 (docs/spike-results.md §1.6) */
const LABEL = ['coalesce', ['get', 'name_en'], ['get', 'name']];
const OFM_LABEL = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];

function relabel(style: StyleSpecification, field: unknown): StyleSpecification {
  for (const l of style.layers) {
    if (l.type !== 'symbol' || !l.layout || !('text-field' in l.layout)) continue;
    if (JSON.stringify(l.layout['text-field']).includes('name')) (l.layout as Record<string, unknown>)['text-field'] = field;
  }
  return style;
}

/**
 * 레퍼런스(f000, 줌≈7.7)의 대도시 라벨은 대문자·점 없음 (SEOUL 형식). CARTO GL 은 줌 7~8 에서 점+혼합 대소문자,
 * 8 이상에서 대문자 → 라벨 배율(k)로 MapLibre 줌이 0.43 낮아지는 만큼 경계를 한 단계 당긴다 (C-7).
 */
function cityLabelsLikeReference(style: StyleSpecification): StyleSpecification {
  for (const l of style.layers) {
    if (l.id === 'place_city_r5' || l.id === 'place_city_r6') l.minzoom = 7;
    // 중간 도시(r6)는 저줌에서 혼합 대소문자 (레퍼런스 f000: Kaesong · Ansan), 고줌에서 대문자 (f070: ANSAN).
    // 레이아웃 속성의 줌 함수는 **타일 정수 줌**으로 평가된다 → 경계는 정수(8)
    if (l.id === 'place_city_r6' && l.layout)
      (l.layout as Record<string, unknown>)['text-transform'] = {
        stops: [
          [7, 'none'],
          [8, 'uppercase'],
        ],
      };
    if (l.id === 'place_city_dot_z7' || l.id === 'place_capital_dot_z7') l.maxzoom = 7;
  }
  return style;
}

export const PROVIDERS: Record<ProviderId, TileProvider> = {
  carto: {
    id: 'carto',
    label: 'CARTO',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    attribution: '© OpenStreetMap contributors © CARTO',
    // CARTO Positron 은 z≥13 에서 한글 `name` 으로 바뀌고 글리프 서버에 한글이 없다 → 전 줌 name_en 우선
    transform: (s) => relabel(cityLabelsLikeReference(s), LABEL),
    hosts: ['https://basemaps.cartocdn.com', 'https://tiles.basemaps.cartocdn.com', 'https://*.basemaps.cartocdn.com'],
  },
  openfreemap: {
    id: 'openfreemap',
    label: 'OpenFreeMap',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    attribution: '© OpenStreetMap contributors © OpenMapTiles © OpenFreeMap',
    transform: (s) => {
      // 기본 톤이 레퍼런스보다 어둡다 → 배경·물 색을 CARTO 값으로
      for (const l of s.layers) {
        if (l.type === 'background') l.paint = { ...l.paint, 'background-color': '#fafaf8' };
        if (l.type === 'fill' && /^water/.test(l.id)) l.paint = { ...l.paint, 'fill-color': '#d4dadc' };
      }
      return relabel(s, OFM_LABEL);
    },
    hosts: ['https://tiles.openfreemap.org'],
  },
};

export const DEFAULT_PROVIDER: ProviderId = 'carto';
