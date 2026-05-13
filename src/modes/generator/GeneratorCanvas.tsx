import { useEffect, useRef, useState, useCallback } from 'react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { renderCompound } from '@/canvas/compoundRenderer';
import {
  renderImageMask,
  getMaskBBox,
  computeCoverTransform,
  getImageCache,
  getHandleLayout,
  hitTestHandle,
} from '@/canvas/imageMaskRenderer';
import { pointInRect } from '@/utils/rectHitTest';
import { canvasToDocument, documentToCanvas, scaleToCanvas } from '@/utils/coordinates';
import type { CompoundShape, ImageTransform } from '@/types/scene';
import type { Point } from '@/types/geometry';

// ---------------------------------------------------------------------------
// DragState type
// ---------------------------------------------------------------------------

type DragState =
  | { kind: 'move'; startDocX: number; startDocY: number; startTransform: ImageTransform }
  | {
      kind: 'scale';
      corner: 'nw' | 'ne' | 'se' | 'sw';
      startDocX: number;
      startDocY: number;
      startTransform: ImageTransform;
      pivotX: number;
      pivotY: number;
    }
  | {
      kind: 'rotate';
      centerX: number;
      centerY: number;
      startAngle: number;
      startRotateDeg: number;
    };

// ---------------------------------------------------------------------------
// Coordinate helper
// ---------------------------------------------------------------------------

