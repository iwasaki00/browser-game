"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { RaceController, RACE_STATE, STORAGE_KEYS } = require("../race.js");

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const countdown = { ready: 100, three: 100, two: 100, one: 100, go: 80 };
const storage = new MemoryStorage();
const race = new RaceController({ storage, countdown });

assert.equal(race.state, RACE_STATE.READY);
assert.equal(race.inputEnabled, false);
race.startCountdown(1000);
assert.equal(race.countdownLabel(1000), "READY");
assert.equal(race.countdownLabel(1100), "3");
assert.equal(race.countdownLabel(1200), "2");
assert.equal(race.countdownLabel(1300), "1");
assert.equal(race.inputEnabled, false, "countdown must lock Q/W/O/P");

let event = race.update(1400, 42);
assert.equal(event.started, true);
assert.equal(race.state, RACE_STATE.RUNNING);
assert.equal(race.currentDistance, 0, "pre-start movement must not enter the race distance");
assert.equal(race.inputEnabled, true);
assert.equal(race.countdownLabel(1430), "GO!");
assert.equal(race.countdownLabel(1490), "");

race.update(1500, -1.25);
assert.equal(race.currentDistance, -1.25, "negative distance remains visible");
assert.equal(race.maxDistance, 0);
race.update(1600, 12.5);
race.update(1700, 7);
assert.equal(race.maxDistance, 12.5, "maximum forward distance does not fall when the runner reverses");
assert.equal(race.bestDistance, 12.5);
assert.equal(Number(storage.getItem(STORAGE_KEYS.bestDistance)), 12.5);
assert.equal(race.state, RACE_STATE.RUNNING, "falling or reversing does not stop a race");
assert.equal(race.inputEnabled, true, "a running race keeps input enabled until GAME OVER is explicitly confirmed");

race.update(2399, 99.999);
assert.equal(race.state, RACE_STATE.RUNNING);
event = race.update(2400, 100);
assert.equal(event.finished, true);
assert.equal(race.state, RACE_STATE.FINISHED);
assert.equal(race.finalTimeMs, 1000);
assert.equal(race.inputEnabled, false);
assert.equal(race.bestTimeMs, 1000);
assert.equal(race.bestDistance, 100);
race.update(9999, 130);
assert.equal(race.finalTimeMs, 1000, "the goal time must stay frozen");

race.reset(10000);
race.startCountdown(10000);
assert.equal(race.state, RACE_STATE.COUNTDOWN);
assert.equal(race.elapsedMs, 0);
assert.equal(race.currentDistance, 0);
assert.equal(race.recordValid, true);
assert.equal(race.bestTimeMs, 1000, "retry keeps the saved best time");
assert.equal(race.bestDistance, 100, "retry keeps the saved best distance");

const invalidStorage = new MemoryStorage({
  [STORAGE_KEYS.bestTime]: "900",
  [STORAGE_KEYS.bestDistance]: "33.25"
});
const debugRace = new RaceController({ storage: invalidStorage, countdown });
debugRace.startCountdown(0);
debugRace.update(400, 0);
debugRace.update(600, 50);
assert.equal(debugRace.bestDistance, 50);
debugRace.invalidate("DEMO FORWARD");
assert.equal(debugRace.bestDistance, 33.25, "invalidating a run rolls back its provisional distance record");
assert.equal(invalidStorage.getItem(STORAGE_KEYS.bestDistance), "33.25");
debugRace.update(2400, 100);
assert.equal(debugRace.state, RACE_STATE.FINISHED);
assert.equal(debugRace.recordValid, false);
assert.deepEqual(debugRace.invalidReasons, ["DEMO FORWARD"]);
assert.equal(debugRace.bestTimeMs, 900, "debug runs must not update best time");
assert.equal(debugRace.bestDistance, 33.25, "debug runs must not update best distance");
assert.equal(invalidStorage.getItem(STORAGE_KEYS.bestTime), "900");
assert.equal(invalidStorage.getItem(STORAGE_KEYS.bestDistance), "33.25");

const trainingRace = new RaceController({ storage: new MemoryStorage(), countdown });
trainingRace.startCountdown(0);
trainingRace.update(400, 0);
trainingRace.update(1400, 100);
assert.equal(trainingRace.recordValid, true, "human training mode remains a valid run");
assert.equal(trainingRace.bestTimeMs, 1000);

const gameSource = fs.readFileSync(path.resolve(__dirname, "../game.js"), "utf8");
const htmlSource = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const cssSource = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");
assert(gameSource.includes("goalX = courseStartX + raceMetersToPhysicalDelta(race.goalDistance)"));
assert(gameSource.includes("for (let meter = -50; meter <= 100; meter += 5)"));
assert(gameSource.includes('invalidateRace("RECOVERY TEST")'));
assert(gameSource.includes('invalidateRace("ARM FORM TEST")'));
assert(gameSource.includes('invalidateRace("ARM CONNECTION TEST")'));
assert(gameSource.includes('invalidateRace("ELBOW MATRIX TEST")'));
assert(gameSource.includes('"TRAINING DEMO"'));
assert(gameSource.includes('"DEMO FORWARD"'));
assert(htmlSource.includes('id="runAgainButton"'));
assert(htmlSource.includes('id="raceTime"'));
assert(htmlSource.includes('id="bestTime"'));
assert(htmlSource.includes('id="bestDistance"'));
assert(cssSource.includes("@media (orientation:portrait)"));

console.log("Phase 2A tests passed: countdown, timer, 100m goal, retry, records, invalid runs, and responsive UI hooks");
