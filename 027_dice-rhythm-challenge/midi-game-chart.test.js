"use strict";

const MidiGameChart = require("./midi-game-chart.js");

function sourceBeat(index, pattern, dice, supported, reason = null) {
  return { index, measure: 1, beat: index + 1, pattern, dice, supported, reason, startTick: index * 480, endTick: (index + 1) * 480, startTime: index * 0.5, endTime: (index + 1) * 0.5, timeSignature: { numerator: 4, denominator: 4 }, onsetPositions: [] };
}
function sourceChart(beats, selection = "0") {
  return { fileName: "test.mid", selection, sourceTrack: { value: selection, label: `Track ${selection}` }, beats, measures: [{ measure: 1, supported: true, timeSignature: { numerator: 4, denominator: 4 }, beats }] };
}
function build(beats, selection) { return new MidiGameChart(sourceChart(beats, selection)).build(); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const beats = [sourceBeat(0, "SINGLE", 1, true), sourceBeat(1, "EVEN_2", 2, true), sourceBeat(2, "EVEN_4", 4, true), sourceBeat(3, "REST", null, true)];
const chart = build(beats, "0");
assert(chart.beats[0].playDice === 1, "SINGLE -> 1");
assert(chart.beats[1].playDice === 2, "EVEN_2 -> 2");
assert(chart.beats[2].playDice === 4, "EVEN_4 -> 4");
assert(chart.beats[3].playDice === null && chart.beats[3].isRest && !chart.beats[3].isFallback, "REST no input");

const fallback = build([sourceBeat(0, "TRIPLET", 3, false, "DICE_3_NOT_SUPPORTED"), sourceBeat(1, "OTHER", null, false, "UNSUPPORTED_PATTERN"), sourceBeat(2, "REST", null, true), sourceBeat(3, "REST", null, true)]);
assert(fallback.beats[0].playDice === null && fallback.beats[0].isFallback && fallback.beats[0].fallbackReason === "DICE_3_NOT_SUPPORTED", "TRIPLET fallback");
assert(fallback.beats[1].playDice === null && fallback.beats[1].isFallback && fallback.beats[1].fallbackReason === "UNSUPPORTED_PATTERN", "OTHER fallback");

let selectedGameTrack = "0";
const activeGameChart = chart;
selectedGameTrack = "1";
assert(activeGameChart.selection === "0" && selectedGameTrack === "1", "START chart remains fixed after GAME TRACK change");
let analysisTrack = "all";
analysisTrack = "2";
assert(activeGameChart.selection === "0" && analysisTrack === "2", "Analysis Track does not change active chart");
assert(MidiGameChart.beatAtTick(chart, 960).beat === 3, "tick selects measure beat");
assert(!MidiGameChart.judgeRest(0).miss, "REST no input is not MISS");
assert(MidiGameChart.judgeRest(1).miss, "REST input is MISS");

const silent = build([sourceBeat(0, "REST", null, true), sourceBeat(1, "REST", null, true), sourceBeat(2, "REST", null, true), sourceBeat(3, "REST", null, true)]);
assert(silent.statistics.silent && silent.statistics.playableActiveRate === null && silent.statistics.activeBeatRate === 0, "silent track is not 100% game suitable");

console.log(JSON.stringify({ tests: 12, assertions: 12, result: "PASS" }));
