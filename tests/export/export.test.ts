// src/export 순수 로직 — 코덱 레벨 · 파일명 · 해상도 (브라우저 인코딩 자체는 spikes/export 로 검증)
import { describe, expect, it } from 'vitest';
import { RESOLUTIONS, avcCodecString, avcLevel, exportFileName } from '../../src/export/index.ts';

describe('avcLevel (H.264 Table A-1: MaxFS · MaxMBPS)', () => {
  it('480×854@24 → 3.0 (Mediabunny 자동 선택 2.2 는 MaxMBPS 20,250 < 38,880 초과 — C-10)', () => {
    expect(avcLevel(480, 854, 24)).toBe(30);
  });
  it('720×1280@24 → 3.1 · 1080×1920@24 → 4.0', () => {
    expect(avcLevel(720, 1280, 24)).toBe(31);
    expect(avcLevel(1080, 1920, 24)).toBe(40);
  });
  it('프레임 크기 한계도 본다 (MaxFS)', () => {
    expect(avcLevel(1920, 1088, 1)).toBe(40); // 8160 MB → 3.2(5120) 초과
  });
  it('코덱 문자열 = High(0x64) · 제약 0 · 레벨 hex', () => {
    expect(avcCodecString(480, 854, 24)).toBe('avc1.64001e');
    expect(avcCodecString(720, 1280, 24)).toBe('avc1.64001f');
    expect(avcCodecString(1080, 1920, 24)).toBe('avc1.640028');
  });
});

describe('RESOLUTIONS (D-04)', () => {
  it('9:16 세 가지', () => {
    expect(RESOLUTIONS.map((r) => `${r.width}x${r.height}`)).toEqual(['480x854', '720x1280', '1080x1920']);
  });
});

describe('exportFileName', () => {
  it('제목 + 해상도 + .mp4', () => {
    expect(exportFileName('2026년 홍길동의 타임라인', 480, 854)).toBe('2026년 홍길동의 타임라인_480x854.mp4');
  });
  it('파일명에 못 쓰는 문자·제어문자 제거, 공백 정리', () => {
    expect(exportFileName('a/b\\c:d*e?f"g<h>i|j\u0001k', 480, 854)).toBe('a_b_c_d_e_f_g_h_i_j_k_480x854.mp4');
    expect(exportFileName('  여러   칸  ', 720, 1280)).toBe('여러 칸_720x1280.mp4');
  });
  it('끝의 점·공백 제거, Windows 예약어 회피, 빈 제목 대체', () => {
    expect(exportFileName('제목...', 480, 854)).toBe('제목_480x854.mp4');
    expect(exportFileName('CON', 480, 854)).toBe('CON_video_480x854.mp4');
    expect(exportFileName('///', 480, 854)).toBe('timeline_480x854.mp4');
    expect(exportFileName('', 480, 854)).toBe('timeline_480x854.mp4');
  });
  it('너무 긴 제목은 자른다 (코드 포인트 기준, 서로게이트 깨지지 않음)', () => {
    const n = exportFileName('가'.repeat(300), 480, 854);
    expect([...n.replace('_480x854.mp4', '')].length).toBe(80);
    const e = exportFileName('😀'.repeat(100), 480, 854);
    expect(e.includes('�')).toBe(false);
    expect([...e.replace('_480x854.mp4', '')].length).toBe(80);
  });
});
