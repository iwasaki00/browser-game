"use strict";

const BOARD_SIZE = 10;
const SPRITE_SIZE = 32;
const SPRITES = {
  water: { x: 0, y: 0, w: 32, h: 32 },
  miss: { x: 32, y: 0, w: 32, h: 32 },
  hit: { x: 64, y: 0, w: 32, h: 32 },
  explosion: { x: 96, y: 0, w: 32, h: 32 },
  shipFront: { x: 0, y: 32, w: 32, h: 32 },
  shipMiddle: { x: 32, y: 32, w: 32, h: 32 },
  shipBack: { x: 64, y: 32, w: 32, h: 32 },
  submarine: { x: 96, y: 32, w: 32, h: 32 },
  cursor: { x: 0, y: 64, w: 32, h: 32 },
  target: { x: 32, y: 64, w: 32, h: 32 },
  sonar: { x: 64, y: 64, w: 32, h: 32 },
  splash: { x: 96, y: 64, w: 32, h: 32 }
};

const SHIPS = [
  { id: "battleship", name: "戦艦", size: 5 },
  { id: "cruiser", name: "巡洋艦", size: 4 },
  { id: "submarine", name: "潜水艦", size: 3 },
  { id: "destroyer", name: "駆逐艦", size: 3 },
  { id: "patrol", name: "哨戒艇", size: 2 }
];

const ATTACK_CARDS = [
  {
    id: "single",
    name: "通常砲撃",
    description: "指定した1マス",
    pattern: [[0, 0]],
    count: 99
  },
  {
    id: "cross",
    name: "十字爆弾",
    description: "中心から十字5マス",
    pattern: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
    count: 3
  },
  {
    id: "square2",
    name: "爆雷",
    description: "左上基準の2×2",
    pattern: [[0, 0], [1, 0], [0, 1], [1, 1]],
    count: 3
  },
  {
    id: "line3",
    name: "魚雷",
    description: "横3マス",
    pattern: [[-1, 0], [0, 0], [1, 0]],
    count: 3
  },
  {
    id: "square3",
    name: "絨毯爆撃",
    description: "中心から3×3",
    pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    count: 1
  }
];

const phaseLabels = {
  setup: "艦隊配置中",
  playerTurn: "自分の攻撃",
  cpuTurn: "CPUの攻撃",
  victory: "勝利",
  defeat: "敗北"
};

const gameState = {
  phase: "setup",
  turn: "player",
  turnCount: 1,
  selectedCardId: "single",
  placementDirection: "horizontal",
  player: {
    board: [],
    ships: [],
    attacks: [],
    cards: {}
  },
  cpu: {
    board: [],
    ships: [],
    attacks: [],
    cards: {}
  },
  logs: [],
  recentCells: []
};

let spriteImage = new Image();
spriteImage.src = "assets/naval_sprites.png";
spriteImage.onerror = () => {
  spriteImage = null;
};

