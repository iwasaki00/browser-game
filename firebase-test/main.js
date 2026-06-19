import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  get,
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
const roomState = document.querySelector("#roomState");
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

const updateLastUpdated = () => {
  lastUpdated.textContent = formatDisplayTime(new Date());
};

const setFirebaseStatus = (message, state) => {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${state}`;
};

const setRoomState = (message, state) => {
  roomState.textContent = message;
  roomState.className = `status ${state}`;
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

const normalizeRoomId = (roomId) => String(roomId).trim();

const isValidRoomId = (roomId) => /^\d{6}$/.test(roomId);

const generateRoomId = () => normalizeRoomId(Math.floor(100000 + Math.random() * 900000));

const getRoomPath = (roomId) => `rooms/${normalizeRoomId(roomId)}`;

const getRoomRef = (roomId) => ref(database, getRoomPath(roomId));

const getPlayerPath = (roomId) => `${getRoomPath(roomId)}/players/${playerId}`;

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

const logJoinDebug = ({ inputValue, roomId, roomPath, snapshot }) => {
  console.log("[room join] inputValue:", inputValue);
  console.log("[room join] normalizedRoomId:", roomId);
  console.log("[room join] refPath:", roomPath);
  console.log("[room join] snapshot.exists():", snapshot.exists());
  console.log("[room join] snapshot.val():", snapshot.val());
};

const detachRoomListener = () => {
  if (currentRoomRef && currentRoomCallback) {
    off(currentRoomRef, "value", currentRoomCallback);
  }

  currentRoomCallback = null;
};

const registerDisconnectCleanup = async (roomId) => {
  currentPlayerRef = ref(database, getPlayerPath(roomId));
  await onDisconnect(currentPlayerRef).remove();
};

const cancelDisconnectCleanup = async () => {
  if (currentPlayerRef) {
    await onDisconnect(currentPlayerRef).cancel();
  }

  currentPlayerRef = null;
};

const resetCurrentRoomState = () => {
  detachRoomListener();
  currentRoomId = "";
  currentRoomRef = null;
  currentPlayerRef = null;
  resetRoomView();
};

const subscribeRoom = async (roomIdValue) => {
  const roomId = normalizeRoomId(roomIdValue);

  detachRoomListener();

  currentRoomId = roomId;
  currentRoomRef = getRoomRef(roomId);
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
      setRoomState("部屋未参加", "pending");
      setMessage("この部屋から退出しました。", "warning");
      resetCurrentRoomState();
      return;
    }

    setFirebaseStatus("Firebase接続成功", "success");
    setRoomState("部屋参加中", "success");
    setMessage(opponent ? "相手が入室しました。" : "相手の入室を待っています。");
  };

  console.log("[room watch] refPath:", getRoomPath(roomId));

  onValue(currentRoomRef, currentRoomCallback, (error) => {
    setFirebaseStatus("Firebase接続失敗", "error");
    setMessage(error.message, "error");
    updateLastUpdated();
  });
};

const buildPlayerData = (slot) => ({
  slot,
  joinedAt: Date.now(),
  lastSeenAt: Date.now()
});

const createRoomWithId = async (roomIdValue) => {
  const roomId = normalizeRoomId(roomIdValue);
  const roomRef = getRoomRef(roomId);
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
  setFirebaseStatus("Firebase接続成功", "success");
  setRoomState("部屋作成中", "pending");
  setMessage("部屋を作成しています。");

  try {
    await leaveCurrentRoom();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = normalizeRoomId(generateRoomId());
      const created = await createRoomWithId(roomId);

      if (created) {
        roomIdInput.value = roomId;
        currentRoomIdView.textContent = roomId;
        console.log("[room create] roomId:", roomId);
        console.log("[room create] refPath:", getRoomPath(roomId));
        await subscribeRoom(roomId);
        setMessage(`部屋を作成しました。部屋ID: ${roomId}`);
        return;
      }
    }

    throw new Error("部屋IDの生成に失敗しました。もう一度作成してください。");
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setRoomState("部屋未参加", "pending");
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const verifyRoomExists = async (inputValue) => {
  const roomId = normalizeRoomId(inputValue);
  const roomPath = getRoomPath(roomId);
  const snapshot = await get(getRoomRef(roomId));

  logJoinDebug({ inputValue, roomId, roomPath, snapshot });

  return {
    roomId,
    roomPath,
    snapshot
  };
};

const joinRoom = async () => {
  const inputValue = roomIdInput.value;
  const roomId = normalizeRoomId(inputValue);
  roomIdInput.value = roomId;

  if (!isValidRoomId(roomId)) {
    setRoomState("部屋未参加", "pending");
    setMessage("6桁の数字だけで部屋IDを入力してください。", "warning");
    return;
  }

  setBusy(true);
  setFirebaseStatus("Firebase接続成功", "success");
  setRoomState("部屋確認中", "pending");
  setMessage("部屋を確認しています。");

  let transactionError = "";

  try {
    const verification = await verifyRoomExists(inputValue);

    if (!verification.snapshot.exists()) {
      setRoomState("部屋が見つからない", "error");
      setMessage(`部屋が見つかりません。参照パス: ${verification.roomPath}`, "error");
      debugData.textContent = JSON.stringify({
        requestedPath: verification.roomPath,
        exists: false,
        value: null
      }, null, 2);
      updateLastUpdated();
      return;
    }

    await leaveCurrentRoom();

    const result = await runTransaction(getRoomRef(roomId), (roomData) => {
      if (roomData === null) {
        transactionError = `部屋が見つかりません。参照パス: ${getRoomPath(roomId)}`;
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
    setMessage(`部屋に参加しました。参照パス: ${getRoomPath(roomId)}`);
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setRoomState("部屋未参加", "pending");
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const cleanupEmptyRoom = async (roomIdValue) => {
  const roomId = normalizeRoomId(roomIdValue);

  await runTransaction(getRoomRef(roomId), (roomData) => {
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

  const leavingRoomId = normalizeRoomId(currentRoomId);

  await cancelDisconnectCleanup();
  await remove(ref(database, getPlayerPath(leavingRoomId)));
  await cleanupEmptyRoom(leavingRoomId);
  resetCurrentRoomState();
};

const leaveRoom = async () => {
  try {
    await leaveCurrentRoom();
    setFirebaseStatus("Firebase接続成功", "success");
    setRoomState("部屋未参加", "pending");
    setMessage("部屋から退出しました。");
    updateLastUpdated();
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
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
    remove(ref(database, getPlayerPath(currentRoomId)));
  }
});

setFirebaseStatus("Firebase接続成功", "success");
setRoomState("部屋未参加", "pending");
resetRoomView();
