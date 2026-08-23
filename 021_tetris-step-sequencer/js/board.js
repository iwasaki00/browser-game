import { getAbsoluteCells } from "./piece.js";

export const DEFAULT_BOARD_WIDTH = 16;
export const DEFAULT_BOARD_HEIGHT = 20;

function makeEmptyRow(width) {
  return Array.from({ length: width }, () => null);
}

/**
 * The settled-block grid. Falling pieces are deliberately kept outside this
 * class so snapshots always describe only the sequencer's locked notes.
 */
export class Board {
  constructor(width = DEFAULT_BOARD_WIDTH, height = DEFAULT_BOARD_HEIGHT) {
    if (!Number.isInteger(width) || width < 4) {
      throw new RangeError("Board width must be an integer of at least 4.");
    }
    if (!Number.isInteger(height) || height < 4) {
      throw new RangeError("Board height must be an integer of at least 4.");
    }

    this.width = width;
    this.height = height;
    this.grid = [];
    this.reset();
  }

  reset() {
    this.grid = Array.from(
      { length: this.height },
      () => makeEmptyRow(this.width),
    );
  }

  /**
   * Cells above the visible board are permitted while a piece is spawning.
   */
  canPlace(piece, overrides = {}) {
    if (!piece) return false;

    return getAbsoluteCells(piece, overrides).every(({ x, y }) => {
      if (x < 0 || x >= this.width || y >= this.height) return false;
      return y < 0 || this.grid[y][x] === null;
    });
  }

  isGrounded(piece) {
    return !this.canPlace(piece, { y: piece.y + 1 });
  }

  getGhostY(piece) {
    if (!piece) return null;

    let ghostY = piece.y;
    while (this.canPlace(piece, { y: ghostY + 1 })) {
      ghostY += 1;
    }
    return ghostY;
  }

  /**
   * Locks a valid piece into the grid.
   * Returns copied cell positions plus whether any cell remained above row 0.
   */
  lock(piece) {
    const cells = getAbsoluteCells(piece);
    let topOut = false;

    for (const { x, y, sound } of cells) {
      if (y < 0) {
        topOut = true;
        continue;
      }
      if (x < 0 || x >= this.width || y >= this.height) {
        topOut = true;
        continue;
      }
      this.grid[y][x] = { type: piece.type, sound: Boolean(sound) };
    }

    return {
      topOut,
      cells: cells.map(({ x, y, sound }) => ({
        x,
        y,
        sound: Boolean(sound),
      })),
    };
  }

  getFullRows() {
    const rows = [];
    for (let y = 0; y < this.height; y += 1) {
      if (this.grid[y].every((cell) => cell !== null)) rows.push(y);
    }
    return rows;
  }

  /**
   * Removes all complete rows at once. `rows` contains their pre-clear indexes,
   * which is useful for line effects before the renderer draws the new grid.
   */
  clearFullLines() {
    const rows = this.getFullRows();
    if (rows.length === 0) return rows;

    const removed = new Set(rows);
    const remaining = this.grid.filter((_, y) => !removed.has(y));
    const emptyRows = Array.from(
      { length: rows.length },
      () => makeEmptyRow(this.width),
    );
    this.grid = [...emptyRows, ...remaining];
    return rows;
  }

  snapshot() {
    return this.grid.map((row) => (
      row.map((cell) => (
        cell
          ? { type: cell.type, sound: Boolean(cell.sound) }
          : null
      ))
    ));
  }
}

export default Board;
