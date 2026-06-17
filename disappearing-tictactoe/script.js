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
const modeName = document.getElementById("modeName");
const playTitle = document.getElementById("playTitle");
const maxMovesSelect = document.getElementById("maxMovesSelect");

const PLAYER = "player";
const CPU = "cpu";
const CPU_DELAY = 520;

const modeConfigs = {
  normal: {
    label: "Normal Mode",
    title: "消える三目並べ",
    boardSize: 3,
    maxMoves: 3,
    winLength: 3,
    playable: true,
    type: "disappear"
  },
  replace: {
    label: "Replace Mode",
    title: "置き直し三目並べ",
    boardSize: 3,
    maxMoves: 3,
    winLength: 3,
    playable: true,
    type: "replace"
  },
  four: {
    label: "4×4 Mode",
    title: "消える三目並べ 4×4",
    boardSize: 4,
    maxMoves: 4,
    winLength: 4,
    playable: true,
    type: "disappear"
  },
  move: {
    label: "Move Mode",
    title: "移動あり",
    boardSize: 3,
    maxMoves: 3,
    winLength: 3,
    playable: false,
    type: "future"
  },
  king: {
    label: "King Mode",
    title: "王様駒",
    boardSize: 3,
    maxMoves: 3,
    winLength: 3,
    playable: false,
    type: "future"
  },
  bomb: {
    label: "Bomb Mode",
    title: "爆弾マス",
    boardSize: 3,
    maxMoves: 3,
    winLength: 3,
    playable: false,
    type: "future"
  }
};

const modeTexts = {
  normal: "3×3盤面で、3つ揃えると勝利です。各プレイヤーの駒は最大3つで、4手目を置くと自分の一番古い駒が消えます。",
  replace: "各プレイヤーの駒は3つまで。4手目以降は、自分の駒を1つ選んで空きマスへ移動します。消えるのではなく、自分で置き直す三目並べです。",
  four: "4×4盤面で、横・縦・斜めのいずれかに4つ揃えると勝利です。",
  move: "新しく駒を置く代わりに、自分の駒を別の空きマスへ移動できます。",
  king: "各プレイヤーに1つだけ消えない王様駒があります。王様駒を含めて3つ揃えると勝利です。",
  bomb: "数ターンごとに爆弾マスが出現します。爆弾マス上の駒は一定ターン後に消えます。"
};

let boardSize = modeConfigs.normal.boardSize;
let maxMoves = modeConfigs.normal.maxMoves;
let winLength = modeConfigs.normal.winLength;
let board = Array(boardSize * boardSize).fill(null);
let currentTurn = PLAYER;
let playerMoves = [];
let cpuMoves = [];
let gameOver = false;
let selectedMode = "normal";
let modeType = modeConfigs.normal.type;
let cpuThinking = false;
let fadingMarks = {};
let selectedPieceIndex = null;
let maxMovesByMode = Object.fromEntries(
  Object.entries(modeConfigs).map(([mode, config]) => [mode, config.maxMoves])
);

