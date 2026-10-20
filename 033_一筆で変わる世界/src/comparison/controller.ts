import { GoalTracker, type GoalResult } from '../challenge/goals';
import { freezeData, loadStage, stageWorld, type StageDefinition } from '../challenge/stage';
import { SPEEDS } from '../core/runner';
import { stepWorld, type FlowTransfer } from '../core/simulation';
import { applyStroke, type Stroke } from '../core/stroke';
import { assertConservation, createWorld, expectedWater, type WorldState } from '../core/world';
import { cloneWorld, snapshotWorld, type DeepReadonly, type WorldSnapshot } from '../core/world-view';

export const SIMULATION_VERSION = '0.6.0';
export type Assessment = 'IMPROVED' | 'WORSENED' | 'UNCHANGED';
export interface SignedDifference {
  readonly worldA: number; readonly worldB: number; readonly delta: number; readonly assessment: Assessment;
}
export interface ComparisonError {
  readonly world: 'A' | 'B'; readonly attemptedStep: number; readonly completedSteps: number; readonly message: string;
}
export interface WaterBalance {
  readonly initialWater: number; readonly finalWater: number; readonly supply: number; readonly intake: number;
  readonly outlet: number; readonly expectedWater: number; readonly difference: number; readonly conserved: boolean;
}
export interface ComparisonWorld {
  readonly state: WorldSnapshot; readonly goal: DeepReadonly<GoalResult>; readonly balance: WaterBalance;
  readonly flows: readonly FlowTransfer[];
}
export interface ComparisonSnapshot {
  readonly stageId: string; readonly simulationVersion: string; readonly step: number; readonly maxSteps: number;
  readonly worldA: ComparisonWorld; readonly worldB: ComparisonWorld; readonly error: ComparisonError | null;
}
export interface WorldResult {
  readonly goal: DeepReadonly<GoalResult>; readonly towns: DeepReadonly<GoalResult['towns']>;
  readonly balance: WaterBalance; readonly finalStep: number;
}
export interface ComparisonResult {
  readonly stageId: string; readonly simulationVersion: string; readonly appliedStroke: DeepReadonly<Stroke> | null;
  readonly completedSteps: number; readonly worldAResult: WorldResult; readonly worldBResult: WorldResult;
  readonly goalDifference: {
    readonly worldA: GoalResult['status']; readonly worldB: GoalResult['status'];
    /** Success is 1 and failure is 0. Both deltas are B minus A. */
    readonly successDelta: number; readonly achievedConditionDelta: number; readonly assessment: Assessment;
  };
  readonly intakeDifference: { readonly total: SignedDifference; readonly towns: readonly (SignedDifference & { readonly townId: string })[] };
  readonly floodDifference: {
    readonly maximumDepth: SignedDifference;
    readonly towns: readonly (SignedDifference & { readonly townId: string; readonly firstFloodStepA: number | null;
      readonly firstFloodStepB: number | null; readonly firstFloodStepDifference: number | null; readonly occurrenceAssessment: Assessment })[];
  };
}
function difference(a: number, b: number, higherIsBetter: boolean): SignedDifference {
  const delta = b - a;
  return { worldA: a, worldB: b, delta, assessment: delta === 0 ? 'UNCHANGED' : (delta > 0) === higherIsBetter ? 'IMPROVED' : 'WORSENED' };
}
function validateStroke(stage: StageDefinition, stroke: Stroke): void {
  if (stroke.mode !== stage.strokeMode || stroke.maxLength !== stage.maxStrokeLength
    || stroke.radius !== stage.brushRadius || stroke.heightDelta !== stage.heightDelta) throw new Error('一筆の条件がステージと一致しません');
  if (!stroke.segments.length || stroke.points.length !== stroke.segments.length * 2) throw new Error('確定済みの有効な一筆が必要です');
  let length = 0;
  for (const [index, segment] of stroke.segments.entries()) {
    for (const [offset, point] of [segment.from, segment.to].entries()) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > stage.terrain.width
        || point.y < 0 || point.y > stage.terrain.height) throw new Error('一筆に範囲外の座標が含まれます');
      const vertex = stroke.points[index * 2 + offset];
      if (vertex.x !== point.x || vertex.y !== point.y) throw new Error('一筆の頂点と線分が一致しません');
    }
    length += Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
  }
  if (!Number.isFinite(stroke.effectiveLength) || length > stage.maxStrokeLength + 1e-8
    || Math.abs(length - stroke.effectiveLength) > 1e-8) throw new Error('一筆の有効長が不正です');
}

