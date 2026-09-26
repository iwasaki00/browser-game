"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");
const difficulty = require("../difficulty.js");
const { RaceController, RACE_STATE, STORAGE_KEYS, storageKeysFor } = require("../race.js");
const { RunnerPhysics, DEMO_FORWARD_SEQUENCE, SCALE } = global.QWOPPhysics;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const frame = 1000 / 60;
const setKeys = (physics, keys) => {
  Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
  keys.forEach(key => physics.setInput(key, true));
};
const step = (physics, frames, inspect) => {
  for (let index = 0; index < frames; index += 1) {
    physics.step(frame);
    if (inspect) inspect(physics.diagnostics(), index);
  }
};
const makeRunner = key => {
  const physics = new RunnerPhysics();
  difficulty.apply(physics, key);
  return physics;
};

assert.equal(difficulty.normalize(null), "NORMAL");
assert.equal(difficulty.normalize("unknown"), "NORMAL");
assert.deepEqual(Object.keys(difficulty.DIFFICULTY_PRESETS), ["EASY", "NORMAL", "HARD"]);
assert.equal(difficulty.DIFFICULTY_PRESETS.NORMAL.balanceScale, 0.60);
assert.equal(difficulty.DIFFICULTY_PRESETS.NORMAL.armSwing, 0.70);
assert.equal(difficulty.DIFFICULTY_PRESETS.NORMAL.armAmplitude, 35);
assert(difficulty.DIFFICULTY_PRESETS.EASY.balanceScale > difficulty.DIFFICULTY_PRESETS.NORMAL.balanceScale);
assert(difficulty.DIFFICULTY_PRESETS.HARD.balanceScale < difficulty.DIFFICULTY_PRESETS.NORMAL.balanceScale);
assert(difficulty.DIFFICULTY_PRESETS.EASY.neutralAssist > difficulty.DIFFICULTY_PRESETS.NORMAL.neutralAssist);
assert(difficulty.DIFFICULTY_PRESETS.HARD.neutralAssist < difficulty.DIFFICULTY_PRESETS.NORMAL.neutralAssist);

const metrics = {};
for (const key of ["EASY", "NORMAL", "HARD"]) {
  const idle = makeRunner(key);
  const idleStartX = idle.bodies.torso.position.x;
  let idleDownAt = null;
  step(idle, 600, (data, index) => {
    if (data.posture === "DOWN" && idleDownAt === null) idleDownAt = (index + 1) * frame / 1000;
  });
  const idleDistance = (idle.bodies.torso.position.x - idleStartX) / SCALE;

  const run = makeRunner(key);
  step(run, 90);
  const runStartX = run.bodies.torso.position.x;
  let angleSum = 0;
  let angleFrames = 0;
  let maxAngle = 0;
  let demoFell = false;
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (const phase of DEMO_FORWARD_SEQUENCE) {
      setKeys(run, phase.keys);
      step(run, Math.round(phase.duration / frame), data => {
        const angle = Math.abs(run.bodies.torso.angle) * 180 / Math.PI;
        angleSum += angle;
        angleFrames += 1;
        maxAngle = Math.max(maxAngle, angle);
        if (data.posture === "FALLING" || data.posture === "DOWN") demoFell = true;
      });
    }
  }
  const distance = (run.bodies.torso.position.x - runStartX) / SCALE;

  const fall = makeRunner(key);
  step(fall, 90);
  fall.applyFallTest(1);
  let fallDownAt = null;
  step(fall, 360, (data, index) => {
    if (data.posture === "DOWN" && fallDownAt === null) fallDownAt = (index + 1) * frame / 1000;
  });
  setKeys(fall, ["q"]);
  step(fall, 1);
  const downInputAccepted = fall.inputState.q && fall.diagnostics().posture === "DOWN";

  const bad = makeRunner(key);
  step(bad, 90);
  let badMaxAngle = 0;
  let badFell = false;
  let badDownAt = null;
  let badElapsedFrames = 0;
  const badSequence = [
    { keys: ["q"], frames: 150 },
    { keys: ["p"], frames: 100 },
    { keys: ["w", "o"], frames: 140 },
    { keys: ["q", "w", "p"], frames: 120 },
    { keys: ["o"], frames: 180 }
  ];
  for (const phase of badSequence) {
    setKeys(bad, phase.keys);
    step(bad, phase.frames, data => {
      badElapsedFrames += 1;
      badMaxAngle = Math.max(badMaxAngle, Math.abs(bad.bodies.torso.angle) * 180 / Math.PI);
      if (data.posture === "FALLING" || data.posture === "DOWN") badFell = true;
      if (data.posture === "DOWN" && badDownAt === null) badDownAt = badElapsedFrames * frame / 1000;
    });
  }
  metrics[key] = {
    idleDownSeconds: idleDownAt,
    idleDistanceMeters: idleDistance,
    distance12CyclesMeters: distance,
    meanTorsoAngleDegrees: angleSum / angleFrames,
    maxTorsoAngleDegrees: maxAngle,
    fallDownSeconds: fallDownAt,
    downInputAccepted,
    badMaxAngleDegrees: badMaxAngle,
    badFell,
    badDownSeconds: badDownAt,
    demoFell,
    endPosture: run.diagnostics().posture
  };
}

