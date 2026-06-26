"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyArMxZM_pYb3rJ1MZkNoMFw12Ct58GLEDQ",
  authDomain: "iwa-games.firebaseapp.com",
  databaseURL: "https://iwa-games-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iwa-games",
  storageBucket: "iwa-games.firebasestorage.app",
  messagingSenderId: "580654957912",
  appId: "1:580654957912:web:f59f31fc8df5286086d12d"
};

// Firebase Realtime Database development rules:
// {
//   "rules": {
//     "rooms": {
//       "navalBattle": {
//         "$roomId": {
//           ".read": true,
//           ".write": true
//         }
//       }
//     }
//   }
// }
// Development only. Public production use needs authentication, validation, and write limits.
// TODO: 本格運用時は相手のboardを直接クライアントに配布しない構成にする

const BOARD_SIZE = 10;
const SPRITE_SIZE = 32;
const SPRITE_SHEET_WIDTH = 384;
const SPRITE_SHEET_HEIGHT = 192;
const SPRITE_SHEET_COLUMNS = SPRITE_SHEET_WIDTH / SPRITE_SIZE;
const SPRITE_SHEET_ROWS = SPRITE_SHEET_HEIGHT / SPRITE_SIZE;
const GAME_PATH = "rooms/navalBattle";
const ROOM_TTL_MS = 1000 * 60 * 60 * 12;

const SPRITES = {
  water: { x: 0, y: 0, w: 32, h: 32 },
  miss: { x: 32, y: 0, w: 32, h: 32 },
  hit: { x: 64, y: 0, w: 32, h: 32 },
  explosion: { x: 96, y: 0, w: 32, h: 32 },
  cursor: { x: 128, y: 0, w: 32, h: 32 },
  target: { x: 160, y: 0, w: 32, h: 32 },
  target2: { x: 192, y: 0, w: 32, h: 32 },
  sonar: { x: 224, y: 0, w: 32, h: 32 },
  splash: { x: 256, y: 0, w: 32, h: 32 },
  ships: {
    battleship: [
      { x: 0, y: 32, w: 32, h: 32 },
      { x: 32, y: 32, w: 32, h: 32 },
      { x: 64, y: 32, w: 32, h: 32 },
      { x: 96, y: 32, w: 32, h: 32 },
      { x: 128, y: 32, w: 32, h: 32 }
    ],
    cruiser: [
      { x: 0, y: 64, w: 32, h: 32 },
      { x: 32, y: 64, w: 32, h: 32 },
      { x: 64, y: 64, w: 32, h: 32 },
      { x: 96, y: 64, w: 32, h: 32 }
    ],
    submarine: [
      { x: 0, y: 96, w: 32, h: 32 },
      { x: 32, y: 96, w: 32, h: 32 },
      { x: 64, y: 96, w: 32, h: 32 }
    ],
    destroyer: [
      { x: 0, y: 128, w: 32, h: 32 },
      { x: 32, y: 128, w: 32, h: 32 },
      { x: 64, y: 128, w: 32, h: 32 }
    ],
    patrol: [
      { x: 0, y: 160, w: 32, h: 32 },
      { x: 32, y: 160, w: 32, h: 32 }
    ]
  }
};

const SHIPS = [
  { id: "battleship", name: "戦艦", size: 5 },
  { id: "cruiser", name: "巡洋艦", size: 4 },
  { id: "submarine", name: "潜水艦", size: 3 },
  { id: "destroyer", name: "駆逐艦", size: 3 },
  { id: "patrol", name: "哨戒艇", size: 2 }
];

const ATTACK_CARDS = [
  { id: "single", name: "通常砲撃", description: "指定した1マス", pattern: [[0, 0]], count: 99 },
  { id: "cross", name: "十字爆弾", description: "中心から十字5マス", pattern: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], count: 3 },
  { id: "square2", name: "爆雷", description: "左上基準の2×2", pattern: [[0, 0], [1, 0], [0, 1], [1, 1]], count: 3 },
  { id: "line3", name: "魚雷", description: "横3マス", pattern: [[-1, 0], [0, 0], [1, 0]], count: 3 },
  { id: "square3", name: "絨毯爆撃", description: "中心から3×3", pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], count: 1 }
];

const phaseLabels = {
  menu: "トップ",
  setup: "艦隊配置中",
  waiting: "待機中",
  playerTurn: "自分の攻撃",
  cpuTurn: "相手の攻撃",
  victory: "勝利",
  defeat: "敗北"
};

const gameState = {
  mode: null,
  phase: "menu",
  turn: "player",
  turnCount: 1,
  selectedCardId: "single",
  placementDirection: "horizontal",
  placementIndex: 0,
  player: createEmptyOwner(),
  cpu: createEmptyOwner(),
  logs: [],
  recentCells: []
};

const onlineState = {
  roomId: null,
  role: null,
  playerId: getOrCreatePlayerId(),
  opponentRole: null,
  connected: false,
  roomData: null,
  roomRef: null,
  unsubscribe: null,
  syncing: false
};

let firebaseApp = null;
let database = null;

