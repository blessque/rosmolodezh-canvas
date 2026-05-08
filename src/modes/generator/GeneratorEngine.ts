import type { CompoundShape, PerspectiveRect, TopStyle } from '@/types/scene';
import { uid } from '@/utils/uid';

/**
 * GeneratorEngine v4.2
 *
 * Fixes vs v4.1:
 *   - Portrait Y-cascade widths widened (0.72–0.92) to fill horizontal space
 *   - Aspect ratio clamped to 1.75:1 max — no more "sticks"
 *   - Minimum stagger enforced at 2×cornerRadius — no near-coincident edges
 *   - New DistortionMode 'right-anchor': top+left sides orthogonal,
 *     only bottom-right corner skewed (brand identity trapezoid)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DistortionMode =
  | 'lean-right'    // TL flat, TR raised
  | 'lean-left'     // TL raised, TR flat
  | 'both-deep'     // both raised, independent magnitudes
  | 'right-anchor'; // flat top+left, only BR pushed down — brand trapezoid

export type CanvasAspect = 'square' | 'wide' | 'portrait' | 'portrait-4-5';

export type { TopStyle };

export interface ShapeGenerationMeta {
  mode: DistortionMode;
  canvas: CanvasAspect;
  rectCount: 2 | 3;
  relation: 'same' | 'opposite';
  aspectRatio: number;
  depthMag: number;
  yOverlapPct: number;
  sizeRatio: number;
  rotation0: number;
  rotation1: number;
  topStyle0: TopStyle;
  topStyle1: TopStyle;
  xOverlapPct: number;
  yOverlapAbsPct: number;
  overlapAreaPct: number;
}

export interface GenerateOpts {
  forcedMode?: DistortionMode;
  sizeRatio?: number;
  rotation0?: number;
  rotation1?: number;
  topStyle0?: TopStyle;
  topStyle1?: TopStyle;
  rectCount?: 2 | 3;
  relation?: 'same' | 'opposite';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Clamp a rect's w/h so aspect ratio never exceeds maxRatio:1 or 1:maxRatio.
 * Raises the shorter dimension rather than cutting the longer one,
 * to keep coverage guarantees intact.
 */
function clampAspect(w: number, h: number, maxRatio = 1.75): { w: number; h: number } {
  if (w / h > maxRatio) return { w, h: w / maxRatio };       // too wide → taller
  if (h / w > maxRatio) return { w: h / maxRatio, h };       // too tall → wider
  return { w, h };
}

/**
 * Top-edge distortion.
 * baseMag is shared for the whole compound shape (brother-sister consistency).
 * Per-rect variation ±12%.
 * 'flat' and 'right-anchor' modes always return zero (no top displacement).
 */
function applyTopOffset(
  mode: DistortionMode,
  h: number,
  topStyle: TopStyle,
  baseMag: number,
): { tlo: number; tro: number } {
  if (topStyle === 'flat' || mode === 'right-anchor') return { tlo: 0, tro: 0 };
  const mag = baseMag * rand(0.88, 1.12);
  switch (mode) {
    case 'lean-right': return { tlo: 0, tro: -mag * h };
    case 'lean-left':  return { tlo: -mag * h, tro: 0 };
    case 'both-deep':  return { tlo: -mag * rand(0.88, 1.12) * h, tro: -mag * h };
  }
}

/**
 * Bottom-edge distortion — brand-identity.
 * 'right-anchor' mode always returns blo=0 and a significant bro.
 */
function applyBottomOffset(
  mode: DistortionMode,
  h: number,
): { blo: number; bro: number } {
  if (mode === 'right-anchor') {
    // Only BR moves — large push-down creates the brand trapezoid
    return { blo: 0, bro: rand(0.20, 0.48) * h };
  }
  const roll = Math.random();
  let bro: number;
  if (roll < 0.38)      bro = rand(0.10, 0.28) * h;   // BR pushed down
  else if (roll < 0.65) bro = -rand(0.06, 0.18) * h;  // BR raised
  else                  bro = 0;
  const blo = Math.random() < 0.45 ? rand(0.04, 0.14) * h : 0;
  return { blo, bro };
}

