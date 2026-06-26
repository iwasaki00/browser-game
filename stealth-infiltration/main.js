"use strict";

const TILE = 32;
const GameState = {
  TITLE: "title",
  PLAYING: "playing",
  GAME_OVER: "game_over",
  STAGE_CLEAR: "stage_clear",
  ALL_CLEAR: "all_clear"
};

const SPRITES = {
  player: {
    down: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    left: [{ x: 4, y: 1 }, { x: 5, y: 1 }],
    right: [{ x: 7, y: 1 }, { x: 8, y: 1 }],
    up: [{ x: 10, y: 1 }, { x: 11, y: 1 }],
    crouch: [{ x: 14, y: 1 }, { x: 15, y: 1 }],
    crouchMove: [{ x: 17, y: 1 }, { x: 18, y: 1 }],
    dash: [{ x: 22, y: 1 }, { x: 23, y: 1 }]
  },
  guard: {
    down: [{ x: 1, y: 6 }, { x: 2, y: 6 }],
    left: [{ x: 4, y: 6 }, { x: 5, y: 6 }],
    right: [{ x: 7, y: 6 }, { x: 8, y: 6 }],
    up: [{ x: 10, y: 6 }, { x: 11, y: 6 }],
    alert: { x: 20, y: 6 },
    found: { x: 22, y: 6 }
  },
  effect: {
    coneGreen: { x: 1, y: 12 },
    coneAmber: { x: 4, y: 12 },
    coneRed: { x: 8, y: 12 },
    found: { x: 12, y: 12 },
    alert: { x: 16, y: 12 },
    sound: [{ x: 22, y: 12 }, { x: 24, y: 12 }, { x: 26, y: 12 }]
  },
  tile: {
    floor: { x: 22, y: 6 },
    floor2: { x: 23, y: 6 },
    wall: { x: 28, y: 6 },
    metal: { x: 31, y: 6 },
    concrete: { x: 27, y: 7 },
    path: { x: 30, y: 7 }
  },
  object: {
    crate: { x: 0, y: 16 },
    barrel: { x: 12, y: 16 },
    locker: { x: 0, y: 22 },
    desk: { x: 11, y: 18 },
    plant: { x: 17, y: 18 },
    door: { x: 17, y: 16 },
    secureDoor: { x: 22, y: 16 },
    terminal: { x: 17, y: 19 },
    server: { x: 27, y: 22 },
    camera: { x: 0, y: 26 },
    laser: { x: 15, y: 26 },
    key: { x: 20, y: 23 },
    data: { x: 22, y: 29 },
    goal: { x: 26, y: 31 }
  },
  ui: {
    player: { x: 0, y: 30 },
    enemy: { x: 3, y: 30 },
    vision: { x: 6, y: 30 },
    camera: { x: 11, y: 30 },
    door: { x: 14, y: 30 },
    terminal: { x: 16, y: 30 },
    goal: { x: 19, y: 30 },
    data: { x: 29, y: 23 }
  }
};

