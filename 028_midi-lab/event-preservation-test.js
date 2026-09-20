global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-timing.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-edit.js", "utf8"));

const bytes = fs.readFileSync(__dirname + "/test-data/event-preservation-test.mid");
const beforeSong = MidiCore.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "event-preservation-test.mid");
const trackIndex = beforeSong.tracks.findIndex((track) => track.name === "Event Track"), beforeTrack = beforeSong.tracks[trackIndex];
const workspace = MidiEdit.createWorkspace(beforeSong), session = MidiEdit.createSession(workspace, trackIndex, 8, 2);
MidiEdit.toggleCell(session, 67, 1, 111); MidiEdit.refreshSong(session);
const afterSong = MidiCore.parse(MidiCore.write(workspace.song), "event-preservation-edited.mid"), afterTrack = afterSong.tracks.find((track) => track.name === "Event Track");
const fields = ["type", "tick", "channel", "controller", "value", "program", "noteNumber", "metaType", "text", "status", "data"];
const signature = (track) => track.rawEvents.map((event) => Object.fromEntries(fields.filter((key) => event[key] !== undefined).map((key) => [key, event[key]])));
const beforeCounts = MidiCore.eventCounts(beforeTrack), afterCounts = MidiCore.eventCounts(afterTrack);
const sustainBefore = beforeTrack.rawEvents.filter((event) => event.type === "controlChange" && event.controller === 64).map((event) => [event.tick, event.value]);
const sustainAfter = afterTrack.rawEvents.filter((event) => event.type === "controlChange" && event.controller === 64).map((event) => [event.tick, event.value]);
const assertions = [
  [JSON.stringify(signature(beforeTrack)) === JSON.stringify(signature(afterTrack)), "raw event values"],
  [beforeCounts.controlChange === 6 && afterCounts.controlChange === 6, "control changes"],
  [beforeCounts.pitchBend === 3 && afterCounts.pitchBend === 3, "pitch bend"],
  [beforeCounts.aftertouch === 2 && afterCounts.aftertouch === 2, "aftertouch"],
  [beforeCounts.programChange === 3 && afterCounts.programChange === 3, "program changes"],
  [beforeCounts.lyrics === 2 && afterCounts.lyrics === 2, "lyrics"],
  [beforeCounts.sysex === 1 && afterCounts.sysex === 1, "sysex"],
  [JSON.stringify(sustainBefore) === JSON.stringify([[1000, 127], [3000, 0]]) && JSON.stringify(sustainAfter) === JSON.stringify(sustainBefore), "sustain"],
  [afterTrack.notes.length === beforeTrack.notes.length + 1, "note edit independent"],
  [MidiEdit.warnings(afterSong).some((warning) => warning.includes("SysEx 1件")), "sysex warning"]
];
const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) throw new Error(`Event preservation test failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ cc: [beforeCounts.controlChange, afterCounts.controlChange], sustain: [sustainBefore.length, sustainAfter.length], pitchBend: [beforeCounts.pitchBend, afterCounts.pitchBend], aftertouch: [beforeCounts.aftertouch, afterCounts.aftertouch], programChange: [beforeCounts.programChange, afterCounts.programChange], lyrics: [beforeCounts.lyrics, afterCounts.lyrics], sysex: [beforeCounts.sysex, afterCounts.sysex], other: [beforeCounts.other, afterCounts.other], notes: [beforeTrack.notes.length, afterTrack.notes.length] }));
