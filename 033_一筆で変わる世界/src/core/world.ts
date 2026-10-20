export const MAX_STEPS = 600;
export const MAX_WATER = Number.MAX_SAFE_INTEGER - 255 * 256;
export enum TerrainType { Normal, Source, Intake, Outlet }
export interface Endpoint { index: number; rate: number }
export interface WorldDefinition {
  width: number; height: number;
  heights: ArrayLike<number>; water?: ArrayLike<number>;
  protected?: ArrayLike<number>;
  sources?: readonly Endpoint[]; intakes?: readonly Endpoint[]; outlets?: readonly Endpoint[];
}
export interface WorldState {
  width: number; height: number;
  heights: Uint8Array; water: Float64Array; terrainType: Uint8Array; protected: Uint8Array;
  sources: Endpoint[]; intakes: Endpoint[]; outlets: Endpoint[];
  step: number; initialWater: number; cumulativeSupply: number;
  cumulativeIntake: number; cumulativeOutlet: number;
}
export function integer(value: number, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label}: 安全な整数範囲外 (${value})`);
  return value;
}
export function totalWater(water: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < water.length; i++) total = integer(total + integer(water[i], `water[${i}]`, MAX_WATER), '総水量');
  return total;
}
export function createWorld(def: WorldDefinition): WorldState {
  integer(def.width, '幅', 4096); integer(def.height, '高さ', 4096);
  if (!def.width || !def.height) throw new Error('盤面サイズは1以上が必要です');
  const size = def.width * def.height;
  for (const values of [def.heights, def.water, def.protected]) {
    if (values && values.length !== size) throw new Error('配列長が盤面サイズと一致しません');
  }
  const heights = new Uint8Array(size), water = new Float64Array(size), protectedCells = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    heights[i] = integer(def.heights[i], `height[${i}]`, 255);
    water[i] = integer(def.water?.[i] ?? 0, `water[${i}]`, MAX_WATER);
    protectedCells[i] = integer(def.protected?.[i] ?? 0, `protected[${i}]`, 1);
  }
  const terrainType = new Uint8Array(size);
  const endpoints = (items: readonly Endpoint[] = [], type: TerrainType) => items.map(item => {
    integer(item.index, '施設位置', size - 1);
    if (terrainType[item.index] !== TerrainType.Normal) throw new Error('水源・取水・排出口が重複しています');
    if (!(type === TerrainType.Outlet && item.rate === Infinity)) integer(item.rate, '供給・除去上限', MAX_WATER);
    terrainType[item.index] = type;
    return { ...item };
  });
  return {
    width: def.width, height: def.height, heights, water, protected: protectedCells, terrainType,
    sources: endpoints(def.sources, TerrainType.Source), intakes: endpoints(def.intakes, TerrainType.Intake),
    outlets: endpoints(def.outlets, TerrainType.Outlet), step: 0, initialWater: totalWater(water),
    cumulativeSupply: 0, cumulativeIntake: 0, cumulativeOutlet: 0,
  };
}
export function expectedWater(world: WorldState): number {
  return integer(integer(world.initialWater + world.cumulativeSupply, '初期量＋累積供給量')
    - world.cumulativeIntake - world.cumulativeOutlet, '期待水量');
}
export function assertConservation(world: WorldState): number {
  const total = totalWater(world.water);
  if (total !== expectedWater(world)) throw new Error(`水量保存違反: 実際 ${total} / 期待 ${expectedWater(world)}`);
  return total;
}
