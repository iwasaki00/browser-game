// Firebase Webアプリ設定: 利用するプロジェクトの値へ差し替えてください。
const firebaseConfig = {
  apiKey: "AIzaSyArMxZM_pYb3rJ1MZkNoMFw12Ct58GLEDQ",
  authDomain: "iwa-games.firebaseapp.com",
  databaseURL: "https://iwa-games-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iwa-games",
  storageBucket: "iwa-games.firebasestorage.app",
  messagingSenderId: "580654957912",
  appId: "1:580654957912:web:f59f31fc8df5286086d12d"
};

const GRID_SIZE = 30;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const GAME_DURATION = 60_000;
const POSITION_SYNC_INTERVAL = 100;
const MOVE_SPEED = 7.2;
const GAME_PATH = "rooms/paintBattle";
const ROOM_MAX_AGE = 24 * 60 * 60 * 1000;
const COLORS = { empty: "#dce2e8", blue: "#168cff", orange: "#ff7a1a" };
const WEAPONS = {
  roller: { name: "ローラー", speed: .85, action: "" },
  shooter: { name: "シューター", speed: 1, action: "撃つ" },
  bomb: { name: "ボム", speed: 1, action: "ボム" },
  charger: { name: "チャージャー", speed: .9, action: "長押し" }
};

const $ = (selector) => document.querySelector(selector);
const screens = ["#titleScreen", "#waitingScreen", "#gameScreen", "#resultScreen"];
const canvas = $("#gameCanvas");
const context = canvas.getContext("2d");
const titleMessage = $("#titleMessage");
const waitingMessage = $("#waitingMessage");
const joystick = $("#joystick");
const joystickKnob = $("#joystickKnob");
const actionButton = $("#actionButton");

let firebase = null;
let db = null;
let serverOffset = 0;
let playerId = getPersistentPlayerId();
let mode = "practice";
let roomId = "";
let ownSlot = 1;
let isHost = false;
let roomData = null;
let subscriptions = [];
let disconnectHandle = null;
let grid = new Uint8Array(CELL_COUNT);
let positions = { 1: { x: 3, y: 15 }, 2: { x: 26, y: 15 } };
let directions = { 1: { x: 1, y: 0 }, 2: { x: -1, y: 0 } };
let selectedWeapon = "roller";
let playerWeapons = { 1: "roller", 2: "roller" };
let joystickInput = { x: 0, y: 0, magnitude: 0, pointerId: null };
let keyboardInput = { up: false, down: false, left: false, right: false };
let gameRunning = false;
let gameEndAt = 0;
let animationFrame = 0;
let lastFrameAt = 0;
let lastPositionSyncAt = 0;
let lastPaintCell = -1;
let recentPaint = new Map();
let practiceFinished = false;
let onlinePlayerCount = 0;
let actionHeld = false;
let chargeStartedAt = 0;
let nextActionAt = 0;
let bombEffects = [];
let attackTrails = [];

function getPersistentPlayerId() {
  const key = "paintBattlePlayerId";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, value);
  }
  return value;
}

function showScreen(selector) {
  screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== selector));
}

function setTitleMessage(message, isError = false) {
  titleMessage.textContent = message;
  titleMessage.classList.toggle("error", isError);
}

function setBusy(busy) {
  $("#createRoomButton").disabled = busy;
  $("#joinRoomButton").disabled = busy;
  $("#practiceButton").disabled = busy;
  $("#roomIdInput").disabled = busy;
}

async function loadFirebase() {
  if (firebase) return firebase;

  const [appModule, databaseModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js")
  ]);
  const app = appModule.initializeApp(firebaseConfig);
  db = databaseModule.getDatabase(app);
  firebase = databaseModule;
  databaseModule.onValue(databaseModule.ref(db, ".info/serverTimeOffset"), (snapshot) => {
    serverOffset = snapshot.val() || 0;
  });

  cleanupOldPaintBattleRooms().catch((error) => console.warn("Room cleanup skipped:", error));
  return firebase;
}

function roomRef(id = roomId) {
  return firebase.ref(db, `${GAME_PATH}/${id}`);
}

