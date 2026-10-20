import { expect, it } from 'vitest';
import { patternCost, deliveryCost } from './cost';
import { simulate } from './simulation';
import { stage01, stages, type Direction } from './stage';

it.each([['LLLL', 0], ['LLLR', 2], ['LLRR', 2], ['LRLR', 4], ['LLR', 2], ['LR', 2], ['L', 0]])('cyclic cost %s is %i', (pattern, cost) => {
  expect(patternCost(pattern.split('') as Direction[])).toBe(cost);
});
it('ignores unused switches', () => {
  const patterns = { a: ['L', 'R'] as const, unused: ['L', 'R', 'L', 'R'] as const };
  expect(deliveryCost(patterns, simulate(stage01, patterns))).toBe(2);
});
it('adds the cost of all used switches once', () => {
  const patterns = { a: ['L', 'R', 'R'] as const, b: ['L', 'R'] as const };
  expect(deliveryCost(patterns, simulate(stages[4], patterns))).toBe(4);
});
