"use strict";

const MidiDiceChartGenerator = require("./midi-dice-chart-generator.js");

function beat(index, pattern, measure = 1, beatNumber = index + 1, signature = { numerator: 4, denominator: 4 }) {
  return {
    index,
    measure,
    beat: beatNumber,
    startTick: index * 480,
    endTick: (index + 1) * 480,
    startTime: index * 0.5,
    endTime: (index + 1) * 0.5,
    timeSignature: signature,
    pattern,
    rawNoteCount: pattern === "REST" ? 0 : 1,
    onsetCount: pattern === "REST" ? 0 : 1,
    onsetPositions: pattern === "REST" ? [] : [0],
    trackBreakdown: []
  };
}

function generate(beats) {
  return new MidiDiceChartGenerator({ fileName: "test.mid", selection: "all", track: { value: "all", label: "ALL" }, beats }).generate();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const patterns = ["REST", "SINGLE", "EVEN_2", "EVEN_4", "TRIPLET", "OTHER"];
const converted = generate(patterns.map((pattern, index) => beat(index, pattern, index + 1, 1))).beats;
assert(converted[0].dice === null && converted[0].supported, "REST conversion");
assert(converted[1].dice === 1 && converted[1].supported, "SINGLE conversion");
assert(converted[2].dice === 2 && converted[2].supported, "EVEN_2 conversion");
assert(converted[3].dice === 4 && converted[3].supported, "EVEN_4 conversion");
assert(converted[4].dice === 3 && !converted[4].supported && converted[4].reason === "DICE_3_NOT_SUPPORTED", "TRIPLET conversion");
assert(converted[5].dice === null && !converted[5].supported && converted[5].reason === "UNSUPPORTED_PATTERN", "OTHER conversion");

const row = generate([beat(0, "SINGLE"), beat(1, "EVEN_2"), beat(2, "EVEN_4"), beat(3, "REST")]);
assert(JSON.stringify(row.measures[0].dice) === JSON.stringify([1, 2, 4, null]), "four beats become one row");
assert(row.statistics.playableRate === 100 && row.statistics.supportedBeats === 4, "playable rate");

const unsupportedSignature = generate([
  beat(0, "SINGLE", 1, 1, { numerator: 3, denominator: 4 }),
  beat(1, "EVEN_2", 1, 2, { numerator: 3, denominator: 4 }),
  beat(2, "REST", 1, 3, { numerator: 3, denominator: 4 })
]);
assert(!unsupportedSignature.measures[0].supported && unsupportedSignature.measures[0].dice === null, "non-4/4 measure unsupported");
assert(unsupportedSignature.beats.every((item) => !item.supported && item.reason === "UNSUPPORTED_TIME_SIGNATURE"), "non-4/4 beats unsupported");

console.log(JSON.stringify({ tests: 9, assertions: 10, result: "PASS" }));
