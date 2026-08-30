(function () {
  "use strict";

  const STATES = Object.freeze({
    READY:"READY", PLAYING:"PLAYING", PAUSED:"PAUSED", LIFE_LOST:"LIFE_LOST",
    STAGE_CLEAR:"STAGE_CLEAR", GAME_OVER:"GAME_OVER", ALL_CLEAR:"ALL_CLEAR"
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const circleRectCollision = (ball, rect) => {
    const x = clamp(ball.x, rect.x, rect.x + rect.w);
    const y = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - x, dy = ball.y - y;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  };
  const comboMultiplier = combo => combo >= 10 ? 2 : combo >= 5 ? 1.5 : combo >= 3 ? 1.2 : 1;

  class BreakoutGame {
    constructor(canvas, sound, settings, onEnd, options = {}) {
      this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.sound = sound; this.settings = settings; this.onEnd = onEnd;
      this.controlsRoot = options.controlsRoot || canvas.parentElement || document;
      this.actionButton = this.controlsRoot.querySelector?.("#breakoutActionButton") || null;
      this.bestScore = options.bestScore || 0;
      this.running = false; this.finished = false; this.state = STATES.READY; this.beforePause = STATES.READY;
      this.stageIndex = 0; this.score = 0; this.lives = 3; this.combo = 0; this.maxCombo = 0; this.elapsed = 0; this.fps = 60;
      this.last = 0; this.cleanup = []; this.keys = { left:false, right:false }; this.pointerActive = false;
      this.targetPaddleX = null; this.blocks = []; this.balls = []; this.items = []; this.particles = [];
      this.paddle = { x:0, y:0, w:92, baseWidth:92, h:14, wideTimer:0 };
      this.stats = { blocksDestroyed:0, hardDestroyed:0, items:0, misses:0, highestBallCount:1, multiballDestroyed:0 };
      this.destroyedThisStage = 0; this.warningPlayed = false; this.transitionTimer = 0; this.shake = 0;
      this.boundLoop = time => this.loop(time);
    }

    start() {
      this.sound.resetPlayStats(); this.resize(); this.bind(); this.loadStage(0);
      this.running = true; this.last = performance.now(); requestAnimationFrame(this.boundLoop);
    }

    stop() {
      if (this.actionButton) this.actionButton.hidden = true;
      this.running = false; this.finished = true; this.cleanup.splice(0).forEach(remove => remove());
      this.keys.left = this.keys.right = false; this.pointerActive = false;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
      this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.width = Math.max(280, rect.width); this.height = Math.max(480, rect.height);
      this.paddle.y = this.height - 72;
      this.paddle.x = clamp(this.paddle.x || (this.width - this.paddle.w) / 2, 8, this.width - this.paddle.w - 8);
      this.targetPaddleX = this.targetPaddleX == null ? this.paddle.x + this.paddle.w / 2 : clamp(this.targetPaddleX, 0, this.width);
      if (this.blocks.length) {
        const previous = new Map(this.blocks.map(block => [block.id, block]));
        this.blocks = window.BreakoutLevel.createBlocks(window.BREAKOUT_LEVELS[this.stageIndex], this.width).map(block => {
          const saved = previous.get(block.id);
          return saved ? { ...block, hp:saved.hp, active:saved.active, hitFlash:saved.hitFlash } : block;
        });
      }
    }

    bind() {
      const point = event => {
        const rect = this.canvas.getBoundingClientRect();
        return clamp(event.clientX - rect.left, 0, rect.width);
      };
      const down = event => {
        event.preventDefault(); this.pointerActive = true; this.targetPaddleX = point(event);
        this.canvas.setPointerCapture?.(event.pointerId); this.primaryAction();
      };
      const move = event => {
        if (!this.pointerActive && event.pointerType !== "mouse") return;
        event.preventDefault(); this.targetPaddleX = point(event);
      };
      const action = event => { event.preventDefault(); this.primaryAction(); };
      this.actionButton?.addEventListener("click", action);
      const up = event => { event.preventDefault(); this.pointerActive = false; };
      this.canvas.addEventListener("pointerdown", down); this.canvas.addEventListener("pointermove", move);
      this.canvas.addEventListener("pointerup", up); this.canvas.addEventListener("pointercancel", up);
      const keydown = event => {
        if (event.code === "ArrowLeft" || event.code === "ArrowRight") { event.preventDefault(); this.keys[event.code === "ArrowLeft" ? "left" : "right"] = true; }
        if (event.code === "Space") { event.preventDefault(); this.primaryAction(); }
        if (event.code === "KeyP") { event.preventDefault(); this.togglePause(); }
      };
      const keyup = event => {
        if (event.code === "ArrowLeft" || event.code === "ArrowRight") { event.preventDefault(); this.keys[event.code === "ArrowLeft" ? "left" : "right"] = false; }
      };
      const visibility = () => { if (document.hidden && this.state === STATES.PLAYING) this.pause(true); };
      window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); document.addEventListener("visibilitychange", visibility);
      this.cleanup.push(() => {
        this.canvas.removeEventListener("pointerdown", down); this.canvas.removeEventListener("pointermove", move);
        this.canvas.removeEventListener("pointerup", up); this.canvas.removeEventListener("pointercancel", up);
        window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); document.removeEventListener("visibilitychange", visibility);
        this.actionButton?.removeEventListener("click", action);
      });
    }

    primaryAction() {
      if (this.state === STATES.READY) this.launch();
      else if (this.state === STATES.PAUSED) this.resume();
      else if (this.state === STATES.STAGE_CLEAR) this.nextStage();
      else if (this.state === STATES.ALL_CLEAR) this.finish(true);
    }

    pause(automatic = false) {
      if (![STATES.PLAYING, STATES.READY].includes(this.state)) return;
      this.beforePause = this.state; this.state = STATES.PAUSED; this.autoPaused = automatic;
    }
    resume() { if (this.state === STATES.PAUSED) { this.state = this.beforePause || STATES.READY; this.last = performance.now(); this.autoPaused = false; } }
    togglePause() { if (this.state === STATES.PAUSED) this.resume(); else this.pause(false); }

    loadStage(index) {
      this.stageIndex = index; this.destroyedThisStage = 0; this.warningPlayed = false; this.combo = 0;
      this.blocks = window.BreakoutLevel.createBlocks(window.BREAKOUT_LEVELS[index], this.width);
      this.items = []; this.particles = []; this.paddle.w = this.paddle.baseWidth; this.paddle.wideTimer = 0;
      this.paddle.x = (this.width - this.paddle.w) / 2; this.targetPaddleX = this.width / 2;
      this.balls = [this.createBall(true)]; this.state = STATES.READY; this.transitionTimer = 0;
    }

    createBall(attached = false, source = null, angleOffset = 0) {
      const speed = source ? Math.hypot(source.vx, source.vy) : this.currentSpeed();
      const baseAngle = source ? Math.atan2(source.vy, source.vx) : -Math.PI / 2;
      return {
        x: source?.x ?? this.paddle.x + this.paddle.w / 2, y: source?.y ?? this.paddle.y - 10,
        vx: attached ? 0 : Math.cos(baseAngle + angleOffset) * speed,
        vy: attached ? 0 : Math.sin(baseAngle + angleOffset) * speed,
        radius: 7, active:true, attached
      };
    }

    launch() {
      const ball = this.balls.find(entry => entry.active);
      if (!ball) this.balls = [this.createBall(true)];
      const active = this.balls.find(entry => entry.active);
      const speed = this.currentSpeed(); active.attached = false; active.vx = speed * .24; active.vy = -Math.sqrt(speed * speed - active.vx * active.vx);
      this.state = STATES.PLAYING; this.play("breakoutLaunch");
    }

    currentSpeed() { return Math.min(470, 270 + this.stageIndex * 18 + this.stats.blocksDestroyed * 3.2); }
    play(soundKey) { Promise.resolve(this.sound.play(soundKey)).catch(() => {}); }

    loop(time) {
      if (!this.running) return;
      const dt = Math.min(.04, Math.max(0, (time - this.last) / 1000)); this.last = time;
      this.fps += (1 / Math.max(.001, dt) - this.fps) * .08;
      if (this.state !== STATES.PAUSED) this.update(dt);
      this.draw(); requestAnimationFrame(this.boundLoop);
    }

    update(dt) {
      this.elapsed += dt; this.shake = Math.max(0, this.shake - dt);
      this.paddle.wideTimer = Math.max(0, this.paddle.wideTimer - dt);
      const desiredWidth = this.paddle.wideTimer > 0 ? Math.min(150, this.width * .42) : this.paddle.baseWidth;
      this.paddle.w += (desiredWidth - this.paddle.w) * Math.min(1, dt * 8);
      if (this.keys.left) this.targetPaddleX -= 330 * dt;
      if (this.keys.right) this.targetPaddleX += 330 * dt;
      this.targetPaddleX = clamp(this.targetPaddleX, this.paddle.w / 2 + 7, this.width - this.paddle.w / 2 - 7);
      const targetLeft = this.targetPaddleX - this.paddle.w / 2;
      this.paddle.x += (targetLeft - this.paddle.x) * Math.min(1, dt * 15);
      this.paddle.x = clamp(this.paddle.x, 7, this.width - this.paddle.w - 7);

      this.blocks.forEach(block => { block.hitFlash = Math.max(0, block.hitFlash - dt); });
      this.updateParticles(dt);
      if (this.state === STATES.READY) {
        this.balls.forEach(ball => { if (ball.attached) { ball.x = this.paddle.x + this.paddle.w / 2; ball.y = this.paddle.y - ball.radius - 2; } });
        return;
      }
      if (this.state === STATES.LIFE_LOST) {
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) { this.balls = [this.createBall(true)]; this.state = STATES.READY; }
        return;
      }
      if (this.state !== STATES.PLAYING) return;

      const maxSpeed = this.balls.reduce((max, ball) => Math.max(max, Math.hypot(ball.vx, ball.vy)), 0);
      const steps = clamp(Math.ceil(maxSpeed * dt / 6), 1, 12);
      for (let step = 0; step < steps; step += 1) {
        for (const ball of this.balls) if (ball.active) this.stepBall(ball, dt / steps);
      }
      this.balls = this.balls.filter(ball => ball.active);
      this.updateItems(dt);
      if (!this.balls.length && this.state === STATES.PLAYING) this.loseLife();
    }

    stepBall(ball, dt) {
      const previous = { x:ball.x, y:ball.y };
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      let wallHit = false;
      if (ball.x - ball.radius <= 0 && ball.vx < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); wallHit = true; }
      else if (ball.x + ball.radius >= this.width && ball.vx > 0) { ball.x = this.width - ball.radius; ball.vx = -Math.abs(ball.vx); wallHit = true; }
      if (ball.y - ball.radius <= 66 && ball.vy < 0) { ball.y = 66 + ball.radius; ball.vy = Math.abs(ball.vy); wallHit = true; }
      if (wallHit) this.play("breakoutWall");

      if (ball.vy > 0 && previous.y + ball.radius <= this.paddle.y + 3 && circleRectCollision(ball, this.paddle)) {
        ball.y = this.paddle.y - ball.radius - .5;
        const offset = clamp((ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2), -1, 1);
        const speed = clamp(Math.hypot(ball.vx, ball.vy), 230, 470);
        const angle = offset * 1.08;
        ball.vx = Math.sin(angle) * speed; ball.vy = -Math.cos(angle) * speed;
        this.combo = 0; this.play("breakoutPaddle");
      }

      for (const block of this.blocks) {
        if (!block.active || !circleRectCollision(ball, block)) continue;
        this.reflectFromBlock(ball, block, previous);
        this.hitBlock(block);
        break;
      }
      if (ball.y - ball.radius > this.height) ball.active = false;
    }

    reflectFromBlock(ball, block, previous) {
      if (previous.y + ball.radius <= block.y) { ball.y = block.y - ball.radius - .2; ball.vy = -Math.abs(ball.vy); }
      else if (previous.y - ball.radius >= block.y + block.h) { ball.y = block.y + block.h + ball.radius + .2; ball.vy = Math.abs(ball.vy); }
      else if (previous.x + ball.radius <= block.x) { ball.x = block.x - ball.radius - .2; ball.vx = -Math.abs(ball.vx); }
      else if (previous.x - ball.radius >= block.x + block.w) { ball.x = block.x + block.w + ball.radius + .2; ball.vx = Math.abs(ball.vx); }
      else ball.vy *= -1;
    }

    hitBlock(block) {
      block.hitFlash = .1;
      if (block.type === "metal") { this.play("breakoutHardBlock"); return; }
      if (block.type === "hard" && block.hp > 1) { block.hp -= 1; this.play("breakoutHardBlock"); return; }
      block.hp = 0; block.active = false; this.destroyedThisStage += 1; this.stats.blocksDestroyed += 1;
      if (block.type === "hard") { this.stats.hardDestroyed += 1; this.play("breakoutHardBreak"); this.shake = .12; }
      else this.play("breakoutBlock");
      if (this.balls.length > 1) this.stats.multiballDestroyed += 1;
      this.combo += 1; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const base = block.type === "hard" ? 200 : 100;
      this.score += Math.round(base * comboMultiplier(this.combo));
      if ([3, 5, 10, 20].includes(this.combo)) { this.play("breakoutCombo"); if (this.combo >= 10) this.shake = .16; }
      this.spawnParticles(block);
      const level = window.BREAKOUT_LEVELS[this.stageIndex];
      if (Math.random() < level.itemChance) this.spawnItem(block);
      this.normalizeBallSpeeds();
      const remaining = this.remainingBlocks();
      if (remaining <= 5 && remaining > 0 && !this.warningPlayed) { this.warningPlayed = true; this.play("breakoutWarning"); }
      if (remaining === 0) this.stageClear();
    }

    normalizeBallSpeeds() {
      const target = this.currentSpeed();
      this.balls.forEach(ball => {
        const speed = Math.hypot(ball.vx, ball.vy) || target;
        const scale = target / speed; ball.vx *= scale; ball.vy *= scale;
      });
    }

    remainingBlocks() { return this.blocks.filter(block => block.active && block.type !== "metal").length; }

    spawnItem(block) {
      const types = ["wide", "multi", "slow"];
      this.items.push({ x:block.x + block.w / 2, y:block.y + block.h / 2, w:24, h:24, vy:105, type:types[Math.floor(Math.random() * types.length)], active:true, spin:0 });
    }

    updateItems(dt) {
      for (const item of this.items) {
        if (!item.active) continue;
        item.y += item.vy * dt; item.spin += dt * 5;
        if (item.x + item.w / 2 > this.paddle.x && item.x - item.w / 2 < this.paddle.x + this.paddle.w && item.y + item.h / 2 > this.paddle.y && item.y - item.h / 2 < this.paddle.y + this.paddle.h) {
          item.active = false; this.collectItem(item.type);
        } else if (item.y > this.height + 30) item.active = false;
      }
      this.items = this.items.filter(item => item.active);
    }

    collectItem(type) {
      this.stats.items += 1; this.score += 100; this.play("breakoutItem");
      if (type === "wide") { this.paddle.wideTimer = 12; this.play("breakoutPowerUp"); }
      if (type === "slow") {
        this.balls.forEach(ball => { const speed = Math.hypot(ball.vx, ball.vy); const scale = Math.max(210, speed * .72) / Math.max(1, speed); ball.vx *= scale; ball.vy *= scale; });
        this.play("breakoutPowerUp");
      }
      if (type === "multi") {
        const source = this.balls[0];
        if (source) {
          const additions = Math.min(2, 5 - this.balls.length);
          for (let index = 0; index < additions; index += 1) this.balls.push(this.createBall(false, source, index ? .45 : -.45));
          this.stats.highestBallCount = Math.max(this.stats.highestBallCount, this.balls.length);
        }
        this.play("breakoutMultiBall");
      }
    }

    loseLife() {
      this.lives -= 1; this.stats.misses += 1; this.combo = 0; this.play("breakoutMiss");
      if (this.settings.vibration && navigator.vibrate) navigator.vibrate(70);
      if (this.lives <= 0) { this.state = STATES.GAME_OVER; this.play("breakoutGameOver"); this.finish(false, 850); }
      else { this.state = STATES.LIFE_LOST; this.transitionTimer = 1.1; }
    }

    stageClear() {
      if (![STATES.PLAYING, STATES.READY].includes(this.state)) return;
      this.play("breakoutClear"); this.balls.forEach(ball => { ball.active = false; }); this.items = [];
      this.state = this.stageIndex >= window.BREAKOUT_LEVELS.length - 1 ? STATES.ALL_CLEAR : STATES.STAGE_CLEAR;
    }

    nextStage() { if (this.state === STATES.STAGE_CLEAR) this.loadStage(this.stageIndex + 1); }

    finish(clear, delay = 0) {
      if (this.finished) return;
      this.finished = true;
      const complete = () => {
        this.running = false;
        this.onEnd({
          mode:"breakout", clear, allClear:clear && this.stageIndex === window.BREAKOUT_LEVELS.length - 1,
          score:this.score, counts:this.sound.getPlayStats(),
          stats:{ ...this.stats, maxCombo:this.maxCombo, stage:this.stageIndex + 1, time:this.elapsed }
        });
      };
      if (delay) setTimeout(complete, delay); else complete();
    }

    spawnParticles(block) {
      const colors = block.type === "hard" ? ["#ff7c45", "#ffe45d"] : ["#48e9e1", "#bd66ff", "#ff3b68"];
      for (let index = 0; index < 8; index += 1) this.particles.push({
        x:block.x + block.w / 2, y:block.y + block.h / 2,
        vx:(Math.random() - .5) * 150, vy:(Math.random() - .8) * 135,
        life:.35 + Math.random() * .35, size:3 + Math.random() * 4, color:colors[index % colors.length]
      });
      if (this.particles.length > 140) this.particles.splice(0, this.particles.length - 140);
    }

    updateParticles(dt) {
      this.particles.forEach(particle => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 260 * dt; });
      this.particles = this.particles.filter(particle => particle.life > 0);
    }

    getHudState() { return { mode:"breakout", score:this.score, combo:this.combo, best:this.bestScore }; }
    getDebugState() {
      const ball = this.balls[0];
      return {
        game:"breakout", playerState:this.state, fps:Math.round(this.fps), balls:this.balls.length,
        speed:ball ? Math.round(Math.hypot(ball.vx, ball.vy)) : 0, paddleX:Math.round(this.paddle.x),
        remaining:this.remainingBlocks(), destructible:this.blocks.filter(block => block.type !== "metal").length,
        combo:this.combo, maxCombo:this.maxCombo, items:this.items.length
      };
    }

    draw() {
      const ctx = this.ctx, w = this.width, h = this.height;
      ctx.save(); ctx.clearRect(0, 0, w, h);
      if (this.shake > 0) ctx.translate((Math.random() - .5) * 7, (Math.random() - .5) * 5);
      const background = ctx.createLinearGradient(0, 0, 0, h); background.addColorStop(0, "#101a39"); background.addColorStop(.55, "#111426"); background.addColorStop(1, "#080b14");
      ctx.fillStyle = background; ctx.fillRect(-8, -8, w + 16, h + 16);
      this.drawStars(ctx, w, h); this.drawStageHud(ctx, w); this.drawBlocks(ctx); this.drawItems(ctx); this.drawParticles(ctx); this.drawPaddle(ctx); this.drawBalls(ctx);
      if (this.state !== STATES.PLAYING) this.drawStateOverlay(ctx, w, h);
      if (this.debugHitboxes) this.drawHitboxes(ctx);
      ctx.restore();
    }

    drawStars(ctx, w, h) {
      ctx.fillStyle = "rgba(255,255,255,.2)";
      for (let index = 0; index < 26; index += 1) ctx.fillRect((index * 83) % w, 75 + (index * 47) % Math.max(1, h - 130), 1.5, 1.5);
    }

    drawStageHud(ctx, w) {
      ctx.font = "900 12px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#99a3bb"; ctx.fillText(`STAGE ${this.stageIndex + 1}`, 12, 91);
      ctx.textAlign = "center"; ctx.fillStyle = this.combo >= 5 ? "#ffe45d" : "#99a3bb"; ctx.fillText(`${this.combo} COMBO`, w / 2, 91);
      ctx.textAlign = "right"; ctx.fillStyle = "#ff7898"; ctx.fillText(`BALL ${"●".repeat(Math.max(0, this.lives))}${"○".repeat(Math.max(0, 3 - this.lives))}`, w - 12, 91);
    }

    drawBlocks(ctx) {
      const palette = ["#ff3b68", "#ff7c45", "#ffe45d", "#48e9e1", "#6d87ff", "#bd66ff"];
      for (const block of this.blocks) {
        if (!block.active) continue;
        ctx.save(); ctx.fillStyle = block.hitFlash ? "#fff" : block.type === "metal" ? "#70809a" : block.type === "hard" ? "#ff7c45" : palette[block.row % palette.length];
        ctx.fillRect(block.x, block.y, block.w, block.h); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(block.x + 2, block.y + 2, block.w - 4, 4);
        if (block.type === "hard" && block.hp === 1) { ctx.strokeStyle = "#25101a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(block.x + block.w * .2, block.y); ctx.lineTo(block.x + block.w * .48, block.y + block.h * .55); ctx.lineTo(block.x + block.w * .36, block.y + block.h); ctx.stroke(); }
        if (block.type === "metal") { ctx.strokeStyle = "#d4deef"; ctx.strokeRect(block.x + 2, block.y + 2, block.w - 4, block.h - 4); ctx.fillStyle = "#293448"; ctx.fillRect(block.x + 7, block.y + 8, 4, 4); ctx.fillRect(block.x + block.w - 11, block.y + 8, 4, 4); }
        ctx.restore();
      }
    }

    drawPaddle(ctx) {
      const glow = ctx.createLinearGradient(this.paddle.x, 0, this.paddle.x + this.paddle.w, 0); glow.addColorStop(0, "#48e9e1"); glow.addColorStop(.5, "#f5f7ff"); glow.addColorStop(1, "#48e9e1");
      ctx.shadowColor = "#48e9e1"; ctx.shadowBlur = 12; ctx.fillStyle = glow; ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h); ctx.shadowBlur = 0;
      this.updateActionButton();
    }

    drawBalls(ctx) {
      for (const ball of this.balls) {
        ctx.shadowColor = "#ffe45d"; ctx.shadowBlur = 15; ctx.fillStyle = "#fff7b2"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
    }

    updateActionButton() {
      if (!this.actionButton) return;
      const labels = {
        [STATES.READY]:"BALL START",
        [STATES.PAUSED]:"再開",
        [STATES.STAGE_CLEAR]:"次へ",
        [STATES.ALL_CLEAR]:"結果を見る"
      };
      const label = labels[this.state];
      this.actionButton.hidden = !label;
      if (label && this.actionButton.textContent !== label) this.actionButton.textContent = label;
    }

    drawItems(ctx) {
      const labels = { wide:"W", multi:"×3", slow:"S" };
      const colors = { wide:"#48e9e1", multi:"#ff3b68", slow:"#bd66ff" };
      for (const item of this.items) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(Math.sin(item.spin) * .14); ctx.fillStyle = colors[item.type]; ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
        ctx.fillStyle = "#081012"; ctx.font = "900 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText(labels[item.type], 0, 4); ctx.restore();
      }
    }

    drawParticles(ctx) { for (const particle of this.particles) { ctx.globalAlpha = clamp(particle.life * 2, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); } ctx.globalAlpha = 1; }

    drawStateOverlay(ctx, w, h) {
      const copy = {
        READY:[`STAGE ${this.stageIndex + 1}`, "タップ / SPACE で BALL START"],
        PAUSED:["PAUSED", this.autoPaused ? "Safariへ戻りました · タップして再開" : "タップ / P で再開"],
        LIFE_LOST:["MISS!", `残り BALL ${this.lives}`],
        STAGE_CLEAR:["STAGE CLEAR", "全部オレ！ · タップで次へ"],
        ALL_CLEAR:["ALL CLEAR!", "このゲームの音は全部あなたでした。 · 結果を見る"]
      }[this.state];
      if (!copy) return;
      ctx.fillStyle = "rgba(4,7,15,.7)"; ctx.fillRect(22, h * .42, w - 44, 112);
      ctx.textAlign = "center"; ctx.fillStyle = this.state.includes("CLEAR") ? "#ffe45d" : "#f5f7ff"; ctx.font = "900 26px sans-serif"; ctx.fillText(copy[0], w / 2, h * .42 + 45);
      ctx.fillStyle = "#99a3bb"; ctx.font = "900 12px sans-serif"; ctx.fillText(copy[1], w / 2, h * .42 + 76);
    }

    drawHitboxes(ctx) {
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1;
      ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
      this.blocks.filter(block => block.active).forEach(block => ctx.strokeRect(block.x, block.y, block.w, block.h));
      this.balls.forEach(ball => { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.stroke(); });
    }
  }

  BreakoutGame.STATES = STATES;
  BreakoutGame.circleRectCollision = circleRectCollision;
  BreakoutGame.comboMultiplier = comboMultiplier;
  window.BreakoutGame = BreakoutGame;
})();
