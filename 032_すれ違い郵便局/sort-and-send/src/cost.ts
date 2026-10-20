import type { Direction } from './stage';
import type { SimulationResult } from './simulation';

/** Include the last-to-first transition, once for each slot in the loop. */
export function patternCost(pattern: readonly Direction[]): number {
  return pattern.reduce((cost, direction, i) => cost + Number(direction !== pattern[(i + 1) % pattern.length]), 0);
}

export function deliveryCost(patterns: Record<string, readonly Direction[]>, result: SimulationResult): number {
  const used = new Set(result.events.filter(e => e.type === 'move' && e.direction !== undefined).map(e => e.from!));
  return [...used].reduce((cost, id) => {
    if (!patterns[id]) throw new Error(`分岐${id}のパターンがありません。`);
    return cost + patternCost(patterns[id]);
  }, 0);
}
