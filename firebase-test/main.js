import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getDatabase,
  off,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const connectionStatus = document.querySelector("#connectionStatus");
const currentRoomIdView = document.querySelector("#currentRoomId");
const participantCount = document.querySelector("#participantCount");
const playerRole = document.querySelector("#playerRole");
const opponentStatus = document.querySelector("#opponentStatus");
const lastUpdated = document.querySelector("#lastUpdated");
const roomStatusMessage = document.querySelector("#roomStatusMessage");
const debugData = document.querySelector("#debugData");
const createRoomButton = document.querySelector("#createRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const roomIdInput = document.querySelector("#roomIdInput");

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const playerId = crypto.randomUUID();

let currentRoomId = "";
let currentRoomRef = null;
let currentPlayerRef = null;
let currentRoomCallback = null;

const formatDisplayTime = (date) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);

const setStatus = (message, state) => {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${state}`;
};

const setMessage = (message, state = "") => {
  roomStatusMessage.textContent = message;
  roomStatusMessage.className = `message ${state}`;
};

const setBusy = (busy) => {
  createRoomButton.disabled = busy;
  joinRoomButton.disabled = busy;
  roomIdInput.disabled = busy;
};

const updateLastUpdated = () => {
  lastUpdated.textContent = formatDisplayTime(new Date());
};

const normalizeRoomId = (value) => value.trim().replace(/\D/g, "").slice(0, 6);

const generateRoomId = () => String(Math.floor(100000 + Math.random() * 900000));

const getPlayers = (roomData) => roomData?.players ?? {};

const getPlayerList = (roomData) => Object.entries(getPlayers(roomData));

const getAvailableSlot = (players) => {
  const usedSlots = new Set(Object.values(players).map((player) => player.slot));
  return usedSlots.has(1) ? 2 : 1;
};

const resetRoomView = () => {
  currentRoomIdView.textContent = "-";
  participantCount.textContent = "0 / 2";
  playerRole.textContent = "-";
  opponentStatus.textContent = "未入室";
  debugData.textContent = "{}";
  leaveRoomButton.disabled = true;
};

const detachRoomListener = () => {
  if (currentRoomRef && currentRoomCallback) {
    off(currentRoomRef, "value", currentRoomCallback);
  }

  currentRoomCallback = null;
};

const registerDisconnectCleanup = async (roomId) => {
  currentPlayerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
  await onDisconnect(currentPlayerRef).remove();
};

const cancelDisconnectCleanup = async () => {
  if (currentPlayerRef) {
    await onDisconnect(currentPlayerRef).cancel();
  }

  currentPlayerRef = null;
};

const subscribeRoom = async (roomId) => {
  detachRoomListener();

  currentRoomId = roomId;
  currentRoomRef = ref(database, `rooms/${roomId}`);
  currentRoomIdView.textContent = roomId;
  leaveRoomButton.disabled = false;

  await registerDisconnectCleanup(roomId);

  currentRoomCallback = (snapshot) => {
    const roomData = snapshot.val();
    const players = getPlayerList(roomData);
    const ownPlayer = roomData?.players?.[playerId];
    const opponent = players.find(([id]) => id !== playerId)?.[1];

    debugData.textContent = JSON.stringify(roomData ?? null, null, 2);
    participantCount.textContent = `${players.length} / 2`;
    playerRole.textContent = ownPlayer ? `プレイヤー${ownPlayer.slot}` : "-";
    opponentStatus.textContent = opponent ? `プレイヤー${opponent.slot} が入室中` : "相手待機中";
    updateLastUpdated();

    if (!roomData || !ownPlayer) {
      setStatus("未接続", "pending");
      setMessage("この部屋から退出しました。", "warning");
      resetCurrentRoomState();
      return;
    }

    setStatus("接続成功", "success");
    setMessage(opponent ? "相手が入室しました。" : "相手の入室を待っています。");
  };

  onValue(currentRoomRef, currentRoomCallback, (error) => {
    setStatus("接続失敗", "error");
    setMessage(error.message, "error");
    updateLastUpdated();
  });
};

const resetCurrentRoomState = () => {
  detachRoomListener();
  currentRoomId = "";
  currentRoomRef = null;
  currentPlayerRef = null;
  resetRoomView();
};

const buildPlayerData = (slot) => ({
  slot,
  joinedAt: Date.now(),
  lastSeenAt: Date.now()
});

const createRoomWithId = async (roomId) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  const result = await runTransaction(roomRef, (roomData) => {
    if (roomData !== null) {
      return;
    }

    return {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      players: {
        [playerId]: buildPlayerData(1)
      }
    };
  });

  return result.committed;
};

const createRoom = async () => {
  setBusy(true);
  setStatus("接続中", "pending");
  setMessage("部屋を作成しています。");

  try {
    await leaveCurrentRoom();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = generateRoomId();
      const created = await createRoomWithId(roomId);

      if (created) {
        roomIdInput.value = roomId;
        await subscribeRoom(roomId);
        setMessage("部屋を作成しました。相手の入室を待っています。");
        return;
      }
    }

    throw new Error("部屋IDの生成に失敗しました。もう一度作成してください。");
  } catch (error) {
    setStatus("接続失敗", "error");
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const joinRoom = async () => {
  const roomId = normalizeRoomId(roomIdInput.value);
  roomIdInput.value = roomId;

  if (roomId.length !== 6) {
    setMessage("6桁の部屋IDを入力してください。", "warning");
    return;
  }

  setBusy(true);
  setStatus("接続中", "pending");
  setMessage("部屋に参加しています。");

  let transactionError = "";

  try {
    await leaveCurrentRoom();

    const roomRef = ref(database, `rooms/${roomId}`);
    const result = await runTransaction(roomRef, (roomData) => {
      if (roomData === null) {
        transactionError = "指定された部屋が見つかりません。";
        return;
      }

      const players = getPlayers(roomData);

      if (players[playerId]) {
        players[playerId].lastSeenAt = Date.now();
        roomData.updatedAt = Date.now();
        return roomData;
      }

      if (Object.keys(players).length >= 2) {
        transactionError = "この部屋は満員です。";
        return;
      }

      const slot = getAvailableSlot(players);
      return {
        ...roomData,
        updatedAt: Date.now(),
        players: {
          ...players,
          [playerId]: buildPlayerData(slot)
        }
      };
    });

    if (!result.committed) {
      throw new Error(transactionError || "部屋への参加に失敗しました。");
    }

    await subscribeRoom(roomId);
    setMessage("部屋に参加しました。");
  } catch (error) {
    setStatus("接続失敗", "error");
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const cleanupEmptyRoom = async (roomId) => {
  const roomRef = ref(database, `rooms/${roomId}`);

  await runTransaction(roomRef, (roomData) => {
    if (!roomData) {
      return null;
    }

    const players = getPlayers(roomData);

    if (Object.keys(players).length === 0) {
      return null;
    }

    return {
      ...roomData,
      updatedAt: Date.now()
    };
  });
};

const leaveCurrentRoom = async () => {
  if (!currentRoomId) {
    return;
  }

  const leavingRoomId = currentRoomId;

  await cancelDisconnectCleanup();
  await remove(ref(database, `rooms/${leavingRoomId}/players/${playerId}`));
  await cleanupEmptyRoom(leavingRoomId);
  resetCurrentRoomState();
};

const leaveRoom = async () => {
  try {
    await leaveCurrentRoom();
    setStatus("未接続", "pending");
    setMessage("部屋から退出しました。");
    updateLastUpdated();
  } catch (error) {
    setStatus("接続失敗", "error");
    setMessage(error.message, "error");
    updateLastUpdated();
  }
};

roomIdInput.addEventListener("input", () => {
  roomIdInput.value = normalizeRoomId(roomIdInput.value);
});

roomIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinRoom();
  }
});

createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
leaveRoomButton.addEventListener("click", leaveRoom);

window.addEventListener("pagehide", () => {
  if (currentRoomId) {
    remove(ref(database, `rooms/${currentRoomId}/players/${playerId}`));
  }
});

setStatus("未接続", "pending");
resetRoomView();
