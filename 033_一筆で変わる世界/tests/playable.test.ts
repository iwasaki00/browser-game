import { afterEach, describe, expect, it, vi } from 'vitest';
import { stages } from '../src/challenge/stages';
import { TrialSession } from '../src/core/trial';
import { assertConservation } from '../src/core/world';
import { buildStroke, type Point } from '../src/core/stroke';
import { ComparisonController } from '../src/comparison/controller';
import { ComparisonView } from '../src/comparison/view';
import { PlayableGame } from '../src/game/playable';
import { ProgressStore, SAVE_KEY, type SaveStorage } from '../src/game/save';
import { challengeSolutions } from './fixtures/challenge-solutions';
import { comparisonDom } from './fixtures/canvas-double';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const ids = stages.map(s => s.id);
function memoryStorage() {
  const entries = new Map<string, string>();
  const storage: SaveStorage = { getItem: vi.fn(key => entries.get(key) ?? null),
    setItem: vi.fn((key, value) => { entries.set(key, value); }), removeItem: vi.fn(key => { entries.delete(key); }) };
  return { storage, entries };
}
function makeGame(index = 0) {
  const memory = memoryStorage(), progress = new ProgressStore(ids, () => memory.storage);
  for (let i = 0; i < index; i++) progress.complete(ids[i]);
  return { ...memory, progress, game: new PlayableGame(progress) };
}
function draw(session: TrialSession, points: readonly Point[]) {
  expect(session.begin(points[0], session.stage?.strokeMode ?? 'RAISE')).toBe(true);
  for (const point of points.slice(1)) session.append(point);
  session.finish(); expect(session.execute()).toBe(true);
}
function finish(index: number, edited: boolean, points = challengeSolutions[stages[index].id]) {
  const session = TrialSession.forStage(stages[index]);
  if (edited) draw(session, points); else session.play();
  session.runner.setSpeed(60); while (session.runner.playing) session.advance(200);
  assertConservation(session.runner.world); return session;
}
function finishGame(game: PlayableGame) {
  game.session.runner.setSpeed(60); while (game.session.runner.playing) game.advance(200);
}
const strokeFor = (index: number) => { const s = stages[index]; return buildStroke(challengeSolutions[s.id], s.terrain.width, s.terrain.height,
  { mode: s.strokeMode, maxLength: s.maxStrokeLength, radius: s.brushRadius, heightDelta: s.heightDelta }).stroke; };

