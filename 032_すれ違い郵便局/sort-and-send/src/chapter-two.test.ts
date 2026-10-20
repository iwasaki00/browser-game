import { beforeAll, describe, expect, it } from 'vitest';
import { stages, type Direction } from './stage';
import { validateStage } from './validation';
import { simulate } from './simulation';
import { solveStage, type SolverReport } from './solver';
import { deliveryCost } from './cost';
import { rateDelivery, verifiedMinimum } from './scoring';
import ratings from './generated/stage-ratings.json';

const specs = [
  { id: '06', total: '64', count: 3, optimal: 1, min: 2, max: 4, distribution: { 2: 1, 4: 2 }, sequence: 'RBRB', lengths: [4, 2] },
  { id: '07', total: '128', count: 2, optimal: 2, min: 4, max: 4, distribution: { 4: 2 }, sequence: 'RBYRBY', lengths: [3, 2, 2] },
  { id: '08', total: '128', count: 8, optimal: 5, min: 2, max: 6, distribution: { 2: 5, 4: 2, 6: 1 }, sequence: 'RBBRB', lengths: [3, 2, 2] },
  { id: '09', total: '256', count: 2, optimal: 1, min: 4, max: 6, distribution: { 4: 1, 6: 1 }, sequence: 'RBRYB', lengths: [4, 2, 2] },
  { id: '10', total: '512', count: 7, optimal: 2, min: 4, max: 8, distribution: { 4: 2, 6: 4, 8: 1 }, sequence: 'BRRRY', lengths: [4, 3, 2] },
];
const reports = new Map<string, SolverReport>();
beforeAll(async () => {
  for (const stage of stages.slice(5)) reports.set(stage.id, await solveStage(stage));
});

describe('Chapter 02 puzzles', () => {
  for (const spec of specs) {
    const stage = stages.find(s => s.id === spec.id)!;
    it(`Stage ${spec.id} has the requested sequence, slots, initial arrows and valid merges`, () => {
      expect(validateStage(stage)).toEqual([]);
      expect(stage.parcels.map(p => p.color[0]).join('')).toBe(spec.sequence);
      const switches = stage.nodes.filter(n => n.kind === 'switch');
      expect(switches.map(n => n.initialPattern!.length)).toEqual(spec.lengths);
      expect(switches.every(n => n.initialPattern!.every(d => d === 'L'))).toBe(true);
      expect(new Set(stage.nodes.filter(n => n.kind === 'exit').map(n => n.accepts)).size).toBe(stage.nodes.filter(n => n.kind === 'exit').length);
    });
    it(`Stage ${spec.id} exhaustive solution counts, costs and saved report match`, () => {
      const report = reports.get(spec.id)!;
      expect(report).toMatchObject({ status: 'VALID', totalConfigurations: spec.total,
        checkedConfigurations: Number(spec.total), solutionCount: spec.count, optimalSolutionCount: spec.optimal,
        minCost: spec.min, maxCost: spec.max, costDistribution: spec.distribution });
      expect(report.solutions).toHaveLength(spec.count);
      const { solutions, validationErrors, ...summary } = report;
      expect(ratings.find(r => r.stageId === spec.id)).toEqual(summary);
      for (const { patterns, cost } of solutions) {
        const first = simulate(stage, patterns);
        expect(first.clear).toBe(true);
        expect(simulate(stage, patterns)).toEqual(first);
        expect(deliveryCost(patterns, first)).toBe(cost);
        for (const id of Object.keys(patterns)) {
          const dispatch = first.events.find(e => e.type === 'move' && e.from === id);
          if (dispatch) expect(dispatch.patternIndex).toBe(0);
        }
      }
    });
    it(`Stage ${spec.id} awards the intended star levels for real successful patterns`, () => {
      const report = reports.get(spec.id)!;
      const stars = report.solutions.map(({ patterns, cost }) => rateDelivery({ stage, result: simulate(stage, patterns), cost, rescueUsed: false, report }).stars);
      expect([...new Set(stars)].sort()).toEqual(spec.id === '07' ? [3] : [2, 3]);
      expect(stars.filter(s => s === 3)).toHaveLength(spec.optimal);
      expect(verifiedMinimum(stage, { ...report, stageFingerprint: 'stale' })).toBeNull();
    });
  }
  it('Stage 06 delivers red parcels through both direct and indirect routes', () => {
    const result = simulate(stages[5], { a: ['L', 'R', 'R', 'R'], b: ['R', 'L'] });
    expect(result.clear).toBe(true);
    expect(result.parcels[0].path).toEqual(['source', 'a', 'red']);
    expect(result.parcels[2].path).toEqual(['source', 'a', 'b', 'red']);
  });
  it('same-tick deliveries to the same exit retain independent success or failure', () => {
    const result = simulate(stages[5], { a: ['R', 'L', 'L', 'L'], b: ['L', 'L'] });
    const arrivals = result.events.filter(e => e.type === 'deliver' && e.tick === 2 && e.to === 'red');
    expect(arrivals.map(e => [e.parcel, e.correct])).toEqual([[0, true], [1, false]]);
    expect(result.events.filter(e => e.type === 'deliver')).toHaveLength(4);
    expect(result.parcels.every(p => p.destination)).toBe(true);
  });
  it('Stage 08 merges direct B and indirect C routes at the same BLUE exit', () => {
    const result = simulate(stages[7], { a: ['L', 'R', 'R'], b: ['L', 'R'], c: ['R', 'R'] });
    expect(result.clear).toBe(true);
    expect(result.parcels.filter(p => p.color === 'BLUE').map(p => p.path)).toEqual([
      ['source', 'a', 'b', 'blue'], ['source', 'a', 'b', 'c', 'blue'], ['source', 'a', 'b', 'blue'],
    ]);
  });
  it('accepts B.R and C.R sharing a single BLUE exit', () => {
    const stage = structuredClone(stages[6]);
    stage.edges.find(e => e.from === 'c' && e.direction === 'R')!.to = 'blue';
    stage.parcels = [{ id: 0, color: 'BLUE' }, { id: 1, color: 'BLUE' }];
    expect(validateStage(stage)).toEqual([]);
    const result = simulate(stage, { a: ['L', 'R', 'L'], b: ['R', 'R'], c: ['R', 'R'] });
    expect(result.clear).toBe(true);
    expect(result.parcels.map(p => p.path)).toEqual([['source', 'a', 'b', 'blue'], ['source', 'a', 'c', 'blue']]);
  });
  it('Stage 08 never dispatches through unused C and ignores its nonzero pattern cost', () => {
    const stage = stages[7];
    const patterns: Record<string, Direction[]> = { a: ['L', 'R', 'R'], b: ['L', 'L'], c: ['L', 'R'] };
    const snapshot = structuredClone(patterns);
    const first = simulate(stage, patterns);
    expect(first.clear).toBe(true);
    expect(first.events.filter(e => e.from === 'c')).toEqual([]);
    expect(deliveryCost(patterns, first)).toBe(2);
    expect(patterns).toEqual(snapshot);
    expect(simulate(stage, patterns)).toEqual(first);
    const used = simulate(stage, { ...patterns, b: ['R', 'R'], c: ['R', 'R'] });
    expect(used.events.find(e => e.from === 'c')?.patternIndex).toBe(0);
  });
  it('re-exploration preserves deterministic settings and distribution', async () => {
    expect(await solveStage(stages[9])).toEqual(reports.get('10'));
  });
});
