/**
 * 타일 제공자 (D-19: CARTO 벡터 Positron 기본 · OpenFreeMap Positron 예비). 전환은 DEFAULT_PROVIDER 한 곳.
 * 근거: docs/spike-results.md §1.3 (약관·CORS·톤·라벨 비교).
 */
import type { StyleSpecification } from 'maplibre-gl';

export type ProviderId = 'carto' | 'openfreemap';

export type TileProvider = {
  id: ProviderId;
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

export const PROVIDERS: Record<ProviderId, TileProvider> = {
  carto: {
    id: 'carto',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    attribution: '© OpenStreetMap contributors © CARTO',
    // CARTO Positron 은 z≥13 에서 한글 `name` 으로 바뀌고 글리프 서버에 한글이 없다 → 전 줌 name_en 우선
    transform: (s) => relabel(s, LABEL),
    hosts: ['https://basemaps.cartocdn.com', 'https://tiles.basemaps.cartocdn.com', 'https://*.basemaps.cartocdn.com'],
  },
  openfreemap: {
    id: 'openfreemap',
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
