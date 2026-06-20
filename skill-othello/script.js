const SIZE = 8;
const BLACK = "black";
const WHITE = "white";
const NORMAL = "normal";
const GAME_ID = "skill-othello";
const PLAYER_STALE_MS = 45_000;
const HEARTBEAT_MS = 15_000;
const SKILLS = {
  normal: { label: "通常石", initial: Infinity },
  bomb: { label: "爆弾石", initial: 2 },
  wall: { label: "壁石", initial: 2 },
  convert: { label: "変換石", initial: 1 },
  timer: { label: "時限石", initial: 2, remainingTurns: 3 },
  heavy: { label: "重石", initial: 2, durability: 2 },
  trap: { label: "トラップ石", initial: 2 }
};
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const boardElement = document.getElementById("board");
const modeSelect = document.getElementById("modeSelect");
const restartButton = document.getElementById("restartButton");
const messageText = document.getElementById("messageText");
const onlinePanel = document.getElementById("onlinePanel");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");
const roomIdInput = document.getElementById("roomIdInput");
const roomInfo = document.getElementById("roomInfo");
const onlineConnectionText = document.getElementById("onlineConnectionText");
const onlinePlayersText = document.getElementById("onlinePlayersText");
const onlineColorText = document.getElementById("onlineColorText");
const onlineTurnText = document.getElementById("onlineTurnText");
const onlineHint = document.getElementById("onlineHint");
const chatMessagesElement = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatButton = document.getElementById("sendChatButton");
const skillHelpButton = document.getElementById("skillHelpButton");
const skillModal = document.getElementById("skillModal");
const closeSkillModalButton = document.getElementById("closeSkillModalButton");
const summaryPanel = document.getElementById("summaryPanel");
const summaryContent = document.getElementById("summaryContent");
const skillButtons = Array.from(document.querySelectorAll(".skill-button"));
const skillCountElements = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-skill-count]")).map((element) => [element.dataset.skillCount, element])
);

const clientId = crypto.randomUUID();

let board = createInitialBoard();
let currentPlayer = BLACK;
let selectedSkill = NORMAL;
let gameOver = false;
let message = "置ける場所を選んでください";
let skillCounts = createInitialSkillCounts();
let matchStats = createInitialMatchStats();
let lastEffect = null;
let onlineRoomId = "";
let onlinePlayerColor = "";
let onlineRoomRef = null;
let onlineRoomCallback = null;
let onlinePlayerRef = null;
let chatUnsubscribe = null;
let heartbeatTimer = null;
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

function createCell(color = null, skill = null, state = {}) {
  return {
    color,
    skill,
    remainingTurns: state.remainingTurns ?? null,
    durability: state.durability ?? null,
    owner: state.owner ?? null
  };
}

function cloneBoard(source) {
  return normalizeBoard(source);
}

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => createCell()));
}

function normalizeBoard(source) {
  const normalized = createEmptyBoard();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = source?.[row]?.[col];
      const color = cell?.color === BLACK || cell?.color === WHITE ? cell.color : null;
      const skill = color && cell?.skill ? cell.skill : color ? NORMAL : null;
      normalized[row][col] = createCell(color, skill, {
        remainingTurns: skill === "timer" ? Math.max(1, Number(cell?.remainingTurns) || 3) : null,
        durability: skill === "heavy" ? Math.max(1, Number(cell?.durability) || 2) : null,
        owner: skill === "trap" ? cell?.owner || color : null
      });
    }
  }

  return normalized;
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
  const counts = Object.fromEntries(
    Object.entries(SKILLS)
      .filter(([skill]) => skill !== NORMAL)
      .map(([skill, definition]) => [skill, definition.initial])
  );
  return { [BLACK]: { ...counts }, [WHITE]: { ...counts } };
}

function createInitialMatchStats() {
  return {
    [BLACK]: { skillsUsed: 0, bombsTriggered: 0, trapsTriggered: 0 },
    [WHITE]: { skillsUsed: 0, bombsTriggered: 0, trapsTriggered: 0 }
  };
}

function normalizeSkillCounts(value) {
  const fresh = createInitialSkillCounts();
  return {
    [BLACK]: { ...fresh[BLACK], ...(value?.[BLACK] || {}) },
    [WHITE]: { ...fresh[WHITE], ...(value?.[WHITE] || {}) }
  };
}

