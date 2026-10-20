import { describe, expect, it } from 'vitest';
import { solveStage, StageInputError } from './solver';
import { stages, stage01, type Stage } from './stage';
import { simulate } from './simulation';
import { stageFingerprint } from './fingerprint';

const expected = [
  ['4', 2, { a: ['L', 'R'] }], ['8', 2, { a: ['L', 'L', 'R'] }],
  ['8', 2, { a: ['L', 'R', 'R'] }], ['16', 2, { a: ['L', 'R', 'R', 'L'] }],
  ['32', 4, { a: ['L', 'R', 'R'], b: ['L', 'R'] }],
] as const;
function manyBranches(): Stage {
  const stage = structuredClone(stage01);
  for (let i = 0; i < 14; i++) {
    const id = `extra${i}`;
    stage.nodes.push({ id, kind: 'switch', label: id, layout: { x: 0, y: 0 }, initialPattern: ['L', 'L', 'L', 'L'] });
    stage.edges.push({ from: id, to: 'red', direction: 'L' }, { from: id, to: 'blue', direction: 'R' });
  }
  return stage;
}

describe('exhaustive solver', () => {
  stages.slice(0, 5).forEach((stage, i) => {
    it(`Stage ${stage.id}: exhaustive count, unique optimum, costs and reset match design`, async () => {
      const before = structuredClone(stage);
      const report = await solveStage(stage);
      expect(report).toMatchObject({ status: 'VALID', totalConfigurations: expected[i][0],
        checkedConfigurations: Number(expected[i][0]), solutionCount: 1, optimalSolutionCount: 1,
        minCost: expected[i][1], maxCost: expected[i][1], costDistribution: { [expected[i][1]]: 1 },
        solutions: [{ patterns: expected[i][2], cost: expected[i][1] }], validationErrors: [] });
      expect(stage).toEqual(before);
      expect(await solveStage(stage)).toEqual(report);
      for (const solution of report.solutions) {
        expect(simulate(stage, solution.patterns).clear).toBe(true);
      }
    });
  });
  it('keeps full counts and cost distribution after stored-solution cap', async () => {
    const stage = structuredClone(stage01); stage.parcels = [{ id: 0, color: 'RED' }];
    const report = await solveStage(stage, { maxStoredSolutions: 1 });
    expect(report).toMatchObject({ solutionCount: 2, minCost: 0, maxCost: 2, optimalSolutionCount: 1, costDistribution: { 0: 1, 2: 1 } });
    expect(report.solutions).toHaveLength(1);
    expect(report.solutions[0].patterns).toEqual({ a: ['L', 'L'] });
    expect((await solveStage(stage, { maxStoredSolutions: 0 })).solutionCount).toBe(2);
  });
  it('counts all equally optimal settings, including unused branches', async () => {
    const stage = structuredClone(stage01); stage.parcels = [{ id: 0, color: 'RED' }];
    stage.nodes.push({ id: 'b', kind: 'switch', label: 'B', layout: { x: 0, y: 0 }, initialPattern: ['L', 'L'] });
    stage.edges.push({ from: 'b', to: 'red', direction: 'L' }, { from: 'b', to: 'blue', direction: 'R' });
    expect(await solveStage(stage)).toMatchObject({ solutionCount: 8, optimalSolutionCount: 4, costDistribution: { 0: 4, 2: 4 } });
  });
  it('returns INCOMPLETE at cap and never publishes a provisional optimum', async () => {
    expect(await solveStage(stage01, { maxConfigurations: 2 })).toMatchObject({ status: 'INCOMPLETE', checkedConfigurations: 2, solutionCount: 1, minCost: null, maxCost: null, optimalSolutionCount: null });
    expect((await solveStage(stage01, { maxConfigurations: 4 })).status).toBe('VALID');
  });
  it('honors pre-cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    expect(await solveStage(stage01, { signal: controller.signal })).toMatchObject({ status: 'INCOMPLETE', checkedConfigurations: 0, minCost: null });
  });
  it('can be cancelled externally during exploration', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 0);
    try {
      const report = await solveStage(manyBranches(), { signal: controller.signal });
      expect(report.status).toBe('INCOMPLETE');
      expect(report.checkedConfigurations).toBe(64);
      expect(report.minCost).toBeNull();
    } finally { clearTimeout(timer); }
  });
  it('calculates configuration totals beyond the safe integer range exactly', async () => {
    const report = await solveStage(manyBranches(), { maxConfigurations: 0 });
    expect(report.totalConfigurations).toBe((2n ** 58n).toString());
    expect(report.checkedConfigurations).toBe(0);
  });
  it('uses stable branch and edge order', async () => {
    const reordered = structuredClone(stages[4]); reordered.nodes.reverse(); reordered.edges.reverse(); reordered.parcels.reverse();
    expect(await solveStage(reordered)).toEqual(await solveStage(stages[4]));
  });
  it('valid unsolvable input is INVALID', async () => {
    const stage = structuredClone(stage01); stage.nodes[1].initialPattern = ['L'];
    expect(await solveStage(stage)).toMatchObject({ status: 'INVALID', checkedConfigurations: 2, solutionCount: 0, minCost: null, optimalSolutionCount: 0 });
  });
  it('malformed input throws a separate input error', async () => {
    const stage = structuredClone(stage01); stage.edges[0].to = 'missing';
    await expect(solveStage(stage)).rejects.toBeInstanceOf(StageInputError);
  });
  it('rejects unsafe or negative limits', async () => {
    await expect(solveStage(stage01, { maxConfigurations: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow(RangeError);
    await expect(solveStage(stage01, { maxStoredSolutions: -1 })).rejects.toThrow(RangeError);
  });
});

describe('stage fingerprints', () => {
  it('ignores layout, labels and initial arrow values but includes pattern length', () => {
    const stage = structuredClone(stage01);
    stage.nodes.forEach(n => { n.layout = { x: 999, y: -5 }; n.label = 'decoration'; });
    stage.name = 'decoration'; stage.nodes[1].initialPattern = ['R', 'R'];
    expect(stageFingerprint(stage)).toBe(stageFingerprint(stage01));
    stage.nodes[1].initialPattern.push('L');
    expect(stageFingerprint(stage)).not.toBe(stageFingerprint(stage01));
  });
  it('changes for node, edge, parcel and delivery destination edits', () => {
    for (const edit of [
      (s: Stage) => { s.nodes[1].id = 'other'; },
      (s: Stage) => { s.edges[1].to = 'blue'; },
      (s: Stage) => { s.parcels[0].color = 'BLUE'; },
      (s: Stage) => { s.nodes[2].accepts = 'BLUE'; },
    ]) {
      const stage = structuredClone(stage01); edit(stage);
      expect(stageFingerprint(stage)).not.toBe(stageFingerprint(stage01));
    }
  });
});
