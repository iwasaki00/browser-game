export interface Settings { sfx: boolean; bgm: boolean; volume: number; reducedMotion: boolean }
export interface Progress {
  schemaVersion: 1;
  unlockedStageIds: string[];
  clearedStageIds: string[];
  bestStars: Record<string, number>;
  settings: Settings;
}
export interface ProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type SaveStatus = 'fresh' | 'restored' | 'recovered' | 'unavailable' | 'unknown-version';
export const productionProgressKey = 'sort-and-send.progress.v1';
export const defaultSettings: Settings = { sfx: true, bgm: false, volume: .35, reducedMotion: false };
export function freshProgress(stageIds: readonly string[], settings: Settings = defaultSettings): Progress {
  return { schemaVersion: 1, unlockedStageIds: stageIds.slice(0, 1), clearedStageIds: [], bestStars: {}, settings: { ...settings } };
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64 && !['__proto__', 'constructor', 'prototype'].includes(v);
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(validId);
export function validSettings(v: unknown): v is Settings {
  return object(v) && typeof v.sfx === 'boolean' && typeof v.bgm === 'boolean' &&
    typeof v.reducedMotion === 'boolean' && typeof v.volume === 'number' && Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1;
}
function decode(raw: string, stageIds: readonly string[]): { data: Progress; status: SaveStatus } {
  const v: unknown = JSON.parse(raw);
  if (!object(v)) throw new Error('Invalid progress');
  if (v.schemaVersion !== 1) return { data: freshProgress(stageIds), status: 'unknown-version' };
  if (!ids(v.unlockedStageIds) || !ids(v.clearedStageIds) || !object(v.bestStars) || !validSettings(v.settings) ||
    !Object.entries(v.bestStars).every(([id, stars]) => validId(id) && typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 && stars <= 3)) throw new Error('Invalid progress');
  // Retain records for stage IDs absent from this release. Only known clear records unlock successors.
  const unlocked = new Set([...stageIds.slice(0, 1), ...v.unlockedStageIds]);
  for (const id of v.clearedStageIds) {
    const index = stageIds.indexOf(id);
    if (index >= 0) { unlocked.add(id); if (index + 1 < stageIds.length) unlocked.add(stageIds[index + 1]); }
  }
  return { data: { schemaVersion: 1, unlockedStageIds: [...unlocked], clearedStageIds: [...new Set(v.clearedStageIds)],
    bestStars: Object.fromEntries(Object.entries(v.bestStars)) as Record<string, number>, settings: { ...v.settings } }, status: 'restored' };
}

/** Storage is injected, so developer access can use memory without touching production records. */
export function createProgressStore(stageIds: readonly string[], storage?: ProgressStorage, key = productionProgressKey) {
  let data = freshProgress(stageIds);
  let status: SaveStatus = storage ? 'fresh' : 'unavailable';
  let lastSaved: string | null = null;
  let writable = true;
  try {
    const raw = storage?.getItem(key);
    if (raw !== null && raw !== undefined) {
      try { const loaded = decode(raw, stageIds); data = loaded.data; status = loaded.status; lastSaved = raw; writable = status !== 'unknown-version'; }
      catch { status = 'recovered'; }
    }
  } catch { status = 'unavailable'; }
  function persist() {
    if (!storage || !writable) return;
    const raw = JSON.stringify(data);
    if (raw === lastSaved) return;
    try { storage.setItem(key, raw); lastSaved = raw; status = 'restored'; }
    catch { status = 'unavailable'; }
  }
  return {
    get data(): Progress { return structuredClone(data); },
    get status(): SaveStatus { return status; },
    isUnlocked(id: string) { return data.unlockedStageIds.includes(id); },
    recordResult(id: string, clear: boolean, stars: number | null) {
      const index = stageIds.indexOf(id);
      if (!clear || index < 0) return false;
      const oldBest = data.bestStars[id] ?? 0;
      const validStars = stars !== null && Number.isInteger(stars) && stars >= 1 && stars <= 3;
      if (validStars) data.bestStars[id] = Math.max(oldBest, stars);
      data.clearedStageIds = [...new Set([...data.clearedStageIds, id])];
      data.unlockedStageIds = [...new Set([...data.unlockedStageIds, id, ...stageIds.slice(index + 1, index + 2)])];
      persist();
      return validStars && stars > oldBest;
    },
    setSettings(settings: Settings) {
      if (!validSettings(settings)) return;
      data.settings = { ...settings }; persist();
    },
    reset(confirmed: boolean) {
      if (!confirmed) return false;
      data = freshProgress(stageIds, data.settings); writable = true; persist(); return true;
    },
  };
}
export function memoryStorage(): ProgressStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
