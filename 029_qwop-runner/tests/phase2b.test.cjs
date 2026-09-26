"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.Matter = require("../../022_pythagora-lab/vendor/matter.min.js");
require("../physics.js");
const { RaceController, RACE_STATE, STORAGE_KEYS, DISTANCE_SCALE } = require("../race.js");
const { RunnerPhysics, DEMO_FORWARD_SEQUENCE, SCALE } = global.QWOPPhysics;

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const instant = { ready: 0, three: 0, two: 0, one: 0, go: 10 };
const storage = new MemoryStorage({ [STORAGE_KEYS.bestTime]: "43501" });
const race = new RaceController({ storage, countdown: instant });
race.startCountdown(0);
assert.equal(race.countdownLabel(0), "GO!");
assert.equal(race.update(0, 0).started, true);

let event = race.update(20000, 49.99);
assert.equal(event.halfway, false);
event = race.update(20100, 50);
assert.equal(event.halfway, true, "50m event fires at the threshold");
assert.equal(race.update(20200, 60).halfway, false, "50m event fires only once");
assert.equal(race.update(30000, 89.99).finalTen, false);
event = race.update(30100, 90);
assert.equal(event.finalTen, true, "90m event fires at the threshold");
assert.equal(race.update(30200, 95).finalTen, false, "90m event fires only once");
event = race.update(42381, 100);
assert.equal(event.finished, true);
assert.equal(event.newBest, true);
assert.equal(race.state, RACE_STATE.FINISHED);
assert.equal(race.previousBestTimeMs, 43501);
assert.equal(race.finalTimeMs, 42381);
assert.equal(race.improvementMs, -1120);
assert.equal(race.bestTimeMs, 42381);

race.reset(43000);
assert.equal(race.state, RACE_STATE.READY, "RUN AGAIN resets to READY");
assert.equal(race.halfwayReached, false);
assert.equal(race.finalTenReached, false);
race.startCountdown(43000);
assert.equal(race.state, RACE_STATE.COUNTDOWN);

const debugStorage = new MemoryStorage({
  [STORAGE_KEYS.bestTime]: "40000",
  [STORAGE_KEYS.bestDistance]: "80"
});
const debugRace = new RaceController({ storage: debugStorage, countdown: instant });
debugRace.startCountdown(0);
debugRace.update(0, 0);
debugRace.invalidate("DEMO FORWARD");
debugRace.update(50000, 100);
assert.equal(debugRace.state, RACE_STATE.FINISHED);
assert.equal(debugRace.bestTimeMs, 40000);
assert.equal(debugRace.bestDistance, 80);
assert.equal(debugStorage.getItem(STORAGE_KEYS.bestTime), "40000");
assert.equal(debugStorage.getItem(STORAGE_KEYS.bestDistance), "80");

