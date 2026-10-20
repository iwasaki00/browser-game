import { describe, expect, it } from 'vitest';
import { loadStage, stageWorld, type StageDefinition } from '../src/challenge/stage';
import { stages } from '../src/challenge/stages';
import { TrialSession } from '../src/core/trial';
import { assertConservation, createWorld, MAX_WATER } from '../src/core/world';
import { stepWorld } from '../src/core/simulation';
import { GoalTracker } from '../src/challenge/goals';
import { challengeSolutions } from './fixtures/challenge-solutions';

function fixture(patch: Partial<StageDefinition> = {}): StageDefinition {
  return loadStage({ id: 'fixture', title: '判定用', description: '施設と町を壁で分離した最小盤面',
    terrain: { width: 3, height: 1, heights: [0, 40, 0] }, initialWater: [8, 0, 0],
    sources: [], intakes: [{ id: 'water', index: 0, rate: 8 }], outlets: [], protectedCells: [2],
    towns: [{ id: 'town', name: '町', centerCell: 2, linkedIntakeId: 'water', requiredIntake: 8, floodThreshold: 4 }],
    strokeMode: 'LOWER', maxStrokeLength: 1, brushRadius: 0, heightDelta: 1, maxSimulationSteps: 2,
    goalDefinition: { type: 'COMBINED', townIds: ['town'], deliveryDeadlineStep: 2, floodObservationEndStep: 2 }, ...patch });
}
function complete(stage: StageDefinition): TrialSession {
  const s = TrialSession.forStage(stage); s.play(); s.runner.setSpeed(60);
  while (s.runner.playing) s.advance(200);
  return s;
}
describe('ステージの読み込み・独立性', () => {
  it.each(stages)('CH-01: $id のサイズ・定義を読み込み、深く凍結する', stage => {
    const loaded = loadStage(stage), world = createWorld(stageWorld(loaded));
    expect(world.water.length).toBe(stage.terrain.width * stage.terrain.height);
    expect(Object.isFrozen(loaded)).toBe(true); expect(Object.isFrozen(loaded.terrain.heights)).toBe(true);
    expect(Object.isFrozen(loaded.goalDefinition.townIds)).toBe(true);
  });
  it.each<Partial<StageDefinition>>([
    { terrain: { width: 0, height: 1, heights: [] } },
    { terrain: { width: 3, height: 1, heights: [0, 0] } },
    { terrain: { width: 3, height: 1, heights: [0, -1, 0] } },
    { initialWater: [0] }, { initialWater: [-1, 0, 0] },
    { intakes: [{ id: 'water', index: 3, rate: 1 }] },
    { sources: [{ id: 'source', index: 0, rate: 1 }] },
    { sources: [{ id: 'water', index: 1, rate: 1 }] },
    { sources: [{ id: 'source', index: 1, rate: MAX_WATER }] },
    { protectedCells: [-1] }, { protectedCells: [0, 0] },
    { towns: [{ id: 'town', name: '町', centerCell: 3, floodThreshold: 1 }] },
    { towns: [{ id: 'town', name: '町', centerCell: 0, floodThreshold: 1 }] },
    { towns: [{ id: 'town', name: '町', centerCell: 2, linkedIntakeId: 'missing', requiredIntake: 8, floodThreshold: 1 }] },
    { towns: [{ id: 'town', name: '町', centerCell: 2, linkedIntakeId: 'water', requiredIntake: -1, floodThreshold: 1 }] },
    { towns: [{ id: 'town', name: '町', centerCell: 2, floodThreshold: 0 }] },
    { goalDefinition: { type: 'WATER_DELIVERY', townIds: ['missing'], deliveryDeadlineStep: 1 } },
    { goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town'], deliveryDeadlineStep: 3 } },
    { goalDefinition: { type: 'FLOOD_PREVENTION', townIds: ['town'] } },
    { goalDefinition: { type: 'COMBINED', townIds: ['town'], deliveryDeadlineStep: 1, floodObservationEndStep: NaN } },
    { maxSimulationSteps: 601 }, { maxSimulationSteps: 0 }, { maxStrokeLength: -1 }, { brushRadius: NaN }, { heightDelta: 1.5 },
  ])('CH-02: 不正なサイズ・値・参照・目標を拒否 %j', patch => expect(() => fixture(patch)).toThrow());
  it('入力配列の外部変更は読み込み後の定義と試行を汚染しない', () => {
    const input = structuredClone(fixture()), loaded = loadStage(input), s = TrialSession.forStage(loaded);
    (input.initialWater as number[])[0] = 999;
    expect(loaded.initialWater[0]).toBe(8); expect(s.runner.world.water[0]).toBe(8);
    s.runner.world.heights[0] = 200; expect(loaded.terrain.heights[0]).toBe(0);
  });
  it('CH-09: ステージ切替は地形・水量・集計・一筆・ステップを新規生成する', () => {
    const a = complete(stages[0]), b = TrialSession.forStage(stages[1]);
    expect(b.phase).toBe('READY'); expect(b.runner.world).toEqual(createWorld(stageWorld(stages[1])));
    expect(b.runner.world.water).not.toBe(a.runner.world.water); expect(b.preview).toBeNull(); expect(b.record).toBeNull();
    expect(b.goalResult?.towns[0].currentIntake).toBe(0); expect(b.goalResult?.firstFailureStep).toBeNull();
  });
});
describe('町の取水と浸水・明示的なGoalResult', () => {
  it('CH-03: 中心セルと取水セルは独立し、取水を町で重複除去しない', () => {
    const s = complete(fixture()); const town = s.goalResult!.towns[0];
    expect(town.currentIntake).toBe(8); expect(town.currentDepth).toBe(0);
    expect(s.runner.world.cumulativeIntake).toBe(8); expect(assertConservation(s.runner.world)).toBe(0);
  });
  it('CH-04: 必要値と同量の累積取水で給水目標成功', () => {
    const s = complete(fixture({ goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town'], deliveryDeadlineStep: 2 } }));
    expect(s.goalResult?.status).toBe('SUCCESS'); expect(s.goalResult?.conditions[0].achieved).toBe(true);
  });
  it('CH-05: 取水不足では未達成', () => {
    const s = complete(fixture({ initialWater: [7, 0, 0] }));
    expect(s.goalResult?.status).toBe('FAILURE'); expect(s.goalResult?.conditions[0].failedAtStep).toBe(2);
  });
  it('CH-06: 危険水深と等しい初期水深も失敗（Step 0を観測）', () => {
    const s = complete(fixture({ initialWater: [8, 0, 4] }));
    expect(s.goalResult?.towns[0].firstFloodStep).toBe(0); expect(s.goalResult?.status).toBe('FAILURE');
  });
  it('CH-07: 途中で浸水して引いた履歴は消えない', () => {
    const stage = fixture(), w = createWorld(stageWorld(stage)), tracker = new GoalTracker(stage, w);
    w.step = 1; w.water[2] = 4; tracker.observe(w, { step: 1, intakes: [{ index: 0, amount: 8 }] });
    w.step = 2; w.water[2] = 0; tracker.observe(w, { step: 2, intakes: [] });
    expect(tracker.result().towns[0]).toMatchObject({ currentDepth: 0, maximumDepth: 4, firstFloodStep: 1 });
    expect(tracker.result().status).toBe('FAILURE');
  });
  it('CH-07 integration: 実際の水流と排出口で水が引いても初回浸水を保持', () => {
    const s = complete(fixture({ terrain: { width: 4, height: 1, heights: [0, 0, 0, 0] }, initialWater: [64, 0, 0, 0],
      intakes: [], outlets: [{ id: 'drain', index: 2, rate: Infinity }], protectedCells: [1], maxSimulationSteps: 40,
      towns: [{ id: 'town', name: '町', centerCell: 1, floodThreshold: 8 }],
      goalDefinition: { type: 'FLOOD_PREVENTION', townIds: ['town'], floodObservationEndStep: 40 } }));
    expect(s.goalResult?.towns[0].currentDepth).toBeLessThan(8);
    expect(s.goalResult?.towns[0].maximumDepth).toBeGreaterThanOrEqual(8);
    expect(s.goalResult?.towns[0].firstFloodStep).toBe(1); expect(s.goalResult?.status).toBe('FAILURE');
    expect(() => assertConservation(s.runner.world)).not.toThrow();
  });
  it.each([[8, 0, 'SUCCESS'], [7, 0, 'FAILURE'], [8, 4, 'FAILURE'], [7, 4, 'FAILURE']] as const)(
    'CH-08: COMBINEDは両方成立時だけ成功（取水%s・水深%s）', (water, depth, status) => {
      expect(complete(fixture({ initialWater: [water, 0, depth] })).goalResult?.status).toBe(status);
    });
  it('期限後の取水は給水達成にさかのぼって計上しない', () => {
    const s = complete(fixture({ goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town'], deliveryDeadlineStep: 0 } }));
    expect(s.goalResult?.towns[0]).toMatchObject({ currentIntake: 8, deliveryAtDeadline: 0 });
    expect(s.goalResult?.status).toBe('FAILURE');
  });
  it('指定した浸水観測終了後の水深変化は観測結果を書き換えない', () => {
    const s = complete(fixture({ terrain: { width: 3, height: 1, heights: [40, 0, 0] }, initialWater: [0, 0, 0],
      sources: [{ id: 'source', index: 1, rate: 512 }],
      goalDefinition: { type: 'FLOOD_PREVENTION', townIds: ['town'], floodObservationEndStep: 0 } }));
    expect(s.goalResult?.towns[0].currentDepth).toBeGreaterThanOrEqual(4);
    expect(s.goalResult?.towns[0].maximumDepth).toBe(0); expect(s.goalResult?.status).toBe('SUCCESS');
  });
  it('施設別取水を混ぜず、別の町へ同じ取水を加算しない', () => {
    const stage = fixture({ terrain: { width: 5, height: 1, heights: [0, 40, 0, 40, 0] },
      initialWater: [8, 0, 0, 0, 0], protectedCells: [],
      intakes: [{ id: 'water', index: 0, rate: 8 }, { id: 'dry', index: 2, rate: 8 }],
      towns: [{ id: 'town', name: '町', centerCell: 4, linkedIntakeId: 'dry', requiredIntake: 8, floodThreshold: 4 }],
      goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town'], deliveryDeadlineStep: 2 } });
    const s = complete(stage); expect(s.runner.world.cumulativeIntake).toBe(8);
    expect(s.goalResult?.towns[0].currentIntake).toBe(0); expect(s.goalResult?.status).toBe('FAILURE');
  });
  it('同一ステップを重複して取水計上する観測を拒否', () => {
    const stage = fixture(), w = createWorld(stageWorld(stage)), tracker = new GoalTracker(stage, w);
    stepWorld(w, receipt => tracker.observe(w, receipt));
    expect(() => tracker.observe(w, { step: 1, intakes: [{ index: 0, amount: 8 }] })).toThrow();
  });
});
describe('チャレンジの再試行・実行制御', () => {
  it('CH-10: リトライで取水・浸水履歴・結果・世界を初期化する', () => {
    const s = complete(stages[2]); expect(s.goalResult?.towns[0].firstFloodStep).toBe(19); const saved = s.record;
    s.reset(); expect(s.runner.world).toEqual(createWorld(stageWorld(stages[2])));
    expect(s.record).toBeNull(); expect(s.goalResult?.towns[0]).toMatchObject({ currentIntake: 0, maximumDepth: 0, firstFloodStep: null });
    expect(s.goalResult?.status).toBe('IN_PROGRESS'); expect(saved?.goal.status).toBe('FAILURE');
    expect(Object.isFrozen(saved?.finalWorld.water)).toBe(true);
  });
  it('CH-16: 途中浸水で失敗確定しても指定ステップまで続ける', () => {
    const s = TrialSession.forStage(stages[2]);
    for (let i = 0; i < 19; i++) s.step();
    expect(s.goalResult?.firstFailureStep).toBe(19); expect(s.goalResult?.status).toBe('IN_PROGRESS'); expect(s.phase).toBe('SIMULATING');
    s.play(); s.runner.setSpeed(60); while (s.runner.playing) s.advance(200);
    expect(s.runner.world.step).toBe(160); expect(s.goalResult?.status).toBe('FAILURE'); expect(s.phase).toBe('RESULT');
  });
  it('CH-17: 観測を付けた世界と付けない世界は全セル・全収支が一致', () => {
    const s = TrialSession.forStage(stages[0]), ordinary = createWorld(stageWorld(stages[0]));
    for (let i = 0; i < 120; i++) { s.step(); stepWorld(ordinary); expect(() => assertConservation(s.runner.world)).not.toThrow(); }
    expect(s.runner.world).toEqual(ordinary);
  });
  it.each(stages)('CH-18: $id の禁止操作をUIに頼らず拒否する', stage => {
    const s = TrialSession.forStage(stage), initial = s.runner.world.heights.slice();
    expect(s.begin({ x: 7.5, y: 7.5 }, stage.strokeMode === 'LOWER' ? 'RAISE' : 'LOWER')).toBe(false);
    expect(s.phase).toBe('READY'); expect(s.preview).toBeNull(); expect(s.runner.world.heights).toEqual(initial);
  });
  it('段階実行と高速連続実行で全ステップの浸水観測が一致する', () => {
    const step = TrialSession.forStage(stages[2]); for (let i = 0; i < 160; i++) step.step();
    const fast = complete(stages[2]); expect(step.record).toEqual(fast.record);
  });
  it('実行上限以降はPLAY・STEPで進まず、再実行した結果を汚染しない', () => {
    const s = complete(stages[0]), saved = structuredClone(s.record); s.play(); s.step(); s.advance(200);
    expect(s.runner.world.step).toBe(120); expect(s.record).toEqual(saved); expect(s.runner.playing).toBe(false);
  });
  it('ステージ固有のブラシ条件を実際の一筆へ反映する', () => {
    for (const stage of stages) {
      const s = TrialSession.forStage(stage), points = challengeSolutions[stage.id];
      s.begin(points[0], stage.strokeMode); for (const p of points.slice(1)) s.append(p); s.finish();
      expect(s.preview?.stroke).toMatchObject({ mode: stage.strokeMode, radius: stage.brushRadius, maxLength: stage.maxStrokeLength, heightDelta: stage.heightDelta });
    }
  });
});
