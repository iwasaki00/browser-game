import { expect, it } from 'vitest';
import { routePosition } from './route';
import { stages } from './stage';
import { stageFingerprint } from './fingerprint';
import { simulate } from './simulation';

it('interpolates a bent edge by distance and clamps its endpoints', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }];
  expect(routePosition(points, 0)).toMatchObject({ x: 0, y: 0 });
  expect(routePosition(points, .5)).toMatchObject({ x: 100, y: 100 });
  expect(routePosition(points, 1)).toMatchObject({ x: 100, y: 300 });
  expect(routePosition(points, -1)).toMatchObject({ x: 0, y: 0 });
});
it('display bends have no effect on fingerprints or simulation', () => {
  const stage = structuredClone(stages[11]);
  const patterns = Object.fromEntries(stage.nodes.filter(n => n.kind === 'switch').map(n => [n.id, n.initialPattern!]));
  stage.edges.forEach(e => { e.via = [{ x: -900, y: 900 }]; });
  expect(stageFingerprint(stage)).toBe(stageFingerprint(stages[11]));
  expect(simulate(stage, patterns)).toEqual(simulate(stages[11], patterns));
});