const frame = 1000 / 60;
const physics = new RunnerPhysics();
physics.setBalanceScale(0.60);
physics.setArmSwingScale(0.70);
physics.setArmAmplitude(35);
physics.setHandFriction("normal");
const setKeys = keys => {
  Object.keys(physics.inputState).forEach(key => physics.setInput(key, false));
  keys.forEach(key => physics.setInput(key, true));
};
for (let index = 0; index < 90; index += 1) physics.step(frame);
const startX = physics.bodies.torso.position.x;
const constraintCount = physics.constraints.length;
let simulatedMs = 0;
let previousDistance = 0;
let maximumFrameJump = 0;
let cycles = 0;
let reached100m = false;
let selectedScaleTimeMs = null;
const scaleReachTimesMs = {};
const comparedScales = [1.5, 2, 2.5, 3];
for (; cycles < 600 && Object.keys(scaleReachTimesMs).length < comparedScales.length; cycles += 1) {
  for (const phase of DEMO_FORWARD_SEQUENCE) {
    setKeys(phase.keys);
    const frames = Math.round(phase.duration / frame);
    for (let index = 0; index < frames; index += 1) {
      physics.step(frame);
      simulatedMs += frame;
      const distance = (physics.bodies.torso.position.x - startX) / SCALE * DISTANCE_SCALE;
      maximumFrameJump = Math.max(maximumFrameJump, Math.abs(distance - previousDistance));
      previousDistance = distance;
      const physicalDistance = (physics.bodies.torso.position.x - startX) / SCALE;
      for (const scale of comparedScales) {
        if (scaleReachTimesMs[scale] === undefined && physicalDistance * scale >= 100) {
          scaleReachTimesMs[scale] = simulatedMs;
        }
      }
      for (const body of Object.values(physics.bodies)) {
        assert(Number.isFinite(body.position.x) && Number.isFinite(body.position.y), "body position remains finite");
        assert(Number.isFinite(body.velocity.x) && Number.isFinite(body.velocity.y), "body velocity remains finite");
        assert(Number.isFinite(body.angle), "body angle remains finite");
      }
      assert.equal(physics.constraints.length, constraintCount, "all constraints remain present");
      reached100m = distance >= 100;
      if (reached100m && selectedScaleTimeMs === null) selectedScaleTimeMs = simulatedMs;
    }
  }
}
setKeys([]);
assert.equal(reached100m, true, `recommended C demo did not reach 100m; ended at ${previousDistance.toFixed(2)}m`);
assert.equal(Object.keys(scaleReachTimesMs).length, comparedScales.length, "all distance scales reach 100m");
assert(scaleReachTimesMs[1.5] > scaleReachTimesMs[2]);
assert(scaleReachTimesMs[2] > scaleReachTimesMs[2.5]);
assert(scaleReachTimesMs[2.5] > scaleReachTimesMs[3]);
assert(maximumFrameJump < 0.5, `distance jumped ${maximumFrameJump.toFixed(3)}m in one frame`);
const diagnostics = physics.diagnostics();
for (const side of ["left", "right"]) {
  for (const gap of Object.values(diagnostics.armForm.connections[side].gaps)) {
    assert(Number.isFinite(gap) && gap < 3, `${side} arm connection remained stable`);
  }
}

const longRace = new RaceController({ storage: new MemoryStorage(), countdown: instant });
longRace.startCountdown(0);
longRace.update(0, 0);
longRace.invalidate("DEMO FORWARD");
let lastElapsed = 0;
for (let time = frame; time < selectedScaleTimeMs; time += 1000) {
  longRace.update(time, Math.min(99.9, time / selectedScaleTimeMs * 100));
  assert(longRace.elapsedMs >= lastElapsed, "timer never runs backward");
  lastElapsed = longRace.elapsedMs;
}
longRace.update(selectedScaleTimeMs, 100);
assert.equal(longRace.state, RACE_STATE.FINISHED);
assert.equal(longRace.bestTimeMs, null, "100m demo time is never saved as BEST");

const gameSource = fs.readFileSync(path.resolve(__dirname, "../game.js"), "utf8");
const htmlSource = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const cssSource = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");
assert(gameSource.includes('ctx.fillText("START"'));
assert(gameSource.includes('"HALFWAY! 50m"'));
assert(gameSource.includes('"FINAL 10m"'));
assert(gameSource.includes('showRaceNotice("WAIT"'));
assert(gameSource.includes('"qwop-race-event"'));
assert(htmlSource.includes('id="toGo"'));
assert(htmlSource.includes('id="raceProgressFill"'));
assert(htmlSource.includes('id="resultComparison"'));
assert(cssSource.includes(".race-overlay.go"));
assert(cssSource.includes(".race-overlay.finished"));
assert(cssSource.includes("@media (orientation:portrait)"));

console.log(JSON.stringify({
  phase: "2B",
  distanceScale: DISTANCE_SCALE,
  demo100mSeconds: selectedScaleTimeMs / 1000,
  scaleComparisonSeconds: Object.fromEntries(comparedScales.map(scale => [scale, scaleReachTimesMs[scale] / 1000])),
  cycles,
  finalDistanceMeters: 100,
  maximumFrameJumpMeters: maximumFrameJump,
  physicalDistanceMeters: 100 / DISTANCE_SCALE,
  posture: diagnostics.posture
}));
console.log("Phase 2B tests passed: race presentation, milestones, result comparison, run again, long-run stability, and responsive UI hooks");
