import paper from 'paper';
import type { CompoundShape, PerspectiveRect } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas } from '@/utils/coordinates';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angleDeg: number,
): paper.Point {
  const rad = angleDeg * Math.PI / 180;
  const dx  = px - cx;
  const dy  = py - cy;
  return new paper.Point(
    cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  );
}

function normalize(v: paper.Point): paper.Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-10) return new paper.Point(0, 0);
  return new paper.Point(v.x / len, v.y / len);
}

function vecLength(v: paper.Point): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Build a smooth-cornered Paper.js path for a single PerspectiveRect. */
function buildRectPath(rect: PerspectiveRect): paper.Path {
  const {
    x, y, w, h,
    topLeftOffset, topRightOffset,
    bottomRightOffset, bottomLeftOffset,
    cornerRadius: r, rotation,
  } = rect;

  // Geometric center of the rect (used as rotation pivot)
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Compute the 4 raw corners of the quadrilateral, then rotate each around center.
  // Top offsets: negative = raised up. Bottom offsets: positive = pushed further down.
  const rawCorners: Array<[number, number]> = [
    [x,     y + topLeftOffset],              // TL
    [x + w, y + topRightOffset],             // TR
    [x + w, y + h + bottomRightOffset],      // BR
    [x,     y + h + bottomLeftOffset],       // BL
  ];
  const corners: paper.Point[] = rawCorners.map(
    ([px, py]) => rotatePoint(px, py, cx, cy, rotation),
  );

  const n = corners.length; // 4
  const segments: paper.Segment[] = [];

  for (let i = 0; i < n; i++) {
    const corner = corners[i]!;
    const prev   = corners[(i + n - 1) % n]!;
    const next   = corners[(i + 1) % n]!;

    // Edge vectors from corner toward prev / next
    const toPrev = new paper.Point(prev.x - corner.x, prev.y - corner.y);
    const toNext = new paper.Point(next.x - corner.x, next.y - corner.y);

    const prevLen = vecLength(toPrev);
    const nextLen = vecLength(toNext);

    const prevDir = normalize(toPrev);
    const nextDir = normalize(toNext);

    // Pull-back distance: r * 1.52, clamped to half the shorter edge
    const pullback = Math.min(r * 1.52, prevLen / 2, nextLen / 2);

    // Tangent points approaching / leaving the corner
    const tp_in  = new paper.Point(
      corner.x + prevDir.x * pullback,
      corner.y + prevDir.y * pullback,
    );
    const tp_out = new paper.Point(
      corner.x + nextDir.x * pullback,
      corner.y + nextDir.y * pullback,
    );

    const handleLen = r * 0.89;

    // At tp_in: out-handle points *toward* the corner (negate prevDir)
    const handleOut_in = new paper.Point(
      -prevDir.x * handleLen,
      -prevDir.y * handleLen,
    );

    // At tp_out: in-handle points *toward* the corner (negate nextDir)
    const handleIn_out = new paper.Point(
      -nextDir.x * handleLen,
      -nextDir.y * handleLen,
    );

    // Add two segments per corner: the "arriving" tangent point and the "leaving" tangent point
    segments.push(new paper.Segment(tp_in,  new paper.Point(0, 0), handleOut_in));
    segments.push(new paper.Segment(tp_out, handleIn_out, new paper.Point(0, 0)));
  }

  const path = new paper.Path(segments);
  path.closed = true;
  return path;
}

// ---------------------------------------------------------------------------
// Inner-corner rounding after unite()
// ---------------------------------------------------------------------------

/**
 * Round concave junction vertices that unite() inserts into the united path.
 * Detection criterion: segment with both handles near-zero → was a straight-edge
 * intersection vertex. Cross product determines concavity (CW path, y-down).
 */
function roundConcaveJunctions(pathItem: paper.PathItem, r: number): void {
  if (r <= 0) return;

  const paths: paper.Path[] = [];
  if (pathItem instanceof paper.CompoundPath) {
    for (const child of (pathItem as paper.CompoundPath).children) {
      paths.push(child as paper.Path);
    }
  } else {
    paths.push(pathItem as paper.Path);
  }

  for (const path of paths) {
    roundConcavePath(path, r);
  }
}

