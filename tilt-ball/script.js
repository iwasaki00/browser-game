(() => {
  const VIEW = { width: 390, height: 640 };
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startOverlay = document.getElementById("startOverlay");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultLabel = document.getElementById("resultLabel");
  const resultTitle = document.getElementById("resultTitle");
  const resultDetail = document.getElementById("resultDetail");
  const startButton = document.getElementById("startButton");
  const retryButton = document.getElementById("retryButton");
  const resetButton = document.getElementById("resetButton");
  const sensitivitySlider = document.getElementById("sensitivitySlider");
  const sensitivityText = document.getElementById("sensitivityText");
  const timeText = document.getElementById("timeText");
  const bestText = document.getElementById("bestText");
  const tiltText = document.getElementById("tiltText");
  const modeNameText = document.getElementById("modeNameText");
  const startModeName = document.getElementById("startModeName");
  const waterText = document.getElementById("waterText");
  const virtualPad = document.getElementById("virtualPad");
  const modeButtons = [...document.querySelectorAll(".mode-button")];

  const modes = {
    ball: {
      label: "玉ころがし",
      storageKey: "tiltBalanceBestTime:ball"
    },
    water: {
      label: "水バランス",
      storageKey: "tiltBalanceBestTime:water"
    }
  };

  const board = { x: 26, y: 78, w: 338, h: 474, wall: 12 };
  const startPoint = { x: 72, y: 500 };
  const goal = { x: 315, y: 122, r: 21 };
  const waterGoal = { x: 284, y: 95, w: 58, h: 58 };
  const traps = [
    { x: 118, y: 246, r: 18 },
    { x: 262, y: 395, r: 20 }
  ];
  const walls = [
    { x: 80, y: 158, w: 178, h: 14 },
    { x: 236, y: 158, w: 14, h: 122 },
    { x: 112, y: 302, w: 172, h: 14 },
    { x: 112, y: 302, w: 14, h: 106 },
    { x: 174, y: 456, w: 146, h: 14 }
  ];
  const physics = {
    gravityScale: 760,
    friction: 0.988,
    waterFriction: 0.982,
    bounce: 0.58,
    waterBounce: 0.36,
    maxSpeed: 360,
    maxWaterSpeed: 300,
    holePull: 7
  };
  const waterRules = {
    initialCount: 80,
    goalCount: 50,
    failBelow: 30,
    radius: 3.6
  };

  const state = {
    mode: "ball",
    phase: "title",
    ball: makeBall(),
    water: makeWaterParticles(),
    beta: 0,
    gamma: 0,
    targetBeta: 0,
    targetGamma: 0,
    keyX: 0,
    keyY: 0,
    padX: 0,
    padY: 0,
    sensitivity: 1,
    elapsed: 0,
    startedAt: 0,
    bestTimes: {
      ball: loadBestTime("ball"),
      water: loadBestTime("water")
    },
    sensorAvailable: false,
    sensorPermissionAsked: false,
    goalWaterCount: 0
  };

  function makeBall() {
    return { x: startPoint.x, y: startPoint.y, vx: 0, vy: 0, r: 13, angle: 0 };
  }

  function makeWaterParticles() {
    const particles = [];
    const count = shouldReduceWaterCount() ? 50 : waterRules.initialCount;
    for (let i = 0; i < count; i += 1) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      particles.push({
        x: startPoint.x - 18 + col * 4.2 + Math.random() * 1.5,
        y: startPoint.y - 18 + row * 4.2 + Math.random() * 1.5,
        vx: 0,
        vy: 0,
        r: waterRules.radius,
        alive: true,
        phase: Math.random() * Math.PI * 2
      });
    }
    return particles;
  }

  function shouldReduceWaterCount() {
    const memory = navigator.deviceMemory || 8;
    return memory <= 2;
  }

  function loadBestTime(mode) {
    const raw = localStorage.getItem(modes[mode].storageKey);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function saveBestTime(time) {
    const currentBest = state.bestTimes[state.mode];
    if (!currentBest || time < currentBest) {
      state.bestTimes[state.mode] = time;
      localStorage.setItem(modes[state.mode].storageKey, String(time));
    }
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(VIEW.width * ratio);
    canvas.height = Math.floor(VIEW.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setOverlay(element, visible) {
    element.classList.toggle("show", visible);
  }

  function setMode(nextMode) {
    if (!modes[nextMode] || state.mode === nextMode) return;
    state.mode = nextMode;
    resetStage(state.phase !== "title");
  }

  function resetStage(keepPlaying = true) {
    state.ball = makeBall();
    state.water = makeWaterParticles();
    state.goalWaterCount = 0;
    state.elapsed = 0;
    state.startedAt = performance.now();
    state.phase = keepPlaying ? "playing" : "title";
    setOverlay(resultOverlay, false);
    updateHud();
  }

  async function requestMotionPermission() {
    if (state.sensorPermissionAsked) return;
    state.sensorPermissionAsked = true;
    if (!window.DeviceOrientationEvent) {
      state.sensorAvailable = false;
      return;
    }

    const requestPermission = window.DeviceOrientationEvent.requestPermission;
    if (typeof requestPermission === "function") {
      try {
        const result = await requestPermission();
        state.sensorAvailable = result === "granted";
      } catch {
        state.sensorAvailable = false;
      }
    } else {
      state.sensorAvailable = true;
    }

    if (state.sensorAvailable) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
  }

  function handleOrientation(event) {
    const beta = Number.isFinite(event.beta) ? event.beta : 0;
    const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
    state.targetBeta = clamp(beta, -35, 35);
    state.targetGamma = clamp(gamma, -35, 35);
  }

  async function startGame() {
    await requestMotionPermission();
    setOverlay(startOverlay, false);
    virtualPad.classList.toggle("show", !state.sensorAvailable);
    resetStage(true);
  }

  function finishGame(clear) {
    state.phase = clear ? "clear" : "miss";
    if (clear) saveBestTime(state.elapsed);

    resultLabel.textContent = clear ? "CLEAR" : "MISS";
    if (state.mode === "water") {
      resultTitle.textContent = clear ? "水を集めた！" : "水が足りない";
      resultDetail.textContent = clear
        ? `Time ${formatTime(state.elapsed)} / water ${state.goalWaterCount}`
        : `残り水量 ${getAliveWaterCount()} / ${waterRules.failBelow} 未満で失敗`;
    } else {
      resultTitle.textContent = clear ? "クリア" : "落とし穴";
      resultDetail.textContent = clear
        ? `Time ${formatTime(state.elapsed)}`
        : "リトライしてゴールを目指してください";
    }
    setOverlay(resultOverlay, true);
    updateHud();
  }

  function formatTime(value) {
    return value > 0 ? value.toFixed(2) : "--";
  }

  function updateHud() {
    const mode = modes[state.mode];
    modeNameText.textContent = mode.label;
    startModeName.textContent = mode.label;
    timeText.textContent = formatTime(state.elapsed);
    bestText.textContent = formatTime(state.bestTimes[state.mode]);
    sensitivityText.textContent = `${state.sensitivity.toFixed(1)}x`;
    tiltText.textContent = `beta ${state.beta.toFixed(1)} / gamma ${state.gamma.toFixed(1)}`;
    waterText.textContent = `water ${getAliveWaterCount()} / goal ${state.goalWaterCount}`;
    waterText.classList.toggle("show", state.mode === "water");
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === state.mode);
    });
  }

  function getInputTilt() {
    const keyboardTilt = 18;
    const beta = state.sensorAvailable ? state.targetBeta : 0;
    const gamma = state.sensorAvailable ? state.targetGamma : 0;
    return {
      beta: beta + state.keyY * keyboardTilt + state.padY * keyboardTilt,
      gamma: gamma + state.keyX * keyboardTilt + state.padX * keyboardTilt
    };
  }

  function update(dt) {
    const input = getInputTilt();
    state.beta += (input.beta - state.beta) * 0.16;
    state.gamma += (input.gamma - state.gamma) * 0.16;

    if (state.phase !== "playing") {
      updateHud();
      return;
    }

    state.elapsed = (performance.now() - state.startedAt) / 1000;
    if (state.mode === "water") {
      updateWaterMode(dt);
    } else {
      updateBallMode(dt);
    }
    updateHud();
  }

  function updateBallMode(dt) {
    const ball = state.ball;
    const accel = getAcceleration();

    ball.vx += accel.x * dt;
    ball.vy += accel.y * dt;
    ball.vx *= Math.pow(physics.friction, dt * 60);
    ball.vy *= Math.pow(physics.friction, dt * 60);
    limitSpeed(ball, physics.maxSpeed);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += (ball.vx * dt) / ball.r;

    collideOuterWalls(ball, physics.bounce);
    for (const wall of walls) collideRect(ball, wall, physics.bounce);

    for (const trap of traps) {
      if (isInCircle(ball, trap, 0.78)) {
        pullIntoHole(ball, trap);
        finishGame(false);
        return;
      }
    }

    if (isInCircle(ball, goal, 0.82)) {
      pullIntoHole(ball, goal);
      finishGame(true);
    }
  }

  function updateWaterMode(dt) {
    const accel = getAcceleration();
    state.goalWaterCount = 0;

    for (const drop of state.water) {
      if (!drop.alive) continue;
      drop.vx += (accel.x + Math.sin(state.elapsed * 6 + drop.phase) * 6) * dt;
      drop.vy += (accel.y + Math.cos(state.elapsed * 5 + drop.phase) * 5) * dt;
      drop.vx *= Math.pow(physics.waterFriction, dt * 60);
      drop.vy *= Math.pow(physics.waterFriction, dt * 60);
      limitSpeed(drop, physics.maxWaterSpeed);

      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;

      collideOuterWalls(drop, physics.waterBounce);
      for (const wall of walls) collideRect(drop, wall, physics.waterBounce);

      for (const trap of traps) {
        if (isInCircle(drop, trap, 0.92)) {
          drop.alive = false;
          break;
        }
      }

      if (drop.alive && isInWaterGoal(drop)) {
        state.goalWaterCount += 1;
        drop.vx *= 0.9;
        drop.vy *= 0.9;
      }
    }

    if (state.goalWaterCount >= waterRules.goalCount) {
      finishGame(true);
      return;
    }

    if (getAliveWaterCount() < waterRules.failBelow) {
      finishGame(false);
    }
  }

  function getAcceleration() {
    return {
      x: clamp(state.gamma / 24, -1.5, 1.5) * physics.gravityScale * state.sensitivity,
      y: clamp(state.beta / 24, -1.5, 1.5) * physics.gravityScale * state.sensitivity
    };
  }

  function limitSpeed(body, maxSpeed) {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > maxSpeed) {
      body.vx = (body.vx / speed) * maxSpeed;
      body.vy = (body.vy / speed) * maxSpeed;
    }
  }

  function collideOuterWalls(body, bounce) {
    const left = board.x + board.wall + body.r;
    const right = board.x + board.w - board.wall - body.r;
    const top = board.y + board.wall + body.r;
    const bottom = board.y + board.h - board.wall - body.r;

    if (body.x < left) {
      body.x = left;
      body.vx = Math.abs(body.vx) * bounce;
    } else if (body.x > right) {
      body.x = right;
      body.vx = -Math.abs(body.vx) * bounce;
    }

    if (body.y < top) {
      body.y = top;
      body.vy = Math.abs(body.vy) * bounce;
    } else if (body.y > bottom) {
      body.y = bottom;
      body.vy = -Math.abs(body.vy) * bounce;
    }
  }

  function collideRect(body, rect, bounce) {
    const nearestX = clamp(body.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(body.y, rect.y, rect.y + rect.h);
    const dx = body.x - nearestX;
    const dy = body.y - nearestY;
    const dist = Math.hypot(dx, dy);
    if (dist >= body.r || dist === 0) return;

    const overlap = body.r - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    body.x += nx * overlap;
    body.y += ny * overlap;

    const dot = body.vx * nx + body.vy * ny;
    if (dot < 0) {
      body.vx -= (1 + bounce) * dot * nx;
      body.vy -= (1 + bounce) * dot * ny;
    }
  }

  function isInCircle(body, hole, ratio) {
    return Math.hypot(body.x - hole.x, body.y - hole.y) < hole.r * ratio;
  }

  function isInWaterGoal(drop) {
    return (
      drop.x >= waterGoal.x &&
      drop.x <= waterGoal.x + waterGoal.w &&
      drop.y >= waterGoal.y &&
      drop.y <= waterGoal.y + waterGoal.h
    );
  }

  function pullIntoHole(body, hole) {
    body.x += (hole.x - body.x) / physics.holePull;
    body.y += (hole.y - body.y) / physics.holePull;
    body.vx = 0;
    body.vy = 0;
  }

  function getAliveWaterCount() {
    return state.water.reduce((count, drop) => count + (drop.alive ? 1 : 0), 0);
  }

  function draw() {
    drawTable();
    drawBoard();
    drawHoles();
    drawWalls();
    drawStartMark();
    if (state.mode === "water") {
      drawWaterMode();
    } else {
      drawBallMode();
    }
  }

  function drawTable() {
    const bg = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    bg.addColorStop(0, "#5c3c29");
    bg.addColorStop(1, "#2b1b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawBoard() {
    const grain = ctx.createLinearGradient(board.x, board.y, board.x + board.w, board.y + board.h);
    grain.addColorStop(0, "#d9a45f");
    grain.addColorStop(0.5, "#c18442");
    grain.addColorStop(1, "#e0b477");
    roundRect(board.x, board.y, board.w, board.h, 16);
    ctx.fillStyle = grain;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    roundRect(board.x, board.y, board.w, board.h, 16);
    ctx.clip();
    for (let y = board.y + 18; y < board.y + board.h; y += 28) {
      ctx.strokeStyle = "rgba(103, 58, 24, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(board.x + 10, y + Math.sin(y) * 3);
      ctx.bezierCurveTo(board.x + 120, y - 8, board.x + 220, y + 10, board.x + board.w - 12, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.lineWidth = board.wall;
    ctx.strokeStyle = "#6f3d1e";
    roundRect(board.x + board.wall / 2, board.y + board.wall / 2, board.w - board.wall, board.h - board.wall, 12);
    ctx.stroke();
  }

  function drawHoles() {
    for (const trap of traps) drawHole(trap, "#111", "#4a211c");
    if (state.mode === "water") {
      drawWaterGoal();
    } else {
      drawHole(goal, "#102f27", "#49b896");
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "700 12px Hiragino Sans, sans-serif";
      ctx.fillText("GOAL", goal.x - 16, goal.y + 4);
    }
  }

  function drawHole(hole, center, rim) {
    const shadow = ctx.createRadialGradient(hole.x - 4, hole.y - 5, 2, hole.x, hole.y, hole.r);
    shadow.addColorStop(0, "#000");
    shadow.addColorStop(0.74, center);
    shadow.addColorStop(1, rim);
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawWaterGoal() {
    const fillRatio = clamp(state.goalWaterCount / waterRules.goalCount, 0, 1);
    roundRect(waterGoal.x, waterGoal.y, waterGoal.w, waterGoal.h, 12);
    ctx.fillStyle = "rgba(19, 68, 85, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(143, 223, 255, 0.72)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "rgba(57, 177, 238, 0.58)";
    roundRect(
      waterGoal.x + 7,
      waterGoal.y + waterGoal.h - 8 - (waterGoal.h - 16) * fillRatio,
      waterGoal.w - 14,
      (waterGoal.h - 16) * fillRatio,
      8
    );
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "700 10px Hiragino Sans, sans-serif";
    ctx.fillText("TANK", waterGoal.x + 15, waterGoal.y + 31);
  }

  function drawWalls() {
    for (const wall of walls) {
      const wallGradient = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h);
      wallGradient.addColorStop(0, "#7d4926");
      wallGradient.addColorStop(1, "#4f2d19");
      roundRect(wall.x, wall.y, wall.w, wall.h, 5);
      ctx.fillStyle = wallGradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 231, 178, 0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawStartMark() {
    ctx.strokeStyle = state.mode === "water" ? "rgba(47, 155, 230, 0.56)" : "rgba(31, 122, 109, 0.52)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBallMode() {
    const ball = state.ball;
    const shine = ctx.createRadialGradient(ball.x - 5, ball.y - 6, 2, ball.x, ball.y, ball.r + 4);
    shine.addColorStop(0, "#ffffff");
    shine.addColorStop(0.22, "#a7d7f2");
    shine.addColorStop(0.62, "#627685");
    shine.addColorStop(1, "#202832");

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r - 4, -0.4, 1.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawWaterMode() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const drop of state.water) {
      if (!drop.alive) continue;
      const speed = Math.hypot(drop.vx, drop.vy);
      ctx.fillStyle = speed > 120 ? "rgba(78, 186, 255, 0.66)" : "rgba(41, 147, 226, 0.56)";
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r + Math.min(1.8, speed / 130), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(210, 244, 255, 0.48)";
      ctx.beginPath();
      ctx.arc(drop.x - 1.1, drop.y - 1.2, 1.2, 0, Math.PI * 2);
      ctx.fill();
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

  function setKey(code, pressed) {
    if (code === "ArrowLeft") state.keyX = pressed ? -1 : state.keyX === -1 ? 0 : state.keyX;
    if (code === "ArrowRight") state.keyX = pressed ? 1 : state.keyX === 1 ? 0 : state.keyX;
    if (code === "ArrowUp") state.keyY = pressed ? -1 : state.keyY === -1 ? 0 : state.keyY;
    if (code === "ArrowDown") state.keyY = pressed ? 1 : state.keyY === 1 ? 0 : state.keyY;
  }

  function setPadDirection(direction, pressed) {
    const value = pressed ? 1 : 0;
    if (direction === "left") state.padX = -value;
    if (direction === "right") state.padX = value;
    if (direction === "up") state.padY = -value;
    if (direction === "down") state.padY = value;
  }

  function frame(time) {
    if (!frame.lastTime) frame.lastTime = time;
    const dt = Math.min(0.033, (time - frame.lastTime) / 1000);
    frame.lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  startButton.addEventListener("click", startGame);
  retryButton.addEventListener("click", () => resetStage(true));
  resetButton.addEventListener("click", () => resetStage(state.phase !== "title"));
  sensitivitySlider.addEventListener("input", () => {
    state.sensitivity = Number(sensitivitySlider.value);
    updateHud();
  });
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code.startsWith("Arrow")) {
      event.preventDefault();
      setKey(event.code, true);
      virtualPad.classList.add("show");
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code.startsWith("Arrow")) {
      event.preventDefault();
      setKey(event.code, false);
    }
  });

  virtualPad.querySelectorAll("button").forEach((button) => {
    const direction = button.dataset.dir;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setPadDirection(direction, true);
    });
    button.addEventListener("pointerup", () => setPadDirection(direction, false));
    button.addEventListener("pointercancel", () => setPadDirection(direction, false));
    button.addEventListener("pointerleave", () => setPadDirection(direction, false));
  });

  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  updateHud();
  requestAnimationFrame(frame);
})();
