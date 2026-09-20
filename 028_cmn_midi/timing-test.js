global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/midi-timing.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-core.js", "utf8"));
eval(fs.readFileSync(__dirname + "/midi-edit.js", "utf8"));

const ppq = 480;
const approx = (actual, expected, tolerance = 1e-6) => Math.abs(actual - expected) <= tolerance;
const note = (number, startTick, durationTicks = 240) => ({ noteNumber: number, noteName: MidiCore.noteName(number), channel: 0, startTick, endTick: startTick + durationTicks, durationTicks, velocity: 96 });
function makeSong(title, tempoEvents, signatureEvents, endTick) {
  const shell = { title, fileName: `${title}.mid`, format: 1, ppq, bpm: 120, timeSignature: { numerator: 4, denominator: 4 } };
  shell.tempoMap = MidiTiming.buildTempoMap(tempoEvents, ppq, 120);
  shell.timeSignatureMap = MidiTiming.buildTimeSignatureMap(signatureEvents, ppq, shell.timeSignature);
  shell.bpm = shell.tempoMap[0].bpm; shell.timeSignature = shell.timeSignatureMap[0]; shell.keepTicks = true; shell.endTick = endTick;
  const starts = [...new Set([0, ...tempoEvents.map((event) => event.tick), ...signatureEvents.map((event) => event.tick), Math.max(0, endTick - 480)])].sort((a, b) => a - b);
  const notes = starts.map((tick, index) => note(60 + index, tick));
  notes.forEach((item) => { item.startTime = MidiTiming.tickToSeconds(shell, item.startTick); item.duration = MidiTiming.tickToSeconds(shell, item.endTick) - item.startTime; });
  shell.tracks = [{ id: 0, name: "Timing", channel: 0, channels: [0], program: 0, programs: [0], instrumentName: "Piano", enabled: true, notes }];
  shell.totalNotes = notes.length; shell.duration = MidiTiming.tickToSeconds(shell, endTick); return shell;
}

const tempoTest = makeSong("tempo-test", [
  { tick: 0, bpm: 120 }, { tick: 3840, bpm: 150 }, { tick: 7680, bpm: 90 }
], [{ tick: 0, numerator: 4, denominator: 4 }], 11520);
const signatureTest = makeSong("signature-test", [{ tick: 0, bpm: 120 }], [
  { tick: 0, numerator: 4, denominator: 4 }, { tick: 3840, numerator: 3, denominator: 4 }, { tick: 6720, numerator: 5, denominator: 4 }
], 11520);
const mixedTest = makeSong("mixed-test", [
  { tick: 0, bpm: 120 }, { tick: 3840, bpm: 150 }, { tick: 6720, bpm: 90 }
], [
  { tick: 0, numerator: 4, denominator: 4 }, { tick: 3840, numerator: 3, denominator: 4 }, { tick: 6720, numerator: 5, denominator: 4 }
], 11520);

const assertions = [];
const check = (ok, name) => assertions.push([Boolean(ok), name]);
check(tempoTest.tempoMap.length === 3 && tempoTest.tempoMap.map((item) => Math.round(item.bpm)).join() === "120,150,90", "tempo map");
check(signatureTest.timeSignatureMap.length === 3 && signatureTest.timeSignatureMap.map((item) => `${item.numerator}/${item.denominator}`).join() === "4/4,3/4,5/4", "signature map");
check(approx(MidiTiming.tickToSeconds(tempoTest, 3840), 4), "tickToSeconds first boundary");
check(approx(MidiTiming.tickToSeconds(tempoTest, 7680), 7.2), "tickToSeconds second boundary");
for (const tick of [0, 960, 3839, 3840, 5200, 7679, 7680, 10000, 11520]) check(approx(MidiTiming.secondsToTick(tempoTest, MidiTiming.tickToSeconds(tempoTest, tick)), tick, 1e-5), `tick seconds roundtrip ${tick}`);
check(MidiTiming.tickToBarBeat(signatureTest, 0).bar === 1, "bar one");
check(MidiTiming.tickToBarBeat(signatureTest, 3840).bar === 3 && MidiTiming.tickToBarBeat(signatureTest, 3840).numerator === 3, "3/4 boundary");
check(MidiTiming.tickToBarBeat(signatureTest, 6720).bar === 5 && MidiTiming.tickToBarBeat(signatureTest, 6720).numerator === 5, "5/4 boundary");
check(MidiTiming.barBeatToTick(signatureTest, 3, 1, 0) === 3840, "barBeatToTick bar3");
check(MidiTiming.barBeatToTick(signatureTest, 5, 1, 0) === 6720, "barBeatToTick bar5");
for (const [bar, beat, fraction] of [[1,1,0],[2,3,0.5],[3,2,0.25],[4,3,0.75],[5,5,0.5],[6,1,0]]) { const tick = MidiTiming.barBeatToTick(signatureTest, bar, beat, fraction), value = MidiTiming.tickToBarBeat(signatureTest, tick); check(value.bar === bar && value.beat === beat && approx(value.beatFraction, fraction), `bar beat roundtrip ${bar}:${beat}`); }

