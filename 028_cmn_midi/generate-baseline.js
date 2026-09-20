global.window = global;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

if (!global.MidiTiming) eval(fs.readFileSync(path.join(__dirname, "midi-timing.js"), "utf8"));
if (!global.MidiCore) eval(fs.readFileSync(path.join(__dirname, "midi-core.js"), "utf8"));
if (!global.MidiEdit) eval(fs.readFileSync(path.join(__dirname, "midi-edit.js"), "utf8"));

const FIXTURES = ["tempo-test.mid", "time-signature-test.mid", "mixed-test.mid", "event-preservation-test.mid"];
const round = (value) => Number.isFinite(value) ? Number(value.toFixed(9)) : value;
const arrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const hash = (value) => crypto.createHash("sha256").update(Buffer.from(new Uint8Array(value))).digest("hex");

function loadFixture(name) {
  const bytes = fs.readFileSync(path.join(__dirname, "test-data", name));
  return { bytes, song: MidiCore.parse(arrayBuffer(bytes), name) };
}

function rawEvent(event) {
  const fields = ["type", "tick", "order", "channel", "controller", "value", "program", "noteNumber", "metaType", "text", "status", "data"];
  return Object.fromEntries(fields.filter((field) => event[field] !== undefined).map((field) => [field, event[field]]));
}

function songSummary(song) {
  return {
    format: song.format,
    ppq: song.ppq,
    bpm: round(song.bpm),
    timeSignature: { numerator: song.timeSignature.numerator, denominator: song.timeSignature.denominator },
    duration: round(song.duration),
    endTick: song.endTick,
    totalNotes: song.totalNotes,
    trackCount: song.tracks.length,
    tempoMap: song.tempoMap.map((event) => ({ tick: event.tick, bpm: round(event.bpm), microsecondsPerQuarter: round(event.microsecondsPerQuarter), time: round(event.time) })),
    timeSignatureMap: song.timeSignatureMap.map((event) => ({ tick: event.tick, numerator: event.numerator, denominator: event.denominator, bar: event.bar })),
    tracks: song.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      channel: track.channel,
      channels: track.channels,
      program: track.program,
      programs: track.programs,
      instrumentName: track.instrumentName,
      enabled: track.enabled,
      endTick: track.endTick,
      notes: track.notes.map((note) => ({ noteNumber: note.noteNumber, noteName: note.noteName, channel: note.channel, startTick: note.startTick, endTick: note.endTick, durationTicks: note.durationTicks, startTime: round(note.startTime), duration: round(note.duration), velocity: note.velocity })),
      rawEvents: (track.rawEvents || []).map(rawEvent)
    }))
  };
}

function fixtureBaselines() {
  return Object.fromEntries(FIXTURES.map((name) => {
    const { bytes, song } = loadFixture(name), written = MidiCore.write(song), reparsed = MidiCore.parse(written, name);
    return [name, {
      input: { byteLength: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") },
      parsed: songSummary(song),
      written: { byteLength: written.byteLength, sha256: hash(written) },
      reparsed: songSummary(reparsed)
    }];
  }));
}

function timingBaseline() {
  return Object.fromEntries(FIXTURES.slice(0, 3).map((name) => {
    const { song } = loadFixture(name);
    const ticks = [...new Set([0, 120, 480, 960, 1920, 3839, 3840, 5200, 6720, 7679, 7680, song.endTick].filter((tick) => tick <= song.endTick))].sort((a, b) => a - b);
    const summary = songSummary(song);
    return [name, {
      tempoMap: summary.tempoMap,
      timeSignatureMap: summary.timeSignatureMap,
      conversions: ticks.map((tick) => {
        const seconds = MidiTiming.tickToSeconds(song, tick), position = MidiTiming.tickToBarBeat(song, tick);
        return { tick, seconds: round(seconds), roundTripTick: round(MidiTiming.secondsToTick(song, seconds)), bar: position.bar, beat: position.beat, beatFraction: round(position.beatFraction), numerator: position.numerator, denominator: position.denominator };
      })
    }];
  }));
}

function eventBaseline() {
  const { song } = loadFixture("event-preservation-test.mid"), written = MidiCore.write(song), reparsed = MidiCore.parse(written, "event-preservation-test.mid");
  const select = (value) => value.tracks.find((track) => track.rawEvents?.length), before = select(song), after = select(reparsed);
  return {
    trackName: before.name,
    beforeCounts: MidiCore.eventCounts(before),
    afterCounts: MidiCore.eventCounts(after),
    beforeEvents: before.rawEvents.map(rawEvent),
    afterEvents: after.rawEvents.map(rawEvent),
    byteIdenticalAfterWrite: Buffer.from(new Uint8Array(written)).equals(fs.readFileSync(path.join(__dirname, "test-data", "event-preservation-test.mid")))
  };
}

function editedSample() {
  const { song } = loadFixture("mixed-test.mid"), workspace = MidiEdit.createWorkspace(song);
  const trackIndex = workspace.song.tracks.findIndex((track) => track.notes.length), session = MidiEdit.createSession(workspace, trackIndex, 8, 2);
  session.sectionStartBar = Math.min(2, Math.max(0, session.totalBars - session.sectionBars));
  let added = null;
  for (const pitch of session.pitches) {
    for (let step = 0; step < MidiEdit.sectionBounds(session).stepTicks.length; step++) {
      if (!MidiEdit.notesAtCell(session, pitch, step).length) { MidiEdit.toggleCell(session, pitch, step, 103); added = { pitch, step }; break; }
    }
    if (added) break;
  }
  MidiEdit.refreshSong(session);
  return { workspace, session, added };
}

function editBaseline(sample) {
  const { workspace, session, added } = sample;
  return {
    trackCount: workspace.song.tracks.length,
    totalNotes: workspace.song.totalNotes,
    originalTotalNotes: workspace.originalTotalNotes,
    activeTrackIndex: session.trackIndex,
    noteUnit: session.noteUnit,
    ticksPerStep: session.ticksPerStep,
    sectionBars: session.sectionBars,
    sectionStartBar: session.sectionStartBar,
    totalBars: session.totalBars,
    dirty: session.dirty,
    saved: session.saved,
    added,
    comparison: MidiEdit.comparison(session),
    workspaceStates: MidiEdit.workspaceStates(workspace),
    temporaryNoteFields: [...new Set(workspace.song.tracks[session.trackIndex].notes.flatMap((note) => Object.keys(note).filter((key) => key.startsWith("_"))))].sort()
  };
}

function buildBaselines() {
  const sample = editedSample();
  return {
    "timing-baseline.json": timingBaseline(),
    "event-baseline.json": eventBaseline(),
    "edit-baseline.json": editBaseline(sample),
    "songdata-baseline.json": fixtureBaselines(),
    "songdata-sample.json": JSON.parse(JSON.stringify(sample.workspace.song))
  };
}

function writeBaselines(directory = path.join(__dirname, "baseline")) {
  fs.mkdirSync(directory, { recursive: true });
  const baselines = buildBaselines();
  Object.entries(baselines).forEach(([name, value]) => fs.writeFileSync(path.join(directory, name), `${JSON.stringify(value, null, 2)}\n`));
  return Object.keys(baselines);
}

if (require.main === module) console.log(JSON.stringify({ files: writeBaselines() }));
module.exports = { FIXTURES, buildBaselines, songSummary, writeBaselines };
