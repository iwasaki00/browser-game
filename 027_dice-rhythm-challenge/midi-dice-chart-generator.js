(function (root, factory) {
  "use strict";
  const MidiDiceChartGenerator = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = MidiDiceChartGenerator;
  if (root) root.MidiDiceChartGenerator = MidiDiceChartGenerator;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PATTERN_RULES = Object.freeze({
    REST: Object.freeze({ dice: null, supported: true, reason: null }),
    SINGLE: Object.freeze({ dice: 1, supported: true, reason: null }),
    EVEN_2: Object.freeze({ dice: 2, supported: true, reason: null }),
    EVEN_4: Object.freeze({ dice: 4, supported: true, reason: null }),
    TRIPLET: Object.freeze({ dice: 3, supported: true, reason: null }),
    OTHER: Object.freeze({ dice: null, supported: false, reason: "UNSUPPORTED_PATTERN" })
  });

  class MidiDiceChartGenerator {
    constructor(analysis) {
      if (!analysis?.beats || !Array.isArray(analysis.beats)) throw new Error("MidiRhythmAnalyzerの解析結果が必要です。");
      this.analysis = analysis;
    }

    convertBeat(source) {
      const rule = PATTERN_RULES[source.pattern] || PATTERN_RULES.OTHER;
      const signatureSupported = source.timeSignature?.numerator === 4 && source.timeSignature?.denominator === 4;
      return {
        index: source.index,
        measure: source.measure,
        beat: source.beat,
        startTick: source.startTick,
        endTick: source.endTick,
        startTime: source.startTime,
        endTime: source.endTime,
        timeSignature: { ...source.timeSignature },
        pattern: source.pattern,
        dice: rule.dice,
        supported: rule.supported && signatureSupported,
        reason: signatureSupported ? rule.reason : "UNSUPPORTED_TIME_SIGNATURE",
        rawNoteCount: source.rawNoteCount,
        onsetCount: source.onsetCount,
        onsetPositions: [...source.onsetPositions],
        trackBreakdown: source.trackBreakdown
      };
    }

    generate() {
      const beats = this.analysis.beats.map((beat) => this.convertBeat(beat));
      const measureMap = new Map();
      beats.forEach((beat) => {
        if (!measureMap.has(beat.measure)) {
          measureMap.set(beat.measure, {
            measure: beat.measure,
            timeSignature: { ...beat.timeSignature },
            supported: beat.timeSignature.numerator === 4 && beat.timeSignature.denominator === 4,
            reason: beat.timeSignature.numerator === 4 && beat.timeSignature.denominator === 4 ? null : "UNSUPPORTED_TIME_SIGNATURE",
            beats: []
          });
        }
        measureMap.get(beat.measure).beats.push(beat);
      });
      const measures = [...measureMap.values()].map((measure) => ({
        ...measure,
        beats: measure.beats.sort((a, b) => a.beat - b.beat),
        dice: measure.supported ? measure.beats.sort((a, b) => a.beat - b.beat).map((beat) => beat.dice) : null
      }));
      const statistics = this.statistics(beats, measures);
      const signatures = [...new Set(beats.map((beat) => `${beat.timeSignature.numerator}/${beat.timeSignature.denominator}`))];
      return {
        fileName: this.analysis.fileName,
        sourceTrack: { ...this.analysis.track },
        selection: this.analysis.selection,
        timeSignature: signatures.length === 1 ? signatures[0] : "MIXED",
        measures,
        beats,
        statistics,
        generatedFrom: "MidiRhythmAnalyzer"
      };
    }

    statistics(beats, measures) {
      const count = (predicate) => beats.filter(predicate).length;
      const supportedBeats = count((beat) => beat.supported);
      return {
        measures: measures.length,
        totalBeats: beats.length,
        supportedBeats,
        rest: count((beat) => beat.pattern === "REST"),
        dice1: count((beat) => beat.dice === 1 && beat.supported),
        dice2: count((beat) => beat.dice === 2 && beat.supported),
        dice3: count((beat) => beat.dice === 3 && beat.supported),
        dice4: count((beat) => beat.dice === 4 && beat.supported),
        unsupportedDice3: count((beat) => beat.reason === "DICE_3_NOT_SUPPORTED"),
        unsupportedOther: count((beat) => beat.reason === "UNSUPPORTED_PATTERN"),
        unsupportedTimeSignature: count((beat) => beat.reason === "UNSUPPORTED_TIME_SIGNATURE"),
        playableRate: beats.length ? Number((supportedBeats / beats.length * 100).toFixed(1)) : 0
      };
    }
  }

  MidiDiceChartGenerator.PATTERN_RULES = PATTERN_RULES;
  return MidiDiceChartGenerator;
});
