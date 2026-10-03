"use strict";

const fs = require("fs");
const path = require("path");
const MidiRhythmAnalyzer = require("./midi-rhythm-analyzer.js");
const MidiDiceChartGenerator = require("./midi-dice-chart-generator.js");
const MidiGameChart = require("./midi-game-chart.js");

const timing = {
  tickToSeconds: (_song, tick) => tick / 960,
  tickToBarBeat: (_song, tick) => ({ bar: Math.floor(tick / 1920) + 1, beat: Math.floor((tick % 1920) / 480) + 1 })
};
const notes = (channel, offsets, beats = 24) => Array.from({ length: beats }, (_, beatIndex) => offsets.map((offset, noteIndex) => ({
  channel, noteNumber: 48 + noteIndex, startTick: beatIndex * 480 + offset, endTick: beatIndex * 480 + offset + 60
}))).flat();
const song = {
  fileName: "type0-source.mid", format: 0, ppq: 480, endTick: 24 * 480, bpm: 120,
  tempoMap: [{ tick: 0, bpm: 120 }],
  timeSignatureMap: [{ tick: 0, numerator: 4, denominator: 4, bar: 1 }],
  tracks: [
    { id: 0, name: "Mixed Type 0", instrumentName: "Piano", channels: [0, 1], notes: [...notes(0, [0]), ...notes(1, [0, 240])] },
    { id: 1, name: "Drums", instrumentName: "Drums", channels: [9], notes: notes(9, [0, 120, 240, 360], 8) }
  ]
};
const analyzer = new MidiRhythmAnalyzer(song, { timing });
function candidateBeat(index, pattern, dice, positions = [], options = {}) {
  return {
    index, measure: Math.floor(index / 4) + 1, beat: index % 4 + 1, pattern, dice,
    supported: options.supported ?? pattern !== "OTHER", reason: pattern === "OTHER" ? "UNSUPPORTED_PATTERN" : null,
    startTick: index * 480, endTick: (index + 1) * 480, startTime: index * 0.5, endTime: (index + 1) * 0.5,
    tempo: 120, timeSignature: options.signature || { numerator: 4, denominator: 4 }, onsetPositions: positions
  };
}
function game(patternFactory, source = { type: "track", value: "track:test", label: "Test" }, count = 24) {
  const beats = Array.from({ length: count }, (_, index) => patternFactory(index));
  return new MidiGameChart({ fileName: "source.mid", selection: source.value, source, sourceTrack: source, beats }).build();
}
let assertions = 0;
function check(value, message) { assertions += 1; if (!value) throw new Error(message); }

