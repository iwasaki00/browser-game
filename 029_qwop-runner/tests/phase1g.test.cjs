const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const {
  RunnerPhysics, DEFAULTS, ARM_FORM_POSES, humanElbowAngle,
  humanAngleToPhysicsTarget, DEMO_FORWARD_SEQUENCE, DEG, SCALE
} = global.QWOPPhysics;
const frame = 1000 / 60;
const step = (physics, frames, sample) => {
  for (let i = 0; i < frames; i += 1) {
    physics.step(frame);
    if (sample) sample(physics.diagnostics());
  }
};

assert.equal(humanElbowAngle(0), 180, "straight physical elbow is human 180 degrees");
assert.equal(humanElbowAngle(90 * DEG), 90, "right-angle physical elbow is human 90 degrees");
assert(Math.abs(humanAngleToPhysicsTarget(80, 1) / DEG - 100) < 1e-9);
assert(Math.abs(humanAngleToPhysicsTarget(95, -1) / DEG + 85) < 1e-9);
assert.deepEqual(ARM_FORM_POSES.NEUTRAL, {
  leftShoulder: 6, rightShoulder: -6,
  leftElbowHuman: 125, rightElbowHuman: 150,
  leftBend: 1, rightBend: -1
});

const poseResults = {};
for (const pose of ["NEUTRAL", "LEFT_FRONT", "RIGHT_FRONT"]) {
  const physics = new RunnerPhysics();
  step(physics, 90);
  physics.setArmFormPose(pose);
  step(physics, 108);
  const data = physics.diagnostics();
  poseResults[pose] = {
    leftShoulder: data.armForm.leftShoulderHuman,
    rightShoulder: data.armForm.rightShoulderHuman,
    leftElbow: data.armForm.leftElbowHuman,
    rightElbow: data.armForm.rightElbowHuman,
    leftForearm: data.armForm.leftForearmScreen,
    rightForearm: data.armForm.rightForearmScreen,
    leftHandY: physics.bodies.leftHand.position.y,
    rightHandY: physics.bodies.rightHand.position.y
  };
  assert.equal(data.armForm.pose, pose);
  assert.equal(data.posture, "STABLE", `${pose} does not destabilize the runner`);
}

assert.equal(new RunnerPhysics().diagnostics().armForm.pose, "RUNNING");
assert(poseResults.LEFT_FRONT.leftShoulder > 20, "left-front shoulder points forward");
assert(poseResults.RIGHT_FRONT.rightShoulder > 20, "right-front shoulder points forward");
assert(poseResults.LEFT_FRONT.leftElbow >= 55 && poseResults.LEFT_FRONT.leftElbow <= 90, "left-front elbow remains in the Phase 1G/1H human range");
assert(poseResults.RIGHT_FRONT.rightElbow >= 55 && poseResults.RIGHT_FRONT.rightElbow <= 90, "right-front elbow remains in the Phase 1G/1H human range");
const horizontalDistance = angle => Math.min(Math.abs(angle), Math.abs(180 - Math.abs(angle)));
assert(horizontalDistance(poseResults.LEFT_FRONT.leftForearm) > 18, "left-front forearm is not horizontal");
assert(horizontalDistance(poseResults.RIGHT_FRONT.rightForearm) > 18, "right-front forearm is not horizontal");

const physics = new RunnerPhysics();
physics.setBalanceScale(0.60);
physics.setArmSwingScale(0.70);
physics.setArmAmplitude(35);
physics.setHandFriction("normal");
step(physics, 90);
const startX = physics.bodies.torso.position.x;
let fell = false;
for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
    phase.keys.forEach(key => physics.setInput(key, true));
    step(physics, Math.round(phase.duration / frame), data => { fell ||= data.posture === "DOWN"; });
  }
}
const distanceMeters = (physics.bodies.torso.position.x - startX) / SCALE;
assert(distanceMeters >= 4.8, `recommended preset advances at least 4.8m, got ${distanceMeters.toFixed(3)}m`);
assert.equal(fell, false, "recommended preset does not fall in 12 cycles");

assert.deepEqual(
  { gravity: DEFAULTS.gravity, groundFriction: DEFAULTS.groundFriction, footFriction: DEFAULTS.footFriction, hipKp: DEFAULTS.hipKp, kneeKp: DEFAULTS.kneeKp, ankleKp: DEFAULTS.ankleKp },
  { gravity: 0.72, groundFriction: 1.05, footFriction: 1.35, hipKp: 4, kneeKp: 6, ankleKp: 4 }
);

const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
for (const marker of ["ARM FORM TEST", "NEUTRAL", "LEFT_FRONT", "RIGHT_FRONT", "SHOULDER HUMAN", "ELBOW HUMAN", "FOREARM SCREEN", "FRONT ${data.armForm.frontArm", "drawLeg(backLeg)", "drawLeg(frontLeg)"]) {
  assert(gameSource.includes(marker), `game contains ${marker}`);
}
assert(!/Body\.setAngle/.test(gameSource), "ARM FORM TEST does not force body angles");

console.log("Phase 1G arm pose diagnostics", JSON.stringify(poseResults));
console.log(`Phase 1G recommended 12-cycle distance ${distanceMeters.toFixed(3)}m`);
console.log("Phase 1G human-angle, form-test, rendering-order, and regression tests passed");
