"use strict";

// Constants
const TILE = 48;
const COLS = 15;
const ROWS = 11;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const TILE_EMPTY = 0;
const TILE_SOLID = 1;
const TILE_CRATE = 2;
const TILE_EXIT = 3;
const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];
const STORAGE = {
  score: "bomberLabHighScore",
  stage: "bomberLabBestStage",
  sp: "bomberLabLastSp"
};
const SP_LABELS = { mega: "Mega Bomb", freeze: "Time Stop", shield: "Shield" };
const ITEM_TYPES = ["bomb", "blast", "speed", "hp", "sp", "remote", "kick"];
const ITEM_LABELS = {
  bomb: "B+",
  blast: "F+",
  speed: "S+",
  hp: "HP",
  sp: "SP",
  remote: "RC",
  kick: "K"
};

// Game state
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = WIDTH;
canvas.height = HEIGHT;

const state = {
  mode: "title",
  stage: 1,
  score: 0,
  bestScore: Number(localStorage.getItem(STORAGE.score) || 0),
  bestStage: Number(localStorage.getItem(STORAGE.stage) || 1),
  selectedSp: localStorage.getItem(STORAGE.sp) || "mega",
  map: [],
  player: null,
  enemies: [],
  bombs: [],
  flames: [],
  items: [],
  particles: [],
  floating: [],
  exit: null,
  exitOpen: false,
  shake: 0,
  freezeTimer: 0,
  lastTime: 0,
  upgradePool: [],
  audio: null
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  bomb: false,
  dash: false,
  sp: false,
  lastAxis: { x: 0, y: 1 }
};

const els = {
  hp: document.getElementById("hpText"),
  score: document.getElementById("scoreText"),
  stage: document.getElementById("stageText"),
  enemy: document.getElementById("enemyText"),
  bomb: document.getElementById("bombText"),
  blast: document.getElementById("blastText"),
  sp: document.getElementById("spText"),
  spFill: document.getElementById("spFill"),
  title: document.getElementById("titleScreen"),
  upgrades: document.getElementById("upgradeScreen"),
  gameOver: document.getElementById("gameOverScreen"),
  upgradeChoices: document.getElementById("upgradeChoices"),
  bestScore: document.getElementById("bestScoreText"),
  bestStage: document.getElementById("bestStageText"),
  finalScore: document.getElementById("finalScoreText"),
  finalStage: document.getElementById("finalStageText"),
  bombButton: document.getElementById("bombButton"),
  dashButton: document.getElementById("dashButton"),
  spButton: document.getElementById("spButton"),
  stick: document.getElementById("stick"),
  knob: document.getElementById("stickKnob")
};

// Input
const keyMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right"
};

window.addEventListener("keydown", (event) => {
  if (keyMap[event.code]) {
    input[keyMap[event.code]] = true;
    event.preventDefault();
  }
  if (event.code === "Space") pressAction("bomb", event);
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") pressAction("dash", event);
  if (event.code === "KeyE") pressAction("sp", event);
});

window.addEventListener("keyup", (event) => {
  if (keyMap[event.code]) {
    input[keyMap[event.code]] = false;
    event.preventDefault();
  }
});

function pressAction(action, event) {
  input[action] = true;
  if (event) event.preventDefault();
}

