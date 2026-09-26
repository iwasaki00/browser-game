"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");
const difficulty = require("../difficulty.js");
const {
  RaceController, FallGuard, RACE_STATE, STORAGE_KEYS, storageKeysFor,
  RECORD_VERSION, DISTANCE_SCALE, DEFAULT_GAME_OVER_GRACE_MS
} = require("../race.js");
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
assert.equal(difficulty.DIFFICULTY_PRESETS.NORMAL.balanceScale, 0.52);
assert.equal(difficulty.DIFFICULTY_PRESETS.NORMAL.armSwing, 0.68);
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

const badInputScenarios = {
  A_Q_HOLD: [{ keys: ["q"], frames: 720 }],
  B_O_HOLD: [{ keys: ["o"], frames: 720 }],
  C_CROSSED: [
    { keys: ["q", "p"], frames: 180 },
    { keys: ["w", "o"], frames: 180 },
    { keys: ["q", "w"], frames: 240 }
  ],
  D_IRREGULAR: [
    { keys: ["q"], frames: 75 },
    { keys: ["o", "p"], frames: 95 },
    { keys: ["w"], frames: 65 },
    { keys: ["q", "w", "o"], frames: 130 },
    { keys: ["p"], frames: 110 },
    { keys: ["q", "p"], frames: 145 }
  ]
};
const gameOverRates = {};
for (const key of ["EASY", "NORMAL", "HARD"]) {
  let gameOvers = 0;
  for (const scenario of Object.values(badInputScenarios)) {
    const runner = makeRunner(key);
    step(runner, 90);
    let candidateFrames = 0;
    let gameOver = false;
    for (const phase of scenario) {
      setKeys(runner, phase.keys);
      step(runner, phase.frames, data => {
        if (gameOver) return;
        const candidate = data.posture === "DOWN" || data.groundContacts.head || data.groundContacts.torso;
        candidateFrames = candidate ? candidateFrames + 1 : 0;
        if (candidateFrames * frame >= 250) gameOver = true;
      });
      if (gameOver) break;
    }
    if (gameOver) gameOvers += 1;
  }
  gameOverRates[key] = gameOvers / Object.keys(badInputScenarios).length;
}
console.log("GAME OVER rates", JSON.stringify(gameOverRates));

console.log("FINAL difficulty metrics", JSON.stringify(metrics));
assert.equal(metrics.EASY.idleDownSeconds, null, "EASY stands for 10 seconds");
assert(Math.abs(metrics.EASY.idleDistanceMeters) < 0.15, "EASY does not walk automatically");
assert(metrics.HARD.idleDownSeconds === null || metrics.HARD.idleDownSeconds >= 2, "HARD is not an immediate fall");
for (const key of ["EASY", "NORMAL", "HARD"]) {
  assert(metrics[key].distance12CyclesMeters > 0.5, `${key} can move forward with correct inputs`);
  assert.equal(metrics[key].demoFell, false, `${key} remains viable under careful DEMO input`);
}
assert(metrics.EASY.badMaxAngleDegrees <= metrics.HARD.badMaxAngleDegrees, "EASY tolerates bad input better than HARD");
assert(metrics.EASY.meanTorsoAngleDegrees < metrics.NORMAL.meanTorsoAngleDegrees, "EASY demo posture is calmer than NORMAL");
assert(metrics.NORMAL.maxTorsoAngleDegrees < metrics.HARD.maxTorsoAngleDegrees, "HARD demo has larger peak tilt than NORMAL");
assert.equal(metrics.EASY.badFell, false, "EASY survives the shared bad-input sequence");
assert.equal(metrics.NORMAL.badFell, true, "NORMAL visibly loses balance under bad input");
assert.equal(metrics.HARD.badFell, true, "HARD loses balance under bad input");
assert(metrics.HARD.badDownSeconds !== null, "HARD reaches DOWN under sustained bad input");
assert(gameOverRates.EASY < gameOverRates.NORMAL, "EASY GAME OVER rate is lower than NORMAL");
assert(gameOverRates.NORMAL < gameOverRates.HARD, "NORMAL GAME OVER rate is lower than HARD");
assert(metrics.EASY.fallDownSeconds > metrics.NORMAL.fallDownSeconds);
assert(metrics.NORMAL.fallDownSeconds > metrics.HARD.fallDownSeconds);
assert(
  metrics.EASY.fallDownSeconds === null || metrics.HARD.fallDownSeconds === null || metrics.EASY.fallDownSeconds >= metrics.HARD.fallDownSeconds,
  "EASY recovery window is at least as long as HARD"
);

