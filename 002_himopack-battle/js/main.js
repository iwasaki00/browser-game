(function () {
  const {
    Engine,
    World,
    Bodies,
    Body,
    Composite,
    Events,
    Vector,
  } = Matter;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("startOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const messageText = document.getElementById("messageText");
  const scoreValue = document.getElementById("scoreValue");
  const defeatValue = document.getElementById("defeatValue");
  const ropeLengthValue = document.getElementById("ropeLengthValue");
  const springValue = document.getElementById("springValue");
  const sizeValue = document.getElementById("sizeValue");
  const massValue = document.getElementById("massValue");

  const ITEM_TYPES = [
    { key: "ropeLength", label: "紐の長さ", color: "#72f1d3", symbol: "L" },
    { key: "spring", label: "紐の伸縮", color: "#ffd36e", symbol: "S" },
    { key: "size", label: "大きさ", color: "#ff8d8d", symbol: "B" },
    { key: "mass", label: "重さ", color: "#cab3ff", symbol: "W" },
  ];

  const LEVEL_UP_MESSAGES = {
    ropeLength: "紐の最大長さが伸びました。",
    spring: "紐の戻る力が強くなりました。",
    size: "プレイヤーパックが大きくなりました。",
    mass: "プレイヤーパックが重くなりました。",
  };

  const PLAYER_COLOR = "#f8f2da";
  const PLAYER_RING = "#ffb84d";
  const ENEMY_COLORS = ["#78f0f2", "#ff7d8f", "#ffcf70", "#9de06c"];
  const WALL_THICKNESS = 120;
  const ITEM_RADIUS = 14;
  const ENEMY_DEFEAT_SPEED = 11.5;
  const PLAYER_SPEED_LIMIT = 13.5;
  const ENEMY_SPEED_LIMIT = 14.2;

  const engine = Engine.create({
    gravity: { x: 0, y: 0 },
    constraintIterations: 2,
  });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  const world = engine.world;

  let rafId = 0;
  let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let worldWidth = 0;
  let worldHeight = 0;
  let isRunning = false;
  let enemySpawnClock = 0;

  let player = null;
  let playerBaseMass = 1;
  let playerBaseRadius = 24;
  let currentPlayerRadius = playerBaseRadius;
  let walls = [];
  let enemies = [];
  let items = [];

  let score = 0;
  let defeats = 0;
  let lastTime = 0;

  let pointerState = {
    active: false,
    id: null,
    worldX: 0,
    worldY: 0,
  };

  let levels = createDefaultLevels();

  function createDefaultLevels() {
    return {
      ropeLength: 1,
      spring: 1,
      size: 1,
      mass: 1,
    };
  }

  function getRopeLength() {
    return 116 + (levels.ropeLength - 1) * 26;
  }

  function getSpringStrength() {
    return 0.00052 + (levels.spring - 1) * 0.00016;
  }

  function getTargetRadius() {
    return playerBaseRadius * (1 + (levels.size - 1) * 0.11);
  }

  function getTargetMass() {
    return playerBaseMass * (1 + (levels.mass - 1) * 0.34) * Math.pow(currentPlayerRadius / playerBaseRadius, 2);
  }

  function setMessage(text) {
    messageText.textContent = text;
  }

  function updateHud() {
    scoreValue.textContent = String(score);
    defeatValue.textContent = String(defeats);
    ropeLengthValue.textContent = String(levels.ropeLength);
    springValue.textContent = String(levels.spring);
    sizeValue.textContent = String(levels.size);
    massValue.textContent = String(levels.mass);
  }

  function resizeCanvas() {
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const rect = canvas.getBoundingClientRect();
    worldWidth = Math.max(320, Math.round(rect.width));
    worldHeight = Math.max(320, Math.round(rect.height));

    canvas.width = Math.round(worldWidth * dpr);
    canvas.height = Math.round(worldHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildWalls();
    clampBodiesInsideArena();
  }

  function rebuildWalls() {
    if (walls.length > 0) {
      World.remove(world, walls);
    }

    walls = [
      Bodies.rectangle(worldWidth / 2, -WALL_THICKNESS / 2, worldWidth + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true, label: "wall" }),
      Bodies.rectangle(worldWidth / 2, worldHeight + WALL_THICKNESS / 2, worldWidth + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true, label: "wall" }),
      Bodies.rectangle(-WALL_THICKNESS / 2, worldHeight / 2, WALL_THICKNESS, worldHeight + WALL_THICKNESS * 2, { isStatic: true, label: "wall" }),
      Bodies.rectangle(worldWidth + WALL_THICKNESS / 2, worldHeight / 2, WALL_THICKNESS, worldHeight + WALL_THICKNESS * 2, { isStatic: true, label: "wall" }),
    ];

    World.add(world, walls);
  }

  function clampBodiesInsideArena() {
    const allBodies = [player].concat(enemies, items).filter(Boolean);
    for (const body of allBodies) {
      const radius = body.circleRadius || ITEM_RADIUS;
      const x = clamp(body.position.x, radius + 12, worldWidth - radius - 12);
      const y = clamp(body.position.y, radius + 12, worldHeight - radius - 12);
      Body.setPosition(body, { x, y });
    }
  }

  function clearDynamicBodies() {
    if (player) {
      World.remove(world, player);
      player = null;
    }
    if (enemies.length > 0) {
      World.remove(world, enemies);
    }
    if (items.length > 0) {
      World.remove(world, items);
    }
    enemies = [];
    items = [];
  }

  function createPlayer() {
    player = Bodies.circle(worldWidth * 0.34, worldHeight * 0.5, playerBaseRadius, {
      label: "player",
      frictionAir: 0.024,
      friction: 0.012,
      restitution: 0.95,
      density: 0.0024,
      slop: 0.02,
    });
    playerBaseMass = player.mass;
    currentPlayerRadius = playerBaseRadius;
    World.add(world, player);
    applyPlayerStats();
  }

  function applyPlayerStats() {
    const targetRadius = getTargetRadius();
    if (Math.abs(targetRadius - currentPlayerRadius) > 0.01) {
      const scale = targetRadius / currentPlayerRadius;
      Body.scale(player, scale, scale);
      currentPlayerRadius = targetRadius;
    }

    Body.setMass(player, getTargetMass());
  }

  function makeEnemy(x, y, radius, hueIndex) {
    return Bodies.circle(x, y, radius, {
      label: "enemy",
      frictionAir: 0.02,
      friction: 0.01,
      restitution: 0.94,
      density: 0.0021,
      renderColor: ENEMY_COLORS[hueIndex % ENEMY_COLORS.length],
      slop: 0.02,
    });
  }

  function spawnEnemies(count) {
    const spawned = [];
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < count * 30) {
      attempts += 1;
      const radius = randomRange(18, 30);
      const x = randomRange(worldWidth * 0.52, worldWidth - radius - 40);
      const y = randomRange(radius + 40, worldHeight - radius - 40);
      const distanceFromPlayer = Vector.magnitude(Vector.sub({ x, y }, player.position));

      if (distanceFromPlayer < 160) {
        continue;
      }

      const enemy = makeEnemy(x, y, radius, placed + enemies.length);
      enemies.push(enemy);
      spawned.push(enemy);
      placed += 1;
    }

    if (spawned.length > 0) {
      World.add(world, spawned);
    }
  }

  function spawnItem(typeKey) {
    const type = ITEM_TYPES.find((item) => item.key === typeKey);
    if (!type) {
      return;
    }

    let x = worldWidth * 0.5;
    let y = worldHeight * 0.5;
    let attempts = 0;

    while (attempts < 40) {
      attempts += 1;
      x = randomRange(60, worldWidth - 60);
      y = randomRange(60, worldHeight - 60);
      const distanceFromPlayer = Vector.magnitude(Vector.sub({ x, y }, player.position));
      if (distanceFromPlayer > 110) {
        break;
      }
    }

    const item = Bodies.circle(x, y, ITEM_RADIUS, {
      isStatic: true,
      isSensor: true,
      label: "item",
      itemType: type.key,
      renderColor: type.color,
      renderSymbol: type.symbol,
    });

    items.push(item);
    World.add(world, item);
  }

  function ensureItems() {
    for (const type of ITEM_TYPES) {
      const exists = items.some((item) => item.itemType === type.key);
      if (!exists) {
        spawnItem(type.key);
      }
    }
  }

  function removeEnemy(enemy) {
    enemies = enemies.filter((body) => body !== enemy);
    World.remove(world, enemy);
    defeats += 1;
    score += 100;
    setMessage("敵パックを撃破しました。さらにぶつけてスコアを伸ばしましょう。");
    updateHud();
  }

  function applyLevelUp(typeKey) {
    levels[typeKey] += 1;
    applyPlayerStats();
    score += 40;
    setMessage(LEVEL_UP_MESSAGES[typeKey]);
    updateHud();
  }

  function removeItem(item) {
    items = items.filter((body) => body !== item);
    World.remove(world, item);
    applyLevelUp(item.itemType);
    spawnItem(item.itemType);
  }

  function resetGame() {
    clearDynamicBodies();
    levels = createDefaultLevels();
    score = 0;
    defeats = 0;
    enemySpawnClock = 0;
    pointerState.active = false;
    pointerState.id = null;
    canvas.classList.remove("is-dragging");

    createPlayer();
    spawnEnemies(6);
    ensureItems();
    updateHud();
    setMessage("プレイヤーパックの近くをドラッグして紐を引っ張ってください。");
  }

  function beginGame() {
    resetGame();
    overlay.classList.add("is-hidden");
    isRunning = true;
  }

  function toWorldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = worldWidth / rect.width;
    const scaleY = worldHeight / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function canStartDrag(point) {
    const distance = Vector.magnitude(Vector.sub(point, player.position));
    return distance <= getRopeLength() + currentPlayerRadius + 28;
  }

  function handlePointerDown(event) {
    if (!isRunning || pointerState.active) {
      return;
    }

    const point = toWorldPoint(event);
    if (!canStartDrag(point)) {
      return;
    }

    pointerState.active = true;
    pointerState.id = event.pointerId;
    pointerState.worldX = point.x;
    pointerState.worldY = point.y;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!pointerState.active || pointerState.id !== event.pointerId) {
      return;
    }

    const point = toWorldPoint(event);
    pointerState.worldX = point.x;
    pointerState.worldY = point.y;
    event.preventDefault();
  }

  function endPointer(event) {
    if (!pointerState.active || pointerState.id !== event.pointerId) {
      return;
    }

    pointerState.active = false;
    pointerState.id = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
  }

  function getDragAnchor() {
    const raw = { x: pointerState.worldX, y: pointerState.worldY };
    const delta = Vector.sub(raw, player.position);
    const distance = Vector.magnitude(delta);
    const limit = getRopeLength();

    if (distance <= limit || distance === 0) {
      return { point: raw, stretch: distance, delta };
    }

    const normal = Vector.mult(Vector.normalise(delta), limit);
    return {
      point: Vector.add(player.position, normal),
      stretch: limit,
      delta: normal,
    };
  }

  function applyDragForce() {
    if (!pointerState.active) {
      return;
    }

    const { delta, stretch } = getDragAnchor();
    if (stretch < 8) {
      return;
    }

    const forceScale = getSpringStrength() * stretch;
    const direction = Vector.normalise(delta);
    const damping = Vector.mult(player.velocity, -0.00016);
    const force = Vector.add(Vector.mult(direction, forceScale), damping);
    Body.applyForce(player, player.position, force);
  }

  function limitVelocity(body, maxSpeed) {
    const speed = body.speed;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      Body.setVelocity(body, {
        x: body.velocity.x * scale,
        y: body.velocity.y * scale,
      });
    }
  }

  function processDefeats() {
    const toRemove = enemies.filter((enemy) => enemy.speed > ENEMY_DEFEAT_SPEED);
    for (const enemy of toRemove) {
      removeEnemy(enemy);
    }
  }

  function maybeSpawnEnemy(deltaMs) {
    enemySpawnClock += deltaMs;
    if (enemySpawnClock >= 9000) {
      enemySpawnClock = 0;
      spawnEnemies(1);
      setMessage("新しい敵パックが追加されました。");
    }
  }

  function updateSimulation(deltaMs) {
    applyDragForce();
    Engine.update(engine, deltaMs);
    limitVelocity(player, PLAYER_SPEED_LIMIT);

    for (const enemy of enemies) {
      limitVelocity(enemy, ENEMY_SPEED_LIMIT);
    }

    processDefeats();
    ensureItems();
    maybeSpawnEnemy(deltaMs);
  }

  function render() {
    ctx.clearRect(0, 0, worldWidth, worldHeight);

    const bg = ctx.createLinearGradient(0, 0, worldWidth, worldHeight);
    bg.addColorStop(0, "#143149");
    bg.addColorStop(0.55, "#236476");
    bg.addColorStop(1, "#f0c06f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    drawArenaDetails();
    drawItems();
    drawEnemies();
    drawPlayer();
    drawRope();
  }

  function drawArenaDetails() {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(24, 24, worldWidth - 48, worldHeight - 48);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, worldWidth - 48, worldHeight - 48);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(worldWidth / 2, 36);
    ctx.lineTo(worldWidth / 2, worldHeight - 36);
    ctx.stroke();
    ctx.restore();
  }

  function drawCircleBody(body, fillColor, edgeColor) {
    const radius = body.circleRadius;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.shadowColor = "rgba(0, 0, 0, 0.24)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = edgeColor;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-radius * 0.2, -radius * 0.22, radius * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    drawCircleBody(player, PLAYER_COLOR, PLAYER_RING);
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      drawCircleBody(enemy, enemy.renderColor, "rgba(255, 255, 255, 0.28)");
    }
  }

  function drawItems() {
    for (const item of items) {
      ctx.save();
      ctx.translate(item.position.x, item.position.y);
      ctx.beginPath();
      ctx.arc(0, 0, ITEM_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = item.renderColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.stroke();
      ctx.fillStyle = "#102337";
      ctx.font = "bold 14px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.renderSymbol, 0, 1);
      ctx.restore();
    }
  }

  function drawRope() {
    if (!pointerState.active) {
      return;
    }

    const { point, stretch } = getDragAnchor();

    ctx.save();
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = stretch >= getRopeLength() ? "#ffd36e" : "#8ff6f1";
    ctx.beginPath();
    ctx.moveTo(player.position.x, player.position.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#fef3cb";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#174b62";
    ctx.stroke();
    ctx.restore();
  }

  function loop(timestamp) {
    const deltaMs = lastTime ? Math.min(20, timestamp - lastTime) : 16.6667;
    lastTime = timestamp;

    if (isRunning) {
      updateSimulation(deltaMs);
    }
    render();

    rafId = window.requestAnimationFrame(loop);
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes("player") && labels.includes("item")) {
        const item = pair.bodyA.label === "item" ? pair.bodyA : pair.bodyB;
        removeItem(item);
      }
    }
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && pointerState.active) {
      endPointer(event);
    }
  });

  startButton.addEventListener("click", beginGame);
  restartButton.addEventListener("click", () => {
    if (!isRunning) {
      overlay.classList.add("is-hidden");
      isRunning = true;
    }
    resetGame();
  });

  resizeCanvas();
  resetGame();
  render();
  rafId = window.requestAnimationFrame(loop);

  window.addEventListener("beforeunload", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  });
})();
