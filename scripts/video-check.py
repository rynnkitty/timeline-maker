"""영상 검증 도구 (Python 3 + OpenCV · ffmpeg 불필요) — docs/reference-spec.md 체크리스트의 측정 수단.

사용:
  python scripts/video-check.py probe  <mp4> [--expect 480x854@24:396] [--expect-level 30]
      컨테이너 검사: 해상도·fps·디코드 프레임 수·코덱·오디오 트랙 유무·H.264 프로파일/레벨(avcC 와 SPS 에 실제 기록된 값).
      --expect / --expect-level 이 있으면 PASS/FAIL.
  python scripts/video-check.py frames <mp4> <out_dir>
      기준 시각 12장(0.0/1.4/2.9/4.3/5.7/7.2/8.6/10.0/11.5/12.9/14.3/16.4s)을 PNG 로 추출.
      ⚠ 레퍼런스(ref/)에서 뽑은 프레임은 실존 궤적 → out_dir 은 docs/reference/ (gitignore) 만 쓴다.
  python scripts/video-check.py timing <mp4>
      타이밍 측정: 부제(km) 마지막 변화 프레임, 마커 소멸 프레임, 아웃트로 모션 구간, 정지 시작.

주의:
  * cv2.imwrite / cv2.imread 는 Windows 에서 비ASCII(한글) 경로에 **조용히 실패**한다(반환값 False/None).
    그래서 imencode + open().write / np.fromfile + imdecode 를 쓴다.
  * 출력은 집계값만 — 좌표·화면 내 지명은 출력하지 않는다 (H-1/H-2).
"""
import argparse
import os
import sys

import cv2
import numpy as np

REF_TIMES = [0.0, 1.4, 2.9, 4.3, 5.7, 7.2, 8.6, 10.0, 11.5, 12.9, 14.3, 16.4]