function normalizeMatchStats(value) {
  const fresh = createInitialMatchStats();
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

function messagesRef(roomId) {
  return firebaseTools.child(roomRef(roomId), "messages");
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

function pruneStalePlayers(players, now = Date.now()) {
  return Object.fromEntries(Object.entries(players).filter(([id, player]) => {
    if (id === clientId) {
      return false;
    }

    const lastSeen = player.lastSeen || player.joinedAt || 0;
    return now - lastSeen <= PLAYER_STALE_MS;
  }));
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

function applyTrapEffect(targetBoard, row, col, owner) {
  const enemy = opponentOf(owner);

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
      if (cell.color === enemy && cell.skill !== "wall") {
        targetBoard[targetRow][targetCol] = createCell(owner, NORMAL);
      }
    }
  }
}

function applyStandardFlips(targetBoard, flips, color, stats) {
  const triggeredTraps = [];

  for (const [row, col] of flips) {
    const cell = targetBoard[row][col];
    if (cell.skill === "wall") {
      continue;
    }

    if (cell.skill === "heavy") {
      if ((cell.durability || 2) > 1) {
        targetBoard[row][col] = createCell(cell.color, "heavy", {
          durability: (cell.durability || 2) - 1
        });
      } else {
        targetBoard[row][col] = createCell(color, "heavy", { durability: 2 });
      }
      continue;
    }

    if (cell.skill === "timer") {
      targetBoard[row][col] = createCell(color, "timer", {
        remainingTurns: cell.remainingTurns || 1
      });
      continue;
    }

    if (cell.skill === "trap") {
      triggeredTraps.push({ row, col, owner: cell.owner || cell.color });
    }

    targetBoard[row][col] = createCell(color, NORMAL);
  }

  for (const trap of triggeredTraps) {
    applyTrapEffect(targetBoard, trap.row, trap.col, trap.owner);
    stats[trap.owner].trapsTriggered += 1;
  }

  return triggeredTraps;
}

function captureCellBySkillEffect(targetBoard, row, col, color, stats) {
  const cell = targetBoard[row][col];
  if (cell.skill === "wall") {
    return null;
  }

  if (cell.skill === "heavy") {
    if ((cell.durability || 2) > 1) {
      targetBoard[row][col] = createCell(cell.color, "heavy", {
        durability: (cell.durability || 2) - 1
      });
    } else {
      targetBoard[row][col] = createCell(color, "heavy", { durability: 2 });
    }
    return null;
  }

  if (cell.skill === "timer") {
    targetBoard[row][col] = createCell(color, "timer", {
      remainingTurns: cell.remainingTurns || 1
    });
    return null;
  }

  const triggeredTrap = cell.skill === "trap"
    ? { row, col, owner: cell.owner || cell.color }
    : null;
  targetBoard[row][col] = createCell(color, NORMAL);

  if (triggeredTrap) {
    applyTrapEffect(targetBoard, row, col, triggeredTrap.owner);
    stats[triggeredTrap.owner].trapsTriggered += 1;
  }

  return triggeredTrap;
}

function applyBombEffect(targetBoard, row, col, color, stats) {
  const opponent = opponentOf(color);
  const triggeredTraps = [];

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
        const trap = captureCellBySkillEffect(targetBoard, targetRow, targetCol, color, stats);
        if (trap) {
          triggeredTraps.push(trap);
        }
      }
    }
  }

  return triggeredTraps;
}

function applyConvertEffect(targetBoard, row, col, color, stats) {
  const opponent = opponentOf(color);
  const triggeredTraps = [];

  for (const [rowStep, colStep] of DIRECTIONS) {
    let targetRow = row + rowStep;
    let targetCol = col + colStep;

    while (isInside(targetRow, targetCol)) {
      const cell = targetBoard[targetRow][targetCol];
      if (cell.color === opponent) {
        if (cell.skill !== "wall") {
          const trap = captureCellBySkillEffect(targetBoard, targetRow, targetCol, color, stats);
          if (trap) {
            triggeredTraps.push(trap);
          }
        }
        break;
      }

      targetRow += rowStep;
      targetCol += colStep;
    }
  }

  return triggeredTraps;
}

function applySkillEffect(targetBoard, row, col, color, skill, stats) {
  let triggeredTraps = [];
  if (skill === "bomb") {
    triggeredTraps = applyBombEffect(targetBoard, row, col, color, stats);
    stats[color].bombsTriggered += 1;
  }
  if (skill === "convert") {
    triggeredTraps = applyConvertEffect(targetBoard, row, col, color, stats);
  }
  return triggeredTraps;
}

