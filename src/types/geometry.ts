/** 2D point in document space */
export interface Point {
  x: number;
  y: number;
}

/** 2D vector (same shape as Point, semantically different) */
export type Vector = Point;

/** Axis-aligned bounding box */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single segment of a path */
export type CurveSegment =
  | { type: 'line'; from: Point; to: Point }
  | { type: 'cubic'; from: Point; cp1: Point; cp2: Point; to: Point }
  | { type: 'quadratic'; from: Point; cp: Point; to: Point }
  | {
      type: 'arc';
      center: Point;
      rx: number;
      ry: number;
      startAngle: number;
      endAngle: number;
      rotation: number;
    };

/** A closed or open path made of segments */
export interface Path {
  segments: CurveSegment[];
  closed: boolean;
}
