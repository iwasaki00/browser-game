const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, DEMO_FORWARD_SEQUENCE, DEG } = global.QWOPPhysics;
const step = (physics, milliseconds, sample) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000 / 60) {
    physics.step(1000 / 60);
    if (sample) sample(physics.diagnostics());
  }
};

{
  const physics = new RunnerPhysics();
  assert(physics.bodies.leftHand && physics.bodies.rightHand, "left and right Hand bodies exist");
  assert(physics.constraints.some(joint => joint.label === "left wrist"));
  assert(physics.constraints.some(joint => joint.label === "right wrist"));
  assert(global.Matter.Detector.canCollide(physics.bodies.leftHand.collisionFilter, physics.ground.collisionFilter));
  assert(global.Matter.Detector.canCollide(physics.bodies.leftHand.collisionFilter, physics.bodies.torso.collisionFilter));
  assert.equal(global.Matter.Detector.canCollide(physics.bodies.leftHand.collisionFilter, physics.bodies.leftForearm.collisionFilter), false);
  global.Matter.Body.setPosition(physics.bodies.leftHand, { x: physics.startX, y: 482 });
  assert(global.Matter.Query.collides(physics.bodies.leftHand, [physics.ground]).length > 0, "Hand body has a real ground contact shape");
  physics.setHandFriction("low");
  const low = physics.bodies.leftHand.friction;
  physics.setHandFriction("high");
  assert(physics.bodies.leftHand.friction > low);
  physics.setArmAmplitude(20);
  assert.equal(physics.diagnostics().experiments.armAmplitude, 20);
  physics.setArmAmplitude(42);
  assert.equal(physics.diagnostics().experiments.armAmplitude, 42);
}

{
  const physics = new RunnerPhysics();
  step(physics, 1000);
  physics.setInput("w", true);
  step(physics, 100);
  const earlyStride = physics.diagnostics().experiments.smoothedStride;
  step(physics, 500);
  const lateStride = physics.diagnostics().experiments.smoothedStride;
  assert(earlyStride > 0 && lateStride > earlyStride, "arm phase follows the hip with smoothing");
  assert(lateStride <= 1);

  global.Matter.Body.setAngle(physics.bodies.torso, 20 * DEG);
  physics.applyControls();
  assert.equal(physics.diagnostics().posture, "LEANING");
  global.Matter.Body.setAngle(physics.bodies.torso, 65 * DEG);
  global.Matter.Body.setAngularVelocity(physics.bodies.torso, 0.15);
  physics.applyControls();
  const falling = physics.diagnostics();
  assert.equal(falling.posture, "FALLING");
  assert(falling.experiments.balancePostureFactor < 0.4, "balance fades rather than forcing recovery");
}

{
  const physics = new RunnerPhysics();
  step(physics, 1500);
  const before = physics.bodies.torso.angularVelocity;
  physics.applyRecoveryImpulse(1);
  step(physics, 100);
  assert.notEqual(physics.bodies.torso.angularVelocity, before, "RECOVERY TEST applies a physical rotational impulse");
}

function runDemo(balanceScale, armSwingScale) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balanceScale);
  physics.setArmSwingScale(armSwingScale);
  physics.setArmAmplitude(35);
  step(physics, 1500);
  const startX = physics.bodies.torso.position.x;
  let angleSum = 0;
  let angleMax = 0;
  let samples = 0;
  let handTouched = false;
  let fell = false;
  const sample = data => {
    const angle = Math.abs(data.control.torso.current);
    angleSum += angle;
    angleMax = Math.max(angleMax, angle);
    samples += 1;
    handTouched ||= data.hands.left.contact || data.hands.right.contact;
    fell ||= data.posture === "DOWN";
  };
  let duration = 0;
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (const phase of DEMO_FORWARD_SEQUENCE) {
      Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
      phase.keys.forEach(key => physics.setInput(key, true));
      step(physics, phase.duration, sample);
      duration += phase.duration;
    }
  }
  const distanceMeters = (physics.bodies.torso.position.x - startX) / 72;
  return {
    distanceMeters,
    averageVelocityMetersPerSecond: distanceMeters / (duration / 1000),
    meanTorsoAngleDegrees: angleSum / samples / DEG,
    maxTorsoAngleDegrees: angleMax / DEG,
    fell,
    handTouched
  };
}

const comparisons = {
  A: runDemo(1, 0),
  B: runDemo(1, 0.6),
  C: runDemo(0.75, 0.6),
  D: runDemo(0.6, 0.6),
  E: runDemo(0.6, 0.75)
};
Object.entries(comparisons).forEach(([name, result]) => {
  assert(result.distanceMeters > 0, `Test ${name} moves forward`);
});