function bindHoldButton(button, action) {
  const down = (event) => {
    event.preventDefault();
    input[action] = true;
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("click", down);
}

bindHoldButton(els.bombButton, "bomb");
bindHoldButton(els.dashButton, "dash");
bindHoldButton(els.spButton, "sp");

let stickPointer = null;
els.stick.addEventListener("pointerdown", (event) => {
  stickPointer = event.pointerId;
  els.stick.setPointerCapture(stickPointer);
  updateStick(event);
});
els.stick.addEventListener("pointermove", (event) => {
  if (event.pointerId === stickPointer) updateStick(event);
});
["pointerup", "pointercancel"].forEach((type) => {
  els.stick.addEventListener(type, () => {
    stickPointer = null;
    input.up = input.down = input.left = input.right = false;
    els.knob.style.transform = "translate(0, 0)";
  });
});

function updateStick(event) {
  const rect = els.stick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const max = rect.width * 0.29;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / len;
  const ny = dy / len;
  const mag = Math.min(max, len);
  els.knob.style.transform = `translate(${nx * mag}px, ${ny * mag}px)`;
  input.left = dx < -18;
  input.right = dx > 18;
  input.up = dy < -18;
  input.down = dy > 18;
  if (len > 18) input.lastAxis = Math.abs(nx) > Math.abs(ny) ? { x: Math.sign(nx), y: 0 } : { x: 0, y: Math.sign(ny) };
}

document.querySelectorAll("[data-sp]").forEach((button) => {
  button.classList.toggle("active", button.dataset.sp === state.selectedSp);
  button.addEventListener("click", () => {
    state.selectedSp = button.dataset.sp;
    localStorage.setItem(STORAGE.sp, state.selectedSp);
    document.querySelectorAll("[data-sp]").forEach((b) => b.classList.toggle("active", b === button));
  });
});

document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("retryButton").addEventListener("click", startGame);
document.getElementById("titleButton").addEventListener("click", showTitle);

// Map generation
function startGame() {
  ensureAudio();
  state.mode = "play";
  state.stage = 1;
  state.score = 0;
  state.player = {
    x: 1.5,
    y: 1.5,
    hp: 3,
    maxHp: 3,
    speed: 3.9,
    bombMax: 1,
    blast: 2,
    invuln: 0,
    dashCd: 0,
    sp: 0,
    spGain: 1,
    shield: 0,
    remote: 0,
    kick: 0
  };
  hideOverlays();
  generateStage();
  updateUi();
}

function generateStage() {
  state.map = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return TILE_SOLID;
    if (x % 2 === 0 && y % 2 === 0) return TILE_SOLID;
    return TILE_EMPTY;
  }));
  state.bombs = [];
  state.flames = [];
  state.items = [];
  state.particles = [];
  state.floating = [];
  state.enemies = [];
  state.exitOpen = false;
  state.freezeTimer = 0;

  const safe = new Set(["1,1", "2,1", "1,2", "3,1", "1,3"]);
  const crateChance = Math.min(0.46 + state.stage * 0.025, 0.68);
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (state.map[y][x] || safe.has(`${x},${y}`)) continue;
      if (Math.random() < crateChance) state.map[y][x] = TILE_CRATE;
    }
  }

  const empties = freeCells();
  state.exit = randomPick(empties.filter((c) => c.x + c.y > 9));
  const enemyCount = Math.min(4 + Math.floor(state.stage * 1.25), 18);
  for (let i = 0; i < enemyCount; i++) {
    const choices = freeCells().filter((c) => Math.abs(c.x - 1) + Math.abs(c.y - 1) > 5 && !state.enemies.some((e) => tileOf(e).x === c.x && tileOf(e).y === c.y));
    if (!choices.length) break;
    const c = randomPick(choices);
    const type = i % 3 === 0 ? "chaser" : i % 3 === 1 ? "dodger" : "normal";
    state.enemies.push({ x: c.x + 0.5, y: c.y + 0.5, type, dir: randomPick(DIRS), turn: 0, speed: 1.2 + state.stage * 0.08 + (type === "chaser" ? 0.25 : 0), alive: true });
  }
}

function freeCells() {
  const cells = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (state.map[y][x] === TILE_EMPTY) cells.push({ x, y });
    }
  }
  return cells;
}

function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Player
function updatePlayer(dt) {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.shield = Math.max(0, p.shield - dt);
  p.remote = Math.max(0, p.remote - dt);
  p.kick = Math.max(0, p.kick - dt);

  let ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (ax || ay) {
    const len = Math.hypot(ax, ay);
    ax /= len;
    ay /= len;
    input.lastAxis = Math.abs(ax) > Math.abs(ay) ? { x: Math.sign(ax), y: 0 } : { x: 0, y: Math.sign(ay) };
    moveEntity(p, ax * p.speed * dt, ay * p.speed * dt, true);
  }
  if (input.dash) {
    input.dash = false;
    dashPlayer();
  }
  if (input.bomb) {
    input.bomb = false;
    useBombButton();
  }
  if (input.sp) {
    input.sp = false;
    useSp();
  }

  collectItems();
  if (state.exitOpen && tileAt(p.x, p.y).x === state.exit.x && tileAt(p.x, p.y).y === state.exit.y) clearStage();
}

