const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");
require("../training.js");

const { RunnerPhysics } = global.QWOPPhysics;
const { PHASES, classifyInput, pressedKeys } = global.QWOPTraining;
const step = (physics, milliseconds) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000 / 60) physics.step(1000 / 60);
};

assert.deepEqual(PHASES.map(phase => phase.name), ["Q + O", "Q", "W + P", "W"]);
assert.deepEqual(PHASES.map(phase => [phase.min, phase.max]), [[200, 450], [100, 350], [200, 450], [100, 350]]);
assert.deepEqual(PHASES.map(phase => phase.slow), [400, 280, 400, 280]);
assert.equal(classifyInput(["q", "o"], ["q", "o"]), "GOOD");
assert.equal(classifyInput(["q", "o"], ["q"]), "OK");
assert.equal(classifyInput(["q", "o"], ["w", "p"]), "MISS");
assert.deepEqual(pressedKeys({ q: true, w: false, o: true, p: false }), ["q", "o"]);

const physics = new RunnerPhysics();
physics.setBalanceScale(0.5);
physics.setAnkleScale(0);
physics.setDynamicFootFriction(true);
step(physics, 1000);
let diagnostics = physics.diagnostics();
assert.equal(diagnostics.experiments.balanceScale, 0.5);
assert.equal(diagnostics.experiments.ankleScale, 0);
assert.equal(diagnostics.experiments.dynamicFootFriction, true);
assert.equal(typeof diagnostics.feet.left.contact, "boolean");
assert.equal(typeof diagnostics.feet.right.contact, "boolean");

physics.resetParameters();
diagnostics = physics.diagnostics();
assert.equal(diagnostics.experiments.balanceScale, 1);
assert.equal(diagnostics.experiments.ankleScale, 1);
assert.equal(diagnostics.experiments.dynamicFootFriction, false);

const demoPhysics = new RunnerPhysics();
step(demoPhysics, 1500);
const startX = demoPhysics.bodies.torso.position.x;
for (let cycle = 0; cycle < 3; cycle += 1) {
  for (const phase of PHASES) {
    Object.keys(demoPhysics.inputState).forEach(key => demoPhysics.setInput(key, false));
    phase.keys.forEach(key => demoPhysics.setInput(key, true));
    step(demoPhysics, phase.slow);
  }
}
assert.ok(demoPhysics.bodies.torso.position.x > startX, "three-cycle slow training demo moves forward");

console.log("Phase 1C training tests passed");
