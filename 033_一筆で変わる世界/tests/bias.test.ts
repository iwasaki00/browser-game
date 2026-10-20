import { expect, it } from 'vitest';
import { diagnoseMirroring } from '../src/core/diagnostics';
import { type WorldDefinition } from '../src/core/world';
import { samples } from '../src/samples';

it('ST-17: 偶数・奇数幅、左右・上下反転、標準64×64の偏りを数値化する', () => {
  const results = [];
  for (const width of [4, 5]) {
    const water = new Float64Array(width * width);
    if (width % 2) water[Math.floor(width / 2) * width + Math.floor(width / 2)] = 32;
    else for (const y of [1, 2]) for (const x of [1, 2]) water[y * width + x] = 8;
    const d: WorldDefinition = { width, height: width, heights: new Uint8Array(width * width), water };
    for (const steps of [1, 4, 20]) for (const axis of ['X', 'Y'] as const) results.push({ width, steps, axis, ...diagnoseMirroring(d, steps, axis) });
  }
  const asymmetric: WorldDefinition = { width: 5, height: 5,
    heights: Array.from({ length: 25 }, (_, i) => (i * 7) % 4),
    water: Array.from({ length: 25 }, (_, i) => i === 6 ? 4096 : 0) };
  for (const axis of ['X', 'Y'] as const) results.push({ width: 5, steps: 20, axis, case: 'asymmetric', ...diagnoseMirroring(asymmetric, 20, axis) });
  for (const steps of [1, 20, 600]) for (const axis of ['X', 'Y'] as const) results.push({ width: 64, steps, axis, ...diagnoseMirroring(samples[0].create(), steps, axis) });
  console.info('ST-17 方向偏り診断:', JSON.stringify(results));
  expect(results.every(row => Number.isSafeInteger(row.l1) && row.l1 >= 0 && row.normalizedL1 >= 0)).toBe(true);
  // Known small counterexample is a diagnostic baseline, never a special case in the flow engine.
  const known = diagnoseMirroring({ width: 5, height: 1, heights: [0, 0, 0, 0, 0], water: [0, 0, 8, 0, 0] }, 1, 'X');
  expect(known).toEqual({ l1: 4, maximum: 2, normalizedL1: .5 });
  expect(results.some(row => row.width === 5 && row.l1 > 0)).toBe(true);
}, 20000);
