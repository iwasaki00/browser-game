(() => {
  "use strict";

  const CONFIG = Object.freeze({
    MIN_EXPLOSION_TIME: 5500,
    MAX_EXPLOSION_TIME: 11000,
    PASS_COOLDOWN: 420,
    PASS_ANIMATION_TIME: 300,
    WARNING_START_RATIO: .5,
    DANGER_START_RATIO: .78,
    FAKE_SPARK_CHANCE: .075,
    EXPLOSION_DURATION: 680
  });

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  class BombHotPotatoGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.sprite = new Image();
      this.sprite.decoding = "async";
      this.sprite.addEventListener("load", () => { this.sprite = this.removeLightBackdrop(this.sprite); this.render(); }, { once: true });
      this.sprite.src = this.spriteUrl;
      this.animationId = 0;
      this.fps = 60;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.resize();
      this.reset();
      this.bindInput();
    }

    removeLightBackdrop(image) {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d");
      context.drawImage(image, 0, 0);
      try {
        const frame = context.getImageData(0, 0, surface.width, surface.height);
        for (let offset = 0; offset < frame.data.length; offset += 4) {
          const red = frame.data[offset]; const green = frame.data[offset + 1]; const blue = frame.data[offset + 2];
          if (Math.min(red, green, blue) > 218 && Math.max(red, green, blue) - Math.min(red, green, blue) < 24) frame.data[offset + 3] = 0;
        }
        context.putImageData(frame, 0, 0);
      } catch (_) { return image; }
      return surface;
    }

    makePlayer() { return { pointerId: null, cooldownUntil: 0 }; }

    reset() {
      this.active = false;
      this.exploding = false;
      this.bombOwner = null;
      this.elapsed = 0;
      this.explosionTime = 0;
      this.explosionAt = 0;
      this.startedAt = 0;
      this.explosionStartedAt = 0;
      this.lastFuseAt = 0;
      this.lastPassPlayer = null;
      this.passCount = 0;
      this.transit = null;
      this.fakeSparkUntil = 0;
      this.shake = 0;
      this.players = [this.makePlayer(), this.makePlayer()];
      this.lastFrame = performance.now();
      this.controls.forEach((control) => control.classList.remove("owner", "cooldown", "pressed"));
      this.dangers.forEach((danger) => danger.classList.remove("visible"));
      this.updateHud(this.lastFrame);
      this.render();
    }

    bindInput() {
      this.pointerHandlers = this.controls.map((control, index) => {
        const down = (event) => {
          if (!this.active || this.exploding || (event.pointerType === "mouse" && event.button !== 0)) return;
          const player = this.players[index];
          if (player.pointerId !== null) return;
          event.preventDefault();
          player.pointerId = event.pointerId;
          if (control.setPointerCapture) control.setPointerCapture(event.pointerId);
          this.pass(index, performance.now());
        };
        const release = (event) => {
          if (this.players[index].pointerId !== event.pointerId) return;
          event.preventDefault();
          this.players[index].pointerId = null;
        };
        control.addEventListener("pointerdown", down, { passive: false });
        control.addEventListener("pointerup", release, { passive: false });
        control.addEventListener("pointercancel", release, { passive: false });
        control.addEventListener("lostpointercapture", release);
        control.addEventListener("contextmenu", this.preventMenu);
        return { down, up: release, cancel: release };
      });
      this.keyHandler = (event) => {
        if (event.repeat || !this.active || this.exploding) return;
        const index = event.code === "KeyA" || event.code === "ArrowUp" ? 0 : event.code === "KeyL" || event.code === "ArrowDown" ? 1 : -1;
        if (index < 0) return;
        event.preventDefault();
        this.pass(index, performance.now());
      };
      window.addEventListener("keydown", this.keyHandler);
    }

    preventMenu(event) { event.preventDefault(); }

    start() {
      const now = performance.now();
      this.active = true;
      this.exploding = false;
      this.bombOwner = Math.random() < .5 ? 0 : 1;
      this.startedAt = now;
      this.elapsed = 0;
      this.explosionTime = this.chooseExplosionTime();
      this.explosionAt = now + this.explosionTime;
      this.lastFrame = now;
      this.players.forEach((player) => { player.cooldownUntil = 0; player.pointerId = null; });
      this.updateHud(now);
      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    chooseExplosionTime() {
      return this.testMode && this.testExplosionTime
        ? this.testExplosionTime
        : CONFIG.MIN_EXPLOSION_TIME + Math.random() * (CONFIG.MAX_EXPLOSION_TIME - CONFIG.MIN_EXPLOSION_TIME);
    }

    setTestExplosionTime(value) {
      this.testExplosionTime = value;
      if (!this.active) return;
      this.explosionTime = this.chooseExplosionTime();
      this.explosionAt = this.startedAt + this.explosionTime;
      this.updateHud(performance.now());
    }

    stop() {
      this.active = false;
      this.exploding = false;
      cancelAnimationFrame(this.animationId);
    }

    destroy() {
      this.stop();
      this.resizeObserver.disconnect();
      this.controls.forEach((control, index) => {
        const handlers = this.pointerHandlers[index];
        control.removeEventListener("pointerdown", handlers.down);
        control.removeEventListener("pointerup", handlers.up);
        control.removeEventListener("pointercancel", handlers.cancel);
        control.removeEventListener("lostpointercapture", handlers.cancel);
        control.removeEventListener("contextmenu", this.preventMenu);
        control.classList.remove("owner", "cooldown", "pressed");
      });
      this.dangers.forEach((danger) => danger.classList.remove("visible"));
      window.removeEventListener("keydown", this.keyHandler);
    }

    pass(index, now) {
      if (!this.active || this.exploding || this.bombOwner !== index || now < this.players[index].cooldownUntil) return false;
      const nextOwner = 1 - index;
      const fromY = this.ownerY(index);
      const toY = this.ownerY(nextOwner);
      this.bombOwner = nextOwner;
      this.players[nextOwner].cooldownUntil = now + CONFIG.PASS_COOLDOWN;
      this.transit = { fromY, toY, startedAt: now };
      this.lastPassPlayer = index;
      this.passCount += 1;
      this.controls[index].classList.remove("pressed");
      void this.controls[index].offsetWidth;
      this.controls[index].classList.add("pressed");
      if (this.onPassSound) this.onPassSound(index);
      this.updateHud(now);
      return true;
    }

    frame(now) {
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / dt) - this.fps) * .08;
      this.lastFrame = now;
      if (this.active) this.update(dt, now);
      else if (this.exploding) this.updateExplosion(now);
      this.render(now);
      if (this.active || this.exploding) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed = Math.max(0, now - this.startedAt);
      this.shake *= Math.pow(.82, dt * 60);
      const progress = this.explosionTime ? clamp(this.elapsed / this.explosionTime, 0, 1) : 0;
      const fuseInterval = progress >= CONFIG.DANGER_START_RATIO ? 130 : progress >= CONFIG.WARNING_START_RATIO ? 260 : 440;
      const jitteredInterval = fuseInterval * (.86 + Math.random() * .28);
      if (now - this.lastFuseAt >= jitteredInterval) {
        this.lastFuseAt = now;
        if (this.onFuseSound) this.onFuseSound(progress);
      }
      if (progress >= CONFIG.WARNING_START_RATIO && Math.random() < CONFIG.FAKE_SPARK_CHANCE * dt) {
        this.fakeSparkUntil = now + 190;
        this.shake = Math.max(this.shake, .32);
      }
      this.updateHud(now);
      if (now >= this.explosionAt) this.explode(now);
    }

    explode(now) {
      if (!this.active || this.bombOwner === null) return;
      this.active = false;
      this.exploding = true;
      this.explosionStartedAt = now;
      this.players.forEach((player) => { player.pointerId = null; });
      if (this.onExplosionSound) this.onExplosionSound();
      if (navigator.vibrate) navigator.vibrate([80, 35, 140]);
    }

    updateExplosion(now) {
      const progress = clamp((now - this.explosionStartedAt) / CONFIG.EXPLOSION_DURATION, 0, 1);
      this.shake = (1 - progress) * 2.2;
      if (progress < 1) return;
      this.exploding = false;
      const loser = this.bombOwner;
      this.onFinish(2 - loser, "P" + (loser + 1) + "が爆発！");
    }

    ownerY(index) { return this.height * (index === 0 ? .27 : .73); }

    visualBombY(now = performance.now()) {
      if (this.bombOwner === null) return this.height / 2;
      if (!this.transit) return this.ownerY(this.bombOwner);
      const progress = clamp((now - this.transit.startedAt) / CONFIG.PASS_ANIMATION_TIME, 0, 1);
      if (progress >= 1) { this.transit = null; return this.ownerY(this.bombOwner); }
      const eased = 1 - Math.pow(1 - progress, 3);
      return this.transit.fromY + (this.transit.toY - this.transit.fromY) * eased;
    }

    updateHud(now) {
      if (!this.players) return;
      this.players.forEach((player, index) => {
        const owner = this.bombOwner === index;
        const cooldown = Math.max(0, player.cooldownUntil - now);
        const readyRatio = owner ? 1 - clamp(cooldown / CONFIG.PASS_COOLDOWN, 0, 1) : 0;
        this.energyBars[index].style.transform = "scaleX(" + readyRatio.toFixed(3) + ")";
        this.controls[index].classList.toggle("owner", owner && !this.exploding);
        this.controls[index].classList.toggle("cooldown", owner && cooldown > 0);
        if (this.actionLabels) this.actionLabels[index].textContent = !owner ? "WAIT" : cooldown > 0 ? "WAIT..." : "PASS!";
      });
      const danger = this.active && this.explosionTime && this.elapsed / this.explosionTime >= CONFIG.WARNING_START_RATIO;
      this.dangers.forEach((element, index) => element.classList.toggle("visible", danger && this.bombOwner === index));
      if (!(this.debug || this.testMode)) return;
      const remaining = Math.max(0, this.explosionAt - now);
      this.debugPanel.textContent = [
        "bombOwner       " + (this.bombOwner === null ? "-" : "P" + (this.bombOwner + 1)),
        "elapsedTime     " + Math.round(this.elapsed) + "ms",
        "explosionAt     " + Math.round(this.explosionAt) + "ms",
        "timeRemaining   " + Math.round(remaining) + "ms",
        "passCooldown P1 " + Math.max(0, Math.round(this.players[0].cooldownUntil - now)) + "ms",
        "passCooldown P2 " + Math.max(0, Math.round(this.players[1].cooldownUntil - now)) + "ms",
        "lastPassPlayer  " + (this.lastPassPlayer === null ? "-" : "P" + (this.lastPassPlayer + 1)),
        "passCount       " + this.passCount,
        "FPS             " + Math.round(this.fps)
      ].join("\n");
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.render();
    }

    render(now = performance.now()) {
      if (!this.context || !this.players) return;
      const ctx = this.context; const w = this.width; const h = this.height;
      const progress = this.explosionTime ? clamp(this.elapsed / this.explosionTime, 0, 1) : 0;
      const bombY = this.visualBombY(now);
      ctx.save();
      ctx.translate((Math.random() - .5) * this.shake * 7, (Math.random() - .5) * this.shake * 7);
      const floor = ctx.createLinearGradient(0, 0, 0, h);
      floor.addColorStop(0, this.bombOwner === 0 ? "#15566a" : "#082f40");
      floor.addColorStop(.48, "#0a1822");
      floor.addColorStop(.52, "#17141b");
      floor.addColorStop(1, this.bombOwner === 1 ? "#6b2635" : "#3d1a26");
      ctx.fillStyle = floor;
      ctx.fillRect(-12, -12, w + 24, h + 24);
      this.drawField(ctx, w, h, progress);
      const explosionProgress = this.exploding ? clamp((now - this.explosionStartedAt) / CONFIG.EXPLOSION_DURATION, 0, 1) : 0;
      const bombSize = Math.max(72, Math.min(w * .29, h * .22, 148)) * (1 + explosionProgress * 1.35);
      this.drawBomb(ctx, w / 2, bombY, bombSize, progress, now);
      if (this.exploding) this.drawExplosion(ctx, w / 2, bombY, explosionProgress);
      ctx.restore();
    }

    drawField(ctx, w, h, progress) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,200,87,.54)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 9]);
      ctx.beginPath(); ctx.moveTo(w * .1, h / 2); ctx.lineTo(w * .9, h / 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,248,223,.66)";
      ctx.font = "900 " + Math.max(11, Math.min(15, w * .034)) + "px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(w / 2, h * .075); ctx.rotate(Math.PI); ctx.fillText("P1 · PASS OR HOLD", 0, 0); ctx.restore();
      ctx.fillText("P2 · PASS OR HOLD", w / 2, h * .925);
      ctx.globalAlpha = .16 + progress * .26;
      ctx.strokeStyle = "#ffc857"; ctx.lineWidth = Math.max(8, w * .035); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(w / 2, h * .39); ctx.lineTo(w / 2, h * .46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, h * .61); ctx.lineTo(w / 2, h * .54); ctx.stroke();
      ctx.restore();
    }

    drawBomb(ctx, x, y, size, warning, now) {
      const urgent = warning >= CONFIG.DANGER_START_RATIO;
      const jitter = urgent ? Math.sin(this.elapsed * .075) * 3 : warning >= CONFIG.WARNING_START_RATIO ? Math.sin(this.elapsed * .04) * 1.2 : 0;
      ctx.save(); ctx.translate(x + jitter, y);
      const pulse = 1 + Math.sin(this.elapsed * (urgent ? .018 : .009)) * (urgent ? .04 : .015);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(0,0,0,.44)"; ctx.beginPath(); ctx.ellipse(5, size * .34, size * .42, size * .18, 0, 0, Math.PI * 2); ctx.fill();
      if ((this.sprite.complete && this.sprite.naturalWidth) || this.sprite.width) ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
      else { ctx.fillStyle = "#15191d"; ctx.beginPath(); ctx.arc(0, 0, size * .34, 0, Math.PI * 2); ctx.fill(); }
      const sparks = warning >= CONFIG.WARNING_START_RATIO ? (urgent ? 5 : 3) : 1;
      ctx.fillStyle = "#ffc857"; ctx.shadowColor = "#ff642e"; ctx.shadowBlur = urgent ? 16 : 8;
      for (let index = 0; index < sparks; index += 1) {
        const angle = this.elapsed * .018 + index * Math.PI * 2 / sparks;
        const radius = size * (.37 + (index % 2) * .08);
        ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, -size * .3 + Math.sin(angle) * radius * .3, urgent ? 3.5 : 2.4, 0, Math.PI * 2); ctx.fill();
      }
      if (now < this.fakeSparkUntil) {
        ctx.strokeStyle = "#fff2a6"; ctx.lineWidth = 5; ctx.beginPath();
        ctx.moveTo(-size * .5, -size * .34); ctx.lineTo(-size * .72, -size * .62);
        ctx.moveTo(size * .48, -size * .3); ctx.lineTo(size * .76, -size * .55); ctx.stroke();
      }
      ctx.restore();
    }

    drawExplosion(ctx, x, y, progress) {
      const radius = Math.min(this.width, this.height) * (.18 + progress * .65);
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Math.max(0, 1 - progress * .72);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, "#fffbd0"); glow.addColorStop(.18, "#ffc857"); glow.addColorStop(.48, "#ff6b26"); glow.addColorStop(1, "rgba(255,38,20,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,245,190,.8)"; ctx.lineWidth = Math.max(3, radius * .035);
      ctx.beginPath(); ctx.arc(0, 0, radius * .74, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  window.BOMB_HOT_POTATO_CONFIG = CONFIG;
  window.BombHotPotatoGame = BombHotPotatoGame;
})();
