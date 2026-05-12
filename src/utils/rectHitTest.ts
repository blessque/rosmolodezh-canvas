import type { Point } from '@/types/geometry';
import type { PerspectiveRect } from '@/types/scene';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angleDeg: number,
): Point {
  const rad = angleDeg * Math.PI / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Extract the 4 document-space corners of a PerspectiveRect,
 * applying corner offsets and rotation — same math as buildRectPath.
 * Returns [TL, TR, BR, BL].
 */
export function getRectCorners(
  rect: PerspectiveRect,
): [Point, Point, Point, Point] {
  const {
    x, y, w, h,
    topLeftOffset, topRightOffset,
    bottomRightOffset, bottomLeftOffset,
    rotation,
  } = rect;

  const cx = x + w / 2;
  const cy = y + h / 2;

  const rawCorners: Array<[number, number]> = [
    [x,     y + topLeftOffset],           // TL
    [x + w, y + topRightOffset],          // TR
    [x + w, y + h + bottomRightOffset],   // BR
    [x,     y + h + bottomLeftOffset],    // BL
  ];

  const [tl, tr, br, bl] = rawCorners.map(([px, py]) =>
    rotatePoint(px, py, cx, cy, rotation),
  ) as [Point, Point, Point, Point];

  return [tl, tr, br, bl];
}

/**
 * Point-in-convex-quad test using the cross-product sign method.
 * Works for any convex polygon with vertices listed in order (CW or CCW).
 */
export function pointInRect(pt: Point, rect: PerspectiveRect): boolean {
  const corners = getRectCorners(rect);
  const n = corners.length;

  // Determine winding once using first edge
  let winding = 0;
  for (let i = 0; i < n; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % n]!;
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (i === 0) {
      winding = cross >= 0 ? 1 : -1;
    } else if (winding * cross < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Compute the approximate area of a rect (w × h in doc units, pre-distortion).
 * Used to find the largest rect for auto-assignment.
 */
export function rectArea(rect: PerspectiveRect): number {
  return rect.w * rect.h;
}
