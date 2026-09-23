/** 작은 DOM 헬퍼 — 텍스트는 항상 textContent 로 (HTML 주입 없음) */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}

/** YYYY-MM-DD → "2026년 1월 1일" */
export function koDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