const swingSweep = Object.fromEntries([0.25, 0.5, 0.6, 0.7, 0.75, 1].map(value => [value, runDemo(1, value)]));
const balanceSweep = Object.fromEntries([1, 0.75, 0.6, 0.5, 0.4].map(value => [value, runDemo(value, 0.6)]));

function runRecoveryTest(balanceScale) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balanceScale);
  step(physics, 2000);
  physics.applyRecoveryImpulse(1);
  let maxTorsoAngleDegrees = 0;
  let handTouched = false;
  const states = new Set();
  step(physics, 3000, data => {
    maxTorsoAngleDegrees = Math.max(maxTorsoAngleDegrees, Math.abs(data.control.torso.current) / DEG);
    handTouched ||= data.hands.left.contact || data.hands.right.contact;
    states.add(data.posture);
  });
  return { maxTorsoAngleDegrees, handTouched, states: [...states], endPosture: physics.diagnostics().posture };
}

function runWrongSequence(balanceScale) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balanceScale);
  step(physics, 1500);
  const wrongSequence = [
    { keys: ["q", "p"], duration: 220 },
    { keys: ["q"], duration: 160 },
    { keys: ["w", "o"], duration: 220 },
    { keys: ["w"], duration: 160 }
  ];
  let handTouched = false;
  let fell = false;
  let maxTorsoAngleDegrees = 0;
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (const phase of wrongSequence) {
      Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
      phase.keys.forEach(key => physics.setInput(key, true));
      step(physics, phase.duration, data => {
        handTouched ||= data.hands.left.contact || data.hands.right.contact;
        fell ||= data.posture === "DOWN";
        maxTorsoAngleDegrees = Math.max(maxTorsoAngleDegrees, Math.abs(data.control.torso.current) / DEG);
      });
    }
  }
  const endPosture = physics.diagnostics().posture;
  for (let cycle = 0; cycle < 8; cycle += 1) {
    for (const phase of DEMO_FORWARD_SEQUENCE) {
      Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
      phase.keys.forEach(key => physics.setInput(key, true));
      step(physics, phase.duration, data => {
        handTouched ||= data.hands.left.contact || data.hands.right.contact;
      });
    }
  }
  const recovered = endPosture === "DOWN" && physics.diagnostics().posture !== "DOWN" && physics.bodies.torso.position.y < 350;
  return {
    distanceMeters: physics.distance,
    maxTorsoAngleDegrees,
    handTouched,
    fell,
    endPosture,
    recovered
  };
}

const recoverySweep = Object.fromEntries([1, 0.75, 0.6].map(value => [value, runRecoveryTest(value)]));
const wrongInputSweep = Object.fromEntries([1, 0.75, 0.6].map(value => [value, runWrongSequence(value)]));
function runBadHold(keys, balanceScale = 0.6) {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(balanceScale);
  step(physics, 1500);
  keys.forEach(key => physics.setInput(key, true));
  let handTouched = false;
  let fell = false;
  step(physics, 12000, data => {
    handTouched ||= data.hands.left.contact || data.hands.right.contact;
    fell ||= data.posture === "DOWN";
  });
  return { keys: keys.join("+"), posture: physics.diagnostics().posture, fell, handTouched, torsoY: physics.bodies.torso.position.y };
}
const badHoldSweep = [
  runBadHold(["o"]), runBadHold(["p"]), runBadHold(["q", "o", "p"]),
  runBadHold(["q", "w", "o"]), runBadHold(["w", "o", "p"])
];
Object.values(recoverySweep).forEach(result => {
  assert(result.states.includes("LEANING"), "RECOVERY TEST creates a visible lean");
  assert.equal(result.endPosture, "STABLE", "a light recovery impulse can settle naturally");
});
assert(badHoldSweep.some(result => result.posture === "LEANING"), "bad sustained input disturbs balance");
const idleSweep = Object.fromEntries([1, 0.75, 0.6, 0.5, 0.4].map(value => {
  const physics = new RunnerPhysics();
  physics.setBalanceScale(value);
  step(physics, 5000);
  const data = physics.diagnostics();
  return [value, { posture: data.posture, torsoY: data.position.y, distanceMeters: physics.distance }];
}));
Object.values(idleSweep).forEach(result => assert.notEqual(result.posture, "DOWN", "runner stands idle for five seconds"));

console.log("Phase 1E Test A-E", JSON.stringify(comparisons));
console.log("Phase 1E arm sweep", JSON.stringify(swingSweep));
console.log("Phase 1E balance sweep", JSON.stringify(balanceSweep));
console.log("Phase 1E recovery sweep", JSON.stringify(recoverySweep));
console.log("Phase 1E wrong-input sweep", JSON.stringify(wrongInputSweep));
console.log("Phase 1E idle sweep", JSON.stringify(idleSweep));
console.log("Phase 1E bad-hold sweep", JSON.stringify(badHoldSweep));
console.log("Phase 1E form, hand, recovery, and comparison tests passed");
