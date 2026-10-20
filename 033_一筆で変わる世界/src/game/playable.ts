import { TrialSession, type ChallengeRecord } from '../core/trial';
import { stages } from '../challenge/stages';
import { samples } from '../samples';
import { ComparisonController, type ComparisonResult } from '../comparison/controller';
import { ProgressStore } from './save';

export type GameMode = 'challenge' | 'free' | 'debug';
export type GameScreen = 'GAME' | 'STAGES' | 'SETTINGS' | 'HELP';
/** App progression/navigation, outside simulation and stroke logic. */
export class PlayableGame {
  session: TrialSession;
  mode: GameMode = 'challenge';
  screen: GameScreen = 'GAME';
  sampleId = samples[0].id;
  notice = '';
  #completedRecord: ChallengeRecord | null = null;
  #summary: ComparisonController | null = null;
  constructor(readonly progress: ProgressStore) {
    this.session = TrialSession.forStage(stages.find(stage => stage.id === progress.data.highestUnlockedStage) ?? stages[0]);
  }
  openScreen(screen: GameScreen): void { this.session.runner.pause(); this.#summary?.pause(); this.screen = screen; }
  setMode(mode: GameMode): void {
    if (!['challenge', 'free', 'debug'].includes(mode)) throw new Error('モードが不正です');
    if (this.mode !== mode) {
      this.mode = mode;
      this.replace(mode === 'challenge' ? TrialSession.forStage(stages.find(stage => stage.id === this.progress.data.highestUnlockedStage)!)
        : new TrialSession(samples.find(sample => sample.id === this.sampleId)!.create()));
    }
    this.openScreen('GAME');
  }
  selectStage(id: string): void {
    const stage = stages.find(s => s.id === id);
    if (!stage || !this.progress.canSelect(id)) throw new Error('このステージはまだ解放されていません');
    this.mode = 'challenge'; this.replace(TrialSession.forStage(stage)); this.screen = 'GAME';
  }
  selectSample(id: string): void {
    if (this.mode === 'challenge') throw new Error('チャレンジ中はサンプルを選択できません');
    const sample = samples.find(s => s.id === id);
    if (!sample) throw new Error('サンプルがありません');
    this.sampleId = id; this.replace(new TrialSession(sample.create()));
  }
  private replace(next: TrialSession): void {
    const speed = this.session.runner.speed; this.session.runner.pause(); this.session.cancel(); this.#summary?.pause();
    this.session = next; next.runner.setSpeed(speed); this.#summary = null; this.#completedRecord = null; this.notice = '';
  }
  retry(): void {
    this.session.runner.pause(); this.session.reset(); this.#summary?.pause(); this.#summary = null; this.#completedRecord = null; this.notice = '';
  }
  step(): void { if (this.screen === 'GAME') { this.session.step(); this.observeCompletion(); } }
  advance(milliseconds: number): number {
    if (this.screen !== 'GAME') return 0;
    const advanced = this.session.advance(milliseconds); this.observeCompletion(); return advanced;
  }
  observeCompletion(): void {
    const record = this.session.record;
    if (this.mode !== 'challenge' || !record || this.#completedRecord === record) return;
    this.#completedRecord = record;
    if (record.goal.status === 'SUCCESS') this.recordClear(record.conditions.stage.id);
    // Result metrics use the existing comparison controller, capped at four pairs per frame.
    if (record.conditions.stroke) this.#summary = new ComparisonController(record.conditions.stage, record.conditions.stroke);
  }
  advanceSummary(): boolean {
    if (this.screen !== 'GAME' || !this.#summary || this.#summary.getFinalResult() || this.#summary.error) return false;
    for (let count = 0; count < 4 && this.#summary.stepNumber < this.#summary.maxSteps && !this.#summary.error; count++) this.#summary.step();
    return !!this.#summary.getFinalResult() || !!this.#summary.error;
  }
  get summary(): ComparisonResult | null { return this.#summary?.getFinalResult() ?? null; }
  get summaryError(): string { return this.#summary?.error?.message ?? ''; }
  acceptComparison(result: ComparisonResult): void {
    if (this.mode !== 'challenge' || result.stageId !== this.session.stage?.id
      || result.completedSteps !== this.session.stage.maxSimulationSteps || result.worldBResult.goal.status !== 'SUCCESS') return;
    this.recordClear(result.stageId);
  }
  private recordClear(id: string): void {
    if (!this.progress.complete(id)) return;
    const next = stages[stages.findIndex(s => s.id === id) + 1];
    this.notice = next ? `✓ クリア！ 次のステージ「${next.title}」を解放しました。` : '✓ 6ステージすべてクリア！ どの地図にも再挑戦できます。';
  }
}
