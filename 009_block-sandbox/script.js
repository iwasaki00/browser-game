(() => {
  "use strict";

  const TILE = 24;
  const MAP_W = 240;
  const MAP_H = 72;
  const SAVE_KEY = "frontierBelow:v1";
  const OLD_KEYS = ["blockPocketSandbox:v1", "blockPocketSandbox:v2"];
  const MAX_SLIMES = 6;
  const REACH = TILE * 5.2;
  const DAY_SECONDS = 210;

  const BLOCK = Object.freeze({
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAF: 5,
    ORE: 6,
    BENCH: 7,
    TORCH: 8,
    CHEST: 9
  });

  const defs = {
    [BLOCK.AIR]: { key: "air", name: "Air", solid: false, hardness: 0, color: "transparent" },
    [BLOCK.GRASS]: { key: "grass", name: "Grass", solid: true, hardness: 0.55, color: "#63bd4d", drop: "dirt", tool: "hand" },
    [BLOCK.DIRT]: { key: "dirt", name: "Dirt", solid: true, hardness: 0.48, color: "#985b32", drop: "dirt", tool: "hand" },
    [BLOCK.STONE]: { key: "stone", name: "Stone", solid: true, hardness: 1.7, color: "#747f85", drop: "stone", tool: "pick" },
    [BLOCK.WOOD]: { key: "wood", name: "Wood", solid: true, hardness: 1.0, color: "#9d602c", drop: "wood", tool: "axe" },
    [BLOCK.LEAF]: { key: "leaf", name: "Leaves", solid: false, hardness: 0.25, color: "#3c9c4c", drop: null, tool: "hand" },
    [BLOCK.ORE]: { key: "ore", name: "Bright Ore", solid: true, hardness: 2.5, color: "#505b65", drop: "ore", tool: "pick" },
    [BLOCK.BENCH]: { key: "bench", name: "Workbench", solid: true, hardness: 0.9, color: "#b57535", drop: "bench", tool: "axe" },
    [BLOCK.TORCH]: { key: "torch", name: "Torch", solid: false, hardness: 0.16, color: "#f4bb3d", drop: "torch", tool: "hand", light: true },
    [BLOCK.CHEST]: { key: "chest", name: "Cache Box", solid: true, hardness: 1.1, color: "#9b5b29", drop: "chest", tool: "axe" }
  };

  const itemToBlock = {
    dirt: BLOCK.DIRT,
    stone: BLOCK.STONE,
    wood: BLOCK.WOOD,
    bench: BLOCK.BENCH,
    torch: BLOCK.TORCH,
    chest: BLOCK.CHEST
  };

  const toolDefs = {
    hand: { name: "Hand", power: 1, damage: 1, kind: "hand", color: "#d59a62" },
    woodPick: { name: "Wood Pick", power: 1.9, damage: 1, kind: "pick", color: "#9e682f" },
    stonePick: { name: "Stone Pick", power: 3.2, damage: 2, kind: "pick", color: "#758087" },
    woodSword: { name: "Wood Sword", power: 1, damage: 3, kind: "sword", color: "#b77735" }
  };

  const hotbarOrder = ["dirt", "stone", "wood", "ore", "torch", "bench", "chest", "woodPick", "stonePick", "woodSword"];
  const itemNames = {
    dirt: "Dirt",
    stone: "Stone",
    wood: "Wood",
    ore: "Ore",
    torch: "Torch",
    bench: "Bench",
    chest: "Cache",
    gel: "Gel",
    woodPick: "Wood Pick",
    stonePick: "Stone Pick",
    woodSword: "Wood Sword"
  };
  const itemColors = {
    dirt: "#985b32",
    stone: "#747f85",
    wood: "#9d602c",
    ore: "#50b8c6",
    torch: "#f4bb3d",
    bench: "#b57535",
    chest: "#9b5b29",
    gel: "#57c985"
  };

  const recipes = [
    { id: "bench", name: "Workbench", cost: { wood: 5 }, gain: { bench: 1 }, note: "Unlocks advanced crafting" },
    { id: "torch", name: "Torch x2", cost: { wood: 1 }, gain: { torch: 2 }, note: "Lights dark caves" },
    { id: "woodPick", name: "Wood Pick", cost: { wood: 3 }, tool: "woodPick", note: "Mines stone faster" },
    { id: "stonePick", name: "Stone Pick", cost: { wood: 3, stone: 5 }, tool: "stonePick", bench: true, note: "Fast mining tool" },
    { id: "woodSword", name: "Wood Sword", cost: { wood: 3, stone: 3 }, tool: "woodSword", bench: true, note: "Stronger melee attack" }
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const lightCanvas = document.createElement("canvas");
  const lightCtx = lightCanvas.getContext("2d");
  const healthFill = document.getElementById("healthFill");
  const healthText = document.getElementById("healthText");
  const timeText = document.getElementById("timeText");
  const depthText = document.getElementById("depthText");
  const messageText = document.getElementById("messageText");
  const hotbar = document.getElementById("hotbar");
  const leftButton = document.getElementById("leftButton");
  const rightButton = document.getElementById("rightButton");
  const jumpButton = document.getElementById("jumpButton");
  const mineButton = document.getElementById("mineButton");
  const placeButton = document.getElementById("placeButton");
  const attackButton = document.getElementById("attackButton");
  const craftButton = document.getElementById("craftButton");
  const pauseButton = document.getElementById("pauseButton");
  const craftModal = document.getElementById("craftModal");
  const pauseModal = document.getElementById("pauseModal");
  const startModal = document.getElementById("startModal");
  const recipeList = document.getElementById("recipeList");
  const craftNote = document.getElementById("craftNote");
  const closeCraftButton = document.getElementById("closeCraftButton");
  const resumeButton = document.getElementById("resumeButton");
  const saveButton = document.getElementById("saveButton");
  const resetButton = document.getElementById("resetButton");
  const startButton = document.getElementById("startButton");

  let state = loadGame();

  function blankInventory() {
    return { dirt: 12, stone: 0, wood: 0, ore: 0, torch: 2, bench: 0, chest: 0, gel: 0 };
  }

  function blankTools() {
    return { hand: true, woodPick: false, stonePick: false, woodSword: false };
  }

  function createNewState() {
    const generated = generateWorld();
    const spawnX = Math.floor(MAP_W * 0.5);
    const player = {
      x: spawnX * TILE + 4,
      y: generated.surface[spawnX] * TILE - 34,
      w: 16,
      h: 34,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1,
      invincible: 0,
      attackCooldown: 0
    };
    return {
      width: 800,
      height: 450,
      map: generated.map,
      surface: generated.surface,
      openedChests: new Set(),
      player,
      spawn: { x: player.x, y: player.y },
      camera: { x: 0, y: 0 },
      input: { left: false, right: false, jumpQueued: false },
      pointer: { tileX: spawnX + 2, tileY: generated.surface[spawnX + 2] - 1, active: true },
      mine: { held: false, key: -1, progress: 0 },
      inventory: blankInventory(),
      tools: blankTools(),
      selected: "dirt",
      hp: 100,
      timeOfDay: 0.28,
      slimes: [],
      spawnTimer: 4,
      paused: false,
      dirty: true,
      lastSave: 0,
      introSeen: false,
      message: "Tap the world to aim.",
      messageUntil: 0,
      attackFlash: 0,
      longPressTimer: 0,
      longPressMining: false
    };
  }

  function generateWorld() {
    const map = new Uint8Array(MAP_W * MAP_H);
    const surface = new Int16Array(MAP_W);
    let drift = 0;

    for (let x = 0; x < MAP_W; x += 1) {
      drift = clamp(drift + (Math.random() - 0.5) * 1.4, -4, 4);
      const wave = Math.sin(x * 0.075) * 2.2 + Math.sin(x * 0.021) * 3.2;
      const top = clamp(Math.round(19 + wave + drift), 13, 28);
      surface[x] = top;
      for (let y = top; y < MAP_H; y += 1) {
        let id = BLOCK.STONE;
        if (y === top) id = BLOCK.GRASS;
        else if (y < top + 5) id = BLOCK.DIRT;
        else {
          const depth = (y - top) / (MAP_H - top);
          const oreChance = 0.018 + depth * 0.08;
          id = Math.random() < oreChance ? BLOCK.ORE : BLOCK.STONE;
        }
        map[indexOf(x, y)] = id;
      }
    }

    for (let cave = 0; cave < 48; cave += 1) {
      let cx = 5 + Math.random() * (MAP_W - 10);
      let cy = surface[Math.floor(cx)] + 7 + Math.random() * 34;
      const steps = 24 + Math.floor(Math.random() * 55);
      for (let step = 0; step < steps; step += 1) {
        const radius = 1.2 + Math.random() * 2.2;
        carveCircle(map, cx, cy, radius);
        cx = clamp(cx + (Math.random() - 0.5) * 3.8, 2, MAP_W - 3);
        cy = clamp(cy + (Math.random() - 0.44) * 2.2, surface[Math.floor(cx)] + 5, MAP_H - 4);
      }
    }

    let treeX = 4;
    while (treeX < MAP_W - 5) {
      treeX += 6 + Math.floor(Math.random() * 8);
      if (treeX >= MAP_W - 4 || Math.abs(treeX - MAP_W * 0.5) < 5) continue;
      addTree(map, surface, treeX);
    }

    let placedChests = 0;
    for (let attempt = 0; attempt < 700 && placedChests < 14; attempt += 1) {
      const x = 4 + Math.floor(Math.random() * (MAP_W - 8));
      const y = surface[x] + 8 + Math.floor(Math.random() * (MAP_H - surface[x] - 12));
      if (getMapBlock(map, x, y) === BLOCK.AIR && isSolidId(getMapBlock(map, x, y + 1))) {
        map[indexOf(x, y)] = BLOCK.CHEST;
        placedChests += 1;
      }
    }

    return { map, surface };
  }

  function carveCircle(map, cx, cy, radius) {
    const minX = Math.max(1, Math.floor(cx - radius));
    const maxX = Math.min(MAP_W - 2, Math.ceil(cx + radius));
    const minY = Math.max(1, Math.floor(cy - radius));
    const maxY = Math.min(MAP_H - 2, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (Math.hypot(x - cx, y - cy) <= radius) map[indexOf(x, y)] = BLOCK.AIR;
      }
    }
  }

  function addTree(map, surface, x) {
    const groundY = surface[x];
    if (getMapBlock(map, x, groundY) !== BLOCK.GRASS) return;
    const height = 3 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= height; i += 1) {
      if (groundY - i > 1) map[indexOf(x, groundY - i)] = BLOCK.WOOD;
    }
    const crownY = groundY - height;
    for (let oy = -2; oy <= 1; oy += 1) {
      for (let ox = -2; ox <= 2; ox += 1) {
        if (Math.abs(ox) + Math.abs(oy) > 3 || (ox === 0 && oy >= 0)) continue;
        const tx = x + ox;
        const ty = crownY + oy;
        if (inBounds(tx, ty) && getMapBlock(map, tx, ty) === BLOCK.AIR) map[indexOf(tx, ty)] = BLOCK.LEAF;
      }
    }
  }

  function indexOf(x, y) {
    return y * MAP_W + x;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  function getMapBlock(map, x, y) {
    if (!inBounds(x, y)) return BLOCK.STONE;
    return map[indexOf(x, y)];
  }

  function getBlock(x, y) {
    return getMapBlock(state.map, x, y);
  }

  function setBlock(x, y, id) {
    if (!inBounds(x, y)) return;
    state.map[indexOf(x, y)] = id;
    state.dirty = true;
  }

  function isSolidId(id) {
    return Boolean(defs[id]?.solid);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.map) && saved.map.length === MAP_W * MAP_H) return hydrateState(saved);
      }
    } catch {
      localStorage.removeItem(SAVE_KEY);
    }
    for (const key of OLD_KEYS) localStorage.removeItem(key);
    return createNewState();
  }

  function hydrateState(saved) {
    const fresh = createNewState();
    fresh.map = Uint8Array.from(saved.map);
    fresh.surface = Int16Array.from(saved.surface || fresh.surface);
    fresh.openedChests = new Set(saved.openedChests || []);
    fresh.player.x = Number.isFinite(saved.player?.x) ? saved.player.x : fresh.player.x;
    fresh.player.y = Number.isFinite(saved.player?.y) ? saved.player.y : fresh.player.y;
    fresh.spawn = saved.spawn || fresh.spawn;
    fresh.hp = clamp(Number(saved.hp) || 100, 1, 100);
    fresh.inventory = { ...blankInventory(), ...saved.inventory };
    fresh.tools = { ...blankTools(), ...saved.tools, hand: true };
    fresh.selected = hotbarOrder.includes(saved.selected) ? saved.selected : "dirt";
    fresh.timeOfDay = Number.isFinite(saved.timeOfDay) ? saved.timeOfDay : 0.28;
    fresh.introSeen = Boolean(saved.introSeen);
    fresh.dirty = false;
    return fresh;
  }

  function saveGame(force = false) {
    const now = performance.now();
    if (!force && (!state.dirty || now - state.lastSave < 5000)) return;
    const payload = {
      map: Array.from(state.map),
      surface: Array.from(state.surface),
      openedChests: Array.from(state.openedChests),
      player: { x: state.player.x, y: state.player.y },
      spawn: state.spawn,
      hp: state.hp,
      inventory: state.inventory,
      tools: state.tools,
      selected: state.selected,
      timeOfDay: state.timeOfDay,
      introSeen: state.introSeen
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      state.lastSave = now;
      state.dirty = false;
    } catch {
      showMessage("Save storage is full.");
    }
  }

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * ratio);
    canvas.height = Math.floor(state.height * ratio);
    lightCanvas.width = Math.max(1, Math.floor(state.width));
    lightCanvas.height = Math.max(1, Math.floor(state.height));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function update(dt) {
    if (state.paused) return;
    updateTime(dt);
    updatePlayer(dt);
    updateMining(dt);
    updateSlimes(dt);
    updateCamera(dt);
    updateHud();
    state.attackFlash = Math.max(0, state.attackFlash - dt);
    saveGame();
  }

  function updateTime(dt) {
    state.timeOfDay = (state.timeOfDay + dt / DAY_SECONDS) % 1;
    state.dirty = true;
  }

  function updatePlayer(dt) {
    const player = state.player;
    const move = Number(state.input.right) - Number(state.input.left);
    const targetVx = move * 176;
    const accel = player.grounded ? 13 : 7;
    player.vx += (targetVx - player.vx) * Math.min(1, accel * dt);
    if (move === 0 && player.grounded) player.vx *= Math.pow(0.0008, dt);
    if (move !== 0) player.facing = move;

    if (state.input.jumpQueued) {
      if (player.grounded) {
        player.vy = -390;
        player.grounded = false;
      }
      state.input.jumpQueued = false;
    }

    player.vy = Math.min(720, player.vy + 1120 * dt);
    player.grounded = false;
    moveBody(player, player.vx * dt, player.vy * dt);
    player.invincible = Math.max(0, player.invincible - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);

    if (player.y > MAP_H * TILE + 80 || state.hp <= 0) respawnPlayer();
  }

  function moveBody(body, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
    const stepX = dx / steps;
    const stepY = dy / steps;
    for (let i = 0; i < steps; i += 1) {
      body.x += stepX;
      if (collides(body.x, body.y, body.w, body.h)) {
        body.x -= stepX;
        body.vx = 0;
      }
      body.y += stepY;
      if (collides(body.x, body.y, body.w, body.h)) {
        body.y -= stepY;
        if (stepY > 0) body.grounded = true;
        body.vy = 0;
      }
    }
  }

  function collides(x, y, w, h) {
    const left = Math.floor((x + 1) / TILE);
    const right = Math.floor((x + w - 2) / TILE);
    const top = Math.floor((y + 1) / TILE);
    const bottom = Math.floor((y + h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (isSolidId(getBlock(tx, ty))) return true;
      }
    }
    return false;
  }

  function updateMining(dt) {
    if (!state.mine.held && !state.longPressMining) {
      state.mine.key = -1;
      state.mine.progress = 0;
      return;
    }
    const { tileX, tileY } = state.pointer;
    if (!canReachTile(tileX, tileY)) {
      state.mine.progress = 0;
      return;
    }
    const id = getBlock(tileX, tileY);
    if (id === BLOCK.AIR) {
      state.mine.progress = 0;
      return;
    }
    const key = indexOf(tileX, tileY);
    if (state.mine.key !== key) {
      state.mine.key = key;
      state.mine.progress = 0;
    }

    if (id === BLOCK.CHEST && !state.openedChests.has(key)) {
      openChest(key);
      state.mine.progress = 0;
      return;
    }

    const block = defs[id];
    const tool = currentTool();
    let power = tool.power;
    if (block.tool === "pick" && tool.kind !== "pick") power *= 0.45;
    if (block.tool === "axe" && tool.kind !== "axe" && tool.kind !== "sword") power *= 0.65;
    state.mine.progress += (power * dt) / block.hardness;
    if (state.mine.progress >= 1) {
      breakBlock(tileX, tileY, id);
      state.mine.progress = 0;
      state.mine.key = -1;
    }
  }

  function breakBlock(x, y, id) {
    const block = defs[id];
    setBlock(x, y, BLOCK.AIR);
    if (block.drop) state.inventory[block.drop] = (state.inventory[block.drop] || 0) + 1;
    if (id === BLOCK.LEAF && Math.random() < 0.18) state.inventory.wood += 1;
    showMessage(`${block.name} collected.`);
    renderHotbar();
  }

  function placeSelected() {
    const item = state.selected;
    const id = itemToBlock[item];
    if (!id) {
      showMessage("Select a block item first.");
      return;
    }
    const { tileX, tileY } = state.pointer;
    if (!canReachTile(tileX, tileY)) {
      showMessage("Target is too far away.");
      return;
    }
    if (getBlock(tileX, tileY) !== BLOCK.AIR) {
      showMessage("That space is occupied.");
      return;
    }
    if ((state.inventory[item] || 0) <= 0) {
      showMessage(`No ${itemNames[item]} available.`);
      return;
    }
    const bx = tileX * TILE;
    const by = tileY * TILE;
    if (rectsOverlap(bx, by, TILE, TILE, state.player.x, state.player.y, state.player.w, state.player.h)) {
      showMessage("You cannot build inside the player.");
      return;
    }
    setBlock(tileX, tileY, id);
    state.inventory[item] -= 1;
    showMessage(`${itemNames[item]} placed.`);
    renderHotbar();
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function canReachTile(tileX, tileY) {
    const px = state.player.x + state.player.w * 0.5;
    const py = state.player.y + state.player.h * 0.45;
    const tx = tileX * TILE + TILE * 0.5;
    const ty = tileY * TILE + TILE * 0.5;
    return Math.hypot(tx - px, ty - py) <= REACH;
  }

  function currentTool() {
    if (state.tools[state.selected] && toolDefs[state.selected]) return toolDefs[state.selected];
    return toolDefs.hand;
  }

  function updateSlimes(dt) {
    state.spawnTimer -= dt;
    const night = isNight();
    if (state.spawnTimer <= 0 && state.slimes.length < MAX_SLIMES) {
      state.spawnTimer = night ? 3.5 + Math.random() * 4 : 8 + Math.random() * 7;
      if (night || Math.random() < 0.48) spawnSlime();
    }

    for (const slime of state.slimes) {
      const dx = state.player.x - slime.x;
      slime.direction = dx < 0 ? -1 : 1;
      slime.vx += (slime.direction * 54 - slime.vx) * Math.min(1, dt * 3.2);
      slime.jumpTimer -= dt;
      const blockedAhead = collides(slime.x + slime.direction * 5, slime.y, slime.w, slime.h);
      if (slime.grounded && (blockedAhead || slime.jumpTimer <= 0)) {
        slime.vy = blockedAhead ? -250 : -185;
        slime.jumpTimer = 1.3 + Math.random() * 1.7;
      }
      slime.vy = Math.min(640, slime.vy + 1050 * dt);
      slime.grounded = false;
      moveBody(slime, slime.vx * dt, slime.vy * dt);
      if (rectsOverlap(slime.x, slime.y, slime.w, slime.h, state.player.x, state.player.y, state.player.w, state.player.h)) {
        damagePlayer(10, slime.direction);
      }
    }
    state.slimes = state.slimes.filter((slime) => slime.hp > 0 && slime.y < MAP_H * TILE + 100);
  }

  function spawnSlime() {
    const playerTile = Math.floor((state.player.x + state.player.w * 0.5) / TILE);
    const side = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp(playerTile + side * (10 + Math.floor(Math.random() * 12)), 3, MAP_W - 4);
    const groundY = findGround(tx, Math.max(0, state.surface[tx] - 8));
    if (groundY < 2) return;
    state.slimes.push({
      x: tx * TILE + 2,
      y: groundY * TILE - 18,
      w: 22,
      h: 18,
      vx: 0,
      vy: 0,
      grounded: false,
      direction: side,
      jumpTimer: Math.random() * 1.5,
      hp: 4
    });
  }

  function findGround(tx, startY) {
    for (let y = clamp(startY, 0, MAP_H - 2); y < MAP_H - 1; y += 1) {
      if (!isSolidId(getBlock(tx, y)) && isSolidId(getBlock(tx, y + 1))) return y + 1;
    }
    return state.surface[tx];
  }

  function attack() {
    const player = state.player;
    if (player.attackCooldown > 0) return;
    player.attackCooldown = 0.38;
    state.attackFlash = 0.18;
    const tool = currentTool();
    const aimX = state.pointer.tileX * TILE + TILE * 0.5;
    player.facing = aimX < player.x + player.w * 0.5 ? -1 : 1;
    let hit = false;
    for (const slime of state.slimes) {
      const sx = slime.x + slime.w * 0.5;
      const sy = slime.y + slime.h * 0.5;
      const px = player.x + player.w * 0.5;
      const py = player.y + player.h * 0.5;
      const inFront = Math.sign(sx - px || player.facing) === player.facing;
      if (inFront && Math.hypot(sx - px, sy - py) < TILE * 3.2) {
        slime.hp -= tool.damage;
        slime.vx = player.facing * 150;
        slime.vy = -100;
        hit = true;
        if (slime.hp <= 0) {
          state.inventory.gel += 1;
          if (Math.random() < 0.22) state.inventory.ore += 1;
          showMessage("Slime defeated. Gel collected.");
          state.dirty = true;
          renderHotbar();
        }
      }
    }
    if (!hit) showMessage("Attack missed.");
  }

  function damagePlayer(amount, knockDirection) {
    if (state.player.invincible > 0) return;
    state.hp = clamp(state.hp - amount, 0, 100);
    state.player.invincible = 1.15;
    state.player.vx = knockDirection * 150;
    state.player.vy = -165;
    state.dirty = true;
    showMessage(`Damage -${amount}`);
  }

  function respawnPlayer() {
    state.hp = 100;
    state.player.x = state.spawn.x;
    state.player.y = state.spawn.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.invincible = 2;
    state.slimes = [];
    showMessage("You returned to the frontier camp.");
    state.dirty = true;
  }

  function openChest(key) {
    state.openedChests.add(key);
    const roll = Math.random();
    if (roll < 0.34) {
      state.inventory.wood += 5;
      state.inventory.torch += 3;
      showMessage("Cache found: wood and torches.");
    } else if (roll < 0.68) {
      state.inventory.stone += 6;
      state.inventory.ore += 3;
      showMessage("Cache found: stone and bright ore.");
    } else if (!state.tools.woodPick) {
      state.tools.woodPick = true;
      showMessage("Cache found: Wood Pick.");
    } else {
      state.inventory.ore += 5;
      state.inventory.chest += 1;
      showMessage("Cache found: ore and a cache box.");
    }
    state.dirty = true;
    renderHotbar();
  }

  function nearWorkbench() {
    if (state.inventory.bench > 0) return true;
    const px = Math.floor((state.player.x + state.player.w * 0.5) / TILE);
    const py = Math.floor((state.player.y + state.player.h * 0.5) / TILE);
    for (let y = py - 4; y <= py + 4; y += 1) {
      for (let x = px - 4; x <= px + 4; x += 1) {
        if (getBlock(x, y) === BLOCK.BENCH) return true;
      }
    }
    return false;
  }

  function canCraft(recipe) {
    if (recipe.tool && state.tools[recipe.tool]) return false;
    if (recipe.bench && !nearWorkbench()) return false;
    return Object.entries(recipe.cost).every(([item, count]) => (state.inventory[item] || 0) >= count);
  }

  function craft(recipe) {
    if (!canCraft(recipe)) {
      showMessage(recipe.bench && !nearWorkbench() ? "A workbench is required." : "Not enough materials.");
      return;
    }
    for (const [item, count] of Object.entries(recipe.cost)) state.inventory[item] -= count;
    if (recipe.gain) {
      for (const [item, count] of Object.entries(recipe.gain)) state.inventory[item] = (state.inventory[item] || 0) + count;
    }
    if (recipe.tool) state.tools[recipe.tool] = true;
    state.dirty = true;
    showMessage(`${recipe.name} crafted.`);
    renderRecipes();
    renderHotbar();
  }

  function updateCamera(dt) {
    const targetX = state.player.x + state.player.w * 0.5 - state.width * 0.5;
    const targetY = state.player.y + state.player.h * 0.5 - state.height * 0.52;
    const maxX = MAP_W * TILE - state.width;
    const maxY = MAP_H * TILE - state.height;
    state.camera.x += (clamp(targetX, 0, Math.max(0, maxX)) - state.camera.x) * Math.min(1, dt * 7);
    state.camera.y += (clamp(targetY, 0, Math.max(0, maxY)) - state.camera.y) * Math.min(1, dt * 7);
  }

  function draw() {
    drawSky();
    drawParallax();
    drawTiles();
    drawChestsAndTorches();
    drawSlimes();
    drawPlayer();
    drawTarget();
    drawLighting();
  }

  function drawSky() {
    const phase = getDayPhase();
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    if (phase === "Night") {
      gradient.addColorStop(0, "#17294e");
      gradient.addColorStop(1, "#42556a");
    } else if (phase === "Dusk" || phase === "Dawn") {
      gradient.addColorStop(0, "#ef995e");
      gradient.addColorStop(1, "#f1d28a");
    } else {
      gradient.addColorStop(0, "#65c4ec");
      gradient.addColorStop(1, "#d7f1c4");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    const celestialX = ((state.timeOfDay + 0.18) % 1) * state.width;
    const celestialY = 76 + Math.sin(state.timeOfDay * Math.PI) * -42;
    ctx.fillStyle = phase === "Night" ? "#e4e9d4" : "#ffe178";
    ctx.beginPath();
    ctx.arc(celestialX, celestialY, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParallax() {
    const horizon = state.surface[Math.floor((state.camera.x + state.width * 0.5) / TILE)] * TILE - state.camera.y;
    ctx.fillStyle = "rgba(55, 118, 74, 0.42)";
    ctx.beginPath();
    ctx.moveTo(0, horizon + 70);
    for (let x = 0; x <= state.width + 40; x += 40) {
      const wx = (x + state.camera.x * 0.22) / 110;
      ctx.lineTo(x, horizon + 25 + Math.sin(wx) * 20 + Math.sin(wx * 0.46) * 18);
    }
    ctx.lineTo(state.width, state.height);
    ctx.lineTo(0, state.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawTiles() {
    const minX = clamp(Math.floor(state.camera.x / TILE) - 1, 0, MAP_W - 1);
    const maxX = clamp(Math.ceil((state.camera.x + state.width) / TILE) + 1, 0, MAP_W - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE) - 1, 0, MAP_H - 1);
    const maxY = clamp(Math.ceil((state.camera.y + state.height) / TILE) + 1, 0, MAP_H - 1);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const id = getBlock(x, y);
        if (id === BLOCK.AIR || id === BLOCK.TORCH || id === BLOCK.CHEST) continue;
        drawBlock(id, x * TILE - state.camera.x, y * TILE - state.camera.y, x, y);
      }
    }
  }

  function drawBlock(id, sx, sy, tx, ty) {
    const def = defs[id];
    ctx.fillStyle = def.color;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), TILE + 1, TILE + 1);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(Math.floor(sx) + 2, Math.floor(sy) + 2, TILE - 4, 3);
    ctx.fillStyle = "rgba(0,0,0,0.13)";
    ctx.fillRect(Math.floor(sx), Math.floor(sy + TILE - 4), TILE + 1, 4);

    if (id === BLOCK.GRASS) {
      ctx.fillStyle = "#82d35b";
      ctx.fillRect(Math.floor(sx), Math.floor(sy), TILE + 1, 6);
    } else if (id === BLOCK.STONE) {
      ctx.fillStyle = "rgba(40,53,58,0.24)";
      ctx.fillRect(Math.floor(sx) + 5 + ((tx * 7 + ty * 3) % 8), Math.floor(sy) + 9, 6, 3);
    } else if (id === BLOCK.ORE) {
      ctx.fillStyle = "#54c3cf";
      ctx.fillRect(Math.floor(sx) + 5, Math.floor(sy) + 6, 5, 5);
      ctx.fillRect(Math.floor(sx) + 14, Math.floor(sy) + 14, 4, 4);
    } else if (id === BLOCK.WOOD) {
      ctx.fillStyle = "rgba(73,38,18,0.34)";
      ctx.fillRect(Math.floor(sx) + 9, Math.floor(sy), 3, TILE);
    } else if (id === BLOCK.LEAF) {
      ctx.fillStyle = "rgba(136,220,104,0.34)";
      ctx.fillRect(Math.floor(sx) + 3, Math.floor(sy) + 3, 8, 6);
      ctx.fillRect(Math.floor(sx) + 14, Math.floor(sy) + 12, 6, 6);
    } else if (id === BLOCK.BENCH) {
      ctx.strokeStyle = "rgba(74,38,15,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 5);
      ctx.lineTo(sx + 20, sy + 19);
      ctx.moveTo(sx + 20, sy + 5);
      ctx.lineTo(sx + 4, sy + 19);
      ctx.stroke();
    }
  }

  function drawChestsAndTorches() {
    const minX = clamp(Math.floor(state.camera.x / TILE) - 1, 0, MAP_W - 1);
    const maxX = clamp(Math.ceil((state.camera.x + state.width) / TILE) + 1, 0, MAP_W - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE) - 1, 0, MAP_H - 1);
    const maxY = clamp(Math.ceil((state.camera.y + state.height) / TILE) + 1, 0, MAP_H - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const id = getBlock(x, y);
        const sx = x * TILE - state.camera.x;
        const sy = y * TILE - state.camera.y;
        if (id === BLOCK.TORCH) drawTorch(sx, sy);
        if (id === BLOCK.CHEST) drawChest(sx, sy, state.openedChests.has(indexOf(x, y)));
      }
    }
  }

  function drawTorch(sx, sy) {
    ctx.fillStyle = "#72502d";
    ctx.fillRect(Math.floor(sx + 10), Math.floor(sy + 9), 4, 14);
    ctx.fillStyle = Math.sin(performance.now() * 0.012) > 0 ? "#ffd957" : "#ff9f38";
    ctx.beginPath();
    ctx.arc(sx + 12, sy + 7, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChest(sx, sy, opened) {
    ctx.fillStyle = opened ? "#66503a" : "#a9622c";
    ctx.fillRect(Math.floor(sx + 2), Math.floor(sy + 6), 20, 17);
    ctx.fillStyle = opened ? "#3f342a" : "#d8ae45";
    ctx.fillRect(Math.floor(sx + 10), Math.floor(sy + 12), 4, 6);
    ctx.strokeStyle = "rgba(53,30,16,0.7)";
    ctx.strokeRect(Math.floor(sx + 2.5), Math.floor(sy + 6.5), 19, 16);
  }

  function drawPlayer() {
    const p = state.player;
    const sx = Math.round(p.x - state.camera.x);
    const sy = Math.round(p.y - state.camera.y);
    ctx.save();
    if (p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0) ctx.globalAlpha = 0.38;
    ctx.fillStyle = "rgba(15,28,19,0.24)";
    ctx.beginPath();
    ctx.ellipse(sx + p.w / 2, sy + p.h + 2, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2e6fb1";
    ctx.fillRect(sx + 2, sy + 15, 12, 15);
    ctx.fillStyle = "#f4c987";
    ctx.fillRect(sx + 3, sy + 3, 11, 13);
    ctx.fillStyle = "#253044";
    const eyeX = p.facing > 0 ? sx + 11 : sx + 5;
    ctx.fillRect(eyeX, sy + 8, 2, 2);
    ctx.fillStyle = "#2b4731";
    ctx.fillRect(sx + 2, sy + 30, 5, 4);
    ctx.fillRect(sx + 10, sy + 30, 5, 4);
    if (state.attackFlash > 0) {
      ctx.strokeStyle = "rgba(255,245,180,0.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      const start = p.facing > 0 ? -0.8 : Math.PI - 0.8;
      ctx.arc(sx + p.w / 2, sy + 18, 30, start, start + 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSlimes() {
    for (const slime of state.slimes) {
      const sx = Math.round(slime.x - state.camera.x);
      const sy = Math.round(slime.y - state.camera.y);
      ctx.fillStyle = "rgba(18,45,29,0.24)";
      ctx.beginPath();
      ctx.ellipse(sx + 11, sy + 19, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#52c97a";
      roundedRectPath(ctx, sx, sy + 2, slime.w, slime.h, 8);
      ctx.fill();
      ctx.fillStyle = "#163a29";
      ctx.fillRect(sx + 6, sy + 8, 2, 3);
      ctx.fillRect(sx + 15, sy + 8, 2, 3);
    }
  }

  function drawTarget() {
    if (!state.pointer.active) return;
    const x = state.pointer.tileX * TILE - state.camera.x;
    const y = state.pointer.tileY * TILE - state.camera.y;
    const reachable = canReachTile(state.pointer.tileX, state.pointer.tileY);
    ctx.strokeStyle = reachable ? "rgba(255,237,111,0.95)" : "rgba(229,82,67,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(x) + 2, Math.floor(y) + 2, TILE - 4, TILE - 4);
    if (state.mine.key === indexOf(state.pointer.tileX, state.pointer.tileY) && state.mine.progress > 0) {
      ctx.fillStyle = "rgba(15,25,18,0.6)";
      ctx.fillRect(x, y - 6, TILE, 4);
      ctx.fillStyle = "#ffe059";
      ctx.fillRect(x, y - 6, TILE * clamp(state.mine.progress, 0, 1), 4);
    }
  }

  function drawLighting() {
    const playerTileY = (state.player.y + state.player.h * 0.5) / TILE;
    const surfaceY = state.surface[clamp(Math.floor(state.player.x / TILE), 0, MAP_W - 1)];
    const underground = clamp((playerTileY - surfaceY + 1) / 10, 0, 0.68);
    const nightDark = isNight() ? 0.28 : getDayPhase() === "Dusk" || getDayPhase() === "Dawn" ? 0.12 : 0;
    const darkness = Math.max(underground, nightDark);
    if (darkness <= 0.02) return;

    lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.fillStyle = `rgba(7, 13, 25, ${darkness})`;
    lightCtx.fillRect(0, 0, state.width, state.height);
    lightCtx.globalCompositeOperation = "destination-out";
    punchLight(lightCtx, state.player.x + state.player.w * 0.5 - state.camera.x, state.player.y + state.player.h * 0.45 - state.camera.y, 82, 0.62);

    const minX = clamp(Math.floor(state.camera.x / TILE) - 2, 0, MAP_W - 1);
    const maxX = clamp(Math.ceil((state.camera.x + state.width) / TILE) + 2, 0, MAP_W - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE) - 2, 0, MAP_H - 1);
    const maxY = clamp(Math.ceil((state.camera.y + state.height) / TILE) + 2, 0, MAP_H - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (getBlock(x, y) === BLOCK.TORCH) punchLight(lightCtx, x * TILE + TILE / 2 - state.camera.x, y * TILE + TILE / 2 - state.camera.y, 120, 0.94);
      }
    }
    lightCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(lightCanvas, 0, 0, state.width, state.height);
  }

  function punchLight(target, x, y, radius, strength) {
    const light = target.createRadialGradient(x, y, 4, x, y, radius);
    light.addColorStop(0, `rgba(0,0,0,${strength})`);
    light.addColorStop(0.58, `rgba(0,0,0,${strength * 0.72})`);
    light.addColorStop(1, "rgba(0,0,0,0)");
    target.fillStyle = light;
    target.beginPath();
    target.arc(x, y, radius, 0, Math.PI * 2);
    target.fill();
  }

  function roundedRectPath(target, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    target.beginPath();
    target.moveTo(x + r, y);
    target.arcTo(x + width, y, x + width, y + height, r);
    target.arcTo(x + width, y + height, x, y + height, r);
    target.arcTo(x, y + height, x, y, r);
    target.arcTo(x, y, x + width, y, r);
    target.closePath();
  }

  function getDayPhase() {
    const t = state.timeOfDay;
    if (t < 0.1) return "Dawn";
    if (t < 0.62) return "Day";
    if (t < 0.75) return "Dusk";
    return "Night";
  }

  function isNight() {
    return getDayPhase() === "Night";
  }

  function updateHud() {
    healthFill.style.width = `${state.hp}%`;
    healthText.textContent = String(Math.ceil(state.hp));
    timeText.textContent = getDayPhase();
    const tx = clamp(Math.floor(state.player.x / TILE), 0, MAP_W - 1);
    const depth = Math.floor((state.player.y + state.player.h) / TILE) - state.surface[tx];
    depthText.textContent = depth < 2 ? "Surface" : depth < 12 ? "Underground" : "Deep Caves";
    if (performance.now() < state.messageUntil) messageText.textContent = state.message;
    else messageText.textContent = targetDescription();
  }

  function targetDescription() {
    const id = getBlock(state.pointer.tileX, state.pointer.tileY);
    const range = canReachTile(state.pointer.tileX, state.pointer.tileY) ? "in range" : "too far";
    return `${defs[id].name} - ${range}`;
  }

  function showMessage(message) {
    state.message = message;
    state.messageUntil = performance.now() + 1800;
    messageText.textContent = message;
  }

  function renderHotbar() {
    hotbar.innerHTML = hotbarOrder.map((item) => {
      const isTool = Boolean(toolDefs[item]);
      const unlocked = isTool ? Boolean(state.tools[item]) : true;
      const count = isTool ? "" : String(state.inventory[item] || 0);
      const color = isTool ? toolDefs[item].color : itemColors[item] || "#777";
      return `<button class="hotbar-slot${state.selected === item ? " selected" : ""}${unlocked ? "" : " locked"}" data-item="${item}" type="button">
        <span class="slot-icon${isTool ? " tool" : ""}" style="--slot-color:${color}"></span>
        <span>${itemNames[item]}</span>
        ${count ? `<strong class="slot-count">${count}</strong>` : ""}
      </button>`;
    }).join("");
  }

  function renderRecipes() {
    const benchReady = nearWorkbench();
    craftNote.textContent = benchReady ? "Workbench recipes are available." : "Carry or stand near a workbench for advanced recipes.";
    recipeList.innerHTML = recipes.map((recipe) => {
      const cost = Object.entries(recipe.cost).map(([item, count]) => `${itemNames[item]} x${count}`).join(" + ");
      const available = canCraft(recipe);
      const owned = recipe.tool && state.tools[recipe.tool];
      return `<button class="recipe-button${available ? "" : " disabled"}" data-recipe="${recipe.id}" type="button">
        <span><strong>${recipe.name}</strong><span>${cost}${recipe.bench ? " / Bench" : ""}<br>${recipe.note}</span></span>
        <span class="make-label">${owned ? "Owned" : "Make"}</span>
      </button>`;
    }).join("");
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    state.pointer.tileX = clamp(Math.floor((screenX + state.camera.x) / TILE), 0, MAP_W - 1);
    state.pointer.tileY = clamp(Math.floor((screenY + state.camera.y) / TILE), 0, MAP_H - 1);
    state.pointer.active = true;
    const playerCenter = state.player.x + state.player.w * 0.5;
    const targetCenter = state.pointer.tileX * TILE + TILE * 0.5;
    if (Math.abs(targetCenter - playerCenter) > 4) state.player.facing = targetCenter < playerCenter ? -1 : 1;
  }

  function bindHoldButton(button, onStart, onEnd) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      onStart();
    });
    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      onEnd();
    });
    button.addEventListener("pointercancel", onEnd);
    button.addEventListener("pointerleave", (event) => {
      if (event.buttons === 0) onEnd();
    });
  }

  function openCraft() {
    state.paused = true;
    renderRecipes();
    craftModal.classList.add("show");
  }

  function closeCraft() {
    craftModal.classList.remove("show");
    state.paused = false;
  }

  function openPause() {
    state.paused = true;
    pauseModal.classList.add("show");
  }

  function closePause() {
    pauseModal.classList.remove("show");
    state.paused = false;
  }

  bindHoldButton(leftButton, () => { state.input.left = true; }, () => { state.input.left = false; });
  bindHoldButton(rightButton, () => { state.input.right = true; }, () => { state.input.right = false; });
  bindHoldButton(mineButton, () => { state.mine.held = true; }, () => { state.mine.held = false; });

  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.input.jumpQueued = true;
  });
  placeButton.addEventListener("click", placeSelected);
  attackButton.addEventListener("click", attack);
  craftButton.addEventListener("click", openCraft);
  pauseButton.addEventListener("click", openPause);
  closeCraftButton.addEventListener("click", closeCraft);
  resumeButton.addEventListener("click", closePause);
  saveButton.addEventListener("click", () => {
    state.dirty = true;
    saveGame(true);
    showMessage("World saved.");
    closePause();
  });
  resetButton.addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    state = createNewState();
    resizeCanvas();
    renderHotbar();
    closePause();
    startModal.classList.add("show");
    state.paused = true;
  });
  startButton.addEventListener("click", () => {
    state.introSeen = true;
    state.paused = false;
    state.dirty = true;
    startModal.classList.remove("show");
    saveGame(true);
  });

  hotbar.addEventListener("click", (event) => {
    const button = event.target.closest(".hotbar-slot");
    if (!button) return;
    const item = button.dataset.item;
    if (toolDefs[item] && !state.tools[item]) {
      showMessage(`Craft ${itemNames[item]} first.`);
      return;
    }
    state.selected = item;
    state.dirty = true;
    renderHotbar();
    showMessage(`${itemNames[item]} selected.`);
  });

  recipeList.addEventListener("click", (event) => {
    const button = event.target.closest(".recipe-button");
    if (!button) return;
    const recipe = recipes.find((entry) => entry.id === button.dataset.recipe);
    if (recipe) craft(recipe);
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setPointerFromEvent(event);
    clearTimeout(state.longPressTimer);
    state.longPressMining = false;
    state.longPressTimer = window.setTimeout(() => {
      state.longPressMining = true;
    }, 360);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons !== 0 || event.pointerType === "touch") setPointerFromEvent(event);
  });
  canvas.addEventListener("pointerup", (event) => {
    event.preventDefault();
    clearTimeout(state.longPressTimer);
    state.longPressMining = false;
  });
  canvas.addEventListener("pointercancel", () => {
    clearTimeout(state.longPressTimer);
    state.longPressMining = false;
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.input.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.input.right = true;
    if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") state.input.jumpQueued = true;
    if (event.code === "KeyE") placeSelected();
    if (event.code === "KeyF") attack();
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.input.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.input.right = false;
  });

  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pagehide", () => saveGame(true));

  function frame(time) {
    if (!frame.lastTime) frame.lastTime = time;
    const dt = Math.min(0.033, (time - frame.lastTime) / 1000);
    frame.lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resizeCanvas();
  renderHotbar();
  renderRecipes();
  updateCamera(1);
  updateHud();
  if (state.introSeen) {
    startModal.classList.remove("show");
    state.paused = false;
  } else {
    state.paused = true;
  }
  requestAnimationFrame(frame);
})();
