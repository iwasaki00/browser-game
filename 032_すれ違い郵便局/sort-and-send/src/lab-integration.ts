import { labUnlock, type LabStore } from './lab';
import type { createProgressStore } from './progress';
import type { SimulationResult } from './simulation';
import type { Stage } from './stage';
type ProgressStore = ReturnType<typeof createProgressStore>;

/** The unlocking run is eligible: progress first, updated unlock check second. */
export function recordRunOutcome(progress: ProgressStore, lab: LabStore, stage: Stage, fingerprint: string, configuration: unknown, result: SimulationResult, stars: number | null) {
  const newBest = progress.recordResult(stage.id, result.clear, stars);
  const discovery = lab.collect({ stageId: stage.id, stageFingerprint: fingerprint, configuration, result, progress: progress.data });
  return { newBest, discovery };
}
export function prepareLabRetry(lab: LabStore, progress: ProgressStore, stages: readonly Stage[], key: string) {
  if (!labUnlock(stages, progress.data).unlocked) return;
  const record = lab.resolve(key);
  if (!record) return;
  const stage = lab.stage(record.stageId);
  return stage ? { stage, configuration: record.configuration } : undefined;
}
export function resetProgressAndLab(progress: ProgressStore, lab: LabStore, confirmed: boolean) {
  if (!confirmed) return { ok: false, message: 'キャンセルしました。' };
  if (progress.status === 'unknown-version') return { ok: false, message: '未対応の進行保存形式を保護するため、初期化を中止しました。' };
  const reset = lab.reset(true);
  if (!reset.ok) return reset;
  progress.reset(true);
  return { ok: true, message: progress.status === 'unavailable' ? '研究室は初期化しました。進行はこのページ内だけの初期化です（保存不可）。' : reset.message };
}