function normalizeRoomId(value) {
  return String(value).trim().replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildPlayer(slot) {
  const start = slot === 1 ? positions[1] : positions[2];
  return {
    slot,
    x: start.x,
    y: start.y,
    weapon: selectedWeapon,
    direction: directions[slot],
    joinedAt: firebase.serverTimestamp(),
    lastSeenAt: firebase.serverTimestamp()
  };
}

async function createRoom() {
  setBusy(true);
  setTitleMessage("Firebaseに接続しています…");
  try {
    await loadFirebase();
    await leaveRoom(false);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const candidate = generateRoomId();
      const result = await firebase.runTransaction(roomRef(candidate), (current) => {
        if (current !== null) return;
        return {
          hostId: playerId,
          players: { [playerId]: buildPlayer(1) },
          grid: false,
          status: { phase: "waiting" },
          createdAt: firebase.serverTimestamp()
        };
      });
      if (result.committed) {
        await enterRoom(candidate, 1);
        return;
      }
    }
    throw new Error("部屋IDを確保できませんでした。もう一度お試しください。");
  } catch (error) {
    console.error(error);
    setTitleMessage(readableFirebaseError(error), true);
  } finally {
    setBusy(false);
  }
}

async function joinRoom() {
  const candidate = normalizeRoomId($("#roomIdInput").value);
  if (!/^\d{6}$/.test(candidate)) {
    setTitleMessage("6桁の部屋IDを入力してください。", true);
    return;
  }

  setBusy(true);
  setTitleMessage("部屋を探しています…");
  try {
    await loadFirebase();
    await leaveRoom(false);
    let joinedSlot = 0;
    let rejection = "部屋が見つかりません。";
    const result = await firebase.runTransaction(roomRef(candidate), (current) => {
      if (!current) return;
      if (current.status?.phase !== "waiting") {
        rejection = "この部屋はすでに対戦中です。";
        return;
      }
      const players = current.players || {};
      const entries = Object.values(players);
      if (entries.length >= 2 && !players[playerId]) {
        rejection = "この部屋は満員です。";
        return;
      }
      const used = new Set(entries.map((player) => player.slot));
      joinedSlot = players[playerId]?.slot || (used.has(1) ? 2 : 1);
      current.players = { ...players, [playerId]: buildPlayer(joinedSlot) };
      if (!current.hostId || !players[current.hostId]) current.hostId = playerId;
      return current;
    });
    if (!result.committed || !joinedSlot) throw new Error(rejection);
    await enterRoom(candidate, joinedSlot);
  } catch (error) {
    console.error(error);
    setTitleMessage(readableFirebaseError(error), true);
  } finally {
    setBusy(false);
  }
}

async function enterRoom(id, slot) {
  mode = "online";
  roomId = id;
  ownSlot = slot;
  grid = new Uint8Array(CELL_COUNT);
  positions = { 1: { x: 3, y: 15 }, 2: { x: 26, y: 15 } };
  directions = { 1: { x: 1, y: 0 }, 2: { x: -1, y: 0 } };
  $("#roomIdView").textContent = id;
  $("#ownColorView").textContent = slot === 1 ? "ブルー" : "オレンジ";
  $("#ownColorView").className = `color-label ${slot === 1 ? "blue" : "orange"}`;
  showScreen("#waitingScreen");

  disconnectHandle = firebase.onDisconnect(firebase.ref(db, `${GAME_PATH}/${id}/players/${playerId}`));
  await disconnectHandle.remove();
  subscribeToRoom();
}

