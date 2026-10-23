export interface Settings { sfx: boolean; bgm: boolean; volume: number; reducedMotion: boolean }
export interface Progress {
  schemaVersion: 1;
  unlockedStageIds: string[];
  clearedStageIds: string[];
  bestStars: Record<string, number>;
  settings: Settings;
}
export interface ProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type SaveStatus = 'fresh' | 'restored' | 'recovered' | 'unavailable' | 'unknown-version' | 'corrupt' | 'stale-generation' | 'reset-pending' | 'read-only';
export const productionProgressKey = 'sort-and-send.progress.v1';
export const defaultSettings: Settings = { sfx: true, bgm: false, volume: .35, reducedMotion: false };
export function freshProgress(stageIds: readonly string[], settings: Settings = defaultSettings): Progress {
  return { schemaVersion: 1, unlockedStageIds: stageIds.slice(0, 1), clearedStageIds: [], bestStars: {}, settings: { ...settings } };
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64 && !['__proto__', 'constructor', 'prototype'].includes(v);
export function validSettings(v: unknown): v is Settings {
  return object(v) && typeof v.sfx === 'boolean' && typeof v.bgm === 'boolean' &&
    typeof v.reducedMotion === 'boolean' && typeof v.volume === 'number' && Number.isFinite(v.volume) && v.volume >= 0 && v.volume <= 1;
}
function decode(raw: string, stageIds: readonly string[]): { data: Progress; status: SaveStatus; generation: string; pending: boolean } {
  const v: unknown = JSON.parse(raw);
  if (!object(v)) throw new Error('Invalid progress');
  if (v.schemaVersion !== 1) return { data: freshProgress(stageIds), status: 'unknown-version', generation: '', pending: false };
  if ((v.generation !== undefined && !validId(v.generation)) || (v.resetPending !== undefined && typeof v.resetPending !== 'boolean')) throw new Error('Invalid save metadata');
  // AUD-001: recover independent fields; stars never invent CLEAR history.
  const cleanIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter(validId))] : [];
  const cleared = cleanIds(v.clearedStageIds);
  const best = object(v.bestStars) ? Object.fromEntries(Object.entries(v.bestStars).filter(([id, stars]) => validId(id) && typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 && stars <= 3)) as Record<string, number> : {};
  const settings = { ...defaultSettings };
  if (object(v.settings)) for (const k of Object.keys(settings) as (keyof Settings)[]) {
    const candidate = { ...settings, [k]: v.settings[k] };
    if (validSettings(candidate)) Object.assign(settings, candidate);
  }
  // Retain records for stage IDs absent from this release. Only known clear records unlock successors.
  const unlocked = new Set([...stageIds.slice(0, 1), ...cleanIds(v.unlockedStageIds)]);
  for (const id of cleared) {
    const index = stageIds.indexOf(id);
    if (index >= 0) { unlocked.add(id); if (index + 1 < stageIds.length) unlocked.add(stageIds[index + 1]); }
  }
  const data: Progress = { schemaVersion: 1, unlockedStageIds: [...unlocked], clearedStageIds: cleared, bestStars: best, settings };
  const recovered = JSON.stringify(v.bestStars) !== JSON.stringify(best) || JSON.stringify(v.settings) !== JSON.stringify(settings) || JSON.stringify(v.clearedStageIds) !== JSON.stringify(cleared) || JSON.stringify(v.unlockedStageIds) !== JSON.stringify(cleanIds(v.unlockedStageIds));
  return { data, status: recovered ? 'recovered' : 'restored', generation: typeof v.generation === 'string' ? v.generation : 'legacy', pending: v.resetPending === true };
}

