import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  child,
  get,
  getDatabase,
  off,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  update
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js?v=iwa-games-20260620";

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
const db = getDatabase(app);
const playerId = crypto.randomUUID();

let currentRoomId = "";
let currentRoomRef = null;
let currentPlayerRef = null;
let currentRoomCallback = null;
let latestRoomData = null;
let debugState = {
  firebaseStatus: "Firebase初期化成功",
  roomStatus: "部屋未参加",
  inputRoomId: "",
  normalizedRoomId: "",
  refPath: "",
  roomsKeys: [],
  snapshotExists: null,
  snapshotValue: null,
  error: "",
  verifyContext: ""
};

const formatDisplayTime = (date) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);

const updateLastUpdated = () => {
  lastUpdated.textContent = formatDisplayTime(new Date());
};

const renderDebug = () => {
  debugData.textContent = JSON.stringify({
    projectId: firebaseConfig.projectId,
    databaseURL: firebaseConfig.databaseURL,
    現在のFirebase状態: debugState.firebaseStatus,
    現在の部屋状態: debugState.roomStatus,
    入力された部屋ID: debugState.inputRoomId,
    normalize後の部屋ID: debugState.normalizedRoomId,
    実際に参照したパス: debugState.refPath,
    rooms直下のキー一覧: debugState.roomsKeys,
    "snapshot.exists()": debugState.snapshotExists,
    "snapshot.val()": debugState.snapshotValue,
    エラー内容: debugState.error,
    確認タイミング: debugState.verifyContext,
    監視中のroomData: latestRoomData
  }, null, 2);
};

