import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { generateCompoundShape } from '@/modes/generator/GeneratorEngine';
import type { GeneratorComplexity } from '@/store/uiStore';

export function GeneratorPanel() {
  const complexity = useUIStore((s) => s.complexity);
  const shapeColor = useUIStore((s) => s.shapeColor);
  const canvasColor = useUIStore((s) => s.canvasColor);
  const viewport = useUIStore((s) => s.viewport);
  const setComplexity = useUIStore((s) => s.setComplexity);
  const setShapeColor = useUIStore((s) => s.setShapeColor);
  const setCanvasColor = useUIStore((s) => s.setCanvasColor);

  function handleRegenerate() {
    useSceneStore.getState().pushHistory();
    const result = generateCompoundShape(complexity, viewport.documentWidth, viewport.documentHeight);
    useSceneStore.getState().setCompoundShape(result);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Regenerate */}
      <button
        onClick={handleRegenerate}
        className="w-full rounded-[6px] bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"
      >
        Regenerate
      </button>

      {/* Complexity */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40 uppercase tracking-wider px-1">Complexity</p>
        <div className="flex gap-1">
          {([2, 3, 4] as GeneratorComplexity[]).map((n) => (
            <button
              key={n}
              onClick={() => setComplexity(n)}
              className={`flex-1 rounded-[6px] px-3 py-1.5 text-sm transition-colors ${
                complexity === n
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

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
    </div>
  );
}
