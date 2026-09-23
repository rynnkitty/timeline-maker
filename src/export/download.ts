/** Blob → 파일 다운로드 (브라우저 안에서만 — 외부 전송 없음, H-1) */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // 다운로드가 시작될 시간을 준 뒤 해제
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
