const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, LIMITS } = global.QWOPPhysics;
const step = (physics, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) physics.step(1000 / 60);
};
const snapshot = physics => physics.diagnostics();

function settledRunner() {
  const physics = new RunnerPhysics();
  step(physics, 2);
  return physics;
}

{
  const physics = new RunnerPhysics();
  Object.values(physics.bodies).forEach(body => {
    assert.equal(body.velocity.x, 0);
    assert.equal(body.velocity.y, 0);
    assert.equal(body.angularVelocity, 0);
  });
  step(physics, 10);
  const data = snapshot(physics);
  assert.ok(Math.abs(data.control.torso.current) < 0.2, "torso stays upright for 10 seconds");
  assert.ok(data.position.y < 340, "runner does not collapse into a pile");
  assert.equal(physics.distance, 0, "idle distance remains in the zero dead zone");
}

const cases = {
  q(data, before) {
    assert.ok(data.control.rightHip.current < before.control.rightHip.current - 0.35);
    assert.ok(data.control.leftHip.current > before.control.leftHip.current + 0.35);
  },
  w(data, before) {
    assert.ok(data.control.rightHip.current > before.control.rightHip.current + 0.3);
    assert.ok(data.control.leftHip.current < before.control.leftHip.current - 0.3);
  },
  o(data) {
    assert.ok(data.control.rightKnee.current > data.control.leftKnee.current + 0.6);
  },
  p(data) {
    assert.ok(data.control.leftKnee.current > data.control.rightKnee.current + 0.6);
  }
};

for (const [key, verify] of Object.entries(cases)) {
  const physics = settledRunner();
  const before = snapshot(physics);
  physics.setInput(key, true);
  step(physics, 0.75);
  const data = snapshot(physics);
  assert.equal(data.inputState[key], true);
  verify(data, before);
  assert.ok(Object.values(data.control).some(joint => Math.abs(joint.torque) > 0.001));
  assert.ok(data.control.rightKnee.current >= LIMITS.knee[0] - 0.2);
  assert.ok(data.control.leftKnee.current >= LIMITS.knee[0] - 0.2);
}

{
  const physics = settledRunner();
  physics.setInput("q", true);
  physics.setInput("o", true);
  step(physics, 0.75);
  const data = snapshot(physics);
  assert.equal(data.inputState.q, true);
  assert.equal(data.inputState.o, true);
  assert.ok(data.control.rightHip.target < 0);
  assert.ok(data.control.leftHip.target > 0);
  assert.ok(data.control.rightKnee.target > data.control.leftKnee.target);
  physics.reset();
  assert.deepEqual(physics.inputState, { q: false, w: false, o: false, p: false });
  Object.values(physics.bodies).forEach(body => assert.equal(body.angularVelocity, 0));
}

console.log("Phase 1A physics tests passed");
