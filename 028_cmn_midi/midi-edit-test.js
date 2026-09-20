global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-timing.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-edit.js", "utf8"));

const ppq = 480, bar = ppq * 4;
const note = (noteNumber, startTick, durationTicks, velocity, channel) => ({
  noteNumber, noteName: MidiCore.noteName(noteNumber), channel, startTick, endTick: startTick + durationTicks,
  durationTicks, startTime: startTick / ppq * 0.5, duration: durationTicks / ppq * 0.5, velocity
});
const source = {
  title: "edit-fixture", fileName: "edit-fixture.mid", format: 1, ppq, bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  tempoMap: [{ tick: 0, time: 0, bpm: 120, microseconds: 500000 }, { tick: bar * 4, time: 8, bpm: 100, microseconds: 600000 }],
  timeSignatureMap: [{ tick: 0, numerator: 4, denominator: 4 }], keepTicks: true, endTick: bar * 8, duration: 17.6,
  tracks: [
    { id: 0, name: "Piano", channel: 0, channels: [0], program: 0, programs: [0], instrumentName: "Acoustic Grand Piano", enabled: true, notes: [
      note(60, 10, 720, 83, 0), note(64, 10, 360, 91, 0), note(67, 10, 480, 99, 0),
      ...Array.from({ length: 8 }, (_, i) => note(62 + (i % 5), i * bar + 245, 600, 70 + i, 0))
    ] },
    { id: 1, name: "Bass", channel: 1, channels: [1], program: 32, programs: [32], instrumentName: "Acoustic Bass", enabled: true, notes: Array.from({ length: 8 }, (_, i) => note(36, i * bar, 900, 88, 1)) },
    { id: 2, name: "Drum", channel: 9, channels: [9], program: 0, programs: [], instrumentName: "Drum Kit", enabled: true, notes: Array.from({ length: 16 }, (_, i) => note(i % 2 ? 38 : 36, i * ppq, 120, 100, 9)) }
  ], totalNotes: 27
};
const parsed = MidiCore.parse(MidiCore.write(source), "edit-fixture.mid");
const pianoIndex = parsed.tracks.findIndex((track) => track.name === "Piano");
const bassBefore = parsed.tracks.find((track) => track.name === "Bass").notes.map((n) => [n.noteNumber,n.startTick,n.durationTicks,n.velocity]);
const drumBefore = parsed.tracks.find((track) => track.name === "Drum").notes.map((n) => [n.noteNumber,n.startTick,n.durationTicks,n.velocity]);
const session = MidiEdit.createSession(parsed, pianoIndex, 8, 2);
const firstGrid = MidiEdit.gridForSection(session);
const cRow = session.pitches.indexOf(60), eRow = session.pitches.indexOf(64), gRow = session.pitches.indexOf(67);
const chordAtStart = [cRow,eRow,gRow].every((row) => row >= 0 && firstGrid[row][0]);
const originalDurationTicks = session.song.tracks[pianoIndex].notes.find((n) => n.noteNumber === 60)._durationTicks;
const quantizedSecond = session.song.tracks[pianoIndex].notes.find((n) => n.noteNumber === 62 && n._editStep === 1);

session.sectionStartBar = 2;
const beforeCount = session.song.tracks[pianoIndex].notes.length;
MidiEdit.toggleCell(session, 61, 0, 111);
const addedStep = session.sectionStartBar * session.stepsPerBar;
session.sectionStartBar = 0;
MidiEdit.gridForSection(session);
session.sectionStartBar = 2;
const returnedGrid = MidiEdit.gridForSection(session);
const addedRow = session.pitches.indexOf(61);
const persisted = addedRow >= 0 && returnedGrid[addedRow][0] && session.song.tracks[pianoIndex].notes.some((n) => n.noteNumber === 61 && n._editStep === addedStep && n.velocity === 111);
const section = MidiEdit.sectionSong(session);
const sectionLocal = section.tracks[0].notes.find((n) => n.noteNumber === 61 && n.stepIndex === 0)?.startTime === 0;
session.sectionStartBar = 0;
const removedExisting = MidiEdit.toggleCell(session, 60, 0, 100) === false;
const comparison = MidiEdit.comparison(session);
MidiEdit.refreshSong(session);
const reparsed = MidiCore.parse(MidiCore.write(session.song), "edited.mid");
const bassAfter = reparsed.tracks.find((track) => track.name === "Bass").notes.map((n) => [n.noteNumber,n.startTick,n.durationTicks,n.velocity]);
const drumAfter = reparsed.tracks.find((track) => track.name === "Drum").notes.map((n) => [n.noteNumber,n.startTick,n.durationTicks,n.velocity]);
const pianoAfter = reparsed.tracks.find((track) => track.name === "Piano");

const assertions = [
  [parsed.tracks.filter((t) => t.notes.length).length === 3, "three tracks"],
  [session.totalBars >= 8, "eight bars"],
  [session.sectionSteps === 16, "two-bar window"],
  [chordAtStart, "chord expansion"],
  [originalDurationTicks === 720, "original duration"],
  [quantizedSecond?.startTick === 240, "tick quantize"],
  [persisted, "section edit persistence"],
  [sectionLocal, "section-local playback"],
  [removedExisting, "existing note deletion"],
  [comparison.added === 1 && comparison.deleted === 1 && comparison.edited === beforeCount, "comparison"],
  [MidiEdit.stepTicks(ppq, 4) === 480 && MidiEdit.stepTicks(ppq, 8) === 240 && MidiEdit.stepTicks(ppq, 16) === 120, "quantize units"],
  [reparsed.bpm === 120, "BPM"],
  [reparsed.tempoMap.some((tempo) => tempo.tick === bar * 4 && Math.round(tempo.bpm) === 100), "tempo map"],
  [JSON.stringify(bassAfter) === JSON.stringify(bassBefore), "unedited bass"],
  [JSON.stringify(drumAfter) === JSON.stringify(drumBefore), "unedited drums"],
  [pianoAfter.notes.some((n) => n.noteNumber === 61 && n.startTick === addedStep * session.ticksPerStep && n.velocity === 111), "saved edit"],
  [reparsed.tracks.filter((t) => t.notes.length).length === 3, "no duplicated meta track"]
];
const failed = assertions.filter(([ok]) => !ok).map(([,name]) => name);
if (failed.length) throw new Error(`MIDI edit test failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ tracks: 3, bars: session.totalBars, sectionSteps: session.sectionSteps, chordAtStart, quantizedTick: quantizedSecond.startTick, added: comparison.added, deleted: comparison.deleted, bassPreserved: true, drumsPreserved: true, tempoChanges: reparsed.tempoMap.length }));
