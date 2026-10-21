import { afterEach, expect, it, vi } from 'vitest';
import { stages } from '../src/challenge/stages';
import { buildStroke } from '../src/core/stroke';
import { assertConservation } from '../src/core/world';
import { TrialSession } from '../src/core/trial';
import { PlayableGame } from '../src/game/playable';
import { ProgressStore } from '../src/game/save';
import { ComparisonView } from '../src/comparison/view';
import { GestureController } from '../src/input/gestures';
import { createCamera, zoomAt } from '../src/input/camera';
import { QualityMetrics } from '../src/quality/metrics';
import { bindVisibilityPause } from '../src/input/visibility';
import { challengeSolutions } from './fixtures/challenge-solutions';
import { comparisonDom } from './fixtures/canvas-double';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const makeGame = () => new PlayableGame(new ProgressStore(stages.map(s => s.id), () => ({ getItem: () => null, setItem() {}, removeItem() {} })));
const strokeFor = (index: number) => { const s = stages[index]; return buildStroke(challengeSolutions[s.id], s.terrain.width, s.terrain.height,
  { mode: s.strokeMode, maxLength: s.maxStrokeLength, radius: s.brushRadius, heightDelta: s.heightDelta }).stroke; };

it('PV-12: 診断ONで実解法を使い6面を2周し、全セル・判定・収支・解放を再現', () => {
  vi.useFakeTimers(); const game = makeGame(), m = new QualityMetrics(() => 0); const first = new Map<string, unknown>();
  m.setEnabled(true);
  try {
    for (let cycle = 0; cycle < 2; cycle++) for (const stage of stages) {
      const old = game.session; game.selectStage(stage.id); const s = game.session;
      expect(s.runner.world.step).toBe(0); expect(s.runner.world.water).not.toBe(old.runner.world.water);
      const points = challengeSolutions[stage.id]; s.begin(points[0], stage.strokeMode); points.slice(1).forEach(p => s.append(p));
      s.finish(); expect(s.execute()).toBe(true); s.runner.setSpeed(60);
      while (s.runner.playing) game.advance(200);
      expect(s.goalResult?.status).toBe('SUCCESS'); expect(s.runner.world.step).toBe(stage.maxSimulationSteps); assertConservation(s.runner.world);
      const result = { world: structuredClone(s.runner.world), goal: s.goalResult };
      if (cycle === 0) first.set(stage.id, result); else expect(result).toEqual(first.get(stage.id));
      expect(game.progress.isCleared(stage.id)).toBe(true);
    }
    expect(game.progress.data.clearedStageIds).toHaveLength(6);
    // Controllers and diagnostic observations do not create any playback timers.
    expect(vi.getTimerCount()).toBe(0);
  } finally { m.setEnabled(false); }
});
it('PV-13: 同じ面で50回PLAY・PAUSE・STEP・リトライを反復して状態が残らない', () => {
  const game = makeGame(), initial = structuredClone(game.session.runner.world);
  for (let i = 0; i < 50; i++) {
    game.session.play(); expect(game.advance(100)).toBe(2); game.session.runner.pause();
    expect(game.advance(10000)).toBe(0); game.step(); expect(game.session.runner.world.step).toBe(3);
    assertConservation(game.session.runner.world); game.retry();
    expect(game.session.runner.world).toEqual(initial); expect(game.session.phase).toBe('READY');
    expect(game.session.goalResult?.towns.every(t => t.currentIntake === 0 && t.firstFloodStep === null)).toBe(true);
  }
});
it('PV-14: メニュー・チャレンジ/フリー往復30回で旧世界が進まず、進捗も汚染しない', () => {
  const game = makeGame(), progress = game.progress.data;
  for (let i = 0; i < 30; i++) {
    const old = game.session; old.play(); game.advance(100); const before = structuredClone(old.runner.world);
    for (const menu of ['STAGES', 'SETTINGS', 'HELP'] as const) { game.openScreen(menu); expect(game.advance(10000)).toBe(0); }
    game.openScreen('GAME'); expect(game.advance(10000)).toBe(0); expect(old.runner.world).toEqual(before);
    game.setMode('free'); game.session.play(); game.advance(100); const free = game.session, saved = structuredClone(free.runner.world);
    game.setMode('challenge'); expect(free.runner.playing).toBe(false); expect(free.advance(10000)).toBe(0);
    expect(free.runner.world).toEqual(saved); expect(game.session.runner.world.step).toBe(0); expect(game.progress.data).toBe(progress);
  }
});
it('PV-15: 比較の表示切替・ズーム・STEP・RESETを30回反復して同期・描画・収支を維持', () => {
  const ui = comparisonDom(); ui.resize(1000);
  const view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
  view.open(stages[0], strokeFor(0), 20, true); ui.click('comparison-pause');
  for (let i = 0; i < 30; i++) {
    ui.click('comparison-play'); view.advance(100); ui.click('comparison-pause');
    const before = view.diagnosticState()!.steps; view.advance(10000); expect(view.diagnosticState()!.steps).toEqual(before);
    ui.click('comparison-step'); expect(view.diagnosticState()!.steps).toEqual([before[0] + 1, before[1] + 1]);
    for (const id of ['comparison-before', 'comparison-after', 'comparison-zoom-in', 'comparison-zoom-out']) ui.click(id);
    expect(view.diagnosticState()!.steps).toEqual([before[0] + 1, before[1] + 1]);
    expect(view.draw(i * 100)).toBe(true); expect(view.diagnosticState()!.balanced).toBe(true); expect(view.diagnosticState()!.problem).toBeNull();
    ui.click('comparison-reset'); expect(view.diagnosticState()!.steps).toEqual([0, 0]);
  }
  expect(ui.paints[0].calls.length).toBeGreaterThan(0); expect(ui.paints[1].calls.length).toBeGreaterThan(0);
});
it('PV-16: パン・ピンチ・非表示/復帰50回でポインターが残らず、勝手に再開しない', () => {
  const s = TrialSession.forStage(stages[0]), camera = createCamera(), viewport = { width: 400, height: 400, worldWidth: 16, worldHeight: 16 };
  const gestures = new GestureController(s, camera, () => viewport); gestures.tool = 'PAN';
  let hidden = false, notify = () => {};
  bindVisibilityPause({ get hidden() { return hidden; }, addEventListener(_type, fn) { notify = fn; } }, () => { gestures.cancel(); s.runner.pause(); });
  for (let i = 0; i < 50; i++) {
    zoomAt(camera, 2, { x: 200, y: 200 }, viewport);
    gestures.down(1, { x: 100, y: 100 }); gestures.move(1, { x: 110, y: 110 });
    gestures.down(2, { x: 150, y: 150 }); gestures.move(2, { x: 170, y: 170 });
    s.play(); hidden = true; notify(); expect(gestures.pointers.size).toBe(0); expect(s.runner.playing).toBe(false);
    const world = structuredClone(s.runner.world); hidden = false; notify(); expect(s.advance(10000)).toBe(0); expect(s.runner.world).toEqual(world);
  }
});
