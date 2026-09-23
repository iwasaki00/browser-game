const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const {
  RunnerPhysics, ARM_SIDE_BEND_SIGN, naturalElbowBendSign,
  DEMO_FORWARD_SEQUENCE, SCALE
} = global.QWOPPhysics;
const frame = 1000 / 60;
const step = (physics, frames) => {
  for (let index = 0; index < frames; index += 1) physics.step(frame);
};
const measure = pose => {
  const physics = new RunnerPhysics();
  step(physics, 90);
  physics.setArmFormPose(pose);
  step(physics, 108);
  return physics.diagnostics().armForm;
};

assert.deepEqual(ARM_SIDE_BEND_SIGN, { left: -1, right: 1 });
assert.equal(naturalElbowBendSign("left", "FRONT"), -1);
assert.equal(naturalElbowBendSign("left", "REAR"), 1);
assert.equal(naturalElbowBendSign("right", "FRONT"), -1);
assert.equal(naturalElbowBendSign("right", "REAR"), 1);
assert.equal(naturalElbowBendSign("left", "NEUTRAL"), -1);
assert.equal(naturalElbowBendSign("right", "NEUTRAL"), 1);

const leftFront = measure("LEFT_FRONT");
const rightFront = measure("RIGHT_FRONT");
const relativeHand = (form, side) => ({
  x: form.points[side].hand.x - form.points[side].elbow.x,
  y: form.points[side].hand.y - form.points[side].elbow.y
});
const lf = relativeHand(leftFront, "left");
const rr = relativeHand(leftFront, "right");
const rf = relativeHand(rightFront, "right");
const lr = relativeHand(rightFront, "left");

for (const [label, vector] of [["LEFT FRONT", lf], ["RIGHT FRONT", rf]]) {
  assert(vector.x > 5, `${label} hand is forward of elbow`);
  assert(vector.y < -5, `${label} hand is above elbow`);
}
for (const [label, vector] of [["LEFT REAR", lr], ["RIGHT REAR", rr]]) {
  assert(vector.x < -5, `${label} hand is behind elbow`);
  assert(Math.abs(vector.y) < 15, `${label} forearm remains near a natural rear-running diagonal`);
}
assert.equal(leftFront.leftElbowDirection, "CORRECT");
assert.equal(leftFront.rightElbowDirection, "CORRECT");
assert.equal(rightFront.leftElbowDirection, "CORRECT");
assert.equal(rightFront.rightElbowDirection, "CORRECT");
assert(Math.sign(leftFront.leftAnatomicalSigned) === -Math.sign(rightFront.rightAnatomicalSigned), "front anatomical signed angles mirror");
assert(Math.sign(rightFront.leftAnatomicalSigned) === -Math.sign(leftFront.rightAnatomicalSigned), "rear anatomical signed angles mirror");
assert(Math.abs(Math.abs(leftFront.leftForearmScreen) - Math.abs(rightFront.rightForearmScreen)) < 5, "front forearm screen angles mirror");
assert(Math.abs(leftFront.leftElbowHuman - rightFront.rightElbowHuman) < 5, "front human elbow angles mirror");
assert(Math.abs(rightFront.leftElbowHuman - leftFront.rightElbowHuman) < 5, "rear human elbow angles mirror");

for (const form of [leftFront, rightFront]) {
  for (const side of ["left", "right"]) {
    assert(form.connections[side].gaps.shoulder <= 2);
    assert(form.connections[side].gaps.elbow <= 2);
    assert(form.connections[side].gaps.wrist <= 2);
  }
}

const drift = new RunnerPhysics();
const driftStart = drift.bodies.torso.position.x;
step(drift, 300);
const driftMeters = (drift.bodies.torso.position.x - driftStart) / SCALE;
assert(Math.abs(driftMeters) <= 0.05);

const run = new RunnerPhysics();
run.setBalanceScale(0.60);
run.setArmSwingScale(0.70);
step(run, 90);
const runStart = run.bodies.torso.position.x;
for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    Object.keys(run.inputState).forEach(key => run.setInput(key, false));
    phase.keys.forEach(key => run.setInput(key, true));
    step(run, Math.round(phase.duration / frame));
  }
}
const distanceMeters = (run.bodies.torso.position.x - runStart) / SCALE;
assert(distanceMeters >= 4.8);

console.log("Phase 1J natural arm vectors", JSON.stringify({ leftFront: lf, leftRear: lr, rightFront: rf, rightRear: rr }));
console.log(`Phase 1J drift ${driftMeters.toFixed(4)}m; recommended C 12-cycle distance ${distanceMeters.toFixed(3)}m`);
console.log("Phase 1J side-normalized bend, mirror, connection, and regression tests passed");