function roundConcavePath(path: paper.Path, r: number): void {
  const segs = path.segments;
  const n = segs.length;
  const eps = 3; // doc-unit threshold for "near-zero handle"

  const newSegs: paper.Segment[] = [];

  for (let i = 0; i < n; i++) {
    const prev = segs[(i + n - 1) % n]!;
    const curr = segs[i]!;
    const next = segs[(i + 1) % n]!;

    const hiLen = Math.sqrt(curr.handleIn.x ** 2 + curr.handleIn.y ** 2);
    const hoLen = Math.sqrt(curr.handleOut.x ** 2 + curr.handleOut.y ** 2);

    // arc-split cases: unite() subdivides a bezier arc at the intersection,
    // leaving one non-zero handle and one zero handle at the junction vertex.
    const arcIn  = hiLen > eps && hoLen < eps; // arc arriving, straight departing
    const arcOut = hiLen < eps && hoLen > eps; // straight arriving, arc departing
    const bothStraight = hiLen < eps && hoLen < eps;

    if (bothStraight || arcIn || arcOut) {
      let inX: number, inY: number;
      let outX: number, outY: number;

      if (arcIn) {
        // Arc tangent at end of incoming bezier: derivative at t=1 = P3 - P2 = -handleIn
        inX = -curr.handleIn.x;
        inY = -curr.handleIn.y;
        outX = next.point.x - curr.point.x;
        outY = next.point.y - curr.point.y;
      } else if (arcOut) {
        // Straight arrives, arc departs: tangent at t=0 = handleOut direction
        inX = curr.point.x - prev.point.x;
        inY = curr.point.y - prev.point.y;
        outX = curr.handleOut.x;
        outY = curr.handleOut.y;
      } else {
        // Both straight — use bezier control-point tangent for adjacent arc segments
        const prevHoLen = Math.sqrt(prev.handleOut.x ** 2 + prev.handleOut.y ** 2);
        if (prevHoLen > eps) {
          inX = curr.point.x - (prev.point.x + prev.handleOut.x);
          inY = curr.point.y - (prev.point.y + prev.handleOut.y);
        } else {
          inX = curr.point.x - prev.point.x;
          inY = curr.point.y - prev.point.y;
        }

        const nextHiLen = Math.sqrt(next.handleIn.x ** 2 + next.handleIn.y ** 2);
        if (nextHiLen > eps) {
          outX = (next.point.x + next.handleIn.x) - curr.point.x;
          outY = (next.point.y + next.handleIn.y) - curr.point.y;
        } else {
          outX = next.point.x - curr.point.x;
          outY = next.point.y - curr.point.y;
        }
      }

      const cross = inX * outY - inY * outX; // negative → concave (CW path, y-down)

      if (cross < -1e-6) {
        // Chord lengths for pullback computation (conservative, prevents overshoot)
        const inLen  = Math.sqrt(
          (curr.point.x - prev.point.x) ** 2 + (curr.point.y - prev.point.y) ** 2,
        );
        const outLen = Math.sqrt(
          (next.point.x - curr.point.x) ** 2 + (next.point.y - curr.point.y) ** 2,
        );

        const inMag  = Math.sqrt(inX * inX + inY * inY);
        const outMag = Math.sqrt(outX * outX + outY * outY);
        if (inMag < 1e-10 || outMag < 1e-10) { newSegs.push(curr); continue; }

        const inNx  = inX  / inMag;
        const inNy  = inY  / inMag;
        const outNx = outX / outMag;
        const outNy = outY / outMag;
        const handleLen = r * 0.89;

        if (arcIn) {
          // Cannot pull back into the arc — zero pullback on arc side.
          // C1 blend: keep handleIn intact, set handleOut along arc tangent.
          const pullback = Math.min(r * 1.52, outLen * 0.49);
          if (outLen < 1e-10) { newSegs.push(curr); continue; }
          const tpOut = new paper.Point(
            curr.point.x + outNx * pullback,
            curr.point.y + outNy * pullback,
          );
          newSegs.push(new paper.Segment(
            curr.point,
            curr.handleIn,                                              // preserve arc
            new paper.Point(inNx * handleLen, inNy * handleLen),       // C1 with arc
          ));
          newSegs.push(new paper.Segment(
            tpOut,
            new paper.Point(-outNx * handleLen, -outNy * handleLen),
            new paper.Point(0, 0),
          ));
        } else if (arcOut) {
          // Cannot pull forward into the arc — zero pullback on arc side.
          const pullback = Math.min(r * 1.52, inLen * 0.49);
          if (inLen < 1e-10) { newSegs.push(curr); continue; }
          const tpIn = new paper.Point(
            curr.point.x - inNx * pullback,
            curr.point.y - inNy * pullback,
          );
          newSegs.push(new paper.Segment(
            tpIn,
            new paper.Point(0, 0),
            new paper.Point(inNx * handleLen, inNy * handleLen),
          ));
          newSegs.push(new paper.Segment(
            curr.point,
            new paper.Point(-outNx * handleLen, -outNy * handleLen),   // C1 with arc
            curr.handleOut,                                             // preserve arc
          ));
        } else {
          // Both straight: symmetric fillet
          if (inLen < 1e-10 || outLen < 1e-10) { newSegs.push(curr); continue; }
          const pullback = Math.min(r * 1.52, inLen * 0.49, outLen * 0.49);
          const tpIn = new paper.Point(
            curr.point.x - inNx * pullback,
            curr.point.y - inNy * pullback,
          );
          const tpOut = new paper.Point(
            curr.point.x + outNx * pullback,
            curr.point.y + outNy * pullback,
          );
          newSegs.push(new paper.Segment(
            tpIn,
            new paper.Point(0, 0),
            new paper.Point(inNx * handleLen, inNy * handleLen),
          ));
          newSegs.push(new paper.Segment(
            tpOut,
            new paper.Point(-outNx * handleLen, -outNy * handleLen),
            new paper.Point(0, 0),
          ));
        }
        continue; // replaced curr with fillet segments
      }
    }

    // Not a concave junction — keep as-is (preserves existing bezier arcs)
    newSegs.push(new paper.Segment(curr.point, curr.handleIn, curr.handleOut));
  }

  path.segments = newSegs;
}