describe('追加チャレンジの成立', () => {
  it('PG-01 / PG-02: 分岐を開くと町へ取水し、排出口への配分も変わる', () => {
    const a = finish(3, false), b = finish(3, true);
    expect(a.goalResult?.status).toBe('FAILURE'); expect(a.runner.world.cumulativeIntake).toBe(0);
    expect(b.goalResult?.status).toBe('SUCCESS'); expect(b.runner.world.cumulativeIntake).toBe(11757);
    expect(a.runner.world.cumulativeOutlet).toBe(14935); expect(b.runner.world.cumulativeOutlet).toBe(14087);
  });
  it.each([7.5, 12.5])('PG-03: 片方の尾根だけを開いたStage 05（y=%s）は一方だけ給水して未達成', y => {
    const s = finish(4, true, [{ x: 10.5, y }]);
    expect(s.goalResult?.status).toBe('FAILURE');
    expect(s.goalResult?.conditions.filter(c => c.achieved)).toHaveLength(1);
    expect(s.goalResult?.towns.filter(t => t.currentIntake === 0)).toHaveLength(1);
  });
  it('PG-04: Stage 05の一筆で独立した2町の条件を満たす', () => {
    const a = finish(4, false), b = finish(4, true);
    expect(a.goalResult?.status).toBe('FAILURE'); expect(b.goalResult?.status).toBe('SUCCESS');
    expect(b.goalResult?.towns.map(t => t.currentIntake)).toEqual([11456, 9470]);
    expect(b.goalResult?.conditions.every(c => c.achieved)).toBe(true);
    const external = b.goalResult!; external.towns[0].currentIntake = 999;
    expect(b.goalResult!.towns[0].currentIntake).toBe(11456); expect(b.goalResult!.towns[1].currentIntake).toBe(9470);
  });
  it('PG-05: 給水だけ達成した基準結果も、浸水だけ防いだ上流の堤も複合目標は失敗', () => {
    const a = finish(5, false), wrong = finish(5, true, [{ x: 7.5, y: 10 }, { x: 7.5, y: 12 }]);
    expect(a.goalResult?.status).toBe('FAILURE');
    expect(a.goalResult?.conditions.filter(c => c.type === 'DELIVERY').every(c => c.achieved)).toBe(true);
    expect(a.goalResult?.towns[1].firstFloodStep).toBe(58);
    expect(wrong.goalResult?.status).toBe('FAILURE');
    expect(wrong.goalResult?.conditions.filter(c => c.type === 'FLOOD').every(c => c.achieved)).toBe(true);
    expect(wrong.goalResult?.towns[0].currentIntake).toBe(0);
  });
  it('PG-06: 分岐より下流の堤なら、給水と別の町の浸水防止が同時成立', () => {
    const s = finish(5, true), result = s.goalResult!;
    expect(result.status).toBe('SUCCESS'); expect(result.conditions).toHaveLength(4);
    expect(result.conditions.every(c => c.achieved)).toBe(true);
    expect(result.towns.map(t => t.currentIntake)).toEqual([15432, 2400]);
    expect(result.towns.map(t => [t.maximumDepth, t.firstFloodStep])).toEqual([[0, null], [0, null]]);
  });
  it.each([3, 4, 5])('PG-07 / PG-08: Stage %iは全セル・集計が再現し、両世界の収支を維持', index => {
    const a = finish(index, true), b = finish(index, true), baseline = finish(index, false);
    expect(a.record).toEqual(b.record); expect(a.runner.world).toEqual(b.runner.world);
    expect(assertConservation(a.runner.world)).toBe(a.runner.world.initialWater - a.runner.world.cumulativeIntake - a.runner.world.cumulativeOutlet);
    assertConservation(baseline.runner.world);
  });
  it.each([0, 1, 2])('PG-09 / PG-21: Stage %iの既存単独・比較結果を維持', index => {
    const s = finish(index, true), c = new ComparisonController(stages[index], strokeFor(index));
    while (c.stepNumber < c.maxSteps) c.step();
    expect(c.getFinalResult()?.worldBResult.goal).toEqual(s.goalResult);
    expect(c.getFinalResult()?.worldAResult.goal.status).toBe('FAILURE'); expect(s.goalResult?.status).toBe('SUCCESS');
    expect(c.getFinalResult()?.intakeDifference.total.delta).toBe([9868, 6117, 0][index]);
    expect(c.getFinalResult()?.floodDifference.maximumDepth.delta).toBe([0, 0, -424][index]);
  });
  it.each([3, 4, 5])('追加Stage %iの禁止操作・偽装ストロークは拒否', index => {
    const s = TrialSession.forStage(stages[index]);
    expect(s.begin(challengeSolutions[stages[index].id][0], s.stage!.strokeMode === 'RAISE' ? 'LOWER' : 'RAISE')).toBe(false);
    expect(s.execute()).toBe(false);
    expect(() => new ComparisonController(stages[index], { ...strokeFor(index), radius: 99 })).toThrow();
  });
});

