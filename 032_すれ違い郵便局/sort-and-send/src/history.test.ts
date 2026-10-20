import { expect, it } from 'vitest';
import { parcelHistory } from './history';
import { stage01, stages } from './stage';
import { simulate } from './simulation';
import { solveStage } from './solver';

it('reads a correctly delivered parcel and the exact event direction', () => {
  const history = parcelHistory(stage01, simulate(stage01, { a: ['L', 'R'] }), 1);
  expect(history).toMatchObject({ id: 1, color: 'BLUE', correct: true, expectedExits: ['blue'], destination: 'blue',
    path: ['source', 'a', 'blue'], switches: [{ id: 'a', direction: 'R', patternIndex: 1, tick: 2 }] });
});
it('keeps the expected exit separate from a misdelivered destination', () => {
  expect(parcelHistory(stage01, simulate(stage01, { a: ['L', 'L'] }), 1)).toMatchObject({
    expectedExits: ['blue'], destination: 'red', correct: false, switches: [{ id: 'a', direction: 'L' }],
  });
});
it('reads merged five-switch routes in actual traversal order without mutating results', async () => {
  const stage = stages[14];
  const report = await solveStage(stage);
  const result = simulate(stage, report.solutions.find(s => s.cost === report.minCost)!.patterns);
  const before = structuredClone(result);
  for (const parcel of result.parcels) {
    const history = parcelHistory(stage, result, parcel.id);
    expect(history.switches.map(s => s.id)).toEqual(parcel.path.filter(id => stage.nodes.find(n => n.id === id)!.kind === 'switch'));
    expect(history.expectedExits).toContain(history.destination);
  }
  expect(result).toEqual(before);
});
it('rejects an unknown parcel ID', () => expect(() => parcelHistory(stage01, simulate(stage01, { a: ['L', 'R'] }), 99)).toThrow('荷物が見つかりません'));
