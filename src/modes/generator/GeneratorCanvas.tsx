import { useEffect, useRef } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { renderCompound } from '@/canvas/compoundRenderer';
import type { CompoundShape } from '@/types/scene';

export function GeneratorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const objects = useSceneStore((s) => s.objects);
  const shapeColor = useUIStore((s) => s.shapeColor);
  const viewport = useUIStore((s) => s.viewport);

  // DPR-aware resize: keep canvas pixel buffer in sync with CSS size
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

  // Render on dependency change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const compound = objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
    if (compound) {
      renderCompound(ctx, compound, shapeColor, viewport);
    }

    ctx.restore();
  }, [objects, shapeColor, viewport]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
