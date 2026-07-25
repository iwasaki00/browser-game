export const ACCENT_STEPS = Object.freeze([0, 4, 8, 12]);

export const CHORD_PROGRESSION = Object.freeze([
  Object.freeze({ name: "Cmaj", filename: "seq_synth_stab_cmaj.wav" }),
  Object.freeze({ name: "Cmaj", filename: "seq_synth_stab_cmaj.wav" }),
  Object.freeze({ name: "Amin", filename: "seq_synth_stab_amin.wav" }),
  Object.freeze({ name: "Amin", filename: "seq_synth_stab_amin.wav" }),
]);

export const BASS_PATTERNS = Object.freeze({
  OFF: Object.freeze([]),
  BASIC: Object.freeze([0, 8]),
  "FOUR ON FLOOR": Object.freeze([0, 4, 8, 12]),
  SYNCOPATION: Object.freeze([0, 6, 10, 14]),
});

const BASS_FILES = Object.freeze({
  C: "seq_synth_bass_c.wav",
  G: "seq_synth_bass_g.wav",
});

export class MusicEngine {
  constructor({
    chordMode = true,
    bassMode = "BASIC",
    accentSteps = ACCENT_STEPS,
  } = {}) {
    this.chordMode = Boolean(chordMode);
    this.bassMode = BASS_PATTERNS[bassMode] ? bassMode : "BASIC";
    this.accentSteps = [...accentSteps];
    this.loopNumber = 0;
    this.pendingLineClear = null;
  }

  configure({ chordMode, bassMode, accentSteps } = {}) {
    if (chordMode !== undefined) this.chordMode = Boolean(chordMode);
    if (BASS_PATTERNS[bassMode]) this.bassMode = bassMode;
    if (Array.isArray(accentSteps)) {
      this.accentSteps = accentSteps
        .map(Number)
        .filter((step) => Number.isInteger(step) && step >= 0 && step < 16);
    }
  }

  reset() {
    this.loopNumber = 0;
    this.pendingLineClear = null;
  }

  getChord(loopNumber = this.loopNumber) {
    return CHORD_PROGRESSION[
      ((Math.floor(loopNumber) % CHORD_PROGRESSION.length)
        + CHORD_PROGRESSION.length)
        % CHORD_PROGRESSION.length
    ];
  }

  getStepEvents(step, loopNumber = this.loopNumber) {
    const events = [];
    const chord = this.getChord(loopNumber);

    if (step === 0 && this.chordMode) {
      events.push({
        kind: "chord",
        bus: "chord",
        filename: chord.filename,
        chord: chord.name,
        gain: 1,
      });
    }

    if (BASS_PATTERNS[this.bassMode].includes(step)) {
      const useG = step >= 8 || (this.bassMode === "SYNCOPATION" && step === 6);
      events.push({
        kind: "bass",
        bus: "bass",
        filename: useG ? BASS_FILES.G : BASS_FILES.C,
        bass: useG ? "G" : "C",
        chord: chord.name,
        gain: 1,
      });
    }

    if (this.pendingLineClear && step >= 0) {
      events.push(this.pendingLineClear);
      this.pendingLineClear = null;
    }

    return events;
  }

  isAccent(step) {
    return this.accentSteps.includes(Number(step));
  }

  completeStep(step) {
    if (Number(step) === 15) this.loopNumber += 1;
    return this.loopNumber;
  }

  queueLineClear(count) {
    if (Number(count) === 4) {
      this.pendingLineClear = {
        kind: "lineClear",
        bus: "event",
        filename: "seq_synth_drop.wav",
        gain: 0.8,
        lineCount: 4,
      };
    }
  }
}

export default MusicEngine;
