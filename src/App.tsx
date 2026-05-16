import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { CanvasRoot } from '@/canvas/CanvasRoot';
import { ModeTabBar } from '@/components/ModeTabBar';
import { CanvasSizeSelector } from '@/components/CanvasSizeSelector';
import { GeneratorPanel } from '@/modes/generator/GeneratorPanel';
import { StampPanel } from '@/modes/stamp/StampPanel';
import { GeneratorCanvas } from '@/modes/generator/GeneratorCanvas';
import { StampCanvas } from '@/modes/stamp/StampCanvas';
import { exportPNG } from '@/export/exportPNG';
import { exportSVG } from '@/export/exportSVG';
// import { getLogoForColors } from '@/utils/colorPresets'; // LOGO_RECOLOR_PRESERVED

export default function App() {
  const mode = useUIStore((s) => s.mode);
  const viewport = useUIStore((s) => s.viewport);
  const stampImageUrl = useUIStore((s) => s.stampImageUrl);
  const svgDisabled = mode === 'stamp' && !!stampImageUrl;

  const isDraggingFile = useUIStore((s) => s.isDraggingFile);
  const pendingImageUrl = useUIStore((s) => s.pendingImageUrl);
  const setPendingImageUrl = useUIStore((s) => s.setPendingImageUrl);

  const [pngScale, setPngScale] = useState<1 | 2>(1);

  // Cursor thumbnail position
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // File processor: converts File to data URL
  async function processFile(file: File): Promise<string> {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(file.name);
    if (isHeic) {
      const heic2any = (await import('heic2any')).default;
      const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })) as Blob;
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  }

  // Global drag listeners
  useEffect(() => {
    // dragDepth counter: fixes Safari spurious dragLeave on child elements
    let dragDepth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        dragDepth++;
        useUIStore.getState().setIsDraggingFile(true);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) useUIStore.getState().setIsDraggingFile(false);
      }
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragDepth = 0;
      useUIStore.getState().setIsDraggingFile(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      try {
        const url = await processFile(file);
        const { preloadImage } = await import('@/canvas/imageMaskRenderer');
        await preloadImage(url);
        useUIStore.getState().setPendingImageUrl(url);
      } catch (err) {
        console.error('[drop] Image processing failed:', err);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse tracking for cursor thumbnail
  useEffect(() => {
    if (!pendingImageUrl) return;
    const onMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [pendingImageUrl]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F0F2F7] text-[#0e0f11]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar flex flex-col gap-3 px-3 py-3">
          <img src="/rosmolodezh-logo.svg" className="h-[68px] w-auto shrink-0 self-start" alt="Logo" />
          <ModeTabBar />
          {mode === 'generator' ? <GeneratorPanel /> : <StampPanel />}
        </aside>

        {/* Canvas area */}
        <main className="flex-1 overflow-hidden bg-[#F0F2F7] p-6">
          <CanvasRoot>
            {mode === 'generator' && <GeneratorCanvas />}
            {mode === 'stamp' && <StampCanvas />}
          </CanvasRoot>
        </main>

        {/* Right sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar flex flex-col gap-3 px-3 py-3">
          {/* Canvas size card */}
          <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
            <h2 className="font-rm03 text-[28px] text-[#CED2DC] uppercase leading-none">Холст</h2>
            <CanvasSizeSelector />
          </div>

          {/* Export card */}
          <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
            <h2 className="font-rm03 text-[28px] text-[#CED2DC] uppercase leading-none">Картинка</h2>
            <div className="flex gap-[2px] rounded-[8px] bg-[#E5E7EC] p-[3px]">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setPngScale(n)}
                  className={`flex-1 h-[28px] font-cond-regular text-[14px] rounded-[6px] transition-colors
                    ${pngScale === n ? 'bg-white text-[#0e0f11] shadow-sm' : 'text-[#6B7280] hover:text-[#0e0f11]'}`}
                >
                  {n}×
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-[6px]">
              <button
                onClick={() => exportPNG(viewport.documentWidth, viewport.documentHeight, pngScale)}
                className="bg-[#0e0f11] text-white rounded-[8px] h-[44px] w-full text-[18px] hover:opacity-90 transition-opacity"
              >
                PNG
              </button>
              <button
                onClick={() => exportSVG(viewport.documentWidth, viewport.documentHeight)}
                disabled={svgDisabled}
                title={svgDisabled ? 'SVG export unavailable with image stamps' : undefined}
                className="bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] h-[44px] w-full text-[18px] transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:opacity-90"
              >
                SVG
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Full-screen drag overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-white/60 rounded-[32px] w-[80%] h-[80%] flex items-center justify-center">
            <span className="text-white text-[24px] font-cond-regular">Перетащите фото сюда</span>
          </div>
        </div>
      )}

      {/* Placing mode: bottom bar */}
      {pendingImageUrl && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0e0f11] text-white rounded-[14px] px-5 py-3 flex items-center gap-4 shadow-xl">
          <span className="font-cond-regular text-[15px]">Укажите, куда вставить фото</span>
          <button
            onClick={() => setPendingImageUrl(null)}
            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cursor thumbnail while placing */}
      {pendingImageUrl && (
        <div
          style={{ position: 'fixed', left: cursorPos.x + 16, top: cursorPos.y + 16, pointerEvents: 'none', zIndex: 45 }}
          className="w-16 h-16 rounded-[10px] overflow-hidden border-2 border-white shadow-lg"
        >
          <img src={pendingImageUrl} style={{ objectFit: 'cover', width: '100%', height: '100%' }} alt="" />
        </div>
      )}
    </div>
  );
}