function dashPlayer() {
  const p = state.player;
  if (p.dashCd > 0) return;
  p.dashCd = p.dashCooldown || 1.7;
  moveEntity(p, input.lastAxis.x * 1.25, input.lastAxis.y * 1.25, true);
  makeParticles(p.x, p.y, "#ffffff", 8);
}

function moveEntity(ent, dx, dy, canKick) {
  tryMove(ent, dx, 0, canKick);
  tryMove(ent, 0, dy, canKick);
}

function tryMove(ent, dx, dy, canKick) {
  if (!dx && !dy) return;
  const nx = ent.x + dx;
  const ny = ent.y + dy;
  const blockedBomb = bombAt(nx, ny);
  if (blockedBomb) {
    if (canKick && state.player.kick > 0) kickBomb(blockedBomb, Math.sign(dx), Math.sign(dy));
    return;
  }
  if (!circleBlocked(nx, ny)) {
    ent.x = nx;
    ent.y = ny;
  }
}

function circleBlocked(x, y) {
  const r = 0.28;
  const points = [
    { x: x - r, y: y - r },
    { x: x + r, y: y - r },
    { x: x - r, y: y + r },
    { x: x + r, y: y + r }
  ];
  return points.some((p) => isBlocked(Math.floor(p.x), Math.floor(p.y)));
}

function isBlocked(x, y) {
  return x < 0 || y < 0 || x >= COLS || y >= ROWS || state.map[y][x] === TILE_SOLID || state.map[y][x] === TILE_CRATE;
}

function bombAt(x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return state.bombs.find((b) => !b.exploded && b.x === tx && b.y === ty);
}

function kickBomb(bomb, dx, dy) {
  if (!dx && !dy) return;
  bomb.slide = { x: dx, y: dy };
  makeFloat(bomb.x + 0.5, bomb.y + 0.2, "Kick");
}

// Bombs and flames
function useBombButton() {
  const remote = state.bombs.find((b) => b.remote && !b.exploded);
  if (remote) {
    explodeBomb(remote);
    return;
  }
  placeBomb();
}

function placeBomb() {
  const p = state.player;
  const t = tileAt(p.x, p.y);
  if (state.bombs.filter((b) => b.owner === "player" && !b.exploded).length >= p.bombMax) return;
  if (state.bombs.some((b) => b.x === t.x && b.y === t.y)) return;
  state.bombs.push({ x: t.x, y: t.y, timer: p.remote > 0 ? 8 : 2.25, blast: p.blast, owner: "player", remote: p.remote > 0, exploded: false, slide: null });
  playSound("place");
}

function updateBombs(dt) {
  for (const bomb of state.bombs) {
    if (bomb.exploded) continue;
    if (bomb.slide) slideBomb(bomb, dt);
    if (!bomb.remote) bomb.timer -= dt;
    if (bomb.timer <= 0) explodeBomb(bomb);
  }
  state.bombs = state.bombs.filter((b) => !b.remove);
}

function slideBomb(bomb, dt) {
  bomb.slideCarry = (bomb.slideCarry || 0) + dt * 5.5;
  if (bomb.slideCarry < 1) return;
  bomb.slideCarry = 0;
  const nx = bomb.x + bomb.slide.x;
  const ny = bomb.y + bomb.slide.y;
  if (isBlocked(nx, ny) || state.bombs.some((b) => b !== bomb && b.x === nx && b.y === ny)) {
    bomb.slide = null;
  } else {
    bomb.x = nx;
    bomb.y = ny;
  }
}

