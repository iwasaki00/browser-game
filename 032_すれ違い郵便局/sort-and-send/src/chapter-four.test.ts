import { beforeAll, describe, expect, it } from 'vitest';
import { stages } from './stage';
import { validateStage } from './validation';
import { solveStage, type SolverReport } from './solver';
import { simulate } from './simulation';
import { deliveryCost } from './cost';
import ratings from './generated/stage-ratings.json';

const specs = [
  { id: '16', total: 256, count: 3, optimal: 2, distribution: { 4: 2, 6: 1 }, sequence: 'RRBRRYRR', lengths: [3, 3, 2], routes: ['a:red,b', 'b:red,c', 'c:blue,yellow'] },
  { id: '17', total: 1024, count: 3, optimal: 1, distribution: { 4: 1, 6: 2 }, sequence: 'RYRBYRRYB', lengths: [3, 3, 2, 2], routes: ['a:b,c', 'b:red,d', 'c:blue,yellow', 'd:red,blue'] },
  { id: '18', total: 1024, count: 4, optimal: 1, distribution: { 6: 1, 8: 3 }, sequence: 'BYRBYRBYBBY', lengths: [3, 3, 2, 2], routes: ['a:b,c', 'b:red,d', 'c:blue,yellow', 'd:red,blue'] },
  { id: '19', total: 8192, count: 2, optimal: 1, distribution: { 6: 1, 8: 1 }, sequence: 'RBYYRBYRY', lengths: [3, 3, 3, 2, 2], routes: ['a:b,c', 'b:d,red', 'c:d,yellow', 'd:e,blue', 'e:red,yellow'] },
  { id: '20', total: 8192, count: 2, optimal: 1, distribution: { 6: 1, 8: 1 }, sequence: 'YBRBBYBBRBY', lengths: [4, 3, 2, 2, 2], routes: ['a:b,c', 'b:red,d', 'c:d,e', 'd:blue,yellow', 'e:red,yellow'] },
];
const reports = new Map<string, SolverReport>();
beforeAll(async () => {
  for (const stage of stages.slice(15)) reports.set(stage.id, await solveStage(stage));
}, 30000);
describe('Chapter 04', () => {
  for (const spec of specs) {
    const stage = stages.find(s => s.id === spec.id)!;
    it(`Stage ${spec.id} has the specified graph, parcels and all-L slots`, () => {
      expect(validateStage(stage)).toEqual([]);
      expect(stage.parcels.map(p => p.color[0]).join('')).toBe(spec.sequence);
      const branches = stage.nodes.filter(n => n.kind === 'switch');
      expect(branches.map(n => n.initialPattern!.length)).toEqual(spec.lengths);
      expect(branches.every(n => n.initialPattern!.every(d => d === 'L'))).toBe(true);
      expect(stage.edges.find(e => e.from === 'source')?.to).toBe('a');
      expect(branches.map(n => `${n.id}:${stage.edges.find(e => e.from === n.id && e.direction === 'L')!.to},${stage.edges.find(e => e.from === n.id && e.direction === 'R')!.to}`)).toEqual(spec.routes);
    });
    it(`Stage ${spec.id} completes every configuration and preserves deterministic delivery`, () => {
      const report = reports.get(spec.id)!;
      expect(report).toMatchObject({ status: 'VALID', totalConfigurations: String(spec.total), checkedConfigurations: spec.total, solutionCount: spec.count, optimalSolutionCount: spec.optimal, costDistribution: spec.distribution });
      const { solutions, validationErrors, ...summary } = report;
      expect(ratings.find(r => r.stageId === spec.id)).toEqual(summary);
      expect(validationErrors).toEqual([]);
      for (const solution of solutions) {
        const result = simulate(stage, solution.patterns);
        expect(result.clear).toBe(true);
        expect(simulate(stage, solution.patterns)).toEqual(result);
        expect(deliveryCost(solution.patterns, result)).toBe(solution.cost);
        const moves = result.events.filter(e => e.type === 'move');
        expect(new Set(moves.map(e => `${e.parcel}:${e.tick}`)).size).toBe(moves.length);
      }
    });
  }
  it.each([[7, 19], [8, 19], [9, 4], [11, 4]])('Stage 18 prefix %i leaves %i solutions without altering the full stage', async (length, count) => {
    const stage = stages[17];
    const report = await solveStage({ ...stage, parcels: stage.parcels.slice(0, length) });
    expect(report).toMatchObject({ status: 'VALID', checkedConfigurations: 1024, solutionCount: count });
    expect(stage.parcels).toHaveLength(11);
  });
});
