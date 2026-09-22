const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, DEFAULTS, DEMO_FORWARD_SEQUENCE, FOOT_ANKLE_X, FOOT_SUPPORT_X, SCALE } = global.QWOPPhysics;
const frame = 1000 / 60;
const step = (physics, frames, sample) => {
  for (let i = 0; i < frames; i += 1) {
    physics.step(frame);
    if (sample) sample(physics.diagnostics(), i);
  }
};

function driftRun(balance, arms) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balance);
  physics.setArmSwingScale(arms);
  const startX = physics.bodies.torso.position.x;
  let velocitySum = 0;
  let maxVelocity = 0;
  let leftGround = 0;
  let rightGround = 0;
  step(physics, 300, data => {
    velocitySum += data.velocity.x;
    maxVelocity = Math.max(maxVelocity, Math.abs(data.velocity.x));
    leftGround += data.feet.left.contact ? 1 / 60 : 0;
    rightGround += data.feet.right.contact ? 1 / 60 : 0;
  });
  return {
    startX: startX / SCALE,
    endX: physics.bodies.torso.position.x / SCALE,
    driftMeters: (physics.bodies.torso.position.x - startX) / SCALE,
    averageVelocityMetersPerSecond: velocitySum / 300 / SCALE,
    maxVelocityMetersPerSecond: maxVelocity / SCALE,
    leftGroundSeconds: leftGround,
    rightGroundSeconds: rightGround
  };
}

function fallRun(balance, arms, direction = 1) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balance);
  physics.setArmSwingScale(arms);
  step(physics, 90);
  physics.applyFallTest(direction);
  let fallingAt = null;
  let downAt = null;
  let firstContact = "none";
  let leftHandSeconds = 0;
  let rightHandSeconds = 0;
  let fallingArmFactor = null;
  for (let i = 0; i < 360; i += 1) {
    physics.step(frame);
    const data = physics.diagnostics();
    if (data.posture === "FALLING" && fallingAt === null) {
      fallingAt = i / 60;
      fallingArmFactor = data.experiments.armControlFactor;
    }
    if (data.posture === "DOWN" && downAt === null) downAt = i / 60;
    leftHandSeconds += data.hands.left.contact ? 1 / 60 : 0;
    rightHandSeconds += data.hands.right.contact ? 1 / 60 : 0;
    if (firstContact === "none") {
      const first = Object.entries(data.groundContacts).find(([, contact]) => contact);
      if (first) firstContact = first[0];
    }
    if (downAt !== null && i / 60 >= downAt + 1) break;
  }
  return { physics, fallingAt, downAt, firstContact, leftHandSeconds, rightHandSeconds, fallingArmFactor };
}

function demoRun(balance, arms) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balance);
  physics.setArmSwingScale(arms);
  step(physics, 90);
  const startX = physics.bodies.torso.position.x;
  let fell = false;
  let handTouched = false;
  let velocitySum = 0;
  let angleSum = 0;
  let maxAngle = 0;
  let samples = 0;
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (const phase of DEMO_FORWARD_SEQUENCE) {
      Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
      phase.keys.forEach(key => physics.setInput(key, true));
      step(physics, Math.round(phase.duration / frame), data => {
        fell ||= data.posture === "DOWN";
        handTouched ||= data.hands.left.contact || data.hands.right.contact;
        velocitySum += data.velocity.x / SCALE;
        const angle = Math.abs(data.control.torso.current) * 180 / Math.PI;
        angleSum += angle;
        maxAngle = Math.max(maxAngle, angle);
        samples += 1;
      });
    }
  }
  Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
  return {
    distanceMeters: (physics.bodies.torso.position.x - startX) / SCALE,
    averageVelocityMetersPerSecond: velocitySum / samples * 60,
    meanTorsoAngleDegrees: angleSum / samples,
    maxTorsoAngleDegrees: maxAngle,
    fell,
    handTouched
  };
}

