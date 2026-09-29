"use strict";

const MidiRhythmAnalyzer = require("./midi-rhythm-analyzer.js");
const ppq = 480;
const timing = {
  tickToSeconds: (_song, tick) => tick / ppq * 0.5,
  tickToBarBeat: (_song, tick) => ({ bar: Math.floor(tick / (ppq * 4)) + 1, beat: Math.floor((tick % (ppq * 4)) / ppq) + 1 })
};

function note(startTick, noteNumber = 60, channel = 0) {
  return { startTick, endTick: startTick + 120, noteNumber, channel };
}

function analyze(notes) {
  const song = {
    fileName: "test.mid",
    ppq,
    endTick: ppq,
    bpm: 120,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignatureMap: [{ tick: 0, numerator: 4, denominator: 4, bar: 1 }],
    tracks: [{ id: 0, name: "Test", channels: [0], instrumentName: "Piano", notes }]
  };
  return new MidiRhythmAnalyzer(song, { timing }).analyze("all").beats[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const single = analyze([note(0)]);
assert(single.rawNoteCount === 1 && single.onsetCount === 1, "single counts");
assert(single.pattern === "SINGLE" && single.diceCandidate === "1", "single classification");

const eighths = analyze([note(0), note(240, 62)]);
assert(eighths.rawNoteCount === 2 && eighths.onsetCount === 2, "eighth counts");
assert(eighths.onsetPositions.join() === "0,0.5", "eighth positions");
assert(eighths.pattern === "EVEN_2" && eighths.diceCandidate === "2", "eighth classification");

const sixteenths = analyze([note(0), note(120, 62), note(240, 64), note(360, 65)]);
assert(sixteenths.rawNoteCount === 4 && sixteenths.onsetCount === 4, "sixteenth counts");
assert(sixteenths.onsetPositions.join() === "0,0.25,0.5,0.75", "sixteenth positions");
assert(sixteenths.pattern === "EVEN_4" && sixteenths.diceCandidate === "4", "sixteenth classification");

const chord = analyze([note(0, 60), note(0, 64), note(0, 67), note(0, 72)]);
assert(chord.rawNoteCount === 4 && chord.onsetCount === 1, "chord onset grouping");
assert(chord.diceCandidate === "1", "chord dice candidate");

const triplet = analyze([note(0), note(160, 62), note(320, 64)]);
assert(triplet.onsetCount === 3, "triplet onset count");
assert(Math.abs(triplet.onsetPositions[1] - 1 / 3) < 0.001, "triplet middle position");
assert(triplet.pattern === "TRIPLET" && triplet.diceCandidate === "3", "triplet classification");

console.log(JSON.stringify({ tests: 5, assertions: 13, result: "PASS" }));