const STAGES = [
  {
    name: "Stage 1: 訓練施設",
    objective: "視界を避けてデータを回収",
    player: [2, 2],
    requireData: true,
    map: [
      "########################",
      "#P....C.....#..........#",
      "#.....C.....#....a.....#",
      "#...........#..........#",
      "#..####..####..####..g.#",
      "#...............#......#",
      "#..L.....t......s......#",
      "#..........C....#......#",
      "#...............#......#",
      "########################"
    ],
    guards: [
      { route: [[8, 7], [13, 7], [13, 2], [8, 2]], wait: 0.6 }
    ],
    cameras: [],
    lasers: []
  },
  {
    name: "Stage 2: 倉庫エリア",
    objective: "カードキーでロック扉を開ける",
    player: [2, 8],
    requireData: true,
    map: [
      "############################",
      "#......C.....#.....a......g#",
      "#..C..###....#..#########..#",
      "#......#.....s............C#",
      "#..L...#.....#..C..C.......#",
      "#......#..t..#.............#",
      "#..C...#.....########..#####",
      "#......d...................#",
      "#P..k..#....C..............#",
      "############################"
    ],
    guards: [
      { route: [[6, 1], [6, 6], [2, 6], [2, 1]], wait: 0.45 },
      { route: [[18, 4], [25, 4], [25, 8], [18, 8]], wait: 0.55 }
    ],
    cameras: [],
    lasers: []
  },
  {
    name: "Stage 3: 研究施設",
    objective: "監視装置を止めて脱出",
    player: [2, 12],
    requireData: true,
    map: [
      "################################",
      "#..............#..............g#",
      "#..C..#####....#..###########..#",
      "#......#..a....s...............#",
      "#..L...#.......#....C....C.....#",
      "#......#..t....#...............#",
      "#..C...#.......#####..##########",
      "#......d.......................#",
      "#...k..#....C..................#",
      "#..##########..##########......#",
      "#..............#...............#",
      "#..C.....L.....#....C..........#",
      "#P.............#...............#",
      "################################"
    ],
    guards: [
      { route: [[5, 3], [12, 3], [12, 8], [5, 8]], wait: 0.45 },
      { route: [[21, 4], [28, 4], [28, 8], [21, 8]], wait: 0.5 },
      { route: [[6, 11], [13, 11], [13, 12], [6, 12]], wait: 0.5 }
    ],
    cameras: [
      { x: 18.5, y: 1.5, base: Math.PI / 2, swing: 0.75, range: 210 },
      { x: 30.5, y: 5.5, base: Math.PI, swing: 0.8, range: 190 }
    ],
    lasers: [
      { x1: 16, y1: 8.5, x2: 24, y2: 8.5 },
      { x1: 23, y1: 11.5, x2: 30, y2: 11.5 }
    ]
  }
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const stageLabel = document.getElementById("stageLabel");
const objectiveLabel = document.getElementById("objectiveLabel");
const alertMeter = document.getElementById("alertMeter");
const itemLabel = document.getElementById("itemLabel");
const stick = document.getElementById("stick");
const stickKnob = document.getElementById("stickKnob");
const actionButton = document.getElementById("actionButton");
const crouchButton = document.getElementById("crouchButton");
const debugButton = document.getElementById("debugButton");

const spriteSheet = new Image();
spriteSheet.src = "assets/stealth_sprites.png";

const keys = new Set();
let state = GameState.TITLE;
let stageIndex = 0;
let stage = null;
let map = [];
let guards = [];
let cameras = [];
let lasers = [];
let lastTime = 0;
let screenW = 480;
let screenH = 720;
let dpr = 1;
let message = "";
let messageTimer = 0;
let debug = false;
let systemsOff = false;
let lastDKeyTap = 0;
let dKeyDownAt = 0;

const input = {
  x: 0,
  y: 0,
  action: false,
  actionPressed: false,
  crouch: false
};

const player = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  dir: "down",
  crouch: false,
  hidden: false,
  hasKey: false,
  hasData: false,
  alert: 0,
  anim: 0
};

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  screenW = window.innerWidth;
  screenH = window.innerHeight;
  canvas.width = Math.floor(screenW * dpr);
  canvas.height = Math.floor(screenH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cloneMap(lines) {
  return lines.map((line) => line.split(""));
}

function startStage(index) {
  stageIndex = index;
  stage = STAGES[stageIndex];
  map = cloneMap(stage.map);
  guards = stage.guards.map((guard) => createGuard(guard));
  cameras = stage.cameras.map((camera) => ({ ...camera, time: 0, disabled: false }));
  lasers = stage.lasers.map((laser) => ({ ...laser, disabled: false }));
  systemsOff = false;
  message = "潜入開始";
  messageTimer = 1.8;

  const spawn = findAndClear("P") || stage.player;
  player.x = spawn[0] * TILE + TILE / 2;
  player.y = spawn[1] * TILE + TILE / 2;
  player.vx = 0;
  player.vy = 0;
  player.dir = "down";
  player.crouch = false;
  player.hidden = false;
  player.hasKey = false;
  player.hasData = false;
  player.alert = 0;
  player.anim = 0;
  state = GameState.PLAYING;
  hideOverlay();
  updateHud();
}

function createGuard(definition) {
  const route = definition.route.map(([x, y]) => ({
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2
  }));
  return {
    route,
    wait: definition.wait || 0.4,
    index: 1,
    x: route[0].x,
    y: route[0].y,
    dir: "down",
    pause: 0.4,
    alert: 0,
    spotted: false,
    anim: 0
  };
}

function findAndClear(ch) {
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      if (map[y][x] === ch) {
        map[y][x] = ".";
        return [x, y];
      }
    }
  }
  return null;
}