function subscribeToRoom() {
  clearSubscriptions();
  const base = `${GAME_PATH}/${roomId}`;

  subscriptions.push(firebase.onValue(firebase.ref(db, `${base}/status`), (snapshot) => {
    const status = snapshot.val();
    if (!status) return handleRemoteRoomRemoval();
    roomData = { ...(roomData || {}), status };
    if (status.phase === "playing") startOnlineGame(status.endsAt);
    if (status.phase === "finished") showResult(status.scores?.blue || 0, status.scores?.orange || 0);
  }));

  subscriptions.push(firebase.onValue(firebase.ref(db, `${base}/players`), (snapshot) => {
    const players = snapshot.val();
    if (!players || !players[playerId]) return handleRemoteRoomRemoval();
    const entries = Object.entries(players);
    const values = entries.map(([, player]) => player);
    onlinePlayerCount = values.length;
    $("#playerCountView").textContent = `${values.length} / 2`;
    entries.forEach(([id, player]) => {
      if (player.slot && Number.isFinite(player.x) && Number.isFinite(player.y)) {
        if (id === playerId && gameRunning) return;
        positions[player.slot] = { x: player.x, y: player.y };
      }
      if (player.slot && WEAPONS[player.weapon]) playerWeapons[player.slot] = player.weapon;
      if (player.slot && Number.isFinite(player.direction?.x) && Number.isFinite(player.direction?.y)) {
        if (id !== playerId || !gameRunning) directions[player.slot] = player.direction;
      }
      if (id === playerId && WEAPONS[player.weapon]) selectedWeapon = player.weapon;
    });
    const opponent = entries.find(([id]) => id !== playerId)?.[1];
    $("#opponentWeaponView").textContent = opponent ? (WEAPONS[opponent.weapon]?.name || WEAPONS.roller.name) : "未参加";
    renderWeaponSelection();
    const hostId = roomData?.hostId;
    isHost = hostId === playerId;
    $("#startGameButton").classList.toggle("hidden", !isHost);
    $("#startGameButton").disabled = values.length !== 2;
    waitingMessage.textContent = values.length === 2 ? (isHost ? "2人揃いました。開始できます。" : "ホストの開始を待っています。") : "相手に部屋IDを伝えてください。";
    if (hostId && !players[hostId]) claimHost();
  }));

  subscriptions.push(firebase.onValue(firebase.ref(db, `${base}/hostId`), (snapshot) => {
    const hostId = snapshot.val();
    roomData = { ...(roomData || {}), hostId };
    isHost = hostId === playerId;
    $("#startGameButton").classList.toggle("hidden", !isHost);
    $("#startGameButton").disabled = onlinePlayerCount !== 2;
  }));

  firebase.get(firebase.ref(db, `${base}/grid`)).then((snapshot) => applyFullGrid(snapshot.val()));
  subscriptions.push(firebase.onChildChanged(firebase.ref(db, `${base}/grid`), (snapshot) => applyGridCell(snapshot.key, snapshot.val())));
  subscriptions.push(firebase.onChildAdded(firebase.ref(db, `${base}/grid`), (snapshot) => applyGridCell(snapshot.key, snapshot.val())));
}

function applyFullGrid(value) {
  if (!value || value === false) return;
  Object.entries(value).forEach(([index, color]) => applyGridCell(index, color));
}

function applyGridCell(indexValue, colorValue) {
  const index = Number(indexValue);
  const color = Number(colorValue);
  if (index >= 0 && index < CELL_COUNT && (color === 1 || color === 2)) {
    if (grid[index] !== color) recentPaint.set(index, performance.now());
    grid[index] = color;
  }
}

async function claimHost() {
  if (!roomId) return;
  await firebase.runTransaction(roomRef(), (current) => {
    if (!current || !current.players?.[playerId] || current.players[current.hostId]) return current;
    current.hostId = playerId;
    return current;
  });
}

async function startOnlineBattle() {
  if (!isHost || !roomId) return;
  $("#startGameButton").disabled = true;
  const endAt = Date.now() + serverOffset + GAME_DURATION;
  try {
    const result = await firebase.runTransaction(roomRef(), (current) => {
      if (!current || current.hostId !== playerId || Object.keys(current.players || {}).length !== 2 || current.status?.phase !== "waiting") return;
      current.status = {
        phase: "playing",
        startedAt: firebase.serverTimestamp(),
        endsAt: endAt
      };
      return current;
    });
    if (!result.committed) throw new Error("2人揃っていることを確認して、もう一度開始してください。");
  } catch (error) {
    waitingMessage.textContent = readableFirebaseError(error);
    $("#startGameButton").disabled = false;
  }
}

function startPractice() {
  mode = "practice";
  ownSlot = 1;
  roomId = "";
  grid = new Uint8Array(CELL_COUNT);
  positions = { 1: { x: 3, y: 15 }, 2: { x: 26, y: 15 } };
  directions = { 1: { x: 1, y: 0 }, 2: { x: -1, y: 0 } };
  playerWeapons[1] = selectedWeapon;
  practiceFinished = false;
  startGame(Date.now() + GAME_DURATION);
}

function startOnlineGame(endAt) {
  if (gameRunning || !endAt) return;
  startGame(endAt - serverOffset);
}

