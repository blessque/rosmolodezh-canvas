import { create } from 'zustand';
import type { SceneObject } from '@/types/scene';

interface SceneStoreState {
  objects: SceneObject[];
  past: SceneObject[][];
  future: SceneObject[][];

  setCompoundShape: (obj: SceneObject & { type: 'compound' }) => void;
  addStampStroke: (obj: SceneObject & { type: 'stamp' }) => void;
  removeObject: (id: string) => void;
  clearAll: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneObject(obj: SceneObject): SceneObject {
  if (obj.type === 'stamp') return { ...obj, stamps: [...obj.stamps] };
  return { ...obj, rects: [...obj.rects] };
}

function cloneObjects(objects: SceneObject[]): SceneObject[] {
  return objects.map(cloneObject);
}

const MAX_HISTORY = 50;

export const useSceneStore = create<SceneStoreState>((set) => ({
  objects: [],
  past: [],
  future: [],

  setCompoundShape: (obj) =>
    set((state) => {
      // Replace existing compound shape or append
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

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, cloneObjects(s.objects)].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        objects: prev,
        past: s.past.slice(0, -1),
        future: [cloneObjects(s.objects), ...s.future].slice(0, MAX_HISTORY),
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0]!;
      return {
        objects: next,
        past: [...s.past, cloneObjects(s.objects)].slice(-MAX_HISTORY),
        future: s.future.slice(1),
      };
    }),
}));
