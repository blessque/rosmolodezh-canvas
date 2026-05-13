import paper from 'paper';
import { buildSmoothPath, paperItemToPath2D } from '@/canvas/compoundRenderer';
import { documentToCanvas, scaleToCanvas } from '@/utils/coordinates';
import type { PerspectiveRect, ImageTransform } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';

// ---------------------------------------------------------------------------
// Image cache (module-level, same pattern as stampRenderer)
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();

/** Expose the cache so callers can read cached images (e.g. for cover-transform computation). */
export function getImageCache(): Map<string, HTMLImageElement> {
  return imageCache;
}

export async function preloadImage(url: string): Promise<void> {
  if (imageCache.has(url)) return;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(); };
    img.onerror = reject;
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Mask bounding box
// ---------------------------------------------------------------------------

/**
 * Compute the axis-aligned bounding box of the given rects in document coords.
 * Returns center + dimensions.
 */
export function getMaskBBox(
  rects: PerspectiveRect[],
): { cx: number; cy: number; bboxW: number; bboxH: number } {
  if (rects.length === 0) return { cx: 0, cy: 0, bboxW: 0, bboxH: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const rect of rects) {
    // Use simple AABB from x/y/w/h (good enough for cover-fit initial scale)
    const x0 = rect.x;
    const y0 = rect.y + Math.min(rect.topLeftOffset, rect.topRightOffset, 0);
    const x1 = rect.x + rect.w;
    const y1 = rect.y + rect.h + Math.max(rect.bottomRightOffset, rect.bottomLeftOffset, 0);
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    bboxW: maxX - minX,
    bboxH: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// Cover-fit transform
// ---------------------------------------------------------------------------

/**
 * Compute initial ImageTransform so the image covers the mask bbox (like CSS `object-fit: cover`).
 */
export function computeCoverTransform(
  img: HTMLImageElement,
  maskBBox: ReturnType<typeof getMaskBBox>,
): ImageTransform {
  const { bboxW, bboxH } = maskBBox;
  const scale = Math.max(bboxW / img.naturalWidth, bboxH / img.naturalHeight);
  return { translateX: 0, translateY: 0, scale, rotateDeg: 0 };
}

// ---------------------------------------------------------------------------
// Edit handle geometry helpers
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 8;          // corner square half-size in screen px
const ROTATE_ZONE_OUTER = HANDLE_SIZE + 18; // 26px from corner center

interface HandleLayout {
  /** corners in screen space: [NW, NE, SE, SW] */
  corners: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
}

function getHandleLayout(
  cx: number, cy: number,
  imgW: number, imgH: number,
  rotateDeg: number,
): HandleLayout {
  const rad = rotateDeg * Math.PI / 180;
  const hw = imgW / 2;
  const hh = imgH / 2;

  function rot(dx: number, dy: number): { x: number; y: number } {
    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  }

  const nw = rot(-hw, -hh);
  const ne = rot( hw, -hh);
  const se = rot( hw,  hh);
  const sw = rot(-hw,  hh);

  return { corners: [nw, ne, se, sw] };
}

// ---------------------------------------------------------------------------
// Hit-test helpers for edit mode
// ---------------------------------------------------------------------------

export type HandleHit =
  | { kind: 'rotate' }
  | { kind: 'corner'; corner: 'nw' | 'ne' | 'se' | 'sw' }
  | { kind: 'body' }
  | null;

export function hitTestHandle(
  sx: number, sy: number,
  handles: HandleLayout,
): HandleHit {
  const cornerNames = ['nw', 'ne', 'se', 'sw'] as const;

  // Check scale zones first (inner zone wins over rotate)
  for (let i = 0; i < 4; i++) {
    const c = handles.corners[i]!;
    if (Math.abs(sx - c.x) <= HANDLE_SIZE + 2 && Math.abs(sy - c.y) <= HANDLE_SIZE + 2) {
      return { kind: 'corner', corner: cornerNames[i]! };
    }
  }

  // Check rotate zones (outer ring around each corner)
  for (let i = 0; i < 4; i++) {
    const c = handles.corners[i]!;
    const dist = Math.hypot(sx - c.x, sy - c.y);
    if (dist <= ROTATE_ZONE_OUTER) {
      return { kind: 'rotate' };
    }
  }

  return null;
}

function getDrawRect(
  cx: number, cy: number,
  imgW: number, imgH: number,
): { x: number; y: number; w: number; h: number } {
  return { x: cx - imgW / 2, y: cy - imgH / 2, w: imgW, h: imgH };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render an image clipped to a mask shape on the canvas.
 * maskedRects: the rects that form the mask (subset of compound.rects)
 * transform: current ImageTransform in document units
 * editMode: if true, shows 50% alpha outside clip + edit handles
 * viewport: current viewport state (for doc→screen conversion)
 * cornerRadius: used for smooth path building
 */
export function renderImageMask(
  ctx: CanvasRenderingContext2D,
  maskedRects: PerspectiveRect[],
  imageUrl: string,
  transform: ImageTransform,
  editMode: boolean,
  viewport: ViewportState,
  cornerRadius: number,
): void {
  const img = imageCache.get(imageUrl);
  if (!img || maskedRects.length === 0) return;

  // ── Build mask Path2D (Paper.js → screen space) ──────────────────────────
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 1; canvasEl.height = 1;
  const scope = new paper.PaperScope();
  scope.setup(canvasEl);
  scope.activate();

  const pathItem = buildSmoothPath(maskedRects, cornerRadius, scope);
  const maskPath = paperItemToPath2D(pathItem, viewport);
  scope.project.clear();

  // ── Fill mask shape with background color (so unmasked pixels show color) ─
  // (caller handles the shapeColor fill for maskedRects — we don't re-fill here)

  // ── Compute image draw rect in screen space ───────────────────────────────
  const bbox = getMaskBBox(maskedRects);
  const cxDoc = bbox.cx + transform.translateX;
  const cyDoc = bbox.cy + transform.translateY;
  const cxScreen = documentToCanvas({ x: cxDoc, y: cyDoc }, viewport);

  const imgW = img.naturalWidth  * transform.scale;
  const imgH = img.naturalHeight * transform.scale;
  const imgWScreen = scaleToCanvas(imgW, viewport);
  const imgHScreen = scaleToCanvas(imgH, viewport);

  const draw = getDrawRect(cxScreen.x, cxScreen.y, imgWScreen, imgHScreen);
  const rotateDeg = transform.rotateDeg;

  // ── Draw image ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(cxScreen.x, cxScreen.y);
  ctx.rotate(rotateDeg * Math.PI / 180);
  ctx.translate(-cxScreen.x, -cxScreen.y);

  if (editMode) {
    // Draw image outside clip at 50% alpha
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);

    // Draw image inside clip at full alpha
    ctx.save();
    ctx.clip(maskPath, 'nonzero');
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.clip(maskPath, 'nonzero');
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
    ctx.restore();
  }

  ctx.restore();

  // ── Edit handles ──────────────────────────────────────────────────────────
  if (editMode) {
    const handles = getHandleLayout(cxScreen.x, cxScreen.y, imgWScreen, imgHScreen, rotateDeg);

    ctx.save();

    // Dashed frame (rotated image bounding box)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const [nw, ne, se, sw] = handles.corners;
    ctx.moveTo(nw!.x, nw!.y);
    ctx.lineTo(ne!.x, ne!.y);
    ctx.lineTo(se!.x, se!.y);
    ctx.lineTo(sw!.x, sw!.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner squares
    for (const corner of handles.corners) {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#0e0f11';
      ctx.lineWidth = 1;
      ctx.fillRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Exported handle layout + hit-test (used by GeneratorCanvas pointer handlers)
// ---------------------------------------------------------------------------

export { getHandleLayout, getDrawRect, HANDLE_SIZE };
