import {
  clonePiece,
  createBag,
  createPiece,
  getPieceCells,
  normalizeRotation,
} from "./piece.js";
import {
  Board,
  DEFAULT_BOARD_HEIGHT,
  DEFAULT_BOARD_WIDTH,
} from "./board.js";

const NEXT_COUNT = 3;
const LOCK_DELAY_MS = 400;
const MAX_UPDATE_MS = 1000;
const MIN_GRAVITY_MS = 70;

const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);

// A small, deterministic "gallery" of all seven tetromino types. Keeping this
// as data makes the debug fixture easy to adjust without coupling it to Board.
const DEBUG_DEMO_ROWS = Object.freeze([
  "......OO........",
  "....IIOOII......",
  "................",
  "...T....SS......",
  "..TTT..SS.......",
  "................",
  "..ZZ.J......L...",
  "...ZZJJJ...LLL..",
]);

// Small wall/floor kicks keep rotations friendly without implementing SRS.
const ROTATION_KICKS = Object.freeze([
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [0, -2],
]);

export class TetrisGame {
  constructor({ onEvent } = {}) {
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.board = new Board(DEFAULT_BOARD_WIDTH, DEFAULT_BOARD_HEIGHT);

    this.activePiece = null;
    this.queue = [];
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.scoreMultiplier = 1;
    this.status = "idle";

    this.gravityElapsed = 0;
    this.lockElapsed = 0;
  }

  start() {
    return this.restart();
  }

  restart() {
    this.board.reset();
    this.activePiece = null;
    this.queue = [];
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.scoreMultiplier = 1;
    this.status = "running";
    this.gravityElapsed = 0;
    this.lockElapsed = 0;

    this._fillQueue();
    this._spawnNext();
    this._emit("gameStart", {});
    this._stateChanged();
    return this.getState();
  }

  update(deltaMs) {
    if (this.status !== "running" || !this.activePiece) return false;

    const parsedDelta = Number(deltaMs);
    if (!Number.isFinite(parsedDelta) || parsedDelta <= 0) return false;
    const elapsed = Math.min(parsedDelta, MAX_UPDATE_MS);
    const wasGrounded = this.board.isGrounded(this.activePiece);
    let changed = false;

    this.gravityElapsed += elapsed;
    let gravitySteps = 0;

    while (
      this.gravityElapsed >= this._gravityInterval()
      && this.status === "running"
      && gravitySteps < 20
    ) {
      this.gravityElapsed -= this._gravityInterval();
      gravitySteps += 1;

      if (this.board.canPlace(this.activePiece, {
        y: this.activePiece.y + 1,
      })) {
        this.activePiece.y += 1;
        changed = true;
      } else {
        // Do not retain a large gravity backlog while waiting for lock.
        this.gravityElapsed = 0;
        break;
      }
    }

    if (this.board.isGrounded(this.activePiece)) {
      // If gravity reached the floor in this update, start counting on the
      // next frame instead of consuming time that elapsed before contact.
      this.lockElapsed = wasGrounded ? this.lockElapsed + elapsed : 0;
      if (this.lockElapsed >= LOCK_DELAY_MS) {
        this._lockActivePiece();
        return true;
      }
    } else {
      this.lockElapsed = 0;
    }

    if (changed) this._stateChanged();
    return changed;
  }

  move(dx) {
    if (!this._canControl()) return false;

    const direction = Math.sign(Number(dx));
    if (!Number.isFinite(direction) || direction === 0) return false;
    const nextX = this.activePiece.x + direction;
    if (!this.board.canPlace(this.activePiece, { x: nextX })) return false;

    this.activePiece.x = nextX;
    this.lockElapsed = 0;
    this._stateChanged();
    return true;
  }

  hardDrop() {
    if (!this._canControl()) return false;

    const targetY = this.board.getGhostY(this.activePiece);
    const distance = Math.max(0, targetY - this.activePiece.y);
    this.activePiece.y = targetY;
    this.score += Math.round(distance * 2 * this.scoreMultiplier);
    this._lockActivePiece();
    return true;
  }

