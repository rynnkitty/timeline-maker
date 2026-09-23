/**
 * Spike B — Mediabunny 로 단색 + 프레임 카운터 H.264 MP4 인코딩 (Phase 1, 제품 코드 아님).
 * API 근거: node_modules/mediabunny/dist/mediabunny.d.ts (v1.59.0)
 *   Output / Mp4OutputFormat / BufferTarget / CanvasSource(canvas, VideoEncodingConfig)
 *   output.addVideoTrack(source, { frameRate }) · await output.start() · await source.add(ts, dur) · await output.finalize()
 *   canEncodeVideo(codec, {width,height}) · getFirstEncodableVideoCodec(codecs, {width,height})
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeVideo, getFirstEncodableVideoCodec } from 'mediabunny';

const RESOLUTIONS: [number, number][] = [
  [480, 854],
  [720, 1280],
  [1080, 1920],
];
const FPS = 24;

// WebCodecs 원시 확인용 H.264 코덱 문자열 (profile/level) — 1080×1920 은 매크로블록 수 때문에 level 4.0+ 필요
const RAW_AVC = ['avc1.42001f', 'avc1.4d001f', 'avc1.64001f', 'avc1.640028', 'avc1.640032', 'avc1.640033'];

async function capabilities() {
  const out: Record<string, unknown> = {
    userAgent: navigator.userAgent,
    hasVideoEncoder: typeof VideoEncoder !== 'undefined',
    secureContext: isSecureContext,
  };
  if (typeof VideoEncoder === 'undefined') return out;
  for (const [w, h] of RESOLUTIONS) {
    const key = `${w}x${h}`;
    const raw: Record<string, string> = {};
    for (const codec of RAW_AVC) {
      for (const hw of ['prefer-hardware', 'prefer-software'] as const) {
        try {
          const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, framerate: FPS, bitrate: 2e6, hardwareAcceleration: hw });
          raw[`${codec}/${hw}`] = r.supported ? 'yes' : 'no';
        } catch (e) {
          raw[`${codec}/${hw}`] = 'throw:' + (e as Error).name;
        }
      }
    }
    out[key] = {
      mediabunnyCanEncodeAvc: await canEncodeVideo('avc', { width: w, height: h }),
      mediabunnyCanEncodeVp9: await canEncodeVideo('vp9', { width: w, height: h }),
      firstEncodable: await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width: w, height: h }),
      rawWebCodecs: raw,
    };
  }
  return out;
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, i: number) {
  // 결정론: 색·텍스트는 프레임 인덱스만의 함수
  ctx.fillStyle = `hsl(${(i * 7) % 360} 45% 55%)`;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  ctx.font = `bold ${Math.round(w / 5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(i).padStart(3, '0'), w / 2, h / 2);
}

async function encode(w: number, h: number, frames: number, fullCodecString?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  let encoderConfig: VideoEncoderConfig | undefined;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality('high'),
    ...(fullCodecString ? { fullCodecString } : {}),
    onEncoderConfig: (c) => (encoderConfig = c),
  });
  output.addVideoTrack(source, { frameRate: FPS });
  const t0 = performance.now();
  await output.start();
  for (let i = 0; i < frames; i++) {
    draw(ctx, w, h, i);
    await source.add(i / FPS, 1 / FPS); // await = 인코더·writer 백프레셔
  }
  await output.finalize();
  const ms = performance.now() - t0;
  const buf = (output.target as BufferTarget).buffer!;
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    label: `${w}x${h}${fullCodecString ? '-' + fullCodecString : ''}`,
    width: w,
    height: h,
    frames,
    ms: Math.round(ms),
    bytes: bytes.length,
    codec: encoderConfig?.codec,
    hardwareAcceleration: encoderConfig?.hardwareAcceleration,
    base64: btoa(bin),
  };
}

async function run(frames = 48) {
  const caps = await capabilities();
  const results = [];
  for (const [w, h] of RESOLUTIONS) {
    try {
      results.push(await encode(w, h, frames));
    } catch (e) {
      results.push({ width: w, height: h, error: `${(e as Error).name}: ${(e as Error).message}` });
    }
  }
  // 480×854@24 는 초당 매크로블록 38,880 → 규격상 Level 3.0. 자동 선택(L2.2) 대신 명시한 변형
  try {
    results.push(await encode(480, 854, frames, 'avc1.64001e'));
  } catch (e) {
    results.push({ label: '480x854-avc1.64001e', error: `${(e as Error).name}: ${(e as Error).message}` });
  }
  return { caps, results };
}

(window as unknown as { spike: unknown }).spike = { run, ready: true };
document.querySelector('#log')!.textContent = 'ready';
