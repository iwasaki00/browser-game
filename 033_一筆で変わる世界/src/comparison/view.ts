import { type StageDefinition } from '../challenge/stage';
import { type Stroke } from '../core/stroke';
import { createCamera, constrainCamera, zoomAt, type Viewport } from '../input/camera';
import { GestureController } from '../input/gestures';
import { drawWorld } from '../render';
import { ComparisonController, type Assessment, type ComparisonWorld, type SignedDifference } from './controller';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`比較画面の要素がありません: ${id}`);
  return found as T;
}
const format = (value: number) => value.toLocaleString('ja-JP');
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`;
const assessment = (value: Assessment) => ({ IMPROVED: '↑ 改善', WORSENED: '↓ 悪化', UNCHANGED: '＝ 変化なし' })[value];
const outcome = (value: ComparisonWorld['goal']['status']) => ({ SUCCESS: '✓ 成功', FAILURE: '× 失敗', IN_PROGRESS: '… 観測中' })[value];

/** Presentation owns only camera/UI preferences; simulation is accessible solely through snapshots. */
export class ComparisonView {
  #controller: ComparisonController | null = null;
  #uiError = '';
  #dirty = true;
  #displayed: 'A' | 'B' = 'B';
  #viewSize = 0;
  #hasNext = false;
  #pointerCanvas: HTMLCanvasElement | null = null;
  readonly #panel = element('comparison-panel');
  readonly #canvases = [element<HTMLCanvasElement>('comparison-a'), element<HTMLCanvasElement>('comparison-b')];
  readonly #camera = createCamera();
  readonly #gestures = new GestureController({ editable: false, begin: () => false, append: () => {}, finish: () => {}, cancel: () => {} }, this.#camera, () => this.viewport());
  constructor(private readonly callbacks: { onBack: () => void; onRetry: () => void; onNext: () => void }) {
    const action = (id: string, fn: () => void) => { element(id).onclick = () => this.safely(fn); };
    action('comparison-play', () => this.#controller?.play());
    action('comparison-pause', () => this.#controller?.pause());
    action('comparison-step', () => { this.#controller?.step(); });
    action('comparison-reset', () => { this.cancelNavigation(); this.#uiError = ''; this.#controller?.reset(); });
    action('comparison-back', () => this.callbacks.onBack());
    action('comparison-retry', () => this.callbacks.onRetry());
    action('comparison-next', () => { if (this.canAdvanceStage) this.callbacks.onNext(); });
    action('comparison-before', () => this.showWorld('A'));
    action('comparison-after', () => this.showWorld('B'));
    action('comparison-zoom-in', () => this.zoom(1.25));
    action('comparison-zoom-out', () => this.zoom(1 / 1.25));
    action('comparison-camera-reset', () => { this.cancelNavigation(); Object.assign(this.#camera, createCamera()); });
    element<HTMLSelectElement>('comparison-speed').onchange = event => this.safely(() => this.#controller?.setSpeed(Number((event.target as HTMLSelectElement).value)));
    element<HTMLSelectElement>('comparison-layout').onchange = () => this.safely(() => {
      this.cancelNavigation(); this.#panel.dataset.layout = element<HTMLSelectElement>('comparison-layout').value;
    });
    element<HTMLSelectElement>('comparison-view').onchange = () => { this.#dirty = true; };
    for (const canvas of this.#canvases) this.bindCamera(canvas);
    new ResizeObserver(() => { if (this.active) this.#dirty = true; }).observe(this.#panel);
  }
  get active(): boolean { return this.#controller !== null; }
  get canAdvanceStage(): boolean { return this.#hasNext && this.#controller?.getFinalResult()?.worldBResult.goal.status === 'SUCCESS'; }
  open(stage: StageDefinition, stroke: Stroke, speed: number, hasNext: boolean): void {
    this.close();
    this.#controller = new ComparisonController(stage, stroke);
    this.#controller.setSpeed(speed); this.#controller.start();
    this.#uiError = ''; this.#displayed = 'B'; this.#viewSize = 0;
    this.#hasNext = hasNext;
    Object.assign(this.#camera, createCamera());
    this.#panel.dataset.world = 'B'; this.#panel.hidden = false;
    element('comparison-title').textContent = `${stage.title} · 世界A/B比較`;
    this.refresh();
  }
  close(): void {
    this.cancelNavigation(); this.#controller?.pause(); this.#controller = null;
    this.#panel.hidden = true; this.#uiError = '';
  }
  suspend(): void { this.cancelNavigation(); this.#controller?.pause(); this.refresh(); }
  advance(milliseconds: number): void {
    if (this.#controller?.playing) {
      this.#controller.advance(milliseconds); this.refresh();
    }
  }
  private safely(action: () => void): void {
    try { action(); }
    catch (cause) { this.#controller?.pause(); this.#uiError = cause instanceof Error ? cause.message : String(cause); }
    this.refresh();
  }
  private showWorld(world: 'A' | 'B'): void {
    this.cancelNavigation(); this.#displayed = world; this.#panel.dataset.world = world;
    // No calls to step, reset, or advance: the exact same synchronized snapshot is shown.
    this.#dirty = true;
  }
  private viewport(): Viewport {
    const visible = this.#canvases.find(canvas => canvas.getBoundingClientRect().width > 0);
    const width = visible?.getBoundingClientRect().width ?? 640;
    const stage = this.#controller?.stage;
    return { width, height: width, worldWidth: stage?.terrain.width ?? 64, worldHeight: stage?.terrain.height ?? 64 };
  }
  private resizeCamera(): void {
    const v = this.viewport();
    if (this.#viewSize && this.#viewSize !== v.width) {
      this.cancelNavigation();
      this.#camera.offsetX *= v.width / this.#viewSize; this.#camera.offsetY *= v.width / this.#viewSize;
    }
    this.#viewSize = v.width; constrainCamera(this.#camera, v);
  }
  private zoom(factor: number): void {
    this.cancelNavigation(); this.resizeCamera(); const v = this.viewport();
    zoomAt(this.#camera, this.#camera.zoom * factor, { x: v.width / 2, y: v.height / 2 }, v);
  }
  private cancelNavigation(): void {
    const ids = [...this.#gestures.pointers.keys()], canvas = this.#pointerCanvas;
    this.#gestures.cancel(); this.#pointerCanvas = null;
    if (canvas) for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  private bindCamera(canvas: HTMLCanvasElement): void {
    const point = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', event => {
      if (!this.active || (event.pointerType === 'mouse' && event.button !== 0)
        || (this.#pointerCanvas && this.#pointerCanvas !== canvas)) return;
      event.preventDefault();
      this.safely(() => {
        this.resizeCamera(); this.#pointerCanvas = canvas; canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId); this.#gestures.down(event.pointerId, point(event));
      });
    });
    canvas.addEventListener('pointermove', event => {
      if (!this.#gestures.pointers.has(event.pointerId)) return;
      event.preventDefault(); this.safely(() => this.#gestures.move(event.pointerId, point(event)));
    });
    canvas.addEventListener('pointerup', event => this.safely(() => {
      this.#gestures.up(event.pointerId, point(event));
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!this.#gestures.pointers.size) this.#pointerCanvas = null;
    }));
    canvas.addEventListener('pointercancel', () => this.safely(() => this.cancelNavigation()));
    canvas.addEventListener('lostpointercapture', event => {
      if (this.#gestures.pointers.has(event.pointerId)) this.safely(() => this.cancelNavigation());
    });
    canvas.addEventListener('wheel', event => {
      if (!this.active) return;
      event.preventDefault(); this.safely(() => {
        this.cancelNavigation(); this.resizeCamera();
        zoomAt(this.#camera, this.#camera.zoom * Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .002), point(event), this.viewport());
      });
    }, { passive: false });
  }
  private worldMetrics(id: 'a' | 'b', world: ComparisonWorld, invalid: boolean): void {
    element(`comparison-${id}-step`).textContent = `Step ${world.state.step}`;
    element(`comparison-${id}-outcome`).textContent = invalid ? '⚠ 比較停止 · この結果は無効です' : outcome(world.goal.status);
    const rows = world.goal.towns.map(town => {
      const row = document.createElement('p');
      row.textContent = `${town.name}: 取水 ${format(town.currentIntake)}${town.requiredIntake !== undefined ? ` / 必要 ${format(town.requiredIntake)}` : ''} 単位 · 現在水深 ${format(town.currentDepth)} / 観測最大 ${format(town.maximumDepth)} 単位 · 初回浸水 ${town.firstFloodStep === null ? 'なし' : `Step ${town.firstFloodStep}`}`;
      return row;
    });
    const balance = document.createElement('p');
    const b = world.balance;
    balance.textContent = `水量収支 ${invalid ? '直前の同期確定値' : '✓ 保存'}: 初期 ${format(b.initialWater)} ＋ 供給 ${format(b.supply)} − 取水 ${format(b.intake)} − 排出 ${format(b.outlet)} ＝ 総水量 ${format(b.finalWater)} 単位（差分 ${signed(b.difference)}）`;
    element(`comparison-${id}-metrics`).replaceChildren(...rows, balance);
  }
  private refresh(): void {
    const controller = this.#controller;
    if (!controller) return;
    const snapshot = controller.getStateAt(), problem = controller.error;
    const invalid = !!problem || !!this.#uiError;
    const error = problem ? `世界${problem.world}のStep ${problem.attemptedStep}で計算異常: ${problem.message}。両世界をStep ${problem.completedSteps}で停止しました。比較結果は無効です。RESETで再実行できます。` : this.#uiError;
    element('comparison-error').hidden = !invalid; element('comparison-error').textContent = error;
    const finished = snapshot.step === snapshot.maxSteps;
    element('comparison-status').textContent = `同期 Step ${snapshot.step} / ${snapshot.maxSteps} · ${invalid ? '⚠ 計算停止' : finished ? '計算完了' : controller.playing ? '● 再生中' : 'Ⅱ 一時停止中'}`;
    element<HTMLProgressElement>('comparison-progress').max = snapshot.maxSteps;
    element<HTMLProgressElement>('comparison-progress').value = snapshot.step;
    element<HTMLButtonElement>('comparison-play').disabled = invalid || finished || controller.playing;
    element<HTMLButtonElement>('comparison-pause').disabled = !controller.playing;
    element<HTMLButtonElement>('comparison-step').disabled = invalid || finished || controller.playing;
    element<HTMLSelectElement>('comparison-speed').value = String(controller.speed);
    element('comparison-before').setAttribute('aria-pressed', String(this.#displayed === 'A'));
    element('comparison-after').setAttribute('aria-pressed', String(this.#displayed === 'B'));
    this.worldMetrics('a', snapshot.worldA, invalid); this.worldMetrics('b', snapshot.worldB, invalid);
    const result = invalid ? null : controller.getFinalResult();
    element('comparison-outcome-summary').textContent = invalid ? '⚠ 比較結果は無効です。両世界を同じステップで停止しました。'
      : `世界A ${outcome(snapshot.worldA.goal.status)} → 世界B ${outcome(snapshot.worldB.goal.status)}${result ? ` · ${assessment(result.goalDifference.assessment)}` : ''}`;
    element('comparison-result').hidden = !result;
    element<HTMLButtonElement>('comparison-next').hidden = !result || result.worldBResult.goal.status !== 'SUCCESS' || !this.#hasNext;
    if (result) {
      element('comparison-result-title').textContent = `世界A ${outcome(result.worldAResult.goal.status)} → 世界B ${outcome(result.worldBResult.goal.status)} · ${assessment(result.goalDifference.assessment)}`;
      element('comparison-result-step').textContent = `比較対象: 同期 Step ${result.completedSteps} / シミュレーション ${result.simulationVersion}`;
      const lines: HTMLLIElement[] = [];
      const line = (label: string, metric: SignedDifference, better: string) => {
        const item = document.createElement('li'); item.className = metric.assessment.toLowerCase();
        item.textContent = `${assessment(metric.assessment)} ${label}: A ${format(metric.worldA)} → B ${format(metric.worldB)} 単位 / B−A ${signed(metric.delta)}（${better}と改善）`;
        lines.push(item);
      };
      line('総取水量', result.intakeDifference.total, '増える');
      line('町の最大浸水深（全町の最大値）', result.floodDifference.maximumDepth, '減る');
      for (const town of result.floodDifference.towns) {
        const name = controller.stage.towns.find(t => t.id === town.townId)!.name;
        const item = document.createElement('li');
        const step = (value: number | null) => value === null ? 'なし' : `Step ${value}`;
        item.textContent = `${assessment(town.occurrenceAssessment)} ${name}の初回浸水: A ${step(town.firstFloodStepA)} → B ${step(town.firstFloodStepB)} / ステップ差 ${town.firstFloodStepDifference === null ? '比較不可（浸水なしを0とは扱いません）' : signed(town.firstFloodStepDifference)}`;
        lines.push(item);
      }
      element('comparison-differences').replaceChildren(...lines);
    }
    this.#dirty = true;
  }
  draw(): void {
    if (!this.#controller || !this.#dirty) return;
    this.resizeCamera();
    const snapshot = this.#controller.getStateAt(), viewport = this.viewport();
    // Equal heights use the same palette in both worlds, even if editing changed their maxima.
    let heightScale = 1;
    for (const world of [snapshot.worldA.state, snapshot.worldB.state]) for (const height of world.heights) heightScale = Math.max(heightScale, height);
    for (const [index, world] of [snapshot.worldA, snapshot.worldB].entries()) {
      const canvas = this.#canvases[index];
      if (!canvas.getBoundingClientRect().width) continue;
      const context = canvas.getContext('2d');
      if (!context) continue;
      drawWorld(context, world.state, element<HTMLSelectElement>('comparison-view').value, null,
        { camera: this.#camera, viewport, preview: null, edits: [], towns: this.#controller.stage.towns, townProgress: world.goal.towns, heightScale });
    }
    element('comparison-zoom').textContent = `${this.#camera.zoom.toFixed(2)}×`;
    element<HTMLButtonElement>('comparison-zoom-in').disabled = this.#camera.zoom >= 4;
    element<HTMLButtonElement>('comparison-zoom-out').disabled = this.#camera.zoom <= 1;
    this.#dirty = false;
  }
}
