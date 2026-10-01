"use strict";

const fs = require("fs");
const path = require("path");
const MidiGameChart = require("./midi-game-chart.js");

const gameSource = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
function assert(value, message) { if (!value) throw new Error(message); }
function applyDummy(state, inputCount, wrongInput) {
  const result = MidiGameChart.judgeDummy(inputCount, wrongInput);
  return { ...state, assists: state.assists + (result.assist ? 1 : 0), verdict: result.assist ? "ASSIST" : "" };
}

const initial = { score: 1200, combo: 7, lives: 2, assists: 0 };
const success = applyDummy(initial, 1, false);
assert(success.verdict === "ASSIST" && success.assists === 1, "successful DUMMY is recorded as ASSIST");
assert(success.score === initial.score && success.combo === initial.combo && success.lives === initial.lives, "ASSIST changes no score, combo, or life");
const skipped = applyDummy(initial, 0, false);
assert(skipped.verdict === "" && skipped.score === initial.score && skipped.combo === initial.combo && skipped.lives === initial.lives, "skipped DUMMY has no penalty");
const wrong = applyDummy(initial, 1, true);
assert(wrong.verdict === "" && wrong.score === initial.score && wrong.combo === initial.combo && wrong.lives === initial.lives, "wrong DUMMY input has no penalty");
const dummyBranch = gameSource.indexOf('this.currentGameBeat?.isDummy');
const scoringBranch = gameSource.indexOf('} else if (value !== 0) {', dummyBranch);
assert(dummyBranch >= 0 && scoringBranch > dummyBranch, "DUMMY branch is isolated before normal scoring");
assert(gameSource.includes('this.ui.results(this.score, this.bestCombo, this.totals, songClear);'), "result screen receives ASSIST totals without legacy fallback override");

console.log(JSON.stringify({ tests: 6, assertions: 6, result: "PASS" }));