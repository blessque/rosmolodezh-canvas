/**
 * StampEngine — stamp placement along pointer path + casual zig-zag generator.
 */

import { uid } from '@/utils/uid';
import type { StampInstance, StampStroke } from '@/types/scene';

// ─── Casual zig-zag path ──────────────────────────────────────────────────────

/**
 * Generate a casual zig-zag polyline (bouncing-ball trace) across the canvas.
 *
 * Shallow angles (15°–35°), with slight curvature via midpoint displacement,
 * and occasional mid-segment turns for organic variety.
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

  const waypoints: { x: number; y: number }[] = [];

  if (xSweep) {
    // ── X progresses left→right; Y bounces top↔bottom ──────────────────────
    const startX = margin + Math.random() * usableW * 0.15;
    const startY = margin + Math.random() * usableH;
    waypoints.push({ x: startX, y: startY });

    let x = startX;
    let y = startY;
    let goingDown = y < margin + usableH * 0.5;

    while (x < docW - margin) {
      // Shallow slope: |dy/dx| = 0.27–0.70 → angles ~15°–35°
      const slope = 0.27 + Math.random() * 0.43;
      const turnPad = margin * (0.7 + Math.random() * 1.0);
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
        // Occasionally add mid-turn before final point (40% chance)
        if (Math.random() < 0.4) {
          const t = 0.3 + Math.random() * 0.4;
          const mx = x + (newX - x) * t;
          const my = y + (newY - y) * t;
          const angleRad = Math.atan2(newY - y, newX - x);
          const turnDelta = ((Math.random() - 0.5) * 2 * 15 * Math.PI) / 180;
          const bendLen = Math.hypot(newX - mx, newY - my) * 0.3;
          waypoints.push({
            x: Math.max(margin, Math.min(docW - margin, mx + Math.cos(angleRad + turnDelta) * bendLen * 0.1)),
            y: Math.max(margin, Math.min(docH - margin, my + Math.sin(angleRad + turnDelta) * bendLen * 0.1)),
          });
        }
        waypoints.push({ x: newX, y: newY });
        break;
      }

      const jx = (Math.random() - 0.5) * usableW * 0.02;
      const jy = (Math.random() - 0.5) * usableH * 0.03;
      waypoints.push({
        x: Math.max(margin, Math.min(docW - margin, newX + jx)),
        y: Math.max(margin, Math.min(docH - margin, newY + jy)),
      });

      x = newX;
      y = newY;
      goingDown = !goingDown;
    }
  } else {
    // ── Y progresses top→bottom; X bounces left↔right ──────────────────────
    const startY = margin + Math.random() * usableH * 0.15;
    const startX = margin + Math.random() * usableW;
    waypoints.push({ x: startX, y: startY });

    let x = startX;
    let y = startY;
    let goingRight = x < margin + usableW * 0.5;

    while (y < docH - margin) {
      const slope = 0.27 + Math.random() * 0.43;
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
        if (Math.random() < 0.4) {
          const t = 0.3 + Math.random() * 0.4;
          const mx = x + (newX - x) * t;
          const my = y + (newY - y) * t;
          const angleRad = Math.atan2(newY - y, newX - x);
          const turnDelta = ((Math.random() - 0.5) * 2 * 15 * Math.PI) / 180;
          waypoints.push({
            x: Math.max(margin, Math.min(docW - margin, mx + Math.cos(angleRad + turnDelta) * 0.1)),
            y: Math.max(margin, Math.min(docH - margin, my + Math.sin(angleRad + turnDelta) * 0.1)),
          });
        }
        waypoints.push({ x: newX, y: newY });
        break;
      }

      const jx = (Math.random() - 0.5) * usableW * 0.03;
      const jy = (Math.random() - 0.5) * usableH * 0.02;
      waypoints.push({
        x: Math.max(margin, Math.min(docW - margin, newX + jx)),
        y: Math.max(margin, Math.min(docH - margin, newY + jy)),
      });

      x = newX;
      y = newY;
      goingRight = !goingRight;
    }
  }

  // ── Midpoint curvature pass ───────────────────────────────────────────────
  // Insert slightly displaced midpoints between each pair of waypoints for
  // organic curves instead of hard polyline edges.
  const curved: { x: number; y: number }[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    curved.push(waypoints[i]!);
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const bend = (Math.random() - 0.5) * 0.07 * len;
      curved.push({
        x: Math.max(margin, Math.min(docW - margin, mx + (-dy / len) * bend)),
        y: Math.max(margin, Math.min(docH - margin, my + (dx / len) * bend)),
      });
    }
  }
  curved.push(waypoints[waypoints.length - 1]!);

  return curved;
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

/* ZIGZAG_PRESERVED
export function buildZigZagStroke(
  docW: number,
  docH: number,
  stampSize: number,
  stepIdx: number,
): StampStroke {
  const actualStep = STEP_MULTIPLIERS[Math.max(0, Math.min(9, stepIdx))]! * stampSize;
  const zigWaypoints = computeCasualZigZagPath(docW, docH);
  const positions = distributeAlongPath(zigWaypoints, actualStep);
  const stamps: StampInstance[] = positions.map((p) => ({
    x: p.x,
    y: p.y,
    angle: 0,
    shape: 'roundedRect',
  }));
  return { type: 'stamp', id: uid(), stamps, waypoints: zigWaypoints };
}
ZIGZAG_PRESERVED */

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
  return { type: 'stamp', id: uid(), stamps, waypoints: docPoints };
}