function startGame(endAt) {
  showScreen("#gameScreen");
  gameEndAt = endAt;
  gameRunning = true;
  lastFrameAt = performance.now();
  lastPaintCell = -1;
  nextActionAt = 0;
  actionHeld = false;
  chargeStartedAt = 0;
  bombEffects = [];
  attackTrails = [];
  playerWeapons[ownSlot] = selectedWeapon;
  $("#currentWeaponView").textContent = WEAPONS[selectedWeapon].name;
  $("#battleStatus").textContent = mode === "practice" ? "練習モード：スティックで移動" : `あなたは${ownSlot === 1 ? "ブルー" : "オレンジ"}`;
  configureActionButton();
  if (selectedWeapon === "roller") paintRoller(true);
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  if (!gameRunning) return;
  const deltaSeconds = Math.min((now - lastFrameAt) / 1000, .05);
  lastFrameAt = now;
  updateMovement(deltaSeconds, now);
  updateWeaponAction(now);
  updateEffects(now);
  drawGame(now);
  updateHud();

  if (Date.now() >= gameEndAt) {
    finishGame();
    return;
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

function updateMovement(deltaSeconds, now) {
  const input = getMovementInput();
  if (input.magnitude <= .02) return;
  const position = positions[ownSlot];
  const distance = MOVE_SPEED * WEAPONS[selectedWeapon].speed * input.magnitude * deltaSeconds;
  position.x += input.x * distance;
  position.y += input.y * distance;
  position.x = Math.max(.5, Math.min(GRID_SIZE - .5, position.x));
  position.y = Math.max(.5, Math.min(GRID_SIZE - .5, position.y));
  directions[ownSlot] = { x: input.x, y: input.y };
  if (selectedWeapon === "roller") paintRoller(false);

  if (mode === "online" && now - lastPositionSyncAt >= POSITION_SYNC_INTERVAL) {
    lastPositionSyncAt = now;
    firebase.update(firebase.ref(db, `${GAME_PATH}/${roomId}/players/${playerId}`), {
      x: Math.round(position.x * 100) / 100,
      y: Math.round(position.y * 100) / 100,
      direction: {
        x: Math.round(input.x * 100) / 100,
        y: Math.round(input.y * 100) / 100
      },
      lastSeenAt: firebase.serverTimestamp()
    }).catch(console.warn);
  }
}

function getMovementInput() {
  if (joystickInput.magnitude > .02) return joystickInput;
  const x = Number(keyboardInput.right) - Number(keyboardInput.left);
  const y = Number(keyboardInput.down) - Number(keyboardInput.up);
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length, magnitude: 1 } : { x: 0, y: 0, magnitude: 0 };
}

function paintRoller(force = false) {
  const position = positions[ownSlot];
  const centerX = Math.floor(position.x);
  const centerY = Math.floor(position.y);
  const centerIndex = centerY * GRID_SIZE + centerX;
  if (!force && centerIndex === lastPaintCell) return;
  lastPaintCell = centerIndex;
  const cells = [];

  for (let y = centerY - 1; y <= centerY + 1; y += 1) {
    for (let x = centerX - 1; x <= centerX + 1; x += 1) {
      const index = cellIndex(x, y);
      if (index !== -1) cells.push(index);
    }
  }
  updatePaintCells(cells, ownSlot);
}

function paintShooter() {
  const cells = getLineCells(6);
  updatePaintCells(cells, ownSlot);
  addAttackTrail(6, "shot");
}

function paintBomb(targetX, targetY) {
  const cells = [];
  const centerX = Math.floor(targetX);
  const centerY = Math.floor(targetY);
  for (let y = centerY - 2; y <= centerY + 2; y += 1) {
    for (let x = centerX - 2; x <= centerX + 2; x += 1) {
      const index = cellIndex(x, y);
      if (index !== -1) cells.push(index);
    }
  }
  updatePaintCells(cells, ownSlot);
}

function paintCharger(chargeRatio) {
  const range = Math.max(2, Math.round(12 * Math.min(1, chargeRatio)));
  updatePaintCells(getLineCells(range), ownSlot);
  addAttackTrail(range, "charge");
}

function updatePaintCells(cells, color) {
  const updates = {};
  const now = performance.now();
  [...new Set(cells)].forEach((index) => {
    if (index < 0 || index >= CELL_COUNT || grid[index] === color) return;
    grid[index] = color;
    recentPaint.set(index, now);
    updates[`grid/${index}`] = color;
  });

  if (mode === "online" && Object.keys(updates).length) {
    firebase.update(roomRef(), updates).catch(console.warn);
  }
}

function cellIndex(x, y) {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE ? y * GRID_SIZE + x : -1;
}

function getLineCells(range) {
  const position = positions[ownSlot];
  const direction = directions[ownSlot];
  const cells = [];
  for (let step = 1; step <= range; step += 1) {
    const index = cellIndex(Math.floor(position.x + direction.x * step), Math.floor(position.y + direction.y * step));
    if (index === -1) break;
    cells.push(index);
  }
  return cells;
}

function updateWeaponAction(now) {
  if (selectedWeapon === "shooter" && actionHeld && now >= nextActionAt) {
    paintShooter();
    nextActionAt = now + 180;
  }
  if (selectedWeapon === "charger" && chargeStartedAt) {
    const ratio = Math.min(1, (now - chargeStartedAt) / 1500);
    $("#chargeFill").style.height = `${ratio * 100}%`;
    $("#actionStatus").textContent = ratio >= 1 ? "フルチャージ" : `${Math.round(ratio * 100)}%`;
  } else if (selectedWeapon === "bomb" || selectedWeapon === "charger") {
    const remaining = Math.max(0, nextActionAt - now);
    actionButton.disabled = remaining > 0;
    $("#actionStatus").textContent = remaining > 0
      ? `あと ${(remaining / 1000).toFixed(1)}秒`
      : selectedWeapon === "bomb" ? "使用可能" : "長押しでチャージ";
  }
}

function throwBomb(now) {
  if (now < nextActionAt) return;
  const position = positions[ownSlot];
  const direction = directions[ownSlot];
  const distance = 6;
  const targetX = Math.max(.5, Math.min(GRID_SIZE - .5, position.x + direction.x * distance));
  const targetY = Math.max(.5, Math.min(GRID_SIZE - .5, position.y + direction.y * distance));
  bombEffects.push({ fromX: position.x, fromY: position.y, targetX, targetY, startedAt: now, explodesAt: now + 520, exploded: false, removeAt: now + 920 });
  nextActionAt = now + 5000;
}

function updateEffects(now) {
  bombEffects.forEach((effect) => {
    if (!effect.exploded && now >= effect.explodesAt) {
      effect.exploded = true;
      paintBomb(effect.targetX, effect.targetY);
    }
  });
  bombEffects = bombEffects.filter((effect) => now < effect.removeAt);
  attackTrails = attackTrails.filter((trail) => now < trail.removeAt);
}

function addAttackTrail(range, type) {
  const position = positions[ownSlot];
  const direction = directions[ownSlot];
  attackTrails.push({ x1: position.x, y1: position.y, x2: position.x + direction.x * range, y2: position.y + direction.y * range, type, removeAt: performance.now() + 180 });
}

function drawGame(now = performance.now()) {
  const size = canvas.width;
  const cell = size / GRID_SIZE;
  context.clearRect(0, 0, size, size);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const x = (index % GRID_SIZE) * cell;
    const y = Math.floor(index / GRID_SIZE) * cell;
    const color = grid[index];
    context.fillStyle = color === 1 ? COLORS.blue : color === 2 ? COLORS.orange : COLORS.empty;
    context.fillRect(x, y, cell + .4, cell + .4);
    const paintedAt = recentPaint.get(index);
    if (paintedAt) {
      const age = now - paintedAt;
      if (age < 260) {
        context.fillStyle = `rgba(255,255,255,${.38 * (1 - age / 260)})`;
        context.fillRect(x, y, cell + .4, cell + .4);
      } else recentPaint.delete(index);
    }
  }

  context.strokeStyle = "rgba(30,45,64,.13)";
  context.lineWidth = 1;
  for (let line = 1; line < GRID_SIZE; line += 1) {
    const point = line * cell;
    context.beginPath();
    context.moveTo(point, 0); context.lineTo(point, size);
    context.moveTo(0, point); context.lineTo(size, point);
    context.stroke();
  }

  attackTrails.forEach((trail) => {
    context.beginPath();
    context.moveTo(trail.x1 * cell, trail.y1 * cell);
    context.lineTo(trail.x2 * cell, trail.y2 * cell);
    context.lineWidth = trail.type === "charge" ? cell * .45 : cell * .24;
    context.strokeStyle = ownSlot === 1 ? "rgba(220,244,255,.9)" : "rgba(255,236,210,.9)";
    context.stroke();
  });

  bombEffects.forEach((effect) => {
    let x = effect.targetX;
    let y = effect.targetY;
    let radius = cell * .48;
    if (!effect.exploded) {
      const progress = Math.min(1, (now - effect.startedAt) / (effect.explodesAt - effect.startedAt));
      x = effect.fromX + (effect.targetX - effect.fromX) * progress;
      y = effect.fromY + (effect.targetY - effect.fromY) * progress;
    } else {
      radius = cell * (1.2 + 2.2 * (1 - (effect.removeAt - now) / (effect.removeAt - effect.explodesAt)));
    }
    context.beginPath();
    context.arc(x * cell, y * cell, radius, 0, Math.PI * 2);
    context.fillStyle = effect.exploded ? "rgba(255,255,255,.58)" : "#182438";
    context.fill();
    context.lineWidth = cell * .12;
    context.strokeStyle = ownSlot === 1 ? COLORS.blue : COLORS.orange;
    context.stroke();
  });

  Object.entries(positions).forEach(([slotValue, position]) => {
    const slot = Number(slotValue);
    if (mode === "practice" && slot === 2) return;
    const radius = cell * .62;
    context.beginPath();
    context.arc(position.x * cell, position.y * cell, radius, 0, Math.PI * 2);
    context.fillStyle = slot === 1 ? COLORS.blue : COLORS.orange;
    context.fill();
    context.lineWidth = slot === ownSlot ? cell * .22 : cell * .15;
    context.strokeStyle = slot === ownSlot ? "#ffffff" : "#172033";
    context.stroke();
    const direction = directions[slot] || { x: 1, y: 0 };
    context.beginPath();
    context.moveTo(position.x * cell, position.y * cell);
    context.lineTo((position.x + direction.x) * cell, (position.y + direction.y) * cell);
    context.lineWidth = cell * .18;
    context.strokeStyle = "#ffffff";
    context.stroke();
  });
}