const setFirebaseStatus = (message, state = "success") => {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${state}`;
  debugState.firebaseStatus = message;
  renderDebug();
};

const setRoomState = (message, state = "pending") => {
  roomState.textContent = message;
  roomState.className = `status ${state}`;
  debugState.roomStatus = message;
  renderDebug();
};

const setMessage = (message, state = "") => {
  roomStatusMessage.textContent = message;
  roomStatusMessage.className = `message ${state}`;
};

const setDebugState = (nextState) => {
  debugState = {
    ...debugState,
    ...nextState
  };
  renderDebug();
};

const setBusy = (busy) => {
  createRoomButton.disabled = busy;
  joinRoomButton.disabled = busy;
  roomIdInput.disabled = busy;
};

const normalizeRoomId = (value) =>
  String(value).trim().replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

const isValidRoomId = (roomId) => /^\d{6}$/.test(roomId);

const generateRoomId = () => normalizeRoomId(Math.floor(100000 + Math.random() * 900000));

const roomPath = (roomId) => `rooms/${roomId}`;

const roomRef = (roomId) => ref(db, roomPath(roomId));

const roomsRef = () => ref(db, "rooms");

const playerRef = (roomId) => child(roomRef(roomId), `players/${playerId}`);

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
  latestRoomData = null;
  renderDebug();
  leaveRoomButton.disabled = true;
};

const logRoomDebug = ({ label, inputValue, roomId, path, roomsKeys, snapshot }) => {
  console.log(`[${label}] inputValue:`, inputValue);
  console.log(`[${label}] normalizedRoomId:`, roomId);
  console.log(`[${label}] refPath:`, path);
  console.log(`[${label}] roomsKeys:`, roomsKeys);
  console.log(`[${label}] snapshot.exists():`, snapshot.exists());
  console.log(`[${label}] snapshot.val():`, snapshot.val());
};

const verifyRoom = async ({ inputValue, roomId, context }) => {
  const normalizedRoomId = normalizeRoomId(roomId);
  const path = roomPath(normalizedRoomId);
  const roomsSnapshot = await get(roomsRef());
  const roomsValue = roomsSnapshot.val();
  const roomsKeys = roomsValue ? Object.keys(roomsValue) : [];
  const snapshot = await get(roomRef(normalizedRoomId));

  setFirebaseStatus("Firebase接続成功", "success");
  setDebugState({
    inputRoomId: inputValue,
    normalizedRoomId,
    refPath: path,
    roomsKeys,
    snapshotExists: snapshot.exists(),
    snapshotValue: snapshot.val(),
    error: "",
    verifyContext: context
  });
  logRoomDebug({
    label: context,
    inputValue,
    roomId: normalizedRoomId,
    path,
    roomsKeys,
    snapshot
  });

  return {
    roomId: normalizedRoomId,
    path,
    roomsKeys,
    snapshot
  };
};

const detachRoomListener = () => {
  if (currentRoomRef && currentRoomCallback) {
    off(currentRoomRef, "value", currentRoomCallback);
  }

  currentRoomCallback = null;
};

const registerDisconnectCleanup = async (roomId) => {
  currentPlayerRef = playerRef(roomId);
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
  currentRoomRef = roomRef(roomId);
  currentRoomIdView.textContent = roomId;
  leaveRoomButton.disabled = false;
  setDebugState({
    normalizedRoomId: roomId,
    refPath: roomPath(roomId),
    error: "",
    verifyContext: "room-watch"
  });

  await registerDisconnectCleanup(roomId);

  currentRoomCallback = (snapshot) => {
    const roomData = snapshot.val();
    latestRoomData = roomData;
    const players = getPlayerList(roomData);
    const ownPlayer = roomData?.players?.[playerId];
    const opponent = players.find(([id]) => id !== playerId)?.[1];

    setFirebaseStatus("Firebase接続成功", "success");
    setDebugState({
      normalizedRoomId: roomId,
      refPath: roomPath(roomId),
      snapshotExists: snapshot.exists(),
      snapshotValue: roomData,
      error: "",
      verifyContext: "room-watch"
    });
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

    setRoomState("部屋参加中", "success");
    setMessage(opponent ? "相手が入室しました。" : "相手の入室を待っています。");
  };

  console.log("[room watch] refPath:", roomPath(roomId));

  onValue(currentRoomRef, currentRoomCallback, (error) => {
    setDebugState({ error: error.message, verifyContext: "room-watch-error" });
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
  const result = await runTransaction(roomRef(roomId), (roomData) => {
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
  setFirebaseStatus("Firebase初期化成功", "success");
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
        console.log("[room create] refPath:", roomPath(roomId));

        setFirebaseStatus("Firebase接続成功", "success");
        setRoomState("部屋作成成功", "success");
        setMessage(`部屋を作成しました。部屋ID: ${roomId}`);

        const verification = await verifyRoom({
          inputValue: roomId,
          roomId,
          context: "create-after-write"
        });

        if (!verification.snapshot.exists()) {
          setRoomState("部屋作成失敗：作成直後の再読み込みで部屋が見つかりません", "error");
          setDebugState({ error: `作成直後に部屋を確認できません。参照パス: ${verification.path}` });
          setMessage(`作成直後に部屋を確認できません。参照パス: ${verification.path}`, "error");
          return;
        }

        await subscribeRoom(roomId);
        return;
      }
    }

    setRoomState("部屋作成失敗", "error");
    setDebugState({ error: "部屋IDの生成に失敗しました。もう一度作成してください。" });
    setMessage("部屋IDの生成に失敗しました。もう一度作成してください。", "error");
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setRoomState("部屋未参加", "pending");
    setDebugState({ error: error.message });
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const joinRoom = async () => {
  const inputValue = roomIdInput.value;
  const roomId = normalizeRoomId(inputValue);
  roomIdInput.value = roomId;
  setDebugState({
    inputRoomId: inputValue,
    normalizedRoomId: roomId,
    refPath: isValidRoomId(roomId) ? roomPath(roomId) : "",
    snapshotExists: null,
    snapshotValue: null,
    error: "",
    verifyContext: "join-input"
  });

  if (!isValidRoomId(roomId)) {
    setRoomState("部屋未参加", "pending");
    setDebugState({ error: "正規化後の部屋IDが6桁数字ではありません。" });
    setMessage("部屋IDは6桁の数字だけで入力してください。", "warning");
    return;
  }

  setBusy(true);
  setFirebaseStatus("Firebase初期化成功", "success");
  setRoomState("部屋確認中", "pending");
  setMessage("部屋を確認しています。");

  let transactionError = "";

  try {
    const verification = await verifyRoom({
      inputValue,
      roomId,
      context: "join-before-transaction"
    });

    if (!verification.snapshot.exists()) {
      setRoomState("部屋参加失敗：部屋が見つかりません", "error");
      setDebugState({ error: `部屋が見つかりません。参照パス: ${verification.path}` });
      setMessage(`部屋が見つかりません。参照パス: ${verification.path}`, "error");
      updateLastUpdated();
      return;
    }

    await leaveCurrentRoom();

    const result = await runTransaction(roomRef(roomId), (roomData) => {
      if (roomData === null) {
        transactionError = `部屋が見つかりません。参照パス: ${roomPath(roomId)}`;
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
      setRoomState("部屋参加失敗", "error");
      setDebugState({ error: transactionError || "部屋への参加に失敗しました。" });
      setMessage(transactionError || "部屋への参加に失敗しました。", "error");
      updateLastUpdated();
      return;
    }

    setFirebaseStatus("Firebase接続成功", "success");
    await subscribeRoom(roomId);
    setMessage(`部屋に参加しました。参照パス: ${roomPath(roomId)}`);
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setRoomState("部屋未参加", "pending");
    setDebugState({ error: error.message });
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const cleanupEmptyRoom = async (roomIdValue) => {
  const roomId = normalizeRoomId(roomIdValue);

  await runTransaction(roomRef(roomId), (roomData) => {
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

const joinRoomFixed = async () => {
  const inputValue = roomIdInput.value;
  const roomId = normalizeRoomId(inputValue);
  roomIdInput.value = roomId;
  setDebugState({
    inputRoomId: inputValue,
    normalizedRoomId: roomId,
    refPath: isValidRoomId(roomId) ? roomPath(roomId) : "",
    snapshotExists: null,
    snapshotValue: null,
    error: "",
    verifyContext: "join-input"
  });

  if (!isValidRoomId(roomId)) {
    setRoomState("部屋未参加", "pending");
    setDebugState({ error: "正規化後の部屋IDが6桁数字ではありません。" });
    setMessage("部屋IDは6桁の数字だけで入力してください。", "warning");
    return;
  }

  setBusy(true);
  setFirebaseStatus("Firebase接続成功", "success");
  setRoomState("部屋確認中", "pending");
  setMessage("部屋を確認しています。");

  try {
    const roomSnapshot = await get(roomRef(roomId));
    const roomsSnapshot = await get(roomsRef());
    const roomsValue = roomsSnapshot.val();
    const roomsKeys = roomsValue ? Object.keys(roomsValue) : [];

    setDebugState({
      inputRoomId: inputValue,
      normalizedRoomId: roomId,
      refPath: roomPath(roomId),
      roomsKeys,
      snapshotExists: roomSnapshot.exists(),
      snapshotValue: roomSnapshot.val(),
      error: "",
      verifyContext: "join-before-update"
    });

    console.log("[room join] inputValue:", inputValue);
    console.log("[room join] normalizedRoomId:", roomId);
    console.log("[room join] refPath:", roomPath(roomId));
    console.log("[room join] roomsKeys:", roomsKeys);
    console.log("[room join] snapshot.exists():", roomSnapshot.exists());
    console.log("[room join] snapshot.val():", roomSnapshot.val());

    if (!roomSnapshot.exists()) {
      setRoomState("部屋参加失敗：部屋が見つかりません", "error");
      setDebugState({ error: `部屋が見つかりません。参照パス: ${roomPath(roomId)}` });
      setMessage(`部屋が見つかりません。参照パス: ${roomPath(roomId)}`, "error");
      updateLastUpdated();
      return;
    }

    const roomData = roomSnapshot.val();
    latestRoomData = roomData;
    const players = roomData.players || {};
    const alreadyJoined = Boolean(players[playerId]);

    if (!alreadyJoined && Object.keys(players).length >= 2) {
      setRoomState("部屋参加失敗：部屋が満員です", "error");
      setDebugState({ error: "部屋が満員です。" });
      setMessage("部屋が満員です。", "error");
      updateLastUpdated();
      return;
    }

    const slot = alreadyJoined ? players[playerId].slot : getAvailableSlot(players);

    if (currentRoomId && currentRoomId !== roomId) {
      await leaveCurrentRoom();
    }

    try {
      await update(playerRef(roomId), {
        ...buildPlayerData(slot),
        rejoinedAt: alreadyJoined ? Date.now() : null
      });
      await update(roomRef(roomId), {
        updatedAt: Date.now()
      });
    } catch (error) {
      setRoomState("部屋参加失敗：Firebase書き込み失敗", "error");
      setDebugState({ error: error.message });
      setMessage(`Firebase書き込み失敗: ${error.message}`, "error");
      updateLastUpdated();
      return;
    }

    setFirebaseStatus("Firebase接続成功", "success");
    setRoomState("部屋参加中", "success");
    await subscribeRoom(roomId);
    setMessage(`部屋に参加しました。参照パス: ${roomPath(roomId)}`);
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setRoomState("部屋参加失敗：その他例外", "error");
    setDebugState({ error: error.message });
    setMessage(error.message, "error");
    updateLastUpdated();
  } finally {
    setBusy(false);
  }
};

const leaveCurrentRoom = async () => {
  if (!currentRoomId) {
    return;
  }

  const leavingRoomId = normalizeRoomId(currentRoomId);

  await cancelDisconnectCleanup();
  await remove(playerRef(leavingRoomId));
  await cleanupEmptyRoom(leavingRoomId);
  resetCurrentRoomState();
};

const leaveRoom = async () => {
  try {
    await leaveCurrentRoom();
    setFirebaseStatus("Firebase接続成功", "success");
    setRoomState("部屋未参加", "pending");
    setDebugState({ error: "" });
    setMessage("部屋から退出しました。");
    updateLastUpdated();
  } catch (error) {
    setFirebaseStatus("Firebase接続失敗", "error");
    setDebugState({ error: error.message });
    setMessage(error.message, "error");
    updateLastUpdated();
  }
};

roomIdInput.addEventListener("input", () => {
  roomIdInput.value = normalizeRoomId(roomIdInput.value);
});

roomIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinRoomFixed();
  }
});

createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoomFixed);
leaveRoomButton.addEventListener("click", leaveRoom);

window.addEventListener("pagehide", () => {
  if (currentRoomId) {
    remove(playerRef(currentRoomId));
  }
});

setFirebaseStatus("Firebase初期化成功", "success");
setRoomState("部屋未参加", "pending");
resetRoomView();