  rotate(direction = 1) {
    if (!this._canControl()) return false;

    const turn = Number(direction) < 0 ? -1 : 1;
    const nextRotation = normalizeRotation(this.activePiece.rotation + turn);

    for (const [kickX, kickY] of ROTATION_KICKS) {
      const nextX = this.activePiece.x + kickX;
      const nextY = this.activePiece.y + kickY;
      if (!this.board.canPlace(this.activePiece, {
        x: nextX,
        y: nextY,
        rotation: nextRotation,
      })) {
        continue;
      }

      this.activePiece.x = nextX;
      this.activePiece.y = nextY;
      this.activePiece.rotation = nextRotation;
      this.lockElapsed = 0;
      this._stateChanged();
      return true;
    }

    return false;
  }

  setPaused(paused = true) {
    const shouldPause = Boolean(paused);
    if (shouldPause && this.status === "running") {
      this.status = "paused";
      this._emit("pause", { paused: true });
      this._stateChanged();
      return true;
    }
    if (!shouldPause && this.status === "paused") {
      this.status = "running";
      this.gravityElapsed = 0;
      this._emit("pause", { paused: false });
      this._stateChanged();
      return true;
    }
    return false;
  }

  setScoreMultiplier(value = 1) {
    const multiplier = Number(value);
    if (!Number.isFinite(multiplier)) return this.scoreMultiplier;
    this.scoreMultiplier = Math.min(4, Math.max(1, multiplier));
    return this.scoreMultiplier;
  }

  /**
   * Development helpers intentionally work only during an active session.
   * They preserve the current score/progression unless normal gameplay caused
   * a change (for example, dropping the prepared I piece clears a line).
   */
  debugClearBoard() {
    if (!this._canDebug()) return false;

    this.board.reset();
    this._emit("debug", { action: "clearBoard" });
    this._stateChanged();
    return true;
  }

  debugLoadDemoBoard() {
    if (!this._canDebug()) return false;

    this.board.reset();

    // Keep four spawn rows clear even if a non-default, shorter board is used.
    const rowCount = Math.min(
      DEBUG_DEMO_ROWS.length,
      Math.max(0, this.board.height - 4),
    );
    const sourceRows = DEBUG_DEMO_ROWS.slice(DEBUG_DEMO_ROWS.length - rowCount);
    const startY = this.board.height - sourceRows.length;
    const startX = Math.max(
      0,
      Math.floor((this.board.width - DEBUG_DEMO_ROWS[0].length) / 2),
    );

    sourceRows.forEach((sourceRow, rowOffset) => {
      const boardRow = this.board.grid[startY + rowOffset];
      for (let sourceX = 0; sourceX < sourceRow.length; sourceX += 1) {
        const type = sourceRow[sourceX];
        const boardX = startX + sourceX;
        if (type === "." || boardX < 0 || boardX >= this.board.width) continue;
        boardRow[boardX] = {
          type,
          sound: (sourceX + rowOffset) % 3 === 0,
        };
      }

      // The standard 16-column fixture is already open on every row. This
      // guard keeps that invariant if a narrower custom Board is injected.
      if (boardRow.every((cell) => cell !== null)) {
        boardRow[this.board.width - 1] = null;
      }
    });

    const activeType = this.activePiece?.type ?? "I";
    this.activePiece = createPiece(activeType, this.board.width);
    this.gravityElapsed = 0;
    this.lockElapsed = 0;

    this._emit("debug", { action: "loadDemoBoard" });
    this._stateChanged();
    return true;
  }

  debugPrepareLineClear() {
    if (!this._canDebug()) return false;

    this.board.reset();
    const bottomRow = this.board.grid[this.board.height - 1];
    const fillerTypes = ["J", "T", "L", "O", "S", "Z"];
    let fillerIndex = 0;

    const preparedPiece = createPiece("I", this.board.width);
    const gapStart = preparedPiece.x;
    const gapEnd = gapStart + 3;

    for (let x = 0; x < this.board.width; x += 1) {
      if (x >= gapStart && x <= gapEnd) continue;
      bottomRow[x] = {
        type: fillerTypes[fillerIndex % fillerTypes.length],
        sound: fillerIndex % 3 === 0,
      };
      fillerIndex += 1;
    }

    preparedPiece.soundMask = [true, false, true, false];
    this.activePiece = preparedPiece;
    this.gravityElapsed = 0;
    this.lockElapsed = 0;

    this._emit("debug", { action: "prepareLineClear" });
    this._stateChanged();
    return true;
  }

