"""Phase 3 룩앤필 대조 — 레퍼런스 기준 프레임 vs 우리 렌더 (로컬 이미지 전용, 좌표·지명 출력 없음).

사용:
  python scripts/lookfeel-compare.py <ours_dir> <out_png>
    ours_dir: spikes/run.ts render --fn=renderRef --out=... 가 만든 ours_fNNN.png 들 (docs/reference/ 아래 — gitignore)
    out_png : 12쌍 나란히 (레퍼런스 | 우리) 합성 이미지 — docs/reference/ 아래에만 둔다 (실궤적 · H-2)
출력(표준출력): 프레임별 집계 수치만 — 녹색 픽셀 휘도 5구간 분포, 마커 중심 y, 헤더 카드 안쪽 색, 텍스트 잉크 박스.
주의: cv2.imwrite/imread 는 Windows 비ASCII 경로에서 조용히 실패 → imencode/np.fromfile 사용.
"""
import os, sys, glob
import cv2
import numpy as np

REF = 'docs/reference'
FRAMES = [0, 34, 70, 103, 137, 173, 206, 240, 276, 310, 343, 394]


def rd(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), 1)


def wr(p, img):
    ok, buf = cv2.imencode('.png', img)
    assert ok
    open(p, 'wb').write(buf.tobytes())


def ref_path(i):
    return glob.glob(os.path.join(REF, f'ref_*_f{i:03d}.png'))[0]


def green_hist(img):
    p = img[100:824, :, ::-1].reshape(-1, 3).astype(int)  # RGB, 헤더·attribution 제외
    m = (p[:, 1] > p[:, 0] + 15) & (p[:, 1] > p[:, 2] + 5)
    g = p[m]
    lum = g.mean(1)
    edges = [0, 90, 130, 170, 210, 256]
    return len(g), [int(((lum >= a) & (lum < b)).sum()) for a, b in zip(edges, edges[1:])]


def marker(img):
    m = (img.astype(int).mean(2) < 45).astype(np.uint8)
    m[:100] = 0
    m[-30:] = 0
    k, _, st, cen = cv2.connectedComponentsWithStats(m)
    c = [(st[j][4], cen[j]) for j in range(1, k) if 12 <= st[j][4] <= 200 and abs(st[j][2] - st[j][3]) <= 3]
    if not c:
        return None
    a, (x, y) = max(c, key=lambda v: v[0])
    return int(a), round(float(x), 1), round(float(y), 1)


def ink(img, y0, y1, th):
    m = img[y0:y1, 20:460].mean(2) < th
    ys = np.where(m.any(1))[0]
    xs = np.where(m.any(0))[0]
    return (y0 + int(ys.min()), y0 + int(ys.max()), 20 + int(xs.min()), 20 + int(xs.max())) if len(ys) else None


def label(img, text):
    img = img.copy()
    cv2.rectangle(img, (0, 820), (140, 853), (255, 255, 255), -1)
    cv2.putText(img, text, (4, 845), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 180), 1)
    return img


def main():
    ours_dir, out_png = sys.argv[1], sys.argv[2]
    pairs = []
    for i in FRAMES:
        r = rd(ref_path(i))
        o = rd(os.path.join(ours_dir, f'chrome-renderRef-ours_f{i:03d}.png'))
        pairs.append(np.hstack([label(r, f'REF f{i}'), label(o, f'OURS f{i}')]))
        nr, hr = green_hist(r)
        no, ho = green_hist(o)
        print(f'f{i:03d} green ref {nr:6d} {hr} | ours {no:6d} {ho}')
        print(f'      marker ref {marker(r)} ours {marker(o)}')
        if i in (0, 394):
            print(f'      title ink ref {ink(r, 20, 56, 110)} ours {ink(o, 20, 56, 110)} | subtitle ref {ink(r, 56, 85, 170)} ours {ink(o, 56, 85, 170)}')
            print(f'      card inside ref {r[22:30, 40:440, ::-1].reshape(-1, 3).mean(0).round(1)} ours {o[22:30, 40:440, ::-1].reshape(-1, 3).mean(0).round(1)}')
    rows = [np.hstack(pairs[k:k + 3]) for k in range(0, 12, 3)]
    grid = np.vstack(rows)
    wr(out_png, cv2.resize(grid, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA))
    for k, i in enumerate(FRAMES):
        wr(out_png.replace('.png', f'-f{i:03d}.png'), pairs[k])
    print('wrote', out_png)


if __name__ == '__main__':
    main()
