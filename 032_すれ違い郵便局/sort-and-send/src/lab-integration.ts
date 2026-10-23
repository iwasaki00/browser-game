import { labUnlock, type LabStore } from './lab';
import type { createProgressStore } from './progress';
import type { SimulationResult } from './simulation';
import type { Stage } from './stage';
type ProgressStore = ReturnType<typeof createProgressStore>;

/** The unlocking run is eligible: progress first, updated unlock check second. */
export function recordRunOutcome(progress: ProgressStore, lab: LabStore, stage: Stage, fingerprint: string, configuration: unknown, result: SimulationResult, stars: number | null) {
  const newBest = progress.recordResult(stage.id, result.clear, stars);
  if (!progress.writable) return { newBest, discovery: { status: 'SAVE_FAILED' as const, message: '保存を停止しています。研究室には登録しません。保存状態を確認し、必要なら再読み込みしてください。' } };
  const discovery = lab.collect({ stageId: stage.id, stageFingerprint: fingerprint, configuration, result, progress: progress.data });
  return { newBest, discovery };
}
export function prepareLabRetry(lab: LabStore, progress: ProgressStore, stages: readonly Stage[], key: string) {
  progress.sync();
  if (['stale-generation', 'reset-pending', 'unknown-version', 'corrupt'].includes(progress.status)) return;
  if (!labUnlock(stages, progress.data).unlocked) return;
  const record = lab.resolve(key);
  if (!record) return;
  const stage = lab.stage(record.stageId);
  return stage ? { stage, configuration: record.configuration } : undefined;
}
export function resetProgressAndLab(progress: ProgressStore, lab: LabStore, confirmed: boolean) {
  if (!confirmed) return { ok: false, message: 'キャンセルしました。' };
  progress.sync();
  if (['unknown-schema', 'corrupt', 'unavailable'].includes(lab.view().status)) return { ok: false, message: '研究室の元データを保護するため初期化できません。' };
  if (!progress.beginReset()) return { ok: false, message: '保存形式・世代または排他制御を確認できず、初期化を中止しました。再読み込みして確認してください。' };
  const reset = lab.reset(true);
  if (!reset.ok) return reset;
  if (!progress.finishReset()) return { ok: false, message: '初期化の保存が完了していません。通常保存を停止しています。再読み込み後、初期化を再試行してください。' };
  return { ok: true, message: reset.message };
}