  debugForceGameOver() {
    if (!this._canDebug()) return false;

    this._emit("debug", { action: "forceGameOver" });
    this._gameOver("debug");
    return true;
  }

  getState() {
    const board = this.board.snapshot();
    const active = this.activePiece
      ? {
          ...clonePiece(this.activePiece),
          cells: getPieceCells(
            this.activePiece.type,
            this.activePiece.rotation,
          ).map(([x, y], index) => ({
            x,
            y,
            sound: Boolean(this.activePiece.soundMask?.[index]),
          })),
        }
      : null;

    return {
      board,
      // Alias retained for simple renderers that call the settled board "grid".
      grid: board,
      active,
      ghostY: this.activePiece
        ? this.board.getGhostY(this.activePiece)
        : null,
      next: this.queue.slice(0, NEXT_COUNT),
      score: this.score,
      level: this.level,
      lines: this.lines,
      scoreMultiplier: this.scoreMultiplier,
      status: this.status,
      running: this.status === "running",
      paused: this.status === "paused",
      width: this.board.width,
      height: this.board.height,
    };
  }

  _canControl() {
    return this.status === "running" && this.activePiece !== null;
  }

  _canDebug() {
    return this.status === "running" || this.status === "paused";
  }

  _gravityInterval() {
    return Math.max(
      MIN_GRAVITY_MS,
      1000 * Math.pow(0.8, Math.max(0, this.level - 1)),
    );
  }

  _fillQueue(minimum = NEXT_COUNT + 1) {
    while (this.queue.length < minimum) {
      this.queue.push(...createBag());
    }
  }

  _spawnNext() {
    this._fillQueue();
    const type = this.queue.shift();
    this._fillQueue();
    return this._spawn(type);
  }

  _spawn(type) {
    const piece = createPiece(type, this.board.width);
    this.activePiece = piece;
    this.gravityElapsed = 0;
    this.lockElapsed = 0;

    if (!this.board.canPlace(piece)) {
      this._gameOver("spawnBlocked");
      return false;
    }
    return true;
  }

  _lockActivePiece() {
    if (!this.activePiece || this.status !== "running") return false;

    const lockedPiece = clonePiece(this.activePiece);
    const result = this.board.lock(lockedPiece);
    this.activePiece = null;
    this.gravityElapsed = 0;
    this.lockElapsed = 0;

    this._emit("pieceLock", {
      type: lockedPiece.type,
      cells: result.cells,
    });

    if (result.topOut) {
      this._gameOver("topOut");
      return true;
    }

    const clearedRows = this.board.clearFullLines();
    if (clearedRows.length > 0) {
      const scoringLevel = this.level;
      this.score += Math.round(
        (LINE_SCORES[clearedRows.length] ?? 0)
          * scoringLevel
          * this.scoreMultiplier,
      );
      this.lines += clearedRows.length;
      this.level = Math.floor(this.lines / 10) + 1;
      this._emit("lineClear", {
        rows: [...clearedRows],
        count: clearedRows.length,
      });
    }

    this._spawnNext();
    this._stateChanged();
    return true;
  }

  _gameOver(reason) {
    this.status = "gameover";
    this.activePiece = null;
    this._emit("gameOver", {
      reason,
      score: this.score,
      level: this.level,
      lines: this.lines,
    });
    this._stateChanged();
  }

  _stateChanged() {
    const state = this.getState();
    this._emit("stateChange", state, state);
  }

  _emit(type, detail, suppliedState = null) {
    if (!this.onEvent) return;

    const state = suppliedState ?? this.getState();
    try {
      this.onEvent(type, detail, state);
    } catch (error) {
      // Input/gameplay should keep running if a presentation callback fails.
      console.error(`TetrisGame event handler failed for "${type}".`, error);
    }
  }
}

export default TetrisGame;