function explodeBomb(bomb) {
  if (bomb.exploded) return;
  bomb.exploded = true;
  bomb.remove = true;
  state.shake = 0.28;
  playSound("explode");
  const cells = [{ x: bomb.x, y: bomb.y }];
  for (const dir of DIRS) {
    for (let i = 1; i <= bomb.blast; i++) {
      const x = bomb.x + dir.x * i;
      const y = bomb.y + dir.y * i;
      if (state.map[y]?.[x] === TILE_SOLID) break;
      cells.push({ x, y });
      const chained = state.bombs.find((b) => !b.exploded && b.x === x && b.y === y);
      if (chained) setTimeout(() => explodeBomb(chained), 40);
      if (state.map[y]?.[x] === TILE_CRATE) {
        breakCrate(x, y);
        break;
      }
    }
  }
  for (const c of cells) {
    state.flames.push({ x: c.x, y: c.y, life: 0.45, max: 0.45 });
    makeParticles(c.x + 0.5, c.y + 0.5, "#ffcf5c", 5);
  }
  hitByFlames(cells);
}

function breakCrate(x, y) {
  state.map[y][x] = TILE_EMPTY;
  state.score += 8;
  if (state.exit && x === state.exit.x && y === state.exit.y && state.exitOpen) state.map[y][x] = TILE_EXIT;
  if (Math.random() < 0.32) state.items.push({ x, y, type: randomPick(ITEM_TYPES) });
}

function updateFlames(dt) {
  for (const f of state.flames) f.life -= dt;
  state.flames = state.flames.filter((f) => f.life > 0);
  if (state.flames.length) hitByFlames(state.flames);
}

function hitByFlames(cells) {
  const p = state.player;
  if (cells.some((c) => sameTile(c, tileAt(p.x, p.y)))) damagePlayer();
  for (const enemy of state.enemies) {
    if (enemy.alive && cells.some((c) => sameTile(c, tileAt(enemy.x, enemy.y)))) killEnemy(enemy);
  }
}

function damagePlayer() {
  const p = state.player;
  if (p.invuln > 0 || p.shield > 0) return;
  p.hp -= 1;
  p.invuln = 1.25;
  state.shake = 0.18;
  playSound("damage");
  if (p.hp <= 0) endGame();
}

function killEnemy(enemy) {
  enemy.alive = false;
  state.score += enemy.type === "chaser" ? 120 : enemy.type === "dodger" ? 150 : 90;
  state.player.sp = Math.min(100, state.player.sp + 12 * state.player.spGain);
  makeFloat(enemy.x, enemy.y, "+KO");
  if (state.enemies.every((e) => !e.alive)) openExit();
}

function openExit() {
  state.exitOpen = true;
  state.map[state.exit.y][state.exit.x] = TILE_EXIT;
  state.score += 300;
  makeFloat(state.exit.x + 0.5, state.exit.y + 0.5, "EXIT");
}

// Enemy AI
function updateEnemies(dt) {
  if (state.freezeTimer > 0) {
    state.freezeTimer -= dt;
    return;
  }
  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.turn -= dt;
    if (e.turn <= 0 || blockedAhead(e)) {
      e.dir = chooseEnemyDir(e);
      e.turn = 0.35 + Math.random() * 0.75;
    }
    moveEntity(e, e.dir.x * e.speed * dt, e.dir.y * e.speed * dt, false);
    if (dist(e, state.player) < 0.48) damagePlayer();
  }
}

function chooseEnemyDir(e) {
  const dirs = DIRS.filter((d) => !isBlocked(Math.floor(e.x + d.x * 0.62), Math.floor(e.y + d.y * 0.62)) && !bombAt(e.x + d.x * 0.8, e.y + d.y * 0.8));
  if (!dirs.length) return { x: 0, y: 0 };
  if (e.type === "chaser" && dist(e, state.player) < 6) {
    return dirs.sort((a, b) => tileDist(e.x + a.x, e.y + a.y, state.player.x, state.player.y) - tileDist(e.x + b.x, e.y + b.y, state.player.x, state.player.y))[0];
  }
  if (e.type === "dodger") {
    return dirs.sort((a, b) => dangerScore(e.x + a.x, e.y + a.y) - dangerScore(e.x + b.x, e.y + b.y))[0];
  }
  return randomPick(dirs);
}

function blockedAhead(e) {
  return isBlocked(Math.floor(e.x + e.dir.x * 0.62), Math.floor(e.y + e.dir.y * 0.62)) || bombAt(e.x + e.dir.x * 0.8, e.y + e.dir.y * 0.8);
}

