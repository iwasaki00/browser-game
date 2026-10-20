import { describe, expect, it } from 'vitest';
import { simulate } from './simulation';
import { stage01 } from './stage';

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