function countScores() {
  let blue = 0;
  let orange = 0;
  grid.forEach((color) => { if (color === 1) blue += 1; else if (color === 2) orange += 1; });
  return { blue, orange };
}

function updateHud() {
  const scores = countScores();
  $("#blueScore").textContent = scores.blue;
  $("#orangeScore").textContent = scores.orange;
  const seconds = Math.max(0, Math.ceil((gameEndAt - Date.now()) / 1000));
  $("#timeView").textContent = seconds;
  $("#timeView").parentElement.classList.toggle("danger", seconds <= 10);
}

function finishGame() {
  gameRunning = false;
  clearDirectionState();
  const scores = countScores();
  if (mode === "practice") {
    if (!practiceFinished) {
      practiceFinished = true;
      showResult(scores.blue, scores.orange);
    }
    return;
  }
  if (roomId) finalizeOnlineResult();
}

async function finalizeOnlineResult() {
  try {
    await firebase.runTransaction(roomRef(), (current) => {
      if (!current || current.status?.phase === "finished") return current;
      const values = Object.values(current.grid || {});
      const scores = values.reduce((total, color) => {
        if (color === 1) total.blue += 1;
        if (color === 2) total.orange += 1;
        return total;
      }, { blue: 0, orange: 0 });
      current.status = { ...current.status, phase: "finished", finishedAt: firebase.serverTimestamp(), scores };
      return current;
    });
  } catch (error) {
    $("#battleStatus").textContent = "集計に失敗しました。再接続してください。";
  }
}

