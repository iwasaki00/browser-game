(function (root, factory) {
  "use strict";
  const MidiRhythmAnalyzer = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = MidiRhythmAnalyzer;
  if (root) root.MidiRhythmAnalyzer = MidiRhythmAnalyzer;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const ONSET_MERGE_TOLERANCE_TICKS = 0;
  const RHYTHM_POSITION_TOLERANCE = 0.04;

  class MidiRhythmAnalyzer {
    constructor(song, options = {}) {
      if (!song?.ppq || !Array.isArray(song.tracks)) throw new Error("解析可能なSongDataではありません。");
      this.song = song;
      this.timing = options.timing || root?.MidiCommon;
      if (!this.timing?.tickToSeconds || !this.timing?.tickToBarBeat) throw new Error("MidiCommon timing APIが必要です。");
      this.onsetMergeTolerance = Math.max(0, Number(options.onsetMergeToleranceTicks ?? ONSET_MERGE_TOLERANCE_TICKS));
      this.positionTolerance = Math.max(0, Number(options.rhythmPositionTolerance ?? RHYTHM_POSITION_TOLERANCE));
      this.cache = new Map();
      this.trackOptions = this.buildTrackOptions();
    }

    buildTrackOptions() {
      return [
        { value: "all", label: "ALL", trackIndex: null, percussion: false },
        ...this.song.tracks.map((track, trackIndex) => {
          const percussion = (track.channels || []).includes(9);
          const name = track.name || `Track ${trackIndex + 1}`;
          const instrument = percussion ? "Percussion" : (track.instrumentName || "Unknown");
          return {
            value: String(trackIndex),
            trackIndex,
            trackId: track.id,
            name,
            instrument,
            percussion,
            label: `Track ${trackIndex + 1} : ${name}${percussion ? " [Percussion]" : ""}`
          };
        })
      ];
    }

    signatureAtTick(tick) {
      const map = this.song.timeSignatureMap?.length ? this.song.timeSignatureMap : [{ tick: 0, numerator: 4, denominator: 4, bar: 1 }];
      let current = map[0];
      for (let index = 1; index < map.length && map[index].tick <= tick; index += 1) current = map[index];
      return current;
    }

    tempoAtTick(tick) {
      const map = this.song.tempoMap?.length ? this.song.tempoMap : [{ tick: 0, bpm: this.song.bpm || 120 }];
      let current = map[0];
      for (let index = 1; index < map.length && map[index].tick <= tick; index += 1) current = map[index];
      return Number(current.bpm) || 120;
    }

    notesFor(selection) {
      const indexes = selection === "all" ? this.song.tracks.map((_, index) => index) : [Number(selection)];
      return indexes.flatMap((trackIndex) => {
        const track = this.song.tracks[trackIndex];
        if (!track) return [];
        return (track.notes || []).map((note) => ({ ...note, trackIndex }));
      }).sort((a, b) => a.startTick - b.startTick || a.trackIndex - b.trackIndex || a.noteNumber - b.noteNumber);
    }

    groupOnsets(notes) {
      const groups = [];
      notes.forEach((note) => {
        const previous = groups[groups.length - 1];
        if (!previous || note.startTick - previous.startTick > this.onsetMergeTolerance) {
          groups.push({ startTick: note.startTick, notes: [note] });
        } else previous.notes.push(note);
      });
      return groups;
    }

    patternFor(positions) {
      if (positions.length === 0) return "REST";
      if (positions.length === 1) return "SINGLE";
      const matches = (target) => positions.length === target.length && positions.every((value, index) => Math.abs(value - target[index]) <= this.positionTolerance);
      if (matches([0, 0.5])) return "EVEN_2";
      if (matches([0, 0.25, 0.5, 0.75])) return "EVEN_4";
      if (matches([0, 1 / 3, 2 / 3])) return "TRIPLET";
      return "OTHER";
    }

    diceCandidate(onsetCount) {
      if (onsetCount === 0) return "-";
      if (onsetCount === 1 || onsetCount === 2 || onsetCount === 4) return String(onsetCount);
      if (onsetCount === 3) return "3";
      return "?";
    }

    analyze(selection = "all") {
      const key = selection === "all" ? "all" : String(Number(selection));
      if (this.cache.has(key)) return this.cache.get(key);
      const notes = this.notesFor(key);
      const lastNoteTick = notes.reduce((maximum, note) => Math.max(maximum, Number(note.startTick) + 1 || 0), 0);
      const analysisEndTick = Math.max(1, Number(this.song.endTick) || 0, lastNoteTick);
      const beats = [];
      let noteCursor = 0;
      let startTick = 0;

      while (startTick < analysisEndTick) {
        const signature = this.signatureAtTick(startTick);
        const beatLength = this.song.ppq * 4 / signature.denominator;
        const nextSignature = (this.song.timeSignatureMap || []).find((item) => item.tick > startTick);
        const endTick = Math.min(startTick + beatLength, nextSignature?.tick || Infinity);
        const beatNotes = [];
        while (noteCursor < notes.length && notes[noteCursor].startTick < startTick) noteCursor += 1;
        let scan = noteCursor;
        while (scan < notes.length && notes[scan].startTick < endTick) beatNotes.push(notes[scan++]);
        noteCursor = scan;

        const onsetGroups = this.groupOnsets(beatNotes);
        const onsetPositions = onsetGroups.map((group) => Number(((group.startTick - startTick) / (endTick - startTick)).toFixed(6)));
        const musicalTime = this.timing.tickToBarBeat(this.song, startTick);
        const trackBreakdown = [...new Set(beatNotes.map((note) => note.trackIndex))].map((trackIndex) => {
          const track = this.song.tracks[trackIndex];
          const trackNotes = beatNotes.filter((note) => note.trackIndex === trackIndex);
          return {
            trackIndex,
            trackId: track.id,
            name: track.name || `Track ${trackIndex + 1}`,
            instrument: (track.channels || []).includes(9) ? "Percussion" : (track.instrumentName || "Unknown"),
            percussion: (track.channels || []).includes(9),
            rawNoteCount: trackNotes.length,
            onsetCount: this.groupOnsets(trackNotes).length
          };
        });
        const pattern = this.patternFor(onsetPositions);
        beats.push({
          index: beats.length,
          measure: musicalTime.bar,
          beat: musicalTime.beat,
          startTick,
          endTick,
          startTime: this.timing.tickToSeconds(this.song, startTick),
          endTime: this.timing.tickToSeconds(this.song, endTick),
          tempo: this.tempoAtTick(startTick),
          timeSignature: { numerator: signature.numerator, denominator: signature.denominator },
          rawNoteCount: beatNotes.length,
          onsetCount: onsetGroups.length,
          onsetPositions,
          pattern,
          diceCandidate: this.diceCandidate(onsetGroups.length),
          trackBreakdown
        });
        startTick = endTick;
      }

      const result = {
        fileName: this.song.fileName,
        selection: key,
        track: this.trackOptions.find((option) => option.value === key) || this.trackOptions[0],
        settings: { onsetMergeToleranceTicks: this.onsetMergeTolerance, rhythmPositionTolerance: this.positionTolerance },
        beats
      };
      this.cache.set(key, result);
      return result;
    }

    beatAtTick(tick, selection = "all") {
      const beats = this.analyze(selection).beats;
      let low = 0;
      let high = beats.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        const beat = beats[middle];
        if (tick < beat.startTick) high = middle - 1;
        else if (tick >= beat.endTick) low = middle + 1;
        else return beat;
      }
      return beats[Math.max(0, Math.min(beats.length - 1, low))] || null;
    }
  }

  MidiRhythmAnalyzer.ONSET_MERGE_TOLERANCE_TICKS = ONSET_MERGE_TOLERANCE_TICKS;
  MidiRhythmAnalyzer.RHYTHM_POSITION_TOLERANCE = RHYTHM_POSITION_TOLERANCE;
  return MidiRhythmAnalyzer;
});