def read_all(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        sys.exit(f'cannot open {path}')
    meta = {
        'w': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        'h': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        'fps': cap.get(cv2.CAP_PROP_FPS),
        'frames_meta': int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
    }
    fcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    meta['fourcc'] = ''.join(chr((fcc >> 8 * i) & 255) for i in range(4))
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    meta['frames_decoded'] = len(frames)
    return meta, frames


def mp4_boxes(path):
    """오디오 트랙 판별: hdlr 박스의 handler_type ('vide' / 'soun')."""
    data = open(path, 'rb').read()
    handlers = []
    i = data.find(b'hdlr')
    while i != -1:
        handlers.append(data[i + 12:i + 16].decode('latin-1'))
        i = data.find(b'hdlr', i + 4)
    enc = data.find(b'Lavf')
    return {
        'handlers': handlers,
        'has_audio': 'soun' in handlers,
        'has_avc1': b'avc1' in data,
        'encoder_tag': data[enc:enc + 13].decode('latin-1') if enc != -1 else None,
    }


def avc_levels(path):
    """avcC 박스(AVCDecoderConfigurationRecord)와 그 안의 첫 SPS NAL 에서 profile_idc·level_idc 를 읽는다."""
    data = open(path, 'rb').read()
    i = data.find(b'avcC')
    if i == -1:
        return None
    c = i + 4  # configurationVersion, AVCProfileIndication, profile_compatibility, AVCLevelIndication
    out = {'avcC_profile': data[c + 1], 'avcC_level': data[c + 3]}
    num_sps = data[c + 5] & 0x1F
    if num_sps:
        sps_len = int.from_bytes(data[c + 6:c + 8], 'big')
        sps = data[c + 8:c + 8 + sps_len]
        # sps[0] = NAL 헤더(0x67), 이어서 profile_idc, constraint flags, level_idc
        out.update({'sps_nal': sps[0] & 0x1F, 'sps_profile': sps[1], 'sps_level': sps[3]})
    return out


def cmd_probe(a):
    meta, _ = read_all(a.mp4)
    box = mp4_boxes(a.mp4)
    print(f"resolution {meta['w']}x{meta['h']}  fps {meta['fps']:.3f}  frames(meta) {meta['frames_meta']}  "
          f"frames(decoded) {meta['frames_decoded']}  duration {meta['frames_decoded'] / meta['fps']:.3f}s")
    print(f"fourcc {meta['fourcc']}  avc1 {box['has_avc1']}  handlers {box['handlers']}  audio {box['has_audio']}  "
          f"encoder {box['encoder_tag']}")
    lv = avc_levels(a.mp4)
    print(f"h264 {lv}")
    if a.expect or a.expect_level is not None:
        # --expect 없이 --expect-level 만 주면 컨테이너 항목은 실측값 자체와 비교 (= 레벨만 판정)
        wh, rest = (a.expect or f"{meta['w']}x{meta['h']}@{meta['fps']:g}:{meta['frames_decoded']}").split('@')
        w, h = map(int, wh.split('x'))
        fps, n = rest.split(':')
        checks = {
            'resolution': (meta['w'], meta['h']) == (w, h),
            'fps': abs(meta['fps'] - float(fps)) < 1e-3,
            'frames': meta['frames_decoded'] == int(n),
            'h264': box['has_avc1'],
            'no_audio': not box['has_audio'],
        }
        if a.expect_level is not None:
            checks['level'] = bool(lv) and lv.get('avcC_level') == a.expect_level and lv.get('sps_level') == a.expect_level
        for k, v in checks.items():
            print(f"  {'PASS' if v else 'FAIL'}  {k}")
        sys.exit(0 if all(checks.values()) else 1)


def cmd_frames(a):
    meta, frames = read_all(a.mp4)
    os.makedirs(a.out_dir, exist_ok=True)
    fps = meta['fps']
    for t in REF_TIMES:
        i = min(len(frames) - 1, round(t * fps))
        name = f'ref_{t:04.1f}s_f{i:03d}.png'
        ok, buf = cv2.imencode('.png', frames[i])
        if not ok:
            sys.exit(f'encode failed {name}')
        with open(os.path.join(a.out_dir, name), 'wb') as fh:
            fh.write(buf.tobytes())
        print('wrote', name)


def marker_area(f):
    """검정 원형 코어(휘도<45, 12~200px, 가로세로 거의 같음) 면적. 헤더(상단 100px)·attribution(하단 30px) 제외."""
    m = (f.astype(np.int16).mean(2) < 45).astype(np.uint8)
    m[:100] = 0
    m[-30:] = 0
    k, _, st, _ = cv2.connectedComponentsWithStats(m)
    blobs = [s[4] for s in st[1:] if 12 <= s[4] <= 200 and abs(s[2] - s[3]) <= 3]
    return max(blobs) if blobs else 0


def cmd_timing(a):
    meta, frames = read_all(a.mp4)
    fps, n = meta['fps'], len(frames)
    s = 480 / meta['w']  # 레퍼런스 좌표계(480 폭) 기준 영역을 배율 변환
    y0, y1, x0, x1 = int(55 / s), int(85 / s), int(120 / s), int(360 / s)
    sub = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)[y0:y1, x0:x1].astype(np.int16) for f in frames]
    changes = [i for i in range(1, n) if int((np.abs(sub[i] - sub[i - 1]) > 40).sum()) > 15]
    print(f'subtitle last change frame {changes[-1]} ({changes[-1] / fps:.3f}s) -> frozen from {changes[-1] + 1}')
    areas = [marker_area(f) for f in frames]
    gone = next((i for i in range(n) if areas[i] == 0 and all(x == 0 for x in areas[i:])), None)
    print(f'marker core area f0={areas[0]}px  median={int(np.median([x for x in areas if x]))}px  '
          f'gone from frame {gone} ({gone / fps:.3f}s)' if gone is not None else 'marker never disappears')
    diffs = [0.0] + [float(np.mean(cv2.absdiff(frames[i], frames[i - 1]))) for i in range(1, n)]
    still = next(i for i in range(n) if all(d < 1.2 for d in diffs[i:]))
    print(f'whole-frame motion < 1.2 from frame {still} ({still / fps:.3f}s)')
    for lo, hi in [(0, 15.0), (15.0, 15.5), (15.5, 16.0), (16.0, n / fps)]:
        seg = diffs[round(lo * fps):round(hi * fps)]
        print(f'  motion {lo:4.1f}-{hi:4.1f}s mean {np.mean(seg):.2f} max {np.max(seg):.2f}')


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest='cmd', required=True)
    q = sp.add_parser('probe'); q.add_argument('mp4'); q.add_argument('--expect'); q.add_argument('--expect-level', type=int)
    q = sp.add_parser('frames'); q.add_argument('mp4'); q.add_argument('out_dir')
    q = sp.add_parser('timing'); q.add_argument('mp4')
    a = p.parse_args()
    {'probe': cmd_probe, 'frames': cmd_frames, 'timing': cmd_timing}[a.cmd](a)


if __name__ == '__main__':
    main()