function showResult(blue, orange) {
  if (!$("#resultScreen").classList.contains("hidden")) return;
  gameRunning = false;
  clearDirectionState();
  cancelAnimationFrame(animationFrame);
  $("#resultBlueScore").textContent = blue;
  $("#resultOrangeScore").textContent = orange;
  let title = "引き分け";
  let subtitle = "両チーム同じ面積でした。";
  if (blue !== orange) {
    const winningSlot = blue > orange ? 1 : 2;
    title = mode === "practice" || winningSlot === ownSlot ? "勝利！" : "敗北…";
    subtitle = `${winningSlot === 1 ? "ブルー" : "オレンジ"}チームの勝ち`;
  }
  $("#resultTitle").textContent = title;
  $("#resultSubtitle").textContent = subtitle;
  showScreen("#resultScreen");
}

async function leaveRoom(showTitle = true) {
  gameRunning = false;
  cancelAnimationFrame(animationFrame);
  clearDirectionState();
  clearSubscriptions();
  const leavingRoom = roomId;
  roomId = "";

  if (mode === "online" && firebase && leavingRoom) {
    try {
      if (disconnectHandle) await disconnectHandle.cancel();
      await firebase.runTransaction(roomRef(leavingRoom), (current) => {
        if (!current) return null;
        if (current.players) delete current.players[playerId];
        const remainingIds = Object.keys(current.players || {});
        if (!remainingIds.length) return null;
        if (current.hostId === playerId) current.hostId = remainingIds[0];
        return current;
      });
    } catch (error) {
      console.warn("Leave cleanup failed:", error);
    }
  }

  disconnectHandle = null;
  roomData = null;
  isHost = false;
  onlinePlayerCount = 0;
  mode = "practice";
  if (showTitle) {
    setTitleMessage("");
    showScreen("#titleScreen");
  }
}

