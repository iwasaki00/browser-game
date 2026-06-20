import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  child,
  get,
  getDatabase,
  limitToLast,
  off,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "../_cmn_firebase/firebase-config.js?v=iwa-games-20260620";

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
const GAME_ID = "gomoku";

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const modeElement = document.getElementById("mode");
const resetButton = document.getElementById("resetButton");
const onlineControls = document.getElementById("onlineControls");
const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");
const roomIdInput = document.getElementById("roomIdInput");
const roomInfoElement = document.getElementById("roomInfo");
const chatMessagesElement = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatButton = document.getElementById("sendChatButton");

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const clientId = crypto.randomUUID();

let board = [];
let currentPlayer = BLACK;
let gameOver = false;
let winningLine = null;
let onlineRoomId = "";
let onlinePlayerColor = "";
let onlineRoomRef = null;
let onlineRoomCallback = null;
let onlinePlayerRef = null;
let chatUnsubscribe = null;

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function normalizeRoomId(value) {
  return String(value).trim().replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function roomPath(roomId) {
  return `rooms/${GAME_ID}/${roomId}`;
}

function roomRef(roomId) {
  return ref(db, roomPath(roomId));
}

function playerRef(roomId) {
  return child(roomRef(roomId), `players/${clientId}`);
}

function playersRef(roomId) {
  return child(roomRef(roomId), "players");
}

function messagesRef(roomId) {
  return child(roomRef(roomId), "messages");
}

function playerLabel(player) {
  return player === BLACK ? "黒" : "白";
}

function colorForSlot(slot) {
  return slot === 1 ? BLACK : WHITE;
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function updateRoomInfo(message = "") {
  if (!roomInfoElement) {
    return;
  }

  roomInfoElement.textContent = message;
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

  for (const message of messages) {
    const item = document.createElement("div");
    item.className = `chat-message ${message.senderId === clientId ? "own" : "opponent"}`;

    const sender = document.createElement("span");
    sender.className = "chat-sender";
    sender.textContent = message.senderId === clientId ? "自分" : "相手";

    const body = document.createElement("span");
    body.className = "chat-text";
    body.textContent = message.text || "";

    item.append(sender, body);
    chatMessagesElement.appendChild(item);
  }

  chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

function startChat(roomId) {
  if (chatUnsubscribe) {
    chatUnsubscribe();
  }

  const recentMessages = query(messagesRef(roomId), orderByChild("createdAt"), limitToLast(50));
  chatUnsubscribe = onValue(recentMessages, (snapshot) => {
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
  const text = chatInput.value.trim();

  if (!onlineRoomId || !onlinePlayerColor || !text) {
    return;
  }

  const limitedText = text.slice(0, 100);
  await push(messagesRef(onlineRoomId), {
    senderId: clientId,
    text: limitedText,
    createdAt: Date.now()
  });

  chatInput.value = "";
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

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${row + 1}行 ${col + 1}列`);

      const isWinningCell = winningLine?.some(([winRow, winCol]) => winRow === row && winCol === col);
      if (isWinningCell) {
        cell.classList.add("winning");
      }

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

function countDirectionOn(targetBoard, row, col, rowStep, colStep, player) {
  let count = 0;
  let nextRow = row + rowStep;
  let nextCol = col + colStep;

  while (isInsideBoard(nextRow, nextCol) && targetBoard[nextRow][nextCol] === player) {
    count += 1;
    nextRow += rowStep;
    nextCol += colStep;
  }

  return count;
}

function countDirection(row, col, rowStep, colStep, player) {
  return countDirectionOn(board, row, col, rowStep, colStep, player);
}

function getWinningLineOn(targetBoard, row, col, player) {
  for (const [rowStep, colStep] of DIRECTIONS) {
    const backward = countDirectionOn(targetBoard, row, col, -rowStep, -colStep, player);
    const forward = countDirectionOn(targetBoard, row, col, rowStep, colStep, player);

    if (backward + forward + 1 >= 5) {
      const startOffset = Math.min(backward, 4);
      const positions = [];

      for (let offset = -startOffset; offset <= forward; offset += 1) {
        const currentRow = row + rowStep * offset;
        const currentCol = col + colStep * offset;

        if (isInsideBoard(currentRow, currentCol) && targetBoard[currentRow][currentCol] === player) {
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

function getWinningLine(row, col, player) {
  return getWinningLineOn(board, row, col, player);
}

function isBoardFullOn(targetBoard) {
  return targetBoard.every((row) => row.every((cell) => cell !== EMPTY));
}

function isBoardFull() {
  return isBoardFullOn(board);
}

function switchPlayer() {
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
}

function evaluateMove(row, col, player) {
  board[row][col] = player;
  const line = getWinningLine(row, col, player);
  board[row][col] = EMPTY;

  if (line) {
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
  const line = getWinningLine(row, col, currentPlayer);
  if (line) {
    gameOver = true;
    winningLine = line;
    renderBoard();
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

async function handleOnlineMove(row, col) {
  if (!onlineRoomId || !onlinePlayerColor) {
    updateStatus("オンライン部屋に参加してください");
    return;
  }

  if (gameOver || board[row][col] !== EMPTY) {
    return;
  }

  if (currentPlayer !== onlinePlayerColor) {
    updateStatus("相手の手番です");
    return;
  }

  const result = await runTransaction(roomRef(onlineRoomId), (roomData) => {
    if (!roomData || roomData.gameOver || roomData.currentPlayer !== onlinePlayerColor) {
      return roomData;
    }

    const players = getPlayerList(roomData);
    if (players.length < 2) {
      return roomData;
    }

    const nextBoard = roomData.board || createEmptyBoard();
    if (nextBoard[row][col] !== EMPTY) {
      return roomData;
    }

    nextBoard[row][col] = onlinePlayerColor;
    const line = getWinningLineOn(nextBoard, row, col, onlinePlayerColor);
    const full = isBoardFullOn(nextBoard);

    return {
      ...roomData,
      board: nextBoard,
      currentPlayer: onlinePlayerColor === BLACK ? WHITE : BLACK,
      gameOver: Boolean(line) || full,
      winner: line ? onlinePlayerColor : "",
      winningLine: line || null,
      lastMove: { row, col, player: onlinePlayerColor, at: Date.now() },
      updatedAt: Date.now()
    };
  });

  if (!result.committed) {
    updateStatus("着手を同期できませんでした");
  }
}

function handleMove(row, col) {
  if (modeElement.value === "online") {
    handleOnlineMove(row, col);
    return;
  }

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

function updateOnlineStatus(roomData) {
  const players = getPlayerList(roomData);
  const ownPlayer = roomData?.players?.[clientId];
  const roomText = onlineRoomId
    ? `部屋ID: ${onlineRoomId} / ${players.length}人参加 / あなた: ${onlinePlayerColor ? playerLabel(onlinePlayerColor) : "-"}`
    : "";
  updateRoomInfo(roomText);

  if (!ownPlayer) {
    updateStatus("部屋から退出しました");
    return;
  }

  if (players.length < 2) {
    updateStatus("相手の入室を待っています");
    return;
  }

  if (roomData.gameOver) {
    if (roomData.winner) {
      updateStatus(`${playerLabel(roomData.winner)}の勝ちです`);
    } else {
      updateStatus("引き分けです");
    }
    return;
  }

  updateStatus(roomData.currentPlayer === onlinePlayerColor ? "あなたの手番です" : "相手の手番です");
}

async function subscribeOnlineRoom(roomId) {
  if (onlineRoomRef && onlineRoomCallback) {
    off(onlineRoomRef, "value", onlineRoomCallback);
  }

  onlineRoomId = roomId;
  onlineRoomRef = roomRef(roomId);
  onlinePlayerRef = playerRef(roomId);
  await onDisconnect(onlinePlayerRef).remove();
  startChat(roomId);

  onlineRoomCallback = (snapshot) => {
    const roomData = snapshot.val();
    if (!roomData) {
      onlineRoomId = "";
      onlinePlayerColor = "";
      resetGame();
      updateRoomInfo("");
      updateStatus("部屋が見つかりません");
      return;
    }

    const ownPlayer = roomData.players?.[clientId];
    onlinePlayerColor = ownPlayer?.color || "";
    setChatEnabled(Boolean(ownPlayer));
    board = roomData.board || createEmptyBoard();
    currentPlayer = roomData.currentPlayer || BLACK;
    gameOver = Boolean(roomData.gameOver);
    winningLine = roomData.winningLine || null;
    renderBoard();
    updateOnlineStatus(roomData);
  };

  onValue(onlineRoomRef, onlineRoomCallback, (error) => {
    updateStatus(`Firebaseエラー: ${error.message}`);
  });
}

async function createOnlineRoom() {
  const roomId = generateRoomId();
  const initialBoard = createEmptyBoard();
  await leaveOnlineRoom();

  await set(roomRef(roomId), {
    board: initialBoard,
    currentPlayer: BLACK,
    gameOver: false,
    winner: "",
    winningLine: null,
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
  const roomId = normalizeRoomId(roomIdInput.value);
  roomIdInput.value = roomId;

  if (!/^\d{6}$/.test(roomId)) {
    updateStatus("6桁の部屋IDを入力してください");
    return;
  }

  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) {
    updateStatus("部屋が見つかりません");
    return;
  }

  const roomData = snapshot.val();
  const players = getPlayers(roomData);
  const alreadyJoined = Boolean(players[clientId]);

  if (!alreadyJoined && Object.keys(players).length >= 2) {
    updateStatus("部屋が満員です");
    return;
  }

  await leaveOnlineRoom();

  const slot = alreadyJoined ? players[clientId].slot : getAvailableSlot(players);
  const color = colorForSlot(slot);
  await update(playerRef(roomId), {
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
    off(onlineRoomRef, "value", onlineRoomCallback);
  }

  if (onlinePlayerRef) {
    await onDisconnect(onlinePlayerRef).cancel();
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
  stopChat();
}

async function leaveRoomData(roomIdValue) {
  const roomId = normalizeRoomId(roomIdValue);

  await remove(playerRef(roomId));

  const playersSnapshot = await get(playersRef(roomId));
  const players = playersSnapshot.val() || {};

  if (Object.keys(players).length === 0) {
    await remove(roomRef(roomId));
    return;
  }

  await update(roomRef(roomId), {
    updatedAt: Date.now()
  });
}

async function resetOnlineRoom() {
  if (!onlineRoomId) {
    updateStatus("オンライン部屋に参加してください");
    return;
  }

  if (onlinePlayerColor !== BLACK) {
    updateStatus("部屋作成者だけがリセットできます");
    return;
  }

  await update(roomRef(onlineRoomId), {
    board: createEmptyBoard(),
    currentPlayer: BLACK,
    gameOver: false,
    winner: "",
    winningLine: null,
    lastMove: null,
    updatedAt: Date.now()
  });
}

function resetGame() {
  board = createEmptyBoard();
  currentPlayer = BLACK;
  gameOver = false;
  winningLine = null;
  renderBoard();
  updateStatus("黒の手番です");
}

modeElement.addEventListener("change", async () => {
  const isOnline = modeElement.value === "online";
  onlineControls.hidden = !isOnline;

  if (!isOnline) {
    await leaveOnlineRoom();
    resetGame();
  } else {
    resetGame();
    updateStatus("部屋を作成するか、部屋IDで参加してください");
  }
});

resetButton.addEventListener("click", () => {
  if (modeElement.value === "online") {
    resetOnlineRoom();
    return;
  }

  resetGame();
});

createRoomButton.addEventListener("click", createOnlineRoom);
joinRoomButton.addEventListener("click", joinOnlineRoom);
leaveRoomButton.addEventListener("click", async () => {
  await leaveOnlineRoom();
  resetGame();
  updateStatus("部屋から退出しました");
});
sendChatButton.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage();
  }
});

function handlePageExit() {
  if (onlineRoomId) {
    leaveRoomData(onlineRoomId);
  }
}

window.addEventListener("pagehide", handlePageExit);
window.addEventListener("beforeunload", handlePageExit);

onlineControls.hidden = true;
setChatEnabled(false);
resetGame();
