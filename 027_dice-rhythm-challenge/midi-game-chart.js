(function (root, factory) {
  "use strict";
  const MidiGameChart = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = MidiGameChart;
  if (root) root.MidiGameChart = MidiGameChart;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ROW_SIZE = 4;
  const roundRate = (part, whole) => whole ? Number((part / whole * 100).toFixed(1)) : null;

  class MidiGameChart {
    constructor(candidateChart) {
      if (!candidateChart?.beats || !Array.isArray(candidateChart.beats)) throw new Error("MidiDiceChartGeneratorの生成結果が必要です。");
      this.sourceChart = candidateChart;
    }

    build() {
      const ordered = [...this.sourceChart.beats].sort((left, right) => left.startTick - right.startTick || left.index - right.index);
      const beats = ordered.map((source, streamIndex) => {
        const naturalRest = source.pattern === "REST";
        const dummy = source.pattern === "OTHER";
        const realDice = source.supported && [1, 2, 3, 4].includes(source.dice);
        const technicalFallback = !naturalRest && !dummy && !realDice;
        return {
          index: source.index,
          streamIndex,
          gameRowIndex: Math.floor(streamIndex / ROW_SIZE),
          slotIndex: streamIndex % ROW_SIZE,
          measure: source.measure,
          beat: source.beat,
          playDice: dummy ? 1 : realDice ? source.dice : null,
          sourcePattern: source.pattern,
          sourceDice: source.dice,
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
          onsetPositions: [...source.onsetPositions]
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
      const realDiceBeats = beats.filter((beat) => !beat.isRest && !beat.isDummy && !beat.isFallback && beat.playDice !== null).length;
      const dummyBeats = beats.filter((beat) => beat.isDummy).length;
      const restBeats = beats.filter((beat) => beat.isRest).length;
      const fallbackBeats = beats.filter((beat) => beat.isFallback).length;
      const emptyEndSlots = rows.length ? rows[rows.length - 1].slots.filter((slot) => slot === null).length : 0;
      return {
        fileName: this.sourceChart.fileName,
        sourceTrack: { ...this.sourceChart.sourceTrack },
        selection: this.sourceChart.selection,
        compatible: beats.length > 0 && beats.every((beat) => Number.isFinite(beat.startTick) && Number.isFinite(beat.endTick) && beat.endTick > beat.startTick),
        beats,
        rows,
        measures: rows,
        statistics: {
          totalBeats,
          activeBeats,
          activeBeatRate: roundRate(activeBeats, totalBeats) ?? 0,
          realDiceBeats,
          realDiceActiveRate: roundRate(realDiceBeats, activeBeats),
          dummyBeats,
          dummyRate: roundRate(dummyBeats, activeBeats),
          restBeats,
          restRate: roundRate(restBeats, totalBeats) ?? 0,
          emptyEndSlots,
          dice1: beats.filter((beat) => !beat.isDummy && beat.playDice === 1).length,
          dice2: beats.filter((beat) => beat.playDice === 2).length,
          dice3: beats.filter((beat) => beat.playDice === 3).length,
          dice4: beats.filter((beat) => beat.playDice === 4).length,
          playableActiveBeats: realDiceBeats,
          playableActiveRate: roundRate(realDiceBeats, activeBeats),
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
      return charts.filter((chart) => chart.selection !== "all" && !chart.statistics.silent && chart.statistics.activeBeatRate >= 15 && chart.compatible)
        .sort((left, right) => (right.statistics.realDiceActiveRate ?? -1) - (left.statistics.realDiceActiveRate ?? -1)
          || (left.statistics.dummyRate ?? Infinity) - (right.statistics.dummyRate ?? Infinity)
          || right.statistics.activeBeatRate - left.statistics.activeBeatRate)[0] || null;
    }

    static judgeRest(inputCount) { return { miss: Number(inputCount) > 0 }; }
    static judgeDummy(inputCount, wrongInput = false) { return { assist: Number(inputCount) === 1 && !wrongInput }; }
  }

  MidiGameChart.ROW_SIZE = ROW_SIZE;
  return MidiGameChart;
});