function showOverlay(kind, text, buttonText) {
  state = kind;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
}

function updateHud() {
  if (!stage) return;
  stageLabel.textContent = stage.name;
  objectiveLabel.textContent = message || stage.objective;
  alertMeter.value = player.alert;
  itemLabel.textContent = `CARD: ${player.hasKey ? "OK" : "-"} / DATA: ${player.hasData ? "OK" : "-"}`;
}

function tileAt(tx, ty) {
  if (ty < 0 || ty >= map.length || tx < 0 || tx >= map[ty].length) return "#";
  return map[ty][tx];
}

function setTile(tx, ty, value) {
  if (ty >= 0 && ty < map.length && tx >= 0 && tx < map[ty].length) {
    map[ty][tx] = value;
  }
}

function isBlockingTile(ch) {
  return ch === "#" || ch === "C" || ch === "L" || ch === "d" || ch === "s";
}

function blocksVision(ch) {
  return ch === "#" || ch === "C" || ch === "L" || ch === "d" || ch === "s";
}

function canMoveTo(x, y) {
  const half = player.crouch ? 7 : 9;
  const points = [
    [x - half, y - half],
    [x + half, y - half],
    [x - half, y + half],
    [x + half, y + half]
  ];
  return points.every(([px, py]) => !isBlockingTile(tileAt(Math.floor(px / TILE), Math.floor(py / TILE))));
}

function updatePlayer(dt) {
  let ix = input.x;
  let iy = input.y;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) ix -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) ix += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) iy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) iy += 1;

  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }

  player.hidden = player.hidden && len < 0.2;
  player.crouch = input.crouch || keys.has("ShiftLeft") || keys.has("ShiftRight");
  crouchButton.classList.toggle("is-active", player.crouch);

  const speed = player.crouch ? 58 : 96;
  const nx = player.x + ix * speed * dt;
  const ny = player.y + iy * speed * dt;
  if (canMoveTo(nx, player.y)) player.x = nx;
  if (canMoveTo(player.x, ny)) player.y = ny;
  player.vx = ix;
  player.vy = iy;

  if (Math.abs(ix) > 0.1 || Math.abs(iy) > 0.1) {
    player.anim += dt * (player.crouch ? 6 : 9);
    if (Math.abs(ix) > Math.abs(iy)) {
      player.dir = ix < 0 ? "left" : "right";
    } else {
      player.dir = iy < 0 ? "up" : "down";
    }
  }

  if (input.actionPressed || keys.has("Space")) {
    interact();
    input.actionPressed = false;
    keys.delete("Space");
  }
}

