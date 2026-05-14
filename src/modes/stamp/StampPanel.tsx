/**
 * StampPanel — controls for stamp mode: zig-zag fill, size/step sliders,
 * shape picker, color pickers, image upload, clear.
 */

import { useRef } from 'react';
import { useUIStore, STEP_MULTIPLIERS, type StampShape } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { buildZigZagStroke } from '@/modes/stamp/StampEngine';
import { preloadStampImage } from '@/canvas/stampRenderer';
import { Slider } from '@/components/Slider';
import { ColorSlot } from '@/components/ColorSlot';
import { COLOR_PRESETS } from '@/utils/colorPresets';

export function StampPanel() {
  const shapeColor       = useUIStore((s) => s.shapeColor);
  const setShapeColor    = useUIStore((s) => s.setShapeColor);
  const canvasColor      = useUIStore((s) => s.canvasColor);
  const setCanvasColor   = useUIStore((s) => s.setCanvasColor);
  const stampSize        = useUIStore((s) => s.stampSize);
  const setStampSize     = useUIStore((s) => s.setStampSize);
  const stampStepIdx     = useUIStore((s) => s.stampStepIdx);
  const setStampStepIdx  = useUIStore((s) => s.setStampStepIdx);
  const stampShape       = useUIStore((s) => s.stampShape);
  const setStampShape    = useUIStore((s) => s.setStampShape);
  const stampImageUrl    = useUIStore((s) => s.stampImageUrl);
  const setStampImageUrl = useUIStore((s) => s.setStampImageUrl);
  const pushHistory      = useSceneStore((s) => s.pushHistory);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function captureUISnap() {
    return useUIStore.getState().captureSnapshot();
  }

  function handleZigZag() {
    const { documentWidth: w, documentHeight: h } = useUIStore.getState().viewport;
    const { stampSize: size, stampStepIdx: idx } = useUIStore.getState();
    useSceneStore.getState().pushHistory();
    useSceneStore.getState().clearStampStrokes();
    const stroke = buildZigZagStroke(w, h, size, idx);
    useSceneStore.getState().addStampStroke(stroke);
  }

  async function handleFile(file: File) {
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
    await preloadStampImage(url);
    setStampImageUrl(url);
    setStampShape('image');
  }

  function handleShapeSelect(s: StampShape) {
    if (s === 'image') {
      setStampShape('image');
      if (!stampImageUrl) {
        fileInputRef.current?.click();
      }
    } else {
      setStampShape(s);
    }
  }

  function handleClear() {
    useSceneStore.getState().pushHistory();
    useSceneStore.getState().clearStampStrokes();
  }

  const stepMultiplier = STEP_MULTIPLIERS[stampStepIdx] ?? 1.0;

  return (
    <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
      <h2 className="font-cond-black font-black text-[24px] text-[#BBBFC8] uppercase leading-none">
        Штамп
      </h2>

      {/* Zig-zag fill */}
      <button
        onClick={handleZigZag}
        className="h-[44px] w-full font-cond-regular text-[18px] bg-[#0e0f11] text-white rounded-[8px] hover:opacity-90 transition-opacity"
      >
        Заполнить зигзагом
      </button>

      {/* Shape picker */}
      <div className="flex gap-[2px] rounded-[8px] bg-[#E5E7EC] p-[3px]">
        {(['square', 'rhomb', 'image'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleShapeSelect(s)}
            className={[
              'flex-1 h-[32px] font-cond-regular text-[15px] rounded-[6px] transition-colors',
              stampShape === s
                ? 'bg-white text-[#0e0f11] shadow-sm'
                : 'text-[#6B7280] hover:text-[#0e0f11]',
            ].join(' ')}
          >
            {s === 'square' ? '▪' : s === 'rhomb' ? '◆' : '🖼'}
          </button>
        ))}
      </div>

      {/* Image clear button (shown when image loaded) */}
      {stampImageUrl && (
        <button
          onClick={() => { setStampImageUrl(null); setStampShape('square'); }}
          className="h-[36px] w-full font-cond-regular text-[13px] bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] hover:opacity-90 transition-opacity"
        >
          Удалить изображение ✕
        </button>
      )}

      {/* Sliders — dark section */}
      <div className="bg-[#0e0f11] rounded-[12px] p-3 flex flex-col gap-3">
        <Slider
          label="Размер"
          value={stampSize}
          min={60}
          max={120}
          step={5}
          onChange={setStampSize}
        />
        {/* Discrete step slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-[#6B7280] font-cond-regular">Шаг</span>
            <span className="text-[13px] text-white font-cond-regular">×{stepMultiplier.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={9}
            step={1}
            value={stampStepIdx}
            onChange={(e) => setStampStepIdx(Number(e.target.value))}
            className="w-full accent-white"
          />
        </div>
      </div>

      {/* Colour slots */}
      <ColorSlot
        label="Штамп"
        color={shapeColor}
        onChange={(c) => { pushHistory(captureUISnap()); setShapeColor(c); }}
        initialHistory={['#FE443B']}
      />
      <ColorSlot
        label="Холст"
        color={canvasColor}
        onChange={(c) => { pushHistory(captureUISnap()); setCanvasColor(c); }}
      />

      {/* Color presets */}
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((p) => {
          const selected = shapeColor === p.shape && canvasColor === p.canvas;
          return (
            <button
              key={`${p.shape}-${p.canvas}`}
              onClick={() => { pushHistory(captureUISnap()); setShapeColor(p.shape); setCanvasColor(p.canvas); }}
              className={`w-8 h-8 rounded-[8px] overflow-hidden transition-transform
                ${selected
                  ? 'border-2 border-[#0e0f11] scale-110'
                  : 'border-2 border-transparent scale-100 hover:scale-105'}`}
              title={`Штамп: ${p.shape} / Холст: ${p.canvas}`}
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

      {/* Clear */}
      <button
        onClick={handleClear}
        className="h-[44px] w-full font-cond-regular text-[14px] bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] hover:opacity-90 transition-opacity"
      >
        Очистить
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
