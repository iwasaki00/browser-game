"use strict";

const MidiGameChart = require("./midi-game-chart.js");

function sourceBeat(index, pattern, dice, supported = true, options = {}) {
  const signature = options.signature || { numerator: 4, denominator: 4 };
  const durationTicks = options.durationTicks || 480;
  const startTick = options.startTick ?? index * durationTicks;
  return {
    index,
    measure: options.measure ?? 1,
    beat: options.beat ?? index + 1,
    pattern,
    dice,
    supported,
    reason: options.reason || null,
    startTick,
    endTick: options.endTick ?? startTick + durationTicks,
    startTime: options.startTime ?? index * 0.5,
    endTime: options.endTime ?? (index + 1) * 0.5,
    tempo: options.tempo ?? 120,
    timeSignature: signature,
    onsetPositions: options.onsetPositions || []
  };
}
function sourceChart(beats, selection = "0") {
  return { fileName: "test.mid", selection, sourceTrack: { value: selection, label: `Track ${selection}` }, beats };
}
function build(beats, selection = "0") { return new MidiGameChart(sourceChart(beats, selection)).build(); }
function assert(condition, message) { if (!condition) throw new Error(message); }
let assertions = 0;
function check(condition, message) { assertions += 1; assert(condition, message); }

const fourFour = build([
  sourceBeat(0, "SINGLE", 1), sourceBeat(1, "EVEN_2", 2),
  sourceBeat(2, "TRIPLET", 3), sourceBeat(3, "EVEN_4", 4)
]);
check(fourFour.rows.length === 1 && fourFour.rows[0].slots.length === 4, "4/4 four beats make one game row");
check(fourFour.beats.every((beat, index) => beat.gameRowIndex === 0 && beat.slotIndex === index), "game row and slot indexes");

const twoTwo = build([
  sourceBeat(0, "SINGLE", 1, true, { measure: 1, beat: 1, signature: { numerator: 2, denominator: 2 }, durationTicks: 960 }),
  sourceBeat(1, "EVEN_2", 2, true, { measure: 1, beat: 2, signature: { numerator: 2, denominator: 2 }, durationTicks: 960 }),
  sourceBeat(2, "SINGLE", 1, true, { measure: 2, beat: 1, signature: { numerator: 2, denominator: 2 }, durationTicks: 960 }),
  sourceBeat(3, "EVEN_4", 4, true, { measure: 2, beat: 2, signature: { numerator: 2, denominator: 2 }, durationTicks: 960 })
]);
check(twoTwo.compatible && twoTwo.rows.length === 1, "2/2 measures continue into one four-beat game row");
check(twoTwo.beats[2].measure === 2 && twoTwo.beats[2].beat === 1 && twoTwo.beats[2].slotIndex === 2, "original 2/2 position is preserved");

const threeFour = build(Array.from({ length: 6 }, (_, index) => sourceBeat(index, "SINGLE", 1, true, {
  measure: Math.floor(index / 3) + 1, beat: index % 3 + 1, signature: { numerator: 3, denominator: 4 }
})));
check(threeFour.rows.length === 2 && threeFour.beats[3].gameRowIndex === 0 && threeFour.beats[4].gameRowIndex === 1, "3/4 stream crosses measure boundary by groups of four");
check(threeFour.statistics.emptyEndSlots === 2 && threeFour.rows[1].slots[2] === null && threeFour.rows[1].slots[3] === null, "final partial row exposes empty slots");
check(!threeFour.beats.some((beat) => beat.isRest && beat.slotIndex >= 2 && beat.gameRowIndex === 1), "empty slots are not REST beats");

const mixed = build([
  sourceBeat(0, "SINGLE", 1, true, { signature: { numerator: 3, denominator: 4 } }),
  sourceBeat(1, "EVEN_2", 2, true, { signature: { numerator: 3, denominator: 4 } }),
  sourceBeat(2, "EVEN_4", 4, true, { signature: { numerator: 3, denominator: 4 } }),
  sourceBeat(3, "TRIPLET", 3, true, { measure: 2, beat: 1, signature: { numerator: 2, denominator: 2 } })
]);
check(mixed.compatible && mixed.rows.length === 1 && mixed.beats[3].timeSignature.denominator === 2, "mixed signatures remain playable and preserved");
check(mixed.beats.every((beat) => beat.tempo === 120), "original beat tempo is preserved");

const mapping = build([
  sourceBeat(0, "SINGLE", 1), sourceBeat(1, "OTHER", null, false, { reason: "UNSUPPORTED_PATTERN" }),
  sourceBeat(2, "REST", null), sourceBeat(3, "TRIPLET", 3)
]);
check(mapping.beats[0].playDice === 1 && !mapping.beats[0].isDummy, "real Dice 1 is not DUMMY");
check(mapping.beats[1].playDice === 1 && mapping.beats[1].isDummy && !mapping.beats[1].isFallback, "OTHER maps to DUMMY Dice 1");
check(mapping.beats[2].playDice === null && mapping.beats[2].isRest && !mapping.beats[2].isDummy, "REST remains no input");
check(mapping.beats[3].playDice === 3 && !mapping.beats[3].isDummy, "TRIPLET remains real Dice 3");
check(MidiGameChart.judgeDummy(1, false).assist, "one correct DUMMY tap is ASSIST");
check(!MidiGameChart.judgeDummy(0, false).assist && !MidiGameChart.judgeDummy(1, true).assist && !MidiGameChart.judgeDummy(2, false).assist, "DUMMY skip, wrong input, or extra input are not ASSIST");
check(mapping.statistics.realDiceBeats === 2 && mapping.statistics.dummyBeats === 1 && mapping.statistics.restBeats === 1, "real, dummy, and rest statistics are separate");
check(mapping.statistics.realDiceActiveRate === 66.7 && mapping.statistics.dummyRate === 33.3 && mapping.statistics.restRate === 25, "Phase 4E rates use active and total denominators");

const silent = build(Array.from({ length: 4 }, (_, index) => sourceBeat(index, "REST", null)), "1");
const dummyHeavy = build([sourceBeat(0, "OTHER", null, false), sourceBeat(1, "OTHER", null, false), sourceBeat(2, "SINGLE", 1), sourceBeat(3, "REST", null)], "2");
const realHeavy = build([sourceBeat(0, "SINGLE", 1), sourceBeat(1, "EVEN_2", 2), sourceBeat(2, "EVEN_4", 4), sourceBeat(3, "REST", null)], "3");
check(MidiGameChart.recommend([silent, dummyHeavy, realHeavy]) === realHeavy, "recommendation excludes silent and prioritizes real Dice then low DUMMY");
check(MidiGameChart.beatAtTick(twoTwo, 1920).measure === 2, "tick lookup follows preserved non-4/4 timing");
check(!MidiGameChart.judgeRest(0).miss && MidiGameChart.judgeRest(1).miss, "REST judge behavior is unchanged");

console.log(JSON.stringify({ tests: 17, assertions, result: "PASS" }));