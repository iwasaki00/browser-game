import { compareIds, stageFingerprint } from './fingerprint';
import { deliveryCost } from './cost';
import { simulate, type SimulationResult } from './simulation';
import { verifiedMinimum } from './scoring';
import type { SolverSummary } from './solver';
import type { Direction, Stage } from './stage';
import type { Progress, ProgressStorage } from './progress';

export const productionLabKey = 'sort-and-send.lab.v1';
export type Configuration = Record<string, Direction[]>;
export interface Discovery { stageId: string; stageFingerprint: string; configuration: Configuration; discoveryKey: string; cost: number }
export type LabStatus = 'ready' | 'partial' | 'unavailable' | 'unknown-schema' | 'corrupt';
export type CollectionStatus = 'NEW' | 'ALREADY_COLLECTED' | 'LOCKED' | 'RESCUE_USED' | 'FAILED' | 'LIMIT' | 'INVALID' | 'SAVE_FAILED' | 'UNKNOWN_SCHEMA';
export interface CollectionOutcome { status: CollectionStatus; message: string }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function labUnlock(stages: readonly Stage[], progress: Pick<Progress, 'bestStars'>) {
  const achieved = stages.filter(s => Number.isInteger(progress.bestStars[s.id]) && progress.bestStars[s.id] >= 1 && progress.bestStars[s.id] <= 3).length;
  return { unlocked: stages.length > 0 && achieved === stages.length, achieved, total: stages.length };
}
/** Exact branch set, code-unit ID order and every slot, including unused switches. */
export function normalizeConfiguration(stage: Stage, value: unknown): Configuration | undefined {
  if (!object(value)) return;
  const branches = stage.nodes.filter(n => n.kind === 'switch').sort((a, b) => compareIds(a.id, b.id));
  if (Object.keys(value).length !== branches.length) return;
  const entries: [string, Direction[]][] = [];
  for (const branch of branches) {
    if (!Object.hasOwn(value, branch.id)) return;
    const pattern = value[branch.id];
    if (!Array.isArray(pattern) || pattern.length !== branch.initialPattern?.length || pattern.some(d => d !== 'L' && d !== 'R')) return;
    entries.push([branch.id, [...pattern]]);
  }
  return Object.fromEntries(entries);
}
export function discoveryKey(stage: Stage, configuration: Configuration): string {
  const entries = Object.keys(configuration).sort(compareIds).map(id => [id, configuration[id]]);
  return JSON.stringify([stage.id, stageFingerprint(stage), entries]);
}
function makeDiscovery(stage: Stage, value: unknown): Discovery | undefined {
  const configuration = normalizeConfiguration(stage, value);
  if (!configuration) return;
  try {
    const result = simulate(stage, configuration);
    if (!result.clear || result.rescueUsed) return;
    return { stageId: stage.id, stageFingerprint: stageFingerprint(stage), configuration,
      discoveryKey: discoveryKey(stage, configuration), cost: deliveryCost(configuration, result) };
  } catch { return; }
}

