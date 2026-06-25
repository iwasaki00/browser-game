(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const timeText = document.getElementById("timeText");
  const speedText = document.getElementById("speedText");
  const turboText = document.getElementById("turboText");
  const jumpText = document.getElementById("jumpText");
  const progressBar = document.getElementById("progressBar");
  const surfaceText = document.getElementById("surfaceText");
  const turboButton = document.getElementById("turboButton");
  const jumpButton = document.getElementById("jumpButton");
  const startOverlay = document.getElementById("startOverlay");
  const resultOverlay = document.getElementById("resultOverlay");
  const startBestText = document.getElementById("startBestText");
  const resultTime = document.getElementById("resultTime");
  const resultBest = document.getElementById("resultBest");
  const resultTitle = document.getElementById("resultTitle");
  const wheelControl = document.getElementById("wheelControl");
  const steeringWheel = document.getElementById("steeringWheel");
  const courseSelect = document.getElementById("courseSelect");

  const COURSE_LENGTH = 5600;
  const POINT_GAP = 58;
  const BEST_KEY_PREFIX = "rallyRushBestTime:";
  const view = { width: 390, height: 844, dpr: 1, scale: 1.65, carY: 0 };
  const input = { keyLeft: false, keyRight: false, dragging: false, pointerId: null, dragStartX: 0, dragStartSteer: 0 };

  const COURSE_PROFILES = {
    forest: {
      name: "ビギナー林道", width: 94, widthMin: 82, widthMax: 112, dirt: .28, obstacle: .44,
      obstacleMix: { rock: .25, puddle: .18, log: .18, boulder: .06 },
      sections: [
        ["straight", 2.8], ["gentleLeft", 2.1], ["gentleRight", 2.1],
        ["bigLeft", .7], ["bigRight", .7], ["sCurve", .55]
      ]
    },
    drift: {
      name: "ドリフト峠", width: 88, widthMin: 76, widthMax: 104, dirt: .62, obstacle: .32, gripBonus: -.18,
      obstacleMix: { rock: .15, puddle: .14, log: .1, boulder: .04 },
      sections: [
        ["straight", .75], ["gentleLeft", .85], ["gentleRight", .85],
        ["bigLeft", 2.25], ["bigRight", 2.25], ["sCurve", 2.6], ["hairpinLeft", .9], ["hairpinRight", .9]
      ]
    },
    rocky: {
      name: "岩場ラリー", width: 84, widthMin: 72, widthMax: 100, dirt: .45, obstacle: .72,
      obstacleMix: { rock: .42, puddle: .08, log: .16, boulder: .18 },
      sections: [
        ["straight", .8], ["gentleLeft", .8], ["gentleRight", .8],
        ["bigLeft", 1.3], ["bigRight", 1.3], ["sCurve", .9], ["hairpinLeft", 2.1], ["hairpinRight", 2.1]
      ]
    },
    marsh: {
      name: "沼地ステージ", width: 80, widthMin: 68, widthMax: 96, dirt: .54, obstacle: .66, gripBonus: -.25,
      obstacleMix: { rock: .12, puddle: .56, log: .16, boulder: .06 },
      sections: [
        ["straight", 1], ["gentleLeft", 1.15], ["gentleRight", 1.15],
        ["bigLeft", 1.35], ["bigRight", 1.35], ["sCurve", 1.2], ["hairpinLeft", .55], ["hairpinRight", .55]
      ]
    }
  };

  const SECTION_INFO = {
    straight: { label: "直線", length: [360, 620], delta: [0, 0] },
    gentleLeft: { label: "緩い左", length: [430, 620], delta: [-85, -48], sign: "left" },
    gentleRight: { label: "緩い右", length: [430, 620], delta: [48, 85], sign: "right" },
    bigLeft: { label: "大きな左", length: [520, 760], delta: [-175, -105], sign: "left" },
    bigRight: { label: "大きな右", length: [520, 760], delta: [105, 175], sign: "right" },
    sCurve: { label: "S字", length: [620, 860], delta: [-22, 22], sign: "s" },
    hairpinLeft: { label: "ヘアピン左", length: [520, 700], delta: [-245, -170], sign: "caution" },
    hairpinRight: { label: "ヘアピン右", length: [520, 700], delta: [170, 245], sign: "caution" }
  };

  const state = {
    phase: "title", selectedCourse: "forest", course: [], sections: [], obstacles: [], particles: [],
    x: 0, y: 0, angle: 0, velocityX: 0, velocityY: 0, speed: 0,
    steerInput: 0, velocityAngle: 0, driftAngle: 0, isDrifting: false, driftClock: 0,
    elapsed: 0, turbos: 3, turboTime: 0, jumpTime: 0, jumpDuration: .58, jumpCooldown: 0,
    waterSlip: 0, landingWobble: 0, shake: 0, collisionLock: 0, surface: "asphalt", lastTime: 0
  };

  function random(min, max) { return min + Math.random() * (max - min); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function chooseWeighted(items) {
    const total = items.reduce((sum, item) => sum + item[1], 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item[1];
      if (roll <= 0) return item[0];
    }
    return items[items.length - 1][0];
  }

  function generateCourse() {
    const profile = COURSE_PROFILES[state.selectedCourse];
    state.course = [];
    state.sections = [];
    state.obstacles = [];
    let y = 0;
    let x = 0;
    let width = profile.width;
    let surface = "asphalt";
    state.course.push({ y: 0, x: 0, width, surface });

    while (y < COURSE_LENGTH) {
      let type = y < 260 || COURSE_LENGTH - y < 520 ? "straight" : chooseWeighted(profile.sections);
      if (state.sections.length > 0 && type === state.sections[state.sections.length - 1].type && Math.random() < .45) {
        type = chooseWeighted(profile.sections);
      }
      const info = SECTION_INFO[type];
      const startY = y;
      const startX = x;
      const length = Math.min(random(info.length[0], info.length[1]), COURSE_LENGTH - y);
      let delta = type === "straight" ? random(-18, 18) : random(info.delta[0], info.delta[1]);
      if (Math.abs(startX + delta) > 260) delta *= -1;
      const amplitude = type === "sCurve" ? random(95, 150) * (Math.random() < .5 ? -1 : 1) : 0;
      const segmentSurface = Math.random() < profile.dirt && startY > 300 && y < COURSE_LENGTH - 420 ? "dirt" : "asphalt";
      const points = Math.max(5, Math.ceil(length / POINT_GAP));

      if (info.sign && startY > 240) {
        const signRoad = courseAt(Math.max(0, startY - 80));
        state.obstacles.push({
          type: info.sign === "caution" ? "caution" : info.sign === "s" ? "sSign" : `arrow-${info.sign}`,
          x: signRoad.x + signRoad.width + 30, y: Math.max(120, startY - 92),
          radius: 15, decorative: true, side: 1
        });
      }

      state.sections.push({ type, startY, endY: startY + length, sign: info.sign || "", surface: segmentSurface });
      for (let i = 1; i <= points; i += 1) {
        const t = i / points;
        const yy = startY + length * t;
        let xx;
        if (type === "sCurve") {
          xx = startX + amplitude * Math.sin(t * Math.PI * 2) + delta * smooth(t);
        } else {
          xx = startX + delta * smooth(t);
        }
        width = clamp(width + random(-3.5, 3.5), profile.widthMin, profile.widthMax);
        state.course.push({ y: yy, x: xx, width, surface: segmentSurface });
      }
      y = startY + length;
      x = state.course[state.course.length - 1].x;
    }

    state.course[state.course.length - 1].y = COURSE_LENGTH;
    state.course[state.course.length - 1].surface = "asphalt";
    placeObstacles(profile);
  }

  function placeObstacles(profile) {
    for (const section of state.sections) {
      const length = section.endY - section.startY;
      const count = Math.floor(length / 230 + Math.random() * 1.6);
      for (let i = 0; i < count; i += 1) {
        if (Math.random() > profile.obstacle) continue;
        const y = random(section.startY + 80, section.endY - 70);
        if (y < 420 || y > COURSE_LENGTH - 260) continue;
        const road = courseAt(y);
        const type = chooseObstacle(profile.obstacleMix);
        const onRoad = type !== "boulder" && Math.random() < .72;
        const side = Math.random() < .5 ? -1 : 1;
        const radius = type === "puddle" ? random(18, 27) : type === "log" ? 19 : type === "boulder" ? random(20, 30) : random(13, 20);
        const lateral = onRoad
          ? random(-road.width * .62, road.width * .62)
          : side * random(road.width + 20, road.width + 70);
        state.obstacles.push({ type, x: road.x + lateral, y, radius, side, decorative: false });
      }
    }

    for (let y = 220; y < COURSE_LENGTH - 120; y += random(135, 225)) {
      const road = courseAt(y);
      const side = Math.random() < .5 ? -1 : 1;
      state.obstacles.push({
        x: road.x + side * (road.width + random(38, 84)), y,
        radius: random(12, 18), type: "tree", decorative: true, side
      });
    }
  }

  function chooseObstacle(mix) {
    const entries = Object.entries(mix);
    return chooseWeighted(entries);
  }

  function findCourseIndex(progress) {
    if (progress <= state.course[0].y) return 0;
    let low = 0;
    let high = state.course.length - 2;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (state.course[mid + 1].y < progress) low = mid + 1;
      else if (state.course[mid].y > progress) high = mid - 1;
      else return mid;
    }
    return clamp(low, 0, state.course.length - 2);
  }

  function courseAt(progress) {
    const index = findCourseIndex(progress);
    const a = state.course[index];
    const b = state.course[index + 1];
    const t = clamp((progress - a.y) / Math.max(1, b.y - a.y), 0, 1);
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      width: lerp(a.width, b.width, t),
      surface: t < .65 ? a.surface : b.surface
    };
  }

  function roadInfoAt(x, y) {
    let best = { distance: Infinity, width: 80, surface: "asphalt", centerX: 0 };
    const base = findCourseIndex(y);
    for (let i = Math.max(0, base - 3); i <= Math.min(state.course.length - 2, base + 4); i += 1) {
      const a = state.course[i];
      const b = state.course[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby || 1;
      const t = clamp(((x - a.x) * abx + (y - a.y) * aby) / len2, 0, 1);
      const cx = a.x + abx * t;
      const cy = a.y + aby * t;
      const d = Math.hypot(x - cx, y - cy);
      if (d < best.distance) {
        best = {
          distance: d,
          width: lerp(a.width, b.width, t),
          surface: t < .65 ? a.surface : b.surface,
          centerX: cx,
          centerY: cy
        };
      }
    }
    return best;
  }

  function resetRace(playNow) {
    generateCourse();
    const start = courseAt(0);
    Object.assign(state, {
      phase: playNow ? "playing" : "title", x: start.x, y: 0, angle: 0,
      velocityX: 0, velocityY: 45, speed: 45, steerInput: 0, velocityAngle: 0,
      driftAngle: 0, isDrifting: false, driftClock: 0,
      elapsed: 0, turbos: 3, turboTime: 0, jumpTime: 0, jumpDuration: .58, jumpCooldown: 0,
      waterSlip: 0, landingWobble: 0, shake: 0, collisionLock: 0, surface: "asphalt", particles: []
    });
    input.keyLeft = false;
    input.keyRight = false;
    input.dragging = false;
    wheelControl.classList.remove("dragging");
    resultOverlay.classList.remove("show");
    startOverlay.classList.toggle("show", !playNow);
    updateCourseCards();
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

  function useJump() {
    if (state.phase !== "playing" || state.jumpCooldown > 0 || state.jumpTime > 0) return;
    state.jumpDuration = state.turboTime > 0 ? .72 : .58;
    state.jumpTime = state.jumpDuration;
    state.jumpCooldown = 2;
    state.shake = Math.max(state.shake, .05);
    spawnJumpParticles("takeoff");
    if (navigator.vibrate) navigator.vibrate(18);
    updateHud();
  }

  function isJumping() { return state.jumpTime > 0; }
  function jumpHeight() {
    if (!isJumping()) return 0;
    const progress = 1 - state.jumpTime / state.jumpDuration;
    return Math.sin(progress * Math.PI);
  }

  function update(dt) {
    if (state.phase !== "playing") return;
    updateSteering(dt);
    state.elapsed += dt;
    state.turboTime = Math.max(0, state.turboTime - dt);
    state.shake = Math.max(0, state.shake - dt);
    state.collisionLock = Math.max(0, state.collisionLock - dt);
    state.waterSlip = Math.max(0, state.waterSlip - dt);
    state.landingWobble = Math.max(0, state.landingWobble - dt);
    state.jumpCooldown = Math.max(0, state.jumpCooldown - dt);
    const wasJumping = isJumping();
    state.jumpTime = Math.max(0, state.jumpTime - dt);
    if (wasJumping && !isJumping()) {
      state.landingWobble = .24;
      state.shake = Math.max(state.shake, .12);
      state.angle += random(-.035, .035);
      spawnJumpParticles("land");
    }

    const profile = COURSE_PROFILES[state.selectedCourse];
    const road = roadInfoAt(state.x, state.y);
    state.surface = road.distance <= road.width ? road.surface : "offroad";
    if (state.waterSlip > 0 && !isJumping()) state.surface = "water";

    const handling = getHandling(state.surface, profile);
    const turboActive = state.turboTime > 0;
    state.speed = Math.hypot(state.velocityX, state.velocityY);

    const speedRatio = clamp(state.speed / handling.maxSpeed, 0, 1.35);
    const lowSpeedSteer = clamp(state.speed / 48, .28, 1);
    const highSpeedSteer = lerp(1, .56, clamp(speedRatio, 0, 1));
    const turboSteer = turboActive ? .72 : 1;
    const jumpSteer = isJumping() ? .62 : 1;
    const wobble = state.landingWobble > 0 ? Math.sin(state.elapsed * 42) * state.landingWobble * .16 : 0;
    state.angle += state.steerInput * 1.34 * handling.turn * lowSpeedSteer * highSpeedSteer * turboSteer * jumpSteer * dt + wobble * dt;
    state.angle = normalizeAngle(state.angle);

    const forwardX = Math.sin(state.angle);
    const forwardY = Math.cos(state.angle);
    const acceleration = (state.surface === "offroad" ? 39 : state.surface === "water" ? 35 : 61) + (turboActive ? 88 : 0);
    state.velocityX += forwardX * acceleration * dt;
    state.velocityY += forwardY * acceleration * dt;

    const maxSpeed = handling.maxSpeed + (turboActive ? 76 : 0);
    state.speed = Math.hypot(state.velocityX, state.velocityY);
    const directionGrip = 1 - Math.exp(-handling.grip * (isJumping() ? .52 : 1) * dt);
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
    const driftThreshold = state.surface === "dirt" || state.surface === "water" ? 10 : 15;
    state.isDrifting = !isJumping() && state.speed > 72 && Math.abs(state.driftAngle) > driftThreshold * Math.PI / 180;
    if (state.isDrifting) {
      const driftTurn = state.surface === "dirt" || state.surface === "water" ? .33 : .22;
      state.angle += state.steerInput * driftTurn * dt;
      const driftDrag = Math.exp(-(state.surface === "dirt" ? .18 : .28) * dt);
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

  function getHandling(surface, profile) {
    const gripBonus = profile.gripBonus || 0;
    if (surface === "asphalt") return { grip: 6.25 + gripBonus, friction: .2, maxSpeed: 176, turn: 1 };
    if (surface === "dirt") return { grip: 2.1 + gripBonus, friction: .36, maxSpeed: 145, turn: 1.14 };
    if (surface === "water") return { grip: 1.05 + gripBonus, friction: .68, maxSpeed: 118, turn: .9 };
    return { grip: .95 + gripBonus, friction: 1.15, maxSpeed: 90, turn: .88 };
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
      if (obstacle.decorative) continue;
      if (Math.abs(obstacle.y - state.y) > 35) continue;
      const hitDistance = obstacle.type === "log" ? obstacle.radius + 13 : obstacle.radius + 9;
      if (Math.hypot(obstacle.x - state.x, obstacle.y - state.y) >= hitDistance) continue;

      const jumpAvoids = isJumping() && obstacle.type !== "boulder";
      if (jumpAvoids) {
        spawnAvoidParticles(obstacle);
        continue;
      }

      if (obstacle.type === "puddle") {
        state.waterSlip = .8;
        state.velocityX *= 1.08;
        state.velocityY *= .78;
        state.collisionLock = .35;
        state.shake = Math.max(state.shake, .12);
        spawnSplash(obstacle);
      } else {
        const hard = obstacle.type === "boulder" || obstacle.type === "log";
        state.velocityX *= hard ? -.18 : -.24;
        state.velocityY *= hard ? .22 : .34;
        state.collisionLock = hard ? .7 : .5;
        state.shake = hard ? .38 : .28;
        spawnHitParticles(obstacle);
      }
      state.speed = Math.hypot(state.velocityX, state.velocityY);
      if (navigator.vibrate) navigator.vibrate(obstacle.type === "puddle" ? 25 : 60);
      break;
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

    const dustRate = state.isDrifting ? (state.surface === "dirt" ? 36 : 20) : state.surface === "dirt" ? 9 : state.surface === "offroad" ? 13 : 0;
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
    while (state.particles.length > 150) state.particles.shift();
  }

  function spawnJumpParticles(kind) {
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: state.x + random(-14, 14), y: state.y + random(-10, 10),
        vx: random(-28, 28), vy: random(-30, 10), life: kind === "land" ? .42 : .32,
        maxLife: kind === "land" ? .42 : .32, kind: kind === "land" ? "land" : "dust",
        size: random(3, 8), angle: 0
      });
    }
  }

  function spawnHitParticles(obstacle) {
    for (let i = 0; i < 9; i += 1) {
      state.particles.push({ x: obstacle.x, y: obstacle.y, vx: random(-35, 35), vy: random(-32, 25), life: .45, maxLife: .45, kind: "chip", size: random(3, 7), angle: 0 });
    }
  }

  function spawnSplash(obstacle) {
    for (let i = 0; i < 12; i += 1) {
      state.particles.push({ x: obstacle.x + random(-12, 12), y: obstacle.y + random(-9, 9), vx: random(-38, 38), vy: random(-35, 12), life: .5, maxLife: .5, kind: "splash", size: random(3, 8), angle: 0 });
    }
  }

  function spawnAvoidParticles(obstacle) {
    if (Math.random() > .18) return;
    state.particles.push({ x: obstacle.x, y: obstacle.y, vx: 0, vy: -16, life: .35, maxLife: .35, kind: "avoid", size: 10, angle: 0 });
  }

  function updateParticles(dt) {
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.size += dt * 8; }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function finishRace() {
    state.phase = "finished";
    const previous = getBest();
    const isRecord = !previous || state.elapsed < previous;
    if (isRecord) localStorage.setItem(bestKey(), state.elapsed.toFixed(3));
    const best = isRecord ? state.elapsed : previous;
    resultTitle.textContent = isRecord ? "NEW RECORD!" : "STAGE CLEAR";
    resultTime.textContent = formatTime(state.elapsed);
    resultBest.textContent = `BEST ${formatTime(best)}`;
    resultOverlay.classList.add("show");
  }

  function bestKey() { return `${BEST_KEY_PREFIX}${state.selectedCourse}`; }
  function getBest() { return Number(localStorage.getItem(bestKey())) || 0; }
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
  }

  function updateHud() {
    timeText.textContent = formatTime(state.elapsed);
    speedText.textContent = Math.round(state.speed);
    turboText.textContent = `${"★".repeat(state.turbos)}${"☆".repeat(3 - state.turbos)}`;
    if (state.jumpTime > 0) jumpText.textContent = "AIR";
    else jumpText.textContent = state.jumpCooldown <= 0 ? "READY" : `${state.jumpCooldown.toFixed(1)}s`;
    progressBar.style.width = `${clamp(state.y / COURSE_LENGTH, 0, 1) * 100}%`;
    surfaceText.textContent = state.surface.toUpperCase();
    surfaceText.className = `surface ${state.surface}`;
    turboButton.classList.toggle("engaged", state.turboTime > 0);
    turboButton.disabled = state.turbos <= 0 || state.phase !== "playing";
    jumpButton.disabled = state.phase !== "playing" || state.jumpCooldown > 0 || state.jumpTime > 0;
    jumpButton.classList.toggle("ready", state.phase === "playing" && state.jumpCooldown <= 0 && state.jumpTime <= 0);
    jumpButton.classList.toggle("cooling", state.jumpCooldown > 0 || state.jumpTime > 0);
  }

  function updateCourseCards() {
    for (const card of courseSelect.querySelectorAll(".course-card")) {
      card.classList.toggle("active", card.dataset.course === state.selectedCourse);
    }
    const best = getBest();
    startBestText.textContent = best ? formatTime(best) : "--:--.--";
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
    drawMiniMap();
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

  function edgePoint(index, side) {
    const p = state.course[index];
    const prev = state.course[Math.max(0, index - 1)];
    const next = state.course[Math.min(state.course.length - 1, index + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    return { x: p.x + nx * p.width * side, y: p.y + ny * p.width * side };
  }

  function drawRoad() {
    const minY = state.y - (view.height - view.carY) / view.scale - 110;
    const maxY = state.y + view.carY / view.scale + 110;
    const first = clamp(Math.floor(minY / POINT_GAP), 0, state.course.length - 2);
    const last = clamp(Math.ceil(maxY / POINT_GAP), 1, state.course.length - 1);

    for (let i = first; i < last; i += 1) {
      const a = state.course[i];
      const al = worldToScreen(edgePoint(i, 1).x, edgePoint(i, 1).y);
      const ar = worldToScreen(edgePoint(i, -1).x, edgePoint(i, -1).y);
      const bl = worldToScreen(edgePoint(i + 1, 1).x, edgePoint(i + 1, 1).y);
      const br = worldToScreen(edgePoint(i + 1, -1).x, edgePoint(i + 1, -1).y);
      ctx.beginPath();
      ctx.moveTo(al.x, al.y); ctx.lineTo(ar.x, ar.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath();
      ctx.fillStyle = a.surface === "dirt" ? "#95633c" : "#3d4240";
      ctx.fill();
      ctx.strokeStyle = a.surface === "asphalt" ? "rgba(255,255,255,.68)" : "rgba(236,190,121,.22)";
      ctx.lineWidth = a.surface === "asphalt" ? 2 : 3;
      ctx.beginPath(); ctx.moveTo(al.x, al.y); ctx.lineTo(bl.x, bl.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ar.x, ar.y); ctx.lineTo(br.x, br.y); ctx.stroke();
    }
  }

  function drawFinish() {
    if (Math.abs(COURSE_LENGTH - state.y) > 470) return;
    const road = courseAt(COURSE_LENGTH - 1);
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
      if (p.y < -55 || p.y > view.height + 55 || p.x < -65 || p.x > view.width + 65) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (o.type === "tree") drawTree(o);
      else if (o.type === "rock") drawRock(o, false);
      else if (o.type === "boulder") drawRock(o, true);
      else if (o.type === "puddle") drawPuddle(o);
      else if (o.type === "log") drawLog(o);
      else drawSign(o);
      ctx.restore();
    }
  }

  function drawTree(o) {
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(5, 8, o.radius, o.radius * .6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#54341f"; ctx.fillRect(-3, 2, 6, o.radius);
    ctx.fillStyle = "#164824"; ctx.beginPath(); ctx.arc(0, -3, o.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2e7434"; ctx.beginPath(); ctx.arc(-4, -7, o.radius * .62, 0, Math.PI * 2); ctx.fill();
  }

  function drawRock(o, big) {
    ctx.fillStyle = big ? "#4e5450" : "#69706a";
    ctx.beginPath(); ctx.moveTo(-o.radius, 8); ctx.lineTo(-o.radius * .55, -7); ctx.lineTo(4, -o.radius); ctx.lineTo(o.radius, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = big ? "#8b9188" : "#a5aba2"; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawPuddle(o) {
    ctx.fillStyle = "rgba(58, 170, 202, .32)"; ctx.beginPath(); ctx.ellipse(0, 0, o.radius * 1.35, o.radius * .68, -.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(180,245,255,.55)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(-o.radius * .5, -3, o.radius * .7, 3);
  }

  function drawLog(o) {
    ctx.rotate(.24);
    ctx.fillStyle = "#6a3d20"; roundRect(-o.radius * 1.25, -7, o.radius * 2.5, 14, 7); ctx.fill();
    ctx.strokeStyle = "#321b0d"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#b77945"; ctx.beginPath(); ctx.arc(-o.radius * 1.25, 0, 7, 0, Math.PI * 2); ctx.fill();
  }

  function drawSign(o) {
    ctx.fillStyle = "#ddd4b5"; ctx.fillRect(-2, 0, 4, 22);
    ctx.fillStyle = o.type === "caution" ? "#ffd447" : "#e44722";
    ctx.fillRect(-15, -13, 30, 17);
    ctx.fillStyle = o.type === "caution" ? "#1b1710" : "white";
    ctx.font = "900 12px Arial";
    ctx.textAlign = "center";
    const label = o.type === "arrow-left" ? "←" : o.type === "arrow-right" ? "→" : o.type === "sSign" ? "S" : "!";
    ctx.fillText(label, 0, 0);
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
        ctx.fillStyle = p.kind === "spark" ? (p.life > .2 ? "#ffffff" : "#ff9d24")
          : p.kind === "flame" ? (p.life > .14 ? "#fff05a" : "#ff541e")
            : p.kind === "splash" ? "#9de8ff"
              : p.kind === "chip" ? "#9c9488"
                : p.kind === "avoid" ? "#ffffff"
                  : p.kind === "land" ? "#f3d29a" : "#d9bd8a";
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCar() {
    const x = view.width * .5;
    const y = view.carY;
    const air = jumpHeight();
    const lift = air * 23;
    const scale = 1 + air * .08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.angle);
    ctx.fillStyle = `rgba(0,0,0,${.24 - air * .08})`;
    roundRect(-15 + air * 5, -18 + air * 16, 32 - air * 10, 42 - air * 6, 9);
    ctx.fill();
    ctx.translate(0, -lift);
    ctx.scale(scale, scale);
    if (state.isDrifting) {
      ctx.strokeStyle = state.turboTime > 0 ? "rgba(255,213,63,.9)" : "rgba(255,255,255,.35)";
      ctx.lineWidth = state.turboTime > 0 ? 4 : 2;
      ctx.beginPath(); ctx.arc(0, 0, 25, -2.5, -.65); ctx.stroke();
    }
    if (isJumping()) {
      ctx.strokeStyle = "rgba(88,199,255,.65)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 3, 25 + air * 10, .2, Math.PI - .2); ctx.stroke();
    }
    ctx.fillStyle = "#161a19"; ctx.fillRect(-16, -14, 5, 12); ctx.fillRect(11, -14, 5, 12); ctx.fillRect(-16, 8, 5, 12); ctx.fillRect(11, 8, 5, 12);
    const gradient = ctx.createLinearGradient(-13, 0, 13, 0); gradient.addColorStop(0, "#bb260e"); gradient.addColorStop(.45, "#ff5a1f"); gradient.addColorStop(1, "#a6190b");
    ctx.fillStyle = gradient; roundRect(-13, -23, 26, 46, 6); ctx.fill();
    ctx.fillStyle = "#17252b"; ctx.fillRect(-9, -13, 18, 10); ctx.fillStyle = "#9fd2df"; ctx.fillRect(-7, -11, 14, 6);
    ctx.fillStyle = "#fff4b2"; ctx.fillRect(-9, -22, 6, 3); ctx.fillRect(3, -22, 6, 3);
    ctx.fillStyle = "#fff"; ctx.font = "900 11px Arial"; ctx.textAlign = "center"; ctx.fillText("7", 0, 12);
    ctx.restore();
  }

  function drawMiniMap() {
    const w = 92;
    const h = 132;
    const x = view.width - w - 10;
    const y = Math.max(92, view.height - h - 154);
    const minX = Math.min(...state.course.map((p) => p.x - p.width));
    const maxX = Math.max(...state.course.map((p) => p.x + p.width));
    const pad = 10;
    ctx.save();
    ctx.globalAlpha = .92;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < state.course.length; i += 2) {
      const p = state.course[i];
      const mx = x + pad + ((p.x - minX) / Math.max(1, maxX - minX)) * (w - pad * 2);
      const my = y + h - pad - (p.y / COURSE_LENGTH) * (h - pad * 2);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.strokeStyle = "#e7eee7";
    ctx.lineWidth = 2;
    ctx.stroke();
    const currentRoad = courseAt(state.y);
    const carX = x + pad + ((currentRoad.x - minX) / Math.max(1, maxX - minX)) * (w - pad * 2);
    const carY = y + h - pad - (state.y / COURSE_LENGTH) * (h - pad * 2);
    ctx.fillStyle = "#ff3b20";
    ctx.beginPath(); ctx.arc(carX, carY, 4.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd447";
    ctx.beginPath(); ctx.arc(x + w * .5, y + pad, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "800 8px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MAP", x + w * .5, y + h - 4);
    ctx.restore();
    ctx.globalAlpha = 1;
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
  jumpButton.addEventListener("pointerdown", (event) => { event.preventDefault(); useJump(); });
  document.getElementById("startButton").addEventListener("click", startRace);
  document.getElementById("retryButton").addEventListener("click", startRace);

  courseSelect.addEventListener("click", (event) => {
    const card = event.target.closest(".course-card");
    if (!card || state.phase === "playing") return;
    state.selectedCourse = card.dataset.course;
    resetRace(false);
  });

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) event.preventDefault();
    if (event.code === "ArrowLeft") input.keyLeft = true;
    if (event.code === "ArrowRight") input.keyRight = true;
    if (event.code === "Space" && !event.repeat) useTurbo();
    if ((event.code === "ShiftLeft" || event.code === "ShiftRight") && !event.repeat) useJump();
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

  resizeCanvas();
  resetRace(false);
  requestAnimationFrame(frame);
})();
