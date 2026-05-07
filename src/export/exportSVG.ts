import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { getCompoundSVGPath } from '@/canvas/compoundRenderer';
import type { CompoundShape } from '@/types/scene';

/**
 * exportSVG — builds an SVG string from CompoundShape paths.
 * Renders with identity viewport (no zoom/pan).
 */
export function exportSVG(docWidth: number, docHeight: number): void {
  const objects = useSceneStore.getState().objects;
  const compound = objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
  const { shapeColor, canvasColor } = useUIStore.getState();

  const pathData = compound ? getCompoundSVGPath(compound, docWidth, docHeight) : '';

  const svgLines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${docWidth} ${docHeight}" width="${docWidth}" height="${docHeight}">`,
    `  <rect width="${docWidth}" height="${docHeight}" fill="${canvasColor}"/>`,
    compound ? `  <path d="${pathData}" fill="${shapeColor}"/>` : '',
    `</svg>`,
  ].filter(Boolean);

  const blob = new Blob([svgLines.join('\n')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rosmolodezh-canvas.svg';
  a.click();
  URL.revokeObjectURL(url);
}
