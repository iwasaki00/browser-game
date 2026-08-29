(function () {
  "use strict";

  class ShooterGame {
    constructor(canvas, soundManager, settings, onEnd) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.sound = soundManager;
      this.settings = settings;
      this.onEnd = onEnd;
      this.running = false;
      this.last = 0;
      this.elapsed = 0;
      this.score = 0;
      this.hp = 3;
      this.shotClock = 0;
      this.spawnClock = 0;
      this.boss = null;
      this.bossWarning = 0;
      this.bossDefeated = false;
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.items = [];
      this.stars = [];
      this.player = { x: 180, y: 560, r: 14, invincible: 0, power: 1, fireRate: 0.22 };
      this.pointer = null;
      this.boundLoop = (time) => this.loop(time);
      this.bindInput();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(rect.width * ratio);
      this.canvas.height = Math.round(rect.height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
      if (!this.stars.length) this.stars = Array.from({ length: 55 }, () => ({ x: Math.random() * this.width, y: Math.random() * this.height, s: 1 + Math.random() * 2, v: 25 + Math.random() * 70 }));
      this.player.x = Math.min(this.width - 22, Math.max(22, this.player.x));
      this.player.y = Math.min(this.height - 50, this.player.y || this.height - 80);
    }

    bindInput() {
      const point = (event) => {
        const touch = event.touches?.[0] || event.changedTouches?.[0] || event;
        const rect = this.canvas.getBoundingClientRect();
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top - 52 };
      };
      this.canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.pointer = point(event);
        if (!this.settings.autoFire) this.fire();
      });
      this.canvas.addEventListener("pointermove", (event) => { if (this.pointer) { event.preventDefault(); this.pointer = point(event); } });
      window.addEventListener("pointerup", () => { this.pointer = null; });
    }

    async start() {
      this.sound.resetCounts();
      this.running = true;
      this.last = performance.now();
      this.resize();
      this.player.x = this.width / 2;
      this.player.y = this.height - 72;
      requestAnimationFrame(this.boundLoop);
    }

    stop() { this.running = false; }

    loop(time) {
      if (!this.running) return;
      const dt = Math.min(0.034, (time - this.last) / 1000);
      this.last = time;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.boundLoop);
    }

    update(dt) {
      this.elapsed += dt;
      this.player.invincible = Math.max(0, this.player.invincible - dt);
      if (this.pointer) {
        const follow = Math.min(1, dt * 14);
        this.player.x += (this.pointer.x - this.player.x) * follow;
        this.player.y += (this.pointer.y - this.player.y) * follow;
        this.player.x = Math.max(18, Math.min(this.width - 18, this.player.x));
        this.player.y = Math.max(90, Math.min(this.height - 32, this.player.y));
      }
      this.stars.forEach((star) => { star.y += star.v * dt; if (star.y > this.height) { star.y = -4; star.x = Math.random() * this.width; } });
      this.shotClock -= dt;
      if (this.settings.autoFire && this.shotClock <= 0 && !this.bossWarning) this.fire();
      this.spawnClock -= dt;
      if (!this.boss && this.elapsed < 24 && this.spawnClock <= 0) this.spawnEnemy();
      if (!this.boss && !this.bossDefeated && this.elapsed >= 24 && !this.bossWarning) this.startBossWarning();
      if (this.bossWarning > 0) { this.bossWarning -= dt; if (this.bossWarning <= 0) this.spawnBoss(); }

      this.bullets.forEach((bullet) => bullet.y -= bullet.v * dt);
      this.enemyBullets.forEach((bullet) => { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; });
      this.items.forEach((item) => { item.y += 85 * dt; item.spin += dt * 5; });
      this.enemies.forEach((enemy) => {
        enemy.t += dt;
        enemy.y += enemy.v * dt;
        if (enemy.kind === 1) enemy.x += Math.sin(enemy.t * 4) * 65 * dt;
        if (enemy.kind === 2) enemy.x += Math.sign(this.player.x - enemy.x) * 38 * dt;
        enemy.fire -= dt;
        if (enemy.kind === 3 && enemy.fire <= 0) { this.enemyFire(enemy); enemy.fire = 1.4 + Math.random(); }
      });
      if (this.boss) {
        this.boss.t += dt;
        this.boss.x = this.width / 2 + Math.sin(this.boss.t * 1.4) * this.width * .28;
        this.boss.fire -= dt;
        if (this.boss.fire <= 0) { for (let i = -2; i <= 2; i++) this.enemyFire(this.boss, i * .22); this.boss.fire = .8; }
      }
      this.collisions();
      this.bullets = this.bullets.filter((b) => b.y > -20 && !b.dead);
      this.enemyBullets = this.enemyBullets.filter((b) => b.y < this.height + 20 && b.x > -20 && b.x < this.width + 20 && !b.dead);
      this.enemies = this.enemies.filter((e) => e.y < this.height + 40 && !e.dead);
      this.items = this.items.filter((i) => i.y < this.height + 30 && !i.dead);
    }

    fire() {
      if (!this.running) return;
      this.shotClock = this.player.fireRate;
      const spread = this.player.power > 1 ? [-9, 9] : [0];
      spread.forEach((offset) => this.bullets.push({ x: this.player.x + offset, y: this.player.y - 16, r: 3, v: 520, dead: false }));
      this.sound.play("shot", { gain: .72 });
    }

    spawnEnemy() {
      const kind = Math.floor(Math.random() * 4);
      this.enemies.push({ x: 28 + Math.random() * (this.width - 56), y: -24, r: kind === 3 ? 18 : 14, v: 65 + Math.random() * 55, hp: kind === 3 ? 3 : 1, kind, t: 0, fire: 1 + Math.random(), dead: false });
      this.spawnClock = Math.max(.35, .85 - this.elapsed * .012);
    }

    enemyFire(enemy, angleOffset = 0) {
      const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) + angleOffset;
      this.enemyBullets.push({ x: enemy.x, y: enemy.y + 12, r: 5, vx: Math.cos(angle) * 170, vy: Math.sin(angle) * 170, dead: false });
      this.sound.play("enemyShot", { gain: .5 });
    }

    startBossWarning() { this.bossWarning = 2.3; this.sound.play("boss"); }

    spawnBoss() { this.bossWarning = 0; this.boss = { x: this.width / 2, y: 82, r: 42, hp: 55, maxHp: 55, fire: .4, t: 0 }; }

    collisions() {
      const hit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
      this.bullets.forEach((bullet) => {
        const targets = this.boss ? [this.boss] : this.enemies;
        targets.forEach((enemy) => {
          if (!bullet.dead && !enemy.dead && hit(bullet, enemy)) {
            bullet.dead = true; enemy.hp -= 1;
            if (enemy.hp <= 0) this.destroyEnemy(enemy, enemy === this.boss);
          }
        });
      });
      [...this.enemyBullets, ...this.enemies].forEach((danger) => {
        if (!danger.dead && this.player.invincible <= 0 && hit(this.player, danger)) { danger.dead = true; this.damage(); }
      });
      this.items.forEach((item) => { if (!item.dead && hit(this.player, item)) { item.dead = true; this.collectItem(item); } });
    }

    destroyEnemy(enemy, isBoss) {
      enemy.dead = true;
      this.score += isBoss ? 3000 : (enemy.kind === 3 ? 240 : 100);
      this.sound.play(isBoss || enemy.kind === 3 ? "explosion" : "enemyDestroy");
      if (isBoss) { this.bossDefeated = true; this.boss = null; window.setTimeout(() => this.finish(true), 1000); }
      else if (Math.random() < .14) this.items.push({ x: enemy.x, y: enemy.y, r: 10, spin: 0, type: Math.random() < .55 ? "power" : "score", dead: false });
    }

    collectItem(item) {
      if (item.type === "power") { this.player.power = 2; this.player.fireRate = .16; }
      else this.score += 500;
      this.sound.play("item");
    }

    damage() {
      this.hp -= 1;
      this.player.invincible = 1.4;
      this.sound.play("damage");
      if (this.settings.vibration && navigator.vibrate) navigator.vibrate(80);
      if (this.hp <= 0) this.finish(false);
    }

    finish(clear) {
      if (!this.running) return;
      this.running = false;
      this.sound.play(clear ? "clear" : "gameOver");
      this.onEnd({ clear, score: this.score, counts: this.sound.getCounts() });
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#090c20"); gradient.addColorStop(1, "#111836");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "rgba(130,231,255,.65)";
      this.stars.forEach((star) => ctx.fillRect(star.x, star.y, star.s, star.s * 2));
      ctx.save();
      if (this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2) ctx.globalAlpha = .25;
      ctx.translate(this.player.x, this.player.y);
      ctx.fillStyle = "#48e9e1"; ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(16, 16); ctx.lineTo(0, 10); ctx.lineTo(-16, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe45d"; ctx.fillRect(-3, 8, 6, 14); ctx.restore();
      ctx.fillStyle = "#ffe45d"; this.bullets.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#ff3b68"; this.enemyBullets.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
      this.enemies.forEach((enemy) => this.drawEnemy(enemy));
      if (this.boss) this.drawBoss();
      this.items.forEach((item) => { ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.spin); ctx.fillStyle = "#ffe45d"; ctx.fillRect(-8, -8, 16, 16); ctx.fillStyle = "#111836"; ctx.fillRect(-3, -6, 6, 12); ctx.restore(); });
      if (this.bossWarning > 0) { ctx.fillStyle = "rgba(255,32,80,.86)"; ctx.fillRect(0, this.height * .38, this.width, 96); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "900 17px sans-serif"; ctx.fillText("WARNING", this.width / 2, this.height * .38 + 32); ctx.font = "900 38px sans-serif"; ctx.fillText("BOSS", this.width / 2, this.height * .38 + 72); }
    }

    drawEnemy(enemy) {
      const ctx = this.ctx; ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.fillStyle = enemy.kind === 3 ? "#bd66ff" : "#ff557c"; ctx.rotate(enemy.kind === 1 ? Math.sin(enemy.t * 3) * .3 : 0); ctx.fillRect(-enemy.r, -enemy.r, enemy.r * 2, enemy.r * 2); ctx.fillStyle = "#fff"; ctx.fillRect(-enemy.r * .55, 1, 5, 5); ctx.fillRect(enemy.r * .2, 1, 5, 5); ctx.restore();
    }

    drawBoss() {
      const ctx = this.ctx, b = this.boss; ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = "#a94cff"; ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(48, 12); ctx.lineTo(25, 42); ctx.lineTo(-25, 42); ctx.lineTo(-48, 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ff3b68"; ctx.fillRect(-26, 5, 52, 10); ctx.restore();
    }
  }

  window.ShooterGame = ShooterGame;
})();
