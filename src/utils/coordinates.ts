import type { Point } from '@/types/geometry';
import type { ViewportState } from '@/store/uiStore';

/**
 * Convert a pointer event to canvas-relative position (CSS pixels).
 * Subtracts the canvas element's bounding rect offset.
 */
export function screenToCanvas(
  event: PointerEvent,
  canvasEl: HTMLCanvasElement,
): Point {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Convert canvas-relative position (CSS pixels) to document space.
 * Accounts for: letterboxing offset, zoom, and pan.
 */
export function canvasToDocument(
  canvasPoint: Point,
  viewport: ViewportState,
): Point {
  const { zoom, panX, panY, documentWidth, documentHeight, canvasWidth, canvasHeight } = viewport;

  const scaleX = canvasWidth / documentWidth;
  const scaleY = canvasHeight / documentHeight;
  const scale = Math.min(scaleX, scaleY) * zoom;

  const offsetX = (canvasWidth - documentWidth * scale) / 2;
  const offsetY = (canvasHeight - documentHeight * scale) / 2;

  return {
    x: (canvasPoint.x - offsetX) / scale - panX,
    y: (canvasPoint.y - offsetY) / scale - panY,
  };
}

/**
 * Convert document space to canvas-relative position (CSS pixels).
 * Used by renderers to draw scene objects on the canvas.
 */
export function documentToCanvas(
  docPoint: Point,
  viewport: ViewportState,
): Point {
  const { zoom, panX, panY, documentWidth, documentHeight, canvasWidth, canvasHeight } = viewport;

  const scaleX = canvasWidth / documentWidth;
  const scaleY = canvasHeight / documentHeight;
  const scale = Math.min(scaleX, scaleY) * zoom;

  const offsetX = (canvasWidth - documentWidth * scale) / 2;
  const offsetY = (canvasHeight - documentHeight * scale) / 2;

  return {
    x: (docPoint.x + panX) * scale + offsetX,
    y: (docPoint.y + panY) * scale + offsetY,
  };
}

/**
 * Scale a distance (not a position) from document units to canvas pixels.
 */
export function scaleToCanvas(
  docDist: number,
  viewport: ViewportState,
): number {
  const scaleX = viewport.canvasWidth / viewport.documentWidth;
  const scaleY = viewport.canvasHeight / viewport.documentHeight;
  return docDist * Math.min(scaleX, scaleY) * viewport.zoom;
}
