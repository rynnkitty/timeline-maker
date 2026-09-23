// File.text() 는 V8 문자열 한계(≈5.37억 자)를 넘으면 예외 없이 "" 를 돌려준다 (Chrome 153 실측, 600MB 합성 파일).
// 이를 EMPTY_FILE 로 오안내하지 않도록 파일 크기와 디코딩 결과로 판정한다.
import { describe, expect, it } from 'vitest';
import { MAX_TEXT_CHARS, checkDecodedText } from '../../src/workers/read-guard.ts';

describe('checkDecodedText', () => {
  it('크기가 있는데 디코딩 결과가 비면 FILE_TOO_LARGE', () => {
    expect(checkDecodedText(600 * 1024 * 1024, '')).toBe('FILE_TOO_LARGE');
  });
  it('0바이트 파일은 파서에 맡긴다 (EMPTY_FILE)', () => {
    expect(checkDecodedText(0, '')).toBeNull();
  });
  it('정상 텍스트는 통과', () => {
    expect(checkDecodedText(3, '{ }')).toBeNull();
  });
  it('V8 문자열 한계 상수', () => {
    expect(MAX_TEXT_CHARS).toBe(2 ** 29 - 24);
  });
});
