import { type Point } from '../../src/core/stroke';

/** Canonical successful input coordinates, in terrain coordinates (cell centers use .5). */
export const challengeSolutions: Readonly<Record<string, readonly Point[]>> = {
  'stage-01': [{ x: 7.5, y: 7 }, { x: 7.5, y: 9 }],
  'stage-02': [{ x: 8.5, y: 6.5 }, { x: 11.5, y: 10.5 }],
  'stage-03': [{ x: 8.5, y: 7 }, { x: 8.5, y: 9 }],
};
