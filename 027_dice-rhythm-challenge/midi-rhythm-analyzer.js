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
      this.sourceOptions = this.buildSourceOptions();
      this.trackOptions = this.sourceOptions.filter((source) => source.type === "all" || source.type === "track");
    }

    buildSourceOptions() {
      const tracks = this.song.tracks.map((track, trackIndex) => {
        const percussion = (track.channels || []).includes(9);
        const name = track.name || `Track ${trackIndex + 1}`;
        return {
          value: `track:${trackIndex}`, type: "track", trackIndex, channel: null, trackId: track.id,
          name, instrument: percussion ? "Percussion" : (track.instrumentName || "Unknown"), percussion,
          label: `Track ${trackIndex + 1} : ${name}${percussion ? " [Percussion]" : ""}`
        };
      });
      const channels = [...new Set(this.song.tracks.flatMap((track) => (track.notes || []).map((note) => note.channel)).filter(Number.isInteger))]
        .sort((left, right) => left - right)
        .map((channel) => ({
          value: `channel:${channel}`, type: "channel", trackIndex: null, channel,
          name: `Channel ${channel + 1}`, instrument: channel === 9 ? "Percussion" : "MIDI Channel", percussion: channel === 9,
          label: `Channel ${channel + 1}${channel === 9 ? " [Percussion]" : ""}`
        }));
      return [{ value: "all", type: "all", trackIndex: null, channel: null, name: "ALL", instrument: "Mixed", percussion: false, label: "ALL" }, ...tracks, ...channels];
    }

    normalizeSource(selection = "all") {
      if (selection && typeof selection === "object") {
        if (selection.type === "all") return this.sourceOptions[0];
        if (selection.type === "track") return this.sourceOptions.find((source) => source.type === "track" && source.trackIndex === Number(selection.trackIndex)) || null;
        if (selection.type === "channel") return this.sourceOptions.find((source) => source.type === "channel" && source.channel === Number(selection.channel)) || null;
      }
      const value = String(selection ?? "all");
      if (value === "all") return this.sourceOptions[0];
      if (/^\d+$/.test(value)) return this.sourceOptions.find((source) => source.value === `track:${Number(value)}`) || null;
      return this.sourceOptions.find((source) => source.value === value) || null;
    }

    sourceValue(selection = "all") { return this.normalizeSource(selection)?.value || "all"; }

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
      const source = this.normalizeSource(selection);
      if (!source) return [];
      return this.song.tracks.flatMap((track, trackIndex) => {
        if (source.type === "track" && trackIndex !== source.trackIndex) return [];
        return (track.notes || []).filter((note) => source.type !== "channel" || note.channel === source.channel)
          .map((note) => ({ ...note, trackIndex }));
      }).sort((left, right) => left.startTick - right.startTick || left.trackIndex - right.trackIndex || left.noteNumber - right.noteNumber);
    }

    groupOnsets(notes) {
      const groups = [];
      notes.forEach((note) => {
        const previous = groups[groups.length - 1];
        if (!previous || note.startTick - previous.startTick > this.onsetMergeTolerance) groups.push({ startTick: note.startTick, notes: [note] });
        else previous.notes.push(note);
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
      if ([1, 2, 3, 4].includes(onsetCount)) return String(onsetCount);
      return "?";
    }

    analyze(selection = "all") {
      const source = this.normalizeSource(selection) || this.sourceOptions[0];
      const key = source.value;
      if (this.cache.has(key)) return this.cache.get(key);
      const notes = this.notesFor(source);
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
          return { trackIndex, trackId: track.id, name: track.name || `Track ${trackIndex + 1}`, instrument: (track.channels || []).includes(9) ? "Percussion" : (track.instrumentName || "Unknown"), percussion: (track.channels || []).includes(9), rawNoteCount: trackNotes.length, onsetCount: this.groupOnsets(trackNotes).length };
        });
        const pattern = this.patternFor(onsetPositions);
        beats.push({
          index: beats.length, measure: musicalTime.bar, beat: musicalTime.beat, startTick, endTick,
          startTime: this.timing.tickToSeconds(this.song, startTick), endTime: this.timing.tickToSeconds(this.song, endTick),
          tempo: this.tempoAtTick(startTick), timeSignature: { numerator: signature.numerator, denominator: signature.denominator },
          rawNoteCount: beatNotes.length, onsetCount: onsetGroups.length, onsetPositions, pattern,
          diceCandidate: this.diceCandidate(onsetGroups.length), trackBreakdown
        });
        startTick = endTick;
      }

      const result = {
        fileName: this.song.fileName, selection: key, source: { ...source }, track: { ...source },
        settings: { onsetMergeToleranceTicks: this.onsetMergeTolerance, rhythmPositionTolerance: this.positionTolerance }, beats
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