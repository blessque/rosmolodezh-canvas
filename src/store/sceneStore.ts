import { create } from 'zustand';
import type { SceneObject, ImageTransform } from '@/types/scene';
// store→store import: acceptable here because undo/redo must restore UI state
import { useUIStore, type UndoableUISnapshot } from '@/store/uiStore';

interface HistoryEntry {
  objects: SceneObject[];
  ui?: UndoableUISnapshot;
}

interface SceneStoreState {
  objects: SceneObject[];
  past: HistoryEntry[];
  future: HistoryEntry[];

  setCompoundShape: (obj: SceneObject & { type: 'compound' }) => void;
  addStampStroke: (obj: SceneObject & { type: 'stamp' }) => void;
  removeObject: (id: string) => void;
  clearAll: () => void;
  clearStampStrokes: () => void;
  pushHistory: (uiSnap?: UndoableUISnapshot) => void;
  undo: () => void;
  redo: () => void;

  /** Set imageUrl on compound without touching maskedRectIndices (pick-mode entry point) */
  setRawImageUrl: (imageUrl: string) => void;

  /** Assign mask rects + image + initial cover transform; pushes history */
  setImageMask: (maskedRectIndices: number[], imageUrl: string, imageTransform: ImageTransform) => void;

  /** Update image transform live (no history — call commitImageTransform on pointerup) */
  setImageTransform: (transform: ImageTransform) => void;

  /** Commit current imageTransform to history (call on pointerup after drag) */
  commitImageTransform: () => void;

  /** Remove image entirely; pushes history */
  removeImage: () => void;

  /**
   * Auto-assign mask to the specified rect indices with precomputed transform.
   * Caller is responsible for computing the largest-rect index and cover transform.
   */
  autoAssignLargestRect: (imageUrl: string, maskedRectIndices: number[], imageTransform: ImageTransform) => void;
}

function cloneObject(obj: SceneObject): SceneObject {
  if (obj.type === 'stamp') return { ...obj, stamps: [...obj.stamps] };
  return {
    ...obj,
    rects: [...obj.rects],
    maskedRectIndices: [...obj.maskedRectIndices],
    imageTransform: { ...obj.imageTransform },
  };
}

function cloneObjects(objects: SceneObject[]): SceneObject[] {
  return objects.map(cloneObject);
}

const MAX_HISTORY = 50;

export const useSceneStore = create<SceneStoreState>((set, get) => ({
  objects: [],
  past: [],
  future: [],

  setCompoundShape: (obj) =>
    set((state) => {
      const existing = state.objects.findIndex((o) => o.type === 'compound');
      if (existing >= 0) {
        const next = [...state.objects];
        next[existing] = obj;
        return { objects: next };
      }
      return { objects: [...state.objects, obj] };
    }),

  addStampStroke: (obj) =>
    set((state) => ({ objects: [...state.objects, obj] })),

  removeObject: (id) =>
    set((state) => ({ objects: state.objects.filter((o) => o.id !== id) })),

  clearAll: () => set({ objects: [] }),
  clearStampStrokes: () =>
    set((s) => ({ objects: s.objects.filter((o) => o.type !== 'stamp') })),

  pushHistory: (uiSnap) =>
    set((s) => ({
      past: [...s.past, { objects: cloneObjects(s.objects), ui: uiSnap }].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: () => {
    const past = get().past;
    const entry = past.length > 0 ? past[past.length - 1] : undefined;
    if (!entry) return;
    if (entry.ui) useUIStore.getState().restoreUISnapshot(entry.ui);
    set((s) => ({
      objects: entry.objects,
      past: s.past.slice(0, -1),
      future: [{ objects: cloneObjects(s.objects) }, ...s.future].slice(0, MAX_HISTORY),
    }));
  },

  redo: () => {
    const entry = get().future[0];
    if (!entry) return;
    if (entry.ui) useUIStore.getState().restoreUISnapshot(entry.ui);
    set((s) => ({
      objects: entry.objects,
      past: [...s.past, { objects: cloneObjects(s.objects) }].slice(-MAX_HISTORY),
      future: s.future.slice(1),
    }));
  },

  setRawImageUrl: (imageUrl) =>
    set((s) => {
      const idx = s.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return s;
      const compound = s.objects[idx]!;
      if (compound.type !== 'compound') return s;
      const next = [...s.objects];
      next[idx] = { ...compound, imageUrl };
      return { objects: next };
    }),

  setImageMask: (maskedRectIndices, imageUrl, imageTransform) => {
    get().pushHistory();
    set((s) => {
      const idx = s.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return s;
      const compound = s.objects[idx]!;
      if (compound.type !== 'compound') return s;
      const next = [...s.objects];
      next[idx] = { ...compound, imageUrl, maskedRectIndices, imageTransform };
      return { objects: next };
    });
  },

  setImageTransform: (transform) =>
    set((s) => {
      const idx = s.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return s;
      const compound = s.objects[idx]!;
      if (compound.type !== 'compound') return s;
      const next = [...s.objects];
      next[idx] = { ...compound, imageTransform: transform };
      return { objects: next };
    }),

  commitImageTransform: () => {
    const s = get();
    const compound = s.objects.find((o) => o.type === 'compound');
    if (!compound || compound.type !== 'compound') return;
    const transform = { ...compound.imageTransform };
    s.pushHistory();
    set((cur) => {
      const idx = cur.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return cur;
      const c = cur.objects[idx]!;
      if (c.type !== 'compound') return cur;
      const next = [...cur.objects];
      next[idx] = { ...c, imageTransform: transform };
      return { objects: next };
    });
  },

  removeImage: () => {
    get().pushHistory();
    set((s) => {
      const idx = s.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return s;
      const compound = s.objects[idx]!;
      if (compound.type !== 'compound') return s;
      const next = [...s.objects];
      next[idx] = {
        ...compound,
        imageUrl: undefined,
        maskedRectIndices: [],
        imageTransform: { translateX: 0, translateY: 0, scale: 1, rotateDeg: 0 },
      };
      return { objects: next };
    });
  },

  autoAssignLargestRect: (imageUrl, maskedRectIndices, imageTransform) =>
    set((s) => {
      const idx = s.objects.findIndex((o) => o.type === 'compound');
      if (idx < 0) return s;
      const compound = s.objects[idx]!;
      if (compound.type !== 'compound') return s;
      const next = [...s.objects];
      next[idx] = { ...compound, imageUrl, maskedRectIndices, imageTransform };
      return { objects: next };
    }),
}));
