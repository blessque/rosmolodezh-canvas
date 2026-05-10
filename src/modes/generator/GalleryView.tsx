import { useState, useEffect, useRef, useCallback } from 'react';
import type { CompoundShape } from '@/types/scene';
import { useUIStore, type ViewportState } from '@/store/uiStore';
import { renderCompound } from '@/canvas/compoundRenderer';
import { generateCompoundShape } from '@/modes/generator/GeneratorEngine';
import type { CanvasAspect, DistortionMode, ShapeGenerationMeta, TopStyle } from '@/modes/generator/GeneratorEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Rating = 'unrated' | 'liked' | 'disliked';

interface GalleryItem {
  id: number;
  shape: CompoundShape;
  meta: ShapeGenerationMeta;
  canvas: CanvasAspect;
  rating: Rating;
  dataUrl: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GALLERY_SIZE = 500;
const DIAG_SIZE    = 100;
const CHUNK_SIZE   = 8;
const THUMB_W      = 120;
const DIAG_THUMB_W = 360;

const CANVAS_SIZES: Record<CanvasAspect, { w: number; h: number }> = {
  square:         { w: 1080, h: 1080 },
  wide:           { w: 1920, h: 1080 },
  portrait:       { w: 1080, h: 1920 },
  'portrait-4-5': { w: 1080, h: 1350 },
};

function thumbSize(canvas: CanvasAspect, thumbW = THUMB_W): { tw: number; th: number } {
  const { w, h } = CANVAS_SIZES[canvas];
  return { tw: thumbW, th: Math.round(thumbW * h / w) };
}

function makeViewport(canvas: CanvasAspect, thumbW = THUMB_W): ViewportState {
  const { w, h } = CANVAS_SIZES[canvas];
  const { tw, th } = thumbSize(canvas, thumbW);
  return { zoom: 1, panX: 0, panY: 0, documentWidth: w, documentHeight: h, canvasWidth: tw, canvasHeight: th };
}

// ---------------------------------------------------------------------------
// Shape generation
// ---------------------------------------------------------------------------

function buildGalleryItems(): GalleryItem[] {
  const items: GalleryItem[] = [];

  // ── Systematic sweep ──────────────────────────────────────────────────────
  //
  // 2 modes × 4 canvases × 2 sizeRatios × 2 topStyle combos × 2 relations = 64 shapes
  // Random fill: 436 shapes (→ grand total 500)

  const canvases: CanvasAspect[]   = ['square', 'wide', 'portrait', 'portrait-4-5'];
  const sizeRatios                 = [0.65, 0.82];

  const leanModes: DistortionMode[]          = ['lean-right', 'lean-left'];
  const topStyleCombos: [TopStyle, TopStyle][] = [['angled', 'angled'], ['flat', 'flat']];
  const relations: Array<'same' | 'opposite'> = ['same', 'opposite'];

  for (const m of leanModes) {
    for (const canvas of canvases) {
      const { w, h } = CANVAS_SIZES[canvas];
      for (const sr of sizeRatios) {
        for (const [ts0, ts1] of topStyleCombos) {
          for (const rel of relations) {
            const { shape, meta } = generateCompoundShape(w, h, {
              forcedMode: m, sizeRatio: sr,
              topStyle0: ts0, topStyle1: ts1, relation: rel,
            }, canvas);
            items.push({ id: items.length, shape, meta, canvas, rating: 'unrated', dataUrl: null });
          }
        }
      }
    }
  }

  // ── Random fill — 436 shapes, canvas-weighted ────────────────────────────
  // Canvas counts: square 40, wide 128, portrait 128, portrait-4-5 140 = 436
  const allModes: DistortionMode[] = ['lean-right', 'lean-left'];

  const canvasBatch: CanvasAspect[] = [
    ...Array<CanvasAspect>(40).fill('square'),
    ...Array<CanvasAspect>(128).fill('wide'),
    ...Array<CanvasAspect>(128).fill('portrait'),
    ...Array<CanvasAspect>(140).fill('portrait-4-5'),
  ];
  // Fisher-Yates shuffle for render variety
  for (let i = canvasBatch.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = canvasBatch[i]!;
    canvasBatch[i] = canvasBatch[j]!;
    canvasBatch[j] = tmp;
  }

  for (const canvas of canvasBatch) {
    const m = allModes[Math.floor(Math.random() * allModes.length)]!;
    const { w, h } = CANVAS_SIZES[canvas];
    const { shape, meta } = generateCompoundShape(w, h, { forcedMode: m }, canvas);
    items.push({ id: items.length, shape, meta, canvas, rating: 'unrated', dataUrl: null });
  }

  return items;
}

/** 100 fully-random shapes (25 per canvas) for inner-corner diagnostic sessions. */
function buildDiagnosticItems(): GalleryItem[] {
  const items: GalleryItem[] = [];
  const canvases: CanvasAspect[] = ['square', 'wide', 'portrait', 'portrait-4-5'];
  for (const canvas of canvases) {
    const { w, h } = CANVAS_SIZES[canvas];
    for (let i = 0; i < 25; i++) {
      const { shape, meta } = generateCompoundShape(w, h, undefined, canvas);
      items.push({ id: items.length, shape, meta, canvas, rating: 'unrated', dataUrl: null });
    }
  }
  // Shuffle for visual variety
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!; items[i] = items[j]!; items[j] = tmp;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GalleryViewProps {
  onClose: () => void;
  /** When true: 100-shape diagnostic mode — single-click marks broken, export includes diagnostic fields. */
  diagMode?: boolean;
}

export function GalleryView({ onClose, diagMode = false }: GalleryViewProps) {
  const thumbW = diagMode ? DIAG_THUMB_W : THUMB_W;
  const shapesRef = useRef<GalleryItem[]>([]);

  const [ratings, setRatings] = useState<Rating[]>(() => {
    shapesRef.current = diagMode ? buildDiagnosticItems() : buildGalleryItems();
    return new Array<Rating>(shapesRef.current.length).fill('unrated');
  });

  const [dataUrls, setDataUrls] = useState<(string | null)[]>(() =>
    new Array<string | null>(diagMode ? DIAG_SIZE : GALLERY_SIZE).fill(null),
  );

  const [renderedCount, setRenderedCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const renderChunk = (startIdx: number) => {
      const end = Math.min(startIdx + CHUNK_SIZE, shapesRef.current.length);
      const newUrls: Record<number, string> = {};

      for (let i = startIdx; i < end; i++) {
        const item = shapesRef.current[i]!;
        const vp = makeViewport(item.canvas, thumbW);
        const { tw, th } = thumbSize(item.canvas, thumbW);
        offscreen.width = tw; offscreen.height = th;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tw, th);
        renderCompound(ctx, item.shape, useUIStore.getState().shapeColor, vp);
        newUrls[i] = offscreen.toDataURL('image/png');
      }

      setDataUrls(prev => {
        const next = [...prev];
        for (const [idxStr, url] of Object.entries(newUrls)) next[Number(idxStr)] = url;
        return next;
      });
      setRenderedCount(end);
      if (end < shapesRef.current.length) {
        rafRef.current = requestAnimationFrame(() => renderChunk(end));
      }
    };

    rafRef.current = requestAnimationFrame(() => renderChunk(0));
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleRating = useCallback((idx: number) => {
    setRatings(prev => {
      const next = [...prev];
      const cur = next[idx] ?? 'unrated';
      if (diagMode) {
        // Diagnostic mode: toggle broken (disliked) / unrated only
        next[idx] = cur === 'disliked' ? 'unrated' : 'disliked';
      } else {
        next[idx] = cur === 'unrated' ? 'liked' : cur === 'liked' ? 'disliked' : 'unrated';
      }
      return next;
    });
  }, [diagMode]);

  const handleExport = useCallback(() => {
    type BaseEntry = {
      mode: DistortionMode; canvas: CanvasAspect;
      rectCount: 2 | 3; relation: 'same' | 'opposite';
      aspectRatio: number; depthMag: number; yOverlapPct: number; sizeRatio: number;
      rotation0: number; rotation1: number; topStyle0: TopStyle; topStyle1: TopStyle;
      xOverlapPct: number; yOverlapAbsPct: number; overlapAreaPct: number;
    };
    type DiagEntry = BaseEntry & {
      staggers: number[]; cornerRadiusPx: number; minEstInLen: number; minEstPullback: number;
    };

    const toBase = (item: GalleryItem): BaseEntry => ({
      mode:           item.meta.mode,
      canvas:         item.meta.canvas,
      rectCount:      item.meta.rectCount,
      relation:       item.meta.relation,
      aspectRatio:    parseFloat(item.meta.aspectRatio.toFixed(3)),
      depthMag:       parseFloat(item.meta.depthMag.toFixed(3)),
      yOverlapPct:    parseFloat(item.meta.yOverlapPct.toFixed(3)),
      sizeRatio:      parseFloat(item.meta.sizeRatio.toFixed(3)),
      rotation0:      parseFloat(item.meta.rotation0.toFixed(2)),
      rotation1:      parseFloat(item.meta.rotation1.toFixed(2)),
      topStyle0:      item.meta.topStyle0,
      topStyle1:      item.meta.topStyle1,
      xOverlapPct:    parseFloat(item.meta.xOverlapPct.toFixed(3)),
      yOverlapAbsPct: parseFloat(item.meta.yOverlapAbsPct.toFixed(3)),
      overlapAreaPct: parseFloat(item.meta.overlapAreaPct.toFixed(3)),
    });

    let json: string;
    let filename: string;

    if (diagMode) {
      const broken = shapesRef.current
        .filter((_, i) => ratings[i] === 'disliked')
        .map((item): DiagEntry => ({
          ...toBase(item),
          staggers:       item.meta.staggers.map(s => parseFloat(s.toFixed(1))),
          cornerRadiusPx: parseFloat(item.meta.cornerRadiusPx.toFixed(2)),
          minEstInLen:    parseFloat(item.meta.minEstInLen.toFixed(2)),
          minEstPullback: parseFloat(item.meta.minEstPullback.toFixed(2)),
        }));
      json = JSON.stringify({ broken }, null, 2);
      filename = 'shape-diagnostics.json';
    } else {
      const liked    = shapesRef.current.filter((_, i) => ratings[i] === 'liked').map(toBase);
      const disliked = shapesRef.current.filter((_, i) => ratings[i] === 'disliked').map(toBase);
      json = JSON.stringify({ liked, disliked }, null, 2);
      filename = 'shape-ratings.json';
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, [diagMode, ratings]);

  const likedCount    = ratings.filter(r => r === 'liked').length;
  const brokenCount   = ratings.filter(r => r === 'disliked').length;
  const isLoading     = renderedCount < shapesRef.current.length;

  return (
    <div className="fixed inset-0 z-50 bg-[#F0F2F7] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E2E8] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-[#0e0f11]">
            {diagMode ? 'Diagnostic Gallery' : 'Shape Gallery'}
          </h2>
          <span className="text-xs text-[#6B7280]">
            {isLoading
              ? `Rendering ${renderedCount}/${shapesRef.current.length}…`
              : `${shapesRef.current.length} shapes`}
            {diagMode
              ? (brokenCount > 0 && ` · ${brokenCount} broken`)
              : (likedCount > 0 && ` · ${likedCount} liked`)}
            {!diagMode && brokenCount > 0 && ` · ${brokenCount} disliked`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9CA3B1]">
            {diagMode ? 'click to mark broken' : 'click to rate'}
          </span>
          <button
            onClick={handleExport}
            disabled={diagMode ? brokenCount === 0 : likedCount + brokenCount === 0}
            className="rounded-[6px] bg-[#ECEEF3] px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#E0E2E8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {diagMode ? 'Export broken' : 'Export ratings'}
          </button>
          <button
            onClick={onClose}
            className="rounded-[6px] bg-[#ECEEF3] px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#E0E2E8] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {isLoading && (
        <div className="h-0.5 bg-[#E0E2E8] flex-shrink-0">
          <div
            className="h-full bg-[#9CA3B1] transition-all duration-100"
            style={{ width: `${(renderedCount / shapesRef.current.length) * 100}%` }}
          />
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className="grid gap-2 items-end"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbW}px, 1fr))` }}
        >
          {shapesRef.current.map((item, idx) => {
            const rating     = ratings[idx] ?? 'unrated';
            const url        = dataUrls[idx] ?? null;
            const { tw, th } = thumbSize(item.canvas, thumbW);
            const { w, h }   = CANVAS_SIZES[item.canvas];
            const { meta }   = item;
            const modeLabel  = meta.mode === 'lean-right' ? 'lr' : 'll';
            const diagTip = diagMode
              ? ` · staggers=[${meta.staggers.map(s => s.toFixed(0)).join(',')}] · inLen=${meta.minEstInLen.toFixed(1)} · pb=${meta.minEstPullback.toFixed(1)} · r=${meta.cornerRadiusPx.toFixed(1)}`
              : '';

            return (
              <button
                key={item.id}
                onClick={() => cycleRating(idx)}
                title={`${modeLabel} · ${item.canvas} · ${meta.rectCount}r · ${meta.relation === 'opposite' ? 'opp' : 'same'} · sr=${meta.sizeRatio.toFixed(2)} · ts=${meta.topStyle0}/${meta.topStyle1} · xOvlp=${meta.xOverlapPct.toFixed(2)} · yOvlp=${meta.yOverlapAbsPct.toFixed(2)}${diagTip}`}
                className={`relative rounded-[6px] overflow-hidden transition-all select-none ${
                  !diagMode && rating === 'liked'
                    ? 'ring-2 ring-green-400'
                    : rating === 'disliked'
                    ? 'ring-2 ring-red-500'
                    : 'ring-1 ring-black/10 hover:ring-black/25'
                }`}
                style={{ aspectRatio: String(w / h) }}
              >
                {url ? (
                  <img src={url} alt="" width={tw} height={th} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-[#E0E2E8] animate-pulse" />
                )}
                {!diagMode && rating === 'liked' && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green-400 pointer-events-none" />
                )}
                {rating === 'disliked' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40">
                    <span className="text-red-400 text-3xl font-bold leading-none">×</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
