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
  const COMPLETION_LOOPS = 4;
  const GLITCH_DURATION_MS = 700;
  const TEMPO_RANGES = {
    SLOW: [90, 105],
    MID: [110, 125],
    FAST: [130, 150]
  };
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
      mineAccentEnabled: false,
      velocity: 0,
      pitch: PITCHES[(row * 3 + column) % PITCHES.length]
    };
  }

  function categoryForBpm(bpm) {
    if (bpm <= TEMPO_RANGES.SLOW[1]) return "SLOW";
    if (bpm >= TEMPO_RANGES.FAST[0]) return "FAST";
    return "MID";
  }

  function generateTempo(random = Math.random) {
    const categories = Object.keys(TEMPO_RANGES);
    const category = categories[Math.min(categories.length - 1, Math.floor(random() * categories.length))];
    const [minimum, maximum] = TEMPO_RANGES[category];
    const bpm = minimum + Math.min(maximum - minimum, Math.floor(random() * (maximum - minimum + 1)));
    return { category, bpm };
  }

  function createGame(options = {}) {
    const rows = options.rows || ROWS;
    const columns = options.columns || COLUMNS;
    const maximumMines = Math.max(1, rows * columns - 1);
    const mineCount = Math.max(1, Math.min(maximumMines,
      options.mineCount == null ? MINE_COUNT : Math.round(options.mineCount)));
    const tempo = options.bpm == null
      ? generateTempo(options.random || Math.random)
      : { bpm: options.bpm, category: options.tempoCategory || categoryForBpm(options.bpm) };
    return {
      rows,
      columns,
      steps: columns,
      mineCount,
      maxMisses: options.maxMisses || MAX_MISSES,
      board: Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns }, (_, column) => createCell(row, column))
      ),
      gameState: "ready",
      missCount: 0,
      currentStep: 0,
      bpm: tempo.bpm,
      tempoCategory: tempo.category,
      isPlaying: false,
      minesPlaced: false,
      glitchState: { active: false, step: null, expiresAt: 0 },
      completionMode: false,
      completionLoopCount: 0,
      completionLoopTarget: options.completionLoops || COMPLETION_LOOPS,
      isPerfect: false
    };
  }

  function newGame(options = {}) {
    return createGame(options);
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
    game.board.flat().forEach((cell) => {
      cell.mineAccentEnabled = cell.isMine && cell.isFlagged;
    });
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
      game.isPerfect = isPerfectSweep(game);
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

  function triggerGlitch(game, step, now = Date.now()) {
    game.glitchState = {
      active: true,
      step,
      expiresAt: now + GLITCH_DURATION_MS
    };
    return game.glitchState;
  }

  function refreshGlitch(game, now = Date.now()) {
    if (game.glitchState.active && now >= game.glitchState.expiresAt) {
      game.glitchState = { active: false, step: null, expiresAt: 0 };
    }
    return game.glitchState.active;
  }

  function openCell(game, row, column, random = Math.random, now = Date.now()) {
    const cell = game.board[row] && game.board[row][column];
    if (!cell || game.gameState === "gameover" || cell.isOpen || cell.isFlagged) {
      return { type: "ignored", opened: [] };
    }
    if (!game.minesPlaced) placeMines(game, row, column, random);
    if (game.gameState === "ready") game.gameState = "playing";

    if (cell.isMine) {
      cell.isOpen = true;
      game.missCount += 1;
      triggerGlitch(game, cell.column, now);
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
    if (!cell) return false;
    return setFlag(game, row, column, !cell.isFlagged);
  }

  function setFlag(game, row, column, flagged) {
    const cell = game.board[row] && game.board[row][column];
    if (!cell || cell.isOpen || game.gameState === "gameover" || game.gameState === "clear") return false;
    cell.isFlagged = Boolean(flagged);
    cell.mineAccentEnabled = cell.isMine && cell.isFlagged;
    return cell.isFlagged;
  }

  function chordOpen(game, row, column, random = Math.random, now = Date.now()) {
    const target = game.board[row] && game.board[row][column];
    if (!target || !target.isOpen || target.isMine || target.adjacentMines <= 0 ||
        game.gameState === "gameover" || game.gameState === "clear") {
      return { type: "ignored", opened: [], minesHit: 0, cleared: false, gameOver: false };
    }
    const surrounding = neighbors(game, row, column);
    const flagCount = surrounding.filter((cell) => cell.isFlagged).length;
    if (flagCount !== target.adjacentMines) {
      return { type: "ignored", opened: [], minesHit: 0, cleared: false, gameOver: false };
    }

    const opened = [];
    let minesHit = 0;
    let cleared = false;
    for (const cell of surrounding) {
      if (cell.isOpen || cell.isFlagged || game.gameState === "gameover") continue;
      const result = openCell(game, cell.row, cell.column, random, now);
      opened.push(...result.opened);
      if (result.type === "mine") minesHit += 1;
      if (result.cleared) cleared = true;
    }
    return {
      type: "chord",
      opened,
      minesHit,
      cleared,
      gameOver: game.gameState === "gameover"
    };
  }

  function getCorrectFlagCount(game) {
    return game.board.flat().filter((cell) => cell.mineAccentEnabled).length;
  }

  function isPerfectSweep(game) {
    return game.minesPlaced &&
      countOpenSafeCells(game) === game.rows * game.columns - game.mineCount &&
      getCorrectFlagCount(game) === game.mineCount;
  }

  function nextStep(currentStep, columns = COLUMNS) {
    return (currentStep + 1) % columns;
  }

  function getNotesAtStep(game, step) {
    return game.board
      .map((row) => row[step])
      .filter((cell) => cell.isOpen && !cell.isMine && !cell.isFlagged && cell.isNote);
  }

  function getMineAccentsAtStep(game, step) {
    return game.board
      .map((row) => row[step])
      .filter((cell) => cell.mineAccentEnabled);
  }

  function beginCompletion(game) {
    if (game.gameState !== "clear") return false;
    game.completionMode = true;
    game.completionLoopCount = 0;
    game.currentStep = 0;
    game.isPerfect = isPerfectSweep(game);
    return true;
  }

  function recordCompletionLoop(game) {
    if (!game.completionMode) return false;
    game.completionLoopCount += 1;
    if (game.completionLoopCount >= game.completionLoopTarget) {
      game.completionMode = false;
      return true;
    }
    return false;
  }

  return {
    ROWS,
    COLUMNS,
    MINE_COUNT,
    MAX_MISSES,
    DEFAULT_BPM,
    COMPLETION_LOOPS,
    GLITCH_DURATION_MS,
    TEMPO_RANGES,
    categoryForBpm,
    generateTempo,
    createGame,
    newGame,
    calculateAdjacentMines,
    placeMines,
    velocityForAdjacentMines,
    updateNote,
    countOpenSafeCells,
    checkClear,
    triggerGlitch,
    refreshGlitch,
    expandFrom,
    openCell,
    toggleFlag,
    setFlag,
    chordOpen,
    getCorrectFlagCount,
    isPerfectSweep,
    nextStep,
    getNotesAtStep,
    getMineAccentsAtStep,
    beginCompletion,
    recordCompletionLoop
  };
});