function screenToDoc(sx: number, sy: number, canvas: HTMLCanvasElement, viewport: Parameters<typeof canvasToDocument>[1]): Point {
  const rect = canvas.getBoundingClientRect();
  return canvasToDocument({ x: sx - rect.left, y: sy - rect.top }, viewport);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const objects        = useSceneStore((s) => s.objects);
  const shapeColor     = useUIStore((s) => s.shapeColor);
  const viewport       = useUIStore((s) => s.viewport);
  const imagePickerActive = useUIStore((s) => s.imagePickerActive);
  const pendingImageUrl = useUIStore((s) => s.pendingImageUrl);

  const setImageMask       = useSceneStore((s) => s.setImageMask);
  const setImageTransform  = useSceneStore((s) => s.setImageTransform);
  const commitImageTransform = useSceneStore((s) => s.commitImageTransform);

  const [editingImage, setEditingImage] = useState(false);
  const [cursor, setCursor] = useState<string>('default');
  const dragRef      = useRef<DragState | null>(null);
  const hoverRectsRef = useRef<number[]>([]);
  const [hoverTick, setHoverTick] = useState(0);

  // DPR-aware resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ── Render loop ───────────────────────────────────────────────────────────
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
    if (!compound) { ctx.restore(); return; }

    const { rects, maskedRectIndices, imageUrl, imageTransform } = compound;
    const cornerRadius = rects[0]?.cornerRadius ?? 30;

    const maskedRects     = rects.filter((_, i) => maskedRectIndices.includes(i));
    const backgroundRects = rects.filter((_, i) => !maskedRectIndices.includes(i));

    // Render background compound (non-masked rects)
    if (backgroundRects.length > 0) {
      renderCompound(ctx, { ...compound, rects: backgroundRects }, shapeColor, viewport);
    }

    // Render masked rects filled with shapeColor (behind image)
    if (maskedRects.length > 0) {
      renderCompound(ctx, { ...compound, rects: maskedRects }, shapeColor, viewport);
    }

    // Render image mask
    if (imageUrl && maskedRects.length > 0) {
      renderImageMask(ctx, maskedRects, imageUrl, imageTransform, editingImage, viewport, cornerRadius);
    }

    // Render pick-mode hover highlights
    if ((imagePickerActive || !!pendingImageUrl) && hoverRectsRef.current.length > 0) {
      for (const idx of hoverRectsRef.current) {
        const rect = rects[idx];
        if (!rect) continue;
        renderCompound(ctx, { ...compound, rects: [rect] }, 'rgba(255,255,255,0.35)', viewport);
      }
    }

    ctx.restore();
  }, [objects, shapeColor, viewport, editingImage, imagePickerActive, pendingImageUrl, hoverTick]);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const compound = useSceneStore.getState().objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
    if (!compound) return;

    const vp = useUIStore.getState().viewport;

    // ── Compute hover cursor ─────────────────────────────────────────────────
    const pendingUrl = useUIStore.getState().pendingImageUrl;
    if (useUIStore.getState().imagePickerActive || pendingUrl) {
      setCursor('crosshair');
    } else if (editingImage && compound.maskedRectIndices.length > 0) {
      const { rects, imageTransform: transform, maskedRectIndices } = compound;
      const maskedRects = maskedRectIndices.map((i) => rects[i]!);
      const bbox = getMaskBBox(maskedRects);
      const cxDoc = bbox.cx + transform.translateX;
      const cyDoc = bbox.cy + transform.translateY;
      const cxScreen = documentToCanvas({ x: cxDoc, y: cyDoc }, vp);
      const img = getImageCache().get(compound.imageUrl ?? '');
      if (img) {
        const imgWScreen = scaleToCanvas(img.naturalWidth * transform.scale, vp);
        const imgHScreen = scaleToCanvas(img.naturalHeight * transform.scale, vp);
        const handles = getHandleLayout(cxScreen.x, cxScreen.y, imgWScreen, imgHScreen, transform.rotateDeg);
        const sx = e.clientX - canvas.getBoundingClientRect().left;
        const sy = e.clientY - canvas.getBoundingClientRect().top;
        const hit = hitTestHandle(sx, sy, handles);
        if (!hit) {
          // Check if over mask (move cursor)
          const doc = canvasToDocument({ x: sx, y: sy }, vp);
          const onMask = maskedRectIndices.some((i) => {
            const r = rects[i];
            return r ? pointInRect(doc, r) : false;
          });
          setCursor(onMask ? 'move' : 'default');
        } else if (hit.kind === 'corner') {
          const cursorMap: Record<string, string> = { nw: 'nw-resize', ne: 'ne-resize', se: 'se-resize', sw: 'sw-resize' };
          setCursor(cursorMap[hit.corner] ?? 'default');
        } else if (hit.kind === 'rotate') {
          setCursor('crosshair');
        }
      }
    } else {
      setCursor('default');
    }

    // ── Pick mode: update hover highlights ──────────────────────────────────
    if (useUIStore.getState().imagePickerActive || useUIStore.getState().pendingImageUrl) {
      const doc = screenToDoc(e.clientX, e.clientY, canvas, vp);
      const hovered = compound.rects
        .map((r, i) => ({ i, hit: pointInRect(doc, r) }))
        .filter((v) => v.hit)
        .map((v) => v.i);

      const prev = hoverRectsRef.current;
      if (JSON.stringify(prev) !== JSON.stringify(hovered)) {
        hoverRectsRef.current = hovered;
        setHoverTick((t) => t + 1);
      }
      return;
    }

    // ── Edit mode: update transform live ───────────────────────────────────
    if (!dragRef.current) return;
    const drag = dragRef.current;

    const doc = screenToDoc(e.clientX, e.clientY, canvas, vp);
    const cur = (useSceneStore.getState().objects.find((o) => o.type === 'compound') as CompoundShape).imageTransform;

    if (drag.kind === 'move') {
      const dx = doc.x - drag.startDocX;
      const dy = doc.y - drag.startDocY;
      setImageTransform({
        ...drag.startTransform,
        translateX: drag.startTransform.translateX + dx,
        translateY: drag.startTransform.translateY + dy,
      });
    } else if (drag.kind === 'rotate') {
      const angle = Math.atan2(
        e.clientY - drag.centerY,
        e.clientX - drag.centerX,
      ) * 180 / Math.PI + 90;
      const delta = angle - drag.startAngle;
      setImageTransform({ ...cur, rotateDeg: drag.startRotateDeg + delta });
    } else if (drag.kind === 'scale') {
      // Scale based on distance from pivot — use diagonal distance
      const startDist = Math.hypot(
        drag.startDocX - drag.pivotX,
        drag.startDocY - drag.pivotY,
      );
      const curDist = Math.hypot(
        doc.x - drag.pivotX,
        doc.y - drag.pivotY,
      );
      if (startDist < 1) return;
      const scaleFactor = curDist / startDist;
      setImageTransform({
        ...drag.startTransform,
        scale: Math.max(0.05, drag.startTransform.scale * scaleFactor),
      });
    }
  }, [setImageTransform, editingImage]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const compound = useSceneStore.getState().objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
    if (!compound) return;

    const vp = useUIStore.getState().viewport;

    // ── Pick mode ──────────────────────────────────────────────────────────
    const pendingUrl = useUIStore.getState().pendingImageUrl;
    const isPickMode = useUIStore.getState().imagePickerActive || !!pendingUrl;

    if (isPickMode) {
      const doc = screenToDoc(e.clientX, e.clientY, canvas, vp);
      const hovered = compound.rects
        .map((r, i) => ({ i, hit: pointInRect(doc, r) }))
        .filter((v) => v.hit)
        .map((v) => v.i);

      if (hovered.length > 0) {
        const imageUrl = pendingUrl ?? compound.imageUrl ?? '';
        const maskedRects = hovered.map((i) => compound.rects[i]!);
        const bbox = getMaskBBox(maskedRects);
        const cache = getImageCache();
        const img = cache.get(imageUrl);
        const coverTransform = img
          ? computeCoverTransform(img, bbox)
          : { translateX: 0, translateY: 0, scale: 1, rotateDeg: 0 };

        setImageMask(hovered, imageUrl, coverTransform);
        useUIStore.getState().setImagePickerActive(false);
        useUIStore.getState().setPendingImageUrl(null);
        setEditingImage(true);
      } else {
        // Click outside any rect while in placing mode → abort
        if (pendingUrl) {
          useUIStore.getState().setPendingImageUrl(null);
        }
      }
      return;
    }

    // ── Idle mode: click on mask → enter edit ─────────────────────────────
    const { maskedRectIndices, imageUrl } = compound;
    if (!editingImage && imageUrl && maskedRectIndices.length > 0) {
      const doc = screenToDoc(e.clientX, e.clientY, canvas, vp);
      const onMask = maskedRectIndices.some((i) => {
        const r = compound.rects[i];
        return r ? pointInRect(doc, r) : false;
      });
      if (onMask) {
        setEditingImage(true);
        return;
      }
    }

    // ── Edit mode: drag handles ────────────────────────────────────────────
    if (!editingImage || !imageUrl || maskedRectIndices.length === 0) return;

    const { rects, imageTransform: transform } = compound;
    const maskedRects = maskedRectIndices.map((i) => rects[i]!);
    const bbox = getMaskBBox(maskedRects);

    const cxDoc = bbox.cx + transform.translateX;
    const cyDoc = bbox.cy + transform.translateY;
    const cxScreen = documentToCanvas({ x: cxDoc, y: cyDoc }, vp);

    const cache = getImageCache();
    const img = cache.get(imageUrl);
    if (!img) return;

    const imgWScreen = scaleToCanvas(img.naturalWidth  * transform.scale, vp);
    const imgHScreen = scaleToCanvas(img.naturalHeight * transform.scale, vp);

    const handles = getHandleLayout(cxScreen.x, cxScreen.y, imgWScreen, imgHScreen, transform.rotateDeg);
    const hit = hitTestHandle(e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top, handles);

    if (hit?.kind === 'rotate') {
      const curAngle = Math.atan2(
        e.clientY - cxScreen.y - canvas.getBoundingClientRect().top,
        e.clientX - cxScreen.x - canvas.getBoundingClientRect().left,
      ) * 180 / Math.PI + 90;
      dragRef.current = {
        kind: 'rotate',
        centerX: cxScreen.x + canvas.getBoundingClientRect().left,
        centerY: cxScreen.y + canvas.getBoundingClientRect().top,
        startAngle: curAngle,
        startRotateDeg: transform.rotateDeg,
      };
    } else if (hit?.kind === 'corner') {
      const doc = screenToDoc(e.clientX, e.clientY, canvas, vp);
      // Pivot = opposite corner in doc space
      const cornerIdx = { nw: 2, ne: 3, se: 0, sw: 1 }[hit.corner];
      const opp = handles.corners[cornerIdx!]!;
      const oppDoc = canvasToDocument(opp, vp);
      dragRef.current = {
        kind: 'scale',
        corner: hit.corner,
        startDocX: doc.x,
        startDocY: doc.y,
        startTransform: { ...transform },
        pivotX: oppDoc.x,
        pivotY: oppDoc.y,
      };
    } else {
      // Check if click is on image body
      const sx = e.clientX - canvas.getBoundingClientRect().left;
      const sy = e.clientY - canvas.getBoundingClientRect().top;
      const doc = canvasToDocument({ x: sx, y: sy }, vp);

      // Are we on the mask area? If not → exit edit mode
      const onMask = maskedRectIndices.some((i) => {
        const r = compound.rects[i];
        return r ? pointInRect(doc, r) : false;
      });

      if (!onMask) {
        setEditingImage(false);
        return;
      }

      const docPos = screenToDoc(e.clientX, e.clientY, canvas, vp);
      dragRef.current = {
        kind: 'move',
        startDocX: docPos.x,
        startDocY: docPos.y,
        startTransform: { ...transform },
      };
    }
  }, [editingImage, setImageMask, setImageTransform]);

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      commitImageTransform();
    }
  }, [commitImageTransform]);

  return (
    <canvas
      ref={canvasRef}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        cursor,
      }}
    />
  );
}