function clearSubscriptions() {
  subscriptions.forEach((unsubscribe) => unsubscribe());
  subscriptions = [];
}

function handleRemoteRoomRemoval() {
  if (!roomId) return;
  roomId = "";
  gameRunning = false;
  clearDirectionState();
  disconnectHandle = null;
  onlinePlayerCount = 0;
  clearSubscriptions();
  setTitleMessage("部屋が終了しました。", true);
  showScreen("#titleScreen");
}

function readableFirebaseError(error) {
  if (/PERMISSION_DENIED|permission/i.test(error?.message || "")) return "Firebaseのルールで操作が拒否されました。READMEを確認してください。";
  if (/network|fetch|offline/i.test(error?.message || "")) return "Firebaseに接続できません。通信環境と設定を確認してください。";
  return error?.message || "処理に失敗しました。";
}

async function cleanupOldPaintBattleRooms(maxAgeMs = ROOM_MAX_AGE) {
  if (!firebase) await loadFirebase();
  const snapshot = await firebase.get(firebase.ref(db, GAME_PATH));
  const rooms = snapshot.val() || {};
  const cutoff = Date.now() + serverOffset - maxAgeMs;
  const removals = {};
  Object.entries(rooms).forEach(([id, data]) => {
    if (!data?.players || (typeof data.createdAt === "number" && data.createdAt < cutoff)) removals[id] = null;
  });
  if (Object.keys(removals).length) await firebase.update(firebase.ref(db, GAME_PATH), removals);
  return Object.keys(removals).length;
}

window.cleanupOldPaintBattleRooms = cleanupOldPaintBattleRooms;

function selectWeapon(weapon) {
  if (!WEAPONS[weapon] || gameRunning) return;
  selectedWeapon = weapon;
  playerWeapons[ownSlot] = weapon;
  renderWeaponSelection();
  if (mode === "online" && roomId && firebase) {
    firebase.update(firebase.ref(db, `${GAME_PATH}/${roomId}/players/${playerId}`), { weapon }).catch((error) => {
      waitingMessage.textContent = readableFirebaseError(error);
    });
  }
}

function renderWeaponSelection() {
  document.querySelectorAll(".weapon-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.weapon === selectedWeapon);
    button.setAttribute("aria-pressed", String(button.dataset.weapon === selectedWeapon));
  });
}

function configureActionButton() {
  const config = WEAPONS[selectedWeapon];
  actionButton.classList.toggle("hidden", !config.action);
  actionButton.disabled = false;
  $("#actionButtonLabel").textContent = config.action;
  $("#actionStatus").textContent = selectedWeapon === "bomb" ? "使用可能" : selectedWeapon === "charger" ? "長押しでチャージ" : "";
  $("#chargeFill").style.height = "0%";
}

