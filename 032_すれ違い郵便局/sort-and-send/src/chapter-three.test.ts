import { beforeAll, describe, expect, it } from 'vitest';
import { stages } from './stage';
import { validateStage } from './validation';
import { solveStage, type SolverReport } from './solver';
import { simulate } from './simulation';
import { deliveryCost } from './cost';
import { rateDelivery } from './scoring';
import ratings from './generated/stage-ratings.json';

const specs = [
  { id: '11', total: '512', count: 6, optimal: 1, min: 4, max: 8, distribution: { 4: 1, 6: 4, 8: 1 }, sequence: 'RBRRRYR', lengths: [4, 3, 2], routes: ['a:red,b', 'b:red,c', 'c:blue,yellow'] },
  { id: '12', total: '1024', count: 7, optimal: 4, min: 4, max: 8, distribution: { 4: 4, 6: 2, 8: 1 }, sequence: 'BRBYRBB', lengths: [3, 2, 3, 2], routes: ['a:b,c', 'b:red,d', 'c:blue,yellow', 'd:blue,yellow'] },
  { id: '13', total: '1024', count: 7, optimal: 1, min: 4, max: 8, distribution: { 4: 1, 6: 5, 8: 1 }, sequence: 'RYBRYYR', lengths: [3, 3, 2, 2], routes: ['a:red,b', 'b:c,yellow', 'c:red,d', 'd:blue,yellow'] },
  { id: '14', total: '2048', count: 6, optimal: 2, min: 4, max: 8, distribution: { 4: 2, 6: 3, 8: 1 }, sequence: 'BRRYBRR', lengths: [4, 3, 2, 2], routes: ['a:b,c', 'b:red,blue', 'c:blue,d', 'd:red,yellow'] },
  { id: '15', total: '4096', count: 7, optimal: 1, min: 6, max: 10, distribution: { 6: 1, 8: 2, 10: 4 }, sequence: 'BRYRYYR', lengths: [3, 3, 2, 2, 2], routes: ['a:b,c', 'b:red,d', 'c:d,yellow', 'd:red,e', 'e:blue,yellow'] },
];
const reports = new Map<string, SolverReport>();
beforeAll(async () => {
  for (const stage of stages.slice(10, 15)) reports.set(stage.id, await solveStage(stage));
});

describe('Chapter 03', () => {
  for (const spec of specs) {
    const stage = stages.find(s => s.id === spec.id)!;
    it(`Stage ${spec.id} matches the requested finite graph, sequence and slot lengths`, () => {
      expect(validateStage(stage)).toEqual([]);
      expect(stage.parcels.map(p => p.color[0]).join('')).toBe(spec.sequence);
      const switches = stage.nodes.filter(n => n.kind === 'switch');
      expect(switches.map(n => n.initialPattern!.length)).toEqual(spec.lengths);
      expect(switches.every(n => n.initialPattern!.every(d => d === 'L'))).toBe(true);
      expect(stage.edges.find(e => e.from === 'source')?.to).toBe('a');
      expect(switches.map(n => `${n.id}:${stage.edges.find(e => e.from === n.id && e.direction === 'L')!.to},${stage.edges.find(e => e.from === n.id && e.direction === 'R')!.to}`)).toEqual(spec.routes);
    });
    it(`Stage ${spec.id} full exploration matches all expected counts and saved fingerprint`, () => {
      const report = reports.get(spec.id)!;
      expect(report).toMatchObject({ status: 'VALID', totalConfigurations: spec.total,
        checkedConfigurations: Number(spec.total), solutionCount: spec.count, optimalSolutionCount: spec.optimal,
        minCost: spec.min, maxCost: spec.max, costDistribution: spec.distribution });
      const { solutions, validationErrors, ...summary } = report;
      expect(validationErrors).toEqual([]);
      expect(solutions).toHaveLength(spec.count);
      expect(ratings.find(r => r.stageId === spec.id)).toEqual(summary);
      expect(Object.values(report.costDistribution).reduce((sum, n) => sum + n, 0)).toBe(spec.count);
    });
    it(`Stage ${spec.id} solutions reset independent counters and retain deterministic events`, () => {
      const report = reports.get(spec.id)!;
      for (const { patterns, cost } of report.solutions) {
        const first = simulate(stage, patterns);
        expect(first.clear).toBe(true);
        expect(simulate(stage, patterns)).toEqual(first);
        expect(deliveryCost(patterns, first)).toBe(cost);
        for (const [id, pattern] of Object.entries(patterns)) {
          expect(first.events.filter(e => e.type === 'move' && e.from === id).map(e => e.patternIndex))
            .toEqual(first.events.filter(e => e.type === 'move' && e.from === id).map((_, i) => i % pattern.length));
        }
        const moves = first.events.filter(e => e.type === 'move');
        expect(new Set(moves.map(e => `${e.parcel}:${e.tick}`)).size).toBe(moves.length);
        expect(rateDelivery({ stage, result: first, cost, rescueUsed: false, report }).stars).toBe(cost === spec.min ? 3 : 2);
      }
    });
  }
  it('new puzzles total exactly 8,704 configurations', () => {
    expect([...reports.values()].reduce((sum, r) => sum + BigInt(r.totalConfigurations), 0n)).toBe(8704n);
  });
  it('Stage 13 uses its official title', () => expect(stages[12].name).toBe('STAGE 13「周期の連鎖」'));
  it('Stage 15 permits both B and C to feed D with ID-ordered dispatch', () => {
    const stage = stages[14];
    const report = reports.get('15')!;
    const result = report.solutions.map(s => simulate(stage, s.patterns)).find(r =>
      r.events.some(e => e.from === 'b' && e.to === 'd') && r.events.some(e => e.from === 'c' && e.to === 'd'))!;
    expect(result).toBeDefined();
    const moves = result.events.filter(e => e.type === 'move' && e.from === 'd');
    for (const tick of new Set(moves.map(e => e.tick))) {
      const ids = moves.filter(e => e.tick === tick).map(e => e.parcel);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    }
  });
  it('unused branches contribute zero without changing their settings', () => {
    const stage = stages[14];
    const patterns = Object.fromEntries(stage.nodes.filter(n => n.kind === 'switch').map(n => [n.id, [...n.initialPattern!]]));
    patterns.e = ['L', 'R'];
    const result = simulate(stage, patterns);
    expect(result.events.filter(e => e.from === 'e')).toEqual([]);
    expect(deliveryCost(patterns, result)).toBe(0);
    expect(patterns.e).toEqual(['L', 'R']);
  });
  it('repeated exploration has identical settings, counts and fingerprints', async () => {
    expect(await solveStage(stages[14])).toEqual(reports.get('15'));
  });
});
