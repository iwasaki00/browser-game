export const GROOVE_LEVELS = Object.freeze([
  Object.freeze({ name: "CHAOS", min: 0, multiplier: 1 }),
  Object.freeze({ name: "ROUGH", min: 25, multiplier: 1.1 }),
  Object.freeze({ name: "GOOD", min: 45, multiplier: 1.25 }),
  Object.freeze({ name: "GROOVY", min: 68, multiplier: 1.5 }),
  Object.freeze({ name: "PERFECT BEAT", min: 84, multiplier: 2 }),
]);

const roleSteps = (notes, types) => (
  notes.filter((note) => types.includes(note.type)).map((note) => note.x)
);

const proximityHits = (steps, targets, tolerance = 1) => (
  targets.filter((target) => (
    steps.some((step) => Math.abs(step - target) <= tolerance)
  )).length
);

function levelForScore(score) {
  let result = GROOVE_LEVELS[0];
  for (const level of GROOVE_LEVELS) {
    if (score >= level.min) result = level;
  }
  return result;
}

function boardNotes(board = []) {
  const notes = [];
  board.forEach((row, y) => row?.forEach((cell, x) => {
    if (cell?.sound) notes.push({ x, y, type: cell.type });
  }));
  return notes;
}

export class GrooveEvaluator {
  constructor({ accentSteps = [0, 4, 8, 12] } = {}) {
    this.accentSteps = [...accentSteps];
    this.previousSignature = "";
    this.stableLoops = 0;
    this.goodLoops = 0;
    this.combo = 0;
    this.last = this._emptyResult();
  }

  reset() {
    this.previousSignature = "";
    this.stableLoops = 0;
    this.goodLoops = 0;
    this.combo = 0;
    this.last = this._emptyResult();
    return this.last;
  }

  evaluate(board, { lineCleared = false, advanceLoop = false } = {}) {
    const notes = boardNotes(board);
    const columns = Array.from({ length: 16 }, () => 0);
    for (const note of notes) columns[note.x] += 1;
    const activeColumns = columns.filter(Boolean).length;
    const crowdedColumns = columns.filter((count) => count >= 4).length;
    const kicks = roleSteps(notes, ["O"]);
    const snares = roleSteps(notes, ["T", "S"]);
    const hats = roleSteps(notes, ["I", "Z"]);
    const signature = notes
      .map((note) => `${note.x}:${note.type}`)
      .sort()
      .join("|");

    let score = 0;
    score += proximityHits(kicks, this.accentSteps, 0) * 5;
    score += proximityHits(snares, [4, 12], 1) * 9;
    score += Math.min(18, hats.length * 2.5);
    if (hats.length >= 4) {
      const sorted = [...new Set(hats)].sort((a, b) => a - b);
      const intervals = sorted.slice(1).map((step, index) => step - sorted[index]);
      if (intervals.length && Math.max(...intervals) - Math.min(...intervals) <= 2) {
        score += 10;
      }
    }
    if (notes.length) score += Math.max(0, 18 - crowdedColumns * 7);
    if (activeColumns >= 4 && activeColumns <= 12) score += 16;
    else if (activeColumns > 12) {
      score += Math.max(0, 8 - (activeColumns - 12) * 2);
    } else {
      score += activeColumns * 2;
    }
    if (notes.length >= 6 && notes.length <= 32) score += 8;
    if (notes.length > 40) score -= 15;
    if (signature && signature === this.previousSignature) score += 10;
    if (lineCleared && score >= 45) score += 5;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const level = levelForScore(score);
    if (advanceLoop) {
      if (signature && signature === this.previousSignature) this.stableLoops += 1;
      else this.stableLoops = 0;

      if (score >= 45) {
        this.goodLoops += 1;
        if (this.goodLoops >= 2) {
          this.combo += score >= 68 ? 2 : 1;
          this.goodLoops = 0;
        }
      } else {
        this.goodLoops = 0;
        this.combo = 0;
      }
      this.previousSignature = signature;
    }

    this.last = {
      score,
      grade: level.name,
      multiplier: level.multiplier,
      combo: this.combo,
      stableLoops: this.stableLoops,
      noteCount: notes.length,
      activeColumns,
      lineCleared,
      recoveryBonus: Boolean(lineCleared && score >= 45),
    };
    return { ...this.last };
  }

  _emptyResult() {
    return {
      score: 0,
      grade: "CHAOS",
      multiplier: 1,
      combo: 0,
      stableLoops: 0,
      noteCount: 0,
      activeColumns: 0,
      lineCleared: false,
      recoveryBonus: false,
    };
  }
}

export default GrooveEvaluator;