/**
 * Symmetry: odd-indexed rects may get the opposite lean direction.
 * 'both-deep' and 'right-anchor' have no natural opposite — return same.
 */
function getModeForRect(
  primary: DistortionMode,
  relation: 'same' | 'opposite',
  rectIndex: number,
): DistortionMode {
  if (relation === 'same' || rectIndex === 0) return primary;
  if (primary === 'lean-right') return 'lean-left';
  if (primary === 'lean-left')  return 'lean-right';
  return primary;
}

function defaultRectCount(canvas: CanvasAspect | undefined): 2 | 3 {
  if (canvas === 'wide' || canvas === 'portrait') return 3;
  if (canvas === 'portrait-4-5') return Math.random() < 0.40 ? 3 : 2;
  return 2;
}

function rotateCorner(
  px: number, py: number, cx: number, cy: number, angleDeg: number,
): [number, number] {
  const rad = angleDeg * Math.PI / 180;
  const dx = px - cx, dy = py - cy;
  return [
    cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  ];
}

function computeBoundingBox(rects: PerspectiveRect[]): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const rect of rects) {
    const { x, y, w, h, topLeftOffset, topRightOffset, bottomRightOffset, bottomLeftOffset, rotation } = rect;
    const cx = x + w / 2, cy = y + h / 2;
    const raw: Array<[number, number]> = [
      [x,     y + topLeftOffset],
      [x + w, y + topRightOffset],
      [x + w, y + h + bottomRightOffset],
      [x,     y + h + bottomLeftOffset],
    ];
    for (const [px, py] of raw) {
      const [rx, ry] = rotateCorner(px, py, cx, cy, rotation);
      minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
    }
  }
  return { minX, maxX, minY, maxY };
}

// ---------------------------------------------------------------------------
// Centralized rect builder
// ---------------------------------------------------------------------------

/**
 * Build a single PerspectiveRect applying all style rules:
 *  - right-anchor: tlo=tro=blo=rotation=0, bro=large
 *  - flat: tlo=tro=0, rotation=0
 *  - angled: use applyTopOffset with baseMag
 * Aspect ratio is clamped before building.
 */
function buildRect(
  x: number, y: number,
  rawW: number, rawH: number,
  cornerRadius: number,
  mode: DistortionMode,
  topStyle: TopStyle,
  rotation: number,
  baseMag: number,
): PerspectiveRect {
  const { w, h } = clampAspect(rawW, rawH);

  const isRightAnchor = mode === 'right-anchor';
  const effectiveRotation = (isRightAnchor || topStyle === 'flat') ? 0 : rotation;

  const { tlo, tro } = applyTopOffset(mode, h, topStyle, baseMag);
  const { blo, bro } = applyBottomOffset(mode, h);

  return {
    id: uid(), x, y, w, h, cornerRadius,
    topLeftOffset: tlo, topRightOffset: tro,
    bottomRightOffset: bro, bottomLeftOffset: blo,
    rotation: effectiveRotation,
    topStyle: isRightAnchor ? 'flat' : topStyle,
  };
}

// ---------------------------------------------------------------------------
// 2-rect layout
// ---------------------------------------------------------------------------

function buildTwoRectLayout(
  docWidth: number, docHeight: number, cornerRadius: number,
  primaryMode: DistortionMode, relation: 'same' | 'opposite',
  staggerRight: boolean, sizeRatio: number,
  rotation0: number, rotation1: number,
  topStyle0: TopStyle, topStyle1: TopStyle,
  baseMag: number,
): { rects: PerspectiveRect[]; overlapFrac: number } {
  const minStagger = 2 * cornerRadius;

  const w0 = rand(0.60, 0.88) * docWidth;
  const h0 = rand(0.42, 0.62) * docHeight;
  const rect0 = buildRect(
    0, 0, w0, h0, cornerRadius,
    getModeForRect(primaryMode, relation, 0), topStyle0, rotation0, baseMag,
  );

  const w1 = rand(0.55, 0.85) * docWidth;
  const h1 = h0 * sizeRatio;
  const xStagger = Math.max(minStagger, rand(0.05, 0.18) * docWidth);
  const x1 = staggerRight ? xStagger : -xStagger;

  const overlapFrac = rand(0.50, 0.72);
  let y1 = h0 * overlapFrac;
  const minOverlap = 0.22 * Math.min(h0, h1);
  if ((h0 - y1) < minOverlap) y1 = h0 - minOverlap;

  const rect1 = buildRect(
    x1, y1, w1, h1, cornerRadius,
    getModeForRect(primaryMode, relation, 1), topStyle1, rotation1, baseMag,
  );

  return { rects: [rect0, rect1], overlapFrac };
}

