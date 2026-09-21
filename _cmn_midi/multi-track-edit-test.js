global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-timing.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-edit.js", "utf8"));

const ppq = 480, bar = ppq * 4, endTick = bar * 10;
const source = {
  title: "multi-track-edit", fileName: "multi-track-edit.mid", format: 1, ppq, bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 }, tempoMap: [{ tick: 0, bpm: 120 }],
  timeSignatureMap: [{ tick: 0, numerator: 4, denominator: 4 }], keepTicks: true, endTick
};
source.tempoMap = MidiTiming.buildTempoMap(source.tempoMap, ppq);
source.timeSignatureMap = MidiTiming.buildTimeSignatureMap(source.timeSignatureMap, ppq);
const makeTrack = (id, name, channel, program, pitch) => {
  const notes = Array.from({ length: 10 }, (_, index) => ({ noteNumber: pitch, noteName: MidiCore.noteName(pitch), channel, startTick: index * bar, endTick: index * bar + 240, durationTicks: 240, velocity: 80 }));
  notes.forEach((note) => { note.startTime = MidiTiming.tickToSeconds(source, note.startTick); note.duration = MidiTiming.tickToSeconds(source, note.endTick) - note.startTime; });
  return { id, name, channel, channels: [channel], program, programs: [program], instrumentName: name, enabled: true, notes, rawEvents: [] };
};
source.tracks = [makeTrack(0, "Piano", 0, 0, 60), makeTrack(1, "Bass", 1, 32, 36), makeTrack(2, "Drums", 9, 0, 42)];
source.totalNotes = 30; source.duration = MidiTiming.tickToSeconds(source, endTick);

const workspace = MidiEdit.createWorkspace(source);
const piano = MidiEdit.createSession(workspace, 0, 16, 2); piano.sectionStartBar = 4; MidiEdit.toggleCell(piano, 64, 1, 101);
const bass = MidiEdit.createSession(workspace, 1, 8, 2); bass.sectionStartBar = 0; MidiEdit.toggleCell(bass, 40, 2, 102);
const drums = MidiEdit.createSession(workspace, 2, 16, 2); drums.sectionStartBar = 8; MidiEdit.toggleCell(drums, 46, 3, 103);
const restoredPiano = MidiEdit.createSession(workspace, 0, 8, 2);
const states = MidiEdit.workspaceStates(workspace);
workspace.sessions.forEach((session) => MidiEdit.refreshSong(session));
const reparsed = MidiCore.parse(MidiCore.write(workspace.song), "multi-track-edited.mid");
const find = (name) => reparsed.tracks.find((track) => track.name === name);

const assertions = [
  [restoredPiano === piano, "same piano session"],
  [restoredPiano.noteUnit === 16, "piano quantize restored"],
  [restoredPiano.sectionStartBar === 4, "piano bar restored"],
  [bass.noteUnit === 8 && bass.sectionStartBar === 0, "bass state"],
  [drums.noteUnit === 16 && drums.sectionStartBar === 8, "drums state"],
  [states.filter((state) => state.modified).length === 3, "three modified tracks"],
  [find("Piano").notes.some((note) => note.noteNumber === 64 && note.velocity === 101), "saved piano edit"],
  [find("Bass").notes.some((note) => note.noteNumber === 40 && note.velocity === 102), "saved bass edit"],
  [find("Drums").notes.some((note) => note.noteNumber === 46 && note.velocity === 103), "saved drum edit"]
];
MidiEdit.markWorkspaceSaved(workspace);
assertions.push([MidiEdit.workspaceStates(workspace).every((state) => state.saved && !state.modified), "saved states"]);
const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) throw new Error(`Multi-track edit test failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ tracksEdited: 3, pianoQuantize: 16, bassQuantize: 8, drumsQuantize: 16, pianoBar: 5, bassBar: 1, drumsBar: 9, editsAfterReload: 3 }));