function updateJoystick(event) {
  if (joystickInput.pointerId !== event.pointerId) return;
  event.preventDefault();
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDistance = rect.width * .34;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const distance = Math.hypot(rawX, rawY);
  const limitedDistance = Math.min(distance, maxDistance);
  const scale = distance ? limitedDistance / distance : 0;
  const knobX = rawX * scale;
  const knobY = rawY * scale;
  const magnitude = Math.min(1, distance / maxDistance);
  joystickInput = {
    x: distance ? rawX / distance : 0,
    y: distance ? rawY / distance : 0,
    magnitude: magnitude < .08 ? 0 : magnitude,
    pointerId: event.pointerId
  };
  joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

function resetJoystick(event) {
  if (event && joystickInput.pointerId !== event.pointerId) return;
  joystickInput = { x: 0, y: 0, magnitude: 0, pointerId: null };
  joystickKnob.style.transform = "translate(-50%, -50%)";
}

function clearDirectionState() {
  resetJoystick();
  keyboardInput = { up: false, down: false, left: false, right: false };
  actionHeld = false;
  chargeStartedAt = 0;
  actionButton.classList.remove("active");
}

function startAction(event) {
  if (!gameRunning || selectedWeapon === "roller") return;
  event.preventDefault();
  if (Number.isFinite(event.pointerId)) actionButton.setPointerCapture?.(event.pointerId);
  actionButton.classList.add("active");
  const now = performance.now();
  if (selectedWeapon === "shooter") {
    actionHeld = true;
    updateWeaponAction(now);
  } else if (selectedWeapon === "bomb") {
    throwBomb(now);
  } else if (selectedWeapon === "charger" && now >= nextActionAt && !chargeStartedAt) {
    chargeStartedAt = now;
    $("#actionStatus").textContent = "0%";
  }
}

function endAction(event) {
  if (event) event.preventDefault();
  actionButton.classList.remove("active");
  actionHeld = false;
  if (selectedWeapon === "charger" && chargeStartedAt) {
    const now = performance.now();
    const ratio = Math.min(1, (now - chargeStartedAt) / 1500);
    if (ratio >= .08) paintCharger(ratio);
    chargeStartedAt = 0;
    nextActionAt = now + 700;
    $("#chargeFill").style.height = "0%";
    $("#actionStatus").textContent = "長押しでチャージ";
  }
}

document.querySelectorAll(".weapon-option").forEach((button) => {
  button.addEventListener("click", () => selectWeapon(button.dataset.weapon));
});

joystick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickInput.pointerId = event.pointerId;
  joystick.setPointerCapture?.(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener("pointermove", updateJoystick);
["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
  joystick.addEventListener(type, resetJoystick);
});

actionButton.addEventListener("pointerdown", startAction);
["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
  actionButton.addEventListener(type, endAction);
});

window.addEventListener("keydown", (event) => {
  const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (direction) {
    event.preventDefault();
    keyboardInput[direction] = true;
  }
  if (event.code === "Space" && !event.repeat) startAction(event);
});
window.addEventListener("keyup", (event) => {
  const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (direction) keyboardInput[direction] = false;
  if (event.code === "Space") endAction(event);
});
window.addEventListener("blur", clearDirectionState);
window.addEventListener("pagehide", () => { if (disconnectHandle) disconnectHandle.remove(); });

// iOS Safariでゲーム中のドラッグがページスクロールへ伝播するのを防ぐ。
$("#gameScreen").addEventListener("touchmove", (event) => {
  if (gameRunning) event.preventDefault();
}, { passive: false });

$("#createRoomButton").addEventListener("click", createRoom);
$("#joinRoomButton").addEventListener("click", joinRoom);
$("#practiceButton").addEventListener("click", startPractice);
$("#startGameButton").addEventListener("click", startOnlineBattle);
$("#leaveWaitingButton").addEventListener("click", () => leaveRoom(true));
$("#leaveGameButton").addEventListener("click", () => leaveRoom(true));
$("#backToTitleButton").addEventListener("click", () => leaveRoom(true));
$("#roomIdInput").addEventListener("input", (event) => { event.target.value = normalizeRoomId(event.target.value).replace(/\D/g, "").slice(0, 6); });
$("#roomIdInput").addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom(); });
$("#copyRoomIdButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomId);
    waitingMessage.textContent = "部屋IDをコピーしました。";
  } catch {
    waitingMessage.textContent = `部屋ID: ${roomId}`;
  }
});

renderWeaponSelection();
drawGame();
