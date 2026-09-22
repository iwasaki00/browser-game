const assert = require("node:assert/strict");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");

const { RunnerPhysics, DEMO_FORWARD_SEQUENCE, DEG } = global.QWOPPhysics;
const step = (physics, milliseconds, sample) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000 / 60) {
    physics.step(1000 / 60);
    if (sample) sample();
  }
};

{
  const physics = new RunnerPhysics();
  const armNames = ["leftUpperArm", "leftForearm", "rightUpperArm", "rightForearm"];
  armNames.forEach(name => assert(physics.bodies[name], `${name} exists`));
  const jointLabels = physics.constraints.map(constraint => constraint.label);
  ["left shoulder", "left elbow", "right shoulder", "right elbow"].forEach(label => assert(jointLabels.includes(label)));
  assert(global.Matter.Detector.canCollide(physics.bodies.leftForearm.collisionFilter, physics.ground.collisionFilter), "arms collide with ground");

  const normalMass = physics.bodies.leftUpperArm.mass;
  physics.setArmMass("heavy");
  assert(physics.bodies.leftUpperArm.mass > normalMass);
  physics.setArmMass("light");
  assert(physics.bodies.leftUpperArm.mass < normalMass);
  physics.resetParameters();
  assert.equal(physics.diagnostics().experiments.armMass, "normal");
}

{
  const physics = new RunnerPhysics();
  step(physics, 1500);
  physics.setInput("w", true);
  step(physics, 700);
  let control = physics.diagnostics().control;
  assert(control.rightHip.current > control.leftHip.current, "W brings the left leg forward");
  assert(control.rightShoulder.target < control.leftShoulder.target, "left leg forward targets right arm forward");
  assert(control.rightShoulder.current < control.leftShoulder.current, "right arm physically follows the left leg");
  physics.setInput("w", false);
  physics.setInput("q", true);
  step(physics, 900);
  control = physics.diagnostics().control;
  assert(control.leftHip.current > control.rightHip.current, "Q brings the right leg forward");
  assert(control.leftShoulder.target < control.rightShoulder.target, "right leg forward targets left arm forward");
  assert(control.leftShoulder.current < control.rightShoulder.current, "left arm physically follows the right leg");

  physics.setArmSwingScale(0);
  step(physics, 100);
  control = physics.diagnostics().control;
  assert.equal(control.leftShoulder.torque, 0);
  assert.equal(control.rightShoulder.torque, 0);
  assert.equal(control.leftElbow.torque, 0);
  assert.equal(control.rightElbow.torque, 0);
}

{
  const physics = new RunnerPhysics();
  global.Matter.Body.setAngle(physics.bodies.torso, 75 * DEG);
  physics.applyControls();
  assert(physics.diagnostics().experiments.armControlFactor < 0.4, "arm PD fades when the torso has fallen");
}

function runDemo(armSwingScale) {
  const physics = new RunnerPhysics();
  physics.setArmSwingScale(armSwingScale);
  step(physics, 1500);
  const startX = physics.bodies.torso.position.x;
  let angleSum = 0;
  let angleMax = 0;
  let samples = 0;
  let fallFrames = 0;
  const sample = () => {
    const angle = Math.abs(physics.bodies.torso.angle);
    angleSum += angle;
    angleMax = Math.max(angleMax, angle);
    samples += 1;
    if (physics.bodies.torso.position.y > 350 || physics.bodies.head.position.y > 390) fallFrames += 1;
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
  const distancePixels = physics.bodies.torso.position.x - startX;
  return {
    distanceMeters: distancePixels / 72,
    averageVelocityMetersPerSecond: distancePixels / 72 / (duration / 1000),
    meanTorsoAngleDegrees: angleSum / samples / DEG,
    maxTorsoAngleDegrees: angleMax / DEG,
    fallFrames
  };
}

const swingOff = runDemo(0);
const swingOn = runDemo(1);
assert(swingOff.distanceMeters > 0, "ARM SWING 0% demo still moves forward");
assert(swingOn.distanceMeters > 0, "ARM SWING 100% demo moves forward");
assert.equal(swingOn.fallFrames, 0, "ARM SWING 100% demo stays upright");
console.log("ARM SWING comparison", JSON.stringify({ off: swingOff, on: swingOn }));
console.log("Phase 1D arm physics tests passed");