const session = MidiEdit.createSession(mixedTest, 0, 8, 2);
let bounds = MidiEdit.sectionBounds(session);
check(bounds.startTick === 0 && bounds.endTick === 3840 && bounds.stepTicks.length === 16, "bars1-2 bounds");
session.sectionStartBar = 2; bounds = MidiEdit.sectionBounds(session);
check(bounds.startTick === 3840 && bounds.endTick === 6720 && bounds.stepTicks.length === 12, "bars3-4 bounds");
let section = MidiEdit.sectionSong(session);
check(approx(section.duration, 2.4), "3/4 section loop duration");
session.sectionStartBar = 4; bounds = MidiEdit.sectionBounds(session);
check(bounds.startTick === 6720 && bounds.endTick === 11520 && bounds.stepTicks.length === 20, "bars5-6 bounds");
section = MidiEdit.sectionSong(session);
check(approx(section.duration, 20 / 3), "5/4 section loop duration");

const intraSection = makeSong("intra-section", [{ tick: 0, bpm: 120 }, { tick: 2400, bpm: 180 }], [{ tick: 0, numerator: 4, denominator: 4 }], 3840);
intraSection.tracks[0].notes.push(note(72, 2880)); intraSection.totalNotes++;
const intraSession = MidiEdit.createSession(intraSection, 0, 8, 2), intraPreview = MidiEdit.sectionSong(intraSession);
const afterChange = intraPreview.tracks[0].notes.find((item) => item.noteNumber === 72);
const expectedAfterChange = MidiTiming.tickToSeconds(intraSection, 2880);
check(approx(afterChange.startTime, expectedAfterChange), "note timing after tempo change");
const playheadTick = MidiTiming.secondsToTick(intraPreview, afterChange.startTime), playheadStep = Math.floor(playheadTick / intraSession.ticksPerStep + 1e-6);
check(playheadStep === 12, "tempo-aware playhead step");
check(approx(intraPreview.duration, MidiTiming.tickToSeconds(intraSection, 3840)), "intra-section loop length");

const reparsed = MidiCore.parse(MidiCore.write(mixedTest), "mixed-roundtrip.mid");
check(reparsed.tempoMap.map((item) => `${item.tick}:${Math.round(item.bpm)}`).join() === "0:120,3840:150,6720:90", "saved tempo map");
check(reparsed.timeSignatureMap.map((item) => `${item.tick}:${item.numerator}/${item.denominator}`).join() === "0:4/4,3840:3/4,6720:5/4", "saved signature map");
check(reparsed.tracks.find((track) => track.name === "Timing").notes.length === mixedTest.tracks[0].notes.length, "saved notes");
const fixtureDirectory = `${__dirname}/test-data`;
const loadFixture = (name) => { const bytes = fs.readFileSync(`${fixtureDirectory}/${name}`); return MidiCore.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), name); };
const tempoFixture = loadFixture("tempo-test.mid"), signatureFixture = loadFixture("time-signature-test.mid"), mixedFixture = loadFixture("mixed-test.mid");
check(tempoFixture.tempoMap.map((item) => Math.round(item.bpm)).join() === "120,150,90", "tempo fixture file");
check(signatureFixture.timeSignatureMap.map((item) => `${item.numerator}/${item.denominator}`).join() === "4/4,3/4,5/4", "signature fixture file");
check(mixedFixture.tempoMap.length === 3 && mixedFixture.timeSignatureMap.length === 3, "mixed fixture file");

const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
if (failed.length) throw new Error(`Timing test failed: ${failed.join(", ")}`);
console.log(JSON.stringify({ assertions: assertions.length, fixtureFiles: 3, tempoMap: reparsed.tempoMap.length, signatureMap: reparsed.timeSignatureMap.length, bars34Steps: 12, bars56Steps: 20, playheadStep, maxTickRoundtripError: 1e-5 }));
