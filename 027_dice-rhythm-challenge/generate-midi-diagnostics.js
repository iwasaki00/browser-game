"use strict";

const fs = require("fs");
const path = require("path");

global.window = global;
const projectDir = __dirname;
const repositoryDir = path.resolve(projectDir, "..");
eval(fs.readFileSync(path.join(repositoryDir, "_cmn_midi", "midi-timing.js"), "utf8"));
eval(fs.readFileSync(path.join(repositoryDir, "_cmn_midi", "midi-core.js"), "utf8"));
global.MidiCommon = {
  parse: (arrayBuffer, options = {}) => global.MidiCore.parse(arrayBuffer, typeof options === "string" ? options : options.fileName),
  tickToSeconds: (song, tick) => global.MidiTiming.tickToSeconds(song, tick),
  secondsToTick: (song, seconds) => global.MidiTiming.secondsToTick(song, seconds),
  tickToBarBeat: (song, tick) => global.MidiTiming.tickToBarBeat(song, tick)
};

const MidiRhythmAnalyzer = require("./midi-rhythm-analyzer.js");
const MidiDiceChartGenerator = require("./midi-dice-chart-generator.js");
const MidiGameChart = require("./midi-game-chart.js");
const MidiChartDiagnostics = require("./midi-chart-diagnostics.js");

const midiDir = path.join(projectDir, "assets", "midi");
const outputDir = path.join(projectDir, "diagnostics");
const library = JSON.parse(fs.readFileSync(path.join(midiDir, "library.json"), "utf8"));
const reports = [];

for (const entry of library) {
  const bytes = fs.readFileSync(path.join(midiDir, entry.file));
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const song = global.MidiCommon.parse(arrayBuffer, { fileName: entry.file });
  const analyzer = new MidiRhythmAnalyzer(song, { timing: global.MidiCommon });
  const diagnostics = new MidiChartDiagnostics(song, {
    analyzer,
    Analyzer: MidiRhythmAnalyzer,
    Generator: MidiDiceChartGenerator,
    GameChart: MidiGameChart,
    timing: global.MidiCommon
  }).diagnose();
  reports.push({ title: entry.title, ...diagnostics });
  process.stdout.write(`Diagnosed ${entry.file}: ${diagnostics.summary.length} tracks, ${diagnostics.channelSummary.length} channel units\n`);
}

const summaries = reports.flatMap((report) => report.summary.map((summary) => ({ song: report.song, title: report.title, midiFormat: report.midiFormat, ...summary })));
const channelSummaries = reports.flatMap((report) => report.channelSummary.map((summary) => ({ song: report.song, title: report.title, midiFormat: report.midiFormat, ...summary })));
const activeSummaries = summaries.filter((summary) => !summary.silent);
const totals = activeSummaries.reduce((result, item) => {
  ["totalBeats", "activeBeats", "realDiceBeats", "dummyBeats", "restBeats", "emptyEndSlots", "dice1", "dice2", "dice3", "dice4", "other", "rest", "fallback", "currentPlayableBeats", "withDice3PlayableBeats", "exact", "near", "ambiguous", "unsupported"].forEach((key) => { result[key] = (result[key] || 0) + item[key]; });
  Object.entries(item.otherOnsetCounts).forEach(([key, value]) => { result.otherOnsetCounts[key] = (result.otherOnsetCounts[key] || 0) + value; });
  Object.entries(item.otherNearest).forEach(([key, value]) => { result.otherNearest[key] = (result.otherNearest[key] || 0) + value; });
  return result;
}, { otherOnsetCounts: {}, otherNearest: {} });
totals.currentPlayableActiveRate = totals.activeBeats ? Number((totals.currentPlayableBeats / totals.activeBeats * 100).toFixed(1)) : null;
totals.withDice3PlayableActiveRate = totals.activeBeats ? Number((totals.withDice3PlayableBeats / totals.activeBeats * 100).toFixed(1)) : null;
totals.dice3BenefitPoints = totals.activeBeats ? Number(((totals.withDice3PlayableBeats - totals.currentPlayableBeats) / totals.activeBeats * 100).toFixed(1)) : null;
totals.realDiceActiveRate = totals.activeBeats ? Number((totals.realDiceBeats / totals.activeBeats * 100).toFixed(1)) : null;
totals.dummyRate = totals.activeBeats ? Number((totals.dummyBeats / totals.activeBeats * 100).toFixed(1)) : null;
totals.restRate = totals.totalBeats ? Number((totals.restBeats / totals.totalBeats * 100).toFixed(1)) : null;

const report = {
  schemaVersion: "2.0.0",
  generatedAt: new Date().toISOString(),
  librarySongs: reports.length,
  activeTrackUnits: activeSummaries.length,
  silentTrackUnits: summaries.length - activeSummaries.length,
  totals,
  tracks: summaries,
  type0Channels: channelSummaries,
  otherExamples: reports.flatMap((songReport) => songReport.summary.flatMap((summary) => summary.otherExamples.map((example) => ({ song: songReport.song, trackNumber: summary.trackNumber, trackName: summary.trackName, ...example })))).slice(0, 250)
};

const csvHeaders = ["song", "midiFormat", "sourceType", "trackNumber", "trackName", "channel", "silent", "activeBeats", "activeBeatRate", "realDiceBeats", "realDiceActiveRate", "dummyBeats", "dummyRate", "restBeats", "restRate", "emptyEndSlots", "dice1", "dice2", "dice3", "dice4", "other", "rest", "currentPlayableActiveRate", "withDice3PlayableActiveRate", "dice3BenefitPoints", "exact", "near", "ambiguous", "unsupported", "fallbackRate", "nearest1", "nearest2", "nearest3", "nearest4"];
const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvRows = [...summaries, ...channelSummaries].map((item) => csvHeaders.map((key) => {
  const nearestMatch = /^nearest([1-4])$/.exec(key);
  return quote(nearestMatch ? item.otherNearest[`dice${nearestMatch[1]}`] : item[key]);
}).join(","));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "midi-diagnostics-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputDir, "midi-diagnostics-summary.csv"), `${csvHeaders.join(",")}\n${csvRows.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ songs: reports.length, tracks: summaries.length, channels: channelSummaries.length, totals }, null, 2));
