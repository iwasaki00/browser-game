import { afterEach, describe, expect, it, vi } from 'vitest';
import { QualityMetrics, stepAgreement } from '../src/quality/metrics';
import { createWorld } from '../src/core/world';
import { SimulationRunner } from '../src/core/runner';
import { ComparisonController } from '../src/comparison/controller';
import { ComparisonView } from '../src/comparison/view';
import { stages } from '../src/challenge/stages';
import { buildStroke } from '../src/core/stroke';
import { GestureController } from '../src/input/gestures';
import { createCamera } from '../src/input/camera';
import { bindVisibilityPause } from '../src/input/visibility';
import { TrialSession } from '../src/core/trial';
import { challengeSolutions } from './fixtures/challenge-solutions';
import { comparisonDom } from './fixtures/canvas-double';

const probes: QualityMetrics[] = [];
afterEach(() => { for (const probe of probes.splice(0)) probe.setEnabled(false); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function meter(clock?: () => number, visible?: () => boolean) { const m = new QualityMetrics(clock, visible); probes.push(m); return m; }
function stroke(index: number) { const s = stages[index]; return buildStroke(challengeSolutions[s.id], s.terrain.width, s.terrain.height,
  { mode: s.strokeMode, maxLength: s.maxStrokeLength, radius: s.brushRadius, heightDelta: s.heightDelta }).stroke; }
function fakeClock() { let now = 0; return vi.fn(() => { now += .25; return now; }); }

describe('Quality Gate observational instrumentation', () => {
  it('QG-01: ON/OFF、FPS更新、統計取得だけではWorldStateやステップを変更しない', () => {
    const runner = new SimulationRunner({ width: 2, height: 1, heights: [0, 0], water: [8, 0] });
    const initial = structuredClone(runner.world), m = meter(fakeClock());
    for (const enabled of [true, false, true]) { m.setEnabled(enabled); m.frame(0, false); m.frame(16, false); m.snapshot(); }
    expect(runner.world).toEqual(initial); expect(runner.world.step).toBe(0);
  });
  it('QG-02: 単独600ステップの計測は水量・地形・施設集計を変えない', () => {
    const def = { width: 4, height: 4, heights: new Array(16).fill(0), water: [512, ...new Array(15).fill(0)], sources: [{ index: 0, rate: 16 }], intakes: [{ index: 15, rate: 5 }] };
    const plain = new SimulationRunner(def); while (plain.world.step < 600) plain.step();
    const m = meter(fakeClock()); m.setEnabled(true); const observed = new SimulationRunner(def);
    while (observed.world.step < 600) observed.step();
    expect(observed.world).toEqual(plain.world); expect(m.snapshot().logicalStepCpu.single.count).toBe(600);
    expect(m.snapshot().logicalStepCpu.single.meanMs).toBe(.25);
  });
  it('QG-03: 計測付きA/Bは計測なしと全セル・GoalResult・比較結果が一致', () => {
    const plain = new ComparisonController(stages[0], stroke(0)); while (plain.stepNumber < plain.maxSteps) plain.step();
    const m = meter(fakeClock()); m.setEnabled(true);
    const observed = new ComparisonController(stages[0], stroke(0)); observed.setSpeed(60); observed.play();
    while (observed.playing) observed.advance(200);
    expect(observed.getFinalResult()).toEqual(plain.getFinalResult()); expect(observed.getStateAt()).toEqual(plain.getStateAt());
    expect(m.snapshot().logicalStepCpu.comparison.count).toBe(120);
  });
  it('QG-04: A/B診断は読み取り専用で、一致・不一致・対象外を区別', () => {
    const ui = comparisonDom(), view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
    expect(view.diagnosticState()).toBeNull(); view.open(stages[0], stroke(0), 20, true); ui.click('comparison-pause'); ui.click('comparison-step');
    const before = view.diagnosticState(); for (let i = 0; i < 10; i++) expect(view.diagnosticState()).toEqual(before);
    expect(before?.steps).toEqual([1, 1]); expect(before?.balanced).toBe(true); expect(Object.isFrozen(before?.steps)).toBe(true);
    expect(stepAgreement([1, 1])).toBe(true); expect(stepAgreement([1, 2])).toBe(false); expect(stepAgreement(null)).toBeNull();
  });
  it('QG-05: OFFでは元メソッドを復元し、計測時計を一切読まない', () => {
    const step = SimulationRunner.prototype.step, pair = ComparisonController.prototype.step, advance = ComparisonController.prototype.advance;
    const clock = fakeClock(), m = meter(clock); m.setEnabled(true); m.setEnabled(true); m.setEnabled(false);
    expect(SimulationRunner.prototype.step).toBe(step); expect(ComparisonController.prototype.step).toBe(pair); expect(ComparisonController.prototype.advance).toBe(advance);
    const runner = new SimulationRunner({ width: 2, height: 1, heights: [0, 0], water: [8, 0] }); runner.step();
    m.measure('draw', () => 42); m.frame(100, false); m.snapshot(); expect(clock).not.toHaveBeenCalled();
  });
  it('QG-06: 未実測はnull。計測バッファは240件に制限', () => {
    const m = meter(fakeClock()); expect(m.snapshot().averageRafFps).toBeNull(); expect(m.snapshot().drawCpu.meanMs).toBeNull();
    m.setEnabled(true); for (let i = 0; i <= 1000; i++) m.frame(i * 16, false);
    expect(m.snapshot().frameIntervals.count).toBe(1000); expect(m.snapshot().frameIntervals.recentCount).toBe(240);
    expect(m.snapshot().averageRafFps).toBe(62.5); expect(m.snapshot().longFrames).toBe(0);
  });
  it('QG-07: 長いフレームを記録し、非表示期間とOFF期間はFPSへ加算しない', () => {
    const m = meter(); m.setEnabled(true); m.frame(0, false); m.frame(16, false); m.frame(96, false);
    expect(m.snapshot().longFrames).toBe(1); expect(m.snapshot().frameIntervals.maximumMs).toBe(80);
    m.frame(10000, true); m.frame(20000, false); m.frame(20016, false);
    expect(m.snapshot().frameIntervals.count).toBe(3);
    m.suspendFrameClock(); m.frame(30000, false); expect(m.snapshot().frameIntervals.count).toBe(3);
    m.setEnabled(false); m.frame(30000, false); m.setEnabled(true); m.frame(40000, false); m.frame(40016, false);
    expect(m.snapshot().longFrames).toBe(1);
  });
  it('QG-08: ステージ変更・RESET後の診断が初期ステップと新しいステージを示す', () => {
    const ui = comparisonDom(), view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
    view.open(stages[0], stroke(0), 20, true); ui.click('comparison-step'); expect(view.diagnosticState()?.steps).toEqual([1, 1]);
    ui.click('comparison-reset'); expect(view.diagnosticState()?.steps).toEqual([0, 0]);
    view.open(stages[5], stroke(5), 20, false); expect(view.diagnosticState()?.stageId).toBe('stage-06'); expect(view.diagnosticState()?.steps).toEqual([0, 0]);
  });
  it('QG-09: 同期PLAYのバッチを二重計上せず、結果集計は別分類', () => {
    let visible = true; const m = meter(fakeClock(), () => visible); m.setEnabled(true);
    const c = new ComparisonController(stages[0], stroke(0)); c.setSpeed(60); c.play(); expect(c.advance(250)).toBe(8);
    expect(m.snapshot().logicalStepCpu.comparison.count).toBe(8); expect(m.snapshot().logicalStepCpu.comparison.meanMs).toBe(.25 / 8);
    visible = false; c.step(); expect(m.snapshot().logicalStepCpu.summary.count).toBe(1);
  });
  it('QG-10: 計測リセットは統計だけを消し、既存の世界を保持', () => {
    const m = meter(fakeClock()); m.setEnabled(true); const r = new SimulationRunner({ width: 2, height: 1, heights: [0, 0], water: [8, 0] });
    r.step(); const before = structuredClone(r.world); m.reset(); expect(r.world).toEqual(before); expect(m.snapshot().logicalStepCpu.single.count).toBe(0);
    r.step(); expect(m.snapshot().logicalStepCpu.single.count).toBe(1);
  });
  it('QG-11: ゲームの例外を隠さず、失敗ステップを計測件数へ含めない', () => {
    const m = meter(fakeClock()); m.setEnabled(true); const r = new SimulationRunner({ width: 1, height: 1, heights: [0] });
    r.world.water[0] = -1; expect(() => r.step()).toThrow(); expect(r.world.step).toBe(0); expect(r.world.water[0]).toBe(-1);
    expect(m.snapshot().logicalStepCpu.single.count).toBe(0);
  });
  it('QG-12: 非表示イベントで単独・比較を停止してポインターを解除し、自動復帰しない', () => {
    comparisonDom(); const session = TrialSession.forStage(stages[0]);
    const gestures = new GestureController(session, createCamera(), () => ({ width: 160, height: 160, worldWidth: 16, worldHeight: 16 }));
    gestures.down(1, { x: 75, y: 70 }); expect(gestures.pointers.size).toBe(1);
    session.cancel(); session.play(); const comparison = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} }); comparison.open(stages[0], stroke(0), 20, true);
    let event = () => {}; const target = { hidden: false, addEventListener(_type: 'visibilitychange', listener: () => void) { event = listener; } };
    bindVisibilityPause(target, () => { gestures.cancel(); session.runner.pause(); comparison.suspend(); });
    event(); expect(session.runner.playing).toBe(true); target.hidden = true; event();
    expect(session.runner.playing).toBe(false); expect(gestures.pointers.size).toBe(0);
    const before = comparison.diagnosticState(); comparison.advance(200); expect(comparison.diagnosticState()).toEqual(before);
    target.hidden = false; event(); expect(session.advance(200)).toBe(0); expect(session.runner.playing).toBe(false);
  });
  it('QG-13: 再描画なしの比較drawは描画時間の件数へ含めない', () => {
    comparisonDom(); const view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} }); view.open(stages[0], stroke(0), 20, true);
    const m = meter(fakeClock()); m.setEnabled(true);
    expect(m.measure('draw', () => view.draw(0), painted => painted)).toBe(true);
    expect(m.measure('draw', () => view.draw(0), painted => painted)).toBe(false);
    expect(m.snapshot().drawCpu.count).toBe(1);
  });
  it('QG-14: 測定ラッパーは描画の戻り値・引数とコール数を保持', () => {
    const m = meter(fakeClock()); m.setEnabled(true); const object = createWorld({ width: 1, height: 1, heights: [0] });
    const action = vi.fn(() => object); expect(m.measure('draw', action)).toBe(object); expect(action).toHaveBeenCalledTimes(1);
    expect(m.snapshot().drawCpu.meanMs).toBe(.25);
  });
});
