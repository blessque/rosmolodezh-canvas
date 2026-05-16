/**
 * StampCanvas — DPR-aware canvas with pointer drawing and stamp rendering.
 */

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore, STEP_MULTIPLIERS } from '@/store/uiStore';
import { drawStampInstance } from '@/canvas/stampRenderer';
import { distributeAlongPath, buildFreehandStroke } from '@/modes/stamp/StampEngine';
import type { StampStroke, StampInstance } from '@/types/scene';
import { uid } from '@/utils/uid';

export function StampCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const objects       = useSceneStore((s) => s.objects);
  const shapeColor    = useUIStore((s) => s.shapeColor);
  const viewport      = useUIStore((s) => s.viewport);
  const stampSize     = useUIStore((s) => s.stampSize);
  const stampStepIdx  = useUIStore((s) => s.stampStepIdx);
  const stampShape    = useUIStore((s) => s.stampShape);
  const stampImageUrl = useUIStore((s) => s.stampImageUrl);

  // Live drawing state — not in store (not undoable mid-gesture)
  const [isDrawing, setIsDrawing] = useState(false);
  const livePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [liveStamps, setLiveStamps] = useState<StampInstance[]>([]);

  // Cursor preview in doc space
  const [cursorDocPos, setCursorDocPos] = useState<{ x: number; y: number } | null>(null);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { canvasWidth, canvasHeight } = viewport;
    if (canvasWidth === 0 || canvasHeight === 0) return;
    canvas.width  = Math.round(canvasWidth  * dpr);
    canvas.height = Math.round(canvasHeight * dpr);

    const { documentWidth: docW, documentHeight: docH } = viewport;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // doc → screen transform
    const s = Math.min(cssW / docW, cssH / docH);
    const ox = (cssW - docW * s) / 2;
    const oy = (cssH - docH * s) / 2;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Render committed strokes (redistributed from waypoints when size/step changes)
    const strokes = objects.filter((o) => o.type === 'stamp') as StampStroke[];
    for (const stroke of strokes) {
      const actualStep = STEP_MULTIPLIERS[Math.max(0, Math.min(9, stampStepIdx))]! * stampSize;
      const distributed = stroke.waypoints ? distributeAlongPath(stroke.waypoints, actualStep) : null;
      const positions = distributed && distributed.length > 0 ? distributed : stroke.stamps;
      for (const inst of positions) {
        drawStampInstance(
          ctx, inst.x, inst.y, stampSize,
          0, s, ox, oy, shapeColor, stampShape, stampImageUrl,
        );
      }
    }

    // Render live preview
    for (const inst of liveStamps) {
      drawStampInstance(
        ctx, inst.x, inst.y, stampSize,
        inst.angle, s, ox, oy, shapeColor, stampShape, stampImageUrl,
      );
    }

    // Brush cursor preview
    if (cursorDocPos) {
      ctx.globalAlpha = 0.5;
      drawStampInstance(
        ctx, cursorDocPos.x, cursorDocPos.y, stampSize,
        0, s, ox, oy, shapeColor, stampShape, stampImageUrl,
      );
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }, [objects, shapeColor, viewport, stampSize, stampStepIdx, stampShape, stampImageUrl, liveStamps, cursorDocPos]);

  // Pointer → document coordinate conversion
  function toDocCoords(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { documentWidth: docW, documentHeight: docH } = useUIStore.getState().viewport;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const s = Math.min(cssW / docW, cssH / docH);
    const ox = (cssW - docW * s) / 2;
    const oy = (cssH - docH * s) / 2;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: (px - ox) / s,
      y: (py - oy) / s,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toDocCoords(e);
    livePointsRef.current = [pt];
    setLiveStamps([]);
    setIsDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const pt = toDocCoords(e);
    // Always update cursor preview
    setCursorDocPos(pt);

    if (!isDrawing) return;

    livePointsRef.current.push(pt);
    const { stampSize: size, stampStepIdx: idx } = useUIStore.getState();
    const actualStep = STEP_MULTIPLIERS[Math.max(0, Math.min(9, idx))]! * size;
    const positions = distributeAlongPath(livePointsRef.current, actualStep);
    setLiveStamps(
      positions.map((p) => ({
        x: p.x,
        y: p.y,
        angle: 0,
        shape: 'roundedRect' as const,
      }))
    );
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);

    const pts = livePointsRef.current;

    if (pts.length === 1) {
      // Single click — place one stamp at the click position
      const pt = pts[0]!;
      const singleStroke: StampStroke = {
        type: 'stamp',
        id: uid(),
        stamps: [{ x: pt.x, y: pt.y, angle: 0, shape: 'roundedRect' }],
        waypoints: [pt],
      };
      useSceneStore.getState().pushHistory();
      useSceneStore.getState().addStampStroke(singleStroke);
      livePointsRef.current = [];
      setLiveStamps([]);
      return;
    }

    // Normal freehand path (unchanged)
    const { stampSize: size, stampStepIdx: idx } = useUIStore.getState();
    const actualStep = STEP_MULTIPLIERS[Math.max(0, Math.min(9, idx))]! * size;
    const stroke = buildFreehandStroke(pts, actualStep);
    if (stroke.stamps.length > 0) {
      useSceneStore.getState().pushHistory();
      useSceneStore.getState().addStampStroke(stroke);
    }
    livePointsRef.current = [];
    setLiveStamps([]);
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setCursorDocPos(null)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: 'none',
      }}
    />
  );
}
