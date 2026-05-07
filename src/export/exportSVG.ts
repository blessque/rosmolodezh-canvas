/**
 * exportSVG — builds an SVG string from CompoundShape paths or StampStroke positions.
 * TODO: implement mode-aware rendering in next iteration.
 */

export function exportSVG(docWidth: number, docHeight: number): void {
  const svgLines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${docWidth} ${docHeight}" width="${docWidth}" height="${docHeight}">`,
    // TODO: render scene elements here
    `</svg>`,
  ];
  const blob = new Blob([svgLines.join('\n')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rosmolodezh-canvas.svg';
  a.click();
  URL.revokeObjectURL(url);
}
