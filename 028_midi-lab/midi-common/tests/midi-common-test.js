global.window = global;
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "../..");
for (const file of ["midi-timing.js", "midi-core.js", "midi-common/midi-timing.js", "midi-common/midi-common.js"]) {
  eval(fs.readFileSync(path.join(root, file), "utf8"));
}

const baseline = JSON.parse(fs.readFileSync(path.join(root, "baseline/songdata-baseline.json"), "utf8"));
const fixtures = ["tempo-test.mid", "time-signature-test.mid", "mixed-test.mid", "event-preservation-test.mid"];
const arrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const clean = (value) => JSON.parse(JSON.stringify(value));

function normalizeLegacy(song) {
  const normalized = clean(song);
  normalized.tracks.forEach((track, index) => {
    track.index = index;
    delete track.enabled;
    track.notes.forEach((note) => { note.endTime = note.startTime + note.duration; });
  });
  return normalized;
}

for (const name of fixtures) {
  const bytes = fs.readFileSync(path.join(root, "test-data", name));
  const legacy = MidiCore.parse(arrayBuffer(bytes), name);
  const common = MidiCommon.parse(arrayBuffer(bytes), { fileName: name });
  assert.deepStrictEqual(clean(common), normalizeLegacy(legacy), `${name}: MidiCommon must equal normalized legacy parse`);

  const expected = baseline[name].parsed;
  assert.strictEqual(common.ppq, expected.ppq, `${name}: PPQ`);
  assert.strictEqual(common.bpm, expected.bpm, `${name}: BPM`);
  assert.strictEqual(common.endTick, expected.endTick, `${name}: endTick`);
  assert.strictEqual(common.duration, expected.duration, `${name}: duration`);
  assert.strictEqual(common.totalNotes, expected.totalNotes, `${name}: totalNotes`);
  assert.strictEqual(common.tracks.length, expected.trackCount, `${name}: track count`);
  assert.deepStrictEqual(clean(common.tempoMap), clean(legacy.tempoMap), `${name}: tempo map`);
  assert.deepStrictEqual(clean(common.timeSignatureMap), clean(legacy.timeSignatureMap), `${name}: signature map`);

  common.tracks.forEach((track, index) => {
    assert.strictEqual(track.index, index, `${name}: track index`);
    assert.strictEqual(MidiCommon.getTrack(common, track.id), track, `${name}: getTrack`);
    assert.strictEqual(MidiCommon.getNotes(common, track.id), track.notes, `${name}: getNotes`);
    assert(!Object.prototype.hasOwnProperty.call(track, "enabled"), `${name}: UI enabled must be absent`);
    track.notes.forEach((note) => {
      assert.strictEqual(note.endTime, note.startTime + note.duration, `${name}: endTime`);
      for (const key of ["_sourceId", "_gridTick", "_editStep", "_durationTicks"]) assert(!Object.prototype.hasOwnProperty.call(note, key), `${name}: ${key} must be absent`);
    });
  });

  for (const tick of [0, Math.round(common.endTick / 3), common.endTick]) {
    assert.strictEqual(MidiCommon.tickToSeconds(common, tick), MidiTiming.tickToSeconds(legacy, tick), `${name}: tickToSeconds`);
    const seconds = MidiCommon.tickToSeconds(common, tick);
    assert.strictEqual(MidiCommon.secondsToTick(common, seconds), MidiTiming.secondsToTick(legacy, seconds), `${name}: secondsToTick`);
    assert.deepStrictEqual(MidiCommon.tickToBarBeat(common, tick), MidiTiming.tickToBarBeat(legacy, tick), `${name}: tickToBarBeat`);
  }
}

const mixedBytes = fs.readFileSync(path.join(root, "test-data/mixed-test.mid"));
const sample = MidiCommon.parse(arrayBuffer(mixedBytes), { fileName: "mixed-test.mid" });
const position = MidiCommon.tickToBarBeat(sample, 6720);
assert.strictEqual(MidiCommon.barBeatToTick(sample, position.bar, position.beat, position.beatFraction), 6720);
assert.strictEqual(MidiCommon.noteName(60), "C4");
assert.strictEqual(MidiCommon.VERSION, "0.1.0");
assert.strictEqual(MidiCommon.getTracks(sample), sample.tracks);
assert.strictEqual(MidiCommon.getNotes(sample).length, sample.totalNotes);
assert.strictEqual(MidiCommon.write, undefined, "Writer must not be public");

const type0 = new Uint8Array([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 31,
  0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20,
  0, 0xff, 0x58, 4, 4, 2, 24, 8,
  0, 0xc0, 0,
  0, 0x90, 60, 100,
  0x83, 0x60, 0x80, 60, 0,
  0, 0xff, 0x2f, 0
]);
const type0Song = MidiCommon.parse(type0.buffer, { fileName: "type0.mid" });
assert.strictEqual(type0Song.format, 0);
assert.strictEqual(type0Song.tracks.length, 1);
assert.strictEqual(type0Song.totalNotes, 1);

const source = fs.readFileSync(path.join(root, "midi-common/midi-common.js"), "utf8") + fs.readFileSync(path.join(root, "midi-common/midi-timing.js"), "utf8");
for (const forbidden of ["document", "querySelector", "getElementById", "alert(", "confirm(", "classList", "AudioContext", "webkitAudioContext", "OscillatorNode", "GainNode"]) {
  assert(!source.includes(forbidden), `Runtime must not depend on ${forbidden}`);
}

console.log(JSON.stringify({ version: MidiCommon.VERSION, fixtures: fixtures.length, type0: true, legacyEquivalent: true, baselineEquivalent: true, timingEquivalent: true, tracks: sample.tracks.length, notes: sample.totalNotes, writerExcluded: true, domIndependent: true, audioIndependent: true }));
