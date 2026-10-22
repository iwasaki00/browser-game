import test from "node:test";
import assert from "node:assert/strict";
import {
  createSimulation,
  gravitationalAcceleration,
  segmentCircleHit,
  simulateTrajectory,
  stepSimulation,
} from "../js/physics.js";
import { getStage } from "../js/stages.js";

const physics = {
  gravitationalConstant: 120,
  softening: 10,
  fixedTimeStep: 1 / 120,
  maxFlightTime: 12,
  boundsMargin: 36,
};

test("惑星への接近でロケットの軌道が惑星側へ曲がる", () => {
  const stage = getStage();
  const initial = createSimulation(stage, { angleDeg: 0, speed: 100 });
  const next = stepSimulation(initial, .1, physics);
  assert.ok(next.rocket.velocity.y < 0, "上側にある惑星へ速度が曲がる");
});

test("距離の二乗に応じて引力が弱くなる", () => {
  const planets = [{ x: 0, y: 0, radius: 1, mass: 100 }];
  const near = gravitationalAcceleration({ x: 20, y: 0 }, planets, physics);
  const far = gravitationalAcceleration({ x: 40, y: 0 }, planets, physics);
  assert.ok(Math.abs(near.x) > Math.abs(far.x));
  assert.ok(Math.abs(near.x / far.x - 4) < 1e-10);
});

test("惑星の質量を大きくすると引力が比例して強くなる", () => {
  const small = gravitationalAcceleration({ x: 50, y: 0 }, [{ x: 0, y: 0, radius: 1, mass: 100 }], physics);
  const large = gravitationalAcceleration({ x: 50, y: 0 }, [{ x: 0, y: 0, radius: 1, mass: 300 }], physics);
  assert.ok(Math.abs(large.x / small.x - 3) < 1e-10);
});

test("高速移動でも線分と惑星の衝突を検出する", () => {
  const hit = segmentCircleHit({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 0, radius: 10 });
  assert.ok(hit !== null && hit > 0 && hit < 1);
});

test("高速で惑星を横切る場合も失敗判定する", () => {
  const state = {
    status: "flying",
    elapsed: 0,
    rocket: { radius: 2, position: { x: 0, y: 50 }, velocity: { x: 1000, y: 0 } },
    planets: [{ id: "planet", x: 50, y: 50, radius: 8, mass: 0 }],
    goal: { id: "goal", x: 180, y: 50, radius: 5 },
    world: { width: 200, height: 100 },
  };
  assert.equal(stepSimulation(state, .1, physics).status, "crashed");
});

test("高速移動でもゴール通過をクリア判定する", () => {
  const state = {
    status: "flying",
    elapsed: 0,
    rocket: { radius: 2, position: { x: 0, y: 50 }, velocity: { x: 1000, y: 0 } },
    planets: [],
    goal: { id: "goal", x: 50, y: 50, radius: 5 },
    world: { width: 200, height: 100 },
  };
  assert.equal(stepSimulation(state, .1, physics).status, "cleared");
});

test("同じ初期条件では同じ軌道になる", () => {
  const stage = getStage();
  const first = simulateTrajectory(stage, {}, physics);
  const second = simulateTrajectory(stage, {}, physics);
  assert.deepEqual(first, second);
});

test("新しいシミュレーション作成で初期状態に戻る", () => {
  const stage = getStage();
  const initial = createSimulation(stage);
  const advanced = stepSimulation(initial, .5, physics);
  const reset = createSimulation(stage);
  assert.notDeepEqual(advanced.rocket.position, reset.rocket.position);
  assert.deepEqual(reset.rocket.position, stage.launch.position);
  assert.equal(reset.elapsed, 0);
  assert.equal(reset.status, "flying");
});

test("ステージは375px基準の縦画面内に配置される", () => {
  const stage = getStage();
  assert.equal(stage.world.width, 375);
  assert.ok(stage.world.height > stage.world.width);
  for (const item of [...stage.planets, stage.goal, stage.launch.position]) {
    assert.ok(item.x >= 0 && item.x <= stage.world.width);
    assert.ok(item.y >= 0 && item.y <= stage.world.height);
  }
});