/** Independent storage; opaque old/invalid entries survive ordinary writes. No old stars become discoveries. */
export function createLabStore(stages: readonly Stage[], reports: readonly SolverSummary[], storage?: ProgressStorage, key = productionLabKey) {
  let raw: string | null = null;
  let payload: Record<string, unknown> = { schemaVersion: 1, discoveries: [] };
  let status: LabStatus = 'ready';
  let entries: unknown[] = [];
  function refresh() {
    if (!storage) { status = 'unavailable'; return; }
    try {
      const latest = storage.getItem(key);
      raw = latest;
      if (latest === null) { payload = { schemaVersion: 1, discoveries: [] }; entries = []; status = 'ready'; return; }
      let decoded: unknown;
      try { decoded = JSON.parse(latest); } catch { entries = []; status = 'corrupt'; return; }
      if (!object(decoded)) { entries = []; status = 'corrupt'; return; }
      if (decoded.schemaVersion !== 1) { entries = []; status = 'unknown-schema'; return; }
      if (!Array.isArray(decoded.discoveries)) { entries = []; status = 'corrupt'; return; }
      payload = decoded; entries = decoded.discoveries; status = 'ready';
    } catch { entries = []; status = 'unavailable'; }
  }
  function catalog(stage: Stage) {
    const report = reports.find(r => r.stageId === stage.id);
    const total = report && verifiedMinimum(stage, report) !== null ? report.solutionCount : null;
    return { total, limit: total === null ? 0 : Math.min(100, total) };
  }
  function scan() {
    const records: Discovery[] = []; const seen = new Set<string>(); let archived = 0, invalid = 0;
    for (const entry of entries) {
      if (!object(entry) || typeof entry.stageId !== 'string' || typeof entry.stageFingerprint !== 'string' ||
        typeof entry.discoveryKey !== 'string' || !object(entry.configuration) || !Number.isSafeInteger(entry.cost) || Number(entry.cost) < 0) { invalid++; continue; }
      const stage = stages.find(s => s.id === entry.stageId);
      if (!stage || entry.stageFingerprint !== stageFingerprint(stage)) { archived++; continue; }
      const record = makeDiscovery(stage, entry.configuration);
      if (!record || record.discoveryKey !== entry.discoveryKey || record.cost !== entry.cost) { invalid++; continue; }
      const { limit } = catalog(stage);
      if (seen.has(record.discoveryKey)) continue;
      if (!limit || records.filter(r => r.stageId === stage.id).length >= limit) { invalid++; continue; }
      seen.add(record.discoveryKey); records.push(record);
    }
    if (status === 'ready' && invalid) status = 'partial';
    return { records, archived, invalid };
  }
  function write(next: unknown[]): boolean {
    if (!storage || (status !== 'ready' && status !== 'partial')) return false;
    try {
      // Refresh happened before the operation; a second read prevents clobbering a changed snapshot.
      if (storage.getItem(key) !== raw) { refresh(); return false; }
      const serialized = JSON.stringify({ ...payload, schemaVersion: 1, discoveries: next });
      storage.setItem(key, serialized); raw = serialized; payload = { ...payload, schemaVersion: 1, discoveries: next }; entries = next; status = 'ready';
      return true;
    } catch { status = 'unavailable'; return false; }
  }
  function saveFailure(): CollectionOutcome {
    return { status: status === 'unknown-schema' ? 'UNKNOWN_SCHEMA' : 'SAVE_FAILED', message: '研究室の保存に失敗しました。CLEARと星評価は保持します。' };
  }
  refresh();
  return {
    view() {
      refresh(); const { records, archived, invalid } = scan();
      return { status, archived, invalid, records: structuredClone(records), stages: stages.map(stage => {
        const { total, limit } = catalog(stage); const count = records.filter(r => r.stageId === stage.id).length;
        return { stageId: stage.id, total, limit, count, complete: total !== null && count === total, limitReached: limit > 0 && count >= limit };
      }) };
    },
    collect(input: { stageId: string; stageFingerprint: string; configuration: unknown; result: SimulationResult; progress: Pick<Progress, 'bestStars'> }): CollectionOutcome {
      if (!input.result.clear) return { status: 'FAILED', message: 'FAILEDのため発見登録はありません。' };
      if (input.result.rescueUsed || input.result.events.some(e => e.rescue)) return { status: 'RESCUE_USED', message: 'RESCUE使用のため発見登録の対象外です。' };
      if (!labUnlock(stages, input.progress).unlocked) return { status: 'LOCKED', message: '全ステージで星1以上を取得すると、以降の通常CLEARを収集できます。' };
      refresh();
      if (status === 'unknown-schema') return { status: 'UNKNOWN_SCHEMA', message: '未対応の研究室保存形式を保護しています。発見を保存できませんでした。' };
      if (status === 'corrupt' || status === 'unavailable') return { status: 'SAVE_FAILED', message: '研究室データを安全に保存できませんでした。CLEARと星評価は保持します。' };
      const stage = stages.find(s => s.id === input.stageId);
      const record = stage && input.stageFingerprint === stageFingerprint(stage) ? makeDiscovery(stage, input.configuration) : undefined;
      if (!stage || !record || catalog(stage).total === null) return { status: 'INVALID', message: 'ステージ識別子または設定を検証できず、発見は登録しませんでした。' };
      const { records } = scan();
      if (records.some(r => r.discoveryKey === record.discoveryKey)) return { status: 'ALREADY_COLLECTED', message: 'この設定は発見登録済みです。' };
      if (records.filter(r => r.stageId === stage.id).length >= catalog(stage).limit) return { status: 'LIMIT', message: 'このステージの収集上限に達しています。' };
      if (!write([...entries, record])) return saveFailure();
      return { status: 'NEW', message: 'NEW DISCOVERY! 新しい成功設定を研究室に保存しました。' };
    },
    resolve(discoveryId: string): Discovery | undefined {
      refresh(); return structuredClone(scan().records.find(r => r.discoveryKey === discoveryId));
    },
    stage(id: string) { return stages.find(s => s.id === id); },
    reset(confirmed: boolean): { ok: boolean; message: string } {
      if (!confirmed) return { ok: false, message: 'キャンセルしました。' };
      refresh();
      if (status === 'unknown-schema' || status === 'corrupt' || status === 'unavailable') return { ok: false, message: '研究室データを安全に初期化できないため、進行初期化を中止しました。元の記録を保護しています。' };
      return write([]) ? { ok: true, message: '進行と研究室の記録を初期化しました。' } : { ok: false, message: '研究室の初期化を保存できませんでした。進行記録は変更していません。' };
    },
  };
}
export type LabStore = ReturnType<typeof createLabStore>;