function updateGuards(dt) {
  for (const guard of guards) {
    guard.anim += dt * 7;
    guard.spotted = false;
    if (guard.pause > 0) {
      guard.pause -= dt;
    } else {
      const target = guard.route[guard.index];
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        guard.index = (guard.index + 1) % guard.route.length;
        guard.pause = guard.wait;
      } else {
        const speed = 56;
        guard.x += (dx / dist) * speed * dt;
        guard.y += (dy / dist) * speed * dt;
        guard.dir = directionFromVector(dx, dy);
      }
    }

    const seen = canSee(guard.x, guard.y, angleForDirection(guard.dir), Math.PI * 0.46, 166);
    guard.spotted = seen;
    guard.alert = clamp(guard.alert + (seen ? dt * 80 : -dt * 35), 0, 100);
    player.alert += seen ? dt * (player.crouch ? 16 : 31) : 0;
  }
}

function updateCameras(dt) {
  if (systemsOff) return;
  for (const camera of cameras) {
    camera.time += dt;
    const angle = camera.base + Math.sin(camera.time * 1.35) * camera.swing;
    camera.currentAngle = angle;
    const seen = canSee(camera.x * TILE, camera.y * TILE, angle, Math.PI * 0.36, camera.range);
    if (seen) player.alert += dt * (player.crouch ? 19 : 38);
  }
}

function updateLasers(dt) {
  if (systemsOff) return;
  for (const laser of lasers) {
    if (laser.disabled) continue;
    const ax = laser.x1 * TILE;
    const ay = laser.y1 * TILE;
    const bx = laser.x2 * TILE;
    const by = laser.y2 * TILE;
    if (distanceToSegment(player.x, player.y, ax, ay, bx, by) < 12) {
      player.alert += dt * 85;
      pulseMessage("レーザーに触れた");
    }
  }
}

function update(dt) {
  if (state !== GameState.PLAYING) return;
  updatePlayer(dt);
  updateGuards(dt);
  updateCameras(dt);
  updateLasers(dt);

  player.alert = clamp(player.alert - dt * (player.hidden ? 28 : 10), 0, 100);
  if (player.alert >= 100) {
    showOverlay(GameState.GAME_OVER, "警戒ゲージが最大になった。R または RETRY で再挑戦。", "RETRY");
  }

  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) message = stage.objective;
  }
  updateHud();
}

function interact() {
  const near = nearbyTiles(1.35);
  for (const item of near) {
    if (item.ch === "k") {
      setTile(item.x, item.y, ".");
      player.hasKey = true;
      pulseMessage("カードキーを入手");
      return;
    }
    if (item.ch === "a") {
      setTile(item.x, item.y, ".");
      player.hasData = true;
      pulseMessage("重要データを回収");
      return;
    }
  }

  for (const item of near) {
    if (item.ch === "t") {
      systemsOff = true;
      openAllSecurityDoors();
      pulseMessage("端末を操作: 監視装置停止");
      return;
    }
    if (item.ch === "d") {
      if (player.hasKey) {
        setTile(item.x, item.y, ".");
        pulseMessage("ロック扉を開けた");
      } else {
        pulseMessage("カードキーが必要");
      }
      return;
    }
    if (item.ch === "s") {
      pulseMessage(systemsOff ? "セキュリティ解除済み" : "端末で解除できる");
      return;
    }
    if (item.ch === "L") {
      player.hidden = !player.hidden;
      pulseMessage(player.hidden ? "ロッカーに隠れた" : "ロッカーから出た");
      return;
    }
    if (item.ch === "g") {
      if (!stage.requireData || player.hasData) {
        clearStage();
      } else {
        pulseMessage("データ回収が必要");
      }
      return;
    }
  }
  pulseMessage("調べる対象がない");
}

function openAllSecurityDoors() {
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      if (map[y][x] === "s") map[y][x] = ".";
    }
  }
}

function nearbyTiles(radiusTiles) {
  const result = [];
  const tx = Math.floor(player.x / TILE);
  const ty = Math.floor(player.y / TILE);
  const radius = Math.ceil(radiusTiles);
  for (let y = ty - radius; y <= ty + radius; y += 1) {
    for (let x = tx - radius; x <= tx + radius; x += 1) {
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (Math.hypot(cx - player.x, cy - player.y) <= radiusTiles * TILE) {
        result.push({ x, y, ch: tileAt(x, y) });
      }
    }
  }
  return result;
}