function createSkillCell(color, skill) {
  if (skill === "timer") {
    return createCell(color, skill, { remainingTurns: SKILLS.timer.remainingTurns });
  }
  if (skill === "heavy") {
    return createCell(color, skill, { durability: SKILLS.heavy.durability });
  }
  if (skill === "trap") {
    return createCell(color, skill, { owner: color });
  }
  return createCell(color, skill);
}

function countdownTimers(targetBoard, skippedCell = null) {
  const expired = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = targetBoard[row][col];
      if (cell.skill !== "timer" || (skippedCell?.row === row && skippedCell?.col === col)) {
        continue;
      }

      const remainingTurns = (cell.remainingTurns || 1) - 1;
      if (remainingTurns <= 0) {
        targetBoard[row][col] = createCell();
        expired.push({ row, col });
      } else {
        targetBoard[row][col] = createCell(cell.color, "timer", { remainingTurns });
      }
    }
  }

  return expired;
}

function applyMoveToState(state, row, col, color, skill) {
  const flips = getFlipsForMove(state.board, row, col, color);
  if (flips.length === 0) {
    return null;
  }

  const nextBoard = cloneBoard(state.board);
  const nextSkillCounts = normalizeSkillCounts(state.skillCounts);
  const nextStats = normalizeMatchStats(state.matchStats);
  nextBoard[row][col] = createSkillCell(color, skill);
  const triggeredTraps = applyStandardFlips(nextBoard, flips, color, nextStats);
  triggeredTraps.push(...applySkillEffect(nextBoard, row, col, color, skill, nextStats));
  const expiredTimers = countdownTimers(nextBoard, skill === "timer" ? { row, col } : null);

  if (skill !== NORMAL) {
    nextSkillCounts[color][skill] -= 1;
    nextStats[color].skillsUsed += 1;
  }

  const nextPlayer = opponentOf(color);
  let nextLegal = getLegalMovesFor(nextBoard, nextPlayer);
  let currentLegal = getLegalMovesFor(nextBoard, color);
  let counts = countStones(nextBoard);
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
    expiredTimers.push(...countdownTimers(nextBoard));
    nextLegal = getLegalMovesFor(nextBoard, nextPlayer);
    currentLegal = getLegalMovesFor(nextBoard, color);
    counts = countStones(nextBoard);

    if (nextLegal.length === 0 && currentLegal.length === 0) {
      nextGameOver = true;
      nextMessage = counts.black === counts.white
        ? "引き分けです"
        : `${counts.black > counts.white ? "黒" : "白"}の勝ちです`;
    } else if (currentLegal.length > 0) {
      nextCurrentPlayer = color;
      nextMessage = `${playerLabel(nextPlayer)}はパス。${playerLabel(color)}の手番です`;
    } else {
      nextCurrentPlayer = nextPlayer;
      nextMessage = `${playerLabel(nextPlayer)}はパス後、盤面変化でもう一度手番です`;
    }
  }

  return {
    board: nextBoard,
    currentPlayer: nextCurrentPlayer,
    skillCounts: nextSkillCounts,
    matchStats: nextStats,
    gameOver: nextGameOver,
    message: nextMessage,
    lastEffect: triggeredTraps.length > 0
      ? { ...triggeredTraps[triggeredTraps.length - 1], skill: "trap-trigger", at: Date.now() }
      : expiredTimers.length > 0
        ? { ...expiredTimers[expiredTimers.length - 1], skill: "timer-expire", at: Date.now() }
        : skill !== NORMAL && skill !== "trap"
          ? { row, col, skill, at: Date.now() }
          : null
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

  for (const [skill, element] of Object.entries(skillCountElements)) {
    element.textContent = counts[skill] ?? 0;
  }
}