assert.equal(metrics.EASY.idleDownSeconds, null, "EASY stands for 10 seconds");
assert(Math.abs(metrics.EASY.idleDistanceMeters) < 0.15, "EASY does not walk automatically");
assert(metrics.HARD.idleDownSeconds === null || metrics.HARD.idleDownSeconds >= 2, "HARD is not an immediate fall");
for (const key of ["EASY", "NORMAL", "HARD"]) {
  assert(metrics[key].distance12CyclesMeters > 0.5, `${key} can move forward with correct inputs`);
  assert.equal(metrics[key].downInputAccepted, true, `${key} accepts Q/W/O/P while DOWN`);
}
assert(metrics.EASY.badMaxAngleDegrees <= metrics.HARD.badMaxAngleDegrees, "EASY tolerates bad input better than HARD");
assert(metrics.EASY.meanTorsoAngleDegrees < metrics.NORMAL.meanTorsoAngleDegrees, "EASY demo posture is calmer than NORMAL");
assert(metrics.NORMAL.maxTorsoAngleDegrees < metrics.HARD.maxTorsoAngleDegrees, "HARD demo has larger peak tilt than NORMAL");
assert.equal(metrics.EASY.badFell, false, "EASY survives the shared bad-input sequence");
assert.equal(metrics.NORMAL.badFell, true, "NORMAL visibly loses balance under bad input");
assert.equal(metrics.HARD.badFell, true, "HARD loses balance under bad input");
assert(metrics.HARD.badDownSeconds !== null, "HARD reaches DOWN under sustained bad input");
assert(metrics.EASY.fallDownSeconds > metrics.NORMAL.fallDownSeconds);
assert(metrics.NORMAL.fallDownSeconds > metrics.HARD.fallDownSeconds);
assert(
  metrics.EASY.fallDownSeconds === null || metrics.HARD.fallDownSeconds === null || metrics.EASY.fallDownSeconds >= metrics.HARD.fallDownSeconds,
  "EASY recovery window is at least as long as HARD"
);

const storage = new MemoryStorage();
for (const [index, key] of ["EASY", "NORMAL", "HARD"].entries()) {
  const race = new RaceController({
    storage,
    recordCategory: key,
    countdown: { ready: 0, three: 0, two: 0, one: 0, go: 0 }
  });
  assert.equal(race.state, RACE_STATE.READY);
  race.startCountdown(0);
  assert.equal(race.update(0, 0).started, true);
  race.update(30000 + index * 1000, 100);
  assert.equal(race.state, RACE_STATE.FINISHED);
  assert.equal(race.bestTimeMs, 30000 + index * 1000);
  assert.equal(race.bestDistance, 100);
}
assert.equal(Number(storage.getItem(storageKeysFor("EASY").bestTime)), 30000);
assert.equal(Number(storage.getItem(storageKeysFor("NORMAL").bestTime)), 31000);
assert.equal(Number(storage.getItem(storageKeysFor("HARD").bestTime)), 32000);
assert.equal(Number(storage.getItem(storageKeysFor("EASY").bestDistance)), 100);
assert.equal(Number(storage.getItem(storageKeysFor("NORMAL").bestDistance)), 100);
assert.equal(Number(storage.getItem(storageKeysFor("HARD").bestDistance)), 100);

const legacyStorage = new MemoryStorage();
legacyStorage.setItem(STORAGE_KEYS.bestTime, "45678");
legacyStorage.setItem(STORAGE_KEYS.bestDistance, "72.5");
const migratedNormal = new RaceController({ storage: legacyStorage, recordCategory: "NORMAL" });
assert.equal(migratedNormal.bestTimeMs, 45678);
assert.equal(migratedNormal.bestDistance, 72.5);
assert.equal(legacyStorage.getItem(storageKeysFor("NORMAL").bestTime), "45678");
assert.equal(legacyStorage.getItem(storageKeysFor("NORMAL").bestDistance), "72.5");

const debugRace = new RaceController({
  storage,
  recordCategory: "HARD",
  countdown: { ready: 0, three: 0, two: 0, one: 0, go: 0 }
});
debugRace.startCountdown(0);
debugRace.update(0, 0);
debugRace.invalidate("DEMO FORWARD");
debugRace.update(10000, 100);
assert.equal(debugRace.bestTimeMs, 32000, "DEBUG RUN does not overwrite HARD best");

const gameSource = fs.readFileSync(path.resolve(__dirname, "../game.js"), "utf8");
const htmlSource = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const cssSource = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");
assert(gameSource.includes("selectDifficulty"));
assert(gameSource.includes("beginCountdown"));
assert(htmlSource.includes('data-difficulty="EASY"'));
assert(htmlSource.includes('data-difficulty="NORMAL"'));
assert(htmlSource.includes('data-difficulty="HARD"'));
assert(htmlSource.includes("Ver 1.0.0"));
assert(htmlSource.includes('id="resultDifficulty"'));
assert(cssSource.includes(".difficulty-panel"));
assert(cssSource.includes("@media (orientation:portrait)"));

console.log("FINAL difficulty metrics", JSON.stringify(metrics));
console.log("QWOP Runner Ver 1.0.0 FINAL TEST: PASS");