const elements = {
  app: document.getElementById("app"),
  phaseText: document.getElementById("phaseText"),
  turnText: document.getElementById("turnText"),
  messageText: document.getElementById("messageText"),
  setupPanel: document.getElementById("setupPanel"),
  randomButton: document.getElementById("randomButton"),
  directionButton: document.getElementById("directionButton"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
  resultRestartButton: document.getElementById("resultRestartButton"),
  cards: document.getElementById("cards"),
  enemyBoard: document.getElementById("enemyBoard"),
  playerBoard: document.getElementById("playerBoard"),
  enemyFleetText: document.getElementById("enemyFleetText"),
  playerFleetText: document.getElementById("playerFleetText"),
  logList: document.getElementById("logList"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultTitle: document.getElementById("resultTitle"),
  resultMessage: document.getElementById("resultMessage")
};

function initGame() {
  resetOwner("player");
  resetOwner("cpu");
  gameState.phase = "setup";
  gameState.turn = "player";
  gameState.turnCount = 1;
  gameState.selectedCardId = "single";
  gameState.placementDirection = "horizontal";
  gameState.logs = [];
  gameState.recentCells = [];

  randomPlaceFleet("player");
  randomPlaceFleet("cpu");
  addLog("艦隊をランダム配置しました。ゲーム開始を押してください。");
  bindEvents();
  render();
}

function resetOwner(owner) {
  gameState[owner].board = createEmptyBoard();
  gameState[owner].ships = [];
  gameState[owner].attacks = [];
  gameState[owner].cards = createCardCounts();
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => ({
      x,
      y,
      shipId: null,
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

function randomPlaceFleet(owner) {
  const target = gameState[owner];
  target.board = createEmptyBoard();
  target.ships = [];

  SHIPS.forEach((ship) => {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 500) {
      const direction = Math.random() > 0.5 ? "horizontal" : "vertical";
      const x = randomInt(0, BOARD_SIZE - 1);
      const y = randomInt(0, BOARD_SIZE - 1);

      if (canPlaceShip(target.board, ship, x, y, direction)) {
        placeShip(target.board, ship, x, y, direction);
        target.ships.push({
          id: ship.id,
          name: ship.name,
          size: ship.size,
          direction,
          cells: getShipCells(ship, x, y, direction),
          sunk: false
        });
        placed = true;
      }

      attempts += 1;
    }
  });

  if (owner === "player") {
    addLog("自軍艦隊を再配置しました。");
  }

  render();
}

function canPlaceShip(board, ship, x, y, direction) {
  return getShipCells(ship, x, y, direction).every((cell) => {
    return isInside(cell.x, cell.y) && !board[cell.y][cell.x].shipId;
  });
}

function placeShip(board, ship, x, y, direction) {
  getShipCells(ship, x, y, direction).forEach((cell) => {
    board[cell.y][cell.x].shipId = ship.id;
  });
}

function getShipCells(ship, x, y, direction) {
  return Array.from({ length: ship.size }, (_, index) => ({
    x: direction === "horizontal" ? x + index : x,
    y: direction === "vertical" ? y + index : y
  }));
}

function render() {
  elements.phaseText.textContent = phaseLabels[gameState.phase];
  elements.turnText.textContent = String(gameState.turnCount);
  elements.messageText.textContent = gameState.logs[0] || "攻撃カードを選んで敵海域をタップ";
  elements.setupPanel.hidden = gameState.phase !== "setup";
  elements.resultOverlay.classList.toggle("show", gameState.phase === "victory" || gameState.phase === "defeat");
  elements.directionButton.textContent = `向き: ${gameState.placementDirection === "horizontal" ? "横" : "縦"}`;

  renderCoords();
  renderCards();
  renderBoard("cpu", elements.enemyBoard);
  renderBoard("player", elements.playerBoard);
  renderFleetStatus();
  renderLogs();
}

function renderCoords() {
  document.querySelectorAll(".coords.cols").forEach((el) => {
    el.innerHTML = letters().map((letter) => `<span>${letter}</span>`).join("");
  });
  document.querySelectorAll(".coords.rows").forEach((el) => {
    el.innerHTML = Array.from({ length: BOARD_SIZE }, (_, index) => `<span>${index + 1}</span>`).join("");
  });
}

function renderBoard(owner, container) {
  const showShips = owner === "player";
  const board = gameState[owner].board;
  container.innerHTML = "";

  board.flat().forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = getCellClass(owner, cell, showShips);
    button.dataset.x = cell.x;
    button.dataset.y = cell.y;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${letters()[cell.x]}-${cell.y + 1}`);

    if (owner === "cpu") {
      button.addEventListener("pointerenter", () => previewAttackPattern(cell.x, cell.y));
      button.addEventListener("focus", () => previewAttackPattern(cell.x, cell.y));
      button.addEventListener("click", () => playerAttack(cell.x, cell.y));
    }

    container.appendChild(button);
  });
}

function getCellClass(owner, cell, showShips) {
  const classes = ["cell"];
  if (showShips && cell.shipId) classes.push("ship");
  if (cell.attacked) classes.push(cell.hit ? "hit" : "miss", "attacked");
  if (cell.sunk) classes.push("sunk");
  if (gameState.recentCells.some((recent) => recent.owner === owner && recent.x === cell.x && recent.y === cell.y)) {
    classes.push("recent");
  }
  return classes.join(" ");
}

function renderCards() {
  elements.cards.innerHTML = "";
  const cards = gameState.player.cards;

  ATTACK_CARDS.forEach((card) => {
    const count = cards[card.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card-button${gameState.selectedCardId === card.id ? " active" : ""}`;
    button.disabled = gameState.phase !== "playerTurn" || count <= 0;
    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span><b>${count}</b>`;
    button.addEventListener("click", () => selectCard(card.id));
    elements.cards.appendChild(button);
  });
}

function renderFleetStatus() {
  const enemyAlive = gameState.cpu.ships.filter((ship) => !ship.sunk).length;
  const playerAlive = gameState.player.ships.filter((ship) => !ship.sunk).length;
  elements.enemyFleetText.textContent = `${enemyAlive} ships`;
  elements.playerFleetText.textContent = `${playerAlive} ships`;
}

function renderLogs() {
  elements.logList.innerHTML = gameState.logs
    .slice(0, 5)
    .map((log) => `<li>${escapeHtml(log)}</li>`)
    .join("");
}

function selectCard(cardId) {
  if (gameState.player.cards[cardId] <= 0) return;
  gameState.selectedCardId = cardId;
  addLog(`${getCard(cardId).name}を選択しました。`);
  render();
}

function previewAttackPattern(x, y) {
  if (gameState.phase !== "playerTurn") return;
  const card = getCard(gameState.selectedCardId);
  const targetCells = card.pattern.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
  elements.enemyBoard.querySelectorAll(".cell").forEach((cell) => {
    cell.classList.remove("preview", "invalid-preview");
  });
  targetCells.forEach((cell) => {
    const el = elements.enemyBoard.querySelector(`[data-x="${cell.x}"][data-y="${cell.y}"]`);
    if (el) el.classList.add("preview");
  });
}

function playerAttack(x, y) {
  if (gameState.phase !== "playerTurn") return;
  const card = getCard(gameState.selectedCardId);
  if (gameState.player.cards[card.id] <= 0) return;

  const validTargets = card.pattern
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((cell) => isInside(cell.x, cell.y));
  const hasNewTarget = validTargets.some((cell) => !gameState.cpu.board[cell.y][cell.x].attacked);
  if (!hasNewTarget) {
    addLog("その範囲はすべて攻撃済みです。");
    render();
    return;
  }

  gameState.player.cards[card.id] -= 1;
  const result = resolveAttack("cpu", card, x, y);
  const coord = formatCoord(x, y);
  addLog(`${card.name}！ ${result.hits > 0 ? `${result.hits}マス命中！` : `${coord} は外れ！`}`);

  if (result.hits > 0) shakeBoard(elements.enemyBoard);
  result.sunkShips.forEach((ship) => {
    addLog(`敵の${ship.name}を撃沈！`);
    elements.enemyBoard.classList.add("blast");
    window.setTimeout(() => elements.enemyBoard.classList.remove("blast"), 620);
  });

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
  const result = resolveAttack("player", card, target.x, target.y);

  addLog(`CPUの${card.name}、${result.hits > 0 ? `${result.hits}マス命中！` : "外れ！"}`);

  if (result.hits > 0) shakeBoard(elements.playerBoard);
  result.sunkShips.forEach((ship) => {
    addLog(`自軍の${ship.name}が撃沈された！`);
    elements.playerBoard.classList.add("blast");
    window.setTimeout(() => elements.playerBoard.classList.remove("blast"), 620);
  });

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

function resolveAttack(targetOwner, card, x, y) {
  const owner = gameState[targetOwner];
  const attackedOwner = targetOwner === "cpu" ? "cpu" : "player";
  const result = { hits: 0, misses: 0, ignored: 0, sunkShips: [] };
  gameState.recentCells = [];

  card.pattern.forEach(([dx, dy]) => {
    const tx = x + dx;
    const ty = y + dy;
    if (!isInside(tx, ty)) return;

    const cell = owner.board[ty][tx];
    if (cell.attacked) {
      result.ignored += 1;
      return;
    }

    cell.attacked = true;
    owner.attacks.push({ x: tx, y: ty, cardId: card.id, turn: gameState.turnCount });
    gameState.recentCells.push({ owner: attackedOwner, x: tx, y: ty });

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

function checkSunkShips(owner) {
  const target = gameState[owner];
  const newlySunk = [];

  target.ships.forEach((ship) => {
    if (ship.sunk) return;
    const isSunk = ship.cells.every((cell) => target.board[cell.y][cell.x].hit);
    if (!isSunk) return;

    ship.sunk = true;
    ship.cells.forEach((cell) => {
      target.board[cell.y][cell.x].sunk = true;
    });
    newlySunk.push(ship);
  });

  return newlySunk;
}

function checkGameOver() {
  const playerLost = gameState.player.ships.every((ship) => ship.sunk);
  const cpuLost = gameState.cpu.ships.every((ship) => ship.sunk);

  if (cpuLost) {
    gameState.phase = "victory";
    gameState.turn = "done";
    addLog("敵艦隊をすべて撃沈。勝利！");
    elements.resultTitle.textContent = "勝利";
    elements.resultMessage.textContent = "敵艦隊をすべて撃沈しました。";
    return true;
  }

  if (playerLost) {
    gameState.phase = "defeat";
    gameState.turn = "done";
    addLog("自軍艦隊が壊滅。敗北。");
    elements.resultTitle.textContent = "敗北";
    elements.resultMessage.textContent = "自軍艦隊がすべて撃沈されました。";
    return true;
  }

  return false;
}

function addLog(message) {
  gameState.logs.unshift(message);
  gameState.logs = gameState.logs.slice(0, 20);
}

function restartGame() {
  initGame();
}

function startGame() {
  gameState.phase = "playerTurn";
  gameState.turn = "player";
  gameState.turnCount = 1;
  addLog("戦闘開始。敵海域を攻撃してください。");
  render();
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
      const cells = card.pattern
        .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
        .filter((cell) => isInside(cell.x, cell.y));
      if (cells.some((cell) => !gameState.player.board[cell.y][cell.x].attacked)) {
        available.push({ x, y });
      }
    }
  }
  return available[randomInt(0, available.length - 1)] || { x: 0, y: 0 };
}

function bindEvents() {
  elements.randomButton.onclick = () => randomPlaceFleet("player");
  elements.directionButton.onclick = () => {
    gameState.placementDirection = gameState.placementDirection === "horizontal" ? "vertical" : "horizontal";
    render();
  };
  elements.startButton.onclick = startGame;
  elements.restartButton.onclick = restartGame;
  elements.resultRestartButton.onclick = restartGame;
}

function getCard(cardId) {
  return ATTACK_CARDS.find((card) => card.id === cardId) || ATTACK_CARDS[0];
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
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

initGame();
