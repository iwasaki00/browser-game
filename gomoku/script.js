const BOARD_SIZE = 15;
const EMPTY = "";
const BLACK = "black";
const WHITE = "white";
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const modeElement = document.getElementById("mode");
const resetButton = document.getElementById("resetButton");

let board = [];
let currentPlayer = BLACK;
let gameOver = false;

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function playerLabel(player) {
  return player === BLACK ? "黒" : "白";
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${row + 1}行 ${col + 1}列`);

      const stone = board[row][col];
      if (stone !== EMPTY) {
        const stoneElement = document.createElement("span");
        stoneElement.className = `stone ${stone === BLACK ? "stone-black" : "stone-white"}`;
        stoneElement.setAttribute("aria-hidden", "true");
        cell.appendChild(stoneElement);
        cell.disabled = true;
      }

      cell.addEventListener("click", () => handleMove(row, col));
      boardElement.appendChild(cell);
    }
  }
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function countDirection(row, col, rowStep, colStep, player) {
  let count = 0;
  let nextRow = row + rowStep;
  let nextCol = col + colStep;

  while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === player) {
    count += 1;
    nextRow += rowStep;
    nextCol += colStep;
  }

  return count;
}

function getWinningLine(row, col, player) {
  for (const [rowStep, colStep] of DIRECTIONS) {
    const backward = countDirection(row, col, -rowStep, -colStep, player);
    const forward = countDirection(row, col, rowStep, colStep, player);

    if (backward + forward + 1 >= 5) {
      const startOffset = Math.min(backward, 4);
      const positions = [];

      for (let offset = -startOffset; offset <= forward; offset += 1) {
        const currentRow = row + rowStep * offset;
        const currentCol = col + colStep * offset;

        if (isInsideBoard(currentRow, currentCol) && board[currentRow][currentCol] === player) {
          positions.push([currentRow, currentCol]);
        }
      }

      for (let i = 0; i <= positions.length - 5; i += 1) {
        const line = positions.slice(i, i + 5);
        if (line.length === 5) {
          return line;
        }
      }
    }
  }

  return null;
}

function highlightWinningCells(cells) {
  const buttonNodes = boardElement.querySelectorAll(".cell");
  for (const [row, col] of cells) {
    const index = row * BOARD_SIZE + col;
    buttonNodes[index].classList.add("winning");
  }
}

function isBoardFull() {
  return board.every((row) => row.every((cell) => cell !== EMPTY));
}

function switchPlayer() {
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
}

function evaluateMove(row, col, player) {
  board[row][col] = player;
  const winningLine = getWinningLine(row, col, player);
  board[row][col] = EMPTY;

  if (winningLine) {
    return 1_000_000;
  }

  let score = 0;

  for (const [rowStep, colStep] of DIRECTIONS) {
    const forward = countDirection(row, col, rowStep, colStep, player);
    const backward = countDirection(row, col, -rowStep, -colStep, player);
    const length = forward + backward + 1;
    score += length * length;
  }

  const centerDistance = Math.abs(row - 7) + Math.abs(col - 7);
  score += 20 - centerDistance;

  return score;
}

function getBestCpuMove() {
  let bestMove = null;
  let bestScore = -Infinity;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== EMPTY) {
        continue;
      }

      const attackScore = evaluateMove(row, col, WHITE);
      const defenseScore = evaluateMove(row, col, BLACK) * 0.92;
      const score = Math.max(attackScore, defenseScore);

      if (score > bestScore) {
        bestScore = score;
        bestMove = { row, col };
      }
    }
  }

  return bestMove;
}

function finishTurn(row, col) {
  const winningLine = getWinningLine(row, col, currentPlayer);
  if (winningLine) {
    gameOver = true;
    highlightWinningCells(winningLine);
    updateStatus(`${playerLabel(currentPlayer)}の勝ちです`);
    return;
  }

  if (isBoardFull()) {
    gameOver = true;
    updateStatus("引き分けです");
    return;
  }

  switchPlayer();
  updateStatus(`${playerLabel(currentPlayer)}の手番です`);
}

function handleMove(row, col) {
  if (gameOver || board[row][col] !== EMPTY) {
    return;
  }

  board[row][col] = currentPlayer;
  renderBoard();
  finishTurn(row, col);

  if (!gameOver && modeElement.value === "cpu" && currentPlayer === WHITE) {
    updateStatus("CPU が考えています...");
    window.setTimeout(() => {
      const move = getBestCpuMove();
      if (!move || gameOver) {
        return;
      }
      board[move.row][move.col] = currentPlayer;
      renderBoard();
      finishTurn(move.row, move.col);
    }, 220);
  }
}

function resetGame() {
  board = createEmptyBoard();
  currentPlayer = BLACK;
  gameOver = false;
  renderBoard();
  updateStatus("黒の手番です");
}

modeElement.addEventListener("change", resetGame);
resetButton.addEventListener("click", resetGame);

resetGame();