function dangerScore(x, y) {
  const t = tileAt(x, y);
  let score = 0;
  for (const b of state.bombs) {
    if (b.x === t.x && b.y === t.y) score += 10;
    if (b.x === t.x || b.y === t.y) {
      const range = b.x === t.x ? Math.abs(b.y - t.y) : Math.abs(b.x - t.x);
      if (range <= b.blast && clearLine(b.x, b.y, t.x, t.y)) score += Math.max(1, 7 - range) + (2.5 - b.timer);
    }
  }
  return score + Math.random();
}

function clearLine(x1, y1, x2, y2) {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1 + dx;
  let y = y1 + dy;
  while (x !== x2 || y !== y2) {
    if (state.map[y][x] === TILE_SOLID || state.map[y][x] === TILE_CRATE) return false;
    x += dx;
    y += dy;
  }
  return true;
}

// Items
function collectItems() {
  const p = state.player;
  const pt = tileAt(p.x, p.y);
  for (const item of state.items) {
    if (item.taken || item.x !== pt.x || item.y !== pt.y) continue;
    item.taken = true;
    applyItem(item.type);
    playSound("item");
    makeFloat(p.x, p.y - 0.2, ITEM_LABELS[item.type]);
  }
  state.items = state.items.filter((i) => !i.taken);
}

function applyItem(type) {
  const p = state.player;
  if (type === "bomb") p.bombMax += 1;
  if (type === "blast") p.blast += 1;
  if (type === "speed") p.speed *= 1.08;
  if (type === "hp") p.hp = Math.min(p.maxHp, p.hp + 1);
  if (type === "sp") p.sp = Math.min(100, p.sp + 35);
  if (type === "remote") p.remote = 45;
  if (type === "kick") p.kick = 60;
  state.score += 40;
}

// SP
function useSp() {
  const p = state.player;
  if (p.sp < 100) return;
  p.sp = 0;
  if (state.selectedSp === "mega") {
    const c = tileAt(p.x, p.y);
    for (let y = c.y - 2; y <= c.y + 2; y++) {
      for (let x = c.x - 2; x <= c.x + 2; x++) {
        if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1 && state.map[y][x] !== TILE_SOLID) {
          state.flames.push({ x, y, life: 0.65, max: 0.65 });
          if (state.map[y][x] === TILE_CRATE) breakCrate(x, y);
        }
      }
    }
    hitByFlames(state.flames);
    state.shake = 0.42;
    playSound("explode");
  } else if (state.selectedSp === "freeze") {
    state.freezeTimer = 4.2;
    makeFloat(p.x, p.y, "STOP");
  } else {
    p.shield = 6;
    makeFloat(p.x, p.y, "SHIELD");
  }
}

// Roguelite upgrades
function clearStage() {
  state.mode = "upgrade";
  playSound("clear");
  state.score += 500 + state.stage * 120;
  state.bestStage = Math.max(state.bestStage, state.stage + 1);
  saveRecords();
  showUpgrades();
}

function showUpgrades() {
  const choices = [
    { name: "Max HP +1", desc: "最大HPと現在HPを増やす", apply: () => { state.player.maxHp += 1; state.player.hp += 1; } },
    { name: "Bomb +1", desc: "同時に置ける爆弾数を増やす", apply: () => { state.player.bombMax += 1; } },
    { name: "Blast +1", desc: "爆風が1マス長くなる", apply: () => { state.player.blast += 1; } },
    { name: "Move Speed +10%", desc: "移動速度を上げる", apply: () => { state.player.speed *= 1.1; } },
    { name: "SP Gain Up", desc: "敵撃破時のSP増加量を上げる", apply: () => { state.player.spGain += 0.25; } },
    { name: "Dash Cooldown -15%", desc: "ダッシュ再使用を短くする", apply: () => { state.player.dashCooldown = (state.player.dashCooldown || 1.7) * 0.85; } }
  ].sort(() => Math.random() - 0.5).slice(0, 3);
  els.upgradeChoices.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "upgrade-card";
    button.type = "button";
    button.innerHTML = `<strong>${choice.name}</strong><span>${choice.desc}</span>`;
    button.addEventListener("click", () => {
      choice.apply();
      state.stage += 1;
      state.mode = "play";
      hideOverlays();
      generateStage();
    });
    els.upgradeChoices.appendChild(button);
  });
  els.upgrades.classList.add("show");
}

