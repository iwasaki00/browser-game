(function (root, factory) {
  "use strict";
  const MidiGameChart = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = MidiGameChart;
  if (root) root.MidiGameChart = MidiGameChart;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  class MidiGameChart {
    constructor(candidateChart) {
      if (!candidateChart?.beats || !candidateChart?.measures) throw new Error("MidiDiceChartGeneratorの生成結果が必要です。");
      this.sourceChart = candidateChart;
    }

    build() {
      const beats = this.sourceChart.beats.map((source) => {
        const playable = source.supported && [1, 2, 4].includes(source.dice);
        const naturalRest = source.pattern === "REST";
        const fallback = !source.supported && !naturalRest;
        return {
          index: source.index,
          measure: source.measure,
          beat: source.beat,
          playDice: playable ? source.dice : null,
          sourcePattern: source.pattern,
          sourceDice: source.dice,
          isRest: naturalRest || fallback,
          isFallback: fallback,
          fallbackReason: fallback ? source.reason : null,
          startTick: source.startTick,
          endTick: source.endTick,
          startTime: source.startTime,
          endTime: source.endTime,
          timeSignature: { ...source.timeSignature },
          onsetPositions: [...source.onsetPositions]
        };
      });
      const measures = this.sourceChart.measures.map((sourceMeasure) => ({
        measure: sourceMeasure.measure,
        timeSignature: { ...sourceMeasure.timeSignature },
        supported: sourceMeasure.supported,
        beats: beats.filter((beat) => beat.measure === sourceMeasure.measure)
      }));
      const activeBeats = beats.filter((beat) => beat.sourcePattern !== "REST").length;
      const playableActiveBeats = beats.filter((beat) => [1, 2, 4].includes(beat.playDice)).length;
      const fallbackBeats = beats.filter((beat) => beat.isFallback).length;
      const totalBeats = beats.length;
      return {
        fileName: this.sourceChart.fileName,
        sourceTrack: { ...this.sourceChart.sourceTrack },
        selection: this.sourceChart.selection,
        compatible: measures.every((measure) => measure.supported),
        beats,
        measures,
        statistics: {
          totalBeats,
          activeBeats,
          activeBeatRate: totalBeats ? Number((activeBeats / totalBeats * 100).toFixed(1)) : 0,
          playableActiveBeats,
          playableActiveRate: activeBeats ? Number((playableActiveBeats / activeBeats * 100).toFixed(1)) : null,
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
      return charts.filter((chart) => chart.selection !== "all" && chart.statistics.activeBeatRate >= 15 && chart.compatible)
        .sort((left, right) => (right.statistics.playableActiveRate ?? -1) - (left.statistics.playableActiveRate ?? -1)
          || right.statistics.activeBeatRate - left.statistics.activeBeatRate)[0] || null;
    }

    static judgeRest(inputCount) { return { miss: Number(inputCount) > 0 }; }
  }

  return MidiGameChart;
});
