import { create } from 'zustand';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  documentWidth: number;
  documentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export type AppMode = 'generator' | 'stamp';
export type GeneratorComplexity = 2 | 3 | 4;

interface UIStoreState {
  mode: AppMode;
  viewport: ViewportState;
  canvasColor: string;
  shapeColor: string;
  complexity: GeneratorComplexity;

  setMode: (mode: AppMode) => void;
  setViewport: (partial: Partial<ViewportState>) => void;
  setDocumentSize: (w: number, h: number) => void;
  setCanvasColor: (c: string) => void;
  setShapeColor: (c: string) => void;
  setComplexity: (n: GeneratorComplexity) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  mode: 'generator',
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
    documentWidth: 1080,
    documentHeight: 1080,
    canvasWidth: 0,
    canvasHeight: 0,
  },
  canvasColor: '#0E0F11',
  shapeColor: '#FFFFFF',
  complexity: 3,

  setMode: (mode) => set({ mode }),

  setViewport: (partial) =>
    set((state) => ({ viewport: { ...state.viewport, ...partial } })),

  setDocumentSize: (w, h) =>
    set((state) => ({
      viewport: { ...state.viewport, documentWidth: w, documentHeight: h },
    })),

  setCanvasColor: (c) => set({ canvasColor: c }),
  setShapeColor: (c) => set({ shapeColor: c }),
  setComplexity: (n) => set({ complexity: n }),
}));
