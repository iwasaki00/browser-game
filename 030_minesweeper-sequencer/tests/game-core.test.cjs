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
