import { freezeData } from '../challenge/stage';

export const SAVE_KEY = 'one-stroke-worlds.save.v1';
export const SAVE_SCHEMA_VERSION = 1;
export interface SavedSettings { showFlow: boolean; reducedMotion: boolean; showGuide: boolean; view: 'combined' | 'height' | 'water' }
export interface SaveData { schemaVersion: 1; clearedStageIds: readonly string[]; highestUnlockedStage: string; settings: Readonly<SavedSettings> }
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const defaults = (reducedMotion: boolean): SavedSettings => ({ showFlow: false, reducedMotion, showGuide: true, view: 'combined' });

/** The only persistence boundary. Failure always leaves a usable in-memory game. */
export class ProgressStore {
  #data: SaveData;
  #storage: SaveStorage | null = null;
  #warning = '';
  readonly #defaults: SavedSettings;
  constructor(readonly stageIds: readonly string[], storage: () => SaveStorage, reducedMotion = false) {
    if (!stageIds.length || new Set(stageIds).size !== stageIds.length) throw new Error('保存用ステージ一覧が不正です');
    this.stageIds = Object.freeze([...stageIds]); this.#defaults = defaults(reducedMotion); this.#data = this.initial();
    try { this.#storage = storage(); }
    catch { this.#warning = '保存を利用できません。このタブではそのまま遊べます。'; return; }
    try {
      const saved = this.#storage.getItem(SAVE_KEY);
      if (saved !== null) this.#data = this.validate(JSON.parse(saved));
    } catch { this.#warning = '保存データを読み込めませんでした。初期状態で遊べます。'; }
  }
  private initial(): SaveData {
    return freezeData({ schemaVersion: SAVE_SCHEMA_VERSION, clearedStageIds: [], highestUnlockedStage: this.stageIds[0], settings: { ...this.#defaults } });
  }
  private validate(raw: unknown): SaveData {
    if (!raw || typeof raw !== 'object') throw new Error('保存形式が不正です');
    const data = raw as SaveData, settings = data.settings;
    if (data.schemaVersion !== SAVE_SCHEMA_VERSION || !Array.isArray(data.clearedStageIds)
      || data.clearedStageIds.length > this.stageIds.length || new Set(data.clearedStageIds).size !== data.clearedStageIds.length
      || data.clearedStageIds.some((id, index) => id !== this.stageIds[index])) throw new Error('進捗が不正です');
    const highest = this.stageIds[Math.min(data.clearedStageIds.length, this.stageIds.length - 1)];
    if (data.highestUnlockedStage !== highest || !settings || typeof settings.showFlow !== 'boolean'
      || typeof settings.reducedMotion !== 'boolean' || typeof settings.showGuide !== 'boolean'
      || !['combined', 'height', 'water'].includes(settings.view)) throw new Error('設定・解放状況が不正です');
    return freezeData({ schemaVersion: SAVE_SCHEMA_VERSION, clearedStageIds: [...data.clearedStageIds], highestUnlockedStage: highest,
      settings: { showFlow: settings.showFlow, reducedMotion: settings.reducedMotion, showGuide: settings.showGuide, view: settings.view } });
  }
  get data(): SaveData { return this.#data; }
  get warning(): string { return this.#warning; }
  canSelect(id: string): boolean { const index = this.stageIds.indexOf(id); return index >= 0 && index <= this.stageIds.indexOf(this.#data.highestUnlockedStage); }
  isCleared(id: string): boolean { return this.#data.clearedStageIds.includes(id); }
  complete(id: string): boolean {
    if (!this.canSelect(id)) throw new Error('未解放ステージはクリアできません');
    if (this.isCleared(id)) return false;
    const cleared = [...this.#data.clearedStageIds, id];
    this.#data = this.validate({ ...this.#data, clearedStageIds: cleared, highestUnlockedStage: this.stageIds[Math.min(cleared.length, this.stageIds.length - 1)] });
    this.write(); return true;
  }
  setSettings(settings: SavedSettings): void {
    const next = this.validate({ ...this.#data, settings });
    if (JSON.stringify(next) === JSON.stringify(this.#data)) return;
    this.#data = next; this.write();
  }
  private write(): void {
    try {
      if (!this.#storage) throw new Error('保存不可');
      this.#storage.setItem(SAVE_KEY, JSON.stringify(this.#data)); this.#warning = '';
    } catch { this.#warning = '保存できませんでした。進捗と設定はこのタブ内で保持します。'; }
  }
  /** Only an explicit confirmation reaches this method. A cancel has no side effects. */
  reset(confirmed: boolean): boolean {
    if (!confirmed) return false;
    this.#data = this.initial();
    try {
      if (!this.#storage) throw new Error('保存不可');
      this.#storage.removeItem(SAVE_KEY); this.#warning = '';
    } catch { this.#warning = '保存データを削除できませんでした。このタブ内の進捗は初期化しました。'; }
    return true;
  }
}
