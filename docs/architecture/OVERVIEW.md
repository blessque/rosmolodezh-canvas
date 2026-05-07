# Architecture Overview

## Two-Mode Data Flow

```
App.tsx
  ├── ModeTabBar          → uiStore.setMode('generator' | 'stamp')
  ├── Sidebar
  │     ├── GeneratorPanel  (mode === 'generator')
  │     └── StampPanel      (mode === 'stamp')
  ├── CanvasRoot          → draws document background; keyboard undo/redo
  └── Export bar          → exportPNG / exportSVG
```

### Generator mode
```
GeneratorPanel → uiStore.complexity / sceneStore.setCompoundShape
GeneratorEngine.generateCompoundShape(complexity) → CompoundShape
GeneratorCanvas renders CompoundShape via Canvas 2D
```

### Stamp mode
```
StampCanvas pointer events → StampEngine.computeStampPositions → StampStroke
sceneStore.addStampStroke(stroke)
StampCanvas renders all StampStroke objects
```

## Export pipeline

Both `exportPNG` and `exportSVG` create off-screen representations at full document resolution.
They do NOT read from the on-screen canvas — they re-render from sceneStore objects.

## CanvasRoot responsibilities (MVP)

- DPR-aware canvas resize via `ResizeObserver`
- Keeps `viewport.canvasWidth/Height` in sync with `uiStore`
- Paints document background rectangle (letterboxed)
- Wires `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` → `sceneStore.undo/redo`
- Does NOT render shapes — delegated to mode-specific canvases (next iteration)

## Coordinate spaces

- **Screen px** — raw pointer event coords (`clientX/Y`)
- **Canvas px** — CSS px relative to the `<canvas>` element
- **Document units** — logical design coordinates (e.g. 1080×1080 for 1:1)

Use `screenToCanvas → canvasToDocument` from `src/utils/coordinates.ts` to convert.
DPR scaling is handled inside CanvasRoot (`ctx.scale(dpr, dpr)`).