const elements = {
  app: document.getElementById("app"),
  modePanel: document.getElementById("modePanel"),
  cpuModeButton: document.getElementById("cpuModeButton"),
  createRoomButton: document.getElementById("createRoomButton"),
  roomIdInput: document.getElementById("roomIdInput"),
  joinRoomButton: document.getElementById("joinRoomButton"),
  modeMessage: document.getElementById("modeMessage"),
  onlinePanel: document.getElementById("onlinePanel"),
  roomIdText: document.getElementById("roomIdText"),
  copyRoomButton: document.getElementById("copyRoomButton"),
  roleText: document.getElementById("roleText"),
  hostStatusText: document.getElementById("hostStatusText"),
  guestStatusText: document.getElementById("guestStatusText"),
  connectionText: document.getElementById("connectionText"),
  readyButton: document.getElementById("readyButton"),
  leaveRoomButton: document.getElementById("leaveRoomButton"),
  onlineMessage: document.getElementById("onlineMessage"),
  commandPanel: document.getElementById("commandPanel"),
  setupPanel: document.getElementById("setupPanel"),
  cards: document.getElementById("cards"),
  boards: document.getElementById("boards"),
  logPanel: document.getElementById("logPanel"),
  phaseText: document.getElementById("phaseText"),
  turnText: document.getElementById("turnText"),
  battleRoomText: document.getElementById("battleRoomText"),
  messageText: document.getElementById("messageText"),
  placementText: document.getElementById("placementText"),
  randomButton: document.getElementById("randomButton"),
  clearPlacementButton: document.getElementById("clearPlacementButton"),
  directionButton: document.getElementById("directionButton"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
  resultRestartButton: document.getElementById("resultRestartButton"),
  enemyPanel: document.getElementById("enemyPanel"),
  enemyBoard: document.getElementById("enemyBoard"),
  playerBoard: document.getElementById("playerBoard"),
  enemyFleetText: document.getElementById("enemyFleetText"),
  playerFleetText: document.getElementById("playerFleetText"),
  logList: document.getElementById("logList"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultTitle: document.getElementById("resultTitle"),
  resultMessage: document.getElementById("resultMessage")
};

const spriteImage = new Image();
spriteImage.onload = () => elements.app.classList.add("sprites-ready");
spriteImage.onerror = () => elements.app.classList.remove("sprites-ready");
spriteImage.src = "assets/naval_sprites.png";

function createEmptyOwner() {
  return {
    name: "",
    ready: false,
    board: [],
    ships: [],
    cards: {},
    attacks: []
  };
}

function initGame() {
  bindEvents();
  renderCoords();
  restoreOnlineRoom();
  render();
}

function startCpuMode() {
  leaveRoom(false);
  gameState.mode = "cpu";
  gameState.phase = "setup";
  gameState.turn = "player";
  gameState.turnCount = 1;
  gameState.selectedCardId = "single";
  gameState.placementDirection = "horizontal";
  gameState.placementIndex = 0;
  gameState.player = createPreparedOwner("あなた", false);
  gameState.cpu = createPreparedOwner("CPU", false);
  gameState.logs = [];
  gameState.recentCells = [];
  randomPlaceFleet("cpu", false);
  addLog("CPU対戦を開始します。自海域に艦を配置してください。");
  render();
}

function createPreparedOwner(name, withFleet) {
  const owner = createEmptyOwner();
  owner.name = name;
  owner.board = createEmptyBoard();
  owner.cards = createCardCounts();
  if (withFleet) placeRandomFleetOnOwner(owner);
  return owner;
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => ({
      x,
      y,
      shipId: null,
      shipIndex: null,
      shipDirection: null,
      attacked: false,
      hit: false,
      sunk: false
    }))
  );
}

function createCardCounts() {
  return ATTACK_CARDS.reduce((cards, card) => {
    cards[card.id] = card.count;
    return cards;
  }, {});
}

function resetLocalPlacement() {
  const owner = getLocalOwner();
  owner.board = createEmptyBoard();
  owner.ships = [];
  owner.attacks = [];
  owner.ready = false;
  gameState.placementIndex = 0;
  addLog("手動配置に戻しました。");
  syncLocalPlayerIfOnline();
  render();
}

function randomPlaceFleet(ownerKey = "player", shouldSync = true) {
  const owner = gameState[ownerKey];
  owner.board = createEmptyBoard();
  owner.ships = [];
  placeRandomFleetOnOwner(owner);
  if (ownerKey === "player") {
    owner.ready = false;
    gameState.placementIndex = SHIPS.length;
    addLog("自軍艦隊をランダム配置しました。");
  }
  if (shouldSync) syncLocalPlayerIfOnline();
  render();
}

function placeRandomFleetOnOwner(owner) {
  SHIPS.forEach((ship) => {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 500) {
      const direction = Math.random() > 0.5 ? "horizontal" : "vertical";
      const x = randomInt(0, BOARD_SIZE - 1);
      const y = randomInt(0, BOARD_SIZE - 1);
      if (canPlaceShip(owner.board, ship, x, y, direction)) {
        addShipToOwner(owner, ship, x, y, direction);
        placed = true;
      }
      attempts += 1;
    }
  });
}

function placePlayerShip(x, y) {
  if (gameState.phase !== "setup") return;
  const owner = getLocalOwner();
  const ship = SHIPS[gameState.placementIndex];
  if (!ship) return;
  if (!canPlaceShip(owner.board, ship, x, y, gameState.placementDirection)) {
    addLog(`${ship.name}はそこに配置できません。`);
    render();
    return;
  }
  owner.ready = false;
  addShipToOwner(owner, ship, x, y, gameState.placementDirection);
  gameState.placementIndex += 1;
  addLog(`${ship.name}を${formatCoord(x, y)}に配置しました。`);
  if (gameState.placementIndex >= SHIPS.length) addLog("配置完了。準備完了できます。");
  syncLocalPlayerIfOnline();
  render();
}

function addShipToOwner(owner, ship, x, y, direction) {
  placeShip(owner.board, ship, x, y, direction);
  owner.ships.push({
    id: ship.id,
    name: ship.name,
    size: ship.size,
    direction,
    cells: getShipCells(ship, x, y, direction),
    sunk: false
  });
}

function canPlaceShip(board, ship, x, y, direction) {
  return getShipCells(ship, x, y, direction).every((cell) =>
    isInside(cell.x, cell.y) && !board[cell.y][cell.x].shipId
  );
}

