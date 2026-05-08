import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { generateCompoundShape, type CanvasAspect } from '@/modes/generator/GeneratorEngine';
import { GalleryView } from '@/modes/generator/GalleryView';

export function GeneratorPanel() {
  const shapeColor   = useUIStore((s) => s.shapeColor);
  const canvasColor  = useUIStore((s) => s.canvasColor);
  const viewport     = useUIStore((s) => s.viewport);
  const setShapeColor  = useUIStore((s) => s.setShapeColor);
  const setCanvasColor = useUIStore((s) => s.setCanvasColor);

  const [showGallery, setShowGallery] = useState(false);

  function handleRegenerate() {
    useSceneStore.getState().pushHistory();
    const { documentWidth: w, documentHeight: h } = viewport;
    const ratio = w / h;
    const canvasAspect: CanvasAspect =
      ratio >= 1.5   ? 'wide'
      : ratio <= 0.60 ? 'portrait'
      : ratio <= 0.85 ? 'portrait-4-5'
      : 'square';
    const { shape } = generateCompoundShape(w, h, undefined, canvasAspect);
    useSceneStore.getState().setCompoundShape(shape);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Regenerate */}
        <button
          onClick={handleRegenerate}
          className="w-full rounded-[6px] bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"
        >
          Regenerate
        </button>

        {/* Shape colour */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/40 uppercase tracking-wider px-1">Shape colour</p>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-white/70">{shapeColor}</span>
            <input
              type="color"
              value={shapeColor}
              onChange={(e) => setShapeColor(e.target.value)}
              className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </div>
        </div>

        {/* Canvas colour */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/40 uppercase tracking-wider px-1">Canvas colour</p>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-white/70">{canvasColor}</span>
            <input
              type="color"
              value={canvasColor}
              onChange={(e) => setCanvasColor(e.target.value)}
              className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </div>
        </div>

        {/* Gallery */}
        <button
          onClick={() => setShowGallery(true)}
          className="w-full rounded-[6px] bg-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/20 transition-colors"
        >
          Gallery (500 shapes)
        </button>
      </div>

      {showGallery && <GalleryView onClose={() => setShowGallery(false)} />}
    </>
  );
}
