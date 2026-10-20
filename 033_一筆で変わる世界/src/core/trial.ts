import { SimulationRunner } from './runner';
import { createWorld, type WorldDefinition, type WorldState } from './world';
import { applyStroke, buildStroke, DEFAULT_BRUSH, strokeEdits,
  type CellEdit, type Point, type Stroke, type StrokeMode, type StrokePreview } from './stroke';
import { freezeData, loadStage, stageWorld, type StageDefinition } from '../challenge/stage';
import { GoalTracker, type GoalResult } from '../challenge/goals';

export interface ChallengeRecord {
  conditions: { stage: StageDefinition; stroke: Stroke | null };
  goal: GoalResult;
  finalWorld: { width: number; height: number; heights: readonly number[]; water: readonly number[];
    step: number; initialWater: number; cumulativeSupply: number; cumulativeIntake: number; cumulativeOutlet: number };
}

export type TrialPhase = 'READY' | 'DRAWING' | 'PREVIEW' | 'SIMULATING' | 'RESULT';
function definition(world: WorldState): WorldDefinition {
  return { width: world.width, height: world.height, heights: world.heights.slice(), water: world.water.slice(),
    protected: world.protected.slice(), sources: world.sources.map(e => ({ ...e })),
    intakes: world.intakes.map(e => ({ ...e })), outlets: world.outlets.map(e => ({ ...e })) };
}
export class TrialSession {
  phase: TrialPhase = 'READY';
  runner: SimulationRunner;
  preview: StrokePreview | null = null;
  edits: CellEdit[] = [];
  appliedCount = 0;
  readonly stage?: StageDefinition;
  readonly brush: { maxLength: number; radius: number; heightDelta: number };
  record: ChallengeRecord | null = null;
  private tracker?: GoalTracker;
  private appliedStroke: Stroke | null = null;
  private readonly initial: WorldDefinition;
  private rawPoints: Point[] = [];
  constructor(initial: WorldDefinition, stage?: StageDefinition) {
    this.stage = stage ? loadStage(stage) : undefined;
    this.brush = Object.freeze(this.stage ? { maxLength: this.stage.maxStrokeLength, radius: this.stage.brushRadius, heightDelta: this.stage.heightDelta } : { ...DEFAULT_BRUSH });
    this.initial = definition(createWorld(this.stage ? stageWorld(this.stage) : initial));
    this.runner = this.makeRunner(this.initial);
  }
  static forStage(stage: StageDefinition): TrialSession {
    const validated = loadStage(stage);
    return new TrialSession(stageWorld(validated), validated);
  }
  get goalResult(): GoalResult | null { return this.tracker?.result() ?? null; }
  private makeRunner(initial: WorldDefinition): SimulationRunner {
    this.tracker = this.stage ? new GoalTracker(this.stage, createWorld(initial)) : undefined;
    return new SimulationRunner(initial, { maxSteps: this.stage?.maxSimulationSteps,
      onStep: this.tracker ? (world, accounting) => this.tracker!.observe(world, accounting) : undefined });
  }
  get editable(): boolean { return this.phase === 'READY' || this.phase === 'DRAWING' || this.phase === 'PREVIEW'; }
  get executionReason(): string {
    if (this.phase !== 'PREVIEW') return '盤面に一筆を描いてから実行してください。';
    if (!this.preview?.stroke.points.length) return '有効な一筆がありません。盤面の内側に描いてください。';
    if (!this.edits.length) return '変更対象がありません。保護区域や高度の上下限を避けて再描画してください。';
    return '';
  }
  begin(point: Point, mode: StrokeMode): boolean {
    // PREVIEW cannot silently become a second stroke: redraw must explicitly clear it.
    if (this.phase !== 'READY' || (this.stage && mode !== this.stage.strokeMode)) return false;
    this.rawPoints = [{ ...point }]; this.phase = 'DRAWING';
    this.preview = buildStroke(this.rawPoints, this.runner.world.width, this.runner.world.height, { ...this.brush, mode });
    this.edits = strokeEdits(this.runner.world, this.preview.stroke);
    return true;
  }
  append(point: Point): void {
    if (this.phase !== 'DRAWING' || !this.preview) return;
    const last = this.rawPoints.at(-1)!;
    if (last.x === point.x && last.y === point.y) return;
    // Collinear forward samples have identical geometry; merge them to bound typical input size.
    const before = this.rawPoints.at(-2);
    if (before && Math.abs((last.x - before.x) * (point.y - last.y) - (last.y - before.y) * (point.x - last.x)) < 1e-10
      && (last.x - before.x) * (point.x - last.x) + (last.y - before.y) * (point.y - last.y) >= 0) this.rawPoints.pop();
    if (this.rawPoints.length >= 8192) throw new Error('一筆の入力点数が上限に達しました。短い軌跡で描き直してください。');
    this.rawPoints.push({ ...point });
    this.preview = buildStroke(this.rawPoints, this.runner.world.width, this.runner.world.height, this.preview.stroke);
    this.edits = strokeEdits(this.runner.world, this.preview.stroke);
  }
  finish(): void { if (this.phase === 'DRAWING') this.phase = 'PREVIEW'; }
  cancel(): void {
    if (!this.editable) return;
    this.preview = null; this.edits = []; this.rawPoints = []; this.phase = 'READY';
  }
  execute(): boolean {
    if (this.executionReason) return false;
    const world = createWorld(this.initial);
    this.appliedCount = applyStroke(world, this.preview!.stroke).length;
    const speed = this.runner.speed;
    this.appliedStroke = freezeData(structuredClone(this.preview!.stroke));
    this.runner.pause(); this.runner = this.makeRunner(definition(world)); this.runner.setSpeed(speed);
    this.phase = 'SIMULATING'; this.runner.play();
    return true;
  }
  play(): void {
    if (!['READY', 'SIMULATING'].includes(this.phase)) return;
    this.phase = 'SIMULATING'; this.runner.play();
  }
  step(): void {
    if (!['READY', 'SIMULATING'].includes(this.phase)) return;
    this.phase = 'SIMULATING'; this.runner.pause(); this.runner.step(); this.syncPhase();
  }
  advance(milliseconds: number): number {
    const count = this.runner.advance(milliseconds); this.syncPhase(); return count;
  }
  private syncPhase(): void {
    if (this.runner.world.step !== this.runner.maxSteps) return;
    this.phase = 'RESULT';
    if (this.stage && !this.record) {
      const w = this.runner.world;
      this.record = freezeData({ conditions: { stage: this.stage, stroke: this.appliedStroke }, goal: this.tracker!.result(),
        finalWorld: { width: w.width, height: w.height, heights: Array.from(w.heights), water: Array.from(w.water), step: w.step,
          initialWater: w.initialWater, cumulativeSupply: w.cumulativeSupply, cumulativeIntake: w.cumulativeIntake, cumulativeOutlet: w.cumulativeOutlet } });
    }
  }
  reset(): void {
    const speed = this.runner.speed;
    this.runner.pause(); this.runner = this.makeRunner(this.initial); this.runner.setSpeed(speed);
    this.phase = 'READY'; this.preview = null; this.edits = []; this.rawPoints = []; this.appliedCount = 0;
    this.record = null; this.appliedStroke = null;
  }
}
