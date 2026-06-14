const boardElement = document.getElementById("board");
const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const backButton = document.getElementById("backButton");
const statusText = document.getElementById("statusText");
const turnText = document.getElementById("turnText");
const playerOrder = document.getElementById("playerOrder");
const cpuOrder = document.getElementById("cpuOrder");
const modeGrid = document.getElementById("modeGrid");
const modeDescription = document.getElementById("modeDescription");
const modeNotice = document.getElementById("modeNotice");
const winLine = document.getElementById("winLine");

const PLAYER = "player";
const CPU = "cpu";
const MAX_MOVES = 3;
const CPU_DELAY = 520;

const modeTexts = {
  normal: "3×3盤面で、保持できる駒は3個。3つ揃えると勝利です。",
  four: "4×4盤面で、4つ揃えると勝利。保持できる駒は4個です。",
  move: "新しく駒を置く代わりに、自分の駒を別の空きマスへ移動できます。",
  king: "各プレイヤーに1つだけ消えない王様駒があります。王様駒を含めて3つ揃えると勝利です。",
  bomb: "数ターンごとに爆弾マスが出現します。爆弾マス上の駒は一定ターン後に消えます。"
};

const winPatterns = [
  { cells: [0, 1, 2], line: "row-0" },
  { cells: [3, 4, 5], line: "row-1" },
  { cells: [6, 7, 8], line: "row-2" },
  { cells: [0, 3, 6], line: "col-0" },
  { cells: [1, 4, 7], line: "col-1" },
  { cells: [2, 5, 8], line: "col-2" },
  { cells: [0, 4, 8], line: "diag-0" },
  { cells: [2, 4, 6], line: "diag-1" }
];

let board = Array(9).fill(null);
let currentTurn = PLAYER;
let playerMoves = [];
let cpuMoves = [];
let gameOver = false;
let selectedMode = "normal";
let cpuThinking = false;
let fadingMarks = {};

function initGame() {
  board = Array(9).fill(null);
  currentTurn = PLAYER;
  playerMoves = [];
  cpuMoves = [];
  gameOver = false;
  cpuThinking = false;
  fadingMarks = {};
  winLine.className = "win-line hidden";
  renderBoard();
  updateStatus();
}

function renderBoard(winningCells = []) {
  boardElement.innerHTML = "";

  board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", getCellLabel(index, cell));
    button.disabled = gameOver || cpuThinking || Boolean(cell);

    if (winningCells.includes(index)) {
      button.classList.add("winner");
    }

    const fadingMark = fadingMarks[index];

    if (cell || fadingMark) {
      const owner = cell || fadingMark;
      const moves = cell === PLAYER ? playerMoves : cpuMoves;
      const ageIndex = cell ? moves.indexOf(index) : 0;
      const opacity = cell ? getOpacityForAge(ageIndex, moves.length) : "0.25";
      const mark = document.createElement("span");
      mark.className = `mark ${owner}`;
      mark.textContent = owner === PLAYER ? "○" : "×";
      mark.style.setProperty("--mark-opacity", opacity);
      mark.style.opacity = opacity;

      if (fadingMark) {
        button.classList.add("removing");
      }

      if (cell && ageIndex === 0 && moves.length === MAX_MOVES) {
        mark.classList.add("oldest");
      }

      button.appendChild(mark);

      if (cell) {
        const badge = document.createElement("span");
        badge.className = "order-badge";
        badge.textContent = String(ageIndex + 1);
        button.appendChild(badge);
      }
    }

    button.addEventListener("click", () => handleCellTap(index));
    boardElement.appendChild(button);
  });

  renderMoveOrder();
}

function handleCellTap(index) {
  if (gameOver || cpuThinking || currentTurn !== PLAYER || board[index]) {
    return;
  }

  placeMark(PLAYER, index);
  const result = checkWinner(PLAYER);
  if (result.won) {
    finishGame(PLAYER, result);
    return;
  }

  currentTurn = CPU;
  cpuThinking = true;
  updateStatus("CPUが考えています...");
  renderBoard();

  window.setTimeout(() => {
    if (gameOver) {
      return;
    }

    const cpuIndex = getCpuMove();
    placeMark(CPU, cpuIndex);
    const cpuResult = checkWinner(CPU);
    if (cpuResult.won) {
      finishGame(CPU, cpuResult);
      return;
    }

    currentTurn = PLAYER;
    cpuThinking = false;
    updateStatus();
    renderBoard();
  }, CPU_DELAY);
}