function renderBoard() {
  const legalMoves = isHumanTurn() && !gameOver ? getLegalMovesFor(board, currentPlayer) : [];
  const legalKeys = new Set(legalMoves.map((move) => `${move.row},${move.col}`));
  const viewerColor = isOnlineMode() ? onlinePlayerColor : BLACK;
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
        const effectClass = {
          bomb: "effect-bomb",
          convert: "effect-convert",
          "trap-trigger": "effect-trap",
          "timer-expire": "effect-timer-expire"
        }[lastEffect.skill];
        if (effectClass) {
          cellButton.classList.add(effectClass);
        }
      }

      const cell = board[row][col];
      if (cell.color) {
        const stone = document.createElement("span");
        const visibleSkill = cell.skill === "trap" && cell.owner !== viewerColor ? NORMAL : cell.skill || NORMAL;
        stone.className = `stone ${cell.color} ${visibleSkill}`;
        stone.setAttribute("aria-hidden", "true");

        if (visibleSkill === "timer") {
          const timer = document.createElement("span");
          timer.className = "timer-value";
          timer.textContent = cell.remainingTurns;
          stone.appendChild(timer);
        }

        if (visibleSkill === "heavy") {
          const durability = document.createElement("span");
          durability.className = "durability-value";
          durability.textContent = `×${cell.durability || 2}`;
          stone.classList.toggle("cracked", cell.durability === 1);
          stone.appendChild(durability);
        }

        if (visibleSkill === "trap") {
          const trap = document.createElement("span");
          trap.className = "trap-mark";
          trap.textContent = "罠";
          stone.appendChild(trap);
        }

        cellButton.appendChild(stone);
      }

      cellButton.disabled = !legalKeys.has(key);
      cellButton.addEventListener("click", () => handleCellClick(row, col));
      boardElement.appendChild(cellButton);
    }
  }
}

function renderSummary() {
  summaryPanel.hidden = !gameOver;
  if (!gameOver) {
    summaryContent.innerHTML = "";
    return;
  }

  summaryContent.innerHTML = "";
  for (const color of [BLACK, WHITE]) {
    const stats = matchStats[color];
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `
      <strong>${playerLabel(color)}</strong>
      <span>使用スキル ${stats.skillsUsed}</span>
      <span>爆弾発動 ${stats.bombsTriggered}</span>
      <span>トラップ発動 ${stats.trapsTriggered}</span>
    `;
    summaryContent.appendChild(item);
  }
}

function renderStatus() {
  messageText.textContent = message;
  updateSkillButtons();
  renderSummary();
}

function render() {
  renderBoard();
  renderStatus();
}

