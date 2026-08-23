/**
 * Tetromino definitions and small, side-effect-free piece helpers.
 *
 * A piece stores its type, board position, rotation and a four-entry sound
 * mask. The mask follows the cell index through rotations, so note markers
 * move together with the tetromino.
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

export function createSoundMask(random = Math.random) {
  const safeRandom = () => {
    const value = Number(random());
    return Number.isFinite(value)
      ? Math.min(0.9999999999999999, Math.max(0, value))
      : 0;
  };
  const soundCount = Math.floor(safeRandom() * 5);
  const indexes = [0, 1, 2, 3];

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(safeRandom() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  const enabled = new Set(indexes.slice(0, soundCount));
  return indexes.map((_, index) => enabled.has(index));
}

export function createPiece(type, boardWidth = 16, random = Math.random) {
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
    soundMask: createSoundMask(random),
  };
}

export function clonePiece(piece) {
  if (!piece) return null;
  return {
    type: piece.type,
    x: piece.x,
    y: piece.y,
    rotation: normalizeRotation(piece.rotation),
    soundMask: Array.from(
      { length: 4 },
      (_, index) => Boolean(piece.soundMask?.[index]),
    ),
  };
}

export function getAbsoluteCells(piece, overrides = {}) {
  const x = overrides.x ?? piece.x;
  const y = overrides.y ?? piece.y;
  const rotation = overrides.rotation ?? piece.rotation;

  return getPieceCells(piece.type, rotation).map(([cellX, cellY], index) => ({
    x: x + cellX,
    y: y + cellY,
    sound: Boolean(piece.soundMask?.[index]),
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
  createSoundMask,
  createPiece,
  clonePiece,
  getAbsoluteCells,
  createBag,
};
