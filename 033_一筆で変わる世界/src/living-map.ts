import { TerrainType } from './core/world';
import { type WorldView, type DeepReadonly } from './core/world-view';
import { type FlowTransfer } from './core/simulation';
import { type CellEdit } from './core/stroke';
import { type TownProgress } from './challenge/goals';
import { type GoalDefinition } from './challenge/stage';

/** Shared Canvas/CSS palette. No visual option changes a simulation condition. */
export const MAP_THEME = Object.freeze({
  grass: '#B9D7A2', highland: '#71966F', water: '#54ADD7', light: '#BCE7F5',
  stroke: '#C58352', danger: '#C85B54', ink: '#344B3E', paper: '#F6F3E9',
  source: '#3B857C', intake: '#BD873C', outlet: '#866A91', protection: '#687B60',
  lower: '#527DA2', raise: '#C58352', cream: '#FFFDF4', success: '#4F8057',
  elevationLow: '#E2EBB3', elevationHigh: '#416D4F',
});
export interface DisplaySettings { showFlow: boolean; reducedMotion: boolean }
export const defaultDisplaySettings = (osReducedMotion: boolean): DisplaySettings => ({ showFlow: false, reducedMotion: osReducedMotion });
export interface TerrainTile { readonly index: number; readonly height: number; readonly color: string; readonly eastBoundary: boolean; readonly southBoundary: boolean }
export function terrainTiles(world: WorldView, view: string, edits: readonly CellEdit[], heightScale?: number): readonly TerrainTile[] {
  const heights = Array.from(world.heights);
  for (const edit of edits) heights[edit.index] = edit.after;
  let maximum = heightScale ?? 1;
  if (heightScale === undefined) for (const height of heights) maximum = Math.max(maximum, height);
  const rgbOf = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const low = rgbOf(view === 'height' ? MAP_THEME.elevationLow : MAP_THEME.grass);
  const high = rgbOf(view === 'height' ? MAP_THEME.elevationHigh : MAP_THEME.highland);
  return heights.map((height, index) => {
    const x = index % world.width, y = Math.floor(index / world.width), h = height / maximum;
    const left = heights[index - (x > 0 ? 1 : 0)], up = heights[index - (y > 0 ? world.width : 0)];
    const shade = Math.max(-12, Math.min(12, ((left - height) + (up - height)) * .6));
    const rgb = low.map((value, channel) => Math.round(Math.max(0, Math.min(255, value + (high[channel] - value) * h + shade))));
    return Object.freeze({ index, height, color: `rgb(${rgb.join(',')})`,
      eastBoundary: x + 1 < world.width && heights[index + 1] !== height,
      southBoundary: y + 1 < world.height && heights[index + world.width] !== height });
  });
}
export function waterOpacity(water: number): number { return water > 0 ? Math.min(.85, .25 + Math.log2(1 + water) / 20) : 0; }
export interface FlowGlyph { readonly from: number; readonly to: number; readonly amount: number; readonly x: number; readonly y: number; readonly dx: number; readonly dy: number }
/** At most one real transfer per sampled origin. Never infer motion from a height gradient. */
export function flowGlyphs(world: WorldView, flows: readonly FlowTransfer[], enabled: boolean): readonly FlowGlyph[] {
  if (!enabled) return [];
  const stride = Math.max(1, Math.ceil(Math.max(world.width, world.height) / 22));
  const chosen = new Map<number, FlowTransfer>();
  for (const flow of flows) {
    const { from, to, amount } = flow;
    if (!(amount > 0) || from < 0 || to < 0 || from >= world.water.length || to >= world.water.length) continue;
    const fx = from % world.width, fy = Math.floor(from / world.width), tx = to % world.width, ty = Math.floor(to / world.width);
    if (Math.abs(fx - tx) + Math.abs(fy - ty) !== 1 || fx % stride || fy % stride || !(world.water[from] > 0 || world.water[to] > 0)) continue;
    if (amount > (chosen.get(from)?.amount ?? 0)) chosen.set(from, flow);
  }
  return [...chosen.values()].map(flow => {
    const fx = flow.from % world.width, fy = Math.floor(flow.from / world.width), tx = flow.to % world.width, ty = Math.floor(flow.to / world.width);
    return Object.freeze({ ...flow, x: (fx + tx) / 2 + .5, y: (fy + ty) / 2 + .5, dx: tx - fx, dy: ty - fy });
  });
}
export type TownAppearance = 'NORMAL' | 'DELIVERED' | 'SHORTAGE' | 'DANGER' | 'FLOODED';
export function townAppearance(depth: number, threshold: number, progress?: DeepReadonly<TownProgress>): TownAppearance {
  if (depth >= threshold || progress?.firstFloodStep != null) return 'FLOODED';
  if (depth >= threshold * .75) return 'DANGER';
  if (progress?.requiredIntake !== undefined) return progress.currentIntake >= progress.requiredIntake ? 'DELIVERED' : 'SHORTAGE';
  return 'NORMAL';
}
export const TOWN_LABELS: Readonly<Record<TownAppearance, string>> = Object.freeze({ NORMAL: '通常', DELIVERED: '✓ 給水達成', SHORTAGE: '… 給水不足', DANGER: '! 浸水危険', FLOODED: '⚠ 浸水履歴あり' });
export function markerKind(type: TerrainType, protectedCell: boolean): string {
  return type === TerrainType.Source ? 'SOURCE_DROP' : type === TerrainType.Intake ? 'INTAKE_DIAMOND'
    : type === TerrainType.Outlet ? 'OUTLET_GATE' : protectedCell ? 'PROTECTED_HATCH' : 'LAND';
}
export function metricRelevant(goal: GoalDefinition['type'], metric: 'intake' | 'flood'): boolean {
  return goal === 'COMBINED' || (metric === 'intake' ? goal === 'WATER_DELIVERY' : goal === 'FLOOD_PREVENTION');
}
/** Bound both DPR and physical backing size; all input/camera units remain CSS pixels. */
export function canvasSize(width: number, height: number, dpr: number): { width: number; height: number } {
  const ratio = Math.min(2, Math.max(1, Number.isFinite(dpr) ? dpr : 1), 1600 / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export function flowAnimationPhase(milliseconds: number, reduced: boolean, playing: boolean): number {
  return reduced || !playing ? 0 : (milliseconds % 1600) / 1600;
}
