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

const HANDLE_SIZE = 8;           // corner square half-size in screen px
const ROTATE_ZONE_OUTER = HANDLE_SIZE + 18; // 26px from corner center
const EDGE_HIT_WIDTH = 12;       // px each side of edge line for hit test
const MID_ROTATE_RADIUS = 12;   // hit radius around mid-side rotate dots
const MID_ROTATE_OFFSET = 22;   // px outside mid-edge

type Pt = { x: number; y: number };

export interface HandleLayout {
  /** corners in screen space: [NW, NE, SE, SW] */
  corners: [Pt, Pt, Pt, Pt];
  /** mid-edge points: [N, E, S, W] — on the border */
  midEdges: [Pt, Pt, Pt, Pt];
  /** mid-side rotate zones: [N, E, S, W] — outside the border */
  midSideOuter: [Pt, Pt, Pt, Pt];
}

function getHandleLayout(
  cx: number, cy: number,
  imgW: number, imgH: number,
  rotateDeg: number,
): HandleLayout {
  const rad = rotateDeg * Math.PI / 180;
  const hw = imgW / 2;
  const hh = imgH / 2;
  const cos = Math.cos(rad), sin = Math.sin(rad);

  function rot(dx: number, dy: number): Pt {
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  }

  const nw = rot(-hw, -hh);
  const ne = rot( hw, -hh);
  const se = rot( hw,  hh);
  const sw = rot(-hw,  hh);

  // Mid-edge points (midpoints of each edge)
  const mN: Pt = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
  const mE: Pt = { x: (ne.x + se.x) / 2, y: (ne.y + se.y) / 2 };
  const mS: Pt = { x: (se.x + sw.x) / 2, y: (se.y + sw.y) / 2 };
  const mW: Pt = { x: (sw.x + nw.x) / 2, y: (sw.y + nw.y) / 2 };

  // Outward normals in screen space:
  //  N edge outward normal (local -Y): ( sin, -cos)
  //  E edge outward normal (local +X): ( cos,  sin)
  //  S edge outward normal (local +Y): (-sin,  cos)
  //  W edge outward normal (local -X): (-cos, -sin)
  const d = MID_ROTATE_OFFSET;
  const moN: Pt = { x: mN.x + sin * d, y: mN.y - cos * d };
  const moE: Pt = { x: mE.x + cos * d, y: mE.y + sin * d };
  const moS: Pt = { x: mS.x - sin * d, y: mS.y + cos * d };
  const moW: Pt = { x: mW.x - cos * d, y: mW.y - sin * d };

  return {
    corners: [nw, ne, se, sw],
    midEdges: [mN, mE, mS, mW],
    midSideOuter: [moN, moE, moS, moW],
  };
}

/** Minimum distance from point (px,py) to segment (ax,ay)→(bx,by). */
function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

// ---------------------------------------------------------------------------
// Hit-test helpers for edit mode
// ---------------------------------------------------------------------------

export type HandleHit =
  | { kind: 'rotate' }
  | { kind: 'corner'; corner: 'nw' | 'ne' | 'se' | 'sw' }
  | { kind: 'edge'; edge: 'N' | 'E' | 'S' | 'W' }
  | { kind: 'mid-rotate'; edge: 'N' | 'E' | 'S' | 'W' }
  | { kind: 'body' }
  | null;

export function hitTestHandle(
  sx: number, sy: number,
  handles: HandleLayout,
): HandleHit {
  const cornerNames = ['nw', 'ne', 'se', 'sw'] as const;
  const edgeNames = ['N', 'E', 'S', 'W'] as const;

  // 1. Corner scale zones (highest priority)
  for (let i = 0; i < 4; i++) {
    const c = handles.corners[i]!;
    if (Math.abs(sx - c.x) <= HANDLE_SIZE + 2 && Math.abs(sy - c.y) <= HANDLE_SIZE + 2) {
      return { kind: 'corner', corner: cornerNames[i]! };
    }
  }

  // 2. Corner rotate zones (ring around each corner)
  for (let i = 0; i < 4; i++) {
    const c = handles.corners[i]!;
    if (Math.hypot(sx - c.x, sy - c.y) <= ROTATE_ZONE_OUTER) {
      return { kind: 'rotate' };
    }
  }

  // 3. Mid-side rotate zones (small circles outside mid-edge)
  for (let i = 0; i < 4; i++) {
    const mo = handles.midSideOuter[i]!;
    if (Math.hypot(sx - mo.x, sy - mo.y) <= MID_ROTATE_RADIUS) {
      return { kind: 'mid-rotate', edge: edgeNames[i]! };
    }
  }

  // 4. Edge scale strips (along each edge segment)
  const [nw, ne, se, sw] = handles.corners;
  const edgeSegs: [[Pt, Pt], [Pt, Pt], [Pt, Pt], [Pt, Pt]] = [
    [nw!, ne!], // N
    [ne!, se!], // E
    [se!, sw!], // S
    [sw!, nw!], // W
  ];
  for (let i = 0; i < 4; i++) {
    const [a, b] = edgeSegs[i]!;
    if (pointToSegDist(sx, sy, a.x, a.y, b.x, b.y) <= EDGE_HIT_WIDTH) {
      return { kind: 'edge', edge: edgeNames[i]! };
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
  // IMPORTANT: clip() must be applied BEFORE the rotation transform so the mask
  // stays fixed in document space while only the image pixels rotate inside it.
  const rad = rotateDeg * Math.PI / 180;

  if (editMode) {
    // Ghost: rotated image at 50% alpha, unclipped (shows outside mask)
    ctx.save();
    ctx.translate(cxScreen.x, cxScreen.y);
    ctx.rotate(rad);
    ctx.translate(-cxScreen.x, -cxScreen.y);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
    ctx.restore();

    // Clipped: clip first (fixed mask), then rotate → image rotates inside fixed mask
    ctx.save();
    ctx.clip(maskPath, 'nonzero');
    ctx.translate(cxScreen.x, cxScreen.y);
    ctx.rotate(rad);
    ctx.translate(-cxScreen.x, -cxScreen.y);
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.clip(maskPath, 'nonzero');
    ctx.translate(cxScreen.x, cxScreen.y);
    ctx.rotate(rad);
    ctx.translate(-cxScreen.x, -cxScreen.y);
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
    ctx.restore();
  }

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
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#0e0f11';
    ctx.lineWidth = 1;
    for (const corner of handles.corners) {
      ctx.fillRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }

    // Mid-edge scale handles (small rotated rectangles on each edge)
    // `rad` is already defined above from rotateDeg
    const edgeIsHoriz = [true, false, true, false]; // N/S = horiz, E/W = vert
    for (let i = 0; i < 4; i++) {
      const m = handles.midEdges[i]!;
      const horiz = edgeIsHoriz[i];
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(rad);
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#0e0f11';
      ctx.lineWidth = 1;
      if (horiz) {
        ctx.fillRect(-6, -3, 12, 6);
        ctx.strokeRect(-6, -3, 12, 6);
      } else {
        ctx.fillRect(-3, -6, 6, 12);
        ctx.strokeRect(-3, -6, 6, 12);
      }
      ctx.restore();
    }

    // Mid-side rotate dots (small circles outside each edge)
    for (let i = 0; i < 4; i++) {
      const mo = handles.midSideOuter[i]!;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mo.x, mo.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#0e0f11';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Exported handle layout + hit-test (used by GeneratorCanvas pointer handlers)
// ---------------------------------------------------------------------------

export { getHandleLayout, getDrawRect, HANDLE_SIZE };
