(() => {
  const MAP_SIZE = 32;
  const TILE_W = 54;
  const TILE_H = 28;
  const HEIGHT_STEP = 13;
  const STORAGE_KEY = "blockPocketSandbox:v2";
  const OLD_STORAGE_KEY = "blockPocketSandbox:v1";
  const LONG_PRESS_MS = 360;
  const DAY_LENGTH = 240;
  const MAX_ENEMIES = 4;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const joystick = document.getElementById("joystick");
  const stickThumb = document.getElementById("stickThumb");
  const blockBar = document.getElementById("blockBar");
  const toolBar = document.getElementById("toolBar");
  const inventoryStrip = document.getElementById("inventoryStrip");
  const placeButton = document.getElementById("placeButton");
  const breakButton = document.getElementById("breakButton");
  const attackButton = document.getElementById("attackButton");
  const eatButton = document.getElementById("eatButton");
  const craftButton = document.getElementById("craftButton");
  const craftPanel = document.getElementById("craftPanel");
  const closeCraftButton = document.getElementById("closeCraftButton");
  const craftList = document.getElementById("craftList");
  const resetButton = document.getElementById("resetButton");
  const positionText = document.getElementById("positionText");
  const modeText = document.getElementById("modeText");
  const hpText = document.getElementById("hpText");
  const foodText = document.getElementById("foodText");
  const timeText = document.getElementById("timeText");
  const hintText = document.getElementById("hintText");
  const tutorialPanel = document.getElementById("tutorialPanel");
  const startButton = document.getElementById("startButton");
  const missionWood = document.getElementById("missionWood");
  const missionBench = document.getElementById("missionBench");
  const missionTorch = document.getElementById("missionTorch");

  const blockDefs = {
    grass: { label: "Grass", top: "#68c95b", left: "#4b9c43", right: "#58ae4e", passable: true, hardness: 0.7, tool: "shovel" },
    dirt: { label: "Dirt", top: "#b87943", left: "#8d572e", right: "#9c6234", passable: true, hardness: 0.7, tool: "shovel" },
    stone: { label: "Stone", top: "#a3adb4", left: "#737d84", right: "#88939a", passable: true, hardness: 1.7, tool: "pickaxe" },
    wood: { label: "Wood", top: "#c98939", left: "#8f5d2a", right: "#a46b31", passable: true, hardness: 1.4, tool: "axe" },
    water: { label: "Water", top: "#54b8f2", left: "#2e89c9", right: "#3da0df", passable: false, hardness: 0.4, tool: "hand" },
    sand: { label: "Sand", top: "#e6c96e", left: "#bd9d48", right: "#d7b85f", passable: true, hardness: 0.6, tool: "shovel" },
    ore: { label: "Ore", top: "#727b86", left: "#535d66", right: "#626c75", passable: true, hardness: 2.0, tool: "pickaxe" },
    berry: { label: "Berry", top: "#59b85a", left: "#3f8d44", right: "#4fa14f", passable: true, hardness: 1.0, tool: "axe" },
    torch: { label: "Torch", top: "#f4c544", left: "#a66a2a", right: "#c28333", passable: true, hardness: 0.4, tool: "hand", light: 4 },
    chest: { label: "Chest", top: "#b67834", left: "#7b4b22", right: "#95602d", passable: true, hardness: 1.0, tool: "axe" },
    bench: { label: "Bench", top: "#b97a39", left: "#7d4e27", right: "#98612f", passable: true, hardness: 1.2, tool: "axe" }
  };

  const placeableBlocks = ["grass", "dirt", "stone", "wood", "water", "sand", "ore", "torch", "chest"];
  const inventoryKeys = ["grass", "dirt", "stone", "wood", "water", "sand", "ore", "berry", "plank", "torch", "chest", "bench", "slime"];
  const toolNames = { hand: "Hand", axe: "Axe", pickaxe: "Pick", shovel: "Shovel" };
  const actions = ["place", "break", "attack"];

  const recipes = [
    { id: "plank", label: "Planks", cost: { wood: 3 }, gain: { plank: 4 } },
    { id: "bench", label: "Workbench", cost: { plank: 4 }, gain: { bench: 1 } },
    { id: "pickaxe", label: "Pickaxe", cost: { wood: 2, stone: 3 }, tool: "pickaxe" },
    { id: "axe", label: "Axe", cost: { wood: 2, stone: 3 }, tool: "axe" },
    { id: "shovel", label: "Shovel", cost: { wood: 2, stone: 1 }, tool: "shovel" },
    { id: "torch", label: "Torches", cost: { wood: 1, ore: 1 }, gain: { torch: 3 } },
    { id: "chest", label: "Chest", cost: { plank: 3 }, gain: { chest: 1 } }
  ];

  const state = loadGame();

  function makeInventory(seed = false) {
    const inventory = {};
    for (const key of inventoryKeys) inventory[key] = 0;
    if (seed) {
      inventory.grass = 4;
      inventory.dirt = 4;
      inventory.berry = 2;
    }
    return inventory;
  }

  function makeTools() {
    return { hand: true, axe: false, pickaxe: false, shovel: false };
  }

  function createGameState() {
    return {
      width: 390,
      height: 720,
      map: createMap(),
      selected: "grass",
      selectedTool: "hand",
      action: "place",
      player: { x: 16.5, y: 16.5, vx: 0, vy: 0, dirX: 0, dirY: 1, hitCooldown: 0 },
      input: { x: 0, y: 0, pointerId: null },
      touch: { timer: 0, startX: 0, startY: 0, tile: null, longPressed: false },
      inventory: makeInventory(true),
      tools: makeTools(),
      hp: 100,
      food: 100,
      timeOfDay: 0.22,
      enemies: [],
      mine: null,
      messageUntil: 0,
      message: "Break wood, craft tools, and prepare for night.",
      tutorialSeen: false,
      stats: { wood: 0, bench: 0, torch: 0 },
      lastSave: 0,
      spawnClock: 0
    };
  }

  function createMap() {
    const map = [];
    const waterCx = 7 + Math.random() * 5;
    const waterCy = 22 + Math.random() * 5;
    const stoneCx = 22 + Math.random() * 5;
    const stoneCy = 8 + Math.random() * 6;
    const sandCx = 8 + Math.random() * 8;
    const sandCy = 5 + Math.random() * 6;

    for (let y = 0; y < MAP_SIZE; y += 1) {
      const row = [];
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const edge = Math.min(x, y, MAP_SIZE - 1 - x, MAP_SIZE - 1 - y);
        const waterDist = Math.hypot(x - waterCx, y - waterCy);
        const stoneDist = Math.hypot(x - stoneCx, y - stoneCy);
        const sandDist = Math.hypot(x - sandCx, y - sandCy);
        const noise = seededNoise(x, y);
        let type = "grass";
        let h = noise > 0.7 ? 2 : noise > 0.38 ? 1 : 0;

        if (waterDist < 5.1 + noise * 1.6 || edge === 0) {
          type = "water";
          h = 0;
        } else if (sandDist < 4.4) {
          type = "sand";
          h = noise > 0.78 ? 1 : 0;
        } else if (stoneDist < 4.8 || noise > 0.87) {
          type = noise > 0.93 ? "ore" : "stone";
          h = Math.min(3, 1 + Math.floor(noise * 3));
        } else if (noise < 0.16) {
          type = "dirt";
          h = 0;
        }

        if (x > 13 && x < 19 && y > 13 && y < 19) {
          type = "grass";
          h = 0;
        }

        row.push({ type, h, opened: false });
      }
      map.push(row);
    }

    scatterTiles(map, "wood", 48, ["grass", "dirt"], 1, 3);
    scatterTiles(map, "berry", 18, ["grass"], 1, 2);
    scatterTiles(map, "chest", 7, ["grass", "sand", "stone"], 0, 0);
    return map;
  }

  function scatterTiles(map, type, count, allowed, minH, maxH) {
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 20) {
      tries += 1;
      const x = 2 + Math.floor(Math.random() * (MAP_SIZE - 4));
      const y = 2 + Math.floor(Math.random() * (MAP_SIZE - 4));
      if (x > 13 && x < 19 && y > 13 && y < 19) continue;
      const tile = map[y][x];
      if (!allowed.includes(tile.type)) continue;
      tile.type = type;
      tile.h = minH + Math.floor(Math.random() * (maxH - minH + 1));
      tile.opened = false;
      placed += 1;
    }
  }

  function seededNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.map?.length === MAP_SIZE) return normalizeGame(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.removeItem(OLD_STORAGE_KEY);
    const game = createGameState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packSave(game)));
    return game;
  }

  function normalizeGame(saved) {
    const game = createGameState();
    game.map = saved.map;
    game.selected = placeableBlocks.includes(saved.selected) ? saved.selected : "grass";
    game.selectedTool = saved.tools?.[saved.selectedTool] ? saved.selectedTool : "hand";
    game.action = actions.includes(saved.action) ? saved.action : "place";
    game.player = { ...game.player, ...saved.player, hitCooldown: 0 };
    game.inventory = { ...makeInventory(), ...saved.inventory };
    game.tools = { ...makeTools(), ...saved.tools, hand: true };
    game.hp = clamp(Number(saved.hp) || 100, 0, 100);
    game.food = clamp(Number(saved.food) || 100, 0, 100);
    game.timeOfDay = Number.isFinite(saved.timeOfDay) ? saved.timeOfDay : 0.22;
    game.enemies = Array.isArray(saved.enemies) ? saved.enemies.slice(0, MAX_ENEMIES) : [];
    game.tutorialSeen = Boolean(saved.tutorialSeen);
    game.stats = { ...game.stats, ...saved.stats };
    return game;
  }

  function packSave(game) {
    return {
      map: game.map,
      selected: game.selected,
      selectedTool: game.selectedTool,
      action: game.action,
      player: { x: game.player.x, y: game.player.y },
      inventory: game.inventory,
      tools: game.tools,
      hp: game.hp,
      food: game.food,
      timeOfDay: game.timeOfDay,
      enemies: game.enemies,
      tutorialSeen: game.tutorialSeen,
      stats: game.stats
    };
  }

  function saveGame(force = false) {
    const now = performance.now();
    if (!force && now - state.lastSave < 650) return;
    state.lastSave = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packSave(state)));
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * ratio);
    canvas.height = Math.floor(state.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getTile(x, y) {
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return null;
    return state.map[y][x];
  }

  function worldToScreen(x, y, h = 0) {
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    return {
      x: state.width / 2 + (dx - dy) * TILE_W / 2,
      y: state.height * 0.45 + (dx + dy) * TILE_H / 2 - h * HEIGHT_STEP
    };
  }

  function screenToTile(screenX, screenY) {
    let best = null;
    let bestDist = Infinity;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const rangeX = Math.ceil(state.width / TILE_W) + 5;
    const rangeY = Math.ceil(state.height / TILE_H) + 5;

    for (let y = Math.max(0, py - rangeY); y <= Math.min(MAP_SIZE - 1, py + rangeY); y += 1) {
      for (let x = Math.max(0, px - rangeX); x <= Math.min(MAP_SIZE - 1, px + rangeX); x += 1) {
        const tile = getTile(x, y);
        const pos = worldToScreen(x + 0.5, y + 0.5, tile.h);
        const dist = Math.hypot(screenX - pos.x, screenY - pos.y);
        if (dist < bestDist && dist < 36) {
          bestDist = dist;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function screenToEnemy(screenX, screenY) {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of state.enemies) {
      const pos = worldToScreen(enemy.x, enemy.y, 0);
      const dist = Math.hypot(screenX - pos.x, screenY - (pos.y - 11));
      if (dist < bestDist && dist < 34) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  function canStandAt(x, y) {
    const tile = getTile(Math.floor(x), Math.floor(y));
    if (!tile || !blockDefs[tile.type].passable) return false;
    return tile.h <= 2;
  }

  function getPhase() {
    const t = state.timeOfDay;
    if (t < 0.2) return "Dawn";
    if (t < 0.58) return "Day";
    if (t < 0.72) return "Dusk";
    return "Night";
  }

  function isNight() {
    return getPhase() === "Night";
  }

  function update(dt) {
    updatePlayer(dt);
    updateWorldTime(dt);
    updateMining();
    updateEnemies(dt);
    updateHud();
    saveGame();
  }

  function updatePlayer(dt) {
    const speed = 2.35;
    const inputLength = Math.hypot(state.input.x, state.input.y);
    const nx = inputLength > 1 ? state.input.x / inputLength : state.input.x;
    const ny = inputLength > 1 ? state.input.y / inputLength : state.input.y;
    const targetVx = nx * speed;
    const targetVy = ny * speed;

    state.player.vx += (targetVx - state.player.vx) * 0.2;
    state.player.vy += (targetVy - state.player.vy) * 0.2;

    if (Math.hypot(state.player.vx, state.player.vy) > 0.05) {
      state.player.dirX = state.player.vx;
      state.player.dirY = state.player.vy;
    }

    const nextX = state.player.x + state.player.vx * dt;
    const nextY = state.player.y + state.player.vy * dt;
    if (canStandAt(nextX, state.player.y)) state.player.x = clamp(nextX, 1, MAP_SIZE - 1.001);
    if (canStandAt(state.player.x, nextY)) state.player.y = clamp(nextY, 1, MAP_SIZE - 1.001);

    state.player.hitCooldown = Math.max(0, state.player.hitCooldown - dt);
  }

  function updateWorldTime(dt) {
    state.timeOfDay = (state.timeOfDay + dt / DAY_LENGTH) % 1;
    state.food = clamp(state.food - dt * 0.08, 0, 100);
    if (state.food <= 0) state.hp = clamp(state.hp - dt * 1.4, 0, 100);
  }

  function updateMining() {
    if (!state.mine) return;
    const tile = getTile(state.mine.x, state.mine.y);
    if (!tile || tile.type !== state.mine.type) {
      state.mine = null;
      return;
    }
    if (performance.now() >= state.mine.doneAt) {
      harvestTile(state.mine.x, state.mine.y);
      state.mine = null;
    }
  }

  function updateEnemies(dt) {
    state.spawnClock += dt;
    if (isNight() && state.spawnClock > 7 && state.enemies.length < MAX_ENEMIES) {
      state.spawnClock = 0;
      if (Math.random() < 0.62) spawnSlime();
    }

    if (!isNight() && state.enemies.length > 0 && Math.random() < dt * 0.08) {
      state.enemies.pop();
    }

    for (const enemy of state.enemies) {
      const dx = state.player.x - enemy.x;
      const dy = state.player.y - enemy.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      if (dist < 9) {
        const speed = 0.78;
        const nextX = enemy.x + (dx / dist) * speed * dt;
        const nextY = enemy.y + (dy / dist) * speed * dt;
        if (canStandAt(nextX, enemy.y)) enemy.x = nextX;
        if (canStandAt(enemy.x, nextY)) enemy.y = nextY;
      }
      enemy.bob = (enemy.bob || 0) + dt * 5;
      if (dist < 0.62 && state.player.hitCooldown <= 0) {
        state.hp = clamp(state.hp - 9, 0, 100);
        state.player.hitCooldown = 1.1;
        showMessage("Slime hit you.");
      }
    }
  }

  function spawnSlime() {
    for (let tries = 0; tries < 18; tries += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 5;
      const x = clamp(state.player.x + Math.cos(angle) * dist, 1, MAP_SIZE - 2);
      const y = clamp(state.player.y + Math.sin(angle) * dist, 1, MAP_SIZE - 2);
      if (canStandAt(x, y)) {
        state.enemies.push({ id: Date.now() + Math.random(), x, y, hp: 3, bob: 0 });
        return;
      }
    }
  }

  function updateHud() {
    const phase = getPhase();
    positionText.textContent = `${Math.floor(state.player.x)},${Math.floor(state.player.y)}`;
    modeText.textContent = `${state.action.toUpperCase()} ${state.selectedTool.toUpperCase()}`;
    hpText.textContent = `HP ${Math.ceil(state.hp)}`;
    foodText.textContent = `Food ${Math.ceil(state.food)}`;
    timeText.textContent = phase;

    placeButton.classList.toggle("active", state.action === "place");
    breakButton.classList.toggle("active", state.action === "break");
    attackButton.classList.toggle("active", state.action === "attack");
    breakButton.setAttribute("aria-pressed", String(state.action === "break"));

    if (performance.now() < state.messageUntil) {
      hintText.textContent = state.message;
    } else if (state.mine) {
      hintText.textContent = `Breaking ${blockDefs[state.mine.type].label}...`;
    } else {
      hintText.textContent = nextMissionText();
    }

    updateInventoryUi();
    updateMissionUi();
  }

  function updateInventoryUi() {
    inventoryStrip.innerHTML = inventoryKeys
      .filter((key) => state.inventory[key] > 0 || ["wood", "stone", "berry", "plank", "torch"].includes(key))
      .slice(0, 11)
      .map((key) => `<span class="inv-chip">${shortLabel(key)} ${state.inventory[key] || 0}</span>`)
      .join("");

    document.querySelectorAll(".block-option").forEach((button) => {
      const key = button.dataset.block;
      button.classList.toggle("active", key === state.selected);
      button.classList.toggle("empty", (state.inventory[key] || 0) <= 0);
    });

    document.querySelectorAll(".tool-option").forEach((button) => {
      const key = button.dataset.tool;
      button.classList.toggle("active", key === state.selectedTool);
      button.classList.toggle("locked", !state.tools[key]);
    });
  }

  function shortLabel(key) {
    const labels = {
      grass: "Gr", dirt: "Dt", stone: "St", wood: "Wd", water: "Wa", sand: "Sa",
      ore: "Ore", berry: "Berry", plank: "Plank", torch: "Torch", chest: "Chest",
      bench: "Bench", slime: "Slime"
    };
    return labels[key] || key;
  }

  function nextMissionText() {
    if (state.stats.wood <= 0) return "Mission: break a wood block.";
    if (state.stats.bench <= 0) return "Mission: craft planks, then a workbench.";
    if (state.stats.torch <= 0) return "Mission: craft a torch before night.";
    return "Collect, craft, and survive the night.";
  }

  function updateMissionUi() {
    missionWood.classList.toggle("mission-done", state.stats.wood > 0);
    missionBench.classList.toggle("mission-done", state.stats.bench > 0);
    missionTorch.classList.toggle("mission-done", state.stats.torch > 0);
  }

  function draw() {
    drawBackground();
    drawWorld();
    drawEnemies();
    drawPlayer();
    drawMineProgress();
    drawNightOverlay();
  }

  function drawBackground() {
    const phase = getPhase();
    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    if (phase === "Night") {
      sky.addColorStop(0, "#1b2a54");
      sky.addColorStop(0.58, "#32435e");
      sky.addColorStop(1, "#45654f");
    } else if (phase === "Dusk") {
      sky.addColorStop(0, "#f0a25f");
      sky.addColorStop(0.55, "#f3d086");
      sky.addColorStop(1, "#8fbd66");
    } else if (phase === "Dawn") {
      sky.addColorStop(0, "#f7c985");
      sky.addColorStop(0.58, "#eaf8c7");
      sky.addColorStop(1, "#95cd66");
    } else {
      sky.addColorStop(0, "#8edcff");
      sky.addColorStop(0.58, "#eaf8c7");
      sky.addColorStop(1, "#95cd66");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.fillStyle = phase === "Night" ? "rgba(255,255,210,0.2)" : "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.ellipse(state.width * 0.22, state.height * 0.16, 82, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(state.width * 0.72, state.height * 0.22, 104, 23, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorld() {
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const rangeX = Math.ceil(state.width / TILE_W) + 6;
    const rangeY = Math.ceil(state.height / TILE_H) + 6;
    const minY = Math.max(0, py - rangeY);
    const maxY = Math.min(MAP_SIZE - 1, py + rangeY);
    const minX = Math.max(0, px - rangeX);
    const maxX = Math.min(MAP_SIZE - 1, px + rangeX);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        drawTile(x, y, getTile(x, y));
      }
    }
  }

  function drawTile(x, y, tile) {
    const base = worldToScreen(x, y, 0);
    const top = worldToScreen(x, y, tile.h);
    const def = blockDefs[tile.type] || blockDefs.grass;

    if (base.x < -TILE_W || base.x > state.width + TILE_W || base.y < -80 || base.y > state.height + 120) return;

    if (tile.h > 0) {
      drawPoly([
        { x: top.x - TILE_W / 2, y: top.y + TILE_H / 2 },
        { x: top.x, y: top.y + TILE_H },
        { x: base.x, y: base.y + TILE_H + tile.h * HEIGHT_STEP },
        { x: base.x - TILE_W / 2, y: base.y + TILE_H / 2 + tile.h * HEIGHT_STEP }
      ], def.left);
      drawPoly([
        { x: top.x + TILE_W / 2, y: top.y + TILE_H / 2 },
        { x: top.x, y: top.y + TILE_H },
        { x: base.x, y: base.y + TILE_H + tile.h * HEIGHT_STEP },
        { x: base.x + TILE_W / 2, y: base.y + TILE_H / 2 + tile.h * HEIGHT_STEP }
      ], def.right);
    }

    drawDiamond(top.x, top.y, def.top);
    ctx.strokeStyle = tile.type === "water" ? "rgba(210,245,255,0.48)" : "rgba(31,67,42,0.14)";
    ctx.lineWidth = 1;
    strokeDiamond(top.x, top.y);

    if (tile.type === "wood") drawWoodDetails(top.x, top.y, tile.h);
    if (tile.type === "stone" || tile.type === "ore") drawStoneDetails(top.x, top.y, tile.type === "ore");
    if (tile.type === "water") drawWaterDetails(top.x, top.y);
    if (tile.type === "berry") drawBerryDetails(top.x, top.y);
    if (tile.type === "torch") drawTorch(top.x, top.y);
    if (tile.type === "chest") drawChest(top.x, top.y, tile.opened);
    if (tile.type === "bench") drawBench(top.x, top.y);
  }

  function drawDiamond(x, y, fill) {
    drawPoly([
      { x, y },
      { x: x + TILE_W / 2, y: y + TILE_H / 2 },
      { x, y: y + TILE_H },
      { x: x - TILE_W / 2, y: y + TILE_H / 2 }
    ], fill);
  }

  function strokeDiamond(x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2);
    ctx.closePath();
    ctx.stroke();
  }

  function drawPoly(points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawWoodDetails(x, y, h) {
    ctx.fillStyle = "rgba(96,52,21,0.46)";
    ctx.beginPath();
    ctx.ellipse(x, y + TILE_H / 2, 10 + h * 2, 4 + h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStoneDetails(x, y, ore) {
    ctx.strokeStyle = ore ? "rgba(108,230,255,0.68)" : "rgba(74,86,92,0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 11, y + 12);
    ctx.lineTo(x - 1, y + 8);
    ctx.lineTo(x + 13, y + 15);
    ctx.stroke();
  }

  function drawWaterDetails(x, y) {
    ctx.strokeStyle = "rgba(230,250,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 12);
    ctx.quadraticCurveTo(x - 7, y + 8, x, y + 12);
    ctx.quadraticCurveTo(x + 8, y + 16, x + 16, y + 12);
    ctx.stroke();
  }

  function drawBerryDetails(x, y) {
    ctx.fillStyle = "#d94862";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(x + i * 7, y + 13 + Math.abs(i) * 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTorch(x, y) {
    ctx.fillStyle = "#73421f";
    ctx.fillRect(x - 3, y + 7, 6, 16);
    ctx.fillStyle = "#ffcf48";
    ctx.beginPath();
    ctx.arc(x, y + 5, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChest(x, y, opened) {
    ctx.fillStyle = opened ? "rgba(50,35,22,0.35)" : "#8b5424";
    roundRect(x - 16, y + 8, 32, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#f2c75d";
    ctx.fillRect(x - 2, y + 15, 4, 6);
  }

  function drawBench(x, y) {
    ctx.strokeStyle = "rgba(80,43,18,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 10);
    ctx.lineTo(x + 14, y + 22);
    ctx.moveTo(x + 14, y + 10);
    ctx.lineTo(x - 14, y + 22);
    ctx.stroke();
  }

  function drawPlayer() {
    const tile = getTile(Math.floor(state.player.x), Math.floor(state.player.y));
    const pos = worldToScreen(state.player.x, state.player.y, tile ? tile.h : 0);

    ctx.save();
    ctx.translate(pos.x, pos.y - 18);
    ctx.fillStyle = "rgba(30,45,36,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 29, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = state.player.hitCooldown > 0 ? "#e45c54" : "#3166d6";
    roundRect(-9, 6, 18, 22, 7);
    ctx.fill();

    ctx.fillStyle = "#ffd58c";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#253045";
    ctx.beginPath();
    ctx.arc(-4, -2, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#253045";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, 2, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of state.enemies) {
      const pos = worldToScreen(enemy.x, enemy.y, 0);
      const bob = Math.sin(enemy.bob || 0) * 2;
      ctx.save();
      ctx.translate(pos.x, pos.y - 9 + bob);
      ctx.fillStyle = "rgba(20,45,30,0.24)";
      ctx.beginPath();
      ctx.ellipse(0, 17, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#67d96a";
      ctx.beginPath();
      ctx.ellipse(0, 3, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#19452a";
      ctx.beginPath();
      ctx.arc(-5, 0, 2, 0, Math.PI * 2);
      ctx.arc(6, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMineProgress() {
    if (!state.mine) return;
    const tile = getTile(state.mine.x, state.mine.y);
    if (!tile) return;
    const pos = worldToScreen(state.mine.x + 0.5, state.mine.y + 0.5, tile.h);
    const progress = clamp((performance.now() - state.mine.startedAt) / (state.mine.doneAt - state.mine.startedAt), 0, 1);
    ctx.fillStyle = "rgba(30, 35, 28, 0.34)";
    roundRect(pos.x - 20, pos.y - 28, 40, 6, 3);
    ctx.fill();
    ctx.fillStyle = "#ffe36a";
    roundRect(pos.x - 20, pos.y - 28, 40 * progress, 6, 3);
    ctx.fill();
  }

  function drawNightOverlay() {
    const phase = getPhase();
    let alpha = 0;
    if (phase === "Night") alpha = 0.38;
    if (phase === "Dusk" || phase === "Dawn") alpha = 0.15;
    if (alpha <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(8, 18, 42, ${alpha})`;
    ctx.fillRect(0, 0, state.width, state.height);

    for (let y = 0; y < MAP_SIZE; y += 1) {
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const tile = getTile(x, y);
        if (tile?.type !== "torch") continue;
        const pos = worldToScreen(x + 0.5, y + 0.5, tile.h);
        if (pos.x < -100 || pos.x > state.width + 100 || pos.y < -100 || pos.y > state.height + 100) continue;
        const light = ctx.createRadialGradient(pos.x, pos.y, 8, pos.x, pos.y, 110);
        light.addColorStop(0, "rgba(255, 225, 105, 0.42)");
        light.addColorStop(1, "rgba(255, 225, 105, 0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 110, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function handleTileAction(tilePos, forceBreak = false) {
    if (!tilePos) return;
    if (forceBreak || state.action === "break") {
      startBreaking(tilePos.x, tilePos.y);
    } else if (state.action === "attack") {
      attackEnemy();
    } else {
      placeBlock(tilePos.x, tilePos.y);
    }
  }

  function placeBlock(x, y) {
    const tile = getTile(x, y);
    const playerTileX = Math.floor(state.player.x);
    const playerTileY = Math.floor(state.player.y);
    if (!tile || (x === playerTileX && y === playerTileY)) {
      showMessage("You cannot build under the player.");
      return;
    }
    if ((state.inventory[state.selected] || 0) <= 0) {
      showMessage(`No ${blockDefs[state.selected].label} left.`);
      return;
    }

    state.inventory[state.selected] -= 1;
    tile.type = state.selected === "bench" ? "bench" : state.selected;
    tile.h = ["water", "torch", "chest", "bench"].includes(tile.type) ? 0 : clamp(tile.h + 1, 0, 3);
    tile.opened = false;
    showMessage(`${blockDefs[tile.type].label} placed.`);
    saveGame(true);
  }

  function startBreaking(x, y) {
    const tile = getTile(x, y);
    const playerTileX = Math.floor(state.player.x);
    const playerTileY = Math.floor(state.player.y);
    if (!tile || (x === playerTileX && y === playerTileY)) return;

    if (tile.type === "chest" && !tile.opened) {
      openChest(tile);
      saveGame(true);
      return;
    }

    const def = blockDefs[tile.type] || blockDefs.grass;
    const toolBonus = state.selectedTool === def.tool && state.tools[state.selectedTool] ? 0.45 : 1;
    const duration = Math.max(180, def.hardness * 720 * toolBonus);
    state.mine = {
      x,
      y,
      type: tile.type,
      startedAt: performance.now(),
      doneAt: performance.now() + duration
    };
  }

  function harvestTile(x, y) {
    const tile = getTile(x, y);
    if (!tile) return;
    const type = tile.type;
    const drops = getDrops(tile);
    for (const [key, count] of Object.entries(drops)) addInventory(key, count);

    if (type === "water") {
      tile.type = "dirt";
      tile.h = 0;
    } else if (tile.h > 0 && !["torch", "chest", "bench", "berry"].includes(type)) {
      tile.h -= 1;
    } else {
      tile.type = type === "sand" ? "sand" : "dirt";
      tile.h = 0;
      tile.opened = false;
    }

    if (type === "wood") state.stats.wood += 1;
    if (type === "torch") state.stats.torch += 1;
    showMessage(`Collected ${Object.keys(drops).map(shortLabel).join(", ")}.`);
    saveGame(true);
  }

  function getDrops(tile) {
    if (tile.type === "berry") return { wood: 1, berry: 2 };
    if (tile.type === "chest") return { chest: 1 };
    if (tile.type === "bench") return { bench: 1 };
    if (tile.type === "torch") return { torch: 1 };
    return { [tile.type]: 1 };
  }

  function openChest(tile) {
    tile.opened = true;
    const roll = Math.random();
    if (roll < 0.34) {
      addInventory("wood", 3);
      addInventory("berry", 2);
      showMessage("Chest: wood and berries.");
    } else if (roll < 0.68) {
      addInventory("stone", 3);
      addInventory("ore", 1);
      showMessage("Chest: stone and ore.");
    } else {
      const tool = Math.random() < 0.5 ? "axe" : "shovel";
      state.tools[tool] = true;
      showMessage(`Chest: ${toolNames[tool]} found.`);
    }
  }

  function addInventory(key, count) {
    state.inventory[key] = (state.inventory[key] || 0) + count;
  }

  function attackEnemy(target = null) {
    const enemy = target || closestEnemy(1.8);
    if (!enemy) {
      showMessage("No slime in range.");
      return;
    }
    enemy.hp -= state.selectedTool === "axe" && state.tools.axe ? 2 : 1;
    if (enemy.hp <= 0) {
      state.enemies = state.enemies.filter((item) => item !== enemy);
      addInventory("slime", 1);
      if (Math.random() < 0.5) addInventory("berry", 1);
      showMessage("Slime defeated.");
    } else {
      showMessage("Hit slime.");
    }
    saveGame(true);
  }

  function closestEnemy(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  function eatFood() {
    if ((state.inventory.berry || 0) <= 0) {
      showMessage("No berries to eat.");
      return;
    }
    state.inventory.berry -= 1;
    state.food = clamp(state.food + 28, 0, 100);
    state.hp = clamp(state.hp + 3, 0, 100);
    showMessage("Berry eaten.");
    saveGame(true);
  }

  function craft(recipe) {
    if (!canCraft(recipe)) {
      showMessage("Not enough materials.");
      return;
    }
    for (const [key, count] of Object.entries(recipe.cost)) state.inventory[key] -= count;
    if (recipe.gain) {
      for (const [key, count] of Object.entries(recipe.gain)) addInventory(key, count);
    }
    if (recipe.tool) state.tools[recipe.tool] = true;
    if (recipe.id === "bench") state.stats.bench += 1;
    if (recipe.id === "torch") state.stats.torch += 1;
    showMessage(`${recipe.label} crafted.`);
    renderCraftList();
    saveGame(true);
  }

  function canCraft(recipe) {
    if (recipe.tool && state.tools[recipe.tool]) return false;
    return Object.entries(recipe.cost).every(([key, count]) => (state.inventory[key] || 0) >= count);
  }

  function renderCraftList() {
    craftList.innerHTML = recipes.map((recipe) => {
      const cost = Object.entries(recipe.cost).map(([key, count]) => `${shortLabel(key)} x${count}`).join(" + ");
      const disabled = canCraft(recipe) ? "" : " disabled";
      return `<button class="recipe-button${disabled}" data-recipe="${recipe.id}" type="button">
        <span><strong>${recipe.label}</strong><span>${cost}</span></span>
        <span>${recipe.tool && state.tools[recipe.tool] ? "Owned" : "Make"}</span>
      </button>`;
    }).join("");
  }

  function showMessage(message) {
    state.message = message;
    state.messageUntil = performance.now() + 1700;
  }

  function setAction(action) {
    state.action = action;
    showMessage(`${action} mode.`);
  }

  function setJoystick(pointerX, pointerY) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointerX - cx;
    const dy = pointerY - cy;
    const max = 37;
    const len = Math.hypot(dx, dy);
    const scale = len > max ? max / len : 1;
    const x = dx * scale;
    const y = dy * scale;

    state.input.x = x / max;
    state.input.y = y / max;
    stickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  function resetJoystick() {
    state.input.x = 0;
    state.input.y = 0;
    state.input.pointerId = null;
    stickThumb.style.transform = "translate(-50%, -50%)";
  }

  function frame(time) {
    if (!frame.lastTime) frame.lastTime = time;
    const dt = Math.min(0.033, (time - frame.lastTime) / 1000);
    frame.lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.input.pointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    setJoystick(event.clientX, event.clientY);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (state.input.pointerId !== event.pointerId) return;
    event.preventDefault();
    setJoystick(event.clientX, event.clientY);
  });

  joystick.addEventListener("pointerup", resetJoystick);
  joystick.addEventListener("pointercancel", resetJoystick);

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const enemy = screenToEnemy(event.clientX, event.clientY);
    if (enemy && state.action === "attack") {
      attackEnemy(enemy);
      return;
    }
    state.touch.startX = event.clientX;
    state.touch.startY = event.clientY;
    state.touch.tile = screenToTile(event.clientX, event.clientY);
    state.touch.longPressed = false;
    clearTimeout(state.touch.timer);
    state.touch.timer = window.setTimeout(() => {
      state.touch.longPressed = true;
      handleTileAction(state.touch.tile, true);
    }, LONG_PRESS_MS);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (Math.hypot(event.clientX - state.touch.startX, event.clientY - state.touch.startY) > 12) {
      clearTimeout(state.touch.timer);
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    event.preventDefault();
    clearTimeout(state.touch.timer);
    if (!state.touch.longPressed) {
      handleTileAction(screenToTile(event.clientX, event.clientY));
    }
  });

  canvas.addEventListener("pointercancel", () => clearTimeout(state.touch.timer));

  blockBar.addEventListener("click", (event) => {
    const button = event.target.closest(".block-option");
    if (!button) return;
    state.selected = button.dataset.block;
    state.action = "place";
    showMessage(`${blockDefs[state.selected].label} selected.`);
  });

  toolBar.addEventListener("click", (event) => {
    const button = event.target.closest(".tool-option");
    if (!button) return;
    const tool = button.dataset.tool;
    if (!state.tools[tool]) {
      showMessage(`Craft ${toolNames[tool]} first.`);
      return;
    }
    state.selectedTool = tool;
    showMessage(`${toolNames[tool]} selected.`);
  });

  placeButton.addEventListener("click", () => setAction("place"));
  breakButton.addEventListener("click", () => setAction("break"));
  attackButton.addEventListener("click", () => {
    setAction("attack");
    attackEnemy();
  });
  eatButton.addEventListener("click", eatFood);
  craftButton.addEventListener("click", () => {
    renderCraftList();
    craftPanel.classList.add("show");
  });
  closeCraftButton.addEventListener("click", () => craftPanel.classList.remove("show"));
  craftPanel.addEventListener("click", (event) => {
    if (event.target === craftPanel) craftPanel.classList.remove("show");
  });
  craftList.addEventListener("click", (event) => {
    const button = event.target.closest(".recipe-button");
    if (!button) return;
    const recipe = recipes.find((item) => item.id === button.dataset.recipe);
    if (recipe) craft(recipe);
  });

  startButton.addEventListener("click", () => {
    state.tutorialSeen = true;
    tutorialPanel.classList.remove("show");
    saveGame(true);
  });

  resetButton.addEventListener("click", () => {
    const fresh = createGameState();
    Object.assign(state, fresh);
    tutorialPanel.classList.add("show");
    saveGame(true);
    showMessage("World reset.");
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.input.x = -1;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.input.x = 1;
    if (event.code === "ArrowUp" || event.code === "KeyW") state.input.y = -1;
    if (event.code === "ArrowDown" || event.code === "KeyS") state.input.y = 1;
    if (event.code === "Space") attackEnemy();
  });

  window.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) state.input.x = 0;
    if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(event.code)) state.input.y = 0;
  });

  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pagehide", () => saveGame(true));

  resizeCanvas();
  if (state.tutorialSeen) tutorialPanel.classList.remove("show");
  renderCraftList();
  updateHud();
  requestAnimationFrame(frame);
})();