assert.equal(FOOT_ANKLE_X, 2, "mechanical ankle is centered instead of toe-biased");
assert.equal(FOOT_SUPPORT_X, -18.27, "heel-side center of pressure is explicit and frozen");
assert.deepEqual(
  { gravity: DEFAULTS.gravity, groundFriction: DEFAULTS.groundFriction, footFriction: DEFAULTS.footFriction },
  { gravity: 0.72, groundFriction: 1.05, footFriction: 1.35 }
);

const presets = {
  A: { balance: 1, arms: 1 },
  B: { balance: 0.75, arms: 0.70 },
  C: { balance: 0.60, arms: 0.70 },
  D: { balance: 0.50, arms: 0.70 }
};
const comparison = {};
for (const [name, preset] of Object.entries(presets)) {
  const drift = driftRun(preset.balance, preset.arms);
  const demo = demoRun(preset.balance, preset.arms);
  const fall = fallRun(preset.balance, preset.arms, name.charCodeAt(0) % 2 ? -1 : 1);
  comparison[name] = {
    driftMeters: drift.driftMeters,
    demoDistanceMeters: demo.distanceMeters,
    averageVelocityMetersPerSecond: demo.averageVelocityMetersPerSecond,
    meanTorsoAngleDegrees: demo.meanTorsoAngleDegrees,
    maxTorsoAngleDegrees: demo.maxTorsoAngleDegrees,
    demoFell: demo.fell,
    fallSeconds: fall.downAt,
    handTouched: fall.leftHandSeconds + fall.rightHandSeconds > 0,
    firstContact: fall.firstContact
  };
  assert(Math.abs(drift.driftMeters) <= 0.05, `${name} idle drift stays within +/-0.05 m`);
  assert(drift.leftGroundSeconds > 4.5 && drift.rightGroundSeconds > 4.5, `${name} records both foot contacts`);
  assert(demo.distanceMeters > 1, `${name} forward demo still advances`);
  assert.equal(demo.fell, false, `${name} demo does not fall during 12 cycles`);
  assert(fall.fallingAt !== null && fall.fallingAt < 2, `${name} reaches FALLING from physical force`);
  assert(fall.downAt !== null && fall.downAt < 3, `${name} reaches DOWN from physical force`);
  assert(fall.fallingArmFactor <= preset.arms * 0.4 + 1e-9, `${name} arm PD fades while FALLING`);
}

let confirmedHandDirections = 0;
for (const direction of [-1, 1]) {
  const fall = fallRun(1, 1, direction);
  if (fall.leftHandSeconds + fall.rightHandSeconds > 0) confirmedHandDirections += 1;
  assert.notEqual(fall.firstContact, "none", `Balance 100 fall ${direction} records the first body contact`);
}
assert(confirmedHandDirections >= 1, "alternating FALL TEST confirms a real Hand-ground contact");

{
  const fall = fallRun(1, 1, 1);
  const physics = fall.physics;
  assert.equal(physics.diagnostics().posture, "DOWN");
  assert(physics.diagnostics().experiments.armControlFactor <= 0.15, "DOWN arm PD is 0-15%");
  const before = physics.diagnostics().control.rightHip.current;
  physics.setInput("q", true);
  physics.setInput("o", true);
  step(physics, 30);
  const after = physics.diagnostics();
  assert.equal(after.inputState.q, true, "Q input remains enabled while DOWN");
  assert.equal(after.inputState.o, true, "O input remains enabled while DOWN");
  assert(Math.abs(after.control.rightHip.current - before) > 0.05, "DOWN input still moves joints physically");
}

const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
for (const marker of ["DRIFT TEST: COMPLETE", "Start X", "End X", "Drift Distance", "Avg X velocity", "Max X velocity", "Foot ground", "FALL TEST", "First body contact", "Q/W/O/P enabled while DOWN"]) {
  assert(gameSource.includes(marker), `debug UI contains ${marker}`);
}
assert(!/Body\.set(?:Position|Angle|Velocity)/.test(gameSource), "test UI never teleports or sets velocity");

console.log("Phase 1F preset comparison", JSON.stringify(comparison));
console.log("Phase 1F drift, fall, Hand contact, DOWN input, parameters, and regression tests passed");
