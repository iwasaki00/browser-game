"use strict";

const MidiChartDiagnostics = require("./midi-chart-diagnostics.js");
const MidiDiceChartGenerator = require("./midi-dice-chart-generator.js");
const MidiGameChart = require("./midi-game-chart.js");

const ppq = 480;
const timing = { tickToSeconds: (_song, tick) => tick / ppq * 0.5, tickToBarBeat: (_song, tick) => ({ bar: Math.floor(tick / (ppq * 4)) + 1, beat: Math.floor((tick % (ppq * 4)) / ppq) + 1 }) };
function beat(pattern, positions, index = 0) { return { index, measure: 1, beat: index + 1, startTick: index * ppq, endTick: (index + 1) * ppq, startTime: index * 0.5, endTime: (index + 1) * 0.5, tempo: 120, timeSignature: { numerator: 4, denominator: 4 }, rawNoteCount: positions.length, onsetCount: positions.length, onsetPositions: positions, pattern, diceCandidate: positions.length ? String(positions.length) : "-", trackBreakdown: [] }; }
function analysis(beats) { return { fileName: "test.mid", selection: "0", track: { value: "0", label: "Track 1" }, beats }; }
class FakeAnalyzer {
  constructor(song) { this.song = song; }
  analyze() { return analysis(this.song.testBeats || [beat("REST", [])]); }
}
function diagnostics(beats) {
  const song = { fileName: "test.mid", format: 1, ppq, endTick: ppq * beats.length, tracks: [{ name: "Test", notes: [], channels: [] }], testBeats: beats };
  return new MidiChartDiagnostics(song, { Analyzer: FakeAnalyzer, Generator: MidiDiceChartGenerator, GameChart: MidiGameChart, timing });
}
function assert(value, message) { if (!value) throw new Error(message); }

const exactCases = [["SINGLE", [0], 1], ["EVEN_2", [0, 0.5], 2], ["TRIPLET", [0, 1 / 3, 2 / 3], 3], ["EVEN_4", [0, 0.25, 0.5, 0.75], 4]];
exactCases.forEach(([pattern, positions, dice]) => { const result = diagnostics([]).classify(beat(pattern, positions)); assert(result.nearestDice === dice && result.confidence === "EXACT", `${pattern} exact`); });
[[[0.05, 0.45], 2], [[0.05, 0.38, 0.62], 3], [[0.05, 0.30, 0.45, 0.80], 4]].forEach(([positions, dice]) => { const result = diagnostics([]).classify(beat("OTHER", positions)); assert(result.nearestDice === dice && result.confidence === "NEAR", `Dice ${dice} near`); });
const offbeat = diagnostics([]).classify(beat("OTHER", [0.25, 0.75]));
assert(offbeat.confidence !== "EXACT" && !offbeat.gameCompatible && offbeat.firstOnsetPosition === 0.25, "offbeat pair is not exact/compatible");

const benefitBeats = [beat("SINGLE", [0], 0), beat("TRIPLET", [0, 1 / 3, 2 / 3], 1), beat("REST", [], 2), beat("OTHER", [0.25, 0.75], 3)];
const engine = diagnostics(benefitBeats);
const charts = engine.buildFromAnalysis(analysis(benefitBeats));
const unit = engine.diagnoseUnit(analysis(benefitBeats), charts.candidate, charts.game, { sourceType: "TRACK", trackNumber: 1, trackName: "Test", channel: null });
assert(unit.summary.currentPlayableActiveRate === 66.7 && unit.summary.withDice3PlayableActiveRate === 66.7 && unit.summary.dice3BenefitPoints === 0 && unit.summary.dummyBeats === 1, "Dice3 and DUMMY Phase 4E summary");
const silentEngine = diagnostics([beat("REST", [])]);
const silentReport = silentEngine.diagnose();
assert(silentReport.summary[0].silent && silentReport.summary[0].dice3BenefitPoints === null, "silent excluded");

const channelSong = { fileName: "type0.mid", format: 0, ppq, endTick: ppq, tracks: [{ name: "Mixed", channels: [0, 9], notes: [{ channel: 0 }, { channel: 9 }] }], testBeats: [beat("SINGLE", [0])] };
const channelReport = new MidiChartDiagnostics(channelSong, { Analyzer: FakeAnalyzer, Generator: MidiDiceChartGenerator, GameChart: MidiGameChart, timing }).diagnose();
assert(channelReport.channels.length === 2 && channelReport.channelSummary.some((item) => item.channel === 10), "channel diagnostics");

console.log(JSON.stringify({ tests: 11, assertions: 11, result: "PASS" }));