/** Storage is injected, so developer access can use memory without touching production records. */
export function createProgressStore(stageIds: readonly string[], storage?: ProgressStorage, key = productionProgressKey, canWrite = () => true) {
  let data = freshProgress(stageIds);
  let status: SaveStatus = storage ? 'fresh' : 'unavailable';
  let lastSaved: string | null = null;
  let generation = 'legacy', pending = false, stale = false;
  function sync(initial = false) {
    if (stale) { status = 'stale-generation'; return false; }
    if (!storage) { status = 'unavailable'; return false; }
    let raw: string | null;
    try { raw = storage.getItem(key); } catch { status = 'unavailable'; return false; }
    try {
      const loaded = raw === null ? { data: freshProgress(stageIds), status: 'fresh' as SaveStatus, generation: 'legacy', pending: false } : decode(raw, stageIds);
      if (loaded.status === 'unknown-version') { status = loaded.status; return false; }
      if (!initial && generation !== loaded.generation) { stale = true; status = 'stale-generation'; return false; }
      generation = loaded.generation; pending = loaded.pending; lastSaved = raw;
      if (initial || pending) data = loaded.data;
      else {
        for (const [id, stars] of Object.entries(loaded.data.bestStars)) data.bestStars[id] = Math.max(data.bestStars[id] ?? 0, stars);
        data.clearedStageIds = [...new Set([...loaded.data.clearedStageIds, ...data.clearedStageIds])];
        data.unlockedStageIds = [...new Set([...loaded.data.unlockedStageIds, ...data.unlockedStageIds])];
        data.settings = loaded.data.settings;
      }
      status = pending ? 'reset-pending' : loaded.status; return !pending;
    } catch { status = 'corrupt'; return false; }
  }
  sync(true);
  function persist() {
    if (!storage || !canWrite()) { status = 'read-only'; return false; }
    const raw = JSON.stringify({ ...data, ...(generation !== 'legacy' ? { generation } : {}), ...(pending ? { resetPending: true } : {}) });
    try {
      if (storage.getItem(key) !== lastSaved) { status = 'unavailable'; return false; }
      if (raw !== lastSaved) storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) { status = 'unavailable'; return false; }
      lastSaved = raw; status = pending ? 'reset-pending' : 'restored'; return true;
    } catch { status = 'unavailable'; return false; }
  }
  return {
    get data(): Progress { return structuredClone(data); },
    get status(): SaveStatus { return status; },
    get writable() { return canWrite() && !stale && !pending && !['corrupt', 'unknown-version'].includes(status); },
    sync,
    beginReset() {
      const ready = sync();
      if ((!ready && !pending) || stale || !canWrite()) return false;
      if (!pending) generation = crypto.randomUUID();
      pending = true; return persist();
    },
    finishReset() {
      if (!pending || stale || !canWrite()) return false;
      const before = data; data = freshProgress(stageIds, data.settings); pending = false;
      if (persist()) return true;
      data = before; pending = true; return false;
    },
    isUnlocked(id: string) { return data.unlockedStageIds.includes(id); },
    recordResult(id: string, clear: boolean, stars: number | null) {
      const index = stageIds.indexOf(id);
      if (!clear || index < 0) return false;
      const ready = sync();
      if (!ready && ['unknown-version', 'corrupt', 'stale-generation', 'reset-pending'].includes(status)) return false;
      const oldBest = data.bestStars[id] ?? 0;
      const validStars = stars !== null && Number.isInteger(stars) && stars >= 1 && stars <= 3;
      if (validStars) data.bestStars[id] = Math.max(oldBest, stars);
      data.clearedStageIds = [...new Set([...data.clearedStageIds, id])];
      data.unlockedStageIds = [...new Set([...data.unlockedStageIds, id, ...stageIds.slice(index + 1, index + 2)])];
      if (ready) persist();
      return validStars && stars > oldBest;
    },
    setSettings(settings: Settings) {
      if (!validSettings(settings)) return;
      const changed = Object.fromEntries(Object.entries(settings).filter(([k,v]) => data.settings[k as keyof Settings] !== v));
      const ready = sync();
      if (!ready && ['unknown-version', 'corrupt', 'stale-generation', 'reset-pending'].includes(status)) return;
      data.settings = { ...data.settings, ...changed }; persist();
    },
    reset(confirmed: boolean) {
      if (!confirmed) return false;
      if (!this.beginReset()) return false;
      return this.finishReset();
    },
  };
}
export function memoryStorage(): ProgressStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