function placeMark(player, index) {
  if (board[index]) {
    return false;
  }

  board[index] = player;
  const moves = getMoves(player);
  moves.push(index);

  if (moves.length > MAX_MOVES) {
    removeOldestMove(player);
  }

  renderBoard();
  return true;
}

function removeOldestMove(player) {
  const moves = getMoves(player);
  const removedIndex = moves.shift();
  if (typeof removedIndex === "number") {
    board[removedIndex] = null;
    fadingMarks[removedIndex] = player;
    window.setTimeout(() => {
      delete fadingMarks[removedIndex];
      renderBoard();
    }, 170);
  }
}

function checkWinner(player, customBoard = board) {
  const pattern = winPatterns.find(({ cells }) => cells.every((index) => customBoard[index] === player));
  return pattern ? { won: true, cells: pattern.cells, line: pattern.line } : { won: false, cells: [], line: "" };
}

function getCpuMove() {
  const emptyCells = getEmptyCells();

  const winningMove = findStrategicMove(CPU, emptyCells);
  if (winningMove !== null) {
    return winningMove;
  }

  const blockingMove = findStrategicMove(PLAYER, emptyCells);
  if (blockingMove !== null) {
    return blockingMove;
  }

  if (board[4] === null) {
    return 4;
  }

  const corner = [0, 2, 6, 8].find((index) => board[index] === null);
  if (corner !== undefined) {
    return corner;
  }

  return emptyCells[0];
}

function findStrategicMove(player, emptyCells) {
  for (const index of emptyCells) {
    const simulated = simulateMove(player, index);
    if (checkWinner(player, simulated).won) {
      return index;
    }
  }
  return null;
}

function simulateMove(player, index) {
  const simulatedBoard = [...board];
  const simulatedMoves = [...getMoves(player)];
  simulatedBoard[index] = player;
  simulatedMoves.push(index);

  if (simulatedMoves.length > MAX_MOVES) {
    const removed = simulatedMoves.shift();
    simulatedBoard[removed] = null;
  }

  return simulatedBoard;
}

function updateStatus(message) {
  if (message) {
    statusText.textContent = message;
  } else if (gameOver) {
    statusText.textContent = "";
  } else if (currentTurn === PLAYER) {
    statusText.textContent = "空いているマスをタップしてください。";
  } else {
    statusText.textContent = "CPUの番です。";
  }

  turnText.textContent = gameOver
    ? "終了"
    : currentTurn === PLAYER
      ? "あなたの番"
      : "CPUの番";
}

function resetGame() {
  initGame();
}

function selectMode(mode) {
  selectedMode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  modeDescription.textContent = modeTexts[mode];
  const isNormal = mode === "normal";
  modeNotice.textContent = isNormal ? "" : "このモードは今後追加予定です";
  startButton.disabled = !isNormal;
}

function finishGame(winner, result) {
  gameOver = true;
  cpuThinking = false;
  currentTurn = winner;
  statusText.textContent = winner === PLAYER ? "あなたの勝ちです。" : "CPUの勝ちです。";
  turnText.textContent = "決着";
  renderBoard(result.cells);
  winLine.className = `win-line ${result.line}`;
}

function getMoves(player) {
  return player === PLAYER ? playerMoves : cpuMoves;
}

function getEmptyCells() {
  return board
    .map((cell, index) => cell === null ? index : null)
    .filter((index) => index !== null);
}

function getOpacityForAge(ageIndex, length) {
  if (length <= 1 || ageIndex === length - 1) {
    return "1";
  }
  if (ageIndex === 0) {
    return "0.4";
  }
  return "0.7";
}

function renderMoveOrder() {
  renderOrderList(playerOrder, playerMoves);
  renderOrderList(cpuOrder, cpuMoves);
}

function renderOrderList(listElement, moves) {
  listElement.innerHTML = "";
  moves.forEach((index, orderIndex) => {
    const item = document.createElement("li");
    item.textContent = String(index + 1);
    if (orderIndex === 0 && moves.length === MAX_MOVES) {
      item.classList.add("oldest");
    }
    listElement.appendChild(item);
  });
}

function getCellLabel(index, cell) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  if (!cell) {
    return `${row}行${col}列 空きマス`;
  }
  return `${row}行${col}列 ${cell === PLAYER ? "あなたの丸" : "CPUのバツ"}`;
}

modeGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".mode-button");
  if (button) {
    selectMode(button.dataset.mode);
  }
});

startButton.addEventListener("click", () => {
  if (selectedMode !== "normal") {
    return;
  }
  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  initGame();
});

restartButton.addEventListener("click", resetGame);

backButton.addEventListener("click", () => {
  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  initGame();
});

selectMode("normal");