function clearStage() {
  if (stageIndex >= STAGES.length - 1) {
    showOverlay(GameState.ALL_CLEAR, "全ステージクリア。重要データを持って施設から脱出した。", "RESTART");
  } else {
    showOverlay(GameState.STAGE_CLEAR, "ステージクリア。次の区画へ進む。", "NEXT");
  }
}

function pulseMessage(text) {
  message = text;
  messageTimer = 1.8;
}

function canSee(sourceX, sourceY, angle, fov, range) {
  if (player.hidden) return false;
  const dx = player.x - sourceX;
  const dy = player.y - sourceY;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const targetAngle = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angle, targetAngle)) > fov / 2) return false;
  if (rayBlocked(sourceX, sourceY, player.x, player.y)) return false;
  return true;
}

function rayBlocked(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.ceil(Math.hypot(dx, dy) / 8);
  for (let i = 2; i < steps - 1; i += 1) {
    const x = ax + (dx * i) / steps;
    const y = ay + (dy * i) / steps;
    if (blocksVision(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)))) return true;
  }
  return false;
}

function cameraView() {
  const mapW = map[0].length * TILE;
  const mapH = map.length * TILE;
  return {
    x: clamp(player.x - screenW / 2, 0, Math.max(0, mapW - screenW)),
    y: clamp(player.y - screenH / 2, 0, Math.max(0, mapH - screenH))
  };
}

function draw() {
  ctx.clearRect(0, 0, screenW, screenH);
  if (!stage) {
    drawBackdrop();
    return;
  }
  const cam = cameraView();
  ctx.save();
  ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));
  drawMap(cam);
  drawVision();
  drawObjects();
  drawActors();
  drawWorldEffects();
  if (debug) drawDebug();
  ctx.restore();
  drawMinimap();
  drawMessage();
}

function drawBackdrop() {
  ctx.fillStyle = "#090b0d";
  ctx.fillRect(0, 0, screenW, screenH);
}

function drawMap(cam) {
  const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const endX = Math.min(map[0].length, Math.ceil((cam.x + screenW) / TILE) + 1);
  const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const endY = Math.min(map.length, Math.ceil((cam.y + screenH) / TILE) + 1);
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const ch = tileAt(x, y);
      const px = x * TILE;
      const py = y * TILE;
      const floorSprite = (x + y) % 3 === 0 ? SPRITES.tile.floor2 : SPRITES.tile.floor;
      drawSprite(floorSprite, px, py);
      if (ch === "#") drawSprite(SPRITES.tile.wall, px, py);
      if (ch === ".") drawFloorGrid(px, py);
      if (ch === "g") drawSprite(SPRITES.object.goal, px, py);
      if (ch === "k") drawSprite(SPRITES.object.key, px, py);
      if (ch === "a") drawSprite(SPRITES.object.data, px, py);
      if (ch === "t") drawSprite(SPRITES.object.terminal, px, py);
      if (ch === "s") drawSprite(SPRITES.object.secureDoor, px, py);
      if (ch === "d") drawSprite(SPRITES.object.door, px, py);
      if (ch === "C") drawSprite(SPRITES.object.crate, px, py);
      if (ch === "L") drawSprite(SPRITES.object.locker, px, py);
    }
  }
}

