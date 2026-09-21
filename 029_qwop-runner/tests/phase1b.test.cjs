const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, DEMO_FORWARD_SEQUENCE } = global.QWOPPhysics;
const step = (physics, milliseconds) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000 / 60) physics.step(1000 / 60);
};

const physics = new RunnerPhysics();
let diagnostic = physics.diagnostics();
assert.equal(diagnostic.neck.connected, true, "neck is connected after reset");
assert.ok(diagnostic.headPosition.y < diagnostic.position.y, "head begins above torso");

step(physics, 2000);
const startX = physics.bodies.torso.position.x;
for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
    phase.keys.forEach(key => physics.setInput(key, true));
    step(physics, phase.duration);
  }
}

diagnostic = physics.diagnostics();
assert.ok(physics.bodies.torso.position.x - startX > 300, "forward demo advances in positive world X");
assert.ok(diagnostic.position.y < 350, "forward demo does not collapse into a pile");
assert.equal(diagnostic.neck.connected, true, "neck stays visually connected during demo");
assert.ok(diagnostic.headPosition.y < diagnostic.position.y, "head remains above torso during demo");
assert.deepEqual(DEMO_FORWARD_SEQUENCE.map(phase => phase.name), ["Q + O", "Q", "W + P", "W"]);

console.log("Phase 1B physics tests passed");
