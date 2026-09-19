global.window = global;
const fs = require("fs");
const path = require("path");
eval(fs.readFileSync(path.join(__dirname, "midi-timing.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "midi-core.js"), "utf8"));

const PPQ = 480;

function makeSong(title, tempoEvents, signatureEvents, endTick) {
  const song = {
    title, fileName: `${title}.mid`, format: 1, ppq: PPQ, bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 }, keepTicks: true, endTick
  };
  song.tempoMap = MidiTiming.buildTempoMap(tempoEvents, PPQ, 120);
  song.timeSignatureMap = MidiTiming.buildTimeSignatureMap(signatureEvents, PPQ, song.timeSignature);
  song.bpm = song.tempoMap[0].bpm; song.timeSignature = song.timeSignatureMap[0];
  const starts = Array.from({ length: 24 }, (_, index) => Math.round(index * endTick / 24));
  const notes = starts.map((startTick, index) => ({
    noteNumber: 60 + index % 8, noteName: MidiCore.noteName(60 + index % 8), channel: 0,
    startTick, endTick: startTick + 180, durationTicks: 180, velocity: 88
  }));
  notes.forEach((note) => { note.startTime = MidiTiming.tickToSeconds(song, note.startTick); note.duration = MidiTiming.tickToSeconds(song, note.endTick) - note.startTime; });
  song.tracks = [{ id: 0, name: "Timing Test", channel: 0, channels: [0], program: 0, programs: [0], instrumentName: "Acoustic Grand Piano", enabled: true, notes }];
  song.totalNotes = notes.length; song.duration = MidiTiming.tickToSeconds(song, endTick);
  return song;
}

const fixtures = {
  "tempo-test.mid": makeSong("tempo-test", [{ tick: 0, bpm: 120 }, { tick: 3840, bpm: 150 }, { tick: 7680, bpm: 90 }], [{ tick: 0, numerator: 4, denominator: 4 }], 11520),
  "time-signature-test.mid": makeSong("time-signature-test", [{ tick: 0, bpm: 120 }], [{ tick: 0, numerator: 4, denominator: 4 }, { tick: 3840, numerator: 3, denominator: 4 }, { tick: 6720, numerator: 5, denominator: 4 }], 11520),
  "mixed-test.mid": makeSong("mixed-test", [{ tick: 0, bpm: 120 }, { tick: 3840, bpm: 150 }, { tick: 6720, bpm: 90 }], [{ tick: 0, numerator: 4, denominator: 4 }, { tick: 3840, numerator: 3, denominator: 4 }, { tick: 6720, numerator: 5, denominator: 4 }], 11520)
};

const outputDirectory = path.join(__dirname, "test-data");
fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, song] of Object.entries(fixtures)) fs.writeFileSync(path.join(outputDirectory, name), Buffer.from(MidiCore.write(song)));
console.log(JSON.stringify({ outputDirectory, files: Object.keys(fixtures) }));
