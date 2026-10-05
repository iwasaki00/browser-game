const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../game-core.js");

function fixedRandom(value = 0) {
  return () => value;
}

function setMines(game, coordinates) {
  coordinates.forEach(([row, column]) => { game.board[row][column].isMine = true; });
  game.mineCount = coordinates.length;
  game.minesPlaced = true;
  Core.calculateAdjacentMines(game);
}

test("8x8 board places exactly 10 mines and keeps the first click safe", () => {
  const game = Core.createGame();
  Core.openCell(game, 3, 3, fixedRandom(0.42));
  assert.equal(game.board.length, 8);
  assert.equal(game.board[0].length, 8);
  assert.equal(game.board.flat().filter((cell) => cell.isMine).length, 10);
  assert.equal(game.board[3][3].isMine, false);
  assert.equal(game.board[3][3].isOpen, true);
});

test("adjacent mine counts include all eight neighbors", () => {
  const game = Core.createGame({ mineCount: 2 });
  setMines(game, [[0, 0], [2, 2]]);
  assert.equal(game.board[1][1].adjacentMines, 2);
  assert.equal(game.board[0][1].adjacentMines, 1);
  assert.equal(game.board[7][7].adjacentMines, 0);
});

test("opening a zero expands its connected area and boundary numbers", () => {
  const game = Core.createGame({ rows: 4, columns: 4, mineCount: 1 });
  setMines(game, [[3, 3]]);
  const result = Core.openCell(game, 0, 0);
  assert.equal(result.type, "safe");
  assert.equal(game.board[0][0].isOpen, true);
  assert.equal(game.board[2][2].isOpen, true);
  assert.equal(game.board[3][3].isOpen, false);
  assert.equal(game.gameState, "clear");
});

test("clear requires every safe cell to be open", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.openCell(game, 0, 1);
  Core.openCell(game, 1, 0);
  assert.equal(game.gameState, "playing");
  Core.openCell(game, 1, 1);
  assert.equal(game.gameState, "clear");
});

test("three different mine hits cause game over", () => {
  const game = Core.createGame({ rows: 3, columns: 3, mineCount: 3 });
  setMines(game, [[0, 0], [0, 1], [0, 2]]);
  assert.equal(Core.openCell(game, 0, 0).gameOver, false);
  assert.equal(Core.openCell(game, 0, 1).gameOver, false);
  assert.equal(Core.openCell(game, 0, 2).gameOver, true);
  assert.equal(game.missCount, 3);
  assert.equal(game.gameState, "gameover");
});

test("step progression wraps from step 8 to step 1", () => {
  let step = 0;
  for (let index = 0; index < 8; index += 1) step = Core.nextStep(step);
  assert.equal(step, 0);
  assert.equal(Core.nextStep(6), 7);
  assert.equal(Core.nextStep(7), 0);
});

test("note and velocity derive from an opened numbered cell", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(game, [[0, 0]]);
  const cell = game.board[0][1];
  assert.equal(cell.isNote, false);
  Core.openCell(game, 0, 1);
  assert.equal(cell.isNote, true);
  assert.equal(cell.velocity, 0.38);
  assert.deepEqual(Core.getNotesAtStep(game, 1), [cell]);
});

test("flagged and closed cells never become sequencer notes", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.toggleFlag(game, 0, 1);
  assert.deepEqual(Core.getNotesAtStep(game, 1), []);
  Core.toggleFlag(game, 0, 1);
  Core.openCell(game, 0, 1);
  game.board[0][1].isFlagged = true;
  assert.deepEqual(Core.getNotesAtStep(game, 1), []);
});

test("tempo generation stays inside each category range", () => {
  const slow = Core.generateTempo(() => 0);
  const midValues = [0.34, 0.5];
  const mid = Core.generateTempo(() => midValues.shift());
  const fastValues = [0.99, 0.99];
  const fast = Core.generateTempo(() => fastValues.shift());
  assert.equal(slow.category, "SLOW");
  assert.ok(slow.bpm >= 90 && slow.bpm <= 105);
  assert.equal(mid.category, "MID");
  assert.ok(mid.bpm >= 110 && mid.bpm <= 125);
  assert.equal(fast.category, "FAST");
  assert.ok(fast.bpm >= 130 && fast.bpm <= 150);
});

test("generated BPM never leaves the declared category ranges", () => {
  for (let index = 0; index <= 100; index += 1) {
    let call = 0;
    const value = index / 100;
    const tempo = Core.generateTempo(() => (call++ === 0 ? value : 1 - value));
    const [minimum, maximum] = Core.TEMPO_RANGES[tempo.category];
    assert.ok(tempo.bpm >= minimum && tempo.bpm <= maximum);
    assert.equal(Number.isInteger(tempo.bpm), true);
  }
});

test("new game calls tempo generation again", () => {
  const values = [0, 0, 0.99, 0.99];
  const random = () => values.shift();
  const first = Core.newGame({ random });
  const second = Core.newGame({ random });
  assert.deepEqual([first.tempoCategory, first.bpm], ["SLOW", 90]);
  assert.deepEqual([second.tempoCategory, second.bpm], ["FAST", 150]);
});

test("only a correctly flagged mine becomes a mine accent and unflag removes it", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.toggleFlag(game, 0, 1);
  assert.equal(game.board[0][1].mineAccentEnabled, false);
  assert.equal(Core.getMineAccentsAtStep(game, 1).length, 0);
  Core.toggleFlag(game, 0, 0);
  assert.equal(game.board[0][0].mineAccentEnabled, true);
  assert.deepEqual(Core.getMineAccentsAtStep(game, 0), [game.board[0][0]]);
  Core.toggleFlag(game, 0, 0);
  assert.equal(game.board[0][0].mineAccentEnabled, false);
});

