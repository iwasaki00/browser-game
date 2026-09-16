global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));

function roundTrip({ steps, noteUnit, velocity, placements }) {
  const pitches = [72, 71, 69, 67, 65, 64, 62, 60];
  const grid = pitches.map(() => Array(steps).fill(false));
  placements.forEach(([row, step]) => { grid[row][step] = true; });
  const source = MidiCore.createStepSong({ title: "test", bpm: 120, numerator: 4, denominator: 4, noteUnit, velocity, steps, pitches, grid });
  const buffer = MidiCore.write(source);
  return { source, buffer, parsed: MidiCore.parse(buffer, "roundtrip.mid") };
}

const scale = roundTrip({ steps: 8, noteUnit: 8, velocity: 96, placements: [[7,0],[6,1],[5,2],[4,3],[3,4],[2,5],[1,6],[0,7]] });
const chord = roundTrip({ steps: 16, noteUnit: 16, velocity: 110, placements: [[7,0],[5,0],[3,0],[7,8]] });
const quarter = MidiCore.stepIndexToTime(1, 120, 4);
const assertions = [
  [scale.parsed.format === 1, "format"], [scale.parsed.totalNotes === 8, "note count"], [scale.parsed.bpm === 120, "BPM"],
  [scale.parsed.ppq === 480, "PPQ"], [scale.parsed.tracks[1].notes[0].velocity === 96, "velocity"],
  [scale.parsed.tracks[1].notes[7].noteNumber === 72, "last note"], [scale.parsed.tracks[1].notes[1].startTime === 0.25, "1/8 timing"],
  [scale.parsed.duration === scale.source.duration, "sequence duration"], [quarter.musicalTime === 1 && quarter.seconds === 0.5, "1/4 conversion"],
  [chord.parsed.totalNotes === 4, "chord note count"], [chord.parsed.tracks[1].notes.filter((note) => note.startTime === 0).length === 3, "same-step chord"],
  [chord.parsed.tracks[1].notes[3].startTime === 1, "1/16 timing"], [chord.parsed.tracks[1].notes[0].velocity === 110, "chord velocity"],
  [chord.parsed.duration === chord.source.duration, "1/16 duration"]
];
const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) throw new Error(`Round-trip failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ bytes: scale.buffer.byteLength, format: scale.parsed.format, bpm: scale.parsed.bpm, notes: scale.parsed.totalNotes, duration: scale.parsed.duration, timing: scale.parsed.tracks[1].notes[1].startTime, chordNotes: chord.parsed.totalNotes }));
