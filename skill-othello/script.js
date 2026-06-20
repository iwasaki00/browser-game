const SIZE = 8;
const BLACK = "black";
const WHITE = "white";
const NORMAL = "normal";
const GAME_ID = "skill-othello";
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const boardElement = document.getElementById("board");
const modeSelect = document.getElementById("modeSelect");
const restartButton = document.getElementById("restartButton");
const turnText = document.getElementById("turnText");
const blackCount = document.getElementById("blackCount");
const whiteCount = document.getElementById("whiteCount");
const messageText = document.getElementById("messageText");
const onlinePanel = document.getElementById("onlinePanel");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");
const roomIdInput = document.getElementById("roomIdInput");
const roomInfo = document.getElementById("roomInfo");
const skillButtons = Array.from(document.querySelectorAll(".skill-button"));
const skillCountElements = {
  bomb: document.getElementById("bombCount"),
  wall: document.getElementById("wallCount"),
  convert: document.getElementById("convertCount")
};

const clientId = crypto.randomUUID();

let board = createInitialBoard();
let currentPlayer = BLACK;
let selectedSkill = NORMAL;
let gameOver = false;
let message = "置ける場所を選んでください";
let skillCounts = createInitialSkillCounts();
let lastEffect = null;
let onlineRoomId = "";
let onlinePlayerColor = "";
let onlineRoomRef = null;
let onlineRoomCallback = null;
let onlinePlayerRef = null;
let firebaseTools = null;
let firebaseLoadPromise = null;

async function ensureFirebase() {
  if (firebaseTools) {
    return firebaseTools;
  }

  if (!firebaseLoadPromise) {
    firebaseLoadPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js"),
      import("../_cmn_firebase/firebase-config.js?v=iwa-games-20260620")
    ]).then(([appModule, databaseModule, configModule]) => {
      const app = appModule.initializeApp(configModule.firebaseConfig);
      firebaseTools = {
        ...databaseModule,
        db: databaseModule.getDatabase(app)
      };
      return firebaseTools;
    });
  }

  return firebaseLoadPromise;
}

function createCell(color = null, skill = null) {
  return { color, skill };
}

function cloneBoard(source) {
  return source.map((row) => row.map((cell) => createCell(cell.color, cell.skill)));
}

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => createCell()));
}

function createInitialBoard() {
  const nextBoard = createEmptyBoard();
  nextBoard[3][3] = createCell(WHITE, NORMAL);
  nextBoard[3][4] = createCell(BLACK, NORMAL);
  nextBoard[4][3] = createCell(BLACK, NORMAL);
  nextBoard[4][4] = createCell(WHITE, NORMAL);
  return nextBoard;
}

function createInitialSkillCounts() {
  return {
    [BLACK]: { bomb: 2, wall: 2, convert: 1 },
    [WHITE]: { bomb: 2, wall: 2, convert: 1 }
  };
}

function normalizeSkillCounts(value) {
  const fresh = createInitialSkillCounts();
  return {
    [BLACK]: { ...fresh[BLACK], ...(value?.[BLACK] || {}) },
    [WHITE]: { ...fresh[WHITE], ...(value?.[WHITE] || {}) }
  };
}

function opponentOf(color) {
  return color === BLACK ? WHITE : BLACK;
}

function playerLabel(color) {
  return color === BLACK ? "黒" : "白";
}

function isInside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function isOnlineMode() {
  return modeSelect.value === "online";
}

function isHumanTurn() {
  if (!isOnlineMode()) {
    return currentPlayer === BLACK;
  }

  return onlinePlayerColor && currentPlayer === onlinePlayerColor;
}

function ownSkillCounts() {
  const color = isOnlineMode() ? onlinePlayerColor || BLACK : BLACK;
  return skillCounts[color] || skillCounts[BLACK];
}

function roomRef(roomId) {
  return firebaseTools.ref(firebaseTools.db, `rooms/${GAME_ID}/${roomId}`);
}

function playerRef(roomId) {
  return firebaseTools.child(roomRef(roomId), `players/${clientId}`);
}

function playersRef(roomId) {
  return firebaseTools.child(roomRef(roomId), "players");
}