test("mine hit activates a temporary glitch and third miss still ends the game", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 3 });
  setMines(game, [[0, 0], [0, 1], [1, 0]]);
  Core.openCell(game, 0, 0, Math.random, 1000);
  assert.equal(game.missCount, 1);
  assert.equal(Core.refreshGlitch(game, 1001), true);
  assert.equal(Core.refreshGlitch(game, 1000 + Core.GLITCH_DURATION_MS), false);
  Core.openCell(game, 0, 1, Math.random, 2000);
  const result = Core.openCell(game, 1, 0, Math.random, 3000);
  assert.equal(result.gameOver, true);
  assert.equal(game.gameState, "gameover");
});

test("clear is normal without all mine flags and perfect with every mine flagged", () => {
  const normal = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(normal, [[0, 0]]);
  [[0, 1], [1, 0], [1, 1]].forEach(([row, column]) => Core.openCell(normal, row, column));
  assert.equal(normal.gameState, "clear");
  assert.equal(normal.isPerfect, false);
  assert.equal(Core.beginCompletion(normal), true);
  assert.equal(normal.completionMode, true);

  const perfect = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(perfect, [[0, 0]]);
  Core.toggleFlag(perfect, 0, 0);
  [[0, 1], [1, 0], [1, 1]].forEach(([row, column]) => Core.openCell(perfect, row, column));
  assert.equal(perfect.gameState, "clear");
  assert.equal(perfect.isPerfect, true);
});

test("completion mode stops after the configured four loops", () => {
  const game = Core.createGame({ rows: 2, columns: 2, mineCount: 1 });
  setMines(game, [[0, 0]]);
  [[0, 1], [1, 0], [1, 1]].forEach(([row, column]) => Core.openCell(game, row, column));
  Core.beginCompletion(game);
  assert.equal(Core.recordCompletionLoop(game), false);
  assert.equal(Core.recordCompletionLoop(game), false);
  assert.equal(Core.recordCompletionLoop(game), false);
  assert.equal(Core.recordCompletionLoop(game), true);
  assert.equal(game.completionLoopCount, 4);
  assert.equal(game.completionMode, false);
});

test("new game resets Phase 2 state", () => {
  const previous = Core.createGame({ bpm: 120, tempoCategory: "MID" });
  previous.glitchState = { active: true, step: 4, expiresAt: 9999 };
  previous.completionMode = true;
  previous.completionLoopCount = 3;
  previous.isPerfect = true;
  previous.currentStep = 6;
  previous.isPlaying = true;
  const next = Core.newGame({ bpm: 96, tempoCategory: "SLOW" });
  assert.deepEqual({
    bpm: next.bpm,
    tempoCategory: next.tempoCategory,
    glitch: next.glitchState.active,
    completionMode: next.completionMode,
    completionLoopCount: next.completionLoopCount,
    perfect: next.isPerfect,
    currentStep: next.currentStep,
    playing: next.isPlaying,
    accents: Core.getCorrectFlagCount(next)
  }, {
    bpm: 96,
    tempoCategory: "SLOW",
    glitch: false,
    completionMode: false,
    completionLoopCount: 0,
    perfect: false,
    currentStep: 0,
    playing: false,
    accents: 0
  });
});

test("variable board dimensions and mine counts are generated safely", () => {
  [
    [6, 8, 6],
    [8, 8, 10],
    [8, 12, 15],
    [8, 16, 20],
    [10, 12, 19],
    [12, 16, 30]
  ].forEach(([rows, columns, mines]) => {
    const game = Core.createGame({ rows, columns, mineCount: mines });
    Core.openCell(game, rows - 1, columns - 1, fixedRandom(0.37));
    assert.equal(game.board.length, rows);
    assert.equal(game.board[0].length, columns);
    assert.equal(game.board.flat().filter((cell) => cell.isMine).length, mines);
    assert.equal(game.board[rows - 1][columns - 1].isMine, false);
  });
});

test("sequencer wraps for 8, 12, and 16 steps", () => {
  [8, 12, 16].forEach((steps) => {
    assert.equal(Core.nextStep(steps - 2, steps), steps - 1);
    assert.equal(Core.nextStep(steps - 1, steps), 0);
  });
});

test("chord open does nothing when surrounding flag count differs", () => {
  const game = Core.createGame({ rows: 3, columns: 3, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.openCell(game, 1, 1);
  const result = Core.chordOpen(game, 1, 1);
  assert.equal(result.type, "ignored");
  assert.equal(Core.countOpenSafeCells(game), 1);
});

test("chord open with a correct flag opens only safe neighbors", () => {
  const game = Core.createGame({ rows: 3, columns: 3, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.openCell(game, 1, 1);
  Core.setFlag(game, 0, 0, true);
  const result = Core.chordOpen(game, 1, 1);
  assert.equal(result.type, "chord");
  assert.equal(result.minesHit, 0);
  assert.equal(game.missCount, 0);
  assert.equal(game.gameState, "clear");
});

test("chord open with a wrong flag can hit a mine through normal MISS handling", () => {
  const game = Core.createGame({ rows: 3, columns: 3, mineCount: 1 });
  setMines(game, [[0, 0]]);
  Core.openCell(game, 1, 1);
  Core.setFlag(game, 0, 1, true);
  const result = Core.chordOpen(game, 1, 1, Math.random, 500);
  assert.equal(result.type, "chord");
  assert.equal(result.minesHit, 1);
  assert.equal(game.missCount, 1);
  assert.equal(Core.refreshGlitch(game, 501), true);
});
