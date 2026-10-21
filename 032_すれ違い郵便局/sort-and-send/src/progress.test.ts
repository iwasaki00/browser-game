import { describe, expect, it, vi } from 'vitest';
import { createProgressStore, freshProgress, memoryStorage, productionProgressKey } from './progress';
const ids = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
describe('progress persistence', () => {
  it('starts with only Stage 01 unlocked and never invents old clears', () => {
    const store = createProgressStore(ids, memoryStorage());
    expect(store.data).toEqual(freshProgress(ids));
    expect(store.isUnlocked('02')).toBe(false);
  });
  it('unlocks only the successor on clear, preserves best stars and restores after reload', () => {
    const storage = memoryStorage(); const store = createProgressStore(ids, storage);
    expect(store.recordResult('01', false, 0)).toBe(false);
    expect(store.isUnlocked('02')).toBe(false);
    expect(store.recordResult('01', true, 2)).toBe(true);
    expect(store.recordResult('01', true, 3)).toBe(true);
    expect(store.recordResult('01', true, 2)).toBe(false);
    expect(store.data.bestStars['01']).toBe(3);
    expect(store.isUnlocked('02')).toBe(true);
    expect(store.isUnlocked('03')).toBe(false);
    expect(createProgressStore(ids, storage).data).toEqual(store.data);
  });
  it('clears all 20 sequentially with no successor beyond Stage 20', () => {
    const store = createProgressStore(ids, memoryStorage());
    for (const id of ids) { expect(store.isUnlocked(id)).toBe(true); store.recordResult(id, true, 3); }
    expect(store.data.unlockedStageIds).toEqual(ids);
    expect(store.data.clearedStageIds).toEqual(ids);
  });
  it('saves pending clear without fabricating stars', () => {
    const store = createProgressStore(ids, memoryStorage()); store.recordResult('01', true, null);
    expect(store.isUnlocked('02')).toBe(true); expect(store.data.bestStars).toEqual({});
  });
  it('deduplicates unchanged clear and settings writes', () => {
    const storage = memoryStorage(); const set = vi.spyOn(storage, 'setItem'); const store = createProgressStore(ids, storage);
    store.recordResult('01', true, 3); store.recordResult('01', true, 2); store.setSettings(store.data.settings);
    expect(set).toHaveBeenCalledTimes(1);
  });
  it.each(['{', 'null', JSON.stringify({ ...freshProgress(ids), bestStars: { '01': 4 } }), JSON.stringify({ ...freshProgress(ids), settings: { sfx: 'yes' } }), JSON.stringify({ ...freshProgress(ids), unlockedStageIds: [1] })])('recovers malformed data: %s', raw => {
    const storage = memoryStorage(); storage.setItem(productionProgressKey, raw);
    const store = createProgressStore(ids, storage); expect(store.data).toEqual(freshProgress(ids)); expect(store.status).toBe('recovered');
    store.recordResult('01', true, 3); expect(store.isUnlocked('02')).toBe(true);
  });
  it('does not reinterpret or overwrite an unknown schema until explicit reset', () => {
    const storage = memoryStorage(); const raw = '{"schemaVersion":999,"unknown":"keep"}'; storage.setItem(productionProgressKey, raw);
    const store = createProgressStore(ids, storage); expect(store.status).toBe('unknown-version');
    store.recordResult('01', true, 3); expect(storage.getItem(productionProgressKey)).toBe(raw);
    store.reset(true); expect(JSON.parse(storage.getItem(productionProgressKey)!)).toEqual(freshProgress(ids));
  });
  it('retains unrelated stage records across known-stage changes', () => {
    const storage = memoryStorage(); storage.setItem(productionProgressKey, JSON.stringify({ ...freshProgress(ids), clearedStageIds: ['retired'], unlockedStageIds: ['retired'], bestStars: { retired: 3 } }));
    const store = createProgressStore(ids, storage); store.recordResult('01', true, 2);
    expect(store.data.clearedStageIds).toContain('retired'); expect(store.data.bestStars.retired).toBe(3);
  });
  it('continues in memory when reading or writing storage throws', () => {
    const store = createProgressStore(ids, { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
    store.recordResult('01', true, 3); expect(store.isUnlocked('02')).toBe(true); expect(store.status).toBe('unavailable');
    expect(createProgressStore(ids).status).toBe('unavailable');
  });
  it('requires confirmation and preserves settings when resetting', () => {
    const store = createProgressStore(ids, memoryStorage()); store.recordResult('01', true, 3);
    store.setSettings({ sfx: false, bgm: true, volume: .2, reducedMotion: true }); const before = store.data;
    expect(store.reset(false)).toBe(false); expect(store.data).toEqual(before);
    expect(store.reset(true)).toBe(true); expect(store.data).toEqual(freshProgress(ids, before.settings));
  });
  it('developer storage is isolated from production progress', () => {
    const production = memoryStorage(); const normal = createProgressStore(ids, production);
    normal.recordResult('01', true, 2); const saved = production.getItem(productionProgressKey);
    createProgressStore(ids, memoryStorage()).recordResult('20', true, 3);
    expect(production.getItem(productionProgressKey)).toBe(saved);
  });
});