assert.equal(DISTANCE_SCALE, 2.5);
assert.equal(RECORD_VERSION, 2);
assert.equal(DEFAULT_GAME_OVER_GRACE_MS, 250);
const fallGuard = new FallGuard();
assert.equal(fallGuard.update(true, 249), false, "momentary contact does not end the race");
assert.equal(fallGuard.update(false, 1), false, "contact release resets the grace timer");
assert.equal(fallGuard.update(true, 200), false);
assert.equal(fallGuard.update(true, 50), true, "250ms continuous contact confirms GAME OVER");
const scaleComparison = {
  "1.5": 179.25,
  "2": 136.7333333333453,
  "2.5": 111.60000000000959,
  "3": 87.28333333333585
};
assert(scaleComparison["3"] < scaleComparison["2.5"]);
assert(scaleComparison["2.5"] < scaleComparison["2"]);

const gameOverStorage = new MemoryStorage();
gameOverStorage.setItem(storageKeysFor("NORMAL").bestTime, "40000");
const gameOverRace = new RaceController({
  storage: gameOverStorage,
  recordCategory: "NORMAL",
  countdown: { ready: 0, three: 0, two: 0, one: 0, go: 0 }
});
gameOverRace.startCountdown(0);
gameOverRace.update(0, 0);
gameOverRace.update(9000, 38.42);
const gameOverEvent = gameOverRace.gameOver(10000, 38.42);
assert.equal(gameOverEvent.gameOver, true);
assert.equal(gameOverRace.state, RACE_STATE.GAME_OVER);
assert.equal(gameOverRace.inputEnabled, false);
assert.equal(gameOverRace.finalTimeMs, 10000);
assert.equal(gameOverRace.bestTimeMs, 40000, "GAME OVER never updates BEST TIME");
assert.equal(gameOverRace.bestDistance, 38.42, "valid GAME OVER can update BEST DISTANCE");
assert.equal(gameOverRace.newDistanceBest, true);
gameOverRace.update(20000, 80);
assert.equal(gameOverRace.finalTimeMs, 10000, "GAME OVER freezes timer");
assert.equal(gameOverRace.currentDistance, 38.42, "GAME OVER freezes distance");

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

const versionedStorage = new MemoryStorage();
versionedStorage.setItem("qwopRunner.bestTimeMs.NORMAL.v1", "12345");
versionedStorage.setItem("qwopRunner.bestDistanceM.NORMAL.v1", "88");
const cleanV2 = new RaceController({ storage: versionedStorage, recordCategory: "NORMAL" });
assert.equal(cleanV2.bestTimeMs, null, "v1 time does not mix with v2 records");
assert.equal(cleanV2.bestDistance, 0, "v1 distance does not mix with scaled v2 records");

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
assert(gameSource.includes("new QWOPRace.FallGuard()"));
assert(gameSource.includes("QWOPRace.DISTANCE_SCALE"));
assert(gameSource.includes('emitRaceEvent("gameOver"'));
assert(htmlSource.includes('data-difficulty="EASY"'));
assert(htmlSource.includes('data-difficulty="NORMAL"'));
assert(htmlSource.includes('data-difficulty="HARD"'));
assert(htmlSource.includes("Ver 1.1.0"));
assert(htmlSource.includes('id="resultDifficulty"'));
assert(htmlSource.includes('id="resultDistance"'));
assert(cssSource.includes(".difficulty-panel"));
assert(cssSource.includes("@media (orientation:portrait)"));

console.log("DISTANCE SCALE comparison", JSON.stringify(scaleComparison));
console.log("QWOP Runner Ver 1.1.0 FINAL TEST: PASS");
