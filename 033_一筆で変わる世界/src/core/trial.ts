import { SimulationRunner } from './runner';
import { createWorld, MAX_STEPS, type WorldDefinition, type WorldState } from './world';
import { applyStroke, buildStroke, DEFAULT_BRUSH, strokeEdits,
  type CellEdit, type Point, type StrokeMode, type StrokePreview } from './stroke';

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
  private readonly initial: WorldDefinition;
  private rawPoints: Point[] = [];
  constructor(initial: WorldDefinition) {
    this.initial = definition(createWorld(initial));
    this.runner = new SimulationRunner(this.initial);
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
    if (this.phase !== 'READY') return false;
    this.rawPoints = [{ ...point }]; this.phase = 'DRAWING';
    this.preview = buildStroke(this.rawPoints, this.runner.world.width, this.runner.world.height, { ...DEFAULT_BRUSH, mode });
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
    if (this.rawPoints.length >= 8192) return;
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
    this.runner.pause(); this.runner = new SimulationRunner(definition(world)); this.runner.setSpeed(speed);
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
  private syncPhase(): void { if (this.runner.world.step === MAX_STEPS) this.phase = 'RESULT'; }
  reset(): void {
    const speed = this.runner.speed;
    this.runner.pause(); this.runner = new SimulationRunner(this.initial); this.runner.setSpeed(speed);
    this.phase = 'READY'; this.preview = null; this.edits = []; this.rawPoints = []; this.appliedCount = 0;
  }
}