function drawFloorGrid(x, y) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function drawObjects() {
  for (const camera of cameras) {
    drawSprite(SPRITES.object.camera, camera.x * TILE - 16, camera.y * TILE - 16);
  }
  if (!systemsOff) {
    for (const laser of lasers) {
      ctx.strokeStyle = "rgba(255, 42, 36, 0.78)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(laser.x1 * TILE, laser.y1 * TILE);
      ctx.lineTo(laser.x2 * TILE, laser.y2 * TILE);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 210, 210, 0.65)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawVision() {
  for (const guard of guards) {
    drawCone(guard.x, guard.y, angleForDirection(guard.dir), Math.PI * 0.46, 166, guard.spotted ? "red" : guard.alert > 20 ? "amber" : "green");
  }
  if (!systemsOff) {
    for (const camera of cameras) {
      drawCone(camera.x * TILE, camera.y * TILE, camera.currentAngle || camera.base, Math.PI * 0.36, camera.range, "amber");
    }
  }
}

function drawCone(x, y, angle, fov, range, color) {
  const colors = {
    green: "rgba(91, 227, 77, 0.18)",
    amber: "rgba(246, 189, 75, 0.20)",
    red: "rgba(255, 63, 57, 0.24)"
  };
  ctx.fillStyle = colors[color];
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - fov / 2, angle + fov / 2);
  ctx.closePath();
  ctx.fill();
}

function drawActors() {
  for (const guard of guards) {
    const frames = SPRITES.guard[guard.dir] || SPRITES.guard.down;
    const sprite = frames[Math.floor(guard.anim) % frames.length];
    drawSprite(sprite, guard.x - 16, guard.y - 21);
    if (guard.spotted) drawSprite(SPRITES.guard.found, guard.x - 16, guard.y - 52);
    else if (guard.alert > 12) drawSprite(SPRITES.guard.alert, guard.x - 16, guard.y - 52);
  }

  const frames = player.crouch
    ? (Math.hypot(player.vx, player.vy) > 0.1 ? SPRITES.player.crouchMove : SPRITES.player.crouch)
    : SPRITES.player[player.dir];
  const sprite = frames[Math.floor(player.anim) % frames.length];
  ctx.globalAlpha = player.hidden ? 0.45 : 1;
  drawSprite(sprite, player.x - 16, player.y - 21);
  ctx.globalAlpha = 1;
}

function drawWorldEffects() {
  if (player.crouch || player.hidden || Math.hypot(player.vx, player.vy) < 0.2) return;
  const r = 10 + (Math.sin(performance.now() / 100) + 1) * 4;
  ctx.strokeStyle = "rgba(103, 215, 255, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDebug() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(player.x - 7, player.y - 7, 14, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "12px monospace";
  ctx.fillText(`stage:${stageIndex + 1}`, player.x + 12, player.y - 28);
  ctx.fillText(`x:${Math.floor(player.x)} y:${Math.floor(player.y)}`, player.x + 12, player.y - 14);
  for (const guard of guards) {
    ctx.strokeStyle = guard.spotted ? "rgba(255, 60, 40, 0.9)" : "rgba(110, 231, 120, 0.8)";
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
  }
}

function drawMinimap() {
  if (!stage || screenW < 320) return;
  const scale = screenW < 520 ? 3 : 4;
  const w = map[0].length * scale;
  const h = map.length * scale;
  const x0 = screenW - w - 12;
  const y0 = screenH > 520 ? 86 : 54;
  ctx.fillStyle = "rgba(5, 7, 8, 0.68)";
  ctx.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      const ch = tileAt(x, y);
      if (ch === "#") ctx.fillStyle = "#5d665c";
      else if (ch === "g") ctx.fillStyle = "#8cff55";
      else if (ch === "a") ctx.fillStyle = "#67d7ff";
      else if (ch === "t") ctx.fillStyle = "#f6bd4b";
      else ctx.fillStyle = "rgba(210, 218, 205, 0.18)";
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    }
  }
  ctx.fillStyle = "#67d7ff";
  ctx.fillRect(x0 + (player.x / TILE) * scale - 2, y0 + (player.y / TILE) * scale - 2, 4, 4);
  ctx.fillStyle = "#ff4e45";
  for (const guard of guards) {
    ctx.fillRect(x0 + (guard.x / TILE) * scale - 2, y0 + (guard.y / TILE) * scale - 2, 4, 4);
  }
}

