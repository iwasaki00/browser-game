(() => {
  const MAP_SIZE = 32;
  const TILE_W = 54;
  const TILE_H = 28;
  const HEIGHT_STEP = 13;
  const STORAGE_KEY = "blockPocketSandbox:v1";
  const LONG_PRESS_MS = 430;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const joystick = document.getElementById("joystick");
  const stickThumb = document.getElementById("stickThumb");
  const blockBar = document.getElementById("blockBar");
  const breakButton = document.getElementById("breakButton");
  const resetButton = document.getElementById("resetButton");
  const positionText = document.getElementById("positionText");
  const modeText = document.getElementById("modeText");
  const hintText = document.getElementById("hintText");

  const blockDefs = {
    grass: { top: "#68c95b", left: "#4b9c43", right: "#58ae4e", passable: true },
    dirt: { top: "#b87943", left: "#8d572e", right: "#9c6234", passable: true },
    stone: { top: "#a3adb4", left: "#737d84", right: "#88939a", passable: true },
    wood: { top: "#c98939", left: "#8f5d2a", right: "#a46b31", passable: true },
    water: { top: "#54b8f2", left: "#2e89c9", right: "#3da0df", passable: false }
  };

  const state = {
    width: 390,
    height: 720,
    map: loadMap(),
    selected: "grass",
    breakMode: false,
    player: { x: 16.5, y: 16.5, vx: 0, vy: 0, dirX: 0, dirY: 1 },
    input: { x: 0, y: 0, pointerId: null },
    touch: { timer: 0, startX: 0, startY: 0, tile: null, longPressed: false },
    messageUntil: 0,
    message: "Move with the stick. Tap a tile to place. Hold or use Break to remove.",
    lastSave: 0
  };

  function createMap() {
    const map = [];
    const waterCx = 7 + Math.random() * 5;
    const waterCy = 22 + Math.random() * 5;
    const stoneCx = 22 + Math.random() * 5;
    const stoneCy = 8 + Math.random() * 6;

    for (let y = 0; y < MAP_SIZE; y += 1) {
      const row = [];
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const edge = Math.min(x, y, MAP_SIZE - 1 - x, MAP_SIZE - 1 - y);
        const waterDist = Math.hypot(x - waterCx, y - waterCy);
        const stoneDist = Math.hypot(x - stoneCx, y - stoneCy);
        const noise = seededNoise(x, y);
        let type = "grass";
        let h = noise > 0.7 ? 2 : noise > 0.38 ? 1 : 0;

        if (waterDist < 5.1 + noise * 1.6 || edge === 0) {
          type = "water";
          h = 0;
        } else if (stoneDist < 4.8 || noise > 0.86) {
          type = "stone";
          h = Math.min(3, 1 + Math.floor(noise * 3));
        } else if (noise < 0.16) {
          type = "dirt";
          h = 0;
        }

        if (x > 13 && x < 19 && y > 13 && y < 19) {
          type = "grass";
          h = 0;
        }

        row.push({ type, h });
      }
      map.push(row);
    }

    for (let i = 0; i < 48; i += 1) {
      const x = 2 + Math.floor(Math.random() * (MAP_SIZE - 4));
      const y = 2 + Math.floor(Math.random() * (MAP_SIZE - 4));
      const tile = map[y][x];
      if (tile.type === "grass" || tile.type === "dirt") {
        tile.type = "wood";
        tile.h = Math.max(1, Math.min(3, tile.h + 1 + Math.floor(Math.random() * 2)));
      }
    }

    return map;
  }

  function seededNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function loadMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === MAP_SIZE && parsed[0]?.length === MAP_SIZE) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    const map = createMap();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return map;
  }

  function saveMap(force = false) {
    const now = performance.now();
    if (!force && now - state.lastSave < 280) return;
    state.lastSave = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.map));
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

  function canStandAt(x, y) {
    const tile = getTile(Math.floor(x), Math.floor(y));
    if (!tile || !blockDefs[tile.type].passable) return false;
    return tile.h <= 2;
  }

  function update(dt) {
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

    updateHud();
  }

  function updateHud() {
    positionText.textContent = `${Math.floor(state.player.x)},${Math.floor(state.player.y)}`;
    modeText.textContent = state.breakMode ? "BREAK" : `BUILD ${state.selected.toUpperCase()}`;
    breakButton.classList.toggle("active", state.breakMode);
    breakButton.setAttribute("aria-pressed", String(state.breakMode));

    if (performance.now() < state.messageUntil) {
      hintText.textContent = state.message;
    } else {
      hintText.textContent = "Tap a tile to place. Long press or Break removes blocks.";
    }
  }

  function draw() {
    drawBackground();
    drawWorld();
    drawPlayer();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    sky.addColorStop(0, "#8edcff");
    sky.addColorStop(0.58, "#eaf8c7");
    sky.addColorStop(1, "#95cd66");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.fillStyle = "rgba(255,255,255,0.38)";
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
    const def = blockDefs[tile.type];

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
    if (tile.type === "stone") drawStoneDetails(top.x, top.y);
    if (tile.type === "water") drawWaterDetails(top.x, top.y);
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

  function drawStoneDetails(x, y) {
    ctx.strokeStyle = "rgba(74,86,92,0.32)";
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

  function drawPlayer() {
    const tile = getTile(Math.floor(state.player.x), Math.floor(state.player.y));
    const pos = worldToScreen(state.player.x, state.player.y, tile ? tile.h : 0);

    ctx.save();
    ctx.translate(pos.x, pos.y - 18);
    ctx.fillStyle = "rgba(30,45,36,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 29, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3166d6";
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

  function placeOrBreak(tilePos, forceBreak = false) {
    if (!tilePos) return;
    const tile = getTile(tilePos.x, tilePos.y);
    const playerTileX = Math.floor(state.player.x);
    const playerTileY = Math.floor(state.player.y);
    if (!tile || (tilePos.x === playerTileX && tilePos.y === playerTileY)) {
      showMessage("You cannot edit under the player.");
      return;
    }

    if (state.breakMode || forceBreak) {
      if (tile.type === "water") {
        tile.type = "dirt";
        tile.h = 0;
      } else if (tile.h > 0) {
        tile.h -= 1;
      } else {
        tile.type = "dirt";
      }
      showMessage("Block removed.");
    } else {
      tile.type = state.selected;
      tile.h = state.selected === "water" ? 0 : clamp(tile.h + 1, 0, 3);
      showMessage(`${state.selected} placed.`);
    }
    saveMap(true);
  }

  function showMessage(message) {
    state.message = message;
    state.messageUntil = performance.now() + 1500;
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
    state.touch.startX = event.clientX;
    state.touch.startY = event.clientY;
    state.touch.tile = screenToTile(event.clientX, event.clientY);
    state.touch.longPressed = false;
    clearTimeout(state.touch.timer);
    state.touch.timer = window.setTimeout(() => {
      state.touch.longPressed = true;
      placeOrBreak(state.touch.tile, true);
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
      placeOrBreak(screenToTile(event.clientX, event.clientY));
    }
  });

  canvas.addEventListener("pointercancel", () => clearTimeout(state.touch.timer));

  blockBar.addEventListener("click", (event) => {
    const button = event.target.closest(".block-option");
    if (!button) return;
    state.selected = button.dataset.block;
    state.breakMode = false;
    document.querySelectorAll(".block-option").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    showMessage(`${state.selected} selected.`);
  });

  breakButton.addEventListener("click", () => {
    state.breakMode = !state.breakMode;
    showMessage(state.breakMode ? "Break mode on." : "Build mode on.");
  });

  resetButton.addEventListener("click", () => {
    state.map = createMap();
    state.player.x = 16.5;
    state.player.y = 16.5;
    saveMap(true);
    showMessage("Map reset.");
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.input.x = -1;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.input.x = 1;
    if (event.code === "ArrowUp" || event.code === "KeyW") state.input.y = -1;
    if (event.code === "ArrowDown" || event.code === "KeyS") state.input.y = 1;
  });

  window.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) state.input.x = 0;
    if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(event.code)) state.input.y = 0;
  });

  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pagehide", () => saveMap(true));

  resizeCanvas();
  updateHud();
  requestAnimationFrame(frame);
})();
