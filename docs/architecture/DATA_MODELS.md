# Data Models

All types are in `src/types/scene.ts` and `src/types/geometry.ts`.

## CompoundShape

```ts
interface CompoundShape {
  type: 'compound';
  id: string;
  rects: PerspectiveRect[];
  imageUrl?: string;       // optional image fill/mask
  maskedRectIndex: number; // which rect gets the image
}
```

## PerspectiveRect

```ts
interface PerspectiveRect {
  id: string;
  x: number; y: number;
  w: number; h: number;
  cornerRadius: number;
  expand: 'left' | 'right'; // which side perspective depth expands toward
  depth: number;             // depth in document units
}
```

## StampStroke

```ts
interface StampStroke {
  type: 'stamp';
  id: string;
  stamps: StampInstance[];
}
```

## StampInstance

```ts
interface StampInstance {
  x: number; y: number;  // position in document units
  angle: number;         // rotation in radians
  shape: StampShapeType; // 'roundedRect' | 'ellipse' | 'customSvg' | 'uploadedPng'
}
```

## SceneObject union

```ts
type SceneObject = CompoundShape | StampStroke;
```

## ViewportState (uiStore)

```ts
interface ViewportState {
  zoom: number;
  panX: number; panY: number;        // additional doc-space pan (0 in MVP)
  documentWidth: number;
  documentHeight: number;
  canvasWidth: number;               // CSS px — set by ResizeObserver
  canvasHeight: number;
}
```
