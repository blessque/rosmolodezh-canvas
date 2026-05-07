import paper from 'paper';
import type { CompoundShape, PerspectiveRect } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas } from '@/utils/coordinates';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
  const { x, y, w, h, depth, expand, cornerRadius: r } = rect;

  // Compute the 4 corners of the quadrilateral
  let corners: paper.Point[];
  if (expand === 'right') {
    // TL, TR, BR, BL
    corners = [
      new paper.Point(x,     y),
      new paper.Point(x + w, y - depth),
      new paper.Point(x + w, y + h),
      new paper.Point(x,     y + h),
    ];
  } else {
    // expand === 'left'
    corners = [
      new paper.Point(x,     y - depth),
      new paper.Point(x + w, y),
      new paper.Point(x + w, y + h),
      new paper.Point(x,     y + h),
    ];
  }

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
    // Return an empty path to avoid crashing callers
    return new paper.Path();
  }

  let result: paper.PathItem = buildRectPath(shape.rects[0]!);

  for (let i = 1; i < shape.rects.length; i++) {
    const rectPath = buildRectPath(shape.rects[i]!);
    result = result.unite(rectPath, { insert: false });
    rectPath.remove();
  }

  return result;
}

// ---------------------------------------------------------------------------

/**
 * Render a CompoundShape onto a Canvas 2D context in viewport (screen) space.
 */
export function renderCompound(
  ctx: CanvasRenderingContext2D,
  shape: CompoundShape,
  color: string,
  viewport: ViewportState,
): void {
  // Create an isolated PaperScope backed by a tiny offscreen canvas —
  // we only need the geometry engine, not actual rendering.
  const offscreen = document.createElement('canvas');
  offscreen.width  = 1;
  offscreen.height = 1;

  const scope = new paper.PaperScope();
  scope.setup(offscreen);
  scope.activate();

  const pathItem = buildSmoothPath(shape, scope);

  // Flatten to a single paper.Path if the union produced a CompoundPath
  // (which can happen when rects don't overlap).
  const paths: paper.Path[] = [];
  if (pathItem instanceof scope.CompoundPath) {
    const cp = pathItem as paper.CompoundPath;
    for (const child of cp.children) {
      paths.push(child as paper.Path);
    }
  } else {
    paths.push(pathItem as paper.Path);
  }

  // Build a Path2D from each paper.Path, converting each segment point
  // and its bezier handles from document space to canvas space.
  const path2d = new Path2D();

  for (const paperPath of paths) {
    const segs = paperPath.segments;
    if (segs.length === 0) continue;

    const firstSeg = segs[0]!;
    const firstPt  = documentToCanvas(
      { x: firstSeg.point.x, y: firstSeg.point.y },
      viewport,
    );
    path2d.moveTo(firstPt.x, firstPt.y);

    for (let i = 1; i < segs.length; i++) {
      const prevSeg = segs[i - 1]!;
      const seg     = segs[i]!;

      const cp1 = documentToCanvas(
        {
          x: prevSeg.point.x + prevSeg.handleOut.x,
          y: prevSeg.point.y + prevSeg.handleOut.y,
        },
        viewport,
      );
      const cp2 = documentToCanvas(
        {
          x: seg.point.x + seg.handleIn.x,
          y: seg.point.y + seg.handleIn.y,
        },
        viewport,
      );
      const pt = documentToCanvas(
        { x: seg.point.x, y: seg.point.y },
        viewport,
      );
      path2d.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, pt.x, pt.y);
    }

    // Close the sub-path with a bezier from last segment back to first
    const lastSeg = segs[segs.length - 1]!;
    const closeCp1 = documentToCanvas(
      {
        x: lastSeg.point.x  + lastSeg.handleOut.x,
        y: lastSeg.point.y  + lastSeg.handleOut.y,
      },
      viewport,
    );
    const closeCp2 = documentToCanvas(
      {
        x: firstSeg.point.x + firstSeg.handleIn.x,
        y: firstSeg.point.y + firstSeg.handleIn.y,
      },
      viewport,
    );
    path2d.bezierCurveTo(
      closeCp1.x, closeCp1.y,
      closeCp2.x, closeCp2.y,
      firstPt.x,  firstPt.y,
    );

    path2d.closePath();
  }

  ctx.fillStyle = color;
  ctx.fill(path2d);

  // Clean up the Paper.js scope
  scope.project.clear();
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
