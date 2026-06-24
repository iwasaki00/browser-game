(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const timeText = document.getElementById("timeText");
  const speedText = document.getElementById("speedText");
  const turboText = document.getElementById("turboText");
  const progressBar = document.getElementById("progressBar");
  const surfaceText = document.getElementById("surfaceText");
  const turboButton = document.getElementById("turboButton");
  const startOverlay = document.getElementById("startOverlay");
  const resultOverlay = document.getElementById("resultOverlay");
  const startBestText = document.getElementById("startBestText");
  const resultTime = document.getElementById("resultTime");
  const resultBest = document.getElementById("resultBest");
  const resultTitle = document.getElementById("resultTitle");
  const wheelControl = document.getElementById("wheelControl");
  const steeringWheel = document.getElementById("steeringWheel");

  const COURSE_LENGTH = 5200;
  const POINT_GAP = 80;
  const BEST_KEY = "rallyRushBestTime";
  const view = { width: 390, height: 844, dpr: 1, scale: 1.65, carY: 0 };
  const input = { keyLeft: false, keyRight: false, dragging: false, pointerId: null, dragStartX: 0, dragStartSteer: 0 };
  const state = {
    phase: "title", course: [], obstacles: [], particles: [],
    x: 0, y: 0, angle: 0, velocityX: 0, velocityY: 0, speed: 0,
    steerInput: 0, velocityAngle: 0, driftAngle: 0, isDrifting: false, driftClock: 0,
    elapsed: 0, turbos: 3, turboTime: 0, shake: 0, collisionLock: 0,
    surface: "asphalt", lastTime: 0
  };

  function random(min, max) { return min + Math.random() * (max - min); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function generateCourse() {
    state.course = [];
    state.obstacles = [];
    let x = 0;
    let bend = 0;
    let bendTarget = 0;
    let width = 76;
    let surface = "asphalt";
    const count = Math.ceil(COURSE_LENGTH / POINT_GAP) + 3;

    for (let i = 0; i < count; i += 1) {
      if (i > 2 && i % 4 === 0) bendTarget = random(-12, 12);
      if (i < 4 || i > count - 5) bendTarget = 0;
      bend = lerp(bend, bendTarget, 0.38);
      x += bend;
      width = clamp(width + random(-7, 7), 65, 88);
      if (i > 0 && i % (5 + Math.floor(Math.random() * 3)) === 0) {
        surface = surface === "asphalt" ? "dirt" : "asphalt";
      }
      state.course.push({ y: i * POINT_GAP, x, width, surface });
    }

    for (let y = 180; y < COURSE_LENGTH - 100; y += random(105, 175)) {
      const road = courseAt(y);
      const side = Math.random() < 0.5 ? -1 : 1;
      state.obstacles.push({
        x: road.x + side * (road.width + random(23, 72)), y,
        radius: random(11, 17), type: Math.random() < 0.57 ? "tree" : Math.random() < 0.7 ? "rock" : "sign"
      });
    }
  }

  function courseAt(progress) {
    const p = clamp(progress / POINT_GAP, 0, state.course.length - 2.001);
    const index = Math.floor(p);
    const t = p - index;
    const a = state.course[index];
    const b = state.course[index + 1];
    return { x: lerp(a.x, b.x, t), width: lerp(a.width, b.width, t), surface: a.surface };
  }

  function resetRace(playNow) {
    generateCourse();
    const start = courseAt(0);
    Object.assign(state, {
      phase: playNow ? "playing" : "title", x: start.x, y: 0, angle: 0,
      velocityX: 0, velocityY: 45, speed: 45, steerInput: 0, velocityAngle: 0,
      driftAngle: 0, isDrifting: false, driftClock: 0,
      elapsed: 0, turbos: 3, turboTime: 0,
      shake: 0, collisionLock: 0, surface: "asphalt", particles: []
    });
    input.keyLeft = false;
    input.keyRight = false;
    input.dragging = false;
    wheelControl.classList.remove("dragging");
    resultOverlay.classList.remove("show");
    startOverlay.classList.toggle("show", !playNow);
    updateHud();
  }

  function startRace() { resetRace(true); }

  function useTurbo() {
    if (state.phase !== "playing" || state.turbos <= 0 || state.turboTime > 0) return;
    state.turbos -= 1;
    state.turboTime = 1.2;
    state.shake = 0.15;
    if (navigator.vibrate) navigator.vibrate(25);
    updateHud();
  }

  function update(dt) {
    if (state.phase !== "playing") return;
    updateSteering(dt);
    state.elapsed += dt;
    state.turboTime = Math.max(0, state.turboTime - dt);
    state.shake = Math.max(0, state.shake - dt);
    state.collisionLock = Math.max(0, state.collisionLock - dt);

    const road = courseAt(state.y);
    const distance = Math.abs(state.x - road.x);
    state.surface = distance <= road.width ? road.surface : "offroad";
    const handling = state.surface === "asphalt"
      ? { grip: 6.2, friction: .2, maxSpeed: 176, turn: 1 }
      : state.surface === "dirt"
        ? { grip: 2.25, friction: .36, maxSpeed: 145, turn: 1.12 }
        : { grip: 1.05, friction: 1.15, maxSpeed: 90, turn: .88 };
    const turboActive = state.turboTime > 0;
    state.speed = Math.hypot(state.velocityX, state.velocityY);

    const speedRatio = clamp(state.speed / handling.maxSpeed, 0, 1.35);
    const lowSpeedSteer = clamp(state.speed / 48, .28, 1);
    const highSpeedSteer = lerp(1, .58, clamp(speedRatio, 0, 1));
    const turboSteer = turboActive ? .72 : 1;
    state.angle += state.steerInput * 1.3 * handling.turn * lowSpeedSteer * highSpeedSteer * turboSteer * dt;
    state.angle = normalizeAngle(state.angle);

    const forwardX = Math.sin(state.angle);
    const forwardY = Math.cos(state.angle);
    const acceleration = (state.surface === "offroad" ? 42 : 61) + (turboActive ? 88 : 0);
    state.velocityX += forwardX * acceleration * dt;
    state.velocityY += forwardY * acceleration * dt;

    const maxSpeed = handling.maxSpeed + (turboActive ? 76 : 0);
    state.speed = Math.hypot(state.velocityX, state.velocityY);
    const directionGrip = 1 - Math.exp(-handling.grip * dt);
    state.velocityX = lerp(state.velocityX, forwardX * state.speed, directionGrip);
    state.velocityY = lerp(state.velocityY, forwardY * state.speed, directionGrip);

    const drag = Math.exp(-handling.friction * dt);
    state.velocityX *= drag;
    state.velocityY *= drag;
    state.speed = Math.hypot(state.velocityX, state.velocityY);
    if (state.speed > maxSpeed) {
      const limiter = maxSpeed / state.speed;
      state.velocityX *= lerp(1, limiter, Math.min(1, 3.8 * dt));
      state.velocityY *= lerp(1, limiter, Math.min(1, 3.8 * dt));
    }

    state.velocityAngle = Math.atan2(state.velocityX, state.velocityY);
    state.driftAngle = normalizeAngle(state.angle - state.velocityAngle);
    const driftThreshold = state.surface === "dirt" ? 11 : 15;
    state.isDrifting = state.speed > 72 && Math.abs(state.driftAngle) > driftThreshold * Math.PI / 180;
    if (state.isDrifting) {
      const driftTurn = state.surface === "dirt" ? .3 : .2;
      state.angle += state.steerInput * driftTurn * dt;
      const driftDrag = Math.exp(-(state.surface === "dirt" ? .2 : .3) * dt);
      state.velocityX *= driftDrag;
      state.velocityY *= driftDrag;
    }

    state.x += state.velocityX * dt;
    state.y = Math.max(0, state.y + state.velocityY * dt);
    state.speed = Math.hypot(state.velocityX, state.velocityY);

    checkObstacleCollisions();
    spawnParticles(dt, turboActive);
    updateParticles(dt);
    if (state.y >= COURSE_LENGTH) finishRace();
    updateHud();
  }

  function updateSteering(dt) {
    if (!input.dragging) {
      const keyTarget = (input.keyRight ? 1 : 0) - (input.keyLeft ? 1 : 0);
      const returnRate = keyTarget ? 4.6 : 2.8;
      state.steerInput = moveTowards(state.steerInput, keyTarget, returnRate * dt);
    }
    steeringWheel.style.setProperty("--wheel-angle", `${state.steerInput * 120}deg`);
    wheelControl.setAttribute("aria-valuenow", Math.round(state.steerInput * 100));
  }

  function moveTowards(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    if (value > target) return Math.max(target, value - amount);
    return target;
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function checkObstacleCollisions() {
    if (state.collisionLock > 0) return;
    for (const obstacle of state.obstacles) {
      if (Math.abs(obstacle.y - state.y) > 28) continue;
      if (Math.hypot(obstacle.x - state.x, obstacle.y - state.y) < obstacle.radius + 9) {
        state.velocityX *= -.22;
        state.velocityY *= .3;
        state.speed = Math.hypot(state.velocityX, state.velocityY);
        state.collisionLock = 0.6;
        state.shake = 0.35;
        if (navigator.vibrate) navigator.vibrate(60);
        break;
      }
    }
  }

  function spawnParticles(dt, turboActive) {
    const rearX = state.x - Math.sin(state.angle) * 13;
    const rearY = state.y - Math.cos(state.angle) * 13;
    state.driftClock -= dt;

    if (state.isDrifting && state.driftClock <= 0) {
      state.driftClock = .045;
      const sideX = Math.cos(state.angle) * 7;
      const sideY = -Math.sin(state.angle) * 7;
      for (const side of [-1, 1]) {
        state.particles.push({
          x: rearX + sideX * side, y: rearY + sideY * side,
          vx: 0, vy: 0, life: 1.35, maxLife: 1.35, kind: "mark", size: 3,
          angle: state.velocityAngle
        });
      }
    }

    const dustRate = state.isDrifting ? (state.surface === "dirt" ? 34 : 19) : state.surface === "dirt" ? 9 : state.surface === "offroad" ? 13 : 0;
    if (dustRate && Math.random() < dustRate * dt) {
      state.particles.push({
        x: rearX + random(-8, 8), y: rearY + random(-5, 5), vx: random(-13, 13), vy: random(-21, -5),
        life: .68, maxLife: .68, kind: "dust", size: random(3, 7), angle: 0
      });
    }

    if (turboActive && Math.random() < 38 * dt) {
      state.particles.push({
        x: rearX + random(-5, 5), y: rearY, vx: random(-9, 9), vy: random(-25, -12),
        life: state.isDrifting ? .4 : .27, maxLife: state.isDrifting ? .4 : .27,
        kind: state.isDrifting ? "spark" : "flame", size: random(3, state.isDrifting ? 9 : 6), angle: 0
      });
    }
    while (state.particles.length > 120) state.particles.shift();
  }

  function updateParticles(dt) {
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.size += dt * 8; }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function finishRace() {
    state.phase = "finished";
    const previous = getBest();
    const isRecord = !previous || state.elapsed < previous;
    if (isRecord) localStorage.setItem(BEST_KEY, state.elapsed.toFixed(3));
    const best = isRecord ? state.elapsed : previous;
    resultTitle.textContent = isRecord ? "NEW RECORD!" : "STAGE CLEAR";
    resultTime.textContent = formatTime(state.elapsed);
    resultBest.textContent = `BEST ${formatTime(best)}`;
    resultOverlay.classList.add("show");
  }

  function getBest() { return Number(localStorage.getItem(BEST_KEY)) || 0; }
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
  }

  function updateHud() {
    timeText.textContent = formatTime(state.elapsed);
    speedText.textContent = Math.round(state.speed);
    turboText.textContent = `${"● ".repeat(state.turbos)}${"○ ".repeat(3 - state.turbos)}`.trim();
    progressBar.style.width = `${clamp(state.y / COURSE_LENGTH, 0, 1) * 100}%`;
    surfaceText.textContent = state.surface.toUpperCase();
    surfaceText.className = `surface ${state.surface}`;
    turboButton.classList.toggle("engaged", state.turboTime > 0);
    turboButton.disabled = state.turbos <= 0 || state.phase !== "playing";
  }

  function worldToScreen(x, y) {
    return {
      x: view.width * .5 + (x - state.x) * view.scale,
      y: view.carY - (y - state.y) * view.scale
    };
  }

  function draw() {
    const shakeX = state.shake > 0 ? random(-3, 3) : 0;
    const shakeY = state.shake > 0 ? random(-3, 3) : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawGrass();
    drawRoad();
    drawFinish();
    drawObstacles();
    drawParticles();
    drawCar();
    ctx.restore();
  }

  function drawGrass() {
    ctx.fillStyle = "#285f32";
    ctx.fillRect(-5, -5, view.width + 10, view.height + 10);
    const offset = ((state.y * view.scale) % 42 + 42) % 42;
    ctx.fillStyle = "rgba(151,190,83,.08)";
    for (let y = -42 + offset; y < view.height + 42; y += 42) {
      for (let x = 12; x < view.width; x += 38) {
        const shift = ((Math.floor(y / 42) & 1) * 17);
        ctx.fillRect(x + shift, y, 3, 7);
      }
    }
  }

  function drawRoad() {
    const minY = state.y - (view.height - view.carY) / view.scale - 90;
    const maxY = state.y + view.carY / view.scale + 90;
    const first = clamp(Math.floor(minY / POINT_GAP), 0, state.course.length - 2);
    const last = clamp(Math.ceil(maxY / POINT_GAP), 1, state.course.length - 1);

    for (let i = first; i < last; i += 1) {
      const a = state.course[i];
      const b = state.course[i + 1];
      const al = worldToScreen(a.x - a.width, a.y);
      const ar = worldToScreen(a.x + a.width, a.y);
      const bl = worldToScreen(b.x - b.width, b.y);
      const br = worldToScreen(b.x + b.width, b.y);
      ctx.beginPath();
      ctx.moveTo(al.x, al.y); ctx.lineTo(ar.x, ar.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath();
      ctx.fillStyle = a.surface === "dirt" ? "#95633c" : "#3d4240";
      ctx.fill();
      if (a.surface === "asphalt") {
        ctx.strokeStyle = "rgba(255,255,255,.7)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(al.x, al.y); ctx.lineTo(bl.x, bl.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ar.x, ar.y); ctx.lineTo(br.x, br.y); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(236,190,121,.16)";
        for (let n = 0; n < 3; n += 1) {
          const t = (n + .5) / 3;
          ctx.fillRect(lerp(al.x, ar.x, t), lerp(al.y, bl.y, .5), 2, 2);
        }
      }
    }
  }

  function drawFinish() {
    if (Math.abs(COURSE_LENGTH - state.y) > 450) return;
    const road = courseAt(COURSE_LENGTH);
    const left = worldToScreen(road.x - road.width, COURSE_LENGTH);
    const right = worldToScreen(road.x + road.width, COURSE_LENGTH);
    const tile = Math.max(8, (right.x - left.x) / 12);
    for (let i = 0; i < 12; i += 1) {
      for (let row = 0; row < 2; row += 1) {
        ctx.fillStyle = (i + row) % 2 ? "#111" : "#fff";
        ctx.fillRect(left.x + i * tile, left.y + row * 8, tile + 1, 8);
      }
    }
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      const p = worldToScreen(o.x, o.y);
      if (p.y < -40 || p.y > view.height + 40 || p.x < -40 || p.x > view.width + 40) continue;
      ctx.save(); ctx.translate(p.x, p.y);
      if (o.type === "tree") {
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(5, 8, o.radius, o.radius * .6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#54341f"; ctx.fillRect(-3, 2, 6, o.radius);
        ctx.fillStyle = "#164824"; ctx.beginPath(); ctx.arc(0, -3, o.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2e7434"; ctx.beginPath(); ctx.arc(-4, -7, o.radius * .62, 0, Math.PI * 2); ctx.fill();
      } else if (o.type === "rock") {
        ctx.fillStyle = "#69706a"; ctx.beginPath(); ctx.moveTo(-o.radius, 8); ctx.lineTo(-o.radius*.55,-7); ctx.lineTo(4,-o.radius); ctx.lineTo(o.radius,5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#92988f"; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.fillStyle = "#ddd4b5"; ctx.fillRect(-2, 0, 4, 20); ctx.fillStyle = "#e44722"; ctx.fillRect(-12, -10, 24, 14);
        ctx.fillStyle = "white"; ctx.font = "900 8px Arial"; ctx.textAlign = "center"; ctx.fillText("RALLY", 0, 0);
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.kind === "mark") {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = state.surface === "dirt" ? "rgba(70,43,24,.55)" : "rgba(15,18,16,.6)";
        ctx.fillRect(-p.size * .5, -7, p.size, 14);
        ctx.restore();
      } else {
        ctx.fillStyle = p.kind === "spark"
          ? (p.life > .2 ? "#ffffff" : "#ff9d24")
          : p.kind === "flame"
            ? (p.life > .14 ? "#fff05a" : "#ff541e")
            : "#d9bd8a";
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCar() {
    const x = view.width * .5;
    const y = view.carY;
    ctx.save(); ctx.translate(x, y); ctx.rotate(state.angle);
    if (state.isDrifting) {
      ctx.strokeStyle = state.turboTime > 0 ? "rgba(255,213,63,.9)" : "rgba(255,255,255,.35)";
      ctx.lineWidth = state.turboTime > 0 ? 4 : 2;
      ctx.beginPath(); ctx.arc(0, 0, 25, -2.5, -.65); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.3)"; roundRect(-13, -20, 29, 45, 7); ctx.fill();
    ctx.fillStyle = "#161a19"; ctx.fillRect(-16, -14, 5, 12); ctx.fillRect(11, -14, 5, 12); ctx.fillRect(-16, 8, 5, 12); ctx.fillRect(11, 8, 5, 12);
    const gradient = ctx.createLinearGradient(-13, 0, 13, 0); gradient.addColorStop(0, "#bb260e"); gradient.addColorStop(.45, "#ff5a1f"); gradient.addColorStop(1, "#a6190b");
    ctx.fillStyle = gradient; roundRect(-13, -23, 26, 46, 6); ctx.fill();
    ctx.fillStyle = "#17252b"; ctx.fillRect(-9, -13, 18, 10); ctx.fillStyle = "#9fd2df"; ctx.fillRect(-7, -11, 14, 6);
    ctx.fillStyle = "#fff4b2"; ctx.fillRect(-9, -22, 6, 3); ctx.fillRect(3, -22, 6, 3);
    ctx.fillStyle = "#fff"; ctx.font = "900 11px Arial"; ctx.textAlign = "center"; ctx.fillText("7", 0, 12);
    ctx.restore();
  }

  function roundRect(x, y, w, h, radius) {
    const r = Math.min(radius, w * .5, h * .5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resizeCanvas() {
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.scale = clamp(view.width / 235, 1.35, 2.15);
    view.carY = view.height * .57;
    canvas.width = Math.round(view.width * view.dpr);
    canvas.height = Math.round(view.height * view.dpr);
    canvas.style.width = `${view.width}px`;
    canvas.style.height = `${view.height}px`;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function frame(now) {
    if (!state.lastTime) state.lastTime = now;
    const dt = Math.min(.033, (now - state.lastTime) / 1000);
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function releaseWheel(event) {
    if (event && input.pointerId !== null && event.pointerId !== input.pointerId) return;
    input.dragging = false;
    input.pointerId = null;
    wheelControl.classList.remove("dragging");
  }

  wheelControl.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    input.dragging = true;
    input.pointerId = event.pointerId;
    input.dragStartX = event.clientX;
    input.dragStartSteer = state.steerInput;
    wheelControl.classList.add("dragging");
    wheelControl.setPointerCapture(event.pointerId);
  });
  wheelControl.addEventListener("pointermove", (event) => {
    if (!input.dragging || event.pointerId !== input.pointerId) return;
    event.preventDefault();
    state.steerInput = clamp(input.dragStartSteer + (event.clientX - input.dragStartX) / 72, -1, 1);
  });
  wheelControl.addEventListener("pointerup", releaseWheel);
  wheelControl.addEventListener("pointercancel", releaseWheel);
  wheelControl.addEventListener("lostpointercapture", releaseWheel);
  turboButton.addEventListener("pointerdown", (event) => { event.preventDefault(); useTurbo(); });
  document.getElementById("startButton").addEventListener("click", startRace);
  document.getElementById("retryButton").addEventListener("click", startRace);

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "Space") event.preventDefault();
    if (event.code === "ArrowLeft") input.keyLeft = true;
    if (event.code === "ArrowRight") input.keyRight = true;
    if (event.code === "Space" && !event.repeat) useTurbo();
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft") input.keyLeft = false;
    if (event.code === "ArrowRight") input.keyRight = false;
  });
  window.addEventListener("blur", () => {
    input.keyLeft = false;
    input.keyRight = false;
    releaseWheel();
  });
  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  const best = getBest();
  startBestText.textContent = best ? formatTime(best) : "--:--.--";
  resizeCanvas();
  resetRace(false);
  requestAnimationFrame(frame);
})();
