/**
 * StampCanvas — DPR-aware canvas with pointer drawing and stamp rendering.
 */

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { drawStampInstance } from '@/canvas/stampRenderer';
import { distributeAlongPath, buildFreehandStroke } from '@/modes/stamp/StampEngine';
import type { StampStroke, StampInstance } from '@/types/scene';

export function StampCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const objects = useSceneStore((s) => s.objects);
  const shapeColor = useUIStore((s) => s.shapeColor);
  const viewport = useUIStore((s) => s.viewport);
  const stampSize = useUIStore((s) => s.stampSize);
  const stampRotate45 = useUIStore((s) => s.stampRotate45);
  const stampImageUrl = useUIStore((s) => s.stampImageUrl);

  // Live drawing state — not in store (not undoable mid-gesture)
  const [isDrawing, setIsDrawing] = useState(false);
  const livePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [liveStamps, setLiveStamps] = useState<StampInstance[]>([]);

  // DPR-aware resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
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

    // Render committed strokes
    const strokes = objects.filter((o) => o.type === 'stamp') as StampStroke[];
    for (const stroke of strokes) {
      for (const inst of stroke.stamps) {
        drawStampInstance(
          ctx, inst.x, inst.y, stampSize,
          inst.angle, s, ox, oy, shapeColor, stampRotate45, stampImageUrl,
        );
      }
    }

    // Render live preview
    for (const inst of liveStamps) {
      drawStampInstance(
        ctx, inst.x, inst.y, stampSize,
        inst.angle, s, ox, oy, shapeColor, stampRotate45, stampImageUrl,
      );
    }

    ctx.restore();
  }, [objects, shapeColor, viewport, stampSize, stampRotate45, stampImageUrl, liveStamps]);

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
    if (!isDrawing) return;
    const pt = toDocCoords(e);
    livePointsRef.current.push(pt);
    const positions = distributeAlongPath(livePointsRef.current, useUIStore.getState().stampStep);
    setLiveStamps(
      positions.map((p) => ({
        x: p.x,
        y: p.y,
        angle: useUIStore.getState().stampImageUrl !== null ? 0 : p.angle,
        shape: 'roundedRect' as const,
      }))
    );
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const { stampStep: step } = useUIStore.getState();
    const stroke = buildFreehandStroke(livePointsRef.current, step);
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
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: 'crosshair',
      }}
    />
  );
}
