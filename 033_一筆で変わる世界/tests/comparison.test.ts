import { afterEach, describe, expect, it, vi } from 'vitest';
import * as simulation from '../src/core/simulation';
import { ComparisonController, SIMULATION_VERSION } from '../src/comparison/controller';
import { stages } from '../src/challenge/stages';
import { loadStage, stageWorld, type StageDefinition } from '../src/challenge/stage';
import { GoalTracker } from '../src/challenge/goals';
import { applyStroke, buildStroke, type Stroke } from '../src/core/stroke';
import { TrialSession } from '../src/core/trial';
import { createWorld } from '../src/core/world';
import { cloneWorld } from '../src/core/world-view';
import { challengeSolutions } from './fixtures/challenge-solutions';

afterEach(() => vi.restoreAllMocks());
function strokeFor(stage: StageDefinition): Stroke {
  return buildStroke(challengeSolutions[stage.id], stage.terrain.width, stage.terrain.height,
    { mode: stage.strokeMode, maxLength: stage.maxStrokeLength, radius: stage.brushRadius, heightDelta: stage.heightDelta }).stroke;
}
function finish(controller: ComparisonController): ComparisonController {
  controller.setSpeed(60); controller.play();
  while (controller.playing) controller.advance(200);
  return controller;
}
function example(patch: Partial<StageDefinition> = {}): StageDefinition {
  return loadStage({ id: 'comparison-fixture', title: '比較テスト', description: '水路の遮断で指標が悪化する検証用地形',
    terrain: { width: 4, height: 1, heights: [0, 0, 0, 0] }, initialWater: [1024, 0, 0, 0],
    sources: [], intakes: [{ id: 'intake', index: 2, rate: 128 }], outlets: [], protectedCells: [3],
    towns: [{ id: 'town', name: '町', centerCell: 3, linkedIntakeId: 'intake', requiredIntake: 256, floodThreshold: 512 }],
    strokeMode: 'RAISE', maxStrokeLength: 2, brushRadius: 0, heightDelta: 8, maxSimulationSteps: 20,
    goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town'], deliveryDeadlineStep: 20 }, ...patch });
}
const pointStroke = (stage: StageDefinition) => buildStroke([{ x: 1.5, y: .5 }], 4, 1,
  { mode: stage.strokeMode, maxLength: stage.maxStrokeLength, radius: stage.brushRadius, heightDelta: stage.heightDelta }).stroke;

describe('比較の初期条件・読み取り専用スナップショット', () => {
  it('PW-01: 初期地形以外の条件は一致し、Bだけに既存の一筆処理を適用', () => {
    const stage = stages[0], stroke = strokeFor(stage), controller = new ComparisonController(stage, stroke);
    const { worldA: a, worldB: b } = controller.getStateAt(0);
    const expected = createWorld(stageWorld(stage)); applyStroke(expected, stroke);
    expect(a.state.heights).toEqual(stage.terrain.heights); expect(b.state.heights).toEqual([...expected.heights]);
    for (const key of ['water', 'sources', 'intakes', 'outlets', 'terrainType', 'protected'] as const) expect(a.state[key]).toEqual(b.state[key]);
    expect(a.goal).toEqual(b.goal); expect(a.balance).toEqual(b.balance);
    expect(controller.stage).toEqual(stage); expect(Object.isFrozen(controller.stage)).toBe(true);
  });
  it('PW-02: 世界間で配列・施設・町・浸水履歴の可変データを共有しない', () => {
    const snapshot = new ComparisonController(stages[0], null).getStateAt();
    for (const key of ['heights', 'water', 'terrainType', 'protected', 'sources', 'intakes', 'outlets'] as const) expect(snapshot.worldA.state[key]).not.toBe(snapshot.worldB.state[key]);
    expect(snapshot.worldA.state.intakes[0]).not.toBe(snapshot.worldB.state.intakes[0]);
    expect(snapshot.worldA.goal.towns[0]).not.toBe(snapshot.worldB.goal.towns[0]);
    expect(snapshot.worldA.goal.conditions).not.toBe(snapshot.worldB.goal.conditions);
  });
  it('PW-03: 描画側から配列・施設・GoalResultを書き換えられない', () => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0])), snapshot = controller.getStateAt();
    expect(() => { (snapshot.worldA.state.water as number[])[0] = 999; }).toThrow();
    expect(() => { (snapshot.worldB.state.intakes[0] as { rate: number }).rate = 999; }).toThrow();
    expect(() => { (snapshot.worldB.goal.towns[0] as { maximumDepth: number }).maximumDepth = 999; }).toThrow();
    controller.step(); expect(snapshot.step).toBe(0); expect(snapshot.worldA.state.step).toBe(0);
    expect(controller.getStateAt().step).toBe(1);
  });
  it('PW-04: 渡したステージやストロークを後から変えてもリセット後の計算条件は変わらない', () => {
    const stage = structuredClone(stages[0]), stroke = strokeFor(stage), controller = new ComparisonController(stage, stroke);
    const initial = controller.getStateAt();
    (stage.initialWater as number[])[0] = 999; (stage.terrain.heights as number[])[0] = 0;
    stroke.points[0].x = -999; stroke.segments[0].from.x = -999;
    controller.step(); controller.reset(); expect(controller.getStateAt()).toEqual(initial);
    expect(Object.isFrozen(controller.appliedStroke?.points)).toBe(true);
  });
  it('PW-05: 現在の指定ステップだけを取得し、過去・未来の取得で再計算しない', () => {
    const controller = new ComparisonController(stages[0], null), spy = vi.spyOn(simulation, 'stepWorld');
    const initial = controller.getStateAt(0); expect(controller.getStateAt(0)).toBe(initial);
    expect(() => controller.getStateAt(1)).toThrow('現在'); expect(spy).not.toHaveBeenCalled();
    controller.step(); expect(() => controller.getStateAt(0)).toThrow('履歴');
    expect(controller.getStateAt(1).step).toBe(1); expect(spy).toHaveBeenCalledTimes(2);
  });
  it('PW-06: スナップショットの反復取得と表示切替相当の参照はステップも結果も変えない', () => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0])); controller.step();
    const spy = vi.spyOn(simulation, 'stepWorld'), snapshot = controller.getStateAt();
    for (let i = 0; i < 100; i++) { const state = controller.getStateAt(); expect(i % 2 ? state.worldA : state.worldB).toBe(i % 2 ? snapshot.worldA : snapshot.worldB); }
    expect(spy).not.toHaveBeenCalled(); expect(controller.stepNumber).toBe(1);
  });
  it('PW-07: 無効・禁止モード・条件違い・長さ偽装の一筆を拒否', () => {
    const stage = stages[0], valid = strokeFor(stage);
    for (const patch of [{ mode: 'RAISE' }, { maxLength: 100 }, { radius: 100 }, { heightDelta: 1 }, { effectiveLength: 100 }]) {
      expect(() => new ComparisonController(stage, { ...valid, ...patch } as Stroke)).toThrow();
    }
    expect(() => new ComparisonController(stage, { ...valid, points: [], segments: [] })).toThrow();
    const noChange = buildStroke([{ x: 0, y: 0 }], 16, 16, valid).stroke;
    expect(() => new ComparisonController(stage, noChange)).toThrow('有効な地形変更');
  });
});
describe('同期STEP・PLAY・PAUSE・RESET・共通SPEED', () => {
  it('PW-08: 一回のSTEPで必ず両世界を1だけ進める', () => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0]));
    for (let i = 1; i <= 120; i++) {
      expect(controller.step()).toBe(true); const snapshot = controller.getStateAt(i);
      expect([snapshot.worldA.state.step, snapshot.worldB.state.step, snapshot.worldA.goal.step, snapshot.worldB.goal.step]).toEqual([i, i, i, i]);
    }
    expect(controller.step()).toBe(false); controller.play(); expect(controller.playing).toBe(false);
  });
  it('PW-09: PAUSEで両世界を停止し、RESETは同じ一筆のステップ0へ戻す', () => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0])), initial = controller.getStateAt();
    controller.start(); controller.advance(200); expect(controller.stepNumber).toBeGreaterThan(0);
    controller.pause(); const paused = controller.getStateAt(); expect(controller.advance(200)).toBe(0); expect(controller.getStateAt()).toBe(paused);
    controller.setSpeed(60); controller.reset(); expect(controller.getStateAt()).toEqual(initial);
    expect(controller.speed).toBe(60); expect(controller.playing).toBe(false); expect(controller.getFinalResult()).toBeNull();
  });
  it('PW-10: 速度とフレーム間隔が違っても同じ論理ステップの全セルと目標が一致', () => {
    const outputs = [];
    for (const [speed, elapsed] of [[5, 200], [20, 50], [60, 1000 / 60]]) {
      const controller = new ComparisonController(stages[2], strokeFor(stages[2])); controller.setSpeed(speed); controller.play();
      while (controller.playing) controller.advance(elapsed);
      outputs.push(controller.getStateAt());
    }
    expect(outputs[1]).toEqual(outputs[0]); expect(outputs[2]).toEqual(outputs[0]);
  });
  it('PW-11: 1フレームは最大8同期ステップで、長時間の空白を無制限に処理しない', () => {
    const controller = new ComparisonController(stages[0], null), spy = vi.spyOn(simulation, 'stepWorld');
    controller.setSpeed(60); controller.play(); expect(controller.advance(999999)).toBe(8);
    expect(spy).toHaveBeenCalledTimes(16); expect(controller.stepNumber).toBe(8);
  });
  it('PW-12: 両世界は同じ水源供給条件を各ステップで使う', () => {
    const stage = example({ initialWater: [0, 0, 0, 0], sources: [{ id: 'source', index: 0, rate: 32 }] });
    const controller = new ComparisonController(stage, pointStroke(stage));
    for (let i = 1; i <= 20; i++) { controller.step(); const snapshot = controller.getStateAt(); expect(snapshot.worldA.balance.supply).toBe(i * 32); expect(snapshot.worldB.balance.supply).toBe(i * 32); }
  });
  it('PW-13: 不正な速度・経過時間を拒否し、無関係なステップを進めない', () => {
    const controller = new ComparisonController(stages[0], null);
    for (const speed of [0, -1, 10, Infinity, NaN]) expect(() => controller.setSpeed(speed)).toThrow();
    for (const elapsed of [-1, Infinity, NaN]) expect(() => controller.advance(elapsed)).toThrow();
    expect(controller.stepNumber).toBe(0);
  });
});
describe('両世界の原子的な確定と例外', () => {
  it.each(['A', 'B'] as const)('PW-14: 世界%sで候補の計算後に例外が出ても両世界とGoalResultを巻き戻す', failedWorld => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0]));
    for (let i = 0; i < 30; i++) controller.step(); const before = controller.getStateAt();
    const realStep = simulation.stepWorld; let calls = 0;
    vi.spyOn(simulation, 'stepWorld').mockImplementation((world, observe) => {
      const result = realStep(world, observe); calls++;
      if (calls === (failedWorld === 'A' ? 1 : 2)) { world.heights[0] = 0; throw new Error('故障注入'); }
      return result;
    });
    controller.play(); expect(controller.advance(200)).toBe(0);
    const stopped = controller.getStateAt();
    expect(stopped.worldA).toEqual(before.worldA); expect(stopped.worldB).toEqual(before.worldB);
    expect(controller.error).toMatchObject({ world: failedWorld, attemptedStep: 31, completedSteps: 30, message: '故障注入' });
    expect(controller.stepNumber).toBe(30); expect(controller.playing).toBe(false); expect(controller.getFinalResult()).toBeNull();
    controller.play(); expect(controller.playing).toBe(false); expect(controller.step()).toBe(false);
  });
  it('PW-15: 町の観測処理の例外も比較全体を停止し、片方の履歴だけを確定しない', () => {
    const controller = new ComparisonController(stages[2], strokeFor(stages[2])), before = controller.getStateAt();
    const realObserve = GoalTracker.prototype.observe; let calls = 0;
    vi.spyOn(GoalTracker.prototype, 'observe').mockImplementation(function (this: GoalTracker, world, accounting) {
      realObserve.call(this, world, accounting); if (++calls === 2) throw new Error('Bの判定異常');
    });
    expect(controller.step()).toBe(false); expect(controller.error?.world).toBe('B');
    expect(controller.getStateAt().worldA).toEqual(before.worldA); expect(controller.getStateAt().worldB).toEqual(before.worldB);
  });
  it('PW-16: 最終ステップでBが失敗しても完成した正常結果を返さず、RESETで回復する', () => {
    const controller = new ComparisonController(stages[0], strokeFor(stages[0])); for (let i = 0; i < 119; i++) controller.step();
    const realStep = simulation.stepWorld; let calls = 0;
    const spy = vi.spyOn(simulation, 'stepWorld').mockImplementation((world, observe) => {
      const result = realStep(world, observe); if (++calls === 2) throw new Error('最終B異常'); return result;
    });
    expect(controller.step()).toBe(false); expect(controller.getFinalResult()).toBeNull();
    expect(controller.getStateAt().worldA.goal.status).toBe('IN_PROGRESS'); expect(controller.stepNumber).toBe(119);
    spy.mockRestore(); controller.reset(); expect(controller.error).toBeNull();
    expect(finish(controller).getFinalResult()?.worldBResult.goal.status).toBe('SUCCESS');
  });
});
describe('ComparisonResultと既存の計算との一致', () => {
  it.each(stages)('PW-17: $id は単独実行と同じ結果で、A失敗・B成功', stage => {
    const controller = finish(new ComparisonController(stage, strokeFor(stage))), result = controller.getFinalResult()!;
    const baseline = TrialSession.forStage(stage), edited = TrialSession.forStage(stage), points = challengeSolutions[stage.id];
    baseline.play(); edited.begin(points[0], stage.strokeMode); for (const p of points.slice(1)) edited.append(p); edited.finish(); edited.execute();
    for (const session of [baseline, edited]) { session.runner.setSpeed(60); while (session.runner.playing) session.advance(200); }
    expect(result.worldAResult.goal).toEqual(baseline.goalResult); expect(result.worldBResult.goal).toEqual(edited.goalResult);
    expect(controller.getStateAt().worldA.state.water).toEqual([...baseline.runner.world.water]);
    expect(controller.getStateAt().worldB.state.water).toEqual([...edited.runner.world.water]);
    expect(result.goalDifference).toMatchObject({ worldA: 'FAILURE', worldB: 'SUCCESS', successDelta: 1, assessment: 'IMPROVED' });
    expect(result.completedSteps).toBe(stage.maxSimulationSteps); expect(result.simulationVersion).toBe(SIMULATION_VERSION);
    expect(result.worldAResult.balance.conserved).toBe(true); expect(result.worldBResult.balance.conserved).toBe(true);
  });
  it('PW-18: 取水量はB−Aで正、浸水深はB−Aで負になる改善を区別', () => {
    const water = finish(new ComparisonController(stages[0], strokeFor(stages[0]))).getFinalResult()!;
    expect(water.intakeDifference.total).toMatchObject({ worldA: 0, worldB: 9868, delta: 9868, assessment: 'IMPROVED' });
    const flood = finish(new ComparisonController(stages[2], strokeFor(stages[2]))).getFinalResult()!;
    expect(flood.floodDifference.maximumDepth).toMatchObject({ worldA: 424, worldB: 0, delta: -424, assessment: 'IMPROVED' });
    expect(flood.floodDifference.towns[0]).toMatchObject({ firstFloodStepA: 19, firstFloodStepB: null, firstFloodStepDifference: null, occurrenceAssessment: 'IMPROVED' });
  });
  it('PW-19: 取水が減り、成功から失敗へ悪化した場合も符号を保つ', () => {
    const stage = example(), result = finish(new ComparisonController(stage, pointStroke(stage))).getFinalResult()!;
    expect(result.worldAResult.goal.status).toBe('SUCCESS'); expect(result.worldBResult.goal.status).toBe('FAILURE');
    expect(result.goalDifference.successDelta).toBe(-1); expect(result.goalDifference.assessment).toBe('WORSENED');
    expect(result.intakeDifference.total.delta).toBeLessThan(0); expect(result.intakeDifference.total.assessment).toBe('WORSENED');
  });
  it('PW-20: 浸水が増えた悪化を正の水深差で表し、浸水なしをStep 0にしない', () => {
    const stage = example({ terrain: { width: 4, height: 1, heights: [0, 8, 0, 0] }, intakes: [],
      towns: [{ id: 'town', name: '町', centerCell: 3, floodThreshold: 64 }], strokeMode: 'LOWER',
      goalDefinition: { type: 'FLOOD_PREVENTION', townIds: ['town'], floodObservationEndStep: 20 } });
    const result = finish(new ComparisonController(stage, pointStroke(stage))).getFinalResult()!;
    expect(result.goalDifference.successDelta).toBe(-1); expect(result.floodDifference.maximumDepth.delta).toBeGreaterThan(0);
    expect(result.floodDifference.maximumDepth.assessment).toBe('WORSENED');
    expect(result.floodDifference.towns[0].firstFloodStepDifference).toBeNull();
  });
  it('PW-21: 一筆なしなら両世界が一致し、目標未達成でも比較結果を取得できる', () => {
    const controller = finish(new ComparisonController(stages[0], null)), result = controller.getFinalResult()!;
    expect(controller.getStateAt().worldA).toEqual(controller.getStateAt().worldB);
    expect(result.goalDifference).toMatchObject({ worldA: 'FAILURE', worldB: 'FAILURE', successDelta: 0, assessment: 'UNCHANGED' });
    expect(result.intakeDifference.total.delta).toBe(0); expect(result.floodDifference.maximumDepth.delta).toBe(0);
  });
  it('PW-22: 同じ条件で2回実行した結果は一致し、以前の結果はRESET後も不変', () => {
    const controller = finish(new ComparisonController(stages[1], strokeFor(stages[1]))), saved = controller.getFinalResult();
    expect(Object.isFrozen(saved)).toBe(true); controller.reset();
    expect(controller.getFinalResult()).toBeNull(); expect(saved?.completedSteps).toBe(240);
    expect(finish(controller).getFinalResult()).toEqual(saved);
  });
  it('PW-23: 原子的な候補世界の複製は全配列と施設設定を独立して保持', () => {
    const original = createWorld(stageWorld(stages[0])), copy = cloneWorld(original);
    for (const key of ['heights', 'water', 'terrainType', 'protected'] as const) {
      const before = original[key][0]; copy[key][0] = before === 1 ? 0 : 1;
      expect(original[key][0]).toBe(before); expect(copy[key]).not.toBe(original[key]);
    }
    copy.intakes[0].rate = 99; expect(original.intakes[0].rate).toBe(256);
  });
});
