/**
 * 내보내기 기능 감지 (D-10 · D-20: 미지원이면 폴백 없이 안내만).
 * API: mediabunny.d.ts canEncodeVideo(codec, {width, height}) · WebCodecs VideoEncoder.isConfigSupported
 */
import { canEncodeVideo } from 'mediabunny';
import { avcCodecString } from './codec.ts';
import { FPS } from '../engine/index.ts';

export type ExportSupport = { ok: true } | { ok: false; reason: 'INSECURE_CONTEXT' | 'NO_WEBCODECS' | 'NO_H264' | 'NO_WEBGL' };

export async function checkExportSupport(width: number, height: number): Promise<ExportSupport> {
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) return { ok: false, reason: 'INSECURE_CONTEXT' };
  if (typeof VideoEncoder === 'undefined') return { ok: false, reason: 'NO_WEBCODECS' };
  if (!document.createElement('canvas').getContext('webgl2')) return { ok: false, reason: 'NO_WEBGL' };
  try {
    const avc = await canEncodeVideo('avc', { width, height });
    // 우리가 실제로 쓰는 코덱 문자열(레벨 포함)로도 확인
    const exact = await VideoEncoder.isConfigSupported({ codec: avcCodecString(width, height, FPS), width, height, framerate: FPS });
    if (!avc || !exact.supported) return { ok: false, reason: 'NO_H264' };
  } catch {
    return { ok: false, reason: 'NO_H264' };
  }
  return { ok: true };
}
