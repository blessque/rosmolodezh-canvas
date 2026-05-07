/**
 * exportPNG — renders the current mode scene to an OffscreenCanvas and downloads a PNG.
 * Transparent background; scene objects drawn in document coordinates.
 * TODO: implement mode-aware rendering in next iteration.
 */

export function exportPNG(docWidth: number, docHeight: number): void {
  const canvas = new OffscreenCanvas(docWidth, docHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, docWidth, docHeight);
  // TODO: render scene here

  canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rosmolodezh-canvas.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}