// ---------------------------------------------------------------------------
// Canvas 2D rendering helper
// ---------------------------------------------------------------------------

/**
 * Convert a Paper.js PathItem (in document coordinates) to a Path2D in
 * canvas (screen) coordinates, ready for ctx.fill() / ctx.stroke().
 */
function paperItemToPath2D(
  pathItem: paper.PathItem,
  viewport: ViewportState,
): Path2D {
  const path2d = new Path2D();

  const paths: paper.Path[] = [];
  if (pathItem instanceof paper.CompoundPath) {
    for (const child of (pathItem as paper.CompoundPath).children) {
      paths.push(child as paper.Path);
    }
  } else {
    paths.push(pathItem as paper.Path);
  }

  for (const path of paths) {
    const segs = path.segments;
    if (segs.length === 0) continue;

    const first = segs[0]!;
    const p0 = documentToCanvas({ x: first.point.x, y: first.point.y }, viewport);
    path2d.moveTo(p0.x, p0.y);

    for (let i = 0; i < segs.length; i++) {
      const curr = segs[i]!;
      const next = segs[(i + 1) % segs.length]!;

      const isLine =
        curr.handleOut.x === 0 && curr.handleOut.y === 0 &&
        next.handleIn.x  === 0 && next.handleIn.y  === 0;

      const ep = documentToCanvas({ x: next.point.x, y: next.point.y }, viewport);

      if (isLine) {
        path2d.lineTo(ep.x, ep.y);
      } else {
        const cp1 = documentToCanvas({
          x: curr.point.x + curr.handleOut.x,
          y: curr.point.y + curr.handleOut.y,
        }, viewport);
        const cp2 = documentToCanvas({
          x: next.point.x + next.handleIn.x,
          y: next.point.y + next.handleIn.y,
        }, viewport);
        path2d.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, ep.x, ep.y);
      }
    }

    path2d.closePath();
  }

  return path2d;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Build the smooth, united outline of a CompoundShape using Paper.js geometry.
 * The returned PathItem is in document coordinates.
 *
 * Requires the caller to have already activated the target PaperScope via
 * `scope.activate()`.
 */
export function buildSmoothPath(
  shape: CompoundShape,
  scope: paper.PaperScope,
): paper.PathItem {
  scope.activate();

  if (shape.rects.length === 0) {
    return new paper.Path();
  }

  let result: paper.PathItem = buildRectPath(shape.rects[0]!);

  for (let i = 1; i < shape.rects.length; i++) {
    const rectPath = buildRectPath(shape.rects[i]!);
    result = result.unite(rectPath, { insert: false });
    rectPath.remove();
  }

  // Round the concave junction vertices created by unite()
  roundConcaveJunctions(result, shape.rects[0]?.cornerRadius ?? 30);

  return result;
}

// ---------------------------------------------------------------------------

/**
 * Render a CompoundShape onto a Canvas 2D context in viewport (screen) space.
 * Uses Paper.js geometry for smooth bezier outer corners and rounded inner junctions.
 */
export function renderCompound(
  ctx: CanvasRenderingContext2D,
  shape: CompoundShape,
  color: string,
  viewport: ViewportState,
): void {
  const canvasEl = document.createElement('canvas');
  canvasEl.width  = 1;
  canvasEl.height = 1;

  const scope = new paper.PaperScope();
  scope.setup(canvasEl);
  scope.activate();

  const pathItem = buildSmoothPath(shape, scope);
  const path2d   = paperItemToPath2D(pathItem, viewport);

  scope.project.clear();

  ctx.fillStyle = color;
  ctx.fill(path2d, 'nonzero');
}

// ---------------------------------------------------------------------------

/**
 * Return the SVG `d` attribute string for a CompoundShape's outline.
 * Coordinates are in document space (0..docWidth, 0..docHeight).
 */
export function getCompoundSVGPath(
  shape: CompoundShape,
  docWidth: number,
  docHeight: number,
): string {
  const offscreen = document.createElement('canvas');
  offscreen.width  = docWidth;
  offscreen.height = docHeight;

  const scope = new paper.PaperScope();
  scope.setup(offscreen);
  scope.activate();

  const pathItem = buildSmoothPath(shape, scope);

  // paper.PathItem exposes `pathData` as the SVG `d` string
  const svgData = (pathItem as unknown as { pathData: string }).pathData;

  scope.project.clear();

  return svgData ?? '';
}