function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeRoomId(value) {
  return String(value).trim().replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

function getPlayers(roomData) {
  return roomData?.players || {};
}

function getPlayerList(roomData) {
  return Object.entries(getPlayers(roomData));
}

function getAvailableSlot(players) {
  const usedSlots = new Set(Object.values(players).map((player) => player.slot));
  return usedSlots.has(1) ? 2 : 1;
}

function colorForSlot(slot) {
  return slot === 1 ? BLACK : WHITE;
}

function getFlipsForMove(targetBoard, row, col, color) {
  if (!isInside(row, col) || targetBoard[row][col].color) {
    return [];
  }

  const opponent = opponentOf(color);
  const flips = [];

  for (const [rowStep, colStep] of DIRECTIONS) {
    const line = [];
    let nextRow = row + rowStep;
    let nextCol = col + colStep;

    while (isInside(nextRow, nextCol)) {
      const cell = targetBoard[nextRow][nextCol];
      if (!cell.color) {
        break;
      }

      if (cell.color === opponent) {
        line.push([nextRow, nextCol]);
        nextRow += rowStep;
        nextCol += colStep;
        continue;
      }

      if (cell.color === color && line.length > 0) {
        flips.push(...line);
      }
      break;
    }
  }

  return flips;
}

function getLegalMovesFor(targetBoard, color) {
  const moves = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const flips = getFlipsForMove(targetBoard, row, col, color);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
}

function countStones(targetBoard) {
  return targetBoard.flat().reduce((counts, cell) => {
    if (cell.color === BLACK) {
      counts.black += 1;
    }
    if (cell.color === WHITE) {
      counts.white += 1;
    }
    return counts;
  }, { black: 0, white: 0 });
}

function applyStandardFlips(targetBoard, flips, color) {
  for (const [row, col] of flips) {
    if (targetBoard[row][col].skill !== "wall") {
      targetBoard[row][col] = createCell(color, NORMAL);
    }
  }
}

function applyBombEffect(targetBoard, row, col, color) {
  const opponent = opponentOf(color);

  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) {
        continue;
      }

      const targetRow = row + rowDelta;
      const targetCol = col + colDelta;
      if (!isInside(targetRow, targetCol)) {
        continue;
      }

      const cell = targetBoard[targetRow][targetCol];
      if (cell.color === opponent && cell.skill !== "wall") {
        targetBoard[targetRow][targetCol] = createCell(color, NORMAL);
      }
    }
  }
}

function applyConvertEffect(targetBoard, row, col, color) {
  const opponent = opponentOf(color);

  for (const [rowStep, colStep] of DIRECTIONS) {
    let targetRow = row + rowStep;
    let targetCol = col + colStep;

    while (isInside(targetRow, targetCol)) {
      const cell = targetBoard[targetRow][targetCol];
      if (cell.color === opponent) {
        if (cell.skill !== "wall") {
          targetBoard[targetRow][targetCol] = createCell(color, NORMAL);
        }
        break;
      }

      targetRow += rowStep;
      targetCol += colStep;
    }
  }
}

function applySkillEffect(targetBoard, row, col, color, skill) {
  if (skill === "bomb") {
    applyBombEffect(targetBoard, row, col, color);
  }
  if (skill === "convert") {
    applyConvertEffect(targetBoard, row, col, color);
  }
}

function applyMoveToState(state, row, col, color, skill) {
  const flips = getFlipsForMove(state.board, row, col, color);
  if (flips.length === 0) {
    return null;
  }

  const nextBoard = cloneBoard(state.board);
  const nextSkillCounts = normalizeSkillCounts(state.skillCounts);
  nextBoard[row][col] = createCell(color, skill);
  applyStandardFlips(nextBoard, flips, color);
  applySkillEffect(nextBoard, row, col, color, skill);

  if (skill !== NORMAL) {
    nextSkillCounts[color][skill] -= 1;
  }

  const nextPlayer = opponentOf(color);
  const nextLegal = getLegalMovesFor(nextBoard, nextPlayer);
  const currentLegal = getLegalMovesFor(nextBoard, color);
  const counts = countStones(nextBoard);
  let nextMessage = `${playerLabel(nextPlayer)}の手番です`;
  let nextCurrentPlayer = nextPlayer;
  let nextGameOver = false;

  if (nextLegal.length === 0 && currentLegal.length === 0) {
    nextGameOver = true;
    if (counts.black === counts.white) {
      nextMessage = "引き分けです";
    } else {
      nextMessage = `${counts.black > counts.white ? "黒" : "白"}の勝ちです`;
    }
  } else if (nextLegal.length === 0) {
    nextCurrentPlayer = color;
    nextMessage = `${playerLabel(nextPlayer)}はパス。${playerLabel(color)}の手番です`;
  }

  return {
    board: nextBoard,
    currentPlayer: nextCurrentPlayer,
    skillCounts: nextSkillCounts,
    gameOver: nextGameOver,
    message: nextMessage,
    lastEffect: skill !== NORMAL ? { row, col, skill, at: Date.now() } : null
  };
}

