import { describe, expect, it } from 'vitest';
import { simulate } from './simulation';
import { stage01, stages, type Direction, type Stage } from './stage';

const run = () => simulate(stage01, { a: ['L', 'R'] });
describe('STAGE 01 delivery', () => {
  it('[L,R] cycles through L,R,L', () => {
    expect(run().events.filter(e => e.direction).map(e => e.direction)).toEqual(['L', 'R', 'L']);
  });
  it('departs in order, one parcel per tick', () => {
    expect(run().events.filter(e => e.type === 'depart').map(e => [e.parcel, e.tick])).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('[L,R] delivers all three correctly and records paths', () => {
    const result = run();
    expect(result.clear).toBe(true);
    expect(result.correctCount).toBe(3);
    expect(result.parcels.map(p => p.path)).toEqual([['source', 'a', 'red'], ['source', 'a', 'blue'], ['source', 'a', 'red']]);
  });
  it('[L,L] misdelivers BLUE but continues remaining deliveries', () => {
    const result = simulate(stage01, { a: ['L', 'L'] });
    expect(result.clear).toBe(false);
    expect(result.correctCount).toBe(2);
    expect(result.parcels[1]).toMatchObject({ color: 'BLUE', destination: 'red', correct: false });
    expect(result.events.filter(e => e.type === 'deliver')).toHaveLength(3);
  });
  it('is deterministic', () => expect(run()).toEqual(run()));
  it('resets counters for retry after an odd number of dispatches', () => {
    const first = run();
    expect(first.events.filter(e => e.direction).at(-1)?.patternIndex).toBe(0);
    expect(run().events.find(e => e.direction)?.patternIndex).toBe(0);
    expect(run()).toEqual(first);
  });
  it('moves at most one edge per parcel per tick, including departure', () => {
    const moves = run().events.filter(e => e.type === 'move');
    expect(new Set(moves.map(e => `${e.tick}:${e.parcel}`)).size).toBe(moves.length);
    expect(moves.filter(e => e.parcel === 0).map(e => [e.tick, e.from, e.to])).toEqual([[0, 'source', 'a'], [1, 'a', 'red']]);
  });
});

const solutions: Record<string, Direction[]>[] = [
  { a: ['L', 'R'] }, { a: ['L', 'L', 'R'] }, { a: ['L', 'R', 'R'] },
  { a: ['L', 'R', 'R', 'L'] }, { a: ['L', 'R', 'R'], b: ['L', 'R'] },
];
describe('five stage foundation', () => {
  stages.slice(0, 5).forEach((stage, index) => {
    it(`Stage ${index + 1} clears with its expected solution`, () => {
      const result = simulate(stage, solutions[index]);
      expect(result.clear).toBe(true);
      expect(result.correctCount).toBe(stage.parcels.length);
      expect(result.parcels.every(p => p.correct)).toBe(true);
    });
    it(`Stage ${index + 1} initial patterns fail and differ from the solution`, () => {
      const initial = Object.fromEntries(stage.nodes.filter(n => n.kind === 'switch').map(n => [n.id, n.initialPattern!]));
      const result = simulate(stage, initial);
      expect(result.clear).toBe(false);
      expect(result.events.filter(e => e.type === 'deliver')).toHaveLength(stage.parcels.length);
      expect(result).not.toEqual(simulate(stage, solutions[index]));
    });
    it(`Stage ${index + 1} retries deterministically without input mutation`, () => {
      const snapshot = structuredClone({ stage, pattern: solutions[index] });
      const first = simulate(stage, solutions[index]);
      expect(simulate(stage, solutions[index])).toEqual(first);
      expect({ stage, pattern: solutions[index] }).toEqual(snapshot);
      for (const id of Object.keys(solutions[index])) {
        expect(first.events.find(e => e.from === id && e.type === 'move')?.patternIndex).toBe(0);
      }
    });
    it(`Stage ${index + 1} moves once per tick and departs in ID order`, () => {
      const result = simulate(stage, solutions[index]);
      const moves = result.events.filter(e => e.type === 'move');
      expect(new Set(moves.map(e => `${e.tick}:${e.parcel}`)).size).toBe(moves.length);
      expect(result.events.filter(e => e.type === 'depart').map(e => [e.parcel, e.tick])).toEqual(stage.parcels.map((p, i) => [p.id, i]));
      for (const departure of result.events.filter(e => e.type === 'depart')) {
        expect(moves.filter(e => e.parcel === departure.parcel && e.tick === departure.tick)).toHaveLength(1);
      }
    });
  });
  it('Stage 03 contains exactly nine parcels', () => expect(stages[2].parcels).toHaveLength(9));
  it('Stage 05 advances A and B independently; RED bypasses B', () => {
    const result = simulate(stages[4], solutions[4]);
    const a = result.events.filter(e => e.from === 'a' && e.type === 'move');
    const b = result.events.filter(e => e.from === 'b' && e.type === 'move');
    expect(a.map(e => e.patternIndex)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(b.map(e => [e.parcel, e.patternIndex, e.direction])).toEqual([[1, 0, 'L'], [2, 1, 'R'], [4, 0, 'L'], [5, 1, 'R']]);
    expect(result.parcels.filter(p => p.color === 'RED').every(p => !p.path.includes('b'))).toBe(true);
  });
  it('one-slot patterns are supported', () => {
    const stage = structuredClone(stage01);
    stage.nodes.find(n => n.id === 'a')!.initialPattern = ['L'];
    expect(simulate(stage, { a: ['L'] }).events.filter(e => e.direction).map(e => e.patternIndex)).toEqual([0, 0, 0]);
  });
  it('rejects invalid run-time patterns', () => {
    expect(() => simulate(stage01, { a: ['L'] })).toThrow('Invalid pattern');
    expect(() => simulate(stage01, {})).toThrow('Invalid pattern');
  });
  it('processes simultaneous switch arrivals in ascending ID order', () => {
    // ID 0 takes a longer path; ID 1 catches up at B. Input order is reversed.
    const stage: Stage = {
      ...structuredClone(stage01),
      nodes: [
        ...structuredClone(stage01.nodes),
        { id: 'c', kind: 'switch', label: 'C', layout: { x: 0, y: 0 }, initialPattern: ['L'] },
        { id: 'b', kind: 'switch', label: 'B', layout: { x: 0, y: 0 }, initialPattern: ['L', 'L'] },
      ],
      edges: [
        { from: 'source', to: 'a' },
        { from: 'a', to: 'c', direction: 'L' }, { from: 'a', to: 'b', direction: 'R' },
        { from: 'c', to: 'b', direction: 'L' }, { from: 'c', to: 'b', direction: 'R' },
        { from: 'b', to: 'red', direction: 'L' }, { from: 'b', to: 'blue', direction: 'R' },
      ],
      parcels: [{ id: 1, color: 'BLUE' }, { id: 0, color: 'RED' }],
    };
    const result = simulate(stage, { a: ['L', 'R'], b: ['L', 'R'], c: ['L'] });
    expect(result.events.filter(e => e.from === 'b' && e.type === 'move').map(e => [e.tick, e.parcel, e.patternIndex])).toEqual([[3, 0, 0], [3, 1, 1]]);
    expect(result.clear).toBe(true);
  });
});
