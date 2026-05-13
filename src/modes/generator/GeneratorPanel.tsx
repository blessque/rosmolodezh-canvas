import { useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { generateCompoundShape, type CanvasAspect, type GenerateOpts } from '@/modes/generator/GeneratorEngine';
import { GalleryView } from '@/modes/generator/GalleryView';
import { DevPanel } from '@/modes/generator/DevPanel';
import { ColorSlot } from '@/components/ColorSlot';
import { preloadImage, getMaskBBox, computeCoverTransform, getImageCache } from '@/canvas/imageMaskRenderer';
import type { CompoundShape } from '@/types/scene';

// ---------------------------------------------------------------------------
// Color Presets
// ---------------------------------------------------------------------------

const COLOR_PRESETS = [
  { shape: '#99ECFF', canvas: '#FFFFFF' }, // default cyan+white
  { shape: '#FE443B', canvas: '#FFFFFF' }, // brand red+white
  { shape: '#BF00FF', canvas: '#FEFE78' }, // brand purple+yellow
  { shape: '#00FFAA', canvas: '#004517' }, // brand mint+dark green
  { shape: '#FF0097', canvas: '#D4FA48' }, // brand pink+lime
  { shape: '#0095FF', canvas: '#00FFAA' }, // brand blue+mint
  { shape: '#E7002B', canvas: '#FFC7B6' }, // brand red+peach
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratorPanel() {
  const shapeColor   = useUIStore((s) => s.shapeColor);
  const canvasColor  = useUIStore((s) => s.canvasColor);
  const viewport     = useUIStore((s) => s.viewport);
  const setShapeColor  = useUIStore((s) => s.setShapeColor);
  const setCanvasColor = useUIStore((s) => s.setCanvasColor);
  const imagePickerActive   = useUIStore((s) => s.imagePickerActive);
  const setImagePickerActive = useUIStore((s) => s.setImagePickerActive);
  const rectCount    = useUIStore((s) => s.rectCount);
  const setRectCount = useUIStore((s) => s.setRectCount);
  const pendingImageUrl = useUIStore((s) => s.pendingImageUrl);

  const [showGallery, setShowGallery] = useState(false);
  const [galleryDiag, setGalleryDiag] = useState(false);
  const [showDev, setShowDev] = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // ── Derived: does current compound have an image? ────────────────────────
  const compound = useSceneStore((s) =>
    s.objects.find((o) => o.type === 'compound') as CompoundShape | undefined
  );
  const imageUrl    = compound?.imageUrl;
  const hasMask     = (compound?.maskedRectIndices.length ?? 0) > 0;

  // ── Canvas aspect helper ─────────────────────────────────────────────────
  function getCanvasAspect(): CanvasAspect {
    const { documentWidth: w, documentHeight: h } = viewport;
    const ratio = w / h;
    return ratio > 1.0    ? 'wide'
         : ratio <= 0.60  ? 'portrait'
         : ratio <= 0.85  ? 'portrait-4-5'
         : 'square';
  }

  // ── File processing ──────────────────────────────────────────────────────
  async function handleFile(file: File, keepMask = false) {
    let url: string;
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      /\.heic$/i.test(file.name);

    if (isHeic) {
      const heic2any = (await import('heic2any')).default;
      const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })) as Blob;
      url = await blobToDataUrl(blob);
    } else {
      url = await fileToDataUrl(file);
    }

    await preloadImage(url);
    const sceneStore = useSceneStore.getState();

    if (keepMask && compound && compound.maskedRectIndices.length > 0) {
      // Replace: keep same rect indices, recompute cover transform for new image
      const maskedRects = compound.maskedRectIndices.map((i) => compound.rects[i]!);
      const bbox = getMaskBBox(maskedRects);
      const img = getImageCache().get(url)!;
      const coverTransform = computeCoverTransform(img, bbox);
      sceneStore.setImageMask(compound.maskedRectIndices, url, coverTransform);
    } else {
      // New upload: enter placing mode
      useUIStore.getState().setPendingImageUrl(url);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>, keepMask = false) {
    const file = e.target.files?.[0];
    if (file) handleFile(file, keepMask);
    e.target.value = '';
  }

  // ── Regenerate ───────────────────────────────────────────────────────────
  function handleRegenerateWithRectCount(count: 2 | 3) {
    useSceneStore.getState().pushHistory();
    const { documentWidth: w, documentHeight: h } = viewport;
    const opts: GenerateOpts = { rectCount: count };
    const { shape } = generateCompoundShape(w, h, opts, getCanvasAspect());
    const currentCompound = useSceneStore.getState().objects.find((o) => o.type === 'compound') as CompoundShape | undefined;
    const existingImageUrl = currentCompound?.imageUrl;
    useSceneStore.getState().setCompoundShape(shape);
    if (existingImageUrl) {
      const largestIdx = shape.rects.reduce(
        (best, r, i) => (r.w * r.h > shape.rects[best]!.w * shape.rects[best]!.h ? i : best),
        0,
      );
      const maskedRects = [shape.rects[largestIdx]!];
      const bbox = getMaskBBox(maskedRects);
      const img = getImageCache().get(existingImageUrl);
      const coverTransform = img
        ? computeCoverTransform(img, bbox)
        : { translateX: 0, translateY: 0, scale: 1, rotateDeg: 0 };
      useSceneStore.getState().autoAssignLargestRect(existingImageUrl, [largestIdx], coverTransform);
    }
  }

  function handleRegenerate() {
    handleRegenerateWithRectCount(rectCount);
  }

  function handleDevChange(opts: GenerateOpts) {
    const { documentWidth: w, documentHeight: h } = viewport;
    const { shape } = generateCompoundShape(w, h, opts, getCanvasAspect());
    useSceneStore.getState().setCompoundShape(shape);
  }

  // ── Thumbnail ─────────────────────────────────────────────────────────────
  const thumbStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  // Hide panel while in placing mode
  if (pendingImageUrl) return null;

  return (
    <>
      <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#BBBFC8] uppercase leading-none">Форма</h2>

        {/* Rect count */}
        <div className="flex gap-[2px] rounded-[8px] bg-[#E5E7EC] p-[3px]">
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              onClick={() => { setRectCount(n); handleRegenerateWithRectCount(n); }}
              className={`flex-1 h-[32px] font-cond-regular text-[15px] rounded-[6px] transition-colors
                ${rectCount === n
                  ? 'bg-white text-[#0e0f11] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#0e0f11]'}`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Regenerate */}
        <button
          onClick={handleRegenerate}
          className="h-[44px] w-full font-cond-regular text-[18px] bg-[#0e0f11] text-white rounded-[8px] hover:opacity-90 transition-opacity"
        >
          Regenerate
        </button>

        {/* Shape colour */}
        <ColorSlot label="Форма" color={shapeColor} onChange={setShapeColor} initialHistory={['#FE443B']} />

        {/* Canvas colour */}
        <ColorSlot label="Холст" color={canvasColor} onChange={setCanvasColor} />

        {/* Color presets */}
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const selected = shapeColor === p.shape && canvasColor === p.canvas;
            return (
              <button
                key={`${p.shape}-${p.canvas}`}
                onClick={() => { setShapeColor(p.shape); setCanvasColor(p.canvas); }}
                className={`w-8 h-8 rounded-[8px] overflow-hidden transition-transform
                  ${selected
                    ? 'border-2 border-[#0e0f11] scale-110'
                    : 'border-2 border-transparent scale-100 hover:scale-105'}`}
                title={`Форма: ${p.shape} / Холст: ${p.canvas}`}
              >
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <polygon points="0,0 32,0 0,32" fill={p.canvas} />
                  <polygon points="32,0 32,32 0,32" fill={p.shape} />
                </svg>
              </button>
            );
          })}
        </div>

        <div className="h-px bg-[#E0E2E8]" />

        {/* ── Image section ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <h3 className="font-cond-black font-black text-[16px] text-[#BBBFC8] uppercase leading-none">
            Изображение
          </h3>

          {!imageUrl ? (
            /* Upload drop zone */
            <div
              className="border-2 border-dashed rounded-[8px] h-[72px] flex items-center justify-center transition-colors cursor-pointer border-[#E0E2E8] hover:border-[#BBBFC8]"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-[13px] text-[#BBBFC8] font-cond-regular select-none">
                Загрузить или перетащить
              </span>
            </div>
          ) : (
            /* Thumbnail + controls */
            <div className="flex gap-2 items-start">
              {/* Thumbnail */}
              <div
                className="w-[64px] h-[64px] rounded-[8px] bg-[#F0F2F7] flex-shrink-0 border border-[#E0E2E8]"
                style={thumbStyle}
              />

              {/* Buttons */}
              <div className="flex flex-col gap-1.5 flex-1">
                <button
                  onClick={() => replaceInputRef.current?.click()}
                  className="h-[30px] w-full font-cond-regular text-[13px] bg-[#ECEEF3] text-[#0e0f11] rounded-[6px] hover:opacity-80 transition-opacity"
                >
                  Заменить
                </button>
                <button
                  onClick={() => useSceneStore.getState().removeImage()}
                  className="h-[30px] w-full font-cond-regular text-[13px] bg-[#ECEEF3] text-[#0e0f11] rounded-[6px] hover:opacity-80 transition-opacity"
                >
                  Удалить
                </button>
              </div>
            </div>
          )}

          {/* "Выбрать фигуру" — shown when image uploaded */}
          {imageUrl && (
            <button
              onClick={() => setImagePickerActive(true)}
              className={`h-[36px] w-full font-cond-regular text-[14px] rounded-[8px] transition-opacity
                ${imagePickerActive
                  ? 'bg-[#0e0f11] text-white'
                  : 'bg-[#ECEEF3] text-[#0e0f11] hover:opacity-80'}`}
            >
              {imagePickerActive ? 'Нажмите на фигуру…' : hasMask ? 'Сменить фигуру' : 'Выбрать фигуру'}
            </button>
          )}
        </div>

        <div className="h-px bg-[#E0E2E8]" />

        {/* Gallery */}
        <div className="flex gap-2">
          <button
            onClick={() => { setGalleryDiag(false); setShowGallery(true); }}
            className="bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] h-[44px] flex-1 font-cond-regular text-[14px] hover:opacity-90 transition-opacity"
          >
            Gallery (500)
          </button>
          <button
            onClick={() => { setGalleryDiag(true); setShowGallery(true); }}
            className="bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] h-[44px] flex-1 font-cond-regular text-[14px] hover:opacity-90 transition-opacity"
          >
            Diag (100)
          </button>
        </div>

        {/* Dev settings collapsible */}
        <div className="border-t border-[#E0E2E8] pt-3">
          <button
            onClick={() => setShowDev((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-[#BBBFC8] hover:text-[#0e0f11] transition-colors font-cond-regular"
          >
            <span className="uppercase tracking-wider">Dev settings</span>
            <span>{showDev ? '▲' : '▼'}</span>
          </button>
          {showDev && (
            <div className="mt-3 bg-[#0e0f11] rounded-[12px] p-3">
              <DevPanel onChange={handleDevChange} />
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, false)}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, true)}
      />

      {showGallery && (
        <GalleryView
          key={galleryDiag ? 'diag' : 'normal'}
          diagMode={galleryDiag}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  );
}
