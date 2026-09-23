// 실파일 형식: YYYY-MM-DDTHH:mm:ss.SSS+HH:MM (Z 는 실파일에 없지만 허용)
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO 8601 시각 → { t: epoch ms, tz: UTC 오프셋(분) }.
 * 오프셋이 없는 문자열은 현지 시각을 알 수 없으므로 거부한다.
 */
export function parseIsoWithOffset(s: string): { t: number; tz: number } | null {
  const m = ISO.exec(s);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, sec, frac, off] = m;
  const mo = Number(Mo);
  const d = Number(D);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || Number(h) > 23 || Number(mi) > 59 || Number(sec) > 60) return null;
  const ms = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0;
  let tz = 0;
  if (off !== 'Z') {
    const oh = Number(off.slice(1, 3));
    const om = Number(off.slice(4, 6));
    if (oh > 14 || om > 59) return null;
    tz = (off[0] === '-' ? -1 : 1) * (oh * 60 + om);
  }
  const t = Date.UTC(Number(Y), mo - 1, d, Number(h), Number(mi), Number(sec), ms) - tz * 60_000;
  return Number.isFinite(t) ? { t, tz } : null;
}
