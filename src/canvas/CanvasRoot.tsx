import { useEffect, useRef, type ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';

export function CanvasRoot({ children }: { children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);
  const canvasColor = useUIStore((s) => s.canvasColor);

  // Resize observer — keeps canvas pixel size and viewport in sync
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      setViewport({ canvasWidth: width, canvasHeight: height });
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [setViewport]);

  // Draw the canvas background whenever viewport or color changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport.canvasWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const vp = viewport;
    const s = Math.min(vp.canvasWidth / vp.documentWidth, vp.canvasHeight / vp.documentHeight);
    const offsetX = (vp.canvasWidth - vp.documentWidth * s) / 2;
    const offsetY = (vp.canvasHeight - vp.documentHeight * s) / 2;

    ctx.fillStyle = canvasColor;
    ctx.fillRect(offsetX, offsetY, vp.documentWidth * s, vp.documentHeight * s);

    ctx.restore();
  }, [viewport, canvasColor]);

  // Keyboard: Ctrl+Z → undo, Ctrl+Y / Ctrl+Shift+Z → redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) {
            useSceneStore.getState().redo();
            console.log('[CanvasRoot] redo');
          } else {
            useSceneStore.getState().undo();
            console.log('[CanvasRoot] undo');
          }
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          useSceneStore.getState().redo();
          console.log('[CanvasRoot] redo (Ctrl+Y)');
        }
      }

      // Delete/Backspace: remove image (only when not typing in an input)
      if ((e.code === 'Delete' || e.code === 'Backspace') && document.activeElement?.tagName !== 'INPUT') {
        useSceneStore.getState().removeImage();
      }

      // Escape: cancel placing mode or pick mode
      if (e.code === 'Escape') {
        useUIStore.getState().setPendingImageUrl(null);
        useUIStore.getState().setImagePickerActive(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {children}
    </div>
  );
}
