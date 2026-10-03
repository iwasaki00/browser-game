(function (root, factory) {
  "use strict";
  const Diagnostics = root?.MidiChartDiagnostics || (typeof require !== "undefined" ? require("./midi-chart-diagnostics.js") : null);
  const MidiGameChart = factory(Diagnostics);
  if (typeof module !== "undefined" && module.exports) module.exports = MidiGameChart;
  if (root) root.MidiGameChart = MidiGameChart;
})(typeof window !== "undefined" ? window : globalThis, function (Diagnostics) {
  "use strict";

  const ROW_SIZE = 4;
  const QUANTIZE_CONFIG = Object.freeze({
    enabled: true,
    maxDistance: 0.08,
    firstOnsetTolerance: 0.08,
    allowedConfidence: Object.freeze(["NEAR"]),
    excludedClasses: Object.freeze(["LATE_START", "SYNCOPATED", "IRREGULAR"])
  });
  const roundRate = (part, whole) => whole ? Number((part / whole * 100).toFixed(1)) : null;
  const SOURCE_RECOMMENDATION = Object.freeze({
    minActiveBeatRate: 15,
    minActiveBeats: 16,
    weights: Object.freeze({ real: 0.45, clean: 0.15, active: 0.15, restRun: 0.10, variety: 0.10, balance: 0.05 })
  });

  class MidiGameChart {
    constructor(candidateChart, options = {}) {
      if (!candidateChart?.beats || !Array.isArray(candidateChart.beats)) throw new Error("MidiDiceChartGeneratorの生成結果が必要です。");
      if (!Diagnostics?.classifyBeat) throw new Error("MidiChartDiagnosticsの分類APIが必要です。");
      this.sourceChart = candidateChart;
      this.quantizeEnabled = options.quantizeEnabled ?? QUANTIZE_CONFIG.enabled;
      this.quantizeConfig = Object.freeze({ ...QUANTIZE_CONFIG, ...(options.quantizeConfig || {}), enabled: this.quantizeEnabled });
    }

    quantize(source) {
      if (source.pattern !== "OTHER") return { isQuantized: false, diagnostic: Diagnostics.classifyBeat(source), notQuantizedReason: null };
      const diagnostic = Diagnostics.classifyBeat(source);
      const positions = source.onsetPositions || [];
      if (!this.quantizeConfig.enabled) return { isQuantized: false, diagnostic, notQuantizedReason: "QUANTIZE_DISABLED" };
      if (positions.length >= 5) return { isQuantized: false, diagnostic, notQuantizedReason: "ONSET_COUNT_5_PLUS" };
      if (positions.length < 1) return { isQuantized: false, diagnostic, notQuantizedReason: "NO_ONSETS" };
      if (this.quantizeConfig.excludedClasses.includes(diagnostic.auxiliaryClass)) return { isQuantized: false, diagnostic, notQuantizedReason: diagnostic.auxiliaryClass };
      if (diagnostic.firstOnsetPosition > this.quantizeConfig.firstOnsetTolerance) return { isQuantized: false, diagnostic, notQuantizedReason: "LATE_START" };
      if (![1, 2, 3, 4].includes(diagnostic.nearestDice)) return { isQuantized: false, diagnostic, notQuantizedReason: "NO_SUPPORTED_NEAREST_DICE" };
      if (diagnostic.distance === null || diagnostic.distance > this.quantizeConfig.maxDistance) return { isQuantized: false, diagnostic, notQuantizedReason: "DISTANCE_TOO_LARGE" };
      if (!this.quantizeConfig.allowedConfidence.includes(diagnostic.confidence)) return { isQuantized: false, diagnostic, notQuantizedReason: `CONFIDENCE_${diagnostic.confidence}` };
      return { isQuantized: true, diagnostic, notQuantizedReason: null };
    }

    build() {
      const ordered = [...this.sourceChart.beats].sort((left, right) => left.startTick - right.startTick || left.index - right.index);
      const beats = ordered.map((source, streamIndex) => {
        const naturalRest = source.pattern === "REST";
        const quantization = this.quantize(source);
        const isQuantized = quantization.isQuantized;
        const dummy = source.pattern === "OTHER" && !isQuantized;
        const realDice = source.supported && [1, 2, 3, 4].includes(source.dice);
        const quantizedDice = isQuantized ? quantization.diagnostic.nearestDice : null;
        const technicalFallback = !naturalRest && !dummy && !realDice && !isQuantized;
        return {
          index: source.index,
          streamIndex,
          gameRowIndex: Math.floor(streamIndex / ROW_SIZE),
          slotIndex: streamIndex % ROW_SIZE,
          measure: source.measure,
          beat: source.beat,
          playDice: isQuantized ? quantizedDice : dummy ? 1 : realDice ? source.dice : null,
          sourcePattern: source.pattern,
          sourceDice: source.dice,
          isQuantized,
          quantizedDice,
          quantizeConfidence: isQuantized ? quantization.diagnostic.confidence : null,
          quantizeDistance: quantization.diagnostic.distance,
          originalOnsetPositions: [...(source.onsetPositions || [])],
          quantizedOnsetPositions: isQuantized ? [...quantization.diagnostic.quantizedPositions] : [],
          notQuantizedReason: quantization.notQuantizedReason,
          nearestDice: quantization.diagnostic.nearestDice,
          diagnosticConfidence: quantization.diagnostic.confidence,
          diagnosticClass: quantization.diagnostic.auxiliaryClass,
          isDummy: dummy,
          isRest: naturalRest,
          isFallback: technicalFallback,
          fallbackReason: technicalFallback ? source.reason || "UNPLAYABLE_BEAT" : null,
          startTick: source.startTick,
          endTick: source.endTick,
          startTime: source.startTime,
          endTime: source.endTime,
          tempo: source.tempo,
          timeSignature: { ...source.timeSignature },
          onsetPositions: [...(source.onsetPositions || [])]
        };
      });

      const rows = [];
      beats.forEach((beat) => {
        if (!rows[beat.gameRowIndex]) rows[beat.gameRowIndex] = { gameRowIndex: beat.gameRowIndex, beats: [], slots: Array(ROW_SIZE).fill(null) };
        rows[beat.gameRowIndex].beats.push(beat);
        rows[beat.gameRowIndex].slots[beat.slotIndex] = beat;
      });

      const totalBeats = beats.length;
      const activeBeats = beats.filter((beat) => !beat.isRest).length;
      const beforeRealDiceBeats = beats.filter((beat) => !beat.isRest && beat.sourcePattern !== "OTHER" && !beat.isFallback && beat.playDice !== null).length;
      const beforeDummyBeats = beats.filter((beat) => beat.sourcePattern === "OTHER").length;
      const quantizedBeats = beats.filter((beat) => beat.isQuantized).length;
      const realDiceBeats = beats.filter((beat) => !beat.isRest && !beat.isDummy && !beat.isFallback && beat.playDice !== null).length;
      const dummyBeats = beats.filter((beat) => beat.isDummy).length;
      const restBeats = beats.filter((beat) => beat.isRest).length;
      const fallbackBeats = beats.filter((beat) => beat.isFallback).length;
      const emptyEndSlots = rows.length ? rows[rows.length - 1].slots.filter((slot) => slot === null).length : 0;
      const diceCounts = {
        1: beats.filter((beat) => !beat.isDummy && beat.playDice === 1).length,
        2: beats.filter((beat) => beat.playDice === 2).length,
        3: beats.filter((beat) => beat.playDice === 3).length,
        4: beats.filter((beat) => beat.playDice === 4).length
      };
      let currentRestRun = 0;
      let maxRestRun = 0;
      beats.forEach((beat) => {
        currentRestRun = beat.isRest ? currentRestRun + 1 : 0;
        maxRestRun = Math.max(maxRestRun, currentRestRun);
      });
      const diceDistribution = Object.fromEntries([1, 2, 3, 4].map((dice) => [dice, roundRate(diceCounts[dice], realDiceBeats) ?? 0]));
      const usedDiceTypes = [1, 2, 3, 4].filter((dice) => diceCounts[dice] > 0).length;
      const diceVariety = usedDiceTypes <= 1 ? "LOW" : usedDiceTypes === 2 ? "MEDIUM" : "HIGH";
      const dominantDice = [1, 2, 3, 4].sort((left, right) => diceCounts[right] - diceCounts[left])[0];
      const dominantDiceRate = realDiceBeats ? diceDistribution[dominantDice] : 0;
      const beforeRealDiceActiveRate = roundRate(beforeRealDiceBeats, activeBeats);
      const beforeDummyRate = roundRate(beforeDummyBeats, activeBeats);
      const realDiceActiveRate = roundRate(realDiceBeats, activeBeats);
      const dummyRate = roundRate(dummyBeats, activeBeats);
      const activeBeatRate = roundRate(activeBeats, totalBeats) ?? 0;
      const varietyScore = diceVariety === "HIGH" ? 100 : diceVariety === "MEDIUM" ? 55 : 0;
      const restRunScore = Math.max(0, 100 - maxRestRun * 4);
      const balanceScore = Math.max(0, 100 - dominantDiceRate);
      const weights = SOURCE_RECOMMENDATION.weights;
      const sourceSuitabilityScore = Number((((realDiceActiveRate ?? 0) * weights.real) + ((100 - (dummyRate ?? 100)) * weights.clean) + (activeBeatRate * weights.active) + (restRunScore * weights.restRun) + (varietyScore * weights.variety) + (balanceScore * weights.balance)).toFixed(2));
      const source = this.sourceChart.source || this.sourceChart.sourceTrack || { type: this.sourceChart.selection === "all" ? "all" : "track", value: this.sourceChart.selection };
      const recommendationEligible = source.type !== "all" && activeBeats >= SOURCE_RECOMMENDATION.minActiveBeats && activeBeatRate >= SOURCE_RECOMMENDATION.minActiveBeatRate;
      return {
        fileName: this.sourceChart.fileName,
        source: { ...source },
        sourceTrack: { ...source },
        selection: this.sourceChart.selection,
        quantizeEnabled: this.quantizeConfig.enabled,
        quantizeConfig: { ...this.quantizeConfig },
        compatible: beats.length > 0 && beats.every((beat) => Number.isFinite(beat.startTick) && Number.isFinite(beat.endTick) && beat.endTick > beat.startTick),
        beats,
        rows,
        measures: rows,
        statistics: {
          totalBeats,
          activeBeats,
          activeBeatRate,
          beforeRealDiceBeats,
          beforeRealDiceActiveRate,
          beforeDummyBeats,
          beforeDummyRate,
          realDiceBeats,
          realDiceActiveRate,
          afterRealDiceActiveRate: realDiceActiveRate,
          dummyBeats,
          dummyRate,
          afterDummyRate: dummyRate,
          realImprovementPoints: realDiceActiveRate === null || beforeRealDiceActiveRate === null ? null : Number((realDiceActiveRate - beforeRealDiceActiveRate).toFixed(1)),
          quantizedBeats,
          quantizedDice1: beats.filter((beat) => beat.isQuantized && beat.quantizedDice === 1).length,
          quantizedDice2: beats.filter((beat) => beat.isQuantized && beat.quantizedDice === 2).length,
          quantizedDice3: beats.filter((beat) => beat.isQuantized && beat.quantizedDice === 3).length,
          quantizedDice4: beats.filter((beat) => beat.isQuantized && beat.quantizedDice === 4).length,
          restBeats,
          restRate: roundRate(restBeats, totalBeats) ?? 0,
          emptyEndSlots,
          dice1: diceCounts[1],
          dice2: diceCounts[2],
          dice3: diceCounts[3],
          dice4: diceCounts[4],
          diceDistribution,
          dominantDice,
          dominantDiceRate,
          diceVariety,
          usedDiceTypes,
          maxRestRun,
          sourceSuitabilityScore,
          recommendationEligible,
          playableActiveBeats: realDiceBeats,
          playableActiveRate: realDiceActiveRate,
          fallbackBeats,
          silent: activeBeats === 0
        }
      };
    }

    static beatAtTick(chart, tick) {
      let low = 0;
      let high = chart.beats.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        const beat = chart.beats[middle];
        if (tick < beat.startTick) high = middle - 1;
        else if (tick >= beat.endTick) low = middle + 1;
        else return beat;
      }
      return chart.beats[Math.max(0, Math.min(chart.beats.length - 1, low))] || null;
    }

    static recommend(charts) {
      return charts.filter((chart) => chart.statistics.recommendationEligible && !chart.statistics.silent && chart.compatible)
        .sort((left, right) => right.statistics.sourceSuitabilityScore - left.statistics.sourceSuitabilityScore
          || (right.statistics.afterRealDiceActiveRate ?? -1) - (left.statistics.afterRealDiceActiveRate ?? -1)
          || right.statistics.activeBeatRate - left.statistics.activeBeatRate)[0] || null;
    }

    static judgeRest(inputCount) { return { miss: Number(inputCount) > 0 }; }
    static judgeDummy(inputCount, wrongInput = false) { return { assist: Number(inputCount) === 1 && !wrongInput }; }
  }

  MidiGameChart.ROW_SIZE = ROW_SIZE;
  MidiGameChart.QUANTIZE_CONFIG = QUANTIZE_CONFIG;
  MidiGameChart.SOURCE_RECOMMENDATION = SOURCE_RECOMMENDATION;
  return MidiGameChart;
});