function placeShip(board, ship, x, y, direction) {
  getShipCells(ship, x, y, direction).forEach((cell, index) => {
    const boardCell = board[cell.y][cell.x];
    boardCell.shipId = ship.id;
    boardCell.shipIndex = index;
    boardCell.shipDirection = direction;
  });
}

function getShipCells(ship, x, y, direction) {
  return Array.from({ length: ship.size }, (_, index) => ({
    x: direction === "horizontal" ? x + index : x,
    y: direction === "vertical" ? y + index : y
  }));
}

function startGame() {
  if (gameState.mode === "online") {
    setPlayerReady();
    return;
  }
  if (gameState.player.ships.length !== SHIPS.length) {
    addLog("全艦を配置してから開始してください。");
    render();
    return;
  }
  gameState.phase = "playerTurn";
  gameState.turn = "player";
  gameState.turnCount = 1;
  addLog("戦闘開始。敵海域を攻撃してください。");
  render();
}

function render() {
  const localOwner = getLocalOwner();
  const remoteOwner = getRemoteOwner();
  const placementDone = localOwner.ships.length === SHIPS.length;
  const currentShip = SHIPS[gameState.placementIndex];
  const online = gameState.mode === "online";
  const myTurn = isLocalTurn();
  const compactBattle = ["playerTurn", "cpuTurn", "victory", "defeat"].includes(gameState.phase);

  elements.app.classList.toggle("battle-compact", compactBattle);
  elements.modePanel.hidden = gameState.phase !== "menu";
  elements.onlinePanel.hidden = !online || gameState.phase === "menu";
  elements.commandPanel.hidden = gameState.phase === "menu";
  elements.setupPanel.hidden = gameState.phase !== "setup";
  elements.cards.hidden = gameState.phase === "menu" || gameState.phase === "setup" || gameState.phase === "waiting";
  elements.boards.hidden = gameState.phase === "menu";
  elements.logPanel.hidden = gameState.phase === "menu";
  elements.resultOverlay.classList.toggle("show", gameState.phase === "victory" || gameState.phase === "defeat");
  elements.enemyPanel.classList.toggle("waiting", online && !myTurn && gameState.phase !== "setup");
  elements.enemyPanel.classList.toggle("active-turn", myTurn && gameState.phase === "playerTurn");

  elements.phaseText.textContent = phaseLabels[gameState.phase] || "-";
  elements.turnText.textContent = String(gameState.turnCount);
  elements.battleRoomText.textContent = online ? onlineState.roomId || "------" : "CPU";
  elements.messageText.textContent = gameState.logs[0] || "モードを選択してください。";
  elements.directionButton.textContent = `向き: ${gameState.placementDirection === "horizontal" ? "横" : "縦"}`;
  elements.startButton.textContent = online ? "準備完了" : "ゲーム開始";
  elements.startButton.disabled = !placementDone || (online && localOwner.ready);
  elements.readyButton.disabled = gameState.phase !== "setup" || !placementDone || localOwner.ready;
  elements.randomButton.disabled = gameState.phase !== "setup" || (online && localOwner.ready);
  elements.clearPlacementButton.disabled = gameState.phase !== "setup" || (online && localOwner.ready);
  elements.directionButton.disabled = gameState.phase !== "setup" || (online && localOwner.ready);
  elements.placementText.textContent = placementDone
    ? online ? "配置完了。準備完了を押してください。" : "配置完了。ゲーム開始を押してください。"
    : `配置中: ${currentShip.name} (${currentShip.size}マス)`;

  renderOnlineStatus();
  renderCards();
  renderBoard("remote", elements.enemyBoard);
  renderBoard("local", elements.playerBoard);
  renderFleetStatus(localOwner, remoteOwner);
  renderLogs();
}

function renderOnlineStatus() {
  const roomData = onlineState.roomData;
  elements.roomIdText.textContent = onlineState.roomId || "------";
  elements.roleText.textContent = onlineState.role ? `${onlineState.role} / ${onlineState.playerId.slice(0, 6)}` : "-";
  elements.connectionText.textContent = onlineState.syncing ? "同期中..." : onlineState.connected ? "接続中" : "未接続";
  elements.hostStatusText.textContent = formatParticipant(roomData?.players?.host, roomData?.hostId);
  elements.guestStatusText.textContent = formatParticipant(roomData?.players?.guest, roomData?.guestId);

  if (!onlineState.roomId) {
    elements.onlineMessage.textContent = "オンライン未接続です。";
  } else if (!roomData?.guestId) {
    elements.onlineMessage.textContent = "相手の参加を待っています。";
  } else if (roomData.status === "setup" || roomData.status === "waiting") {
    elements.onlineMessage.textContent = "両者が準備完了になると対戦開始です。";
  } else if (roomData.status === "playing") {
    elements.onlineMessage.textContent = isLocalTurn() ? "あなたの手番です。" : "相手の手番です。";
  }
}

function formatParticipant(player, id) {
  if (!id) return "未参加";
  if (!player) return "同期中";
  return player.ready ? "準備完了" : "配置中";
}

function renderCoords() {
  document.querySelectorAll(".coords.cols").forEach((el) => {
    el.innerHTML = letters().map((letter) => `<span>${letter}</span>`).join("");
  });
  document.querySelectorAll(".coords.rows").forEach((el) => {
    el.innerHTML = Array.from({ length: BOARD_SIZE }, (_, index) => `<span>${index + 1}</span>`).join("");
  });
}

