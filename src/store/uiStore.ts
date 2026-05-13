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

interface UIStoreState {
  mode: AppMode;
  viewport: ViewportState;
  canvasColor: string;
  shapeColor: string;
  stampSize: number;
  stampStep: number;
  stampRotate45: boolean;
  stampImageUrl: string | null;
  rectCount: 2 | 3;

  setMode: (mode: AppMode) => void;
  setViewport: (partial: Partial<ViewportState>) => void;
  setDocumentSize: (w: number, h: number) => void;
  setCanvasColor: (c: string) => void;
  setShapeColor: (c: string) => void;
  setStampSize: (v: number) => void;
  setStampStep: (v: number) => void;
  setStampRotate45: (v: boolean) => void;
  setStampImageUrl: (url: string | null) => void;
  imagePickerActive: boolean;
  setImagePickerActive: (v: boolean) => void;
  setRectCount: (v: 2 | 3) => void;
  isDraggingFile: boolean;
  pendingImageUrl: string | null;
  setIsDraggingFile: (v: boolean) => void;
  setPendingImageUrl: (url: string | null) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
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
  stampStep: 120,
  stampRotate45: false,
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
  setStampStep: (v) => set({ stampStep: v }),
  setStampRotate45: (v) => set({ stampRotate45: v }),
  setStampImageUrl: (url) => set({ stampImageUrl: url }),
  setImagePickerActive: (v) => set({ imagePickerActive: v }),
  setRectCount: (v) => set({ rectCount: v }),
  setIsDraggingFile: (v) => set({ isDraggingFile: v }),
  setPendingImageUrl: (url) => set({ pendingImageUrl: url }),
}));
