(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MinesweeperCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROWS = 8;
  const COLUMNS = 8;
  const MINE_COUNT = 10;
  const MAX_MISSES = 3;
  const DEFAULT_BPM = 120;
  const PITCHES = [48, 51, 53, 55, 58, 60, 63, 65];

  function createCell(row, column) {
    return {
      row,
      column,
      isMine: false,
      adjacentMines: 0,
      isOpen: false,
      isFlagged: false,
      isNote: false,
      velocity: 0,
      pitch: PITCHES[(row * 3 + column) % PITCHES.length]
    };
  }

  function createGame(options = {}) {
    const rows = options.rows || ROWS;
    const columns = options.columns || COLUMNS;
    return {
      rows,
      columns,
      mineCount: options.mineCount == null ? MINE_COUNT : options.mineCount,
      maxMisses: options.maxMisses || MAX_MISSES,
      board: Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns }, (_, column) => createCell(row, column))
      ),
      gameState: "ready",
      missCount: 0,
      currentStep: 0,
      bpm: options.bpm || DEFAULT_BPM,
      isPlaying: false,
      minesPlaced: false
    };
  }

  function neighbors(game, row, column) {
    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow >= 0 && nextRow < game.rows && nextColumn >= 0 && nextColumn < game.columns) {
          result.push(game.board[nextRow][nextColumn]);
        }
      }
    }
    return result;
  }

  function calculateAdjacentMines(game) {
    game.board.flat().forEach((cell) => {
      cell.adjacentMines = neighbors(game, cell.row, cell.column)
        .filter((neighbor) => neighbor.isMine).length;
    });
    return game;
  }

  function placeMines(game, safeRow, safeColumn, random = Math.random) {
    if (game.minesPlaced) return game;
    const candidates = game.board.flat().filter((cell) =>
      cell.row !== safeRow || cell.column !== safeColumn
    );

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    candidates.slice(0, game.mineCount).forEach((cell) => { cell.isMine = true; });
    game.minesPlaced = true;
    calculateAdjacentMines(game);
    return game;
  }

  function velocityForAdjacentMines(count) {
    if (count <= 0) return 0;
    if (count === 1) return 0.38;
    if (count === 2) return 0.56;
    if (count === 3) return 0.72;
    return 0.88;
  }

  function updateNote(cell) {
    cell.isNote = cell.isOpen && !cell.isMine && cell.adjacentMines > 0;
    cell.velocity = cell.isNote ? velocityForAdjacentMines(cell.adjacentMines) : 0;
  }

  function countOpenSafeCells(game) {
    return game.board.flat().filter((cell) => cell.isOpen && !cell.isMine).length;
  }

  function checkClear(game) {
    const safeCellCount = game.rows * game.columns - game.mineCount;
    if (game.minesPlaced && countOpenSafeCells(game) === safeCellCount) {
      game.gameState = "clear";
      return true;
    }
    return false;
  }

  function expandFrom(game, startCell) {
    const queue = [startCell];
    const opened = [];
    const visited = new Set();

    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.row}:${cell.column}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (cell.isMine || cell.isFlagged) continue;

      if (!cell.isOpen) {
        cell.isOpen = true;
        updateNote(cell);
        opened.push(cell);
      }

      if (cell.adjacentMines === 0) {
        neighbors(game, cell.row, cell.column).forEach((neighbor) => {
          if (!neighbor.isMine && !neighbor.isFlagged && !neighbor.isOpen) queue.push(neighbor);
        });
      }
    }
    return opened;
  }

  function openCell(game, row, column, random = Math.random) {
    const cell = game.board[row] && game.board[row][column];
    if (!cell || game.gameState === "gameover" || cell.isOpen || cell.isFlagged) {
      return { type: "ignored", opened: [] };
    }
    if (!game.minesPlaced) placeMines(game, row, column, random);
    if (game.gameState === "ready") game.gameState = "playing";

    if (cell.isMine) {
      cell.isOpen = true;
      game.missCount += 1;
      if (game.missCount >= game.maxMisses) {
        game.gameState = "gameover";
      }
      return { type: "mine", opened: [cell], gameOver: game.gameState === "gameover" };
    }

    const opened = expandFrom(game, cell);
    const cleared = checkClear(game);
    return { type: "safe", opened, cleared };
  }

  function toggleFlag(game, row, column) {
    const cell = game.board[row] && game.board[row][column];
    if (!cell || cell.isOpen || game.gameState === "gameover" || game.gameState === "clear") return false;
    cell.isFlagged = !cell.isFlagged;
    return cell.isFlagged;
  }

  function nextStep(currentStep, columns = COLUMNS) {
    return (currentStep + 1) % columns;
  }

  function getNotesAtStep(game, step) {
    return game.board
      .map((row) => row[step])
      .filter((cell) => cell.isOpen && !cell.isMine && !cell.isFlagged && cell.isNote);
  }

  return {
    ROWS,
    COLUMNS,
    MINE_COUNT,
    MAX_MISSES,
    DEFAULT_BPM,
    createGame,
    calculateAdjacentMines,
    placeMines,
    velocityForAdjacentMines,
    updateNote,
    countOpenSafeCells,
    checkClear,
    expandFrom,
    openCell,
    toggleFlag,
    nextStep,
    getNotesAtStep
  };
});
