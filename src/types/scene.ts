// ─── Mode 1: Generator ───────────────────────────────────────────────────────

/** Controls whether a rect's top edge is angled (one corner raised) or flat (both at same Y) */
export type TopStyle = 'angled' | 'flat';

/** A single perspective-transformed rectangle within a compound shape */
export interface PerspectiveRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cornerRadius: number;
  /** Y shift of the top-left corner in document units (negative = raised up) */
  topLeftOffset: number;
  /** Y shift of the top-right corner in document units (negative = raised up) */
  topRightOffset: number;
  /** Y shift of the bottom-right corner (positive = pushed further down, negative = raised up) */
  bottomRightOffset: number;
  /** Y shift of the bottom-left corner (positive = pushed further down, negative = raised up) */
  bottomLeftOffset: number;
  /** Rotation around the rect's geometric center, in degrees (negative = counter-clockwise) */
  rotation: number;
  /** Whether the top edge is angled or flat (tlo == tro when flat) */
  topStyle: TopStyle;
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