function renderBoard(which, container) {
  const owner = which === "local" ? getLocalOwner() : getRemoteOwner();
  const showShips = which === "local";
  container.innerHTML = "";
  owner.board.flat().forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = getCellClass(which, cell, showShips);
    applySpriteToCellButton(button, cell, showShips);
    button.dataset.x = cell.x;
    button.dataset.y = cell.y;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${letters()[cell.x]}-${cell.y + 1}`);
    if (which === "remote") {
      button.addEventListener("pointerenter", () => previewAttackPattern(cell.x, cell.y));
      button.addEventListener("focus", () => previewAttackPattern(cell.x, cell.y));
      button.addEventListener("click", () => {
        if (gameState.mode === "online") onlinePlayerAttack(cell.x, cell.y);
        else playerAttack(cell.x, cell.y);
      });
    }
    if (which === "local" && gameState.phase === "setup") {
      button.addEventListener("pointerenter", () => previewPlacement(cell.x, cell.y));
      button.addEventListener("focus", () => previewPlacement(cell.x, cell.y));
      button.addEventListener("click", () => placePlayerShip(cell.x, cell.y));
    }
    container.appendChild(button);
  });
}

function getCellClass(which, cell, showShips) {
  const classes = ["cell", "sprite-drawn"];
  if (showShips && cell.shipId && !cell.attacked) classes.push("ship");
  if (cell.attacked) classes.push(cell.hit ? "hit" : "miss", "attacked");
  if (cell.sunk) classes.push("sunk");
  if (gameState.recentCells.some((recent) => recent.owner === which && recent.x === cell.x && recent.y === cell.y)) {
    classes.push("recent");
  }
  return classes.join(" ");
}

function getSpriteForCell(cell, showShips) {
  if (cell.attacked && cell.hit) return SPRITES.hit;
  if (cell.attacked) return SPRITES.miss;
  if (showShips && cell.shipId && Number.isInteger(cell.shipIndex)) {
    const shipSprites = SPRITES.ships[cell.shipId];
    return shipSprites?.[cell.shipIndex] || SPRITES.water;
  }
  return SPRITES.water;
}

function applySpriteToCellButton(button, cell, showShips) {
  const sprite = getSpriteForCell(cell, showShips);
  const layer = document.createElement("span");
  layer.className = "sprite-layer";
  layer.style.backgroundImage = 'url("assets/naval_sprites.png")';
  layer.style.backgroundSize = `${SPRITE_SHEET_COLUMNS * 100}% ${SPRITE_SHEET_ROWS * 100}%`;
  layer.style.backgroundPosition = getSpriteBackgroundPosition(sprite);

  if (
    showShips &&
    cell.shipId &&
    !cell.attacked &&
    cell.shipDirection === "vertical"
  ) {
    layer.classList.add("vertical");
  }

  button.appendChild(layer);
}

function getSpriteBackgroundPosition(sprite) {
  const column = sprite.x / SPRITE_SIZE;
  const row = sprite.y / SPRITE_SIZE;
  const x = SPRITE_SHEET_COLUMNS <= 1 ? 0 : (column / (SPRITE_SHEET_COLUMNS - 1)) * 100;
  const y = SPRITE_SHEET_ROWS <= 1 ? 0 : (row / (SPRITE_SHEET_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

function renderCards() {
  const localOwner = getLocalOwner();
  elements.cards.innerHTML = "";
  ATTACK_CARDS.forEach((card) => {
    const count = localOwner.cards[card.id] ?? 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card-button${gameState.selectedCardId === card.id ? " active" : ""}`;
    button.disabled = gameState.phase !== "playerTurn" || !isLocalTurn() || count <= 0;
    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span><b>${count}</b>`;
    button.addEventListener("click", () => selectCard(card.id));
    elements.cards.appendChild(button);
  });
}

function renderFleetStatus(localOwner, remoteOwner) {
  const enemyAlive = remoteOwner.ships.filter((ship) => !ship.sunk).length;
  const playerAlive = localOwner.ships.filter((ship) => !ship.sunk).length;
  const compactBattle = elements.app.classList.contains("battle-compact");
  elements.enemyFleetText.textContent = compactBattle ? `敵 ${enemyAlive}隻` : `${enemyAlive} ships`;
  elements.playerFleetText.textContent = compactBattle ? `自 ${playerAlive}隻` : `${playerAlive} ships`;
}

function renderLogs() {
  elements.logList.innerHTML = gameState.logs
    .slice(0, 5)
    .map((log) => `<li>${escapeHtml(log)}</li>`)
    .join("");
}

function selectCard(cardId) {
  const localOwner = getLocalOwner();
  if ((localOwner.cards[cardId] ?? 0) <= 0) return;
  gameState.selectedCardId = cardId;
  addLog(`${getCard(cardId).name}を選択しました。`);
  render();
}

function previewPlacement(x, y) {
  const ship = SHIPS[gameState.placementIndex];
  const localOwner = getLocalOwner();
  if (gameState.phase !== "setup" || !ship) return;
  const valid = canPlaceShip(localOwner.board, ship, x, y, gameState.placementDirection);
  elements.playerBoard.querySelectorAll(".cell").forEach((cell) => {
    cell.classList.remove("placement-preview", "invalid-preview");
  });
  getShipCells(ship, x, y, gameState.placementDirection).forEach((cell) => {
    const el = elements.playerBoard.querySelector(`[data-x="${cell.x}"][data-y="${cell.y}"]`);
    if (!el) return;
    el.classList.add("placement-preview");
    if (!valid) el.classList.add("invalid-preview");
  });
}

function previewAttackPattern(x, y) {
  if (gameState.phase !== "playerTurn" || !isLocalTurn()) return;
  const card = getCard(gameState.selectedCardId);
  elements.enemyBoard.querySelectorAll(".cell").forEach((cell) => {
    cell.classList.remove("preview", "invalid-preview");
  });
  card.pattern.forEach(([dx, dy]) => {
    const el = elements.enemyBoard.querySelector(`[data-x="${x + dx}"][data-y="${y + dy}"]`);
    if (el) el.classList.add("preview");
  });
}

function playerAttack(x, y) {
  if (gameState.phase !== "playerTurn") return;
  const card = getCard(gameState.selectedCardId);
  const localOwner = getLocalOwner();
  if ((localOwner.cards[card.id] ?? 0) <= 0) return;
  if (!hasNewTarget(getRemoteOwner().board, card, x, y)) {
    addLog("その範囲はすべて攻撃済みです。");
    render();
    return;
  }
  localOwner.cards[card.id] -= 1;
  const result = resolveAttack(getRemoteOwner(), card, x, y, "remote");
  logAttackResult(card, result, x, y, "敵");
  if (checkGameOver()) {
    render();
    return;
  }
  gameState.phase = "cpuTurn";
  gameState.turn = "cpu";
  render();
  window.setTimeout(cpuTurn, 620);
}

function cpuTurn() {
  if (gameState.phase !== "cpuTurn") return;
  const card = pickCpuCard();
  const target = pickCpuTarget(card);
  const result = resolveAttack(gameState.player, card, target.x, target.y, "local");
  logAttackResult(card, result, target.x, target.y, "自軍", "CPUの");
  if (checkGameOver()) {
    render();
    return;
  }
  gameState.phase = "playerTurn";
  gameState.turn = "player";
  gameState.turnCount += 1;
  addLog("自分の攻撃です。");
  render();
}

function resolveAttack(targetOwner, card, x, y, recentOwner) {
  const result = { hits: 0, misses: 0, ignored: 0, sunkShips: [], attackedCells: [] };
  gameState.recentCells = [];
  card.pattern.forEach(([dx, dy]) => {
    const tx = x + dx;
    const ty = y + dy;
    if (!isInside(tx, ty)) return;
    const cell = targetOwner.board[ty][tx];
    if (cell.attacked) {
      result.ignored += 1;
      return;
    }
    cell.attacked = true;
    result.attackedCells.push({ x: tx, y: ty, hit: Boolean(cell.shipId), cardId: card.id });
    gameState.recentCells.push({ owner: recentOwner, x: tx, y: ty });
    if (cell.shipId) {
      cell.hit = true;
      result.hits += 1;
    } else {
      result.misses += 1;
    }
  });
  result.sunkShips = checkSunkShips(targetOwner);
  return result;
}

function logAttackResult(card, result, x, y, targetLabel, prefix = "") {
  const coord = formatCoord(x, y);
  addLog(`${prefix}${card.name}！ ${result.hits > 0 ? `${result.hits}マス命中！` : `${coord} は外れ！`}`);
  if (result.hits > 0) shakeBoard(prefix ? elements.playerBoard : elements.enemyBoard);
  result.sunkShips.forEach((ship) => addLog(`${targetLabel}の${ship.name}を撃沈！`));
}

function hasNewTarget(board, card, x, y) {
  return card.pattern
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((cell) => isInside(cell.x, cell.y))
    .some((cell) => !board[cell.y][cell.x].attacked);
}

function checkSunkShips(owner) {
  const newlySunk = [];
  owner.ships.forEach((ship) => {
    if (ship.sunk) return;
    const isSunk = ship.cells.every((cell) => owner.board[cell.y][cell.x].hit);
    if (!isSunk) return;
    ship.sunk = true;
    ship.cells.forEach((cell) => {
      owner.board[cell.y][cell.x].sunk = true;
    });
    newlySunk.push(ship);
  });
  return newlySunk;
}

function checkGameOver() {
  const playerLost = gameState.player.ships.length === SHIPS.length && gameState.player.ships.every((ship) => ship.sunk);
  const cpuLost = gameState.cpu.ships.length === SHIPS.length && gameState.cpu.ships.every((ship) => ship.sunk);
  if (cpuLost) {
    gameState.phase = "victory";
    gameState.turn = "done";
    addLog("敵艦隊をすべて撃沈。勝利！");
    showResult("勝利", "敵艦隊をすべて撃沈しました。");
    return true;
  }
  if (playerLost) {
    gameState.phase = "defeat";
    gameState.turn = "done";
    addLog("自軍艦隊が壊滅。敗北。");
    showResult("敗北", "自軍艦隊がすべて撃沈されました。");
    return true;
  }
  return false;
}

function showResult(title, message) {
  elements.resultTitle.textContent = title;
  elements.resultMessage.textContent = message;
}

function createOnlineRoom() {
  withFirebase(async () => {
    await leaveRoom(false);
    cleanupOldRooms();
    const roomId = await createUniqueRoomId();
    const hostOwner = createPreparedOwner("host", true);
    const now = Date.now();
    const roomData = {
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      hostId: onlineState.playerId,
      guestId: null,
      currentTurn: "host",
      turnCount: 1,
      winner: null,
      players: {
        host: { ...serializeOwner(hostOwner), name: "host", ready: false },
        guest: emptyRoomPlayer("guest")
      },
      public: {
        host: { attackedCells: [], sunkShips: [] },
        guest: { attackedCells: [], sunkShips: [] }
      },
      logs: ["部屋を作成しました。ゲストを待っています。"]
    };
    await roomRef(roomId).set(roomData);
    const verifySnapshot = await roomRef(roomId).get();
    if (!verifySnapshot.exists()) {
      throw new Error(`部屋作成後の確認に失敗しました。参照先: ${roomPath(roomId)}`);
    }
    elements.roomIdInput.value = roomId;
    setModeMessage(`部屋を作成しました。部屋ID: ${roomId}`);
    attachOnlineRoom(roomId, "host");
  }, "部屋作成に失敗しました。");
}

async function createUniqueRoomId() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const roomId = String(randomInt(100000, 999999));
    const snapshot = await roomRef(roomId).get();
    if (!snapshot.exists()) return roomId;
  }
  throw new Error("空き部屋IDを作成できませんでした。");
}

function joinOnlineRoom(roomIdValue) {
  const roomId = normalizeRoomId(roomIdValue);
  if (!/^\d{6}$/.test(roomId)) {
    setModeMessage("部屋IDは6桁の数字で入力してください。", true);
    return;
  }
  withFirebase(async () => {
    const beforeJoinSnapshot = await roomRef(roomId).get();
    if (!beforeJoinSnapshot.exists()) {
      throw new Error(await buildRoomNotFoundMessage(roomId));
    }

    let role = null;
    let joinError = "";
    const guestOwner = createPreparedOwner("guest", true);
    const result = await roomRef(roomId).transaction((roomData) => {
      if (!roomData) {
        joinError = awaitlessRoomNotFoundMessage(roomId);
        return;
      }

      if (roomData.hostId === onlineState.playerId) {
        role = "host";
        roomData.updatedAt = Date.now();
        return roomData;
      }

      if (roomData.guestId === onlineState.playerId) {
        role = "guest";
        roomData.updatedAt = Date.now();
        return roomData;
      }

      if (roomData.guestId) {
        joinError = "この部屋は満員です。";
        return;
      }

      role = "guest";
      roomData.guestId = onlineState.playerId;
      roomData.status = "setup";
      roomData.updatedAt = Date.now();
      roomData.players = roomData.players || {};
      roomData.players.guest = { ...serializeOwner(guestOwner), name: "guest", ready: false };
      roomData.public = roomData.public || {};
      roomData.public.guest = roomData.public.guest || { attackedCells: [], sunkShips: [] };
      roomData.logs = prependLog(roomData.logs, "ゲストが参加しました。");
      return roomData;
    });

    if (!result.committed || !role) {
      throw new Error(joinError || "部屋に入れませんでした。");
    }

    attachOnlineRoom(roomId, role);
  }, "部屋参加に失敗しました。");
}

async function buildRoomNotFoundMessage(roomId) {
  const roomsSnapshot = await roomRef("").get();
  const rooms = roomsSnapshot.val() || {};
  const roomIds = Object.keys(rooms).sort();
  const visibleRooms = roomIds.length ? roomIds.slice(-8).join(", ") : "なし";
  return `${awaitlessRoomNotFoundMessage(roomId)} 現在見えている部屋ID: ${visibleRooms}`;
}

function awaitlessRoomNotFoundMessage(roomId) {
  return `部屋が見つかりません。入力ID: ${roomId} / 参照先: ${roomPath(roomId)}`;
}

function listenRoom(roomId) {
  detachRoomListener();
  onlineState.roomRef = roomRef(roomId);
  onlineState.unsubscribe = onlineState.roomRef.on("value", (snapshot) => {
    const roomData = snapshot.val();
    onlineState.connected = Boolean(roomData);
    onlineState.syncing = false;
    if (!roomData) {
      addLog("部屋が削除されました。");
      backToMenu();
      return;
    }
    applyRemoteState(roomData);
  }, (error) => {
    onlineState.connected = false;
    setModeMessage(error.message, true);
    render();
  });
}

function attachOnlineRoom(roomId, role) {
  onlineState.roomId = roomId;
  onlineState.role = role;
  onlineState.opponentRole = role === "host" ? "guest" : "host";
  onlineState.connected = false;
  localStorage.setItem("navalBattleRoomId", roomId);
  localStorage.setItem("navalBattleRole", role);
  gameState.mode = "online";
  gameState.phase = "waiting";
  gameState.turn = role;
  listenRoom(roomId);
}

function updateRoomState(partialData) {
  if (!onlineState.roomId) return Promise.resolve();
  onlineState.syncing = true;
  render();
  return roomRef(onlineState.roomId).update({ ...partialData, updatedAt: Date.now() });
}

function setPlayerReady() {
  if (gameState.mode !== "online" || !onlineState.role) return;
  const localOwner = getLocalOwner();
  if (localOwner.ships.length !== SHIPS.length) {
    addLog("全艦を配置してから準備完了してください。");
    render();
    return;
  }
  localOwner.ready = true;
  withFirebase(async () => {
    await updateRoomState({
      [`players/${onlineState.role}`]: { ...serializeOwner(localOwner), name: onlineState.role, ready: true },
      logs: prependLog(onlineState.roomData?.logs, `${onlineState.role} が準備完了しました。`)
    });
    await startOnlineGameIfReady();
  }, "準備完了の同期に失敗しました。");
}

async function startOnlineGameIfReady() {
  const snapshot = await roomRef(onlineState.roomId).get();
  const roomData = snapshot.val();
  if (!roomData || !roomData.hostId || !roomData.guestId) return;
  if (roomData.players?.host?.ready && roomData.players?.guest?.ready && roomData.status !== "playing") {
    await roomRef(onlineState.roomId).update({
      status: "playing",
      currentTurn: "host",
      turnCount: 1,
      updatedAt: Date.now(),
      logs: prependLog(roomData.logs, "オンライン対戦開始。hostの攻撃です。")
    });
  }
}

function onlinePlayerAttack(x, y) {
  if (gameState.mode !== "online" || !isLocalTurn() || gameState.phase !== "playerTurn") return;
  const card = getCard(gameState.selectedCardId);
  const localOwner = getLocalOwner();
  const remoteOwner = getRemoteOwner();
  if ((localOwner.cards[card.id] ?? 0) <= 0) return;
  if (!hasNewTarget(remoteOwner.board, card, x, y)) {
    addLog("その範囲はすべて攻撃済みです。");
    render();
    return;
  }

  localOwner.cards[card.id] -= 1;
  const result = resolveAttack(remoteOwner, card, x, y, "remote");
  localOwner.attacks.push({
    cardId: card.id,
    x,
    y,
    turn: onlineState.roomData.turnCount,
    result: result.attackedCells,
    sunkShips: result.sunkShips.map((ship) => ship.id)
  });
  const nextTurn = onlineState.opponentRole;
  const winner = remoteOwner.ships.every((ship) => ship.sunk) ? onlineState.role : null;
  const nextStatus = winner ? "finished" : "playing";
  const nextTurnCount = onlineState.roomData.turnCount + (onlineState.role === "guest" ? 1 : 0);
  const logs = prependLog(
    onlineState.roomData.logs,
    `${onlineState.role} の${card.name}: ${result.hits > 0 ? `${result.hits}マス命中` : `${formatCoord(x, y)} は外れ`}`
  );
  const sunkLog = result.sunkShips.reduce((acc, ship) => prependLog(acc, `${onlineState.opponentRole} の${ship.name}を撃沈！`), logs);

  const updates = {
    status: nextStatus,
    currentTurn: winner ? onlineState.role : nextTurn,
    turnCount: nextTurnCount,
    winner,
    [`players/${onlineState.role}`]: { ...serializeOwner(localOwner), name: onlineState.role, ready: true },
    [`players/${onlineState.opponentRole}`]: { ...serializeOwner(remoteOwner), name: onlineState.opponentRole, ready: true },
    [`public/${onlineState.opponentRole}/attackedCells`]: publicAttackedCells(remoteOwner),
    [`public/${onlineState.opponentRole}/sunkShips`]: remoteOwner.ships.filter((ship) => ship.sunk).map((ship) => ship.id),
    logs: sunkLog
  };

  withFirebase(async () => {
    await updateRoomState(updates);
  }, "攻撃結果の同期に失敗しました。");
}

function applyRemoteState(roomData) {
  onlineState.roomData = roomData;
  if (!onlineState.role) {
    if (roomData.hostId === onlineState.playerId) onlineState.role = "host";
    if (roomData.guestId === onlineState.playerId) onlineState.role = "guest";
    onlineState.opponentRole = onlineState.role === "host" ? "guest" : "host";
  }
  const localRole = onlineState.role;
  const remoteRole = onlineState.opponentRole;
  if (!localRole || !roomData.players?.[localRole]) return;

  gameState.mode = "online";
  gameState.player = deserializeOwner(roomData.players[localRole]);
  gameState.cpu = deserializeOwner(roomData.players?.[remoteRole] || emptyRoomPlayer(remoteRole));
  gameState.logs = roomData.logs || [];
  gameState.turnCount = roomData.turnCount || 1;
  gameState.turn = roomData.currentTurn;
  gameState.placementIndex = Math.min(gameState.player.ships.length, SHIPS.length);

  if (roomData.status === "finished") {
    const won = roomData.winner === localRole;
    gameState.phase = won ? "victory" : "defeat";
    showResult(won ? "勝利" : "敗北", won ? "相手艦隊をすべて撃沈しました。" : "自軍艦隊がすべて撃沈されました。");
  } else if (roomData.status === "playing") {
    gameState.phase = roomData.currentTurn === localRole ? "playerTurn" : "cpuTurn";
  } else if (roomData.hostId && roomData.guestId) {
    gameState.phase = "setup";
  } else {
    gameState.phase = "waiting";
  }
  render();
}

async function leaveRoom(removeLocal = true) {
  detachRoomListener();
  if (!onlineState.roomId || !database) {
    if (removeLocal) clearOnlineLocalState();
    return;
  }
  const roomId = onlineState.roomId;
  const role = onlineState.role;
  try {
    if (role === "host") {
      await roomRef(roomId).remove();
    } else if (role === "guest") {
      await roomRef(roomId).update({
        guestId: null,
        status: "waiting",
        "players/guest": emptyRoomPlayer("guest"),
        updatedAt: Date.now(),
        logs: prependLog(onlineState.roomData?.logs, "guest が退出しました。")
      });
    }
  } catch (error) {
    setModeMessage(error.message, true);
  }
  if (removeLocal) backToMenu();
}

function cleanupOldRooms() {
  if (!database) return;
  roomRef("").get().then((snapshot) => {
    const rooms = snapshot.val() || {};
    const now = Date.now();
    Object.entries(rooms).forEach(([roomId, roomData]) => {
      if (roomData.updatedAt && now - roomData.updatedAt > ROOM_TTL_MS) {
        roomRef(roomId).remove();
      }
    });
  }).catch(() => {});
}

function getLocalOwner() {
  return gameState.player;
}

function getRemoteOwner() {
  return gameState.cpu;
}

function getCurrentPlayerRole() {
  return onlineState.role;
}

function isLocalTurn() {
  if (gameState.mode !== "online") return gameState.turn === "player";
  return onlineState.roomData?.currentTurn === onlineState.role;
}

function syncLocalPlayerIfOnline() {
  if (gameState.mode !== "online" || !onlineState.roomId || !onlineState.role) return;
  const localOwner = getLocalOwner();
  updateRoomState({
    [`players/${onlineState.role}`]: { ...serializeOwner(localOwner), name: onlineState.role }
  }).catch((error) => setModeMessage(error.message, true));
}

function serializeOwner(owner) {
  return {
    name: owner.name || "",
    ready: Boolean(owner.ready),
    board: owner.board,
    ships: owner.ships,
    cards: owner.cards,
    attacks: owner.attacks || []
  };
}

function deserializeOwner(owner) {
  return {
    name: owner?.name || "",
    ready: Boolean(owner?.ready),
    board: owner?.board || createEmptyBoard(),
    ships: owner?.ships || [],
    cards: owner?.cards || createCardCounts(),
    attacks: owner?.attacks || []
  };
}

function emptyRoomPlayer(name) {
  return {
    name,
    ready: false,
    board: createEmptyBoard(),
    ships: [],
    cards: createCardCounts(),
    attacks: []
  };
}

function publicAttackedCells(owner) {
  return owner.board.flat()
    .filter((cell) => cell.attacked)
    .map((cell) => ({ x: cell.x, y: cell.y, hit: cell.hit, sunk: cell.sunk }));
}

function prependLog(logs, message) {
  return [message, ...(logs || [])].slice(0, 20);
}

function initFirebase() {
  if (database) return true;
  if (!window.firebase) {
    setModeMessage("Firebase SDKを読み込めませんでした。ネットワーク接続を確認してください。", true);
    return false;
  }
  firebaseApp = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
  database = window.firebase.database(firebaseApp);
  return true;
}

function withFirebase(task, fallbackMessage) {
  if (!initFirebase()) return;
  onlineState.syncing = true;
  render();
  task().catch((error) => {
    setModeMessage(`${fallbackMessage} ${error.message}`, true);
  }).finally(() => {
    onlineState.syncing = false;
    render();
  });
}

function roomRef(roomId) {
  return database.ref(roomId ? `${GAME_PATH}/${roomId}` : GAME_PATH);
}

function roomPath(roomId) {
  return roomId ? `${GAME_PATH}/${roomId}` : GAME_PATH;
}

function detachRoomListener() {
  if (onlineState.roomRef && onlineState.unsubscribe) {
    onlineState.roomRef.off("value", onlineState.unsubscribe);
  }
  onlineState.roomRef = null;
  onlineState.unsubscribe = null;
}

function restoreOnlineRoom() {
  const roomId = localStorage.getItem("navalBattleRoomId");
  const role = localStorage.getItem("navalBattleRole");
  if (!roomId || !role) return;
  if (!initFirebase()) return;
  onlineState.roomId = roomId;
  onlineState.role = role;
  onlineState.opponentRole = role === "host" ? "guest" : "host";
  gameState.mode = "online";
  gameState.phase = "waiting";
  listenRoom(roomId);
}

function backToMenu() {
  clearOnlineLocalState();
  gameState.mode = null;
  gameState.phase = "menu";
  gameState.player = createEmptyOwner();
  gameState.cpu = createEmptyOwner();
  gameState.logs = [];
  render();
}

function clearOnlineLocalState() {
  detachRoomListener();
  localStorage.removeItem("navalBattleRoomId");
  localStorage.removeItem("navalBattleRole");
  onlineState.roomId = null;
  onlineState.role = null;
  onlineState.opponentRole = null;
  onlineState.connected = false;
  onlineState.roomData = null;
}

function addLog(message) {
  gameState.logs.unshift(message);
  gameState.logs = gameState.logs.slice(0, 20);
}

function restartGame() {
  if (gameState.mode === "online") {
    leaveRoom(true);
    return;
  }
  startCpuMode();
}

function pickCpuCard() {
  const roll = Math.random();
  if (roll > 0.9) return getCard("cross");
  if (roll > 0.82) return getCard("square2");
  return getCard("single");
}

function pickCpuTarget(card) {
  const available = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (hasNewTarget(gameState.player.board, card, x, y)) available.push({ x, y });
    }
  }
  return available[randomInt(0, available.length - 1)] || { x: 0, y: 0 };
}

function bindEvents() {
  elements.cpuModeButton.onclick = startCpuMode;
  elements.createRoomButton.onclick = createOnlineRoom;
  elements.joinRoomButton.onclick = () => joinOnlineRoom(elements.roomIdInput.value);
  elements.roomIdInput.oninput = () => {
    elements.roomIdInput.value = normalizeRoomId(elements.roomIdInput.value).slice(0, 6);
  };
  elements.roomIdInput.onkeydown = (event) => {
    if (event.key === "Enter") joinOnlineRoom(elements.roomIdInput.value);
  };
  elements.copyRoomButton.onclick = () => copyRoomId();
  elements.readyButton.onclick = setPlayerReady;
  elements.leaveRoomButton.onclick = () => leaveRoom(true);
  elements.randomButton.onclick = () => randomPlaceFleet("player", true);
  elements.clearPlacementButton.onclick = resetLocalPlacement;
  elements.directionButton.onclick = () => {
    gameState.placementDirection = gameState.placementDirection === "horizontal" ? "vertical" : "horizontal";
    render();
  };
  elements.startButton.onclick = startGame;
  elements.restartButton.onclick = restartGame;
  elements.resultRestartButton.onclick = restartGame;
}

function copyRoomId() {
  if (!onlineState.roomId) return;
  navigator.clipboard?.writeText(onlineState.roomId)
    .then(() => {
      elements.onlineMessage.textContent = "部屋IDをコピーしました。";
    })
    .catch(() => {
      elements.onlineMessage.textContent = `部屋ID: ${onlineState.roomId}`;
    });
}

function setModeMessage(message, isError = false) {
  elements.modeMessage.textContent = message;
  elements.onlineMessage.textContent = message;
  elements.modeMessage.classList.toggle("error", isError);
  elements.onlineMessage.classList.toggle("error", isError);
}

function getCard(cardId) {
  return ATTACK_CARDS.find((card) => card.id === cardId) || ATTACK_CARDS[0];
}

function getOrCreatePlayerId() {
  const existing = localStorage.getItem("navalBattlePlayerId");
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("navalBattlePlayerId", id);
  return id;
}

function normalizeRoomId(value) {
  return String(value || "").trim().replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  ).replace(/\D/g, "");
}

function isInside(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function letters() {
  return Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(65 + index));
}

function formatCoord(x, y) {
  return `${letters()[x]}-${y + 1}`;
}

function shakeBoard(board) {
  board.classList.add("shake");
  window.setTimeout(() => board.classList.remove("shake"), 280);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

window.addEventListener("pagehide", () => {
  if (onlineState.roomId && database) updateRoomState({ updatedAt: Date.now() });
});

initGame();