function canUseSelectedSkill() {
  return selectedSkill === NORMAL || (ownSkillCounts()[selectedSkill] || 0) > 0;
}

function chooseSkill(skill) {
  selectedSkill = skill;
  updateSkillButtons();
}

function updateSkillButtons() {
  const counts = ownSkillCounts();

  if (selectedSkill !== NORMAL && (counts[selectedSkill] || 0) <= 0) {
    selectedSkill = NORMAL;
  }

  for (const button of skillButtons) {
    const skill = button.dataset.skill;
    button.classList.toggle("active", skill === selectedSkill);
    button.disabled = skill !== NORMAL && (!isHumanTurn() || (counts[skill] || 0) <= 0);
  }

  skillCountElements.bomb.textContent = counts.bomb ?? 0;
  skillCountElements.wall.textContent = counts.wall ?? 0;
  skillCountElements.convert.textContent = counts.convert ?? 0;
}

function renderBoard() {
  const legalMoves = isHumanTurn() && !gameOver ? getLegalMovesFor(board, currentPlayer) : [];
  const legalKeys = new Set(legalMoves.map((move) => `${move.row},${move.col}`));
  boardElement.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cellButton = document.createElement("button");
      const key = `${row},${col}`;
      cellButton.type = "button";
      cellButton.className = "cell";
      cellButton.setAttribute("role", "gridcell");
      cellButton.setAttribute("aria-label", `${row + 1}行${col + 1}列`);

      if (legalKeys.has(key)) {
        cellButton.classList.add("legal");
      }

      if (lastEffect?.row === row && lastEffect?.col === col) {
        cellButton.classList.add(lastEffect.skill === "bomb" ? "effect-bomb" : "effect-convert");
      }

      const cell = board[row][col];
      if (cell.color) {
        const stone = document.createElement("span");
        stone.className = `stone ${cell.color} ${cell.skill || NORMAL}`;
        stone.setAttribute("aria-hidden", "true");
        cellButton.appendChild(stone);
      }

      cellButton.disabled = !legalKeys.has(key);
      cellButton.addEventListener("click", () => handleCellClick(row, col));
      boardElement.appendChild(cellButton);
    }
  }
}

function renderStatus() {
  const counts = countStones(board);
  turnText.textContent = gameOver ? "終了" : `${playerLabel(currentPlayer)}の手番`;
  blackCount.textContent = counts.black;
  whiteCount.textContent = counts.white;
  messageText.textContent = message;
  updateSkillButtons();
}

function render() {
  renderBoard();
  renderStatus();
}

function setLocalState(nextState) {
  board = nextState.board;
  currentPlayer = nextState.currentPlayer;
  skillCounts = normalizeSkillCounts(nextState.skillCounts);
  gameOver = nextState.gameOver;
  message = nextState.message;
  lastEffect = nextState.lastEffect;
  render();
}

function resetLocalGame() {
  board = createInitialBoard();
  currentPlayer = BLACK;
  selectedSkill = NORMAL;
  gameOver = false;
  message = "置ける場所を選んでください";
  skillCounts = createInitialSkillCounts();
  lastEffect = null;
  render();
}

function evaluateCpuMove(move) {
  const corner = (move.row === 0 || move.row === SIZE - 1) && (move.col === 0 || move.col === SIZE - 1);
  const edge = move.row === 0 || move.row === SIZE - 1 || move.col === 0 || move.col === SIZE - 1;
  return move.flips.length * 10 + (corner ? 1000 : 0) + (edge ? 16 : 0);
}

function getBestCpuMove() {
  const moves = getLegalMovesFor(board, WHITE);
  return moves.sort((a, b) => evaluateCpuMove(b) - evaluateCpuMove(a))[0] || null;
}

function runCpuTurn() {
  if (gameOver || currentPlayer !== WHITE || isOnlineMode()) {
    return;
  }

  message = "CPUが考えています";
  renderStatus();

  window.setTimeout(() => {
    const move = getBestCpuMove();
    if (!move || gameOver || currentPlayer !== WHITE) {
      return;
    }

    const nextState = applyMoveToState({ board, currentPlayer, skillCounts }, move.row, move.col, WHITE, NORMAL);
    if (nextState) {
      setLocalState(nextState);
      if (!gameOver && currentPlayer === WHITE) {
        runCpuTurn();
      }
    }
  }, 360);
}

function handleLocalMove(row, col) {
  if (gameOver || currentPlayer !== BLACK || !canUseSelectedSkill()) {
    return;
  }

  const moveSkill = selectedSkill;
  const nextState = applyMoveToState({ board, currentPlayer, skillCounts }, row, col, BLACK, moveSkill);
  if (!nextState) {
    return;
  }

  if (moveSkill !== NORMAL) {
    selectedSkill = NORMAL;
  }
  setLocalState(nextState);
  runCpuTurn();
}