/** A single clock commits both worlds together. No mutable simulation state leaves this controller. */
export class ComparisonController {
  readonly stage: StageDefinition;
  readonly appliedStroke: DeepReadonly<Stroke> | null;
  #a!: WorldState; #b!: WorldState;
  #trackerA!: GoalTracker; #trackerB!: GoalTracker;
  #playing = false; #speed: number = 20; #elapsed = 0;
  #error: ComparisonError | null = null;
  #snapshot: ComparisonSnapshot | null = null;
  #result: ComparisonResult | null = null;
  #flowsA: readonly FlowTransfer[] = Object.freeze([]);
  #flowsB: readonly FlowTransfer[] = Object.freeze([]);
  constructor(stage: StageDefinition, stroke: Stroke | null) {
    this.stage = loadStage(stage);
    if (stroke) validateStroke(this.stage, stroke);
    this.appliedStroke = stroke ? freezeData(structuredClone(stroke)) : null;
    this.reset();
  }
  get stepNumber(): number { return this.#a.step; }
  get maxSteps(): number { return this.stage.maxSimulationSteps; }
  get playing(): boolean { return this.#playing; }
  get speed(): number { return this.#speed; }
  get error(): ComparisonError | null { return this.#error; }
  start(): void { this.reset(); this.play(); }
  play(): void { if (!this.#error && this.stepNumber < this.maxSteps) this.#playing = true; }
  pause(): void { this.#playing = false; this.#elapsed = 0; }
  setSpeed(speed: number): void {
    if (!SPEEDS.some(value => value === speed)) throw new Error('未対応の比較速度です');
    this.#speed = speed; this.#elapsed = 0;
  }
  reset(): void {
    this.pause();
    const a = createWorld(stageWorld(this.stage)), b = createWorld(stageWorld(this.stage));
    if (this.appliedStroke && !applyStroke(b, structuredClone(this.appliedStroke) as Stroke).length) throw new Error('一筆に有効な地形変更がありません');
    this.#a = a; this.#b = b;
    this.#trackerA = new GoalTracker(this.stage, a); this.#trackerB = new GoalTracker(this.stage, b);
    this.#error = null; this.#snapshot = null; this.#result = null;
    this.#flowsA = Object.freeze([]); this.#flowsB = Object.freeze([]);
  }
  step(): boolean { this.pause(); return this.commitStep(); }
  private commitStep(): boolean {
    if (this.#error || this.stepNumber === this.maxSteps) return false;
    let world: 'A' | 'B' = 'A';
    try {
      if (this.#a.step !== this.#b.step) throw new Error('世界A/Bのステップが一致しません');
      const a = cloneWorld(this.#a), trackerA = this.#trackerA.fork();
      let flowsA: readonly FlowTransfer[] = [], flowsB: readonly FlowTransfer[] = [];
      if (!stepWorld(a, accounting => { trackerA.observe(a, accounting); flowsA = accounting.flows ?? []; })) throw new Error('世界Aが進みませんでした');
      world = 'B';
      const b = cloneWorld(this.#b), trackerB = this.#trackerB.fork();
      if (!stepWorld(b, accounting => { trackerB.observe(b, accounting); flowsB = accounting.flows ?? []; })) throw new Error('世界Bが進みませんでした');
      if (a.step !== b.step || a.step !== this.stepNumber + 1) throw new Error('比較の論理ステップが不整合です');
      // Publish only after both simulation and goal observers have succeeded.
      this.#a = a; this.#b = b; this.#trackerA = trackerA; this.#trackerB = trackerB;
      this.#flowsA = flowsA; this.#flowsB = flowsB;
      this.#snapshot = null;
      if (this.stepNumber === this.maxSteps) this.pause();
      return true;
    } catch (cause) {
      this.pause();
      this.#error = freezeData({ world, attemptedStep: this.stepNumber + 1, completedSteps: this.stepNumber,
        message: cause instanceof Error ? cause.message : String(cause) });
      this.#snapshot = null; this.#result = null;
      return false;
    }
  }
  advance(milliseconds: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('不正な経過時間です');
    if (!this.#playing) return 0;
    this.#elapsed += Math.min(milliseconds, 250);
    let count = 0;
    while (this.#playing && this.#elapsed >= 1000 / this.#speed && count < 8) {
      this.#elapsed -= 1000 / this.#speed;
      if (!this.commitStep()) break;
      count++;
    }
    if (count === 8) this.#elapsed = 0;
    return count;
  }
  /** Current-step lookup only: asking for history never recalculates or seeks either world. */
  getStateAt(step = this.stepNumber): ComparisonSnapshot {
    if (step !== this.stepNumber) throw new Error('履歴は保存していません。現在の同期ステップだけ取得できます');
    if (!this.#snapshot) {
      const capture = (state: WorldState, tracker: GoalTracker, flows: readonly FlowTransfer[]): ComparisonWorld => {
        const total = assertConservation(state), expected = expectedWater(state);
        return { state: snapshotWorld(state), goal: tracker.result(), flows, balance: {
          initialWater: state.initialWater, finalWater: total, supply: state.cumulativeSupply,
          intake: state.cumulativeIntake, outlet: state.cumulativeOutlet, expectedWater: expected,
          difference: total - expected, conserved: total === expected } };
      };
      this.#snapshot = freezeData({ stageId: this.stage.id, simulationVersion: SIMULATION_VERSION,
        step: this.stepNumber, maxSteps: this.maxSteps, worldA: capture(this.#a, this.#trackerA, this.#flowsA), worldB: capture(this.#b, this.#trackerB, this.#flowsB), error: this.#error });
    }
    return this.#snapshot;
  }
  getFinalResult(): ComparisonResult | null {
    if (this.#error || this.stepNumber !== this.maxSteps) return null;
    if (this.#result) return this.#result;
    const { worldA: a, worldB: b } = this.getStateAt();
    const aSuccess = a.goal.status === 'SUCCESS' ? 1 : 0, bSuccess = b.goal.status === 'SUCCESS' ? 1 : 0;
    const goalDelta = difference(aSuccess, bSuccess, true);
    const intakeTowns = a.goal.towns.map(townA => {
      const townB = b.goal.towns.find(t => t.id === townA.id)!;
      return { townId: townA.id, ...difference(townA.currentIntake, townB.currentIntake, true) };
    });
    const floodTowns = a.goal.towns.map(townA => {
      const townB = b.goal.towns.find(t => t.id === townA.id)!;
      const fa = townA.firstFloodStep, fb = townB.firstFloodStep;
      const occurrence = fa === null ? fb === null ? 'UNCHANGED' : 'WORSENED' : fb === null ? 'IMPROVED'
        : fb === fa ? 'UNCHANGED' : fb > fa ? 'IMPROVED' : 'WORSENED';
      return { townId: townA.id, ...difference(townA.maximumDepth, townB.maximumDepth, false),
        firstFloodStepA: fa, firstFloodStepB: fb, firstFloodStepDifference: fa === null || fb === null ? null : fb - fa,
        occurrenceAssessment: occurrence as Assessment };
    });
    const result = (world: ComparisonWorld): WorldResult => ({ goal: world.goal, towns: world.goal.towns, balance: world.balance, finalStep: world.state.step });
    this.#result = freezeData({ stageId: this.stage.id, simulationVersion: SIMULATION_VERSION, appliedStroke: this.appliedStroke,
      completedSteps: this.stepNumber, worldAResult: result(a), worldBResult: result(b),
      goalDifference: { worldA: a.goal.status, worldB: b.goal.status, successDelta: goalDelta.delta,
        achievedConditionDelta: b.goal.conditions.filter(c => c.achieved).length - a.goal.conditions.filter(c => c.achieved).length, assessment: goalDelta.assessment },
      intakeDifference: { total: difference(a.balance.intake, b.balance.intake, true), towns: intakeTowns },
      floodDifference: { maximumDepth: difference(Math.max(...a.goal.towns.map(t => t.maximumDepth)), Math.max(...b.goal.towns.map(t => t.maximumDepth)), false), towns: floodTowns } });
    return this.#result;
  }
}
