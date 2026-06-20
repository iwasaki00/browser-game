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
let chatUnsubscribe = null;
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
  updateOnlineDetails();
  stopChat();
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
sendChatButton.addEventListener("click", () => {
  sendChatMessage().catch(showOnlineError);
});
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage().catch(showOnlineError);
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
