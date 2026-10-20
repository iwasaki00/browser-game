import { createWorld, integer, type WorldState } from '../core/world';
import { type StepAccounting } from '../core/simulation';
import { stageWorld, type StageDefinition } from './stage';

export interface TownProgress {
  id: string; name: string; currentIntake: number; requiredIntake?: number;
  deliveryAtDeadline: number | null; currentDepth: number; maximumDepth: number;
  floodThreshold: number; firstFloodStep: number | null;
}
export interface GoalConditionResult {
  townId: string; type: 'DELIVERY' | 'FLOOD'; achieved: boolean; confirmed: boolean; failedAtStep: number | null;
}
export interface GoalResult {
  stageId: string; status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE'; step: number; maxSteps: number;
  towns: TownProgress[]; conditions: GoalConditionResult[]; firstFailureStep: number | null;
}
/** Only consumes committed intake receipts; never changes water, terrain, or simulation counters. */
export class GoalTracker {
  private readonly intakeTotals = new Map<number, number>();
  private readonly progress: TownProgress[];
  private step = 0;
  constructor(readonly stage: StageDefinition, initial: WorldState) {
    if (initial.step !== 0) throw new Error('目標判定は初期状態から開始してください');
    this.progress = stage.towns.map(t => ({ id: t.id, name: t.name, currentIntake: 0, requiredIntake: t.requiredIntake,
      deliveryAtDeadline: null, currentDepth: 0, maximumDepth: 0, floodThreshold: t.floodThreshold, firstFloodStep: null }));
    this.sample(initial);
  }
  observe(world: WorldState, accounting: StepAccounting): void {
    if (world.step !== this.step + 1 || accounting.step !== world.step) throw new Error('論理ステップの観測が重複・欠落しています');
    for (const transfer of accounting.intakes) {
      if (!this.stage.intakes.some(i => i.index === transfer.index)) throw new Error('未知の取水施設です');
      integer(transfer.amount, '取水実績');
      this.intakeTotals.set(transfer.index, integer((this.intakeTotals.get(transfer.index) ?? 0) + transfer.amount, '施設別取水量'));
    }
    this.step = world.step; this.sample(world);
  }
  private sample(world: WorldState): void {
    const goal = this.stage.goalDefinition;
    for (const p of this.progress) {
      const town = this.stage.towns.find(t => t.id === p.id)!;
      const intake = this.stage.intakes.find(i => i.id === town.linkedIntakeId);
      p.currentIntake = intake ? this.intakeTotals.get(intake.index) ?? 0 : 0;
      p.currentDepth = world.water[town.centerCell];
      if (world.step === goal.deliveryDeadlineStep) p.deliveryAtDeadline = p.currentIntake;
      if (world.step <= (goal.floodObservationEndStep ?? this.stage.maxSimulationSteps)) {
        p.maximumDepth = Math.max(p.maximumDepth, p.currentDepth);
        if (p.currentDepth >= p.floodThreshold && p.firstFloodStep === null) p.firstFloodStep = world.step;
      }
    }
  }
  /** Independent working copy for a synchronized two-world transaction; no replay or shared history. */
  fork(): GoalTracker {
    const copy = new GoalTracker(this.stage, createWorld(stageWorld(this.stage)));
    copy.step = this.step;
    for (const [index, amount] of this.intakeTotals) copy.intakeTotals.set(index, amount);
    copy.progress.splice(0, copy.progress.length, ...this.progress.map(town => ({ ...town })));
    return copy;
  }
  result(): GoalResult {
    const goal = this.stage.goalDefinition;
    const conditions: GoalConditionResult[] = [];
    for (const p of this.progress.filter(t => goal.townIds.includes(t.id))) {
      if (goal.type !== 'FLOOD_PREVENTION') {
        const confirmed = this.step >= goal.deliveryDeadlineStep!;
        const achieved = (p.deliveryAtDeadline ?? p.currentIntake) >= p.requiredIntake!;
        conditions.push({ townId: p.id, type: 'DELIVERY', achieved, confirmed,
          failedAtStep: confirmed && !achieved ? goal.deliveryDeadlineStep! : null });
      }
      if (goal.type !== 'WATER_DELIVERY') conditions.push({ townId: p.id, type: 'FLOOD',
        achieved: p.firstFloodStep === null, confirmed: p.firstFloodStep !== null || this.step >= goal.floodObservationEndStep!,
        failedAtStep: p.firstFloodStep });
    }
    const failed = conditions.flatMap(c => c.failedAtStep === null ? [] : [c.failedAtStep]);
    return { stageId: this.stage.id, step: this.step, maxSteps: this.stage.maxSimulationSteps,
      status: this.step < this.stage.maxSimulationSteps ? 'IN_PROGRESS' : conditions.every(c => c.achieved) ? 'SUCCESS' : 'FAILURE',
      towns: this.progress.map(p => ({ ...p })), conditions, firstFailureStep: failed.length ? Math.min(...failed) : null };
  }
}