const trackSources = analyzer.sourceOptions.filter((source) => source.type === "track");
const channelSources = analyzer.sourceOptions.filter((source) => source.type === "channel");
check(trackSources.length === 2 && analyzer.analyze("track:1").source.type === "track", "1. Track Source generation");
check(channelSources.length === 3 && analyzer.analyze("channel:1").source.type === "channel", "2. Channel Source generation");
check(analyzer.analyze("all").source.type === "all" && analyzer.notesFor("all").length === song.tracks.flatMap((track) => track.notes).length, "3. ALL Source generation");
const percussionSource = channelSources.find((source) => source.channel === 9);
check(percussionSource?.label.startsWith("Channel 10"), "4. internal Channel 9 is displayed as Channel 10");
check(percussionSource?.label === "Channel 10 [Percussion]" && percussionSource.percussion, "5. Channel 10 has the Percussion label");
check(song.format === 0 && channelSources.map((source) => source.channel).join(",") === "0,1,9", "6. Type 0 multi-channel candidates");
const channelAnalysis = analyzer.analyze("channel:1");
const channelCandidate = new MidiDiceChartGenerator(channelAnalysis).generate();
const channelGame = new MidiGameChart(channelCandidate).build();
check(channelGame.compatible && channelGame.beats.length === 24 && channelGame.beats.every((beat) => beat.playDice === 2), "7. Channel Source game chart generation");
const quantized = game((index) => candidateBeat(index, "OTHER", null, [0.01, 0.49]), { type: "channel", value: "channel:2", channel: 2, label: "Channel 3" });
check(quantized.statistics.quantizedBeats === 24 && quantized.beats.every((beat) => beat.playDice === 2 && !beat.isDummy), "8. Quantization applies to Channel Source");
const dummy = game((index) => candidateBeat(index, "OTHER", null, [0.25, 0.75]), { type: "channel", value: "channel:3", channel: 3, label: "Channel 4" });
check(dummy.statistics.dummyBeats === 24 && dummy.beats.every((beat) => beat.playDice === 1 && beat.isDummy), "9. DUMMY conversion applies to Channel Source");
const gameSourceCode = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
check(gameSourceCode.includes("const selectedChart = this.midi.getGameChart(this.selectedGameSource)") && gameSourceCode.includes("this.activeGameChart = selectedChart"), "10. GAME SOURCE is fixed to activeGameChart at START");
check(gameSourceCode.includes("selectAnalysisTrack(selection)") && gameSourceCode.includes("this.midi.getRhythmAnalysis(selection)") && !gameSourceCode.includes("this.activeGameChart = this.midi.getGameChart(this.analysisTrackValue)"), "11. Analysis Source does not replace activeGameChart");
const silent = game((index) => candidateBeat(index, "REST", null, []), { type: "channel", value: "channel:7", channel: 7, label: "Channel 8" });
check(silent.statistics.silent && !silent.statistics.recommendationEligible && MidiGameChart.recommend([silent]) === null, "12. Silent Channel is never recommended");
const below15 = game((index) => candidateBeat(index, index < 3 ? "SINGLE" : "REST", index < 3 ? 1 : null, index < 3 ? [0] : []), { type: "track", value: "track:below15", label: "Below 15%" });
check(below15.statistics.activeBeatRate === 12.5 && !below15.statistics.recommendationEligible, "13. Active rate below 15% is excluded");
const enoughActive = game((index) => index < 17 ? candidateBeat(index, "SINGLE", 1, [0]) : index === 17 ? candidateBeat(index, "OTHER", null, [0.25, 0.75]) : candidateBeat(index, "REST", null, []), { type: "track", value: "track:enough", label: "Enough Active" });
check(enoughActive.statistics.afterRealDiceActiveRate > 90 && MidiGameChart.recommend([below15, enoughActive]) === enoughActive, "14. sufficient activity beats a sparse REAL 100% Source");
const rich = game((index) => candidateBeat(index, ["SINGLE", "EVEN_2", "TRIPLET", "EVEN_4"][index % 4], [1, 2, 3, 4][index % 4]), { type: "channel", value: "channel:4", channel: 4, label: "Rich" });
const mono = game((index) => candidateBeat(index, "SINGLE", 1, [0]), { type: "track", value: "track:mono", label: "Mono" });
check(rich.statistics.diceVariety === "HIGH" && mono.statistics.diceVariety === "LOW" && MidiGameChart.recommend([mono, rich]) === rich, "15. higher Dice Variety beats an extreme Dice 1-only Source");
const longRest = game((index) => candidateBeat(index, index < 8 ? "REST" : "SINGLE", index < 8 ? null : 1, index < 8 ? [] : [0]), { type: "track", value: "track:long-rest", label: "Long Rest" });
const shortRest = game((index) => candidateBeat(index, index % 3 === 2 ? "REST" : "SINGLE", index % 3 === 2 ? null : 1, index % 3 === 2 ? [] : [0]), { type: "track", value: "track:short-rest", label: "Short Rest" });
check(longRest.statistics.maxRestRun === 8 && shortRest.statistics.maxRestRun === 1 && shortRest.statistics.sourceSuitabilityScore > longRest.statistics.sourceSuitabilityScore && MidiGameChart.recommend([longRest, shortRest]) === shortRest, "16. a long maximum REST run is penalized");
const browserTestCode = fs.readFileSync(path.join(__dirname, "browser-smoke-test.js"), "utf8");
check(channelGame.source.type === "channel" && browserTestCode.includes('value = "channel:9"') && browserTestCode.includes('type0Channel.started'), "17. Type 0 Channel Source START path is covered by the browser test");

console.log(JSON.stringify({ tests: 17, assertions, result: "PASS" }));