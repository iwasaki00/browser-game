(function (root, factory) {
  "use strict";
  const MidiChartDiagnostics = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = MidiChartDiagnostics;
  if (root) root.MidiChartDiagnostics = MidiChartDiagnostics;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const STANDARD_PATTERNS = Object.freeze({
    1: Object.freeze([0]),
    2: Object.freeze([0, 0.5]),
    3: Object.freeze([0, 1 / 3, 2 / 3]),
    4: Object.freeze([0, 0.25, 0.5, 0.75])
  });
  const DEFAULT_THRESHOLDS = Object.freeze({ exact: 0.04, near: 0.08, ambiguous: 0.18, firstOnset: 0.08 });

  const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
  const rate = (part, whole) => whole ? round(part / whole * 100, 1) : null;

  class MidiChartDiagnostics {
    constructor(song, options = {}) {
      if (!song?.ppq || !Array.isArray(song.tracks)) throw new Error("診断可能なSongDataが必要です。");
      this.song = song;
      this.Analyzer = options.Analyzer || root?.MidiRhythmAnalyzer;
      this.Generator = options.Generator || root?.MidiDiceChartGenerator;
      this.GameChart = options.GameChart || root?.MidiGameChart;
      this.timing = options.timing || root?.MidiCommon;
      if (!this.Analyzer || !this.Generator || !this.GameChart || !this.timing) throw new Error("既存MIDI解析モジュールが必要です。");
      this.analyzer = options.analyzer || new this.Analyzer(song, { timing: this.timing });
      this.diceCharts = options.diceCharts || null;
      this.gameCharts = options.gameCharts || null;
      this.thresholds = Object.freeze({ ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) });
    }

    patternDistances(positions) {
      const result = { 1: null, 2: null, 3: null, 4: null };
      const target = STANDARD_PATTERNS[positions.length];
      if (!target) return result;
      result[positions.length] = round(positions.reduce((sum, value, index) => sum + Math.abs(value - target[index]), 0) / positions.length, 6);
      return result;
    }

    classify(beat) {
      const rawPositions = [...beat.onsetPositions];
      if (!rawPositions.length) return { distances: this.patternDistances(rawPositions), nearestDice: null, distance: 0, confidence: "EXACT", quantizedPositions: [], firstOnsetPosition: null, gameCompatible: true, compatibleWithDice3: true, auxiliaryClass: "REST" };
      const distances = this.patternDistances(rawPositions);
      const nearestDice = rawPositions.length >= 1 && rawPositions.length <= 4 ? rawPositions.length : null;
      const distance = nearestDice ? distances[nearestDice] : null;
      const target = nearestDice ? STANDARD_PATTERNS[nearestDice] : [];
      const maximumError = target.length ? Math.max(...rawPositions.map((value, index) => Math.abs(value - target[index]))) : Infinity;
      const firstOnsetPosition = rawPositions[0];
      const startsOnBeat = firstOnsetPosition <= this.thresholds.firstOnset;
      let confidence = "UNSUPPORTED";
      if (nearestDice && startsOnBeat && distance <= this.thresholds.exact && maximumError <= this.thresholds.exact) confidence = "EXACT";
      else if (nearestDice && startsOnBeat && distance <= this.thresholds.near && maximumError <= this.thresholds.near * 1.25) confidence = "NEAR";
      else if (nearestDice && distance <= this.thresholds.ambiguous) confidence = "AMBIGUOUS";
      const exactPattern = ["SINGLE", "EVEN_2", "TRIPLET", "EVEN_4"].includes(beat.pattern) && confidence === "EXACT";
      const gameCompatible = exactPattern && nearestDice !== 3 && beat.timeSignature?.numerator === 4 && beat.timeSignature?.denominator === 4;
      const compatibleWithDice3 = exactPattern && beat.timeSignature?.numerator === 4 && beat.timeSignature?.denominator === 4;
      let auxiliaryClass = beat.pattern;
      if (beat.pattern === "OTHER") {
        if (!startsOnBeat) auxiliaryClass = "LATE_START";
        else if (nearestDice && (confidence === "NEAR" || confidence === "AMBIGUOUS")) auxiliaryClass = `OTHER_${nearestDice}_NEAR`;
        else if (rawPositions.some((position) => position > 0.08) && nearestDice) auxiliaryClass = "SYNCOPATED";
        else auxiliaryClass = "IRREGULAR";
      } else if (!startsOnBeat) auxiliaryClass = "LATE_START";
      return { distances, nearestDice, distance, confidence, quantizedPositions: [...target], firstOnsetPosition, gameCompatible, compatibleWithDice3, auxiliaryClass };
    }

    diagnoseUnit(analysis, candidateChart, gameChart, meta) {
      const beats = analysis.beats.map((beat, index) => {
        const candidate = candidateChart.beats[index];
        const game = gameChart.beats[index];
        const classification = this.classify(beat);
        return {
          song: this.song.fileName || this.song.title || "MIDI",
          sourceType: meta.sourceType,
          trackNumber: meta.trackNumber,
          trackName: meta.trackName,
          channel: meta.channel ?? (meta.channels?.length ? meta.channels.join("|") : null),
          measure: beat.measure,
          beat: beat.beat,
          tempo: beat.tempo,
          timeSignature: `${beat.timeSignature.numerator}/${beat.timeSignature.denominator}`,
          rawNoteCount: beat.rawNoteCount,
          onsetCount: beat.onsetCount,
          onsetPositions: [...beat.onsetPositions],
          rawPositions: [...beat.onsetPositions],
          quantizedPositions: classification.quantizedPositions,
          pattern: beat.pattern,
          diceCandidate: beat.diceCandidate,
          currentGameDice: game.playDice,
          isFallback: game.isFallback,
          fallbackReason: game.fallbackReason,
          ...classification
        };
      });
      return { ...meta, beats, summary: this.summarize(beats, meta) };
    }

    summarize(beats, meta = {}) {
      const active = beats.filter((beat) => beat.pattern !== "REST");
      const count = (predicate) => beats.filter(predicate).length;
      const activeCount = (predicate) => active.filter(predicate).length;
      const currentPlayable = activeCount((beat) => [1, 2, 4].includes(beat.currentGameDice));
      const withDice3 = activeCount((beat) => [1, 2, 4].includes(beat.currentGameDice) || (beat.pattern === "TRIPLET" && beat.compatibleWithDice3));
      const otherBeats = active.filter((beat) => beat.pattern === "OTHER");
      const otherOnsetCounts = { onset1: 0, onset2: 0, onset3: 0, onset4: 0, onset5Plus: 0 };
      const nearest = { dice1: 0, dice2: 0, dice3: 0, dice4: 0, unsupported: 0 };
      const auxiliaryClasses = {};
      active.forEach((beat) => { auxiliaryClasses[beat.auxiliaryClass] = (auxiliaryClasses[beat.auxiliaryClass] || 0) + 1; });
      otherBeats.forEach((beat) => {
        const key = beat.onsetCount >= 5 ? "onset5Plus" : `onset${beat.onsetCount}`;
        if (key in otherOnsetCounts) otherOnsetCounts[key] += 1;
        if (beat.nearestDice) nearest[`dice${beat.nearestDice}`] += 1;
        else nearest.unsupported += 1;
      });
      return {
        ...meta,
        totalBeats: beats.length,
        activeBeats: active.length,
        silent: active.length === 0,
        activeBeatRate: rate(active.length, beats.length) ?? 0,
        rest: count((beat) => beat.pattern === "REST"),
        dice1: activeCount((beat) => beat.pattern === "SINGLE"),
        dice2: activeCount((beat) => beat.pattern === "EVEN_2"),
        dice3: activeCount((beat) => beat.pattern === "TRIPLET"),
        dice4: activeCount((beat) => beat.pattern === "EVEN_4"),
        other: otherBeats.length,
        fallback: activeCount((beat) => beat.isFallback),
        currentPlayableBeats: currentPlayable,
        currentPlayableActiveRate: rate(currentPlayable, active.length),
        withDice3PlayableBeats: withDice3,
        withDice3PlayableActiveRate: rate(withDice3, active.length),
        dice3BenefitPoints: active.length ? round((withDice3 - currentPlayable) / active.length * 100, 1) : null,
        exact: activeCount((beat) => beat.confidence === "EXACT"),
        near: activeCount((beat) => beat.confidence === "NEAR"),
        ambiguous: activeCount((beat) => beat.confidence === "AMBIGUOUS"),
        unsupported: activeCount((beat) => beat.confidence === "UNSUPPORTED"),
        exactRate: rate(activeCount((beat) => beat.confidence === "EXACT"), active.length),
        nearRate: rate(activeCount((beat) => beat.confidence === "NEAR"), active.length),
        fallbackRate: rate(activeCount((beat) => beat.isFallback), active.length),
        unsupportedRate: rate(activeCount((beat) => beat.confidence === "UNSUPPORTED"), active.length),
        otherOnsetCounts,
        otherNearest: nearest,
        auxiliaryClasses,
        otherExamples: otherBeats.slice(0, 12).map((beat) => ({ measure: beat.measure, beat: beat.beat, rawPositions: beat.rawPositions, nearestDice: beat.nearestDice, distance: beat.distance, confidence: beat.confidence, auxiliaryClass: beat.auxiliaryClass }))
      };
    }

    buildFromAnalysis(analysis) {
      const candidate = new this.Generator(analysis).generate();
      return { candidate, game: new this.GameChart(candidate).build() };
    }

    trackUnits() {
      return this.song.tracks.map((track, trackIndex) => {
        const analysis = this.analyzer.analyze(String(trackIndex));
        const charts = this.diceCharts?.get(String(trackIndex)) && this.gameCharts?.get(String(trackIndex)) ? { candidate: this.diceCharts.get(String(trackIndex)), game: this.gameCharts.get(String(trackIndex)) } : this.buildFromAnalysis(analysis);
        return this.diagnoseUnit(analysis, charts.candidate, charts.game, {
          sourceType: "TRACK", trackNumber: trackIndex + 1, trackIndex, trackName: track.name || `Track ${trackIndex + 1}`, channel: null,
          channels: [...new Set((track.channels || []).map((channel) => channel + 1))],
          label: `Track ${trackIndex + 1} : ${track.name || `Track ${trackIndex + 1}`}`
        });
      });
    }

    channelUnits() {
      if (this.song.format !== 0) return [];
      const units = [];
      this.song.tracks.forEach((track, trackIndex) => {
        [...new Set((track.notes || []).map((note) => note.channel))].sort((a, b) => a - b).forEach((channel) => {
          const filteredTrack = { ...track, notes: track.notes.filter((note) => note.channel === channel), channels: [channel] };
          const virtualSong = { ...this.song, tracks: [filteredTrack] };
          const analyzer = new this.Analyzer(virtualSong, { timing: this.timing });
          const analysis = analyzer.analyze("0");
          const charts = this.diceCharts?.get(String(trackIndex)) && this.gameCharts?.get(String(trackIndex)) ? { candidate: this.diceCharts.get(String(trackIndex)), game: this.gameCharts.get(String(trackIndex)) } : this.buildFromAnalysis(analysis);
          units.push(this.diagnoseUnit(analysis, charts.candidate, charts.game, {
            sourceType: "CHANNEL", trackNumber: trackIndex + 1, trackIndex, trackName: track.name || `Track ${trackIndex + 1}`, channel: channel + 1, channels: [channel + 1],
            label: `Track ${trackIndex + 1} / Channel ${channel + 1}`
          }));
        });
      });
      return units;
    }

    diagnose() {
      const tracks = this.trackUnits();
      const channels = this.channelUnits();
      return {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        song: this.song.fileName || this.song.title || "MIDI",
        midiFormat: this.song.format,
        thresholds: { ...this.thresholds },
        standardPatterns: Object.fromEntries(Object.entries(STANDARD_PATTERNS).map(([key, value]) => [key, [...value]])),
        summary: tracks.map((unit) => unit.summary),
        channelSummary: channels.map((unit) => unit.summary),
        tracks,
        channels
      };
    }

    static toCsv(report) {
      const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const headers = ["song", "sourceType", "trackNumber", "trackName", "channel", "measure", "beat", "tempo", "timeSignature", "rawNoteCount", "onsetCount", "rawPositions", "pattern", "diceCandidate", "currentGameDice", "isFallback", "fallbackReason", "nearestDice", "distance", "confidence", "firstOnsetPosition", "gameCompatible", "compatibleWithDice3", "auxiliaryClass"];
      const rows = [...report.tracks, ...report.channels].flatMap((unit) => unit.beats).map((beat) => headers.map((key) => quote(Array.isArray(beat[key]) ? beat[key].join("|") : beat[key])).join(","));
      return [headers.join(","), ...rows].join("\n");
    }
  }

  MidiChartDiagnostics.STANDARD_PATTERNS = STANDARD_PATTERNS;
  MidiChartDiagnostics.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;
  return MidiChartDiagnostics;
});