async function handleOnlineMove(row, col) {
  await ensureFirebase();

  if (!onlineRoomId || !onlinePlayerColor) {
    message = "オンライン部屋に参加してください";
    renderStatus();
    return;
  }

  if (currentPlayer !== onlinePlayerColor || !canUseSelectedSkill()) {
    return;
  }

  const moveSkill = selectedSkill;
  const result = await firebaseTools.runTransaction(roomRef(onlineRoomId), (roomData) => {
    if (!roomData || roomData.gameOver || roomData.currentPlayer !== onlinePlayerColor) {
      return roomData;
    }

    if (getPlayerList(roomData).length < 2) {
      return roomData;
    }

    const counts = normalizeSkillCounts(roomData.skillCounts);
    if (moveSkill !== NORMAL && (counts[onlinePlayerColor]?.[moveSkill] || 0) <= 0) {
      return roomData;
    }

    const nextState = applyMoveToState({
      board: roomData.board || createInitialBoard(),
      currentPlayer: roomData.currentPlayer || BLACK,
      skillCounts: counts
    }, row, col, onlinePlayerColor, moveSkill);

    if (!nextState) {
      return roomData;
    }

    return {
      ...roomData,
      board: nextState.board,
      currentPlayer: nextState.currentPlayer,
      skillCounts: nextState.skillCounts,
      gameOver: nextState.gameOver,
      message: nextState.message,
      lastEffect: nextState.lastEffect,
      lastMove: { row, col, color: onlinePlayerColor, skill: moveSkill, at: Date.now() },
      updatedAt: Date.now()
    };
  });

  if (result.committed && moveSkill !== NORMAL) {
    selectedSkill = NORMAL;
  }
}

function handleCellClick(row, col) {
  if (isOnlineMode()) {
    handleOnlineMove(row, col).catch(showOnlineError);
    return;
  }

  handleLocalMove(row, col);
}

function updateRoomInfo(text = "") {
  roomInfo.textContent = text;
}

function showOnlineError(error) {
  message = `オンライン接続エラー: ${error.message}`;
  renderStatus();
}

function updateOnlineStatus(roomData) {
  const players = getPlayerList(roomData);
  const ownPlayer = roomData?.players?.[clientId];
  updateRoomInfo(onlineRoomId
    ? `部屋ID: ${onlineRoomId} / ${players.length}人参加 / あなた: ${onlinePlayerColor ? playerLabel(onlinePlayerColor) : "-"}`
    : "");

  if (!ownPlayer) {
    message = "部屋から退出しました";
    return;
  }

  if (players.length < 2) {
    message = "相手の入室を待っています";
    return;
  }

  if (!roomData.gameOver) {
    message = roomData.currentPlayer === onlinePlayerColor ? "あなたの手番です" : "相手の手番です";
  }
}

async function subscribeOnlineRoom(roomId) {
  await ensureFirebase();

  if (onlineRoomRef && onlineRoomCallback) {
    firebaseTools.off(onlineRoomRef, "value", onlineRoomCallback);
  }

  onlineRoomId = roomId;
  onlineRoomRef = roomRef(roomId);
  onlinePlayerRef = playerRef(roomId);
  await firebaseTools.onDisconnect(onlinePlayerRef).remove();

  onlineRoomCallback = (snapshot) => {
    const roomData = snapshot.val();
    if (!roomData) {
      onlineRoomId = "";
      onlinePlayerColor = "";
      resetLocalGame();
      updateRoomInfo("");
      message = "部屋が見つかりません";
      renderStatus();
      return;
    }

    const ownPlayer = roomData.players?.[clientId];
    onlinePlayerColor = ownPlayer?.color || "";
    board = cloneBoard(roomData.board || createInitialBoard());
    currentPlayer = roomData.currentPlayer || BLACK;
    skillCounts = normalizeSkillCounts(roomData.skillCounts);
    gameOver = Boolean(roomData.gameOver);
    message = roomData.message || "オンライン対戦中です";
    lastEffect = roomData.lastEffect || null;
    updateOnlineStatus(roomData);
    render();
  };

  firebaseTools.onValue(onlineRoomRef, onlineRoomCallback, (error) => {
    message = `Firebaseエラー: ${error.message}`;
    renderStatus();
  });
}

