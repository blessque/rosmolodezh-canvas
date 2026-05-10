import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { renderCompound } from '@/canvas/compoundRenderer';
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
export function exportPNG(docWidth: number, docHeight: number): void {
  const objects = useSceneStore.getState().objects;
  const compound = objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
  const { shapeColor, canvasColor, stampSize, stampRotate45, stampImageUrl } = useUIStore.getState();

  const canvas = new OffscreenCanvas(docWidth, docHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = canvasColor;
  ctx.fillRect(0, 0, docWidth, docHeight);

  // Compound shape
  if (compound) {
    renderCompound(ctx as unknown as CanvasRenderingContext2D, compound, shapeColor, identityViewport(docWidth, docHeight));
  }

  // Stamp strokes (identity viewport: scale=1, offsets=0)
  const stampStrokes = objects.filter((o) => o.type === 'stamp') as StampStroke[];
  for (const stroke of stampStrokes) {
    for (const inst of stroke.stamps) {
      drawStampInstance(
        ctx as unknown as CanvasRenderingContext2D,
        inst.x, inst.y, stampSize,
        inst.angle, 1, 0, 0,
        shapeColor, stampRotate45, stampImageUrl,
      );
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
