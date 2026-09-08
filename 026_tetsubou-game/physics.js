(function (root) {
  'use strict';
  const CONFIG = Object.freeze({
    gravity: 620, barX: 390, barHeight: 170, groundY: 354,
    gymnastMass: 1, extendedRadius: 76, tuckStrength: 43,
    swingDamping: 0.035, tuckSpeed: 7.5, bodyInertia: 110,
    initialAngle: -0.24, initialOmega: 0.5, maxOmega: 11,
    bodyLength: 36, armLength: 59, legLength: 39,
    airInertia: 700, airTuckReduction: 0.77, airDrag: 0.012,
    matX: 540, matWidth: 270, matThickness: 14,
    footRadius: 7, headRadius: 15, torsoRadius: 15,
    perfectAngle: 0.23, goodAngle: 0.55, stepAngle: 1.05,
    perfectSpeed: 700, goodSpeed: 950, perfectSpin: 3.5, goodSpin: 6,
    perfectCenter: 64, baseScore: 1000, flipScore: 250,
    heightScore: 80, distanceScore: 30, centerScore: 300,
    postureScore: 250, pixelsPerMeter: 90,
    multipliers: { PERFECT: 1.8, GOOD: 1.2, STEP: 0.7, CRASH: 0.15 },
    fixedStep: 1 / 240, maxFrame: 0.05, maxFlightTime: 15
  });
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function point(s, x, y) {
    return { x: s.x + x * Math.cos(s.angle) - y * Math.sin(s.angle),
      y: s.y + x * Math.sin(s.angle) + y * Math.cos(s.angle) };
  }
  function pose(s) {
    const legAngle = -2.3 * s.tuck;
    return { head: point(s, 2, -29), torso: point(s, 0, -3),
      shoulder: point(s, -7 * s.tuck, -17), hip: point(s, 0, 14),
      foot: point(s, -Math.sin(legAngle) * CONFIG.legLength, 14 + Math.cos(legAngle) * CONFIG.legLength),
      hand: point(s, 0, -s.radius), legAngle };
  }
  function create() {
    const s = { phase: 'swing', angle: CONFIG.initialAngle, omega: CONFIG.initialOmega,
      radius: CONFIG.extendedRadius, radiusSpeed: 0, tuck: 0, held: false,
      x: 0, y: 0, vx: 0, vy: 0, angularMomentum: 0,
      maxHeight: 0, airRotation: 0, giants: 0, swingTravel: 0, turnDirection: 0,
      amplitude: Math.abs(CONFIG.initialAngle), flightTime: 0, score: 0, result: null,
      startX: 0, minY: Infinity, elapsed: 0, impact: null };
    attachedPosition(s); return s;
  }
  function attachedPosition(s) {
    s.x = CONFIG.barX - Math.sin(s.angle) * s.radius;
    s.y = CONFIG.barHeight + Math.cos(s.angle) * s.radius;
    s.vx = -Math.cos(s.angle) * s.radius * s.omega - Math.sin(s.angle) * s.radiusSpeed;
    s.vy = -Math.sin(s.angle) * s.radius * s.omega + Math.cos(s.angle) * s.radiusSpeed;
  }
  function release(s) {
    if (s.phase !== 'swing') return false;
    attachedPosition(s);
    s.phase = 'flight'; s.startX = s.x; s.releaseAngle = s.angle;
    // Keep angular velocity exactly at release. Subsequent pose changes conserve spin momentum.
    s.angularMomentum = s.omega * airInertia(s.tuck);
    s.flightTime = 0; return true;
  }
  const airInertia = tuck => CONFIG.airInertia * (1 - CONFIG.airTuckReduction * tuck);
  function evaluateLanding(s, collision) {
    const p = pose(s), tilt = Math.abs(wrap(s.angle));
    const onMat = collision.onMat, feetFirst = collision.part === 'foot';
    const centerDistance = Math.abs(p.foot.x - (CONFIG.matX + CONFIG.matWidth / 2));
    const speed = Math.hypot(s.vx, s.vy), spin = Math.abs(s.omega);
    let grade = 'CRASH';
    if (onMat && feetFirst && tilt < CONFIG.stepAngle && s.tuck < 0.65) {
      grade = 'STEP';
      if (tilt < CONFIG.goodAngle && speed < CONFIG.goodSpeed && spin < CONFIG.goodSpin) grade = 'GOOD';
      if (tilt < CONFIG.perfectAngle && speed < CONFIG.perfectSpeed && spin < CONFIG.perfectSpin && centerDistance < CONFIG.perfectCenter) grade = 'PERFECT';
    }
    const flips = Math.floor((s.airRotation + 1e-8) / TAU);
    const distance = Math.abs(s.x - s.startX) / CONFIG.pixelsPerMeter;
    const raw = CONFIG.baseScore + CONFIG.flipScore * flips * (flips + 1)
      + s.maxHeight * CONFIG.heightScore + distance * CONFIG.distanceScore
      + (onMat ? Math.max(0, 1 - centerDistance / (CONFIG.matWidth / 2)) * CONFIG.centerScore : 0)
      + Math.max(0, 1 - tilt / Math.PI) * CONFIG.postureScore;
    return { grade, flips, distance, centerDistance, tilt, speed, spin,
      score: Math.round(raw * CONFIG.multipliers[grade]),
      reason: !onMat ? 'マットの外！離すタイミングを変えてみよう' : !feetFirst ? '着地の前に伸びて、足を下に向けよう' : grade === 'PERFECT' ? '中央にピタッ！見事な着地' : grade === 'GOOD' ? 'ナイス着地！次はマットの真ん中へ' : 'あと一歩！早めに伸びて回転をゆるめよう' };
  }
  function step(s, dt) {
    if (s.phase === 'result') return;
    s.elapsed += dt;
    const previous = pose(s), oldRadius = s.radius, oldAngle = s.angle;
    s.tuck += clamp((s.held ? 1 : 0) - s.tuck, -CONFIG.tuckSpeed * dt, CONFIG.tuckSpeed * dt);
    s.radius = CONFIG.extendedRadius - CONFIG.tuckStrength * s.tuck;
    s.radiusSpeed = (s.radius - oldRadius) / dt;
    if (s.phase === 'swing') {
      // Variable-length physical pendulum: gravity torque + conservation of angular momentum.
      // Retraction near the bottom adds energy through muscular work; extension at the apex preserves it.
      const oldI = CONFIG.gymnastMass * oldRadius * oldRadius + CONFIG.bodyInertia;
      const inertia = CONFIG.gymnastMass * s.radius * s.radius + CONFIG.bodyInertia;
      let momentum = s.omega * oldI;
      momentum += -CONFIG.gymnastMass * CONFIG.gravity * s.radius * Math.sin(s.angle) * dt;
      momentum *= Math.exp(-CONFIG.swingDamping * dt);
      s.omega = clamp(momentum / inertia, -CONFIG.maxOmega, CONFIG.maxOmega);
      s.angle += s.omega * dt;
      s.amplitude = Math.max(s.amplitude, Math.abs(wrap(s.angle)));
      const dir = Math.sign(s.omega);
      if (dir !== s.turnDirection) { s.swingTravel = 0; s.turnDirection = dir; }
      s.swingTravel += Math.abs(s.angle - oldAngle);
      if (s.swingTravel >= TAU) { s.giants++; s.swingTravel -= TAU; }
      attachedPosition(s);
    } else {
      s.flightTime += dt;
      s.angularMomentum *= Math.exp(-CONFIG.airDrag * dt);
      s.omega = s.angularMomentum / airInertia(s.tuck);
      s.angle += s.omega * dt;
      s.airRotation += Math.abs(s.angle - oldAngle);
      s.vy += CONFIG.gravity * dt;
      s.vx *= Math.exp(-CONFIG.airDrag * dt);
      s.x += s.vx * dt; s.y += s.vy * dt;
      const current = pose(s);
      let hit = null;
      for (const [part, radius] of [['foot', CONFIG.footRadius], ['head', CONFIG.headRadius], ['torso', CONFIG.torsoRadius]]) {
        const a = previous[part], b = current[part];
        // Swept circle contact against both the mat top and the ground; avoids fast-spin tunnelling.
        for (const onMat of [true, false]) {
          const surface = CONFIG.groundY - (onMat ? CONFIG.matThickness : 0);
          const dy = b.y - a.y;
          if (dy <= 0 || b.y + radius < surface) continue;
          const t = clamp((surface - radius - a.y) / dy, 0, 1);
          const x = a.x + (b.x - a.x) * t;
          if (onMat && (x + radius < CONFIG.matX || x - radius > CONFIG.matX + CONFIG.matWidth)) continue;
          if (!hit || t < hit.t) hit = { part, onMat, surface, t, x, y: surface - radius };
        }
      }
      if (hit) {
        s.y -= current[hit.part].y - hit.y;
        s.result = evaluateLanding(s, hit); s.score = s.result.score;
        s.phase = 'result'; s.held = false; s.impact = hit;
      } else if (s.flightTime > CONFIG.maxFlightTime || !Number.isFinite(s.x + s.y)) {
        s.result = { grade: 'CRASH', score: 0, flips: 0, distance: 0, reason: '場外！もう一度チャレンジ' };
        s.phase = 'result'; s.held = false;
      }
    }
    s.minY = Math.min(s.minY, s.y);
    s.maxHeight = Math.max(s.maxHeight, (CONFIG.groundY - s.y) / CONFIG.pixelsPerMeter);
  }
  const API = { CONFIG, create, step, release, pose, point, wrap, evaluateLanding, airInertia };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.BarPhysics = API;
})(typeof window !== 'undefined' ? window : globalThis);