describe('進行・保存・ゲーム状態', () => {
  it('PG-10 / PG-11 / PG-12: 初期ロック、実クリアで次を解放し、クリア済みへ戻れる', () => {
    const { game, progress } = makeGame();
    expect(progress.canSelect(ids[0])).toBe(true); expect(progress.canSelect(ids[1])).toBe(false);
    expect(() => game.selectStage(ids[1])).toThrow();
    draw(game.session, challengeSolutions[ids[0]]); finishGame(game);
    expect(progress.isCleared(ids[0])).toBe(true); expect(progress.canSelect(ids[1])).toBe(true); expect(progress.canSelect(ids[2])).toBe(false);
    game.selectStage(ids[1]); expect(game.session.runner.world.step).toBe(0);
    game.selectStage(ids[0]); expect(game.session.phase).toBe('READY'); expect(progress.isCleared(ids[0])).toBe(true);
  });
  it('PG-13: 実クリアと設定を保存して、新しいストアとゲームで復元', () => {
    const { game, progress, storage, entries } = makeGame(); draw(game.session, challengeSolutions[ids[0]]); finishGame(game);
    progress.setSettings({ showFlow: true, reducedMotion: true, showGuide: false, view: 'height' });
    const restored = new ProgressStore(ids, () => storage);
    expect(restored.data).toEqual(progress.data); expect(JSON.parse(entries.get(SAVE_KEY)!).schemaVersion).toBe(1);
    expect(new PlayableGame(restored).session.stage?.id).toBe(ids[1]); expect(Object.isFrozen(restored.data.settings)).toBe(true);
  });
  const bad = [null, 'broken-json', JSON.stringify(3), JSON.stringify({ schemaVersion: 9 }),
    JSON.stringify({ schemaVersion: 1, clearedStageIds: ['unknown'], highestUnlockedStage: ids[1], settings: {} }),
    JSON.stringify({ schemaVersion: 1, clearedStageIds: [ids[1]], highestUnlockedStage: ids[2], settings: {} }),
    JSON.stringify({ schemaVersion: 1, clearedStageIds: [], highestUnlockedStage: ids[5], settings: {} })];
  it.each(bad.slice(1))('PG-14: 破損・未知ID・順序やバージョン不正を安全に処理: %s', raw => {
    const { storage, entries } = memoryStorage(); entries.set(SAVE_KEY, raw!);
    const p = new ProgressStore(ids, () => storage);
    expect(p.data.clearedStageIds).toEqual([]); expect(p.canSelect(ids[1])).toBe(false); expect(p.warning).not.toBe('');
    expect(new PlayableGame(p).session.stage?.id).toBe(ids[0]); expect(entries.get(SAVE_KEY)).toBe(raw);
  });
  it('PG-14: 不正な表示設定も拒否し、空データは通常起動', () => {
    const { storage, entries } = memoryStorage(), original = new ProgressStore(ids, () => storage);
    expect(original.warning).toBe('');
    entries.set(SAVE_KEY, JSON.stringify({ ...original.data, settings: { ...original.data.settings, showFlow: 'true' } }));
    expect(new ProgressStore(ids, () => storage).warning).not.toBe('');
  });
  it.each(['getter', 'read', 'write'] as const)('PG-15: localStorage %s例外でもメモリー内で進行', failure => {
    const { storage } = memoryStorage();
    if (failure === 'read') storage.getItem = () => { throw new Error('blocked'); };
    if (failure === 'write') storage.setItem = () => { throw new Error('quota'); };
    const p = new ProgressStore(ids, () => { if (failure === 'getter') throw new Error('blocked'); return storage; });
    if (failure !== 'write') expect(p.warning).not.toBe('');
    const g = new PlayableGame(p); draw(g.session, challengeSolutions[ids[0]]); finishGame(g);
    expect(p.canSelect(ids[1])).toBe(true);
    if (failure === 'read') { expect(p.warning).toBe(''); expect(storage.setItem).toHaveBeenCalled(); }
    else expect(p.warning).not.toBe('');
  });
  it('PG-16: 設定とガイドの変更で同じ試行の最終結果は変わらない', () => {
    const first = makeGame(), second = makeGame();
    for (const item of [first, second]) draw(item.game.session, challengeSolutions[ids[0]]);
    second.progress.setSettings({ showFlow: true, reducedMotion: true, showGuide: false, view: 'water' });
    finishGame(first.game); finishGame(second.game); expect(first.game.session.record).toEqual(second.game.session.record);
  });
  it('PG-17 / PG-18: フリーとデバッグは進捗に影響せず、毎回独立した世界を生成', () => {
    const { game, progress } = makeGame(); const initial = progress.data, original = game.session;
    game.setMode('free'); const free = game.session; draw(free, [{ x: 30, y: 30 }, { x: 33, y: 31 }]);
    finishGame(game); expect(game.session.goalResult).toBeNull(); expect(game.session.phase).toBe('RESULT');
    expect(progress.data).toBe(initial); game.setMode('debug'); expect(game.session).not.toBe(free);
    game.selectSample('facilities'); game.step(); expect(game.session.runner.world.cumulativeSupply).toBe(4096);
    game.setMode('challenge'); expect(game.session).not.toBe(original); expect(game.session.runner.world.step).toBe(0);
    expect(game.session.runner.world.cumulativeIntake).toBe(0); expect(game.session.goalResult?.towns[0].firstFloodStep).toBeNull();
    expect(progress.data).toBe(initial);
  });
  it('PG-19: リトライで町履歴・取水・地形・水量・ステップ・比較集計を初期化', () => {
    const { game } = makeGame(5), initial = structuredClone(game.session.runner.world);
    game.session.play(); finishGame(game); expect(game.session.goalResult?.towns[1].firstFloodStep).toBe(58);
    game.retry(); expect(game.session.runner.world).toEqual(initial); expect(game.session.phase).toBe('READY'); expect(game.summary).toBeNull();
    expect(game.session.goalResult?.towns.every(t => t.currentIntake === 0 && t.maximumDepth === 0 && t.firstFloodStep === null)).toBe(true);
  });
  it('PG-20: 初期化のキャンセルは無作用、明示確認した場合だけ自ゲームのキーを削除', () => {
    const { progress, storage, entries } = makeGame(2); entries.set('another-game', 'keep');
    const before = progress.data; expect(progress.reset(false)).toBe(false); expect(progress.data).toBe(before); expect(storage.removeItem).not.toHaveBeenCalled();
    expect(progress.reset(true)).toBe(true); expect(progress.data.clearedStageIds).toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledExactlyOnceWith(SAVE_KEY); expect(entries.get('another-game')).toBe('keep');
  });
  it('PG-20: 削除が拒否されても初期化結果を偽らず、警告とメモリー初期化を返す', () => {
    const { progress, storage } = makeGame(1); storage.removeItem = () => { throw new Error('blocked'); };
    progress.reset(true); expect(progress.data.clearedStageIds).toEqual([]); expect(progress.warning).toContain('削除できません');
  });
  it('PG-22: メニュー表示・モードやステージ切替で前のランナーを停止', () => {
    const { game } = makeGame(1); const old = game.session; old.play(); game.advance(100);
    game.openScreen('SETTINGS'); const step = old.runner.world.step;
    expect(old.runner.playing).toBe(false); expect(game.advance(10000)).toBe(0); expect(old.runner.world.step).toBe(step);
    game.openScreen('GAME'); game.advance(200); expect(old.runner.world.step).toBe(step);
    old.play(); game.setMode('free'); expect(old.runner.playing).toBe(false); const free = game.session; free.play();
    game.selectStage(ids[1]); expect(free.runner.playing).toBe(false); expect(game.session.runner.world.step).toBe(0);
    expect(game.session.runner.world.water).not.toBe(old.runner.world.water);
  });
  it('PG-21: 通常結果画面の比較差分はフレーム上限内で既存比較と一致', () => {
    const { game } = makeGame(); draw(game.session, challengeSolutions[ids[0]]); finishGame(game);
    expect(game.summary).toBeNull(); for (let frame = 0; frame < 60 && !game.summary; frame++) game.advanceSummary();
    expect(game.summary?.intakeDifference.total.delta).toBe(9868); expect(game.summary?.worldBResult.goal).toEqual(game.session.goalResult);
    game.retry(); expect(game.summary).toBeNull();
  });
  it('比較画面での実クリアを一度だけ通知し、進捗にも反映', () => {
    const ui = comparisonDom(), { game, progress } = makeGame(), callback = vi.fn(result => game.acceptComparison(result));
    const view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {}, onComplete: callback });
    view.open(stages[0], strokeFor(0), 60, true);
    for (let frame = 0; frame < 30; frame++) view.advance(200);
    expect(callback).toHaveBeenCalledTimes(1); expect(progress.canSelect(ids[1])).toBe(true);
    ui.click('comparison-before'); ui.click('comparison-after'); expect(callback).toHaveBeenCalledTimes(1);
    game.setMode('free'); const before = progress.data; game.acceptComparison(callback.mock.calls[0][0]); expect(progress.data).toBe(before);
  });
});
