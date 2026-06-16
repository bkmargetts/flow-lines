/** Trigger a browser download of a blob under the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download an SVG string. */
export function downloadSvgText(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), filename);
}