function initGame() {
  const config = getModeConfig();
  boardSize = config.boardSize;
  maxMoves = getSelectedMaxMoves();
  winLength = config.winLength;
  modeType = config.type;
  board = Array(boardSize * boardSize).fill(null);
  currentTurn = PLAYER;
  playerMoves = [];
  cpuMoves = [];
  gameOver = false;
  cpuThinking = false;
  fadingMarks = {};
  selectedPieceIndex = null;
  winLine.className = "win-line hidden";
  resetWinLine();
  boardElement.style.setProperty("--board-size", boardSize);
  boardElement.setAttribute("aria-label", `${boardSize}×${boardSize}盤面`);
  boardElement.classList.toggle("board-four", boardSize === 4);
  modeName.textContent = config.label;
  playTitle.textContent = config.title;
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
    const cellDisabled = isCellDisabled(index);
    button.disabled = false;
    button.setAttribute("aria-disabled", String(cellDisabled));
    if (cellDisabled) {
      button.classList.add("unavailable");
    }

    if (winningCells.includes(index)) {
      button.classList.add("winner");
    }

    if (modeType === "replace" && currentTurn === PLAYER && !gameOver && !cpuThinking) {
      const playerCanMove = playerMoves.length >= maxMoves;
      if (playerCanMove && cell === PLAYER) {
        button.classList.add("selectable");
      }
      if (selectedPieceIndex === index) {
        button.classList.add("selected");
      }
      if (playerCanMove && selectedPieceIndex !== null && cell === null) {
        button.classList.add("move-target");
      }
    }

    const fadingMark = fadingMarks[index];

    if (cell || fadingMark) {
      const owner = cell || fadingMark;
      const moves = owner === PLAYER ? playerMoves : cpuMoves;
      const ageIndex = cell ? moves.indexOf(index) : 0;
      const opacity = modeType === "replace" && cell ? "1" : cell ? getOpacityForAge(ageIndex, moves.length) : "0.25";
      const mark = document.createElement("span");
      mark.className = `mark ${owner}`;
      mark.textContent = owner === PLAYER ? "○" : "×";
      mark.style.setProperty("--mark-opacity", opacity);
      mark.style.opacity = opacity;

      if (fadingMark) {
        button.classList.add("removing");
      }

      if (modeType !== "replace" && cell && ageIndex === 0 && moves.length === maxMoves) {
        mark.classList.add("oldest");
      }

      button.appendChild(mark);

      if (modeType !== "replace" && cell) {
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
  if (gameOver || cpuThinking || currentTurn !== PLAYER) {
    return;
  }

  if (modeType === "replace") {
    handleReplacePlayerTap(index);
    return;
  }

  if (board[index]) {
    return;
  }

  placeMark(PLAYER, index);
  completePlayerTurn();
}

function handleReplacePlayerTap(index) {
  const moves = getMoves(PLAYER);

  if (moves.length < maxMoves) {
    if (board[index]) {
      return;
    }
    placeMark(PLAYER, index);
    completePlayerTurn();
    return;
  }

  if (selectedPieceIndex === null) {
    if (board[index] === PLAYER) {
      selectedPieceIndex = index;
      updateStatus();
      renderBoard();
    }
    return;
  }

  if (index === selectedPieceIndex) {
    selectedPieceIndex = null;
    updateStatus();
    renderBoard();
    return;
  }

  if (board[index] !== null) {
    return;
  }

  moveMark(PLAYER, selectedPieceIndex, index);
  selectedPieceIndex = null;
  completePlayerTurn();
}

function completePlayerTurn() {
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

    const cpuAction = getCpuAction();
    applyCpuAction(cpuAction);
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

  if (moves.length > maxMoves) {
    removeOldestMove(player);
  }

  renderBoard();
  return true;
}

function moveMark(player, fromIndex, toIndex) {
  if (board[fromIndex] !== player || board[toIndex] !== null) {
    return false;
  }

  board[fromIndex] = null;
  board[toIndex] = player;
  const moves = getMoves(player);
  const moveIndex = moves.indexOf(fromIndex);
  if (moveIndex !== -1) {
    moves[moveIndex] = toIndex;
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
  const pattern = getWinPatterns().find(({ cells }) => cells.every((index) => customBoard[index] === player));
  return pattern ? { won: true, cells: pattern.cells, line: pattern.line } : { won: false, cells: [], line: "" };
}

function getCpuAction() {
  if (modeType === "replace") {
    return getCpuReplaceAction();
  }
  return { type: "place", to: getCpuMove() };
}

function applyCpuAction(action) {
  if (!action) {
    return;
  }

  if (action.type === "move") {
    moveMark(CPU, action.from, action.to);
  } else {
    placeMark(CPU, action.to);
  }
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

  const centerMove = getCenterCandidates().find((index) => board[index] === null);
  if (centerMove !== undefined) {
    return centerMove;
  }

  const corner = getCornerCandidates().find((index) => board[index] === null);
  if (corner !== undefined) {
    return corner;
  }

  return emptyCells[0];
}

function getCpuReplaceAction() {
  const actions = getLegalActions(CPU);

  const winningAction = findWinningAction(CPU, actions);
  if (winningAction) {
    return winningAction;
  }

  const blockingAction = findBlockingAction(actions);
  if (blockingAction) {
    return blockingAction;
  }

  const centerAction = actions.find((action) => getCenterCandidates().includes(action.to));
  if (centerAction) {
    return centerAction;
  }

  const cornerAction = actions.find((action) => getCornerCandidates().includes(action.to));
  if (cornerAction) {
    return cornerAction;
  }

  return actions[0];
}

function getLegalActions(player, sourceBoard = board, sourceMoves = getMoves(player)) {
  const emptyCells = getEmptyCells(sourceBoard);

  if (sourceMoves.length < maxMoves) {
    return emptyCells.map((to) => ({ type: "place", to }));
  }

  const actions = [];
  sourceMoves.forEach((from) => {
    emptyCells.forEach((to) => {
      actions.push({ type: "move", from, to });
    });
  });
  return actions;
}

function findWinningAction(player, actions) {
  return actions.find((action) => {
    const simulated = simulateAction(player, action);
    return checkWinner(player, simulated.board).won;
  }) || null;
}

function findBlockingAction(actions) {
  const currentPlayerActions = getLegalActions(PLAYER);
  if (!findWinningActionOnBoard(PLAYER, currentPlayerActions, board, playerMoves)) {
    return null;
  }

  return actions.find((action) => {
    const simulated = simulateAction(CPU, action);
    const playerActions = getLegalActions(PLAYER, simulated.board, simulated.playerMoves);
    return !findWinningActionOnBoard(PLAYER, playerActions, simulated.board, simulated.playerMoves);
  }) || null;
}

function findWinningActionOnBoard(player, actions, sourceBoard, sourceMoves) {
  return actions.find((action) => {
    const simulated = simulateAction(player, action, sourceBoard, sourceMoves);
    return checkWinner(player, simulated.board).won;
  }) || null;
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

  if (simulatedMoves.length > maxMoves) {
    const removed = simulatedMoves.shift();
    simulatedBoard[removed] = null;
  }

  return simulatedBoard;
}

function simulateAction(player, action, sourceBoard = board, sourceMoves = getMoves(player)) {
  const simulatedBoard = [...sourceBoard];
  const simulatedPlayerMoves = player === PLAYER ? [...sourceMoves] : [...playerMoves];
  const simulatedCpuMoves = player === CPU ? [...sourceMoves] : [...cpuMoves];
  const simulatedMoves = player === PLAYER ? simulatedPlayerMoves : simulatedCpuMoves;

  if (action.type === "move") {
    simulatedBoard[action.from] = null;
    simulatedBoard[action.to] = player;
    const moveIndex = simulatedMoves.indexOf(action.from);
    if (moveIndex !== -1) {
      simulatedMoves[moveIndex] = action.to;
    }
  } else {
    simulatedBoard[action.to] = player;
    simulatedMoves.push(action.to);
  }

  return {
    board: simulatedBoard,
    playerMoves: simulatedPlayerMoves,
    cpuMoves: simulatedCpuMoves
  };
}

function updateStatus(message) {
  if (message) {
    statusText.textContent = message;
  } else if (gameOver) {
    statusText.textContent = "";
  } else if (currentTurn === PLAYER) {
    if (modeType === "replace" && playerMoves.length >= maxMoves) {
      statusText.textContent = selectedPieceIndex === null
        ? "動かす駒を選んでください。"
        : "移動先を選んでください。";
    } else {
      statusText.textContent = "空いているマスをタップしてください。";
    }
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
  if (!modeConfigs[mode]) {
    return;
  }

  const modeChanged = selectedMode !== mode;
  selectedMode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  const config = getModeConfig();
  modeDescription.textContent = modeTexts[mode];
  modeNotice.textContent = config.playable ? "" : "このモードは今後追加予定です";
  startButton.disabled = !config.playable;
  maxMovesSelect.disabled = !config.playable || config.type === "replace";
  renderMaxMovesOptions();
  updateModeDescription();

  if (modeChanged) {
    initGame();
  }
}

function finishGame(winner, result) {
  gameOver = true;
  cpuThinking = false;
  currentTurn = winner;
  statusText.textContent = winner === PLAYER ? "あなたの勝ちです。" : "CPUの勝ちです。";
  turnText.textContent = "決着";
  renderBoard(result.cells);
  showWinLine(result.line);
}

function getMoves(player) {
  return player === PLAYER ? playerMoves : cpuMoves;
}

function getEmptyCells(sourceBoard = board) {
  return sourceBoard
    .map((cell, index) => cell === null ? index : null)
    .filter((index) => index !== null);
}

function getOpacityForAge(ageIndex, length) {
  if (length <= 1 || ageIndex === length - 1) {
    return "1";
  }
  if (ageIndex === 0) {
    return "0.35";
  }
  const ratio = ageIndex / Math.max(length - 1, 1);
  return String(0.45 + ratio * 0.45);
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
    if (modeType !== "replace" && orderIndex === 0 && moves.length === maxMoves) {
      item.classList.add("oldest");
    }
    if (modeType === "replace" && selectedPieceIndex === index) {
      item.classList.add("oldest");
    }
    listElement.appendChild(item);
  });
}

function getCellLabel(index, cell) {
  const row = Math.floor(index / boardSize) + 1;
  const col = (index % boardSize) + 1;
  if (!cell) {
    return `${row}行${col}列 空きマス`;
  }
  return `${row}行${col}列 ${cell === PLAYER ? "あなたの丸" : "CPUのバツ"}`;
}

function getModeConfig() {
  return modeConfigs[selectedMode] || modeConfigs.normal;
}

function getSelectedMaxMoves() {
  const config = getModeConfig();
  const selected = maxMovesByMode[selectedMode] || config.maxMoves;
  return clamp(selected, config.winLength, getMaxMoveLimit(config));
}

function getMaxMoveLimit(config = getModeConfig()) {
  return Math.floor((config.boardSize * config.boardSize) / 2);
}

function renderMaxMovesOptions() {
  const config = getModeConfig();
  const current = getSelectedMaxMoves();
  maxMovesByMode[selectedMode] = current;
  maxMovesSelect.innerHTML = "";

  for (let count = config.winLength; count <= getMaxMoveLimit(config); count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `各${count}個`;
    option.selected = count === current;
    maxMovesSelect.appendChild(option);
  }

  maxMovesSelect.value = String(current);
}

function updateModeDescription() {
  if (getModeConfig().type === "replace") {
    modeDescription.textContent = modeTexts[selectedMode];
    return;
  }

  const selectedMaxMoves = getSelectedMaxMoves();
  const nextRemovalTurn = selectedMaxMoves + 1;
  modeDescription.textContent = `${modeTexts[selectedMode]} 現在の設定では各プレイヤーが${selectedMaxMoves}個まで保持でき、${nextRemovalTurn}手目を置くと自分の1手目が消えます。`;
}

function isCellDisabled(index) {
  if (gameOver || cpuThinking) {
    return true;
  }

  if (modeType !== "replace" || currentTurn !== PLAYER) {
    return Boolean(board[index]);
  }

  if (playerMoves.length < maxMoves) {
    return Boolean(board[index]);
  }

  if (selectedPieceIndex === null) {
    return board[index] !== PLAYER;
  }

  return board[index] !== null && index !== selectedPieceIndex;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getWinPatterns() {
  const patterns = [];

  for (let row = 0; row < boardSize; row += 1) {
    patterns.push({
      cells: Array.from({ length: winLength }, (_, col) => row * boardSize + col),
      line: `row-${row}`
    });
  }

  for (let col = 0; col < boardSize; col += 1) {
    patterns.push({
      cells: Array.from({ length: winLength }, (_, row) => row * boardSize + col),
      line: `col-${col}`
    });
  }

  patterns.push({
    cells: Array.from({ length: winLength }, (_, offset) => offset * boardSize + offset),
    line: "diag-0"
  });
  patterns.push({
    cells: Array.from({ length: winLength }, (_, offset) => offset * boardSize + (boardSize - 1 - offset)),
    line: "diag-1"
  });

  return patterns;
}

function getCenterCandidates() {
  if (boardSize % 2 === 1) {
    const center = Math.floor(boardSize / 2);
    return [center * boardSize + center];
  }

  const upper = boardSize / 2 - 1;
  const lower = boardSize / 2;
  return [
    upper * boardSize + upper,
    upper * boardSize + lower,
    lower * boardSize + upper,
    lower * boardSize + lower
  ];
}

function getCornerCandidates() {
  return [
    0,
    boardSize - 1,
    boardSize * (boardSize - 1),
    boardSize * boardSize - 1
  ];
}

function resetWinLine() {
  winLine.removeAttribute("style");
}

function showWinLine(line) {
  resetWinLine();
  const [type, rawIndex] = line.split("-");
  const index = Number(rawIndex);
  const cellPercent = 100 / boardSize;
  const centerPercent = cellPercent * index + cellPercent / 2;

  winLine.className = "win-line";

  if (type === "row") {
    winLine.style.left = "4%";
    winLine.style.top = `${centerPercent}%`;
    winLine.style.width = "92%";
    winLine.style.transform = "translateY(-50%)";
  } else if (type === "col") {
    winLine.style.left = `${centerPercent}%`;
    winLine.style.top = "4%";
    winLine.style.width = "7px";
    winLine.style.height = "92%";
    winLine.style.transform = "translateX(-50%)";
  } else {
    winLine.style.left = "-12%";
    winLine.style.top = "50%";
    winLine.style.width = "124%";
    winLine.style.transform = `translateY(-50%) rotate(${line === "diag-0" ? 45 : -45}deg)`;
  }
}

function handleModeSelectEvent(event) {
  const button = event.target.closest(".mode-button");
  if (button) {
    if (event.type === "touchend") {
      event.preventDefault();
    }
    selectMode(button.dataset.mode);
  }
}

modeGrid.addEventListener("click", handleModeSelectEvent);
modeGrid.addEventListener("touchend", handleModeSelectEvent, { passive: false });

maxMovesSelect.addEventListener("change", () => {
  maxMovesByMode[selectedMode] = Number(maxMovesSelect.value);
  updateModeDescription();
  initGame();
});

startButton.addEventListener("click", () => {
  if (!getModeConfig().playable) {
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
