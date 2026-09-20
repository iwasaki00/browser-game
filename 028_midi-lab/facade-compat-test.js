global.window = global;
const fs = require("fs");
const path = require("path");
const assert = require("assert");

for (const file of ["midi-timing.js", "midi-core.js", "midi-edit.js", "synth.js", "midi-api.js"]) {
  eval(fs.readFileSync(path.join(__dirname, file), "utf8"));
}

const fixture = fs.readFileSync(path.join(__dirname, "test-data", "mixed-test.mid"));
const toArrayBuffer = () => fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength);
const legacySong = MidiCore.parse(toArrayBuffer(), "mixed-test.mid");
const facadeSong = MidiApi.parse(toArrayBuffer(), { fileName: "mixed-test.mid" });
assert.deepStrictEqual(facadeSong, legacySong, "Facade parse must equal legacy parse");

const legacyBytes = Buffer.from(new Uint8Array(MidiCore.write(legacySong)));
const facadeBytes = Buffer.from(new Uint8Array(MidiApi.write(facadeSong)));
assert(legacyBytes.equals(facadeBytes), "Facade write must be byte-identical to legacy write");

const tick = 6720;
assert.strictEqual(MidiApi.timing.tickToSeconds(facadeSong, tick), MidiTiming.tickToSeconds(legacySong, tick));
const seconds = MidiTiming.tickToSeconds(legacySong, tick);
assert.strictEqual(MidiApi.timing.secondsToTick(facadeSong, seconds), MidiTiming.secondsToTick(legacySong, seconds));
assert.deepStrictEqual(MidiApi.timing.tickToBarBeat(facadeSong, tick), MidiTiming.tickToBarBeat(legacySong, tick));
assert.strictEqual(MidiApi.timing.barBeatToTick(facadeSong, 5, 1, 0), MidiTiming.barBeatToTick(legacySong, 5, 1, 0));

const legacyWorkspace = MidiEdit.createWorkspace(legacySong);
const facadeWorkspace = MidiApi.editor.createWorkspace(facadeSong);
const trackIndex = legacySong.tracks.findIndex((track) => track.notes.length);
const legacySession = MidiEdit.createSession(legacyWorkspace, trackIndex, 8, 2);
const facadeSession = MidiApi.editor.createSession(facadeWorkspace, trackIndex, 8, 2);
assert.deepStrictEqual(MidiApi.editor.workspaceStates(facadeWorkspace), MidiEdit.workspaceStates(legacyWorkspace));
assert.strictEqual(facadeWorkspace.song.tracks.length, legacyWorkspace.song.tracks.length);
assert.strictEqual(facadeWorkspace.song.totalNotes, legacyWorkspace.song.totalNotes);
assert.strictEqual(facadeSession.noteUnit, legacySession.noteUnit);

const mockSynth = { context: null, stopAll() {}, async ensureContext() { return this.context; }, schedule() {} };
const transport = MidiApi.transport.create(mockSynth);
assert(transport instanceof MidiAudio.AudioClockPlayer, "Facade transport must wrap AudioClockPlayer");

const facadeSource = fs.readFileSync(path.join(__dirname, "midi-api.js"), "utf8");
for (const forbidden of ["document.", "querySelector", "alert(", "confirm(", "new Blob", "createElement"]) {
  assert(!facadeSource.includes(forbidden), `Facade must not contain DOM API: ${forbidden}`);
}

console.log(JSON.stringify({ parseDeepEqual: true, writeByteIdentical: true, writtenBytes: facadeBytes.length, timingEqual: true, editorEqual: true, trackCount: facadeWorkspace.song.tracks.length, noteCount: facadeWorkspace.song.totalNotes, transportWrapped: true, domIndependent: true }));
