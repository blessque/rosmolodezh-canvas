/**
 * StampEngine — stamp placement along pointer path + casual zig-zag generator.
 */

import { uid } from '@/utils/uid';
import type { StampInstance, StampStroke } from '@/types/scene';

// ─── Casual zig-zag path ──────────────────────────────────────────────────────

/**
 * Generate a casual zig-zag polyline (bouncing-ball trace) across the canvas.
 *
 * Sweep axis: randomly chosen — wide canvases lean toward X-sweep (65%),
 * portrait canvases lean toward Y-sweep (65%), but either is possible on any
 * canvas so wide canvases can start mid-left-side and portrait canvases can
 * start on the top or bottom edge.
 *
 * Non-physics angles: every segment independently picks its own slope in the
 * range 1.5–4.5. Because incoming and outgoing slopes are independent, the
 * angle of incidence ≠ angle of reflection. V-angles at turns range ~25°–67°
 * with natural variation across bounces.
 *
 * Start position: the starting point is at the leading edge of the sweep
 * (left edge for X-sweep, top edge for Y-sweep). The perpendicular coordinate
 * is fully random across the usable canvas — no artificial bias toward borders.
 */
export function computeCasualZigZagPath(
  docW: number,
  docH: number,
): { x: number; y: number }[] {
  const margin = Math.min(docW, docH) * 0.06;
  const usableW = docW - 2 * margin;
  const usableH = docH - 2 * margin;

  // Probabilistic sweep axis — orientation-biased but not deterministic
  const aspect = docW / docH;
  const xSweep = Math.random() < (aspect >= 1 ? 0.65 : 0.35);

  if (xSweep) {
    // ── X progresses left→right; Y bounces top↔bottom ──────────────────────
    const startX = margin + Math.random() * usableW * 0.15;
    const startY = margin + Math.random() * usableH; // anywhere on left edge
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let x = startX;
    let y = startY;
    // Start heading toward the farther Y border to avoid a degenerate first segment
    let goingDown = y < margin + usableH * 0.5;

    while (x < docW - margin) {
      // Independent slope per segment → incidence ≠ reflection (non-physics)
      const slope = 1.5 + Math.random() * 3.0; // |dy/dx| 1.5–4.5
      const turnPad = margin * (0.7 + Math.random() * 1.0); // random proximity to border
      const targetY = goingDown ? docH - turnPad : turnPad;

      const dy = Math.abs(targetY - y);
      const dx = dy / slope;
      let newX = x + dx;
      let newY = targetY;

      if (newX >= docW - margin) {
        const actualDx = docW - margin - x;
        newX = docW - margin;
        newY = goingDown ? y + actualDx * slope : y - actualDx * slope;
        newY = Math.max(margin, Math.min(docH - margin, newY));
        points.push({ x: newX, y: newY });
        break;
      }

      const jx = (Math.random() - 0.5) * usableW * 0.02;
      const jy = (Math.random() - 0.5) * usableH * 0.03;
      points.push({
        x: Math.max(margin, Math.min(docW - margin, newX + jx)),
        y: Math.max(margin, Math.min(docH - margin, newY + jy)),
      });

      x = newX;
      y = newY;
      goingDown = !goingDown;
    }

    return points;
  } else {
    // ── Y progresses top→bottom; X bounces left↔right ──────────────────────
    const startY = margin + Math.random() * usableH * 0.15;
    const startX = margin + Math.random() * usableW; // anywhere on top edge
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let x = startX;
    let y = startY;
    // Start heading toward the farther X border to avoid a degenerate first segment
    let goingRight = x < margin + usableW * 0.5;

    while (y < docH - margin) {
      const slope = 1.5 + Math.random() * 3.0; // |dx/dy| 1.5–4.5
      const turnPad = margin * (0.7 + Math.random() * 1.0);
      const targetX = goingRight ? docW - turnPad : turnPad;

      const dx = Math.abs(targetX - x);
      const dy = dx / slope;
      let newY = y + dy;
      let newX = targetX;

      if (newY >= docH - margin) {
        const actualDy = docH - margin - y;
        newY = docH - margin;
        newX = goingRight ? x + actualDy * slope : x - actualDy * slope;
        newX = Math.max(margin, Math.min(docW - margin, newX));
        points.push({ x: newX, y: newY });
        break;
      }

      const jx = (Math.random() - 0.5) * usableW * 0.03;
      const jy = (Math.random() - 0.5) * usableH * 0.02;
      points.push({
        x: Math.max(margin, Math.min(docW - margin, newX + jx)),
        y: Math.max(margin, Math.min(docH - margin, newY + jy)),
      });

      x = newX;
      y = newY;
      goingRight = !goingRight;
    }

    return points;
  }
}

// ─── Path distribution ────────────────────────────────────────────────────────

/**
 * Walk a polyline and emit a stamp position every `step` doc-units.
 * Angle = direction of the current segment.
 */
export function distributeAlongPath(
  waypoints: { x: number; y: number }[],
  step: number,
): { x: number; y: number; angle: number }[] {
  if (waypoints.length < 2 || step <= 0) return [];

  const result: { x: number; y: number; angle: number }[] = [];
  let accumulated = 0;
  // Start with half a step so first stamp isn't exactly at the first point
  let nextEmit = step * 0.5;

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const segDx = curr.x - prev.x;
    const segDy = curr.y - prev.y;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen === 0) continue;

    const angle = (Math.atan2(segDy, segDx) * 180) / Math.PI;
    let segAccum = 0;

    while (accumulated + segLen - segAccum >= nextEmit) {
      const t = (nextEmit - accumulated + segAccum) / segLen;
      result.push({
        x: prev.x + segDx * t,
        y: prev.y + segDy * t,
        angle,
      });
      nextEmit += step;
    }

    accumulated += segLen;
  }

  return result;
}

// ─── Stroke builders ──────────────────────────────────────────────────────────

/** Build a zig-zag StampStroke as a casual diagonal polyline. */
export function buildZigZagStroke(
  docW: number,
  docH: number,
  _stampSize: number,
  step: number,
): StampStroke {
  const waypoints = computeCasualZigZagPath(docW, docH);
  const positions = distributeAlongPath(waypoints, step);
  const stamps: StampInstance[] = positions.map((p) => ({
    x: p.x,
    y: p.y,
    angle: 0,
    shape: 'roundedRect',
  }));
  return { type: 'stamp', id: uid(), stamps };
}

/** Build a StampStroke from freehand pointer points (doc-space). */
export function buildFreehandStroke(
  docPoints: { x: number; y: number }[],
  step: number,
): StampStroke {
  const positions = distributeAlongPath(docPoints, step);
  const stamps: StampInstance[] = positions.map((p) => ({
    x: p.x,
    y: p.y,
    angle: 0,
    shape: 'roundedRect',
  }));
  return { type: 'stamp', id: uid(), stamps };
}
