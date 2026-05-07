// ─── Mode 1: Generator ───────────────────────────────────────────────────────

/** A single perspective-transformed rectangle within a compound shape */
export interface PerspectiveRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cornerRadius: number;
  /** Which side the perspective depth expands toward */
  expand: 'left' | 'right';
  /** Depth of the perspective transform in document units */
  depth: number;
}

/** The compound shape built from several perspective rects */
export interface CompoundShape {
  type: 'compound';
  id: string;
  rects: PerspectiveRect[];
  /** Optional image URL used as a fill/mask on one rect */
  imageUrl?: string;
  /** Index into rects[] that receives the image mask */
  maskedRectIndex: number;
}

// ─── Mode 2: Stamp ───────────────────────────────────────────────────────────

export type StampShapeType = 'roundedRect' | 'ellipse' | 'customSvg' | 'uploadedPng';

/** A single stamp instance placed on the canvas */
export interface StampInstance {
  x: number;
  y: number;
  angle: number;
  shape: StampShapeType;
}

/** A stroke (series of stamps) painted by the user */
export interface StampStroke {
  type: 'stamp';
  id: string;
  stamps: StampInstance[];
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type SceneObject = CompoundShape | StampStroke;
