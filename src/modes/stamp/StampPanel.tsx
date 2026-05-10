/**
 * StampPanel — controls for stamp mode: zig-zag fill, size/step sliders,
 * rotate toggle, color picker, image upload, clear.
 */

import { useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { buildZigZagStroke } from '@/modes/stamp/StampEngine';
import { preloadStampImage } from '@/canvas/stampRenderer';
import { Slider } from '@/components/Slider';
import { Toggle } from '@/components/Toggle';
import { ColorSlot } from '@/components/ColorSlot';

export function StampPanel() {
  const shapeColor    = useUIStore((s) => s.shapeColor);
  const setShapeColor = useUIStore((s) => s.setShapeColor);
  const stampSize     = useUIStore((s) => s.stampSize);
  const setStampSize  = useUIStore((s) => s.setStampSize);
  const stampStep     = useUIStore((s) => s.stampStep);
  const setStampStep  = useUIStore((s) => s.setStampStep);
  const stampRotate45 = useUIStore((s) => s.stampRotate45);
  const setStampRotate45 = useUIStore((s) => s.setStampRotate45);
  const stampImageUrl = useUIStore((s) => s.stampImageUrl);
  const setStampImageUrl = useUIStore((s) => s.setStampImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleZigZag() {
    const { documentWidth: w, documentHeight: h } = useUIStore.getState().viewport;
    const { stampSize: size, stampStep: step } = useUIStore.getState();
    useSceneStore.getState().pushHistory();
    useSceneStore.getState().clearAll();
    const stroke = buildZigZagStroke(w, h, size, step);
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
  }

  function handleClear() {
    useSceneStore.getState().pushHistory();
    useSceneStore.getState().clearAll();
  }

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

      {/* Sliders — dark section matches app's dark dev panel style */}
      <div className="bg-[#0e0f11] rounded-[12px] p-3 flex flex-col gap-3">
        <Slider
          label="Размер"
          value={stampSize}
          min={20}
          max={300}
          step={5}
          onChange={setStampSize}
        />
        <Slider
          label="Шаг"
          value={stampStep}
          min={20}
          max={400}
          step={5}
          onChange={setStampStep}
        />
        <Toggle
          label="Повернуть 45°"
          checked={stampRotate45}
          onChange={setStampRotate45}
        />
      </div>

      {/* Colour */}
      <ColorSlot label="Цвет" color={shapeColor} onChange={setShapeColor} />

      {/* Image upload */}
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 h-[44px] font-cond-regular text-[14px] bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] hover:opacity-90 transition-opacity"
        >
          {stampImageUrl ? 'Изображение загружено ✓' : 'Загрузить PNG'}
        </button>
        {stampImageUrl && (
          <button
            onClick={() => setStampImageUrl(null)}
            className="h-[44px] px-3 font-cond-regular text-[14px] bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] hover:opacity-90 transition-opacity"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div className="h-px bg-[#E0E2E8]" />

      {/* Clear */}
      <button
        onClick={handleClear}
        className="h-[44px] w-full font-cond-regular text-[14px] bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] hover:opacity-90 transition-opacity"
      >
        Очистить
      </button>
    </div>
  );
}
