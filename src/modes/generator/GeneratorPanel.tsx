import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { generateCompoundShape, type CanvasAspect, type GenerateOpts } from '@/modes/generator/GeneratorEngine';
import { GalleryView } from '@/modes/generator/GalleryView';
import { DevPanel } from '@/modes/generator/DevPanel';
import { ColorSlot } from '@/components/ColorSlot';

export function GeneratorPanel() {
  const shapeColor   = useUIStore((s) => s.shapeColor);
  const canvasColor  = useUIStore((s) => s.canvasColor);
  const viewport     = useUIStore((s) => s.viewport);
  const setShapeColor  = useUIStore((s) => s.setShapeColor);
  const setCanvasColor = useUIStore((s) => s.setCanvasColor);

  const [showGallery, setShowGallery] = useState(false);
  const [galleryDiag, setGalleryDiag] = useState(false);
  const [showDev, setShowDev] = useState(false);

  function getCanvasAspect(): CanvasAspect {
    const { documentWidth: w, documentHeight: h } = viewport;
    const ratio = w / h;
    return ratio >= 1.5   ? 'wide'
         : ratio <= 0.60  ? 'portrait'
         : ratio <= 0.85  ? 'portrait-4-5'
         : 'square';
  }

  function handleRegenerate() {
    useSceneStore.getState().pushHistory();
    const { documentWidth: w, documentHeight: h } = viewport;
    const { shape } = generateCompoundShape(w, h, undefined, getCanvasAspect());
    useSceneStore.getState().setCompoundShape(shape);
  }

  function handleDevChange(opts: GenerateOpts) {
    // No pushHistory — dev panel is for exploration, not undoable edits
    const { documentWidth: w, documentHeight: h } = viewport;
    const { shape } = generateCompoundShape(w, h, opts, getCanvasAspect());
    useSceneStore.getState().setCompoundShape(shape);
  }

  return (
    <>
      <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#BBBFC8] uppercase leading-none">Форма</h2>

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
