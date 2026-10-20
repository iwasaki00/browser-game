import { type Point } from '../../src/core/stroke';

/** Canonical successful input coordinates, in terrain coordinates (cell centers use .5). */
export const challengeSolutions: Readonly<Record<string, readonly Point[]>> = {
  'stage-01': [{ x: 7.5, y: 7 }, { x: 7.5, y: 9 }],
  'stage-02': [{ x: 8.5, y: 6.5 }, { x: 11.5, y: 10.5 }],
  'stage-03': [{ x: 8.5, y: 7 }, { x: 8.5, y: 9 }],
  'stage-04': [{ x: 9.5, y: 10 }, { x: 9.5, y: 12 }],
  'stage-05': [{ x: 10.5, y: 6.5 }, { x: 10.5, y: 13.5 }],
  'stage-06': [{ x: 12.5, y: 10 }, { x: 12.5, y: 12 }],
};
