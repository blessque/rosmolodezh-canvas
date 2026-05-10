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

export default function App() {
  const mode = useUIStore((s) => s.mode);
  const viewport = useUIStore((s) => s.viewport);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F0F2F7] text-[#0e0f11]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar flex flex-col gap-3 px-3 py-3">
          <img src="/icons/BM—logo_main.svg" className="h-7 w-auto shrink-0" alt="Logo" />
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
            <h2 className="font-cond-black font-black text-[24px] text-[#BBBFC8] uppercase leading-none">Холст</h2>
            <CanvasSizeSelector />
          </div>

          {/* Export card */}
          <div className="bg-white rounded-[22px] p-3 flex flex-col gap-4">
            <h2 className="font-cond-black font-black text-[24px] text-[#BBBFC8] uppercase leading-none">Картинка</h2>
            <button
              onClick={() => exportPNG(viewport.documentWidth, viewport.documentHeight)}
              className="bg-[#0e0f11] text-white rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 transition-opacity"
            >
              PNG
            </button>
            <button
              onClick={() => exportSVG(viewport.documentWidth, viewport.documentHeight)}
              className="bg-[#ECEEF3] text-[#0e0f11] rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 transition-opacity"
            >
              SVG
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
