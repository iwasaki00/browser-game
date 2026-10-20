import { TerrainType, type WorldState } from './world';

export interface Point { x: number; y: number }
export interface Segment { from: Point; to: Point }
export type StrokeMode = 'RAISE' | 'LOWER';
export interface StrokeOptions {
  mode: StrokeMode; maxLength: number; radius: number; heightDelta: number;
}
export interface Stroke extends StrokeOptions {
  /** Effective vertices only. segments preserves breaks caused by leaving the board. */
  points: Point[];
  segments: Segment[];
  effectiveLength: number;
}
export interface StrokePreview { stroke: Stroke; overflow: Segment[] }
export interface CellEdit { index: number; before: number; after: number }
export const DEFAULT_BRUSH = { maxLength: 12, radius: 2, heightDelta: 12 } as const;
const EPSILON = 1e-9;
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
function validPoint(point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1e7 || Math.abs(point.y) > 1e7) {
    throw new Error('一筆の座標が有効範囲外です');
  }
}
function validateOptions(options: StrokeOptions): void {
  if (!['RAISE', 'LOWER'].includes(options.mode) || !Number.isFinite(options.maxLength) || options.maxLength <= 0
    || !Number.isFinite(options.radius) || options.radius < 0
    || !Number.isInteger(options.heightDelta) || options.heightDelta <= 0 || options.heightDelta > 255) {
    throw new Error('一筆のブラシ設定が不正です');
  }
}
/** Liang–Barsky clipping: outside travel does not consume the edit budget. */
function clip(from: Point, to: Point, width: number, height: number): Segment | null {
  let start = 0, end = 1;
  const dx = to.x - from.x, dy = to.y - from.y;
  for (const [p, q] of [[-dx, from.x], [dx, width - from.x], [-dy, from.y], [dy, height - from.y]]) {
    if (p === 0) { if (q < 0) return null; }
    else {
      const t = q / p;
      if (p < 0) start = Math.max(start, t); else end = Math.min(end, t);
      if (start > end) return null;
    }
  }
  return { from: lerp(from, to, start), to: lerp(from, to, end) };
}
/** Raw input is kept by the input/session layer. Only bounded effective geometry reaches simulation. */
export function buildStroke(points: readonly Point[], width: number, height: number,
  options: StrokeOptions): StrokePreview {
  validateOptions(options);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('盤面サイズが不正です');
  points.forEach(validPoint);
  const stroke: Stroke = { ...options, points: [], segments: [], effectiveLength: 0 };
  const overflow: Segment[] = [];
  const add = (segment: Segment) => {
    stroke.segments.push(segment);
    stroke.points.push({ ...segment.from }, { ...segment.to });
  };
  for (let i = 0; i < points.length; i++) {
    const segment = clip(points[Math.max(0, i - 1)], points[i], width, height);
    if (!segment) continue;
    const distance = length(segment.from, segment.to);
    const remaining = Math.max(0, options.maxLength - stroke.effectiveLength);
    if (distance === 0) {
      if (stroke.segments.length === 0 && remaining > 0) add(segment);
      continue;
    }
    if (remaining === 0) { overflow.push(segment); continue; }
    if (distance <= remaining) {
      add(segment); stroke.effectiveLength += distance;
    } else {
      const end = lerp(segment.from, segment.to, remaining / distance);
      add({ from: segment.from, to: end });
      overflow.push({ from: end, to: segment.to });
      stroke.effectiveLength = options.maxLength;
    }
  }
  return { stroke, overflow };
}
export function distanceToSegment(point: Point, segment: Segment): number {
  const dx = segment.to.x - segment.from.x, dy = segment.to.y - segment.from.y;
  const squared = dx * dx + dy * dy;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / squared));
  return Math.hypot(point.x - (segment.from.x + t * dx), point.y - (segment.from.y + t * dy));
}
/** Single source of truth for both preview and application, including protection and saturation. */
export function strokeEdits(world: WorldState, stroke: Stroke): CellEdit[] {
  validateOptions(stroke);
  const touched = new Set<number>();
  for (const segment of stroke.segments) {
    validPoint(segment.from); validPoint(segment.to);
    const minX = Math.max(0, Math.ceil(Math.min(segment.from.x, segment.to.x) - stroke.radius - .5 - EPSILON));
    const maxX = Math.min(world.width - 1, Math.floor(Math.max(segment.from.x, segment.to.x) + stroke.radius - .5 + EPSILON));
    const minY = Math.max(0, Math.ceil(Math.min(segment.from.y, segment.to.y) - stroke.radius - .5 - EPSILON));
    const maxY = Math.min(world.height - 1, Math.floor(Math.max(segment.from.y, segment.to.y) + stroke.radius - .5 + EPSILON));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const index = y * world.width + x;
      if (!world.protected[index] && world.terrainType[index] === TerrainType.Normal
        && distanceToSegment({ x: x + .5, y: y + .5 }, segment) <= stroke.radius + EPSILON) touched.add(index);
    }
  }
  return [...touched].sort((a, b) => a - b).flatMap(index => {
    const before = world.heights[index];
    const after = Math.max(0, Math.min(255, before + (stroke.mode === 'RAISE' ? stroke.heightDelta : -stroke.heightDelta)));
    return before === after ? [] : [{ index, before, after }];
  });
}
export function applyStroke(world: WorldState, stroke: Stroke): CellEdit[] {
  const edits = strokeEdits(world, stroke);
  for (const edit of edits) world.heights[edit.index] = edit.after;
  return edits;
}
