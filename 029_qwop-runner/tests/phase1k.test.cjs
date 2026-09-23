const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const {
  RunnerPhysics, ELBOW_HUMAN_ANGLE, ELBOW_TRANSITION_HUMAN,
  ELBOW_ROLE_THRESHOLD, getBendDirection, getElbowTarget,
  normalizeAngle, DEMO_FORWARD_SEQUENCE, SCALE, DEG
} = global.QWOPPhysics;
const frame = 1000 / 60;
const step = (physics, frames, inspect) => {
  for (let index = 0; index < frames; index += 1) {
    physics.step(frame);
    if (inspect) inspect(physics.diagnostics());
  }
};
const setKeys = (physics, keys) => {
  Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
  keys.forEach(key => physics.setInput(key, true));
};

assert.deepEqual(ELBOW_HUMAN_ANGLE, { FRONT: 80, REAR: 95, NEUTRAL: 91 });
assert.equal(ELBOW_TRANSITION_HUMAN, 110);
assert.equal(ELBOW_ROLE_THRESHOLD, 0.12);
assert.equal(getBendDirection("left", "NEUTRAL"), -1);
assert.equal(getBendDirection("right", "NEUTRAL"), 1);
assert.equal(getBendDirection("left", "FRONT"), -1);
assert.equal(getBendDirection("right", "FRONT"), -1);
assert.equal(getBendDirection("left", "REAR"), 1);
assert.equal(getBendDirection("right", "REAR"), 1);
for (const side of ["left", "right"]) {
  for (const role of ["NEUTRAL", "FRONT", "REAR"]) {
    const target = getElbowTarget(side, role);
    assert.equal(target.humanAngle, ELBOW_HUMAN_ANGLE[role]);
    assert.equal(Math.sign(target.physicsTargetAngle), getBendDirection(side, role));
  }
}
assert(Math.abs(normalizeAngle(7 * Math.PI) - Math.PI) < 1e-9, "angle normalization is shared and stable");

const matrixStates = [
  ["NONE", []], ["Q", ["q"]], ["W", ["w"]], ["O", ["o"]], ["P", ["p"]],
  ["Q+O", ["q", "o"]], ["Q+P", ["q", "p"]], ["W+O", ["w", "o"]], ["W+P", ["w", "p"]]
];
const matrix = [];
for (const [name, keys] of matrixStates) {
  const physics = new RunnerPhysics();
  setKeys(physics, keys);
  step(physics, 72);
  const arm = physics.diagnostics().armForm;
  matrix.push({
    name,
    left: { role: arm.leftRole, human: arm.leftElbowHuman, bend: arm.leftExpectedSign, direction: arm.leftElbowDirection },
    right: { role: arm.rightRole, human: arm.rightElbowHuman, bend: arm.rightExpectedSign, direction: arm.rightElbowDirection }
  });
  assert.equal(arm.leftElbowDirection, "CORRECT", `${name}: left direction`);
  assert.equal(arm.rightElbowDirection, "CORRECT", `${name}: right direction`);
  assert(arm.leftElbowHuman >= 70 && arm.leftElbowHuman <= 120, `${name}: left human angle remains natural`);
  assert(arm.rightElbowHuman >= 70 && arm.rightElbowHuman <= 120, `${name}: right human angle remains natural`);
}

const neutral = new RunnerPhysics();
step(neutral, 180);
const neutralArm = neutral.diagnostics().armForm;
assert.equal(neutralArm.leftRole, "NEUTRAL");
assert.equal(neutralArm.rightRole, "NEUTRAL");
assert.equal(neutralArm.leftElbowDirection, "CORRECT");
assert.equal(neutralArm.rightElbowDirection, "CORRECT");

const transition = new RunnerPhysics();
step(transition, 60);
transition.setArmFormPose("LEFT_FRONT");
step(transition, 150);
transition.setArmFormPose("RIGHT_FRONT");
let minTargetMagnitude = Infinity;
let maxHumanTarget = -Infinity;
let maxGap = 0;
step(transition, 180, data => {
  const arm = data.armForm;
  minTargetMagnitude = Math.min(minTargetMagnitude, Math.abs(arm.leftElbowPhysicsTarget), Math.abs(arm.rightElbowPhysicsTarget));
  maxHumanTarget = Math.max(maxHumanTarget, arm.leftElbowHumanTarget, arm.rightElbowHumanTarget);
  for (const side of ["left", "right"]) {
    for (const joint of ["shoulder", "elbow", "wrist"]) maxGap = Math.max(maxGap, arm.connections[side].gaps[joint]);
  }
});
const transitioned = transition.diagnostics().armForm;
assert.equal(transitioned.leftRole, "REAR");
assert.equal(transitioned.rightRole, "FRONT");
assert.equal(transitioned.leftElbowDirection, "CORRECT");
assert.equal(transitioned.rightElbowDirection, "CORRECT");
assert(minTargetMagnitude >= 70, "signed target never interpolates through the extended zero target");
assert(maxHumanTarget <= ELBOW_TRANSITION_HUMAN, "transition stays inside the 110-degree neutral waypoint");
assert(maxGap <= 2, `connection gap remains <= 2 px (max ${maxGap})`);

const hysteresis = new RunnerPhysics();
hysteresis.inputState.q = true;
hysteresis.armRoles = { left: "FRONT", right: "REAR" };
assert.deepEqual(hysteresis.requestedArmRoles(ELBOW_ROLE_THRESHOLD * 0.5), { left: "FRONT", right: "REAR" });
assert.deepEqual(hysteresis.requestedArmRoles(-ELBOW_ROLE_THRESHOLD * 0.5), { left: "FRONT", right: "REAR" });

const drift = new RunnerPhysics();
const driftStart = drift.bodies.torso.position.x;
step(drift, 300);
const driftMeters = (drift.bodies.torso.position.x - driftStart) / SCALE;
assert(Math.abs(driftMeters) <= 0.05);

const run = new RunnerPhysics();
run.setBalanceScale(0.60);
run.setArmSwingScale(0.70);
run.setArmAmplitude(35);
run.setHandFriction("normal");
step(run, 90);
const runStart = run.bodies.torso.position.x;
const demoPhases = [];
for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    setKeys(run, phase.keys);
    step(run, Math.round(phase.duration / frame));
    if (cycle === 11) {
      const arm = run.diagnostics().armForm;
      demoPhases.push({ name: phase.name, left: arm.leftElbowDirection, right: arm.rightElbowDirection });
      assert.equal(arm.leftElbowDirection, "CORRECT", `${phase.name}: left demo direction`);
      assert.equal(arm.rightElbowDirection, "CORRECT", `${phase.name}: right demo direction`);
    }
  }
}
const distanceMeters = (run.bodies.torso.position.x - runStart) / SCALE;
assert(distanceMeters >= 4.8);

console.log("Phase 1K matrix", JSON.stringify(matrix));
console.log("Phase 1K demo phases", JSON.stringify(demoPhases));
console.log(`Phase 1K transition min target ${minTargetMagnitude.toFixed(1)}deg; max waypoint ${maxHumanTarget.toFixed(1)}deg; max gap ${maxGap.toFixed(3)}px`);
console.log(`Phase 1K neutral 3s L ${neutralArm.leftElbowHuman.toFixed(1)}deg / R ${neutralArm.rightElbowHuman.toFixed(1)}deg; drift ${driftMeters.toFixed(4)}m; distance ${distanceMeters.toFixed(3)}m`);
console.log("Phase 1K elbow target/state transition tests passed");
