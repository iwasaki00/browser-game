const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, getBodyEndpoint, pointGap, DEMO_FORWARD_SEQUENCE, SCALE } = global.QWOPPhysics;
const frame = 1000 / 60;
const maxGap = {
  left: { shoulder: 0, elbow: 0, wrist: 0 },
  right: { shoulder: 0, elbow: 0, wrist: 0 }
};
const sample = physics => {
  const connections = physics.diagnostics().armForm.connections;
  for (const side of ["left", "right"]) {
    for (const joint of ["shoulder", "elbow", "wrist"]) {
      maxGap[side][joint] = Math.max(maxGap[side][joint], connections[side].gaps[joint]);
    }
  }
};
const step = (physics, frames, collect = false) => {
  for (let index = 0; index < frames; index += 1) {
    physics.step(frame);
    if (collect) sample(physics);
  }
};

const physics = new RunnerPhysics();
for (const side of ["left", "right"]) {
  assert.equal(physics.armConstraints[side].shoulder.length, 0);
  assert.equal(physics.armConstraints[side].elbow.length, 0);
  assert.equal(physics.armConstraints[side].wrist.length, 0);
}
const leftUpperEndpoint = getBodyEndpoint(physics.bodies.leftUpperArm, { x: 0, y: 27 });
assert(pointGap(leftUpperEndpoint, { x: physics.startX - 20 - Math.sin(10 * Math.PI / 180) * 54, y: 248 + Math.cos(10 * Math.PI / 180) * 54 }) < 1e-8);

step(physics, 90, true);
for (const pose of ["NEUTRAL", "LEFT_FRONT", "RIGHT_FRONT", "LEFT_EXTREME", "RIGHT_EXTREME"]) {
  physics.setArmFormPose(pose);
  step(physics, 108, true);
}
physics.setArmFormPose(null);
physics.applyFallTest(1);
step(physics, 360, true);
for (const side of ["left", "right"]) {
  assert(maxGap[side].shoulder <= 2, `${side} shoulder max gap ${maxGap[side].shoulder.toFixed(3)}px`);
  assert(maxGap[side].elbow <= 2, `${side} elbow max gap ${maxGap[side].elbow.toFixed(3)}px`);
  assert(maxGap[side].wrist <= 2, `${side} wrist max gap ${maxGap[side].wrist.toFixed(3)}px`);
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
assert(distanceMeters >= 4.8, `recommended C distance ${distanceMeters.toFixed(3)}m`);

const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
for (const marker of [
  "JOINT DOTS", "ARM SKELETON", "ARM CONNECTION TEST", "upperToA",
  "aToB", "bToForearm", "ARM MAX GAP"
]) assert(gameSource.includes(marker), `game contains ${marker}`);

console.log("Phase 1I maximum connection gaps", JSON.stringify(maxGap));
console.log(`Phase 1I drift ${driftMeters.toFixed(4)}m; recommended C 12-cycle distance ${distanceMeters.toFixed(3)}m`);
console.log("Phase 1I physical endpoint, falling connection, and regression tests passed");
