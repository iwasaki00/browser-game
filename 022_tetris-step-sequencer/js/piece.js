/**
 * Tetromino definitions and small, side-effect-free piece helpers.
 *
 * A piece stores only its type, board position and rotation. Its occupied cells
 * are looked up here so the board, game and renderer all share one definition.
 */

export const PIECE_TYPES = Object.freeze(["I", "O", "T", "S", "Z", "J", "L"]);

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

for (const rotations of Object.values(SHAPES)) {
  for (const cells of rotations) {
    for (const cell of cells) Object.freeze(cell);
    Object.freeze(cells);
  }
  Object.freeze(rotations);
}
Object.freeze(SHAPES);

const SPAWN_Y = Object.freeze({
  I: -1,
  O: 0,
  T: 0,
  S: 0,
  Z: 0,
  J: 0,
  L: 0,
});

export function isPieceType(type) {
  return PIECE_TYPES.includes(type);
}

export function normalizeRotation(rotation) {
  return ((Math.trunc(rotation) % 4) + 4) % 4;
}

/**
 * Returns the immutable local [x, y] cells for a type and rotation.
 */
export function getPieceCells(type, rotation = 0) {
  if (!isPieceType(type)) {
    throw new TypeError(`Unknown tetromino type: ${String(type)}`);
  }
  return SHAPES[type][normalizeRotation(rotation)];
}

export function createPiece(type, boardWidth = 10) {
  if (!isPieceType(type)) {
    throw new TypeError(`Unknown tetromino type: ${String(type)}`);
  }

  // Every definition uses a four-cell-wide coordinate box. Keeping one spawn
  // formula avoids subtle left/right differences between piece types.
  return {
    type,
    x: Math.floor((boardWidth - 4) / 2),
    y: SPAWN_Y[type],
    rotation: 0,
  };
}

export function clonePiece(piece) {
  if (!piece) return null;
  return {
    type: piece.type,
    x: piece.x,
    y: piece.y,
    rotation: normalizeRotation(piece.rotation),
  };
}

export function getAbsoluteCells(piece, overrides = {}) {
  const x = overrides.x ?? piece.x;
  const y = overrides.y ?? piece.y;
  const rotation = overrides.rotation ?? piece.rotation;

  return getPieceCells(piece.type, rotation).map(([cellX, cellY]) => ({
    x: x + cellX,
    y: y + cellY,
  }));
}

/**
 * Creates one uniformly shuffled 7-bag.
 */
export function createBag(random = Math.random) {
  const bag = [...PIECE_TYPES];

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const value = Number(random());
    const safeValue = Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 0.9999999999999999)
      : 0;
    const swapIndex = Math.floor(safeValue * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }

  return bag;
}

export default {
  PIECE_TYPES,
  isPieceType,
  normalizeRotation,
  getPieceCells,
  createPiece,
  clonePiece,
  getAbsoluteCells,
  createBag,
};