// ---------------------------------------------------------------------------
// 3-rect Y-cascade (portrait / portrait-4-5 / square)
// ---------------------------------------------------------------------------

function buildThreeRectYCascade(
  docWidth: number, docHeight: number, cornerRadius: number,
  primaryMode: DistortionMode, relation: 'same' | 'opposite',
  staggerRight: boolean, sr01: number,
  rotation0: number, rotation1: number,
  topStyle0: TopStyle, topStyle1: TopStyle,
  baseMag: number,
): { rects: PerspectiveRect[]; overlapFrac01: number } {
  const minStagger = 2 * cornerRadius;
  const sr12 = rand(0.70, 0.88);

  // ── Height coverage: solve h0 so total Y span ≈ docHeight ──────────────
  const yOvlpAbs  = rand(0.07, 0.13) * docHeight;
  const targetH   = docHeight * rand(0.93, 0.98);
  const h0        = Math.min(Math.max(
    (targetH + 2 * yOvlpAbs) / (1 + sr01 + sr01 * sr12),
    0.28 * docHeight,
  ), 0.55 * docHeight);
  const h1        = h0 * sr01;
  const h2        = h1 * sr12;
  const yOvlp     = Math.max(0.04 * docHeight, (h0 + h1 + h2 - targetH) / 2);
  const y1        = h0 - yOvlp;
  const y2        = y1 + h1 - yOvlp;
  const overlapFrac01 = yOvlp / h0;

  // ── Widths: wide enough that after height-constrained scale, X fills too ─
  // Need: shapeW × (targetH / shapeH) ≥ targetW
  // → shapeW ≥ shapeH × (docW / docH)
  // Use generous widths so the X span covers docWidth even at height-scale.
  const w0 = rand(0.72, 0.92) * docWidth;
  const w1 = rand(0.70, 0.90) * docWidth;
  const w2 = rand(0.68, 0.88) * docWidth;

  // ── X stagger with guaranteed minimum ────────────────────────────────────
  const xStagger1 = Math.max(minStagger, rand(0.05, 0.16) * docWidth);
  const xStagger2 = Math.max(minStagger, rand(0.05, 0.16) * docWidth);
  const x1 = staggerRight ?  xStagger1 : -xStagger1;
  const x2 = x1 + (staggerRight ? xStagger2 : -xStagger2);

  const topStyle2: TopStyle = Math.random() < 0.40 ? 'flat' : 'angled';

  const rect0 = buildRect(0,  0,  w0, h0, cornerRadius, getModeForRect(primaryMode, relation, 0), topStyle0, rotation0, baseMag);
  const rect1 = buildRect(x1, y1, w1, h1, cornerRadius, getModeForRect(primaryMode, relation, 1), topStyle1, rotation1, baseMag);
  const rect2 = buildRect(x2, y2, w2, h2, cornerRadius, getModeForRect(primaryMode, relation, 2), topStyle2, rand(-8, 8), baseMag);

  return { rects: [rect0, rect1, rect2], overlapFrac01 };
}

// ---------------------------------------------------------------------------
// 3-rect X-cascade (wide)
// ---------------------------------------------------------------------------