async function createOnlineRoom() {
  await ensureFirebase();
  const roomId = generateRoomId();
  await leaveOnlineRoom();

  await firebaseTools.set(roomRef(roomId), {
    board: createInitialBoard(),
    currentPlayer: BLACK,
    skillCounts: createInitialSkillCounts(),
    gameOver: false,
    message: "相手の入室を待っています",
    lastEffect: null,
    players: {
      [clientId]: {
        slot: 1,
        color: BLACK,
        joinedAt: Date.now()
      }
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  roomIdInput.value = roomId;
  onlinePlayerColor = BLACK;
  await subscribeOnlineRoom(roomId);
}

async function joinOnlineRoom() {
  await ensureFirebase();
  const roomId = normalizeRoomId(roomIdInput.value);
  roomIdInput.value = roomId;

  if (!/^\d{6}$/.test(roomId)) {
    message = "6桁の部屋IDを入力してください";
    renderStatus();
    return;
  }

  const snapshot = await firebaseTools.get(roomRef(roomId));
  if (!snapshot.exists()) {
    message = "部屋が見つかりません";
    renderStatus();
    return;
  }

  const roomData = snapshot.val();
  const players = getPlayers(roomData);
  const alreadyJoined = Boolean(players[clientId]);

  if (!alreadyJoined && Object.keys(players).length >= 2) {
    message = "部屋が満員です";
    renderStatus();
    return;
  }

  await leaveOnlineRoom();

  const slot = alreadyJoined ? players[clientId].slot : getAvailableSlot(players);
  const color = colorForSlot(slot);
  await firebaseTools.update(playerRef(roomId), {
    slot,
    color,
    joinedAt: Date.now()
  });

  onlinePlayerColor = color;
  await subscribeOnlineRoom(roomId);
}

async function leaveOnlineRoom() {
  const leavingRoomId = onlineRoomId;

  if (onlineRoomRef && onlineRoomCallback) {
    firebaseTools.off(onlineRoomRef, "value", onlineRoomCallback);
  }

  if (onlinePlayerRef) {
    await firebaseTools.onDisconnect(onlinePlayerRef).cancel();
  }

  if (leavingRoomId) {
    await leaveRoomData(leavingRoomId);
  }

  onlineRoomId = "";
  onlinePlayerColor = "";
  onlineRoomRef = null;
  onlineRoomCallback = null;
  onlinePlayerRef = null;
  updateRoomInfo("");
}

async function leaveRoomData(roomIdValue) {
  await ensureFirebase();
  const roomId = normalizeRoomId(roomIdValue);
  await firebaseTools.remove(playerRef(roomId));

  const playersSnapshot = await firebaseTools.get(playersRef(roomId));
  const players = playersSnapshot.val() || {};

  if (Object.keys(players).length === 0) {
    await firebaseTools.remove(roomRef(roomId));
    return;
  }

  await firebaseTools.update(roomRef(roomId), {
    message: "相手が退出しました",
    updatedAt: Date.now()
  });
}

async function resetOnlineRoom() {
  await ensureFirebase();

  if (!onlineRoomId) {
    message = "オンライン部屋に参加してください";
    renderStatus();
    return;
  }

  await firebaseTools.update(roomRef(onlineRoomId), {
    board: createInitialBoard(),
    currentPlayer: BLACK,
    skillCounts: createInitialSkillCounts(),
    gameOver: false,
    message: "黒の手番です",
    lastEffect: null,
    lastMove: null,
    updatedAt: Date.now()
  });
}

function handlePageExit() {
  if (onlineRoomId) {
    leaveRoomData(onlineRoomId);
  }
}

modeSelect.addEventListener("change", async () => {
  const online = isOnlineMode();
  onlinePanel.hidden = !online;
  await leaveOnlineRoom();
  resetLocalGame();
  if (online) {
    message = "部屋を作るか、部屋IDで参加してください";
    renderStatus();
  }
});

restartButton.addEventListener("click", () => {
  if (isOnlineMode()) {
    resetOnlineRoom().catch(showOnlineError);
    return;
  }

  resetLocalGame();
});

createRoomButton.addEventListener("click", () => {
  createOnlineRoom().catch(showOnlineError);
});
joinRoomButton.addEventListener("click", () => {
  joinOnlineRoom().catch(showOnlineError);
});
leaveRoomButton.addEventListener("click", async () => {
  await leaveOnlineRoom().catch(showOnlineError);
  resetLocalGame();
  message = "部屋から退出しました";
  renderStatus();
});

for (const button of skillButtons) {
  button.addEventListener("click", () => chooseSkill(button.dataset.skill));
}

window.addEventListener("pagehide", handlePageExit);
window.addEventListener("beforeunload", handlePageExit);

onlinePanel.hidden = true;
render();
