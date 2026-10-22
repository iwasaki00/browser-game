import { describe, expect, it, vi } from 'vitest';
import { createLabStore, discoveryKey, labUnlock, normalizeConfiguration, productionLabKey } from './lab';
import { recordRunOutcome, prepareLabRetry, resetProgressAndLab } from './lab-integration';
import { createProgressStore, freshProgress, memoryStorage, productionProgressKey } from './progress';
import { stages, type Direction, type Stage } from './stage';
import { stageFingerprint } from './fingerprint';
import { simulate } from './simulation';
import { isSolverSummary } from './scoring';
import { solveStage } from './solver';
import ratings from './generated/stage-ratings.json';
const values: unknown[] = ratings; const reports = values.filter(isSolverSummary);
const ids = stages.map(s => s.id); const normal = { a: ['L', 'R'] as Direction[] };
const allStars = { ...freshProgress(ids), bestStars: Object.fromEntries(ids.map(id => [id, 1])) };
function fixture() {
  const storage = memoryStorage(); const lab = createLabStore(stages, reports, storage);
  const collect = (stage = stages[0], configuration: unknown = normal, result = simulate(stages[0], normal), progress = allStars) => lab.collect({ stageId: stage.id, stageFingerprint: stageFingerprint(stage), configuration, result, progress });
  return { storage, lab, collect };
}
function unlockedProgress(storage = memoryStorage()) {
  const progress = createProgressStore(ids, storage); for (const id of ids) progress.recordResult(id, true, 1); return progress;
}
describe('LAB unlock and canonical configurations', () => {
  it('locks fresh and 19-star progress, and unlocks only all 20 stars including RESCUE stars', () => {
    expect(labUnlock(stages, freshProgress(ids))).toEqual({ unlocked: false, achieved: 0, total: 20 });
    const progress = createProgressStore(ids, memoryStorage()); for (const id of ids.slice(0, 19)) progress.recordResult(id, true, 1);
    expect(labUnlock(stages, progress.data)).toEqual({ unlocked: false, achieved: 19, total: 20 });
    progress.recordResult('20', true, 1); expect(labUnlock(stages, progress.data).unlocked).toBe(true);
    expect(labUnlock(stages, { bestStars: { ...allStars.bestStars, '20': 0 } }).unlocked).toBe(false);
  });
  it('never invents configurations from old stars', () => {
    const f = fixture(); expect(labUnlock(stages, allStars).unlocked).toBe(true); expect(f.lab.view().records).toEqual([]);
    expect(f.storage.getItem(productionLabKey)).toBeNull();
  });
  it('normalizes order and preserves all slots, namespacing the key with stage and fingerprint', () => {
    const stage = stages[4]; const one = normalizeConfiguration(stage, { b: ['L', 'R'], a: ['L', 'R', 'R'] })!;
    const two = normalizeConfiguration(stage, { a: ['L', 'R', 'R'], b: ['L', 'R'] })!;
    expect(one).toEqual(two); expect(Object.keys(one)).toEqual(['a', 'b']); expect(discoveryKey(stage, one)).toBe(discoveryKey(stage, two));
    expect(JSON.parse(discoveryKey(stage, one))).toEqual([stage.id, stageFingerprint(stage), [['a', ['L', 'R', 'R']], ['b', ['L', 'R']]]]);
    expect(discoveryKey({ ...stage, id: '05:extra' }, one)).not.toBe(discoveryKey(stage, one));
  });
  it.each([{}, { a: ['L'] }, { a: ['L', 'X'] }, { a: ['L', 'R'], extra: ['L'] }, { a: 'LR' }, null])('rejects invalid full configuration %j', value => {
    expect(normalizeConfiguration(stages[0], value)).toBeUndefined(); expect(fixture().collect(stages[0], value).status).toBe('INVALID');
  });
});
describe('LAB collection and storage', () => {
  it('collects, reloads and validates a normal clear; duplicate RUN processing writes once', () => {
    const f = fixture(); const set = vi.spyOn(f.storage, 'setItem'); const result = simulate(stages[0], normal); const before = structuredClone(result);
    expect(f.collect().status).toBe('NEW'); for (let i = 0; i < 100; i++) expect(f.collect().status).toBe('ALREADY_COLLECTED');
    expect(set).toHaveBeenCalledTimes(1); expect(result).toEqual(before);
    expect(createLabStore(stages, reports, f.storage).view().records).toEqual(f.lab.view().records);
    expect(f.lab.view().stages[0]).toMatchObject({ count: 1, total: 1, limit: 1, complete: true });
    expect(f.storage.getItem(productionProgressKey)).toBeNull();
  });
  it('keeps progress and LAB on separate keys and protects production from a memory-only fixture', () => {
    const f = fixture(); const progress = unlockedProgress(f.storage); const saved = f.storage.getItem(productionProgressKey);
    f.collect(); expect(f.storage.getItem(productionProgressKey)).toBe(saved);
    const isolated = fixture(); isolated.collect(); expect(f.storage.getItem(productionProgressKey)).toBe(saved); expect(progress.data.bestStars['01']).toBe(1);
  });
  it('rejects locked, failed and rescued outcomes, including an event-only rescue marker', () => {
    const f = fixture(); expect(f.collect(stages[0], normal, simulate(stages[0], normal), freshProgress(ids)).status).toBe('LOCKED');
    expect(f.collect(stages[0], normal, { ...simulate(stages[0], normal), clear: false }).status).toBe('FAILED');
    expect(f.collect(stages[0], normal, { ...simulate(stages[0], normal), rescueUsed: true }).status).toBe('RESCUE_USED');
    const result = simulate(stages[0], normal); result.events[1].rescue = true; expect(f.collect(stages[0], normal, result).status).toBe('RESCUE_USED');
    expect(f.lab.view().records).toEqual([]);
  });
  it('rejects unsuccessful settings, unknown stages and stale fingerprints', () => {
    const f = fixture(); expect(f.collect(stages[0], { a: ['L', 'L'] }).status).toBe('INVALID');
    expect(f.collect({ ...stages[0], id: 'missing' }).status).toBe('INVALID');
    expect(f.lab.collect({ stageId: '01', stageFingerprint: 'old', configuration: normal, result: simulate(stages[0], normal), progress: allStars }).status).toBe('INVALID');
  });
  it('counts unused branch differences as distinct same-cost discoveries', () => {
    const f = fixture(); const stage = stages[7]; const first = { a: ['L', 'R', 'R'] as Direction[], b: ['L', 'L'] as Direction[], c: ['L', 'L'] as Direction[] };
    const second = { c: ['L', 'R'] as Direction[], b: first.b, a: first.a };
    expect(f.collect(stage, first, simulate(stage, first)).status).toBe('NEW'); expect(f.collect(stage, second, simulate(stage, second)).status).toBe('NEW');
    const records = f.lab.view().records; expect(records).toHaveLength(2); expect(records[0].cost).toBe(records[1].cost); expect(records[0].discoveryKey).not.toBe(records[1].discoveryKey);
  });
  it('preserves valid and opaque entries during partial-corruption recovery', () => {
    const f = fixture(); f.collect(); const valid = f.lab.view().records[0]; const old = { ...valid, stageFingerprint: 'old-fingerprint' };
    const badCost = { ...valid, cost: 99 }; const badKey = { ...valid, discoveryKey: 'tampered' };
    f.storage.setItem(productionLabKey, JSON.stringify({ schemaVersion: 1, discoveries: [null, valid, old, badCost, badKey, valid], extra: 'preserve' }));
    const view = f.lab.view(); expect(view.status).toBe('partial'); expect(view.records).toHaveLength(1); expect(view.archived).toBe(1); expect(view.invalid).toBe(3);
    const stage = stages[7]; const patterns = { a: ['L', 'R', 'R'] as Direction[], b: ['L', 'L'] as Direction[], c: ['L', 'L'] as Direction[] };
    expect(f.collect(stage, patterns, simulate(stage, patterns)).status).toBe('NEW');
    const saved = JSON.parse(f.storage.getItem(productionLabKey)!); expect(saved.extra).toBe('preserve'); expect(saved.discoveries).toContainEqual(old); expect(saved.discoveries).toContainEqual(badCost);
  });
  it.each(['{', 'null', '{"schemaVersion":1,"discoveries":"bad"}'])('protects an unreadable top-level payload %s', raw => {
    const f = fixture(); f.storage.setItem(productionLabKey, raw); expect(f.collect().status).toBe('SAVE_FAILED'); expect(f.lab.view().records).toEqual([]);
    expect(f.lab.reset(true).ok).toBe(false); expect(f.storage.getItem(productionLabKey)).toBe(raw);
  });
  it('protects unknown schemas during collection and coordinated reset', () => {
    const f = fixture(); const progress = unlockedProgress(f.storage); const saved = f.storage.getItem(productionProgressKey); const raw = '{"schemaVersion":999,"future":[1,2]}';
    f.storage.setItem(productionLabKey, raw); expect(f.collect().status).toBe('UNKNOWN_SCHEMA'); expect(resetProgressAndLab(progress, f.lab, true).ok).toBe(false);
    expect(f.storage.getItem(productionLabKey)).toBe(raw); expect(f.storage.getItem(productionProgressKey)).toBe(saved);
  });
  it('archives changed fingerprints without counting or applying them', () => {
    const f = fixture(); f.collect(); const record = f.lab.view().records[0]; const changed = structuredClone(stages); changed[0].parcels[0].color = 'BLUE';
    const lab = createLabStore(changed, reports, f.storage); expect(lab.view().records).toEqual([]); expect(lab.view().archived).toBe(1); expect(lab.resolve(record.discoveryKey)).toBeUndefined();
    expect(JSON.parse(f.storage.getItem(productionLabKey)!).discoveries).toContainEqual(record);
  });
  it('rechecks records at retry time after external storage replacement', () => {
    const f = fixture(); const progress = unlockedProgress(); f.collect(); const record = f.lab.view().records[0];
    expect(prepareLabRetry(f.lab, progress, stages, record.discoveryKey)?.configuration).toEqual(normal);
    f.storage.setItem(productionLabKey, '{"schemaVersion":1,"discoveries":[]}'); expect(prepareLabRetry(f.lab, progress, stages, record.discoveryKey)).toBeUndefined();
  });
  it('handles storage access and quota failures without changing CLEAR or progress', () => {
    const progress = unlockedProgress(); const before = progress.data; const result = simulate(stages[0], normal);
    const lab = createLabStore(stages, reports, { getItem: () => null, setItem: () => { throw Error('quota'); } });
    const outcome = recordRunOutcome(progress, lab, stages[0], stageFingerprint(stages[0]), normal, result, 1);
    expect(outcome.discovery.status).toBe('SAVE_FAILED'); expect(result.clear).toBe(true); expect(progress.data).toEqual(before);
    const denied = createLabStore(stages, reports, { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
    expect(denied.view().status).toBe('unavailable');
  });
  it('does not overwrite a schema changed between the read and write', () => {
    let raw: string | null = null; let reads = 0; const unknown = '{"schemaVersion":5}';
    const storage = { getItem() { if (++reads === 3) raw = unknown; return raw; }, setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const lab = createLabStore(stages, reports, storage); const outcome = lab.collect({ stageId: '01', stageFingerprint: stageFingerprint(stages[0]), configuration: normal, result: simulate(stages[0], normal), progress: allStars });
    expect(outcome.status).toBe('UNKNOWN_SCHEMA'); expect(raw).toBe(unknown); expect(storage.setItem).not.toHaveBeenCalled();
  });
});
describe('LAB integration and cap', () => {
  it('registers the unlocking RUN after updating progress, and deduplicates a repeated finalization', () => {
    const f = fixture(); const progress = createProgressStore(ids, f.storage); for (const id of ids.slice(1)) progress.recordResult(id, true, 1);
    const finish = () => recordRunOutcome(progress, f.lab, stages[0], stageFingerprint(stages[0]), normal, simulate(stages[0], normal), 3);
    expect(finish().discovery.status).toBe('NEW'); expect(finish().discovery.status).toBe('ALREADY_COLLECTED'); expect(f.lab.view().records).toHaveLength(1);
  });
  it('includes a rescued unlocking star but never collects its setting', () => {
    const f = fixture(); const progress = createProgressStore(ids, f.storage); for (const id of ids.slice(1)) progress.recordResult(id, true, 1);
    const outcome = recordRunOutcome(progress, f.lab, stages[0], stageFingerprint(stages[0]), normal, { ...simulate(stages[0], normal), rescueUsed: true }, 1);
    expect(labUnlock(stages, progress.data).unlocked).toBe(true); expect(outcome.discovery.status).toBe('RESCUE_USED'); expect(f.lab.view().records).toEqual([]);
  });
  it('cancels reset unchanged, then deletes discoveries and stars while preserving settings', () => {
    const f = fixture(); const progress = unlockedProgress(f.storage); progress.setSettings({ sfx: false, bgm: true, volume: .2, reducedMotion: true }); f.collect();
    const saved = f.storage.getItem(productionLabKey); const before = progress.data;
    expect(resetProgressAndLab(progress, f.lab, false).ok).toBe(false); expect(progress.data).toEqual(before); expect(f.storage.getItem(productionLabKey)).toBe(saved);
    expect(resetProgressAndLab(progress, f.lab, true).ok).toBe(true); expect(progress.data).toEqual(freshProgress(ids, before.settings)); expect(f.lab.view().records).toEqual([]);
  });
  it('does not apply discoveries after LAB relocks or modify counts by preparing retry', () => {
    const f = fixture(); f.collect(); const key = f.lab.view().records[0].discoveryKey; const progress = unlockedProgress();
    expect(prepareLabRetry(f.lab, progress, stages, key)?.configuration).toEqual(normal); expect(f.lab.view().records).toHaveLength(1);
    progress.reset(true); expect(prepareLabRetry(f.lab, progress, stages, key)).toBeUndefined();
  });
  it('distinguishes all successful solutions from a maximum 100 collected settings', async () => {
    const future: Stage = { id: 'future', name: 'Cap fixture', nodes: [
      { id: 'source', kind: 'source', label: 'Source', layout: { x: 0, y: 0 } },
      ...(['a', 'b', 'c'] as const).map((id, i) => ({ id, kind: 'switch' as const, label: id, layout: { x: 0, y: 0 }, initialPattern: Array<Direction>(i ? 2 : 3).fill('L') })),
      { id: 'red', kind: 'exit', label: 'Red', layout: { x: 0, y: 0 }, accepts: 'RED' }],
      edges: [{ from: 'source', to: 'a' }, { from: 'a', to: 'b', direction: 'L' }, { from: 'a', to: 'c', direction: 'R' },
        ...['b', 'c'].flatMap(from => (['L', 'R'] as const).map(direction => ({ from, to: 'red', direction })))], parcels: [{ id: 0, color: 'RED' }] };
    const report = await solveStage(future, { maxStoredSolutions: 128 }); expect(report.solutionCount).toBe(128);
    const lab = createLabStore([future], [report], memoryStorage()); const progress = { bestStars: { future: 1 } };
    for (const [index, solution] of report.solutions.slice(0, 101).entries()) {
      expect(lab.collect({ stageId: future.id, stageFingerprint: stageFingerprint(future), configuration: solution.patterns, result: simulate(future, solution.patterns), progress }).status).toBe(index < 100 ? 'NEW' : 'LIMIT');
    }
    expect(lab.view().stages[0]).toMatchObject({ count: 100, total: 128, limit: 100, complete: false, limitReached: true });
  }, 15000);
});
