(function () {
  "use strict";

  class ActionGame {
    constructor(canvas, soundManager, settings, onEnd, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.sound = soundManager;
      this.settings = settings;
      this.onEnd = onEnd;
      this.controlsRoot = options.controlsRoot || document;
      this.running = false;
      this.finished = false;
      this.last = 0;
      this.elapsed = 0;
      this.score = 0;
      this.hp = 3;
      this.cameraX = 0;
      this.worldWidth = 3100;
      this.groundY = 430;
      this.input = { left: false, right: false, jump: false, attack: false };
      this.pressed = { jump: false, attack: false };
      this.cleanup = [];
      this.stats = { kills: 0, items: 0, damage: 0, falls: 0 };
      this.player = { x: 90, y: 320, w: 30, h: 44, vx: 0, vy: 0, onGround: false, wasGrounded: false, airtime: 0, facing: 1, invincible: 0, attackTimer: 0, attackHit: false, state: "idle", checkpointX: 90, respawning: 0 };
      this.platforms = [
        { x: 0, y: 430, w: 610, h: 90 }, { x: 735, y: 430, w: 580, h: 90 },
        { x: 1435, y: 430, w: 780, h: 90 }, { x: 2340, y: 430, w: 760, h: 90 },
        { x: 330, y: 340, w: 150, h: 18 }, { x: 910, y: 325, w: 145, h: 18 },
        { x: 1190, y: 275, w: 125, h: 18 }, { x: 1570, y: 330, w: 150, h: 18 },
        { x: 1900, y: 280, w: 160, h: 18 }, { x: 2470, y: 320, w: 160, h: 18 }
      ];
      this.enemies = [
        this.enemy(430, 388, "patrol"), this.enemy(830, 388, "chaser"), this.enemy(1110, 250, "flying"),
        this.enemy(1530, 388, "patrol"), this.enemy(1850, 388, "chaser"), this.enemy(2050, 235, "flying"),
        this.enemy(2490, 388, "patrol"), this.enemy(2700, 388, "chaser")
      ];
      this.items = [
        this.item(390, 300, "coin"), this.item(790, 380, "coin"), this.item(970, 285, "star"),
        this.item(1250, 235, "heart"), this.item(1640, 290, "coin"), this.item(1980, 240, "power"),
        this.item(2420, 375, "coin"), this.item(2550, 280, "star")
      ];
      this.checkpoint = { x: 1740, y: 350, active: false };
      this.goal = { x: 2925, y: 318 };
      this.boundLoop = (time) => this.loop(time);
    }

    enemy(x, y, type) { return { x, y, homeX: x, w: 34, h: 34, vx: type === "patrol" ? 55 : 0, hp: type === "chaser" ? 2 : 1, type, t: Math.random() * 4, dead: false, hitFlash: 0 }; }
    item(x, y, type) { return { x, y, r: 11, type, taken: false, t: Math.random() * 6 }; }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(rect.width * ratio);
      this.canvas.height = Math.round(rect.height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
      this.scaleY = this.height / 520;
    }

    start() {
      this.sound.resetPlayStats();
      this.resize();
      this.bindControls();
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.boundLoop);
    }

    stop() {
      this.running = false;
      this.cleanup.splice(0).forEach((remove) => remove());
      this.input.left = this.input.right = this.input.jump = this.input.attack = false;
    }

    bindControls() {
      const setControl = (name, active) => {
        if ((name === "jump" || name === "attack") && active && !this.input[name]) this.pressed[name] = true;
        this.input[name] = active;
      };
      this.controlsRoot.querySelectorAll("[data-action-control]").forEach((button) => {
        const name = button.dataset.actionControl;
        const down = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); setControl(name, true); button.classList.add("is-pressed"); };
        const up = (event) => { event.preventDefault(); setControl(name, false); button.classList.remove("is-pressed"); };
        button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("lostpointercapture", up);
        this.cleanup.push(() => { button.removeEventListener("pointerdown", down); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", up); });
      });
      const keys = { ArrowLeft: "left", ArrowRight: "right", Space: "jump", KeyZ: "attack" };
      const keydown = (event) => { const name = keys[event.code]; if (!name) return; event.preventDefault(); setControl(name, true); };
      const keyup = (event) => { const name = keys[event.code]; if (!name) return; event.preventDefault(); setControl(name, false); };
      window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
      this.cleanup.push(() => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); });
    }

    loop(time) {
      if (!this.running) return;
      const dt = Math.min(.034, (time - this.last) / 1000);
      this.last = time;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.boundLoop);
    }

    update(dt) {
      this.elapsed += dt;
      const p = this.player;
      p.invincible = Math.max(0, p.invincible - dt);
      p.attackTimer = Math.max(0, p.attackTimer - dt);
      if (p.respawning > 0) { p.respawning -= dt; if (p.respawning <= 0) this.restoreCheckpoint(); return; }

      const direction = Number(this.input.right) - Number(this.input.left);
      if (direction) { p.vx += direction * 1050 * dt; p.facing = direction; }
      else p.vx *= Math.pow(.001, dt);
      p.vx = Math.max(-220, Math.min(220, p.vx));

      if (this.pressed.jump) {
        this.pressed.jump = false;
        if (p.onGround) { p.vy = -480; p.onGround = false; p.airtime = 0; p.state = "jump"; this.sound.play("actionJump"); }
      }
      if (this.pressed.attack) {
        this.pressed.attack = false;
        if (p.attackTimer <= 0) { p.attackTimer = .3; p.attackHit = false; p.state = "attack"; this.sound.play("actionAttack"); }
      }

      if (p.attackTimer > .1 && p.attackTimer < .23 && !p.attackHit) this.attackEnemies();
      p.wasGrounded = p.onGround;
      p.vy += 1180 * dt;
      const previousBottom = p.y + p.h / 2;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(15, Math.min(this.worldWidth - 15, p.x));
      p.onGround = false;
      if (p.vy >= 0) {
        for (const platform of this.platforms) {
          const nextBottom = p.y + p.h / 2;
          if (p.x + p.w / 2 > platform.x && p.x - p.w / 2 < platform.x + platform.w && previousBottom <= platform.y + 8 && nextBottom >= platform.y) {
            p.y = platform.y - p.h / 2; p.vy = 0; p.onGround = true; break;
          }
        }
      }
      if (!p.onGround) p.airtime += dt;
      if (p.onGround && !p.wasGrounded && p.airtime > .16) { this.sound.play("actionLand"); p.airtime = 0; }
      if (p.attackTimer <= 0) p.state = p.onGround ? (Math.abs(p.vx) > 18 ? "walk" : "idle") : "jump";

      this.updateEnemies(dt);
      this.collectItems();
      this.checkWorldEvents();
      this.cameraX += (Math.max(0, Math.min(this.worldWidth - this.width, p.x - this.width * .38)) - this.cameraX) * Math.min(1, dt * 7);
    }

    attackEnemies() {
      const p = this.player;
      p.attackHit = true;
      const attackX = p.x + p.facing * 38;
      for (const enemy of this.enemies) {
        if (enemy.dead || Math.abs(enemy.x - attackX) > 44 || Math.abs(enemy.y - p.y) > 45) continue;
        enemy.hp -= 1; enemy.hitFlash = .16; enemy.vx += p.facing * 130; this.sound.play("actionEnemyHit");
        if (enemy.hp <= 0) { enemy.dead = true; this.stats.kills += 1; this.score += 300; this.sound.play("actionEnemyDestroy"); }
      }
    }

    updateEnemies(dt) {
      const p = this.player;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        enemy.t += dt; enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        if (enemy.type === "patrol") { enemy.x += enemy.vx * dt; if (Math.abs(enemy.x - enemy.homeX) > 95) enemy.vx *= -1; }
        if (enemy.type === "chaser" && Math.abs(enemy.x - p.x) < 330) enemy.x += Math.sign(p.x - enemy.x) * 68 * dt;
        if (enemy.type === "flying") { enemy.x += Math.sin(enemy.t * 1.8) * 42 * dt; enemy.y = enemy.homeX % 2 ? 250 + Math.sin(enemy.t * 3) * 48 : 235 + Math.sin(enemy.t * 3) * 48; }
        if (p.invincible <= 0 && Math.abs(enemy.x - p.x) < (enemy.w + p.w) / 2 && Math.abs(enemy.y - p.y) < (enemy.h + p.h) / 2) this.damage(Math.sign(p.x - enemy.x) || 1);
      }
    }

    damage(direction) {
      const p = this.player;
      if (p.invincible > 0 || this.finished) return;
      this.hp -= 1; this.stats.damage += 1; p.invincible = 1.1; p.vx = direction * 230; p.vy = -260; p.state = "damage";
      this.sound.play("actionDamage");
      if (this.settings.vibration && navigator.vibrate) navigator.vibrate(80);
      if (this.hp <= 0) this.finish(false);
    }

    collectItems() {
      const p = this.player;
      for (const item of this.items) {
        if (item.taken || Math.hypot(item.x - p.x, item.y - p.y) > 34) continue;
        item.taken = true; this.stats.items += 1; this.score += item.type === "star" ? 500 : 150; this.sound.play("actionItem");
        if (item.type === "heart") this.hp = Math.min(3, this.hp + 1);
        if (item.type === "power") { this.score += 350; this.sound.play("actionPowerUp"); }
      }
    }

    checkWorldEvents() {
      const p = this.player;
      if (p.y > 585 && p.respawning <= 0) {
        this.stats.falls += 1; p.respawning = .75; p.vx = 0; this.sound.play("actionFall");
      }
      if (!this.checkpoint.active && p.x > this.checkpoint.x) {
        this.checkpoint.active = true; p.checkpointX = this.checkpoint.x + 35; this.score += 400; this.sound.play("actionCheckpoint");
      }
      if (p.x > this.goal.x && !this.finished) this.finish(true);
    }

    restoreCheckpoint() {
      const p = this.player;
      p.x = p.checkpointX; p.y = 330; p.vx = 0; p.vy = 0; p.invincible = 1; p.state = "idle";
    }

    finish(clear) {
      if (this.finished) return;
      this.finished = true; this.running = false;
      this.sound.play(clear ? "actionClear" : "actionGameOver");
      this.onEnd({ mode: "action", clear, score: this.score, counts: this.sound.getPlayStats(), stats: { ...this.stats, time: this.elapsed } });
    }

    getHudState() { return { score: this.score, hp: this.hp, maxHp: 3, mode: "action" }; }
    getDebugState() { const p = this.player; return { game: "action", playerState: p.state, fps: this.last ? Math.round(1 / Math.max(.001, (performance.now() - this.last) / 1000)) : 0, x: Math.round(p.x), y: Math.round(p.y), grounded: p.onGround, enemies: this.enemies.filter((enemy) => !enemy.dead).length }; }

    draw() {
      const ctx = this.ctx, sy = this.scaleY;
      ctx.save(); ctx.scale(1, sy); ctx.clearRect(0, 0, this.width, 520);
      const sky = ctx.createLinearGradient(0, 0, 0, 520); sky.addColorStop(0, "#10183c"); sky.addColorStop(1, "#38214d"); ctx.fillStyle = sky; ctx.fillRect(0, 0, this.width, 520);
      this.drawBackground(ctx);
      ctx.save(); ctx.translate(-this.cameraX, 0);
      this.drawWorld(ctx); this.drawItems(ctx); this.drawEnemies(ctx); this.drawPlayer(ctx);
      ctx.restore(); ctx.restore();
    }

    drawBackground(ctx) {
      const far = this.cameraX * .18;
      ctx.fillStyle = "rgba(72,233,225,.08)";
      for (let i = -1; i < 8; i++) { const x = i * 180 - (far % 180); ctx.beginPath(); ctx.moveTo(x, 420); ctx.lineTo(x + 90, 190 + (i % 2) * 55); ctx.lineTo(x + 190, 420); ctx.fill(); }
      ctx.fillStyle = "rgba(255,228,93,.65)"; for (let i = 0; i < 22; i++) ctx.fillRect((i * 137 - this.cameraX * .35) % (this.width + 30), 45 + (i * 67) % 250, 2, 2);
    }

    drawWorld(ctx) {
      for (const platform of this.platforms) { ctx.fillStyle = platform.h > 20 ? "#172a38" : "#263b50"; ctx.fillRect(platform.x, platform.y, platform.w, platform.h); ctx.fillStyle = "#48e9e1"; ctx.fillRect(platform.x, platform.y, platform.w, 5); }
      ctx.fillStyle = this.checkpoint.active ? "#ffe45d" : "#778198"; ctx.fillRect(this.checkpoint.x, 334, 7, 96); ctx.beginPath(); ctx.moveTo(this.checkpoint.x + 7, 338); ctx.lineTo(this.checkpoint.x + 55, 354); ctx.lineTo(this.checkpoint.x + 7, 370); ctx.fill();
      ctx.fillStyle = "#ffe45d"; ctx.fillRect(this.goal.x, 302, 8, 128); ctx.fillStyle = "#ff3b68"; ctx.fillRect(this.goal.x + 8, 308, 70, 34); ctx.fillStyle = "white"; ctx.font = "900 13px sans-serif"; ctx.fillText("GOAL", this.goal.x + 19, 330);
    }

    drawItems(ctx) {
      for (const item of this.items) { if (item.taken) continue; item.t += .035; ctx.save(); ctx.translate(item.x, item.y + Math.sin(item.t * 3) * 5); ctx.rotate(item.t); ctx.fillStyle = item.type === "heart" ? "#ff3b68" : item.type === "power" ? "#bd66ff" : "#ffe45d"; ctx.fillRect(-9, -9, 18, 18); ctx.restore(); }
    }

    drawEnemies(ctx) {
      for (const enemy of this.enemies) { if (enemy.dead) continue; ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.fillStyle = enemy.hitFlash ? "white" : enemy.type === "flying" ? "#bd66ff" : enemy.type === "chaser" ? "#ff3b68" : "#ff7c45"; ctx.fillRect(-17, -17, 34, 34); ctx.fillStyle = "white"; ctx.fillRect(-10, -5, 6, 6); ctx.fillRect(4, -5, 6, 6); if (enemy.type === "flying") { ctx.fillStyle = "#48e9e1"; ctx.fillRect(-28, -5, 11, 7); ctx.fillRect(17, -5, 11, 7); } ctx.restore(); }
    }

    drawPlayer(ctx) {
      const p = this.player; ctx.save(); if (p.invincible > 0 && Math.floor(p.invincible * 12) % 2) ctx.globalAlpha = .25; ctx.translate(p.x, p.y); ctx.scale(p.facing, 1);
      ctx.fillStyle = p.state === "damage" ? "#ff3b68" : "#48e9e1"; ctx.fillRect(-15, -22, 30, 38); ctx.fillStyle = "#ffe45d"; ctx.fillRect(-10, -16, 7, 7); ctx.fillRect(4, -16, 7, 7); ctx.fillStyle = "#132031"; ctx.fillRect(4, 0, 9, 5);
      const step = p.state === "walk" ? Math.sin(this.elapsed * 18) * 7 : 0; ctx.fillStyle = "#f5f7ff"; ctx.fillRect(-13, 16, 9, 8 + step); ctx.fillRect(4, 16, 9, 8 - step);
      if (p.attackTimer > 0) { ctx.fillStyle = "rgba(255,228,93,.65)"; ctx.beginPath(); ctx.arc(25, 0, 34, -1.1, 1.1); ctx.lineWidth = 8; ctx.strokeStyle = "#ffe45d"; ctx.stroke(); }
      ctx.restore();
    }
  }

  window.ActionGame = ActionGame;
})();
