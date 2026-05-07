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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#111112] text-white">
      {/* Mode tab bar */}
      <div className="shrink-0 px-4 pt-3">
        <ModeTabBar />
      </div>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar border-r border-white/10">
          <div className="flex flex-col gap-3 px-3 py-4">
            {mode === 'generator' ? <GeneratorPanel /> : <StampPanel />}

            <div className="h-px bg-white/10 my-1" />
            <p className="text-xs text-white/30 uppercase tracking-wider px-1">Canvas size</p>
            <CanvasSizeSelector />
          </div>
        </aside>

        {/* Canvas area */}
        <main className="flex-1 overflow-hidden bg-black p-6 pb-[calc(1.5rem+52px)]">
          <CanvasRoot>
            {mode === 'generator' && <GeneratorCanvas />}
            {mode === 'stamp' && <StampCanvas />}
          </CanvasRoot>
        </main>
      </div>

      {/* Export bar — floats at bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="pointer-events-auto flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-[#111112]">
          <button
            onClick={() => exportSVG(viewport.documentWidth, viewport.documentHeight)}
            className="rounded-[6px] bg-[#202226] px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Export SVG
          </button>
          <button
            onClick={() => exportPNG(viewport.documentWidth, viewport.documentHeight)}
            className="rounded-[6px] bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"
          >
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}
