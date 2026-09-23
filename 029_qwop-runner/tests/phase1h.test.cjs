const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const {
  RunnerPhysics, ARM_FORM_POSES, signedElbowAngle, elbowBendDirection,
  DEMO_FORWARD_SEQUENCE, DEG, SCALE
} = global.QWOPPhysics;
const frame = 1000 / 60;
const step = (physics, frames) => {
  for (let index = 0; index < frames; index += 1) physics.step(frame);
};
const horizontalDistance = angle => Math.min(Math.abs(angle), Math.abs(180 - Math.abs(angle)));

assert.equal(signedElbowAngle(90 * DEG), 90);
assert.equal(signedElbowAngle(-90 * DEG), -90);
assert.equal(elbowBendDirection("left", -90, "FRONT"), "CORRECT");
assert.equal(elbowBendDirection("right", 35, "REAR"), "CORRECT");
assert.equal(elbowBendDirection("left", 90, "FRONT"), "WRONG");
assert.deepEqual(Object.keys(ARM_FORM_POSES), ["NEUTRAL", "LEFT_FRONT", "RIGHT_FRONT", "LEFT_EXTREME", "RIGHT_EXTREME"]);

const forms = {};
for (const pose of Object.keys(ARM_FORM_POSES)) {
  const physics = new RunnerPhysics();
  step(physics, 90);
  physics.setArmFormPose(pose);
  step(physics, 108);
  const arm = physics.diagnostics().armForm;
  forms[pose] = arm;
  assert.equal(arm.leftElbowDirection, "CORRECT", `${pose} left bend direction`);
  assert.equal(arm.rightElbowDirection, "CORRECT", `${pose} right bend direction`);
  assert(arm.points.left.shoulder && arm.points.left.elbow && arm.points.left.hand);
  assert(arm.points.right.shoulder && arm.points.right.elbow && arm.points.right.hand);
}
assert(horizontalDistance(forms.LEFT_FRONT.leftForearmScreen) >= 50, "left front forearm is steep, not horizontal");
assert(horizontalDistance(forms.RIGHT_FRONT.rightForearmScreen) >= 50, "right front forearm is steep, not horizontal");
assert(horizontalDistance(forms.LEFT_FRONT.rightForearmScreen) >= 35, "right rear forearm is visibly diagonal");
assert(horizontalDistance(forms.RIGHT_FRONT.leftForearmScreen) >= 35, "left rear forearm is visibly diagonal");

const drift = new RunnerPhysics();
const driftStart = drift.bodies.torso.position.x;
step(drift, 300);
const driftMeters = (drift.bodies.torso.position.x - driftStart) / SCALE;
assert(Math.abs(driftMeters) <= 0.05, `5 second drift ${driftMeters.toFixed(4)}m`);

const run = new RunnerPhysics();
run.setBalanceScale(0.60);
run.setArmSwingScale(0.70);
run.setArmAmplitude(35);
run.setHandFriction("normal");
step(run, 90);
const runStart = run.bodies.torso.position.x;
let fell = false;
for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    Object.keys(run.inputState).forEach(key => run.setInput(key, false));
    phase.keys.forEach(key => run.setInput(key, true));
    const frames = Math.round(phase.duration / frame);
    for (let index = 0; index < frames; index += 1) {
      run.step(frame);
      fell ||= run.diagnostics().posture === "DOWN";
    }
  }
}
const distanceMeters = (run.bodies.torso.position.x - runStart) / SCALE;
assert(distanceMeters >= 4.8, `recommended C advances at least 4.8m, got ${distanceMeters.toFixed(3)}m`);
assert.equal(fell, false);

const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
for (const marker of [
  "LEFT_EXTREME", "RIGHT_EXTREME", "ELBOW SIGNED", "DIRECTION",
  "UpperArmScreen", "drawJoint", "points.shoulder", "points.elbow", "points.hand",
  "LEFT_EXTREME", "RIGHT_EXTREME"
]) assert(gameSource.includes(marker), `game contains ${marker}`);
assert(!/Body\.setAngle/.test(gameSource), "form test never forces body angles");

console.log("Phase 1H arm forms", JSON.stringify(Object.fromEntries(Object.entries(forms).map(([pose, arm]) => [pose, {
  leftSigned: arm.leftElbowSigned, rightSigned: arm.rightElbowSigned,
  leftForearm: arm.leftForearmScreen, rightForearm: arm.rightForearmScreen
}]))));
console.log(`Phase 1H drift ${driftMeters.toFixed(4)}m; recommended C 12-cycle distance ${distanceMeters.toFixed(3)}m`);
console.log("Phase 1H signed-angle, visual-form, five-pose, and regression tests passed");