function setLocalState(nextState) {
  board = nextState.board;
  currentPlayer = nextState.currentPlayer;
  skillCounts = normalizeSkillCounts(nextState.skillCounts);
  matchStats = normalizeMatchStats(nextState.matchStats);
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
  matchStats = createInitialMatchStats();
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

    const nextState = applyMoveToState({ board, currentPlayer, skillCounts, matchStats }, move.row, move.col, WHITE, NORMAL);
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
  const nextState = applyMoveToState({ board, currentPlayer, skillCounts, matchStats }, row, col, BLACK, moveSkill);
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
    message = currentPlayer !== onlinePlayerColor
      ? "まだあなたの手番ではありません"
      : "選択中のスキル石は残っていません";
    renderStatus();
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
      board: normalizeBoard(roomData.board || createInitialBoard()),
      currentPlayer: roomData.currentPlayer || BLACK,
      skillCounts: counts,
      matchStats: normalizeMatchStats(roomData.matchStats)
    }, row, col, onlinePlayerColor, moveSkill);

    if (!nextState) {
      return roomData;
    }

    return {
      ...roomData,
      board: nextState.board,
      currentPlayer: nextState.currentPlayer,
      skillCounts: nextState.skillCounts,
      matchStats: nextState.matchStats,
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

  if (!result.committed) {
    message = "手を送信できませんでした。参加人数と手番を確認してください。";
    renderStatus();
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

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  sendChatButton.disabled = !enabled;
}

function clearChat() {
  chatMessagesElement.innerHTML = "";
}

function renderMessages(messages) {
  chatMessagesElement.innerHTML = "";

  for (const messageItem of messages) {
    const item = document.createElement("div");
    item.className = `chat-message ${messageItem.senderId === clientId ? "own" : "opponent"}`;

    const sender = document.createElement("span");
    sender.className = "chat-sender";
    sender.textContent = messageItem.senderId === clientId ? "あなた" : "相手";

    const body = document.createElement("span");
    body.className = "chat-text";
    body.textContent = messageItem.text || "";

    item.append(sender, body);
    chatMessagesElement.appendChild(item);
  }

  chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

function startChat(roomId) {
  stopChat();

  const recentMessages = firebaseTools.query(
    messagesRef(roomId),
    firebaseTools.orderByChild("createdAt"),
    firebaseTools.limitToLast(40)
  );

  chatUnsubscribe = firebaseTools.onValue(recentMessages, (snapshot) => {
    const values = snapshot.val() || {};
    const messages = Object.entries(values)
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    renderMessages(messages);
  });
}

function stopChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  setChatEnabled(false);
  clearChat();
}

function startHeartbeat(roomId) {
  stopHeartbeat();

  const beat = () => {
    firebaseTools.update(playerRef(roomId), {
      lastSeen: Date.now()
    }).catch(() => {
      // The room may have been removed by the other player.
    });
  };

  beat();
  heartbeatTimer = window.setInterval(beat, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function sendChatMessage() {
  await ensureFirebase();

  const text = chatInput.value.trim();
  if (!onlineRoomId || !onlinePlayerColor || !text) {
    return;
  }

  await firebaseTools.push(messagesRef(onlineRoomId), {
    senderId: clientId,
    text: text.slice(0, 80),
    createdAt: Date.now()
  });

  chatInput.value = "";
}

async function cleanupStaleRoomPlayers(roomId) {
  await firebaseTools.runTransaction(roomRef(roomId), (roomData) => {
    if (!roomData) {
      return null;
    }

    const now = Date.now();
    const players = Object.fromEntries(Object.entries(roomData.players || {}).filter(([id, player]) => {
      const lastSeen = player.lastSeen || player.joinedAt || 0;
      return id === clientId || now - lastSeen <= PLAYER_STALE_MS;
    }));

    if (Object.keys(players).length === 0) {
      return null;
    }

    return {
      ...roomData,
      players,
      updatedAt: now
    };
  });
}

function updateOnlineDetails({
  connection = "未接続",
  players = "0/2",
  color = "-",
  turn = "-",
  hint = "部屋を作るか、6桁の部屋IDを入力して参加してください。"
} = {}) {
  onlineConnectionText.textContent = connection;
  onlinePlayersText.textContent = players;
  onlineColorText.textContent = color;
  onlineTurnText.textContent = turn;
  onlineHint.textContent = hint;
}

function showOnlineError(error) {
  message = `オンライン接続エラー: ${error.message}`;
  updateOnlineDetails({
    connection: "エラー",
    players: onlineRoomId ? "確認中" : "0/2",
    color: onlinePlayerColor ? playerLabel(onlinePlayerColor) : "-",
    turn: "-",
    hint: `オンライン接続に失敗しました: ${error.message}`
  });
  renderStatus();
}

function updateOnlineStatus(roomData) {
  const players = getPlayerList(roomData);
  const ownPlayer = roomData?.players?.[clientId];
  const legalCount = onlinePlayerColor
    ? getLegalMovesFor(board, onlinePlayerColor).length
    : 0;
  const lastMove = roomData.lastMove
    ? `${playerLabel(roomData.lastMove.color)} ${roomData.lastMove.row + 1}行${roomData.lastMove.col + 1}列`
    : "なし";

  updateRoomInfo(onlineRoomId
    ? `部屋ID: ${onlineRoomId} / 最終手: ${lastMove}`
    : "");

  if (!ownPlayer) {
    message = "部屋から退出しました";
    updateOnlineDetails({
      connection: "未参加",
      players: `${players.length}/2`,
      color: "-",
      turn: "-",
      hint: "この端末は部屋に参加していません。部屋を作るか、部屋IDで入り直してください。"
    });
    return;
  }

  if (players.length < 2) {
    message = "相手の入室を待っています";
    updateOnlineDetails({
      connection: "待機中",
      players: `${players.length}/2`,
      color: playerLabel(onlinePlayerColor),
      turn: `${playerLabel(roomData.currentPlayer || BLACK)}の手番`,
      hint: `部屋ID ${onlineRoomId} を相手に共有してください。相手が入ると自動で開始します。`
    });
    return;
  }

  const isOwnTurn = roomData.currentPlayer === onlinePlayerColor;
  const hint = isOwnTurn
    ? `あなたの手番です。黄色の印が置ける場所です。置ける場所: ${legalCount}`
    : `相手の手番です。相手の操作が終わると自動で盤面が更新されます。`;

  updateOnlineDetails({
    connection: roomData.gameOver ? "終了" : "対戦中",
    players: `${players.length}/2`,
    color: playerLabel(onlinePlayerColor),
    turn: isOwnTurn ? "あなた" : "相手",
    hint: roomData.gameOver ? (roomData.message || "ゲーム終了です。") : hint
  });

  if (!roomData.gameOver) {
    message = isOwnTurn ? "あなたの手番です" : "相手の手番です";
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
  startChat(roomId);
  startHeartbeat(roomId);

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
    setChatEnabled(Boolean(ownPlayer));
    board = normalizeBoard(roomData.board || createInitialBoard());
    currentPlayer = roomData.currentPlayer || BLACK;
    skillCounts = normalizeSkillCounts(roomData.skillCounts);
    matchStats = normalizeMatchStats(roomData.matchStats);
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
  updateOnlineDetails({
    connection: "作成中",
    players: "1/2",
    color: "黒",
    turn: "黒",
    hint: "部屋を作成しています。"
  });

  await firebaseTools.set(roomRef(roomId), {
    board: createInitialBoard(),
    currentPlayer: BLACK,
    skillCounts: createInitialSkillCounts(),
    matchStats: createInitialMatchStats(),
    gameOver: false,
    message: "相手の入室を待っています",
    lastEffect: null,
    players: {
      [clientId]: {
        slot: 1,
        color: BLACK,
        joinedAt: Date.now(),
        lastSeen: Date.now()
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
  updateOnlineDetails({
    connection: "参加中",
    players: "確認中",
    color: "-",
    turn: "-",
    hint: "部屋を確認しています。"
  });

  if (!/^\d{6}$/.test(roomId)) {
    message = "6桁の部屋IDを入力してください";
    updateOnlineDetails({
      connection: "未接続",
      players: "0/2",
      color: "-",
      turn: "-",
      hint: "6桁の部屋IDを入力してから「部屋に入る」を押してください。"
    });
    renderStatus();
    return;
  }

  await cleanupStaleRoomPlayers(roomId);

  const snapshot = await firebaseTools.get(roomRef(roomId));
  if (!snapshot.exists()) {
    message = "部屋が見つかりません";
    updateOnlineDetails({
      connection: "未接続",
      players: "0/2",
      color: "-",
      turn: "-",
      hint: `部屋ID ${roomId} は見つかりませんでした。作成側の画面に表示されたIDを確認してください。`
    });
    renderStatus();
    return;
  }

  const roomData = snapshot.val();
  const players = getPlayers(roomData);
  const alreadyJoined = Boolean(players[clientId]);

  if (!alreadyJoined && Object.keys(players).length >= 2) {
    message = "部屋が満員です";
    updateOnlineDetails({
      connection: "満員",
      players: "2/2",
      color: "-",
      turn: "-",
      hint: "この部屋にはすでに2人参加しています。別の部屋を作ってください。"
    });
    renderStatus();
    return;
  }

  await leaveOnlineRoom();

  const slot = alreadyJoined ? players[clientId].slot : getAvailableSlot(players);
  const color = colorForSlot(slot);
  await firebaseTools.update(playerRef(roomId), {
    slot,
    color,
    joinedAt: Date.now(),
    lastSeen: Date.now()
  });

  onlinePlayerColor = color;
  await subscribeOnlineRoom(roomId);
}

async function leaveOnlineRoom() {
  const leavingRoomId = onlineRoomId;
  stopHeartbeat();

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
  updateOnlineDetails();
  stopChat();
}

async function leaveRoomData(roomIdValue) {
  await ensureFirebase();
  const roomId = normalizeRoomId(roomIdValue);
  await firebaseTools.runTransaction(roomRef(roomId), (roomData) => {
    if (!roomData) {
      return null;
    }

    const players = pruneStalePlayers(roomData.players || {});
    if (Object.keys(players).length === 0) {
      return null;
    }

    return {
      ...roomData,
      players,
      message: "相手が退出しました",
      updatedAt: Date.now()
    };
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
    matchStats: createInitialMatchStats(),
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

function openSkillModal() {
  skillModal.hidden = false;
  document.body.classList.add("modal-open");
  closeSkillModalButton.focus();
}

function closeSkillModal() {
  skillModal.hidden = true;
  document.body.classList.remove("modal-open");
  skillHelpButton.focus();
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
sendChatButton.addEventListener("click", () => {
  sendChatMessage().catch(showOnlineError);
});
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage().catch(showOnlineError);
  }
});
skillHelpButton.addEventListener("click", openSkillModal);
closeSkillModalButton.addEventListener("click", closeSkillModal);
skillModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeSkillModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !skillModal.hidden) {
    closeSkillModal();
  }
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