function drawMessage() {
  if (!message || messageTimer <= 0) return;
  const width = Math.min(screenW - 24, 420);
  const x = (screenW - width) / 2;
  const y = Math.max(72, screenH * 0.13);
  ctx.fillStyle = "rgba(8, 10, 11, 0.82)";
  ctx.fillRect(x, y, width, 38);
  ctx.strokeStyle = "rgba(238, 242, 232, 0.24)";
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 37);
  ctx.fillStyle = "#eef2e8";
  ctx.font = "700 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, screenW / 2, y + 24);
  ctx.textAlign = "left";
}

function drawSprite(sprite, x, y, scale = 1) {
  if (!spriteSheet.complete || spriteSheet.naturalWidth === 0 || !sprite) {
    drawFallback(x, y, TILE * scale, TILE * scale);
    return;
  }
  ctx.drawImage(
    spriteSheet,
    sprite.x * TILE,
    sprite.y * TILE,
    TILE,
    TILE,
    Math.floor(x),
    Math.floor(y),
    TILE * scale,
    TILE * scale
  );
}

function drawFallback(x, y, w, h) {
  ctx.fillStyle = "#3c4741";
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, w - 1, h - 1);
}

function angleForDirection(dir) {
  if (dir === "left") return Math.PI;
  if (dir === "right") return 0;
  if (dir === "up") return -Math.PI / 2;
  return Math.PI / 2;
}

function directionFromVector(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function angleDiff(a, b) {
  let diff = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setupTouchControls() {
  let stickPointer = null;
  let rect = null;

  function updateStick(clientX, clientY) {
    if (!rect) rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.34;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const ratio = dist > max ? max / dist : 1;
    const kx = dx * ratio;
    const ky = dy * ratio;
    input.x = clamp(dx / max, -1, 1);
    input.y = clamp(dy / max, -1, 1);
    stickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  function resetStick() {
    input.x = 0;
    input.y = 0;
    stickKnob.style.transform = "translate(0, 0)";
    stickPointer = null;
    rect = null;
  }

  stick.addEventListener("pointerdown", (event) => {
    stickPointer = event.pointerId;
    stick.setPointerCapture(stickPointer);
    rect = stick.getBoundingClientRect();
    updateStick(event.clientX, event.clientY);
  });
  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId === stickPointer) updateStick(event.clientX, event.clientY);
  });
  stick.addEventListener("pointerup", resetStick);
  stick.addEventListener("pointercancel", resetStick);

  actionButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input.action = true;
    input.actionPressed = true;
    actionButton.classList.add("is-active");
  });
  actionButton.addEventListener("pointerup", () => {
    input.action = false;
    actionButton.classList.remove("is-active");
  });
  actionButton.addEventListener("pointercancel", () => {
    input.action = false;
    actionButton.classList.remove("is-active");
  });

  crouchButton.addEventListener("click", () => {
    input.crouch = !input.crouch;
  });
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyR") {
      startStage(stageIndex);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      if (event.code === "KeyD" && !keys.has("KeyD")) dKeyDownAt = performance.now();
      keys.add(event.code);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyD") {
      const now = performance.now();
      if (now - dKeyDownAt < 180 && now - lastDKeyTap < 320) debug = !debug;
      lastDKeyTap = now;
    }
    keys.delete(event.code);
  });
  debugButton.addEventListener("click", () => {
    debug = !debug;
  });
}

startButton.addEventListener("click", () => {
  if (state === GameState.STAGE_CLEAR) startStage(stageIndex + 1);
  else startStage(0);
});

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
document.addEventListener("gesturestart", (event) => event.preventDefault());

resize();
setupTouchControls();
setupKeyboard();
showOverlay(GameState.TITLE, "敵の視界を避け、端末やカードキーを使って重要データを回収し、脱出口へ向かえ。", "START");
requestAnimationFrame(loop);
