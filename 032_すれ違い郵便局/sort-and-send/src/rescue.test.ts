import { describe, expect, it } from 'vitest';
import { DeliveryRun, simulate } from './simulation';
import { stage01, stages, type Stage } from './stage';
import { rateDelivery, isSolverSummary } from './scoring';
import ratings from './generated/stage-ratings.json';
import { deliveryCost } from './cost';
import { createProgressStore, memoryStorage } from './progress';
import { parcelHistory } from './history';
import { solveStage } from './solver';

const initial = { a: ['L', 'L'] as const };
function blueRescue(direction: 'L' | 'R' = 'R') {
  const run = new DeliveryRun(stage01, initial); run.step(); run.step();
  const preview = run.previewRescue()!; expect(run.confirmRescue(preview, direction)).toBe(true);
  return run;
}
describe('RESCUE state and delivery', () => {
  it('ordinary tick execution matches the original explicit Stage 01 event order and results', () => {
    const run = new DeliveryRun(stage01, { a: ['L', 'R'] });
    const result = run.finish();
    expect(result).toEqual(simulate(stage01, { a: ['L', 'R'] }));
    expect(result.events.map(e => `${e.tick}:${e.parcel}:${e.type}:${e.to}`)).toEqual([
      '0:0:depart:source', '0:0:move:a', '1:0:move:red', '1:0:deliver:red', '1:1:depart:source', '1:1:move:a',
      '2:1:move:blue', '2:1:deliver:blue', '2:2:depart:source', '2:2:move:a', '3:2:move:red', '3:2:deliver:red',
    ]);
    expect(result).not.toHaveProperty('rescueUsed');
  });
  it('preview scans a complete detached state without advancing live ticks, positions, counters or history', () => {
    const run = new DeliveryRun(stage01, initial); const before = run.snapshot;
    expect(run.previewRescue()).toEqual({ tick: 1, parcelId: 0, switchId: 'a', direction: 'L', patternIndex: 0 });
    expect(run.snapshot).toEqual(before);
    const copy = run.clone(); const snapshot = copy.snapshot; snapshot.parcels[0].path.push('tampered'); snapshot.counters.a = 99;
    copy.step(); copy.confirmRescue(copy.previewRescue()!, 'R'); copy.finish();
    expect(run.snapshot).toEqual(before);
  });
  it('cancel consumes nothing, changes no delivery state, rejects its old preview and resumes ordinary delivery', () => {
    const run = new DeliveryRun(stage01, initial); run.step(); const before = run.snapshot;
    const preview = run.previewRescue()!; run.cancelRescue(preview);
    expect(run.snapshot).toEqual(before); expect(run.confirmRescue(preview, 'R')).toBe(false);
    expect(run.rescueUsed).toBe(false); expect(run.previewRescue()).toEqual(preview);
    expect(run.finish()).toEqual(simulate(stage01, initial));
  });
  it('confirm consumes once, changes only the target and advances the counter normally', () => {
    const run = blueRescue(); expect(run.rescueUsed).toBe(true);
    expect(run.snapshot.rescue.pending).toEqual({ tick: 2, parcelId: 1, switchId: 'a', direction: 'R' });
    expect(run.previewRescue()).toBeUndefined();
    run.step(); expect(run.snapshot.counters.a).toBe(0); expect(run.snapshot.rescue.pending).toBeUndefined();
    const result = run.finish(); expect(result.clear).toBe(true); expect(result.rescueUsed).toBe(true);
    expect(result.events.filter(e => e.rescue)).toEqual([{ tick: 2, parcel: 1, type: 'move', from: 'a', to: 'blue', direction: 'R', patternIndex: 1, rescue: true, originalDirection: 'L' }]);
    const ordinary = simulate(stage01, initial).events.filter(e => e.type === 'move');
    expect(result.events.filter(e => e.type === 'move' && !e.rescue)).toEqual(ordinary.filter(e => !(e.tick === 2 && e.parcel === 1)));
    expect(initial.a).toEqual(['L', 'L']);
  });
  it('confirming the normal direction still consumes RESCUE and marks its event', () => {
    const run = blueRescue('L'); const result = run.finish();
    expect(result.clear).toBe(false); expect(result.rescueUsed).toBe(true);
    expect(result.events.find(e => e.rescue)).toMatchObject({ originalDirection: 'L', direction: 'L' });
  });
  it('cannot apply a stale preview after state advancement or to a new stage/run', () => {
    const run = new DeliveryRun(stage01, initial); const preview = run.previewRescue()!; run.step();
    expect(run.confirmRescue(preview, 'R')).toBe(false); expect(run.rescueUsed).toBe(false);
    expect(new DeliveryRun(stage01, initial).confirmRescue(preview, 'R')).toBe(false);
    const other = new DeliveryRun(stages[1], { a: ['L', 'L', 'L'] });
    expect(other.confirmRescue(preview, 'R')).toBe(false); expect(other.snapshot.rescue.pending).toBeUndefined();
  });
  it('rejects forged, mutated and nonexistent target IDs without consuming a use', () => {
    const run = new DeliveryRun(stage01, initial); const preview = run.previewRescue()!;
    expect(run.confirmRescue({ ...preview, parcelId: 99 }, 'R')).toBe(false);
    preview.switchId = 'missing'; expect(run.confirmRescue(preview, 'R')).toBe(false);
    expect(run.rescueUsed).toBe(false); expect(run.snapshot.rescue.pending).toBeUndefined();
    run.finish(); expect(run.previewRescue()).toBeUndefined(); expect(run.confirmRescue(preview, 'L')).toBe(false);
  });
  it('rejects an invalid direction and a second confirmation', () => {
    const run = new DeliveryRun(stage01, initial); const preview = run.previewRescue()!;
    expect(run.confirmRescue(preview, 'X' as 'L')).toBe(false);
    expect(run.confirmRescue(preview, 'L')).toBe(true); expect(run.confirmRescue(preview, 'R')).toBe(false);
  });
  it('returns no target when only exit arrival remains', () => {
    const stage: Stage = { ...structuredClone(stage01), nodes: stage01.nodes.filter(n => n.kind !== 'switch'),
      edges: [{ from: 'source', to: 'red' }], parcels: [{ id: 0, color: 'RED' }] };
    const run = new DeliveryRun(stage, {}); expect(run.previewRescue()).toBeUndefined(); expect(run.tick).toBe(0);
    expect(run.finish().clear).toBe(true);
  });
  it('retry creates fresh counters, rights and history while keeping patterns', () => {
    const previous = blueRescue(); previous.finish(); const retry = new DeliveryRun(stage01, initial);
    expect(retry.snapshot).toMatchObject({ tick: 0, counters: { a: 0 }, events: [], rescue: { used: false } });
    expect(retry.snapshot.rescue.pending).toBeUndefined(); expect(retry.previewRescue()).toBeDefined();
    expect(retry.finish()).toEqual(simulate(stage01, initial)); expect(initial.a).toEqual(['L', 'L']);
  });
  it('same initial state and RESCUE operations produce identical results and history', () => {
    expect(blueRescue().finish()).toEqual(blueRescue().finish());
    const history = parcelHistory(stage01, blueRescue().finish(), 1);
    expect(history).toMatchObject({ rescueUsed: true, path: ['source', 'a', 'blue'], switches: [{ tick: 2, id: 'a', direction: 'R', originalDirection: 'L', rescue: true }] });
  });
  it('orders multiple switch events in a tick and targets only the first by parcel ID', () => {
    const stage: Stage = { ...structuredClone(stage01), nodes: [...structuredClone(stage01.nodes),
      { id: 'c', kind: 'switch', label: 'C', layout: { x: 0, y: 0 }, initialPattern: ['L'] },
      { id: 'b', kind: 'switch', label: 'B', layout: { x: 0, y: 0 }, initialPattern: ['L', 'L'] }],
      edges: [{ from: 'source', to: 'a' }, { from: 'a', to: 'c', direction: 'L' }, { from: 'a', to: 'b', direction: 'R' },
        { from: 'c', to: 'b', direction: 'L' }, { from: 'c', to: 'b', direction: 'R' },
        { from: 'b', to: 'red', direction: 'L' }, { from: 'b', to: 'blue', direction: 'R' }],
      parcels: [{ id: 1, color: 'BLUE' }, { id: 0, color: 'RED' }] };
    const run = new DeliveryRun(stage, { a: ['L', 'R'], b: ['L', 'R'], c: ['L'] });
    run.step(); run.step();
    const earlier = run.previewRescue()!; expect(earlier).toMatchObject({ tick: 2, parcelId: 0, switchId: 'c' });
    run.step(); const preview = run.previewRescue()!;
    expect(preview).toMatchObject({ tick: 3, parcelId: 0, switchId: 'b', patternIndex: 0 });
    expect(run.confirmRescue(preview, 'R')).toBe(true);
    const result = run.finish();
    expect(result.events.filter(e => e.from === 'b')).toEqual([
      { tick: 3, parcel: 0, type: 'move', from: 'b', to: 'blue', direction: 'R', patternIndex: 0, rescue: true, originalDirection: 'L' },
      { tick: 3, parcel: 1, type: 'move', from: 'b', to: 'blue', direction: 'R', patternIndex: 1 },
    ]);
    expect(run.snapshot.counters.b).toBe(0);
  });
});
describe('RESCUE scoring and saved progress', () => {
  const summaries: unknown[] = ratings;
  const report = summaries.filter(isSolverSummary).find(r => r.stageId === '01');
  it('awards star one below the ordinary optimum and unlocks the successor', () => {
    const result = blueRescue().finish(); const cost = deliveryCost(initial, result); expect(cost).toBe(0);
    const rating = rateDelivery({ stage: stage01, result, cost, rescueUsed: !!result.rescueUsed, report });
    expect(rating).toMatchObject({ status: 'RATED', stars: 1 });
    const store = createProgressStore(['01', '02'], memoryStorage()); store.recordResult('01', result.clear, rating.stars);
    expect(store.isUnlocked('02')).toBe(true); expect(store.data.bestStars['01']).toBe(1);
    expect(rateDelivery({ stage: stage01, result, cost, rescueUsed: false, report }).stars).toBeNull();
  });
  it('keeps an existing highest three after a rescued star-one clear', () => {
    const store = createProgressStore(['01', '02'], memoryStorage()); store.recordResult('01', true, 3);
    const result = blueRescue().finish(); const rating = rateDelivery({ stage: stage01, result, cost: 0, rescueUsed: true, report });
    expect(store.recordResult('01', result.clear, rating.stars)).toBe(false); expect(store.data.bestStars['01']).toBe(3);
  });
  it('awards zero after a failed RESCUE run', () => {
    const result = blueRescue('L').finish(); expect(rateDelivery({ stage: stage01, result, cost: 0, rescueUsed: true, report }).stars).toBe(0);
  });
  it('does not include a rescued success in the ordinary Solver solutions', async () => {
    const ordinary = await solveStage(stage01);
    expect(ordinary.solutionCount).toBe(1);
    expect(ordinary.solutions).toEqual([{ patterns: { a: ['L', 'R'] }, cost: 2 }]);
    expect(ordinary.costDistribution).toEqual({ 2: 1 });
    expect(blueRescue().finish().clear).toBe(true);
    expect(ordinary.solutions.some(s => JSON.stringify(s.patterns) === JSON.stringify(initial))).toBe(false);
  });
});
