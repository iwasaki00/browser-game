import type { SimulationResult } from './simulation';
export const reducedMotion = (setting: boolean, osPreference: boolean) => setting || osPreference;
export function movementProgress(fraction: number, reduced: boolean) {
  const t = Math.max(0, Math.min(1, fraction));
  return reduced ? (t >= 1 ? 1 : 0) : t * t * (3 - 2 * t);
}
/** Display time only: simulation delivers at tick end; feedback never changes its events. */
export function recentArrivals(result: SimulationResult, elapsed: number, duration = .65) {
  return result.events.filter(e => e.type === 'deliver' && elapsed >= e.tick + 1 && elapsed < e.tick + 1 + duration);
}
