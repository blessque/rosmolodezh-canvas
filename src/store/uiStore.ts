import { create } from 'zustand';

export type StampShape = 'square' | 'rhomb' | 'image';

export const STEP_MULTIPLIERS = [2.0, 1.6, 1.25, 1.0, 0.8, 0.6, 0.45, 0.3, 0.2, 0.1] as const;

export type AppMode = 'generator' | 'stamp';

/** Subset of UI state captured in undo/redo history entries. */
export interface UndoableUISnapshot {
  mode: AppMode;
  canvasColor: string;
  shapeColor: string;
  documentWidth: number;
  documentHeight: number;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  documentWidth: number;
  documentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface UIStoreState {
  mode: AppMode;
  viewport: ViewportState;
  canvasColor: string;
  shapeColor: string;
  stampSize: number;
  stampStepIdx: number;
  stampShape: StampShape;
  stampImageUrl: string | null;
  rectCount: 2 | 3;

  setMode: (mode: AppMode) => void;
  setViewport: (partial: Partial<ViewportState>) => void;
  setDocumentSize: (w: number, h: number) => void;
  setCanvasColor: (c: string) => void;
  setShapeColor: (c: string) => void;
  setStampSize: (v: number) => void;
  setStampStepIdx: (v: number) => void;
  setStampShape: (s: StampShape) => void;
  setStampImageUrl: (url: string | null) => void;
  imagePickerActive: boolean;
  setImagePickerActive: (v: boolean) => void;
  setRectCount: (v: 2 | 3) => void;
  isDraggingFile: boolean;
  pendingImageUrl: string | null;
  setIsDraggingFile: (v: boolean) => void;
  setPendingImageUrl: (url: string | null) => void;
  captureSnapshot: () => UndoableUISnapshot;
  restoreUISnapshot: (snap: UndoableUISnapshot) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  mode: 'generator',
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
    documentWidth: 1080,
    documentHeight: 1350,
    canvasWidth: 0,
    canvasHeight: 0,
  },
  canvasColor: '#FFFFFF',
  shapeColor:  '#99ECFF',
  stampSize: 80,
  stampStepIdx: 3,
  stampShape: 'square',
  stampImageUrl: null,
  rectCount: 3,
  imagePickerActive: false,
  isDraggingFile: false,
  pendingImageUrl: null,

  setMode: (mode) => set({ mode }),

  setViewport: (partial) =>
    set((state) => ({ viewport: { ...state.viewport, ...partial } })),

  setDocumentSize: (w, h) =>
    set((state) => ({
      viewport: { ...state.viewport, documentWidth: w, documentHeight: h },
    })),

  setCanvasColor: (c) => set({ canvasColor: c }),
  setShapeColor: (c) => set({ shapeColor: c }),
  setStampSize: (v) => set({ stampSize: v }),
  setStampStepIdx: (v) => set({ stampStepIdx: v }),
  setStampShape: (s) => set({ stampShape: s }),
  setStampImageUrl: (url) => set({ stampImageUrl: url }),
  setImagePickerActive: (v) => set({ imagePickerActive: v }),
  setRectCount: (v) => set({ rectCount: v }),
  setIsDraggingFile: (v) => set({ isDraggingFile: v }),
  setPendingImageUrl: (url) => set({ pendingImageUrl: url }),

  captureSnapshot: () => {
    const s = get();
    return {
      mode: s.mode,
      canvasColor: s.canvasColor,
      shapeColor: s.shapeColor,
      documentWidth: s.viewport.documentWidth,
      documentHeight: s.viewport.documentHeight,
    };
  },

  restoreUISnapshot: (snap) =>
    set((state) => ({
      mode: snap.mode,
      canvasColor: snap.canvasColor,
      shapeColor: snap.shapeColor,
      viewport: { ...state.viewport, documentWidth: snap.documentWidth, documentHeight: snap.documentHeight },
    })),
}));
