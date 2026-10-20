import type { Point } from './stage';

/** Presentation-only interpolation along an edge's polyline. */
export function routePosition(points: readonly Point[], progress: number): Point & { angle: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const a = points[i], b = points[i + 1], t = lengths[i] ? distance / lengths[i] : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    distance -= lengths[i];
  }
  return { ...points[0], angle: 0 };
}
