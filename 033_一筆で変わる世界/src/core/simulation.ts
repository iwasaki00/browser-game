import { assertConservation, integer, MAX_STEPS, MAX_WATER, totalWater, type WorldState } from './world';

/** One adjacent pair, updated atomically with exactly the same transfer amount. */
export function equalizePair(world: WorldState, a: number, b: number): number {
  const { width, water, heights } = world;
  integer(a, 'ペア位置', water.length - 1); integer(b, 'ペア位置', water.length - 1);
  const adjacent = (Math.floor(a / width) === Math.floor(b / width) && Math.abs(a - b) === 1) || Math.abs(a - b) === width;
  if (!adjacent || a === b) throw new Error('隣接していないセルです');
  const sa = heights[a] * 256 + integer(water[a], '移動前水量', MAX_WATER);
  const sb = heights[b] * 256 + integer(water[b], '移動前水量', MAX_WATER);
  const from = sa > sb ? a : b, to = sa > sb ? b : a;
  const amount = Math.min(water[from], Math.floor(Math.abs(sa - sb) / 2));
  if (!amount) return 0;
  const nextFrom = integer(water[from] - amount, '移動元水量', MAX_WATER);
  const nextTo = integer(water[to] + amount, '移動先水量', MAX_WATER);
  water[from] = nextFrom; water[to] = nextTo;
  return amount;
}
export function updateGroup(world: WorldState, group: number): void {
  integer(group, '更新グループ', 3);
  const horizontal = group < 2, parity = group % 2;
  for (let y = horizontal ? 0 : parity; y < world.height; y += horizontal ? 1 : 2) {
    for (let x = horizontal ? parity : 0; x < world.width; x += horizontal ? 2 : 1) {
      if (horizontal ? x + 1 < world.width : y + 1 < world.height) {
        const a = y * world.width + x;
        equalizePair(world, a, a + (horizontal ? 1 : world.width));
      }
    }
  }
}
/** Failed steps never commit a partially updated world. */
export function stepWorld(world: WorldState): boolean {
  integer(world.step, 'ステップ', MAX_STEPS);
  assertConservation(world);
  if (world.step === MAX_STEPS) return false;
  const next = { ...world, water: world.water.slice() };
  for (let i = 0; i < 4; i++) updateGroup(next, (world.step + i) % 4);
  for (const { index, rate } of next.sources) {
    next.water[index] = integer(next.water[index] + rate, '供給後水量', MAX_WATER);
    next.cumulativeSupply = integer(next.cumulativeSupply + rate, '累積供給量');
  }
  // Validate the intermediate total before sinks can conceal a supply overflow.
  totalWater(next.water);
  for (const [items, key] of [[next.intakes, 'cumulativeIntake'], [next.outlets, 'cumulativeOutlet']] as const) {
    for (const { index, rate } of items) {
      const amount = Math.min(next.water[index], rate);
      next.water[index] = integer(next.water[index] - amount, '除去後水量', MAX_WATER);
      next[key] = integer(next[key] + amount, key);
    }
  }
  assertConservation(next);
  world.water.set(next.water);
  world.cumulativeSupply = next.cumulativeSupply;
  world.cumulativeIntake = next.cumulativeIntake;
  world.cumulativeOutlet = next.cumulativeOutlet;
  world.step++;
  return true;
}