// Drawing
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (state.shake > 0) {
    const s = state.shake * 18;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawMap();
  drawItems();
  drawBombs();
  drawFlames();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawFloating();
  ctx.restore();
}

function drawMap() {
  ctx.fillStyle = "#8ed3b5";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#9ee1c5" : "#94d8bd";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(31, 81, 76, 0.08)";
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      const tile = state.map[y][x];
      if (tile === TILE_SOLID) block(x, y, "#587083", "#405467");
      if (tile === TILE_CRATE) crate(x, y);
      if (tile === TILE_EXIT) exitTile(x, y);
    }
  }
}

function block(x, y, a, b) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = a;
  ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
  ctx.fillStyle = b;
  ctx.fillRect(px + 8, py + 8, TILE - 16, 8);
  ctx.fillRect(px + 8, py + 26, TILE - 16, 8);
}

function crate(x, y) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = "#c07a38";
  ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
  ctx.fillStyle = "#e2a251";
  ctx.fillRect(px + 10, py + 10, TILE - 20, 8);
  ctx.fillStyle = "#7a4626";
  ctx.fillRect(px + 12, py + 12, 6, TILE - 24);
  ctx.fillRect(px + TILE - 18, py + 12, 6, TILE - 24);
}

function exitTile(x, y) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = "#263238";
  ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
  ctx.fillStyle = "#57e389";
  ctx.fillRect(px + 15, py + 15, TILE - 30, TILE - 30);
}

function drawPlayer() {
  const p = state.player;
  if (!p) return;
  const px = p.x * TILE;
  const py = p.y * TILE;
  ctx.globalAlpha = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 ? 0.45 : 1;
  ctx.fillStyle = p.shield > 0 ? "rgba(47, 128, 237, 0.22)" : "transparent";
  ctx.beginPath();
  ctx.arc(px, py, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f9f871";
  ctx.fillRect(px - 15, py - 16, 30, 32);
  ctx.fillStyle = "#2f80ed";
  ctx.fillRect(px - 12, py + 6, 24, 15);
  ctx.fillStyle = "#14202a";
  ctx.fillRect(px - 8, py - 6, 5, 5);
  ctx.fillRect(px + 4, py - 6, 5, 5);
  ctx.globalAlpha = 1;
}

function drawEnemies() {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const px = e.x * TILE;
    const py = e.y * TILE;
    ctx.fillStyle = e.type === "normal" ? "#ff9f1c" : e.type === "chaser" ? "#ef476f" : "#7b61ff";
    ctx.fillRect(px - 16, py - 16, 32, 32);
    ctx.fillStyle = "#fff";
    ctx.fillRect(px - 9, py - 5, 6, 6);
    ctx.fillRect(px + 3, py - 5, 6, 6);
  }
}

function drawBombs() {
  for (const b of state.bombs) {
    const px = (b.x + 0.5) * TILE;
    const py = (b.y + 0.5) * TILE;
    ctx.fillStyle = b.remote ? "#2d3142" : "#15191f";
    ctx.beginPath();
    ctx.arc(px, py + 3, 16 + Math.sin(performance.now() / 90) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.remote ? "#57e389" : "#ffcf5c";
    ctx.fillRect(px - 4, py - 20, 8, 8);
  }
}

function drawFlames() {
  for (const f of state.flames) {
    const a = Math.max(0, f.life / f.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(f.x * TILE + 7, f.y * TILE + 7, TILE - 14, TILE - 14);
    ctx.fillStyle = "#ef476f";
    ctx.fillRect(f.x * TILE + 15, f.y * TILE + 15, TILE - 30, TILE - 30);
  }
  ctx.globalAlpha = 1;
}

function drawItems() {
  for (const item of state.items) {
    const px = item.x * TILE;
    const py = item.y * TILE;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px + 10, py + 10, TILE - 20, TILE - 20);
    ctx.strokeStyle = "#2f80ed";
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 10, py + 10, TILE - 20, TILE - 20);
    ctx.fillStyle = "#14202a";
    ctx.font = "900 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(ITEM_LABELS[item.type], px + TILE / 2, py + 30);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x * TILE, p.y * TILE, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloating() {
  ctx.textAlign = "center";
  ctx.font = "900 15px Segoe UI";
  for (const f of state.floating) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = "#14202a";
    ctx.fillText(f.text, f.x * TILE, f.y * TILE);
  }
  ctx.globalAlpha = 1;
}

