(() => {
  "use strict";
  const CONFIG = Object.freeze({
    SCORE_TO_WIN: 3, PADDLE_RADIUS_RATIO: .075, PUCK_RADIUS_RATIO: .039,
    GOAL_WIDTH_RATIO: .38, TABLE_INSET_RATIO: .055, PLAYER_ZONE_MARGIN_RATIO: .008, POINTER_PADDLE_OFFSET: 0,
    MAX_PADDLE_SPEED: 1350, MAX_PUCK_SPEED: 1120,
    PUCK_FRICTION: .996, WALL_BOUNCE: .94, PADDLE_RESTITUTION: .9, PADDLE_POWER: .24,
    MAX_SUBSTEP_DISTANCE: 6, MAX_SUBSTEPS: 14,
    GOAL_PAUSE_MS: 1100, WIN_PAUSE_MS: 820, READY_MS: 360, SOUND_COOLDOWN_MS: 48
  });
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const speedOf = (body) => Math.hypot(body.vx, body.vy);

  class TableHockeyGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.animationId = 0; this.active = false; this.lastFrame = 0; this.fps = 60; this.lastCollision = "none";
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.resize(); this.reset(); this.bindInput();
    }
    makePlayer(index) {
      const table = this.tableBounds();
      return {
        index, x: (table.left + table.right) / 2,
        y: index === 0 ? table.top + (table.bottom - table.top) * .27 : table.top + (table.bottom - table.top) * .73,
        vx: 0, vy: 0, speed: 0, pointerId: null, active: false, lastPointerAt: 0, lastHitAt: 0
      };
    }
    reset() {
      this.active = false; this.roundPaused = true; this.pendingWinner = 0; this.roundEndsAt = 0; this.roundMessage = "";
      this.scores = [0, 0]; this.lastCollision = "none";
      this.players = [this.makePlayer(0), this.makePlayer(1)]; this.resetPuck();
      if (this.dangers) this.dangers.forEach((danger) => danger.classList.remove("visible"));
      this.lastFrame = performance.now(); this.updateHud(); this.render();
    }
    resetPuck() {
      const table = this.tableBounds();
      this.puck = { x: (table.left + table.right) / 2, y: (table.top + table.bottom) / 2, vx: 0, vy: 0 };
    }
    resetPaddles() { this.players = [this.makePlayer(0), this.makePlayer(1)]; }
    start() {
      this.active = true; this.roundPaused = false; this.roundMessage = ""; this.lastFrame = performance.now();
      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
    }
    stop() {
      this.active = false; cancelAnimationFrame(this.animationId);
      if (this.players) this.players.forEach((player) => {
        player.pointerId = null; player.active = false; player.vx = 0; player.vy = 0; player.speed = 0;
      });
    }
    destroy() {
      this.stop(); this.resizeObserver.disconnect();
      const h = this.pointerHandlers; if (!h) return;
      this.canvas.removeEventListener("pointerdown", h.down);
      this.canvas.removeEventListener("pointermove", h.move);
      this.canvas.removeEventListener("pointerup", h.up);
      this.canvas.removeEventListener("pointercancel", h.cancel);
      this.canvas.removeEventListener("lostpointercapture", h.cancel);
      this.canvas.removeEventListener("contextmenu", h.menu);
    }
    bindInput() {
      const down = (event) => {
        if (!this.active || this.roundPaused || (event.pointerType === "mouse" && event.button !== 0)) return;
        const point = this.eventPoint(event); const playerIndex = this.playerAtPoint(point.x, point.y);
        if (playerIndex < 0 || !this.claimPointer(playerIndex, event.pointerId, point.x, point.y, performance.now())) return;
        event.preventDefault(); if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(event.pointerId);
      };
      const move = (event) => {
        const index = this.players.findIndex((player) => player.pointerId === event.pointerId);
        if (index < 0) return;
        event.preventDefault(); const point = this.eventPoint(event);
        this.movePointer(index, point.x, point.y, performance.now());
      };
      const release = (event) => { if (this.releasePointer(event.pointerId)) event.preventDefault(); };
      const menu = (event) => event.preventDefault();
      this.pointerHandlers = { down, move, up: release, cancel: release, menu };
      this.canvas.addEventListener("pointerdown", down, { passive: false });
      this.canvas.addEventListener("pointermove", move, { passive: false });
      this.canvas.addEventListener("pointerup", release, { passive: false });
      this.canvas.addEventListener("pointercancel", release, { passive: false });
      this.canvas.addEventListener("lostpointercapture", release);
      this.canvas.addEventListener("contextmenu", menu);
    }
    eventPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    playerAtPoint(x, y) {
      const radius = this.paddleRadius() * 1.65; let choice = -1; let closest = Infinity;
      this.players.forEach((player, index) => {
        if (player.pointerId !== null) return;
        const distance = Math.hypot(x - player.x, y - player.y);
        if (distance <= radius && distance < closest) { choice = index; closest = distance; }
      });
      return choice;
    }
    claimPointer(index, pointerId, x, y, now) {
      const player = this.players[index];
      if (!player || player.pointerId !== null || this.players.some((other) => other.pointerId === pointerId)) return false;
      player.pointerId = pointerId; player.active = true; player.lastPointerAt = now; player.vx = 0; player.vy = 0;
      this.movePointer(index, x, y, now); return true;
    }
    movePointer(index, x, y, now) {
      const player = this.players[index]; if (!player || player.pointerId === null) return false;
      const offsetY = index === 0 ? CONFIG.POINTER_PADDLE_OFFSET : -CONFIG.POINTER_PADDLE_OFFSET;
      const target = this.clampPaddle(index, x, y + offsetY);
      const dt = Math.max(.008, Math.min(.05, (now - player.lastPointerAt) / 1000 || .016));
      let vx = (target.x - player.x) / dt; let vy = (target.y - player.y) / dt;
      const rawSpeed = Math.hypot(vx, vy);
      if (rawSpeed > CONFIG.MAX_PADDLE_SPEED) { const scale = CONFIG.MAX_PADDLE_SPEED / rawSpeed; vx *= scale; vy *= scale; }
      player.x = target.x; player.y = target.y; player.vx = vx; player.vy = vy; player.speed = Math.hypot(vx, vy);
      player.lastPointerAt = now; return true;
    }
    releasePointer(pointerId) {
      const player = this.players.find((candidate) => candidate.pointerId === pointerId);
      if (!player) return false;
      player.pointerId = null; player.active = false; player.vx = 0; player.vy = 0; player.speed = 0; return true;
    }
    tableBounds() {
      const w = this.width || 1; const h = this.height || 1;
      const inset = Math.max(10, Math.min(w, h) * CONFIG.TABLE_INSET_RATIO);
      return { left: inset, right: w - inset, top: inset, bottom: h - inset, centerY: h / 2 };
    }
    paddleRadius() { return Math.max(19, Math.min(this.width || 1, this.height || 1) * CONFIG.PADDLE_RADIUS_RATIO); }
    puckRadius() { return Math.max(10, Math.min(this.width || 1, this.height || 1) * CONFIG.PUCK_RADIUS_RATIO); }
    clampPaddle(index, x, y) {
      const table = this.tableBounds(); const radius = this.paddleRadius();
      const centerMargin = Math.min(this.width, this.height) * CONFIG.PLAYER_ZONE_MARGIN_RATIO;
      return {
        x: clamp(x, table.left + radius, table.right - radius),
        y: index === 0 ? clamp(y, table.top + radius, table.centerY - radius - centerMargin) : clamp(y, table.centerY + radius + centerMargin, table.bottom - radius)
      };
    }
    frame(now) {
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / dt) - this.fps) * .08; this.lastFrame = now;
      if (this.active) this.update(dt, now); this.render();
      if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }
    update(dt, now) {
      this.players.forEach((player) => {
        if (player.pointerId !== null && now - player.lastPointerAt > 42) {
          player.vx *= .45; player.vy *= .45; player.speed = speedOf(player);
        }
      });
      if (this.roundPaused) {
        if (now >= this.roundEndsAt) {
          if (this.pendingWinner) return this.finish(this.pendingWinner);
          this.resetPuck(); this.resetPaddles(); this.roundPaused = false; this.roundMessage = "";
        } else if (!this.pendingWinner && this.roundEndsAt - now <= CONFIG.READY_MS) this.roundMessage = "READY";
        this.updateHud(); return;
      }
      const puckSpeed = speedOf(this.puck);
      const steps = clamp(Math.ceil(puckSpeed * dt / CONFIG.MAX_SUBSTEP_DISTANCE), 1, CONFIG.MAX_SUBSTEPS);
      const step = dt / steps;
      for (let index = 0; index < steps && !this.roundPaused; index += 1) this.physicsStep(step, now);
      const friction = Math.pow(CONFIG.PUCK_FRICTION, dt * 60);
      this.puck.vx *= friction; this.puck.vy *= friction; this.limitPuckSpeed(); this.updateHud();
    }
    physicsStep(dt, now) {
      this.puck.x += this.puck.vx * dt; this.puck.y += this.puck.vy * dt;
      this.resolveWalls(now); if (this.roundPaused) return;
      this.players.forEach((player) => this.resolvePaddleCollision(player, now));
    }
    resolveWalls(now) {
      const table = this.tableBounds(); const radius = this.puckRadius();
      const goalHalf = (table.right - table.left) * CONFIG.GOAL_WIDTH_RATIO / 2;
      const insideGoal = Math.abs(this.puck.x - (table.left + table.right) / 2) < goalHalf - radius * .15;
      let hit = false;
      if (this.puck.x - radius < table.left) {
        this.puck.x = table.left + radius; this.puck.vx = Math.abs(this.puck.vx) * CONFIG.WALL_BOUNCE; hit = true;
      } else if (this.puck.x + radius > table.right) {
        this.puck.x = table.right - radius; this.puck.vx = -Math.abs(this.puck.vx) * CONFIG.WALL_BOUNCE; hit = true;
      }
      if (this.puck.y + radius < table.top && insideGoal) return this.scoreGoal(1, now);
      if (this.puck.y - radius > table.bottom && insideGoal) return this.scoreGoal(0, now);
      if (this.puck.y - radius < table.top && !insideGoal) {
        this.puck.y = table.top + radius; this.puck.vy = Math.abs(this.puck.vy) * CONFIG.WALL_BOUNCE; hit = true;
      } else if (this.puck.y + radius > table.bottom && !insideGoal) {
        this.puck.y = table.bottom - radius; this.puck.vy = -Math.abs(this.puck.vy) * CONFIG.WALL_BOUNCE; hit = true;
      }
      if (hit) {
        this.lastCollision = "wall";
        if (this.onWallSound && now - (this.lastWallSoundAt || 0) > CONFIG.SOUND_COOLDOWN_MS) {
          this.lastWallSoundAt = now; this.onWallSound(clamp(speedOf(this.puck) / CONFIG.MAX_PUCK_SPEED, 0, 1));
        }
      }
    }
    resolvePaddleCollision(player, now) {
      const dx = this.puck.x - player.x; const dy = this.puck.y - player.y;
      const minimum = this.paddleRadius() + this.puckRadius(); const distance = Math.hypot(dx, dy);
      if (distance >= minimum) return false;
      const nx = distance > .001 ? dx / distance : 0;
      const ny = distance > .001 ? dy / distance : (player.index === 0 ? 1 : -1);
      this.puck.x = player.x + nx * minimum; this.puck.y = player.y + ny * minimum;
      const relativeNormal = (this.puck.vx - player.vx) * nx + (this.puck.vy - player.vy) * ny;
      if (relativeNormal < 0) {
        const impulse = -(1 + CONFIG.PADDLE_RESTITUTION) * relativeNormal;
        const drive = Math.max(0, player.vx * nx + player.vy * ny) * CONFIG.PADDLE_POWER;
        this.puck.vx += (impulse + drive) * nx; this.puck.vy += (impulse + drive) * ny; this.limitPuckSpeed();
        const power = clamp((impulse + drive) / CONFIG.MAX_PUCK_SPEED, 0, 1);
        this.lastCollision = "P" + (player.index + 1) + " paddle";
        if (this.onPaddleSound && now - player.lastHitAt > CONFIG.SOUND_COOLDOWN_MS) {
          player.lastHitAt = now; this.onPaddleSound(power, player.index);
        }
      }
      return true;
    }
    limitPuckSpeed() {
      const puckSpeed = speedOf(this.puck); if (puckSpeed <= CONFIG.MAX_PUCK_SPEED) return;
      const scale = CONFIG.MAX_PUCK_SPEED / puckSpeed; this.puck.vx *= scale; this.puck.vy *= scale;
    }
    scoreGoal(scorer, now) {
      if (this.roundPaused) return;
      this.scores[scorer] += 1; this.roundPaused = true; this.roundMessage = "P" + (scorer + 1) + " SCORE!";
      this.pendingWinner = this.scores[scorer] >= CONFIG.SCORE_TO_WIN ? scorer + 1 : 0;
      this.roundEndsAt = now + (this.pendingWinner ? CONFIG.WIN_PAUSE_MS : CONFIG.GOAL_PAUSE_MS);
      this.puck.vx = 0; this.puck.vy = 0;
      this.players.forEach((player) => { if (player.pointerId !== null) this.releasePointer(player.pointerId); });
      this.lastCollision = "goal P" + (scorer + 1);
      if (this.onGoalSound) this.onGoalSound(scorer);
      if (navigator.vibrate) navigator.vibrate([25, 30, 55]);
    }
    finish(winner) {
      if (!this.active) return;
      this.stop(); this.onFinish(winner, "3点先取！");
    }
    updateHud() {
      if (!this.players || !this.energyBars) return;
      this.players.forEach((player, index) => {
        this.energyBars[index].style.transform = "scaleX(" + clamp(player.speed / CONFIG.MAX_PADDLE_SPEED, 0, 1).toFixed(3) + ")";
        this.energyBars[index].classList.toggle("tired", player.active);
      });
      if (!(this.debug || this.testMode) || !this.debugPanel) return;
      const p1 = this.players[0]; const p2 = this.players[1]; const puckSpeed = speedOf(this.puck);
      this.debugPanel.textContent = [
        "P1 pointerId  " + (p1.pointerId === null ? "-" : p1.pointerId),
        "P1 paddle     " + p1.x.toFixed(1) + ", " + p1.y.toFixed(1),
        "P1 speed      " + p1.speed.toFixed(1),
        "P2 pointerId  " + (p2.pointerId === null ? "-" : p2.pointerId),
        "P2 paddle     " + p2.x.toFixed(1) + ", " + p2.y.toFixed(1),
        "P2 speed      " + p2.speed.toFixed(1),
        "puck          " + this.puck.x.toFixed(1) + ", " + this.puck.y.toFixed(1),
        "puck velocity " + this.puck.vx.toFixed(1) + ", " + this.puck.vy.toFixed(1),
        "puck speed    " + puckSpeed.toFixed(1),
        "FPS           " + Math.round(this.fps),
        "last collision " + this.lastCollision
      ].join("\n");
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.players) { this.resetPaddles(); this.resetPuck(); }
      this.render();
    }
    render() {
      if (!this.context || !this.players || !this.puck) return;
      const ctx = this.context; const w = this.width; const h = this.height; const table = this.tableBounds();
      const floor = ctx.createLinearGradient(0, table.top, 0, table.bottom);
      floor.addColorStop(0, "#073f51"); floor.addColorStop(.49, "#082836");
      floor.addColorStop(.51, "#221924"); floor.addColorStop(1, "#511d2b");
      ctx.fillStyle = "#031019"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = floor; ctx.fillRect(table.left, table.top, table.right - table.left, table.bottom - table.top);
      this.drawTable(ctx, table); this.drawMotionTrail(ctx); this.drawPuck(ctx);
      this.players.forEach((player) => this.drawPaddle(ctx, player));
      if (this.testMode) this.drawTestOverlay(ctx, table);
      if (this.roundMessage) this.drawRoundMessage(ctx);
    }
    drawTable(ctx, table) {
      const cx = (table.left + table.right) / 2; const goalHalf = (table.right - table.left) * CONFIG.GOAL_WIDTH_RATIO / 2;
      ctx.save(); ctx.strokeStyle = "rgba(255,248,223,.68)"; ctx.lineWidth = 3;
      ctx.strokeRect(table.left, table.top, table.right - table.left, table.bottom - table.top);
      ctx.strokeStyle = "rgba(255,255,255,.32)"; ctx.lineWidth = 2; ctx.setLineDash([9, 10]);
      ctx.beginPath(); ctx.moveTo(table.left, table.centerY); ctx.lineTo(table.right, table.centerY); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx, table.centerY, Math.min(table.right - table.left, table.bottom - table.top) * .12, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 7;
      [table.top, table.bottom].forEach((y) => { ctx.beginPath(); ctx.moveTo(cx - goalHalf, y); ctx.lineTo(cx + goalHalf, y); ctx.stroke(); });
      ctx.fillStyle = "rgba(255,248,223,.86)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "950 " + Math.max(18, Math.min(30, this.width * .07)) + "px ui-monospace, Consolas, monospace";
      ctx.save(); ctx.translate(cx, table.top + 28); ctx.rotate(Math.PI); ctx.fillText("P1  " + this.scores[0], 0, 0); ctx.restore();
      ctx.fillText("P2  " + this.scores[1], cx, table.bottom - 28); ctx.restore();
    }
    drawPaddle(ctx, player) {
      const radius = this.paddleRadius(); const color = player.index === 0 ? "#27d9e6" : "#ff5a51";
      ctx.save(); ctx.translate(player.x, player.y); ctx.shadowColor = color; ctx.shadowBlur = player.active ? 24 : 10;
      ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.beginPath(); ctx.ellipse(4, radius * .28, radius, radius * .72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      const cap = ctx.createRadialGradient(-radius * .28, -radius * .3, 1, 0, 0, radius);
      cap.addColorStop(0, "#fffbd6"); cap.addColorStop(.18, color); cap.addColorStop(1, player.index === 0 ? "#087f9a" : "#a92e3e");
      ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(0, 0, radius * .72, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = player.active ? 4 : 2; ctx.strokeStyle = player.active ? "#fff8df" : "rgba(255,255,255,.6)"; ctx.stroke(); ctx.restore();
    }
    drawPuck(ctx) {
      const radius = this.puckRadius(); ctx.save(); ctx.translate(this.puck.x, this.puck.y);
      ctx.shadowColor = "#ffc857"; ctx.shadowBlur = 16; ctx.fillStyle = "#091019";
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#ffc857"; ctx.stroke(); ctx.fillStyle = "#fff8df";
      ctx.beginPath(); ctx.arc(-radius * .25, -radius * .28, radius * .18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    drawMotionTrail(ctx) {
      const puckSpeed = speedOf(this.puck); if (puckSpeed < 240) return;
      const length = clamp(puckSpeed * .055, 18, 62); const nx = this.puck.vx / puckSpeed; const ny = this.puck.vy / puckSpeed;
      ctx.save(); ctx.strokeStyle = "rgba(255,200,87," + clamp(puckSpeed / CONFIG.MAX_PUCK_SPEED, .2, .75) + ")";
      ctx.lineWidth = Math.max(2, this.puckRadius() * .45); ctx.lineCap = "round";
      for (let line = 1; line <= 3; line += 1) {
        ctx.globalAlpha = .7 / line; ctx.beginPath();
        ctx.moveTo(this.puck.x - nx * length * line * .38, this.puck.y - ny * length * line * .38);
        ctx.lineTo(this.puck.x - nx * length * (line * .38 + .32), this.puck.y - ny * length * (line * .38 + .32)); ctx.stroke();
      }
      ctx.restore();
    }
    drawRoundMessage(ctx) {
      const table = this.tableBounds(); ctx.save(); ctx.translate((table.left + table.right) / 2, table.centerY);
      const boxWidth = Math.min(360, this.width * .84);
      ctx.fillStyle = "rgba(3,13,21,.84)"; ctx.fillRect(-boxWidth / 2, -38, boxWidth, 76);
      ctx.fillStyle = this.roundMessage === "READY" ? "#fff8df" : "#ffc857";
      ctx.font = "1000 " + Math.max(25, Math.min(42, this.width * .1)) + "px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(this.roundMessage, 0, 0); ctx.restore();
    }
    drawTestOverlay(ctx, table) {
      ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(120,255,155,.72)";
      ctx.strokeRect(table.left, table.top, table.right - table.left, table.centerY - table.top);
      ctx.strokeRect(table.left, table.centerY, table.right - table.left, table.bottom - table.centerY); ctx.setLineDash([]);
      [...this.players, this.puck].forEach((body, index) => {
        const radius = index < 2 ? this.paddleRadius() : this.puckRadius();
        ctx.strokeStyle = index === 0 ? "#27d9e6" : index === 1 ? "#ff5a51" : "#ffc857";
        ctx.beginPath(); ctx.arc(body.x, body.y, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.lineTo(body.x + body.vx * .08, body.y + body.vy * .08); ctx.stroke();
      });
      ctx.restore();
    }
  }
  window.TABLE_HOCKEY_CONFIG = CONFIG;
  window.TableHockeyGame = TableHockeyGame;
})();
