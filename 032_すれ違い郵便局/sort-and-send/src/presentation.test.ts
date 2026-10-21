import { expect, it } from 'vitest';
import { stages } from './stage';
import { simulate } from './simulation';
import { movementProgress, recentArrivals, reducedMotion } from './presentation';
it('honors both user and OS motion preferences', () => {
  expect(reducedMotion(false, false)).toBe(false);
  expect(reducedMotion(true, false)).toBe(true);
  expect(reducedMotion(false, true)).toBe(true);
});
it('reduces movement to stable positions and clamps presentation progress', () => {
  expect(movementProgress(.5, false)).toBe(.5);
  expect(movementProgress(.5, true)).toBe(0);
  expect(movementProgress(1, true)).toBe(1);
  expect(movementProgress(-1, false)).toBe(0);
  expect(movementProgress(2, false)).toBe(1);
});
it('feedback starts at delivery end and all presentation settings leave delivery unchanged', () => {
  const result = simulate(stages[0], { a: ['L', 'L'] }); const before = structuredClone(result);
  expect(recentArrivals(result, 1.99)).toEqual([]);
  expect(recentArrivals(result, 2)).toHaveLength(1);
  expect(recentArrivals(result, 2.7)).toEqual([]);
  for (const reduced of [true, false]) for (let elapsed = 0; elapsed < result.ticks + 1; elapsed += .1) {
    recentArrivals(result, elapsed); movementProgress(elapsed % 1, reduced);
  }
  expect(result).toEqual(before);
  expect(simulate(stages[0], { a: ['L', 'L'] })).toEqual(before);
});