function buildThreeRectXCascade(
  docWidth: number, docHeight: number, cornerRadius: number,
  primaryMode: DistortionMode, relation: 'same' | 'opposite',
  sr01: number,
  rotation0: number, rotation1: number,
  topStyle0: TopStyle, topStyle1: TopStyle,
  baseMag: number,
): { rects: PerspectiveRect[]; overlapFrac01: number } {
  const minStagger = 2 * cornerRadius;
  const sr12 = rand(0.70, 0.88);

  // ── Width coverage: solve w0 so total X span ≈ docWidth ──────────────────
  const xOvlpAbs = rand(0.07, 0.13) * docWidth;
  const targetW  = docWidth * rand(0.93, 0.98);
  const w0       = Math.min(Math.max(
    (targetW + 2 * xOvlpAbs) / (1 + sr01 + sr01 * sr12),
    0.28 * docWidth,
  ), 0.58 * docWidth);
  const w1       = w0 * sr01;
  const w2       = w1 * sr12;
  const xOvlp   = Math.max(0.04 * docWidth, (w0 + w1 + w2 - targetW) / 2);
  const x1      = w0 - xOvlp;
  const x2      = x1 + w1 - xOvlp;
  const overlapFrac01 = xOvlp / w0;

  // ── Heights: tall enough to fill, short enough not to be sticks ──────────
  const h0 = rand(0.50, 0.72) * docHeight;
  const h1 = rand(0.48, 0.70) * docHeight;
  const h2 = rand(0.46, 0.68) * docHeight;

  // ── Y stagger with guaranteed minimum ────────────────────────────────────
  const staggerDown = Math.random() < 0.5;
  const yStagger1 = Math.max(minStagger, rand(0.06, 0.15) * docHeight);
  const yStagger2 = Math.max(minStagger, rand(0.03, 0.09) * docHeight);
  const y1 = staggerDown ? yStagger1 : -yStagger1;
  const y2 = y1 + (staggerDown ? yStagger2 : -yStagger2);

  const topStyle2: TopStyle = Math.random() < 0.40 ? 'flat' : 'angled';

  const rect0 = buildRect(0,  0,  w0, h0, cornerRadius, getModeForRect(primaryMode, relation, 0), topStyle0, rotation0, baseMag);
  const rect1 = buildRect(x1, y1, w1, h1, cornerRadius, getModeForRect(primaryMode, relation, 1), topStyle1, rotation1, baseMag);
  const rect2 = buildRect(x2, y2, w2, h2, cornerRadius, getModeForRect(primaryMode, relation, 2), topStyle2, rand(-8, 8), baseMag);

  return { rects: [rect0, rect1, rect2], overlapFrac01 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateCompoundShape(
  docWidth: number,
  docHeight: number,
  opts?: GenerateOpts,
  canvasAspect?: CanvasAspect,
): { shape: CompoundShape; meta: ShapeGenerationMeta } {
  const cornerRadius = 0.04 * Math.min(docWidth, docHeight);

  const randomModes: DistortionMode[] = ['lean-right', 'lean-left', 'both-deep', 'right-anchor'];
  const primaryMode: DistortionMode =
    opts?.forcedMode ?? randomModes[Math.floor(Math.random() * randomModes.length)]!;

  // right-anchor has no logical opposite; force 'same' to avoid misleading export data
  const relation: 'same' | 'opposite' =
    primaryMode === 'right-anchor'
      ? 'same'
      : (opts?.relation ?? (Math.random() < 0.5 ? 'same' : 'opposite'));

  const rectCountActual: 2 | 3 = opts?.rectCount ?? defaultRectCount(canvasAspect);

  const staggerRight =
    primaryMode === 'lean-left'    ? true            // expose rect[0]'s raised LEFT edge
    : primaryMode === 'lean-right' || primaryMode === 'right-anchor'
      ? false                                        // expose rect[0]'s distorted RIGHT edge
      : Math.random() < 0.5;                        // both-deep: either direction

  const sizeRatio = opts?.sizeRatio ?? (rectCountActual === 3 ? rand(0.70, 0.88) : rand(0.57, 0.85));

  const rotation0 = opts?.rotation0 ?? rand(-8, 8);
  const rotation1 = opts?.rotation1 ?? rand(-8, 8);

  // right-anchor always has flat top — honour explicit opts otherwise
  const topStyle0: TopStyle =
    primaryMode === 'right-anchor'
      ? 'flat'
      : (opts?.topStyle0 ?? (Math.random() < 0.40 ? 'flat' : 'angled'));
  const topStyle1: TopStyle =
    primaryMode === 'right-anchor'
      ? 'flat'
      : (opts?.topStyle1 ?? (Math.random() < 0.40 ? 'flat' : 'angled'));

  // Shared distortion magnitude — keeps rects "brothers and sisters"
  const baseMag = rand(0.22, 0.38);

  // ── Build rects ────────────────────────────────────────────────────────────
  let rects: PerspectiveRect[];
  let overlapFrac: number;

  if (rectCountActual === 3) {
    if (canvasAspect === 'wide') {
      const r = buildThreeRectXCascade(
        docWidth, docHeight, cornerRadius,
        primaryMode, relation, sizeRatio,
        rotation0, rotation1, topStyle0, topStyle1, baseMag,
      );
      rects = r.rects; overlapFrac = r.overlapFrac01;
    } else {
      const r = buildThreeRectYCascade(
        docWidth, docHeight, cornerRadius,
        primaryMode, relation, staggerRight, sizeRatio,
        rotation0, rotation1, topStyle0, topStyle1, baseMag,
      );
      rects = r.rects; overlapFrac = r.overlapFrac01;
    }
  } else {
    const r = buildTwoRectLayout(
      docWidth, docHeight, cornerRadius,
      primaryMode, relation, staggerRight, sizeRatio,
      rotation0, rotation1, topStyle0, topStyle1, baseMag,
    );
    rects = r.rects; overlapFrac = r.overlapFrac;
  }

  // ── Scale-to-fit (2% margin each side) ────────────────────────────────────
  const MARGIN = 0.02;
  const bbox   = computeBoundingBox(rects);
  const shapeW = bbox.maxX - bbox.minX;
  const shapeH = bbox.maxY - bbox.minY;
  const scale  = Math.min(
    (docWidth  * (1 - 2 * MARGIN)) / shapeW,
    (docHeight * (1 - 2 * MARGIN)) / shapeH,
  );
  const scaledW = shapeW * scale;
  const scaledH = shapeH * scale;
  const offsetX = (docWidth  - scaledW) / 2 - bbox.minX * scale;
  const offsetY = (docHeight - scaledH) / 2 - bbox.minY * scale;

  for (const rect of rects) {
    rect.x                 = rect.x                 * scale + offsetX;
    rect.y                 = rect.y                 * scale + offsetY;
    rect.w                 = rect.w                 * scale;
    rect.h                 = rect.h                 * scale;
    rect.topLeftOffset     = rect.topLeftOffset     * scale;
    rect.topRightOffset    = rect.topRightOffset    * scale;
    rect.bottomRightOffset = rect.bottomRightOffset * scale;
    rect.bottomLeftOffset  = rect.bottomLeftOffset  * scale;
    // cornerRadius: canvas-relative — NOT scaled
  }

  // ── Overlap metrics (axis-aligned, post-scale, r0 vs r1) ──────────────────
  const r0 = rects[0]!;
  const r1 = rects[1]!;
  const xOvW = Math.max(0, Math.min(r0.x + r0.w, r1.x + r1.w) - Math.max(r0.x, r1.x));
  const yOvH = Math.max(0, Math.min(r0.y + r0.h, r1.y + r1.h) - Math.max(r0.y, r1.y));
  const minW = Math.min(r0.w, r1.w), minH = Math.min(r0.h, r1.h);
  const smArea = Math.min(r0.w * r0.h, r1.w * r1.h);

  const avgDepthMag =
    rects.reduce((s, r) => s + (Math.abs(r.topLeftOffset) + Math.abs(r.topRightOffset)) / 2 / r.h, 0)
    / rects.length;

  const meta: ShapeGenerationMeta = {
    mode: primaryMode, canvas: canvasAspect ?? 'square',
    rectCount: rectCountActual, relation,
    aspectRatio:   r0.w / r0.h,
    depthMag:      avgDepthMag,
    yOverlapPct:   overlapFrac,
    sizeRatio,
    rotation0,     rotation1,
    topStyle0,     topStyle1,
    xOverlapPct:    minW > 0    ? xOvW / minW    : 0,
    yOverlapAbsPct: minH > 0    ? yOvH / minH    : 0,
    overlapAreaPct: smArea > 0  ? (xOvW * yOvH) / smArea : 0,
  };

  return {
    shape: { type: 'compound', id: uid(), rects, maskedRectIndex: -1 },
    meta,
  };
}
