import type { CompoundShape, PerspectiveRect } from '@/types/scene';
import type { GeneratorComplexity } from '@/store/uiStore';
import { uid } from '@/utils/uid';

/**
 * GeneratorEngine — compound shape math.
 * Generates perspective rectangles with staggered placement and centering.
 */

/**
 * Random value in [min, max].
 */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Compute bounding box across all corners of all rects.
 * For expand='right': corners are (x, y), (x+w, y-depth), (x+w, y+h), (x, y+h)
 * For expand='left': corners are (x, y-depth), (x+w, y), (x+w, y+h), (x, y+h)
 */
function computeBoundingBox(rects: PerspectiveRect[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    const { x, y, w, h, depth, expand } = rect;

    let corners: Array<[number, number]>;

    if (expand === 'right') {
      corners = [
        [x, y],
        [x + w, y - depth],
        [x + w, y + h],
        [x, y + h],
      ];
    } else {
      // expand === 'left'
      corners = [
        [x, y - depth],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
    }

    for (const [cx, cy] of corners) {
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy);
    }
  }

  return { minX, maxX, minY, maxY };
}

export function generateCompoundShape(
  complexity: GeneratorComplexity,
  docWidth: number,
  docHeight: number,
): CompoundShape {
  const rects: PerspectiveRect[] = [];

  // Generate N rects with dimensions and perspective
  for (let i = 0; i < complexity; i++) {
    const w = rand(docWidth * 0.22, docWidth * 0.5);
    const h = rand(docWidth * 0.08, docWidth * 0.2);
    const expand = Math.random() < 0.5 ? 'left' : ('right' as const);
    const depth = rand(h * 0.12, h * 0.28);
    const cornerRadius = rand(Math.min(w, h) * 0.15, Math.min(w, h) * 0.35);

    let x: number;
    let y: number;

    if (i === 0) {
      x = 0;
      y = 0;
    } else {
      const prev = rects[i - 1]!;
      const overlapFactor = rand(0.45, 0.7);
      x = prev.x + prev.w * (1 - overlapFactor);

      const stepY = rand(h * 0.2, h * 0.45);
      if (i % 2 === 1) {
        y = prev.y + stepY;
      } else {
        y = prev.y - stepY;
      }
    }

    rects.push({
      id: uid(),
      x,
      y,
      w,
      h,
      cornerRadius,
      expand,
      depth,
    });
  }

  // Compute bounding box and center
  const bbox = computeBoundingBox(rects);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  const targetX = docWidth / 2;
  const targetY = docHeight / 2;
  const offsetX = targetX - centerX;
  const offsetY = targetY - centerY;

  // Apply centering translation
  for (const rect of rects) {
    rect.x += offsetX;
    rect.y += offsetY;
  }

  return {
    type: 'compound',
    id: uid(),
    rects,
    maskedRectIndex: -1,
  };
}
