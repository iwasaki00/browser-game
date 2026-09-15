global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));

const pitches = [72, 71, 69, 67, 65, 64, 62, 60];
const grid = pitches.map(() => Array(8).fill(false));
[7, 6, 5, 4, 3, 2, 1, 0].forEach((row, step) => { grid[row][step] = true; });
const source = MidiCore.createStepSong({ title: "test", bpm: 120, numerator: 4, denominator: 4, noteUnit: 8, velocity: 96, steps: 8, pitches, grid });
const buffer = MidiCore.write(source);
const parsed = MidiCore.parse(buffer, "roundtrip.mid");
const assertions = [
  [parsed.format === 1, "format"], [parsed.totalNotes === 8, "note count"], [parsed.bpm === 120, "BPM"],
  [parsed.ppq === 480, "PPQ"], [parsed.tracks[1].notes[0].velocity === 96, "velocity"],
  [parsed.tracks[1].notes[7].noteNumber === 72, "last note"], [parsed.tracks[1].notes[1].startTime === 0.25, "timing"]
];
const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) throw new Error(`Round-trip failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ bytes: buffer.byteLength, format: parsed.format, tracks: parsed.tracks.length, bpm: parsed.bpm, notes: parsed.totalNotes, duration: parsed.duration, timing: parsed.tracks[1].notes[1].startTime }));
