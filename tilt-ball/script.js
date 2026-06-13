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
  const virtualPad = document.getElementById("virtualPad");

  const storageKey = "tiltBallBestTime";
  const board = { x: 26, y: 78, w: 338, h: 474, wall: 12 };
  const startPoint = { x: 72, y: 500 };
  const goal = { x: 315, y: 122, r: 21 };
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
    bounce: 0.58,
    maxSpeed: 360,
    holePull: 7
  };

  const state = {
    mode: "title",
    ball: makeBall(),
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
    bestTime: loadBestTime(),
    sensorAvailable: false,
    sensorPermissionAsked: false,
    lastMessage: ""
  };

  function makeBall() {
    return { x: startPoint.x, y: startPoint.y, vx: 0, vy: 0, r: 13, angle: 0 };
  }

  function loadBestTime() {
    const raw = localStorage.getItem(storageKey);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function saveBestTime(time) {
    if (!state.bestTime || time < state.bestTime) {
      state.bestTime = time;
      localStorage.setItem(storageKey, String(time));
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

  function resetGame(keepPlaying = true) {
    state.ball = makeBall();
    state.elapsed = 0;
    state.startedAt = performance.now();
    state.mode = keepPlaying ? "playing" : "title";
    setOverlay(resultOverlay, false);
    updateHud();
  }

  async function requestMotionPermission() {
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
    resetGame(true);
  }

  function finishGame(clear) {
    state.mode = clear ? "clear" : "miss";
    if (clear) saveBestTime(state.elapsed);
    resultLabel.textContent = clear ? "CLEAR" : "MISS";
    resultTitle.textContent = clear ? "クリア" : "落とし穴";
    resultDetail.textContent = clear
      ? `Time ${formatTime(state.elapsed)}`
      : "リトライしてゴールを目指してください";
    setOverlay(resultOverlay, true);
    updateHud();
  }

  function formatTime(value) {
    return value > 0 ? value.toFixed(2) : "--";
  }

  function updateHud() {
    timeText.textContent = formatTime(state.elapsed);
    bestText.textContent = formatTime(state.bestTime);
    sensitivityText.textContent = `${state.sensitivity.toFixed(1)}x`;
    tiltText.textContent = `beta ${state.beta.toFixed(1)} / gamma ${state.gamma.toFixed(1)}`;
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

    if (state.mode !== "playing") {
      updateHud();
      return;
    }

    state.elapsed = (performance.now() - state.startedAt) / 1000;
    updateBall(dt);
    updateHud();
  }

  function updateBall(dt) {
    const ball = state.ball;
    const ax = clamp(state.gamma / 24, -1.5, 1.5) * physics.gravityScale * state.sensitivity;
    const ay = clamp(state.beta / 24, -1.5, 1.5) * physics.gravityScale * state.sensitivity;

    ball.vx += ax * dt;
    ball.vy += ay * dt;
    ball.vx *= Math.pow(physics.friction, dt * 60);
    ball.vy *= Math.pow(physics.friction, dt * 60);

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > physics.maxSpeed) {
      ball.vx = (ball.vx / speed) * physics.maxSpeed;
      ball.vy = (ball.vy / speed) * physics.maxSpeed;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += (ball.vx * dt) / ball.r;

    collideOuterWalls(ball);
    for (const wall of walls) collideRect(ball, wall);

    for (const trap of traps) {
      if (isInHole(ball, trap, 0.78)) {
        pullIntoHole(ball, trap);
        finishGame(false);
        return;
      }
    }

    if (isInHole(ball, goal, 0.82)) {
      pullIntoHole(ball, goal);
      finishGame(true);
    }
  }

  function collideOuterWalls(ball) {
    const left = board.x + board.wall + ball.r;
    const right = board.x + board.w - board.wall - ball.r;
    const top = board.y + board.wall + ball.r;
    const bottom = board.y + board.h - board.wall - ball.r;

    if (ball.x < left) {
      ball.x = left;
      ball.vx = Math.abs(ball.vx) * physics.bounce;
    } else if (ball.x > right) {
      ball.x = right;
      ball.vx = -Math.abs(ball.vx) * physics.bounce;
    }

    if (ball.y < top) {
      ball.y = top;
      ball.vy = Math.abs(ball.vy) * physics.bounce;
    } else if (ball.y > bottom) {
      ball.y = bottom;
      ball.vy = -Math.abs(ball.vy) * physics.bounce;
    }
  }

  function collideRect(ball, rect) {
    const nearestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const dist = Math.hypot(dx, dy);
    if (dist >= ball.r || dist === 0) return;

    const overlap = ball.r - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= (1 + physics.bounce) * dot * nx;
      ball.vy -= (1 + physics.bounce) * dot * ny;
    }
  }

  function isInHole(ball, hole, ratio) {
    const dist = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    return dist < hole.r * ratio;
  }

  function pullIntoHole(ball, hole) {
    ball.x += (hole.x - ball.x) / physics.holePull;
    ball.y += (hole.y - ball.y) / physics.holePull;
    ball.vx = 0;
    ball.vy = 0;
  }

  function draw() {
    drawTable();
    drawBoard();
    drawHoles();
    drawWalls();
    drawStartMark();
    drawBall();
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
    drawHole(goal, "#102f27", "#49b896");
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "700 12px Hiragino Sans, sans-serif";
    ctx.fillText("GOAL", goal.x - 16, goal.y + 4);
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
    ctx.strokeStyle = "rgba(31, 122, 109, 0.52)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBall() {
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
  retryButton.addEventListener("click", () => resetGame(true));
  resetButton.addEventListener("click", () => resetGame(state.mode !== "title"));
  sensitivitySlider.addEventListener("input", () => {
    state.sensitivity = Number(sensitivitySlider.value);
    updateHud();
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
