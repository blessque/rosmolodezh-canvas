import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { getCompoundSVGPath } from '@/canvas/compoundRenderer';
import { getMaskBBox } from '@/canvas/imageMaskRenderer';
import type { CompoundShape } from '@/types/scene';

/**
 * exportSVG — builds an SVG string from CompoundShape paths.
 * Renders with identity viewport (no zoom/pan).
 * Includes image mask as <clipPath> + <image> when present.
 */
export function exportSVG(docWidth: number, docHeight: number): void {
  const objects = useSceneStore.getState().objects;
  const compound = objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
  const { shapeColor, canvasColor } = useUIStore.getState();

  const svgLines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${docWidth} ${docHeight}" width="${docWidth}" height="${docHeight}">`,
    `  <rect width="${docWidth}" height="${docHeight}" fill="${canvasColor}"/>`,
  ];

  if (compound) {
    const { rects, maskedRectIndices, imageUrl, imageTransform } = compound;
    const maskedRects     = rects.filter((_, i) => maskedRectIndices.includes(i));
    const backgroundRects = rects.filter((_, i) => !maskedRectIndices.includes(i));

    // Background compound (non-masked rects)
    if (backgroundRects.length > 0) {
      const bgPathData = getCompoundSVGPath({ ...compound, rects: backgroundRects }, docWidth, docHeight);
      svgLines.push(`  <path d="${bgPathData}" fill="${shapeColor}"/>`);
    }

    if (maskedRects.length > 0) {
      const maskPathData = getCompoundSVGPath({ ...compound, rects: maskedRects }, docWidth, docHeight);

      if (imageUrl && maskedRects.length > 0) {
        // Compute image position in doc space
        const bbox = getMaskBBox(maskedRects);
        const { cx: cxBbox, cy: cyBbox } = bbox;
        const { translateX, translateY, scale, rotateDeg } = imageTransform;
        const cxDoc = cxBbox + translateX;
        const cyDoc = cyBbox + translateY;

        // We need the image natural size — use a rough estimate via fetch or
        // store dimensions. Since we have the image in a data URL, we compute
        // width/height from the transform scale. For SVG we don't know natural
        // size from the URL alone, so we use the bbox as reference.
        // Actual image draw size in doc units (will preserve aspect ratio via preserveAspectRatio):
        const imgW = bbox.bboxW / scale * scale * 4;  // oversized so clip handles cropping
        const imgH = bbox.bboxH / scale * scale * 4;
        const imgX = cxDoc - imgW / 2;
        const imgY = cyDoc - imgH / 2;

        // Mask fill (shapeColor behind image)
        svgLines.push(`  <path d="${maskPathData}" fill="${shapeColor}"/>`);

        // clipPath definition
        svgLines.push('  <defs>');
        svgLines.push(`    <clipPath id="imgMask0">`);
        svgLines.push(`      <path d="${maskPathData}"/>`);
        svgLines.push('    </clipPath>');
        svgLines.push('  </defs>');

        // Image element with clip + rotate transform
        const transformAttr = rotateDeg !== 0
          ? `transform="rotate(${rotateDeg}, ${cxDoc}, ${cyDoc})"`
          : '';
        svgLines.push(
          `  <image href="${imageUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" ` +
          `preserveAspectRatio="xMidYMid slice" clip-path="url(#imgMask0)" ${transformAttr}/>`,
        );
      } else {
        // No image — just render masked rects as compound fill
        svgLines.push(`  <path d="${maskPathData}" fill="${shapeColor}"/>`);
      }
    } else if (backgroundRects.length === 0) {
      // Fallback: render entire compound
      const pathData = getCompoundSVGPath(compound, docWidth, docHeight);
      if (pathData) svgLines.push(`  <path d="${pathData}" fill="${shapeColor}"/>`);
    }
  }

  svgLines.push('</svg>');

  const blob = new Blob([svgLines.join('\n')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rosmolodezh-canvas.svg';
  a.click();
  URL.revokeObjectURL(url);
}
