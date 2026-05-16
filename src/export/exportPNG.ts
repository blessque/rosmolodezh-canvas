import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { renderCompound } from '@/canvas/compoundRenderer';
import { renderImageMask } from '@/canvas/imageMaskRenderer';
import { drawStampInstance } from '@/canvas/stampRenderer';
import type { CompoundShape, StampStroke } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';

function identityViewport(docWidth: number, docHeight: number): ViewportState {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    documentWidth: docWidth,
    documentHeight: docHeight,
    canvasWidth: docWidth,
    canvasHeight: docHeight,
  };
}

/**
 * exportPNG — renders the current mode scene to an OffscreenCanvas and downloads a PNG.
 * Renders CompoundShape with identity viewport (no zoom/pan).
 */
export function exportPNG(docWidth: number, docHeight: number, scale: 1 | 2 = 1): void {
  const objects = useSceneStore.getState().objects;
  const compound = objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
  const { mode, shapeColor, canvasColor, stampSize, stampShape, stampImageUrl } = useUIStore.getState();

  const canvas = new OffscreenCanvas(docWidth * scale, docHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (scale !== 1) ctx.scale(scale, scale);

  const vp = identityViewport(docWidth, docHeight);

  // Background (fill in document coords — ctx.scale already applied)
  ctx.fillStyle = canvasColor;
  ctx.fillRect(0, 0, docWidth, docHeight);

  // Compound shape — generator mode only
  if (mode === 'generator' && compound) {
    const { rects, maskedRectIndices, imageUrl, imageTransform } = compound;
    const cornerRadius = rects[0]?.cornerRadius ?? 30;
    const maskedRects     = rects.filter((_, i) => maskedRectIndices.includes(i));
    const backgroundRects = rects.filter((_, i) => !maskedRectIndices.includes(i));

    // Background compound (non-masked rects)
    if (backgroundRects.length > 0) {
      renderCompound(
        ctx as unknown as CanvasRenderingContext2D,
        { ...compound, rects: backgroundRects },
        shapeColor,
        vp,
      );
    }

    // Masked rects filled with shapeColor (behind image)
    if (maskedRects.length > 0) {
      renderCompound(
        ctx as unknown as CanvasRenderingContext2D,
        { ...compound, rects: maskedRects },
        shapeColor,
        vp,
      );
    }

    // Image mask layer
    if (imageUrl && maskedRects.length > 0) {
      renderImageMask(
        ctx as unknown as CanvasRenderingContext2D,
        maskedRects,
        imageUrl,
        imageTransform,
        /*editMode=*/ false,
        vp,
        cornerRadius,
      );
    }
  }

  // Stamp strokes — stamp mode only (identity viewport: scale=1, offsets=0)
  if (mode === 'stamp') {
    const stampStrokes = objects.filter((o) => o.type === 'stamp') as StampStroke[];
    for (const stroke of stampStrokes) {
      for (const inst of stroke.stamps) {
        drawStampInstance(
          ctx as unknown as CanvasRenderingContext2D,
          inst.x, inst.y, stampSize,
          inst.angle, 1, 0, 0,
          shapeColor, stampShape, stampImageUrl,
        );
      }
    }
  }

  canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rosmolodezh-canvas.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}
