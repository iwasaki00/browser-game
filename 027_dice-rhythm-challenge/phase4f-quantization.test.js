"use strict";

const MidiGameChart = require("./midi-game-chart.js");

function beat(index, pattern, dice, positions, options = {}) {
  return {
    index, measure: 1, beat: index + 1, pattern, dice,
    supported: options.supported ?? pattern !== "OTHER",
    reason: pattern === "OTHER" ? "UNSUPPORTED_PATTERN" : null,
    startTick: index * 480, endTick: (index + 1) * 480,
    startTime: index * 0.5, endTime: (index + 1) * 0.5,
    tempo: 120, timeSignature: { numerator: 4, denominator: 4 },
    onsetPositions: positions
  };
}
function chart(beats, selection = "0", quantizeEnabled = true) {
  return new MidiGameChart({ fileName: "test.mid", selection, sourceTrack: { value: selection, label: `Track ${selection}` }, beats }, { quantizeEnabled }).build();
}
function assert(value, message) { if (!value) throw new Error(message); }
let assertions = 0;
function check(value, message) { assertions += 1; assert(value, message); }

const q2 = chart([beat(0, "OTHER", null, [0.01, 0.49])]).beats[0];
check(q2.isQuantized && q2.playDice === 2 && !q2.isDummy && q2.quantizeConfidence === "NEAR", "near pair quantizes to Dice 2");
check(q2.originalOnsetPositions.join(",") === "0.01,0.49" && q2.quantizedOnsetPositions.join(",") === "0,0.5", "original and quantized pair positions retained");
const q3 = chart([beat(0, "OTHER", null, [0.01, 0.34, 0.67])]).beats[0];
check(q3.isQuantized && q3.playDice === 3, "near triplet quantizes to Dice 3");
const q4 = chart([beat(0, "OTHER", null, [0.01, 0.26, 0.5, 0.74])]).beats[0];
check(q4.isQuantized && q4.playDice === 4, "near four quantizes to Dice 4");

const lateOne = chart([beat(0, "OTHER", null, [0.5])]).beats[0];
check(lateOne.isDummy && lateOne.notQuantizedReason === "LATE_START", "late single remains DUMMY");
const offbeatPair = chart([beat(0, "OTHER", null, [0.25, 0.75])]).beats[0];
check(offbeatPair.isDummy && offbeatPair.notQuantizedReason === "LATE_START", "offbeat pair remains DUMMY");
const syncopated = chart([beat(0, "OTHER", null, [0, 0.1, 0.2, 0.3])]).beats[0];
check(syncopated.isDummy && syncopated.notQuantizedReason === "SYNCOPATED", "syncopated rhythm remains DUMMY");
const five = chart([beat(0, "OTHER", null, [0, 0.2, 0.4, 0.6, 0.8])]).beats[0];
check(five.isDummy && five.notQuantizedReason === "ONSET_COUNT_5_PLUS", "five onsets remain DUMMY");
const distant = chart([beat(0, "OTHER", null, [0, 0.7])]).beats[0];
check(distant.isDummy && distant.notQuantizedReason === "DISTANCE_TOO_LARGE", "distance over threshold remains DUMMY");

check(!q3.isDummy && q3.playDice === 3, "quantized Dice uses normal judgment path");
const guideStarts = Array.from({ length: q3.playDice }, (_, index) => 500 / q3.playDice * index);
check(guideStarts.length === 3 && Math.abs(guideStarts[2] - 333.333333) < 0.001, "quantized Dice 3 has three guide pulses");

const rates = chart([
  beat(0, "SINGLE", 1, [0]),
  beat(1, "OTHER", null, [0.01, 0.49]),
  beat(2, "OTHER", null, [0.01, 0.34, 0.67]),
  beat(3, "OTHER", null, [0.25, 0.75]),
  beat(4, "REST", null, [])
]);
check(rates.statistics.beforeRealDiceActiveRate === 25 && rates.statistics.afterRealDiceActiveRate === 75, "before and after Real rates");
check(rates.statistics.beforeDummyRate === 75 && rates.statistics.afterDummyRate === 25, "before and after Dummy rates");
check(rates.statistics.quantizedBeats === 2 && rates.statistics.quantizedDice2 === 1 && rates.statistics.quantizedDice3 === 1, "quantized statistics by Dice");

const lowerBeforeBetterAfter = chart(Array.from({ length: 24 }, (_, index) => {
  const slot = index % 4;
  return slot === 0 ? beat(index, "SINGLE", 1, [0]) : slot === 1 ? beat(index, "OTHER", null, [0.01, 0.49]) : slot === 2 ? beat(index, "OTHER", null, [0.01, 0.34, 0.67]) : beat(index, "REST", null, []);
}), "1");
const higherBeforeWorseAfter = chart(Array.from({ length: 24 }, (_, index) => {
  const slot = index % 4;
  return slot < 2 ? beat(index, "SINGLE", 1, [0]) : slot === 2 ? beat(index, "OTHER", null, [0.25, 0.75]) : beat(index, "REST", null, []);
}), "2");
check(MidiGameChart.recommend([higherBeforeWorseAfter, lowerBeforeBetterAfter]) === lowerBeforeBetterAfter, "recommendation uses After rates");
const off = chart([beat(0, "OTHER", null, [0.01, 0.49])], "3", false);
check(!off.beats[0].isQuantized && off.beats[0].isDummy && off.statistics.afterDummyRate === 100 && off.beats[0].notQuantizedReason === "QUANTIZE_DISABLED", "Quantize OFF restores Phase 4E DUMMY behavior");
check(MidiGameChart.QUANTIZE_CONFIG.maxDistance === 0.08 && MidiGameChart.QUANTIZE_CONFIG.firstOnsetTolerance === 0.08, "central quantize thresholds");

console.log(JSON.stringify({ tests: 14, assertions, result: "PASS" }));