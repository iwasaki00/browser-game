(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const BOARD_SIZE = 5;
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;

const INITIAL_CELLS = Array.from({ length: TOTAL_CELLS }, (_, index) => ({
  index,
  card: null,
}));

const ROW_LINES = Array.from({ length: BOARD_SIZE }, (_, row) =>
  Array.from({ length: BOARD_SIZE }, (_, column) => row * BOARD_SIZE + column),
);

const COLUMN_LINES = Array.from({ length: BOARD_SIZE }, (_, column) =>
  Array.from({ length: BOARD_SIZE }, (_, row) => row * BOARD_SIZE + column),
);

const DIAGONAL_LINES = [
  Array.from({ length: BOARD_SIZE }, (_, offset) => offset * (BOARD_SIZE + 1)),
  Array.from({ length: BOARD_SIZE }, (_, offset) => (offset + 1) * (BOARD_SIZE - 1)),
];

const ALL_LINES = [...ROW_LINES, ...COLUMN_LINES, ...DIAGONAL_LINES];

function createBoard() {
  return INITIAL_CELLS.map((cell) => ({ ...cell }));
}

function createBoardCopy(board) {
  return board.map((cell) => ({
    index: cell.index,
    card: cell.card ? { ...cell.card } : null,
  }));
}

function getInitialPlacementIndices() {
  return [6, 7, 8, 11, 12, 13, 16, 17, 18];
}

function placeCardsOnBoard(board, placements) {
  const nextBoard = createBoardCopy(board);
  placements.forEach(({ cellIndex, card, owner }) => {
    nextBoard[cellIndex] = {
      ...nextBoard[cellIndex],
      card: { ...card, owner },
    };
  });
  return nextBoard;
}

function getEmptyCellIndices(board) {
  return board.filter((cell) => !cell.card).map((cell) => cell.index);
}

function countOccupiedCells(board) {
  return board.filter((cell) => cell.card).length;
}

function getLinesForPositions(positions) {
  return ALL_LINES.filter((line) => positions.some((position) => line.includes(position)));
}

function isLineComplete(board, line) {
  return line.every((index) => Boolean(board[index].card));
}

function getCardsForLine(board, line) {
  return line.map((index) => board[index].card);
}

window.RuneGridDuel.board = {
  BOARD_SIZE,
  TOTAL_CELLS,
  ALL_LINES,
  createBoard,
  createBoardCopy,
  getInitialPlacementIndices,
  placeCardsOnBoard,
  getEmptyCellIndices,
  countOccupiedCells,
  getLinesForPositions,
  isLineComplete,
  getCardsForLine,
};
})();
