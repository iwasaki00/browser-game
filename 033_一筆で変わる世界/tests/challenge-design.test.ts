import { expect, it } from 'vitest';
import { TrialSession } from '../src/core/trial';
import { stages } from '../src/challenge/stages';
import { challengeSolutions } from './fixtures/challenge-solutions';
import { assertConservation } from '../src/core/world';
import { createWorld } from '../src/core/world';
import { stageWorld } from '../src/challenge/stage';
import { applyStroke, buildStroke } from '../src/core/stroke';
import { diagnoseMirroring } from '../src/core/diagnostics';

export function runChallenge(stageIndex: number, edited: boolean) {
  const stage = stages[stageIndex], session = TrialSession.forStage(stage);
  if (edited) {
    const points = challengeSolutions[stage.id];
    session.begin(points[0], stage.strokeMode);
    for (const p of points.slice(1)) session.append(p);
    session.finish(); expect(session.execute()).toBe(true);
  } else session.play();
  session.runner.setSpeed(60);
  while (session.runner.playing) session.advance(200);
  assertConservation(session.runner.world);
  return session;
}
it.each(stages.map((stage, i) => [stage.id, i] as const))('CH-11〜13 / CH-15: %s は基準失敗・保存した一筆で成功', (_, i) => {
  const baseline = runChallenge(i, false), solution = runChallenge(i, true);
  console.info('STAGE COMPARISON', JSON.stringify({ stage: stages[i].id, baseline: baseline.goalResult, solution: solution.goalResult }));
  expect(baseline.goalResult?.status).toBe('FAILURE');
  expect(solution.goalResult?.status).toBe('SUCCESS');
});
it.each(stages.map((stage, i) => [stage.id, i] as const))('CH-14: %s の成功ストロークは全セルとGoalResultまで再現する', (_, i) => {
  const first = runChallenge(i, true), second = runChallenge(i, true);
  expect(first.record).toEqual(second.record);
  expect(first.runner.world).toEqual(second.runner.world);
});
it('Stage 02はどちらか片方の尾根だけ削っても給水目標を達成しない', () => {
  for (const point of [{ x: 8.5, y: 6.5 }, { x: 11.5, y: 10.5 }]) {
    const s = TrialSession.forStage(stages[1]); s.begin(point, 'LOWER'); s.finish(); expect(s.execute()).toBe(true);
    s.runner.setSpeed(60); while (s.runner.playing) s.advance(200);
    expect(s.goalResult?.status).toBe('FAILURE');
  }
});
it('今回の偶数幅ステージは基準・成功地形の最終水量が左右・上下反転で一致する', () => {
  const diagnostics = [];
  for (const stage of stages) {
    const initial = stageWorld(stage), edited = createWorld(initial);
    const stroke = buildStroke(challengeSolutions[stage.id], edited.width, edited.height,
      { mode: stage.strokeMode, maxLength: stage.maxStrokeLength, radius: stage.brushRadius, heightDelta: stage.heightDelta }).stroke;
    applyStroke(edited, stroke);
    for (const [caseName, definition] of [['baseline', initial], ['solution', { ...initial, heights: edited.heights }]] as const) {
      for (const axis of ['X', 'Y'] as const) {
        const metric = diagnoseMirroring(definition, stage.maxSimulationSteps, axis);
        diagnostics.push({ stage: stage.id, case: caseName, axis, ...metric });
        expect(metric.l1).toBe(0);
      }
    }
  }
  console.info('CHALLENGE MIRROR DIAGNOSTICS', JSON.stringify(diagnostics));
});