// UI, save, sound
function updateUi() {
  if (!state.player) return;
  const p = state.player;
  els.hp.textContent = `${p.hp}/${p.maxHp}`;
  els.score.textContent = Math.floor(state.score);
  els.stage.textContent = state.stage;
  els.enemy.textContent = state.enemies.filter((e) => e.alive).length;
  els.bomb.textContent = `${state.bombs.filter((b) => b.owner === "player" && !b.exploded).length}/${p.bombMax}`;
  els.blast.textContent = p.blast;
  els.sp.textContent = `${Math.floor(p.sp)}%`;
  els.spFill.style.width = `${Math.min(100, p.sp)}%`;
  els.spButton.disabled = p.sp < 100;
  els.dashButton.disabled = p.dashCd > 0;
}

function showTitle() {
  state.mode = "title";
  hideOverlays();
  els.bestScore.textContent = state.bestScore;
  els.bestStage.textContent = state.bestStage;
  els.title.classList.add("show");
}

function hideOverlays() {
  els.title.classList.remove("show");
  els.upgrades.classList.remove("show");
  els.gameOver.classList.remove("show");
}

function endGame() {
  state.mode = "gameover";
  saveRecords();
  els.finalScore.textContent = Math.floor(state.score);
  els.finalStage.textContent = state.stage;
  els.gameOver.classList.add("show");
}

function saveRecords() {
  state.bestScore = Math.max(state.bestScore, Math.floor(state.score));
  state.bestStage = Math.max(state.bestStage, state.stage);
  localStorage.setItem(STORAGE.score, state.bestScore);
  localStorage.setItem(STORAGE.stage, state.bestStage);
  localStorage.setItem(STORAGE.sp, state.selectedSp);
}

function ensureAudio() {
  if (state.audio) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    state.audio = new AudioCtx();
  } catch {
    state.audio = null;
  }
}

function playSound(type) {
  if (!state.audio) return;
  const freq = { place: 220, explode: 90, item: 660, damage: 140, clear: 880 }[type] || 300;
  const duration = { explode: 0.22, clear: 0.3 }[type] || 0.11;
  try {
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.type = type === "explode" ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(freq, state.audio.currentTime);
    gain.gain.setValueAtTime(0.06, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audio.currentTime + duration);
    osc.connect(gain).connect(state.audio.destination);
    osc.start();
    osc.stop(state.audio.currentTime + duration);
  } catch {
    state.audio = null;
  }
}

// Main loop
function loop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  if (state.mode === "play") {
    updatePlayer(dt);
    updateBombs(dt);
    updateFlames(dt);
    updateEnemies(dt);
    updateEffects(dt);
    updateUi();
  }
  draw();
  requestAnimationFrame(loop);
}

function updateEffects(dt) {
  state.shake = Math.max(0, state.shake - dt);
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floating) {
    f.life -= dt;
    f.y -= dt * 0.7;
  }
  state.floating = state.floating.filter((f) => f.life > 0);
}

function makeParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, size: 4 + Math.random() * 5, color, life: 0.35, max: 0.35 });
  }
}

function makeFloat(x, y, text) {
  state.floating.push({ x, y, text, life: 0.9, max: 0.9 });
}

function tileAt(x, y) {
  return { x: Math.floor(x), y: Math.floor(y) };
}

function tileOf(e) {
  return tileAt(e.x, e.y);
}

function sameTile(a, b) {
  return a.x === b.x && a.y === b.y;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function tileDist(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

window.addEventListener("resize", draw);
showTitle();
generateStage();
requestAnimationFrame(loop);
