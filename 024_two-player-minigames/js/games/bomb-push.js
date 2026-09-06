(() => {
  "use strict";

  const CONFIG = Object.freeze({
    BOMB_MIN_EXPLOSION_TIME: 6500,
    BOMB_MAX_EXPLOSION_TIME: 11500,
    TAP_POWER: .34,
    MAX_CHARGE_TIME: 1000,
    CHARGE_START_TIME: 300,
    MAX_CHARGE_POWER: 1.05,
    FRICTION: .91,
    MAX_VELOCITY: 2.7,
    RAPID_TAP_THRESHOLD: 100,
    RAPID_TAP_MULTIPLIER: .5,
    DRAW_RANGE: .035,
    WARNING_PHASE_1: .54,
    WARNING_PHASE_2: .8,
    DANGER_POSITION: .68,
    EXPLOSION_DURATION: 680
  });

  class BombPushGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.sprite = new Image();
      this.sprite.decoding = "async";
      this.sprite.addEventListener("load", () => {
        this.sprite = this.removeLightBackdrop(this.sprite);
        this.render();
      }, { once: true });
      this.sprite.src = this.spriteUrl;
      this.active = false;
      this.exploding = false;
      this.animationId = 0;
      this.lastFrame = 0;
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
        const pixels = frame.data;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const lightest = Math.max(red, green, blue);
          const darkest = Math.min(red, green, blue);
          if (darkest > 218 && lightest - darkest < 24) pixels[offset + 3] = 0;
        }
        context.putImageData(frame, 0, 0);
      } catch (_) {
        return image;
      }
      return surface;
    }

    reset() {
      this.active = false;
      this.exploding = false;
      this.bombPosition = 0;
      this.bombVelocity = 0;
      this.elapsed = 0;
      this.explosionTime = 0;
      this.explosionStartedAt = 0;
      this.lastFuseAt = 0;
      this.shake = 0;
      this.players = [this.makePlayer(), this.makePlayer()];
      this.lastFrame = performance.now();
      this.dangers.forEach((danger) => danger.classList.remove("visible"));
      this.controls.forEach((control) => control.classList.remove("charging", "charged"));
      this.updateHud(performance.now());
      this.render();
    }

    makePlayer() {
      return { pointerId: null, chargeStartedAt: 0, chargeTime: 0, lastPushAt: 0, lastTapInterval: 0, pulse: 0 };
    }

    bindInput() {
      this.pointerHandlers = this.controls.map((control, index) => {
        const down = (event) => {
          if (!this.active || this.exploding || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault();
          const player = this.players[index];
          if (player.pointerId !== null) return;
          player.pointerId = event.pointerId;
          player.chargeStartedAt = performance.now();
          player.chargeTime = 0;
          if (control.setPointerCapture) control.setPointerCapture(event.pointerId);
          control.classList.add("charging");
        };
        const up = (event) => {
          if (this.players[index].pointerId !== event.pointerId) return;
          event.preventDefault();
          this.release(index, performance.now());
        };
        const cancel = (event) => {
          const player = this.players[index];
          if (player.pointerId !== event.pointerId) return;
          player.pointerId = null;
          player.chargeStartedAt = 0;
          player.chargeTime = 0;
          control.classList.remove("charging", "charged");
          this.updateHud(performance.now());
        };
        control.addEventListener("pointerdown", down, { passive: false });
        control.addEventListener("pointerup", up, { passive: false });
        control.addEventListener("pointercancel", cancel, { passive: false });
        control.addEventListener("contextmenu", this.preventMenu);
        return { down, up, cancel };
      });
      this.keyHandler = (event) => {
        if (event.repeat || !this.active || this.exploding) return;
        if (event.code === "KeyA" || event.code === "ArrowUp") {
          event.preventDefault();
          this.applyPush(0, CONFIG.TAP_POWER, performance.now(), false);
        }
        if (event.code === "KeyL" || event.code === "ArrowDown") {
          event.preventDefault();
          this.applyPush(1, CONFIG.TAP_POWER, performance.now(), false);
        }
      };
      window.addEventListener("keydown", this.keyHandler);
    }

    preventMenu(event) { event.preventDefault(); }

    start() {
      this.active = true;
      this.elapsed = 0;
      this.explosionTime = CONFIG.BOMB_MIN_EXPLOSION_TIME + Math.random() * (CONFIG.BOMB_MAX_EXPLOSION_TIME - CONFIG.BOMB_MIN_EXPLOSION_TIME);
      this.lastFrame = performance.now();
      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
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
        control.removeEventListener("contextmenu", this.preventMenu);
        control.classList.remove("charging", "charged");
      });
      window.removeEventListener("keydown", this.keyHandler);
    }

    release(index, now) {
      const player = this.players[index];
      if (player.pointerId === null) return;
      const duration = Math.max(0, now - player.chargeStartedAt);
      player.pointerId = null;
      player.chargeStartedAt = 0;
      player.chargeTime = duration;
      this.controls[index].classList.remove("charging", "charged");
      if (!this.active || this.exploding) return;
      const progress = Math.max(0, Math.min(1, (duration - CONFIG.CHARGE_START_TIME) / (CONFIG.MAX_CHARGE_TIME - CONFIG.CHARGE_START_TIME)));
      const power = CONFIG.TAP_POWER + (CONFIG.MAX_CHARGE_POWER - CONFIG.TAP_POWER) * progress;
      this.applyPush(index, power, now, progress > .2);
    }

    applyPush(index, basePower, now, charged) {
      const player = this.players[index];
      const interval = player.lastPushAt ? now - player.lastPushAt : 0;
      player.lastTapInterval = interval;
      player.lastPushAt = now;
      const rapid = interval > 0 && interval < CONFIG.RAPID_TAP_THRESHOLD;
      const power = basePower * (rapid ? CONFIG.RAPID_TAP_MULTIPLIER : 1);
      const direction = index === 0 ? 1 : -1;
      this.bombVelocity = Math.max(-CONFIG.MAX_VELOCITY, Math.min(CONFIG.MAX_VELOCITY, this.bombVelocity + power * direction));
      player.pulse = 1;
      this.shake = Math.min(1, this.shake + power * .24);
      const control = this.controls[index];
      control.classList.remove("pressed");
      void control.offsetWidth;
      control.classList.add("pressed");
      if (charged && this.onChargeSound) this.onChargeSound(index);
      else this.onTapSound(Math.min(1.5, power / CONFIG.TAP_POWER), index);
      this.updateHud(now);
    }

    frame(now) {
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / dt) - this.fps) * .08;
      this.lastFrame = now;
      if (this.active) this.update(dt, now);
      else if (this.exploding) this.updateExplosion(now);
      this.render();
      if (this.active || this.exploding) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed += dt;
      const frameScale = dt * 60;
      this.bombPosition += this.bombVelocity * dt;
      this.bombVelocity *= Math.pow(CONFIG.FRICTION, frameScale);
      if (this.bombPosition < -1 || this.bombPosition > 1) {
        this.bombPosition = Math.max(-1, Math.min(1, this.bombPosition));
        this.bombVelocity *= -.22;
      }
      this.shake *= Math.pow(.84, frameScale);
      this.players.forEach((player) => {
        player.pulse *= Math.pow(.78, frameScale);
        if (player.pointerId !== null) player.chargeTime = Math.min(CONFIG.MAX_CHARGE_TIME, now - player.chargeStartedAt);
      });
      this.dangers[0].classList.toggle("visible", this.bombPosition < -CONFIG.DANGER_POSITION);
      this.dangers[1].classList.toggle("visible", this.bombPosition > CONFIG.DANGER_POSITION);
      const progress = Math.min(1, this.elapsed * 1000 / this.explosionTime);
      const fuseInterval = progress >= CONFIG.WARNING_PHASE_2 ? 145 : progress >= CONFIG.WARNING_PHASE_1 ? 260 : 430;
      if (now - this.lastFuseAt >= fuseInterval) {
        this.lastFuseAt = now;
        if (this.onFuseSound) this.onFuseSound(progress);
      }
      this.updateHud(now);
      if (this.elapsed * 1000 >= this.explosionTime) this.explode(now);
    }

    explode(now) {
      if (!this.active) return;
      this.active = false;
      this.exploding = true;
      this.explosionStartedAt = now;
      this.bombVelocity = 0;
      this.controls.forEach((control) => control.classList.remove("charging", "charged"));
      if (this.onExplosionSound) this.onExplosionSound();
      if (navigator.vibrate) navigator.vibrate([80, 35, 140]);
    }

    updateExplosion(now) {
      const progress = Math.min(1, (now - this.explosionStartedAt) / CONFIG.EXPLOSION_DURATION);
      this.shake = (1 - progress) * 2.2;
      if (progress < 1) return;
      this.exploding = false;
      if (Math.abs(this.bombPosition) < CONFIG.DRAW_RANGE) return this.onFinish(0, "中央で爆発！");
      const loser = this.bombPosition < 0 ? 1 : 2;
      const winner = loser === 1 ? 2 : 1;
      this.onFinish(winner, `爆弾がP${loser}側で爆発！`);
    }

    updateHud(now) {
      this.players.forEach((player, index) => {
        const progress = player.pointerId === null ? 0 : Math.max(0, Math.min(1, (now - player.chargeStartedAt) / CONFIG.MAX_CHARGE_TIME));
        this.energyBars[index].style.transform = `scaleX(${progress.toFixed(3)})`;
        this.energyBars[index].classList.toggle("tired", progress >= .92);
        this.controls[index].classList.toggle("charged", progress >= .92);
      });
      if (this.debug) {
        const [p1, p2] = this.players;
        this.debugPanel.textContent = [
          `bombPosition   ${this.bombPosition.toFixed(4)}`,
          `bombVelocity   ${this.bombVelocity.toFixed(4)}`,
          `explosionTime  ${Math.round(this.explosionTime)}ms`,
          `elapsedTime    ${(this.elapsed * 1000).toFixed(0)}ms`,
          `P1 interval    ${Math.round(p1.lastTapInterval)}ms`,
          `P2 interval    ${Math.round(p2.lastTapInterval)}ms`,
          `P1 charge      ${Math.round(p1.chargeTime)}ms`,
          `P2 charge      ${Math.round(p2.chargeTime)}ms`,
          "bomb weight    NORMAL",
          `FPS            ${Math.round(this.fps)}`
        ].join("\n");
      }
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

    render() {
      if (!this.context || !this.players) return;
      const ctx = this.context;
      const w = this.width;
      const h = this.height;
      const danger = Math.abs(this.bombPosition);
      ctx.save();
      ctx.translate((Math.random() - .5) * this.shake * 7, (Math.random() - .5) * this.shake * 7);
      const floor = ctx.createLinearGradient(0, 0, 0, h);
      floor.addColorStop(0, danger > .68 && this.bombPosition < 0 ? "#5a2020" : "#0a4152");
      floor.addColorStop(.46, "#101923");
      floor.addColorStop(.54, "#101923");
      floor.addColorStop(1, danger > .68 && this.bombPosition > 0 ? "#641f2c" : "#491c29");
      ctx.fillStyle = floor;
      ctx.fillRect(-12, -12, w + 24, h + 24);
      this.drawField(ctx, w, h);
      const trackTop = h * .16;
      const trackBottom = h * .84;
      const bombY = h / 2 + this.bombPosition * (trackBottom - trackTop) * .46;
      const warning = this.explosionTime ? Math.min(1, this.elapsed * 1000 / this.explosionTime) : 0;
      this.drawBomb(ctx, w / 2, bombY, Math.max(74, Math.min(w * .3, h * .2, 150)), warning);
      if (this.exploding) this.drawExplosion(ctx, w / 2, bombY, Math.min(1, (performance.now() - this.explosionStartedAt) / CONFIG.EXPLOSION_DURATION));
      ctx.restore();
    }

    drawField(ctx, w, h) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = Math.max(18, w * .08);
      ctx.beginPath();
      ctx.moveTo(w / 2, h * .14);
      ctx.lineTo(w / 2, h * .86);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,200,87,.52)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.moveTo(w * .1, h / 2);
      ctx.lineTo(w * .9, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,248,223,.62)";
      ctx.font = `900 ${Math.max(11, Math.min(14, w * .032))}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(w / 2, h * .075);
      ctx.rotate(Math.PI);
      ctx.fillText("P1 SIDE", 0, 0);
      ctx.restore();
      ctx.fillText("P2 SIDE", w / 2, h * .925);
      ctx.restore();
    }

    drawBomb(ctx, x, y, size, warning) {
      const urgent = warning >= CONFIG.WARNING_PHASE_2;
      const jitter = urgent ? Math.sin(this.elapsed * 72) * 3 : warning >= CONFIG.WARNING_PHASE_1 ? Math.sin(this.elapsed * 36) * 1.2 : 0;
      ctx.save();
      ctx.translate(x + jitter, y);
      const pulse = 1 + Math.sin(this.elapsed * (urgent ? 18 : 9)) * (urgent ? .035 : .012);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.beginPath();
      ctx.ellipse(5, size * .34, size * .42, size * .18, 0, 0, Math.PI * 2);
      ctx.fill();
      if ((this.sprite.complete && this.sprite.naturalWidth) || this.sprite.width) ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
      else {
        ctx.fillStyle = "#17191d";
        ctx.beginPath();
        ctx.arc(0, 0, size * .34, 0, Math.PI * 2);
        ctx.fill();
      }
      if (warning >= CONFIG.WARNING_PHASE_1) {
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(255,88,35,${.08 + warning * .13})`;
        ctx.beginPath();
        ctx.arc(0, 0, size * .38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawExplosion(ctx, x, y, progress) {
      const radius = Math.min(this.width, this.height) * (.18 + progress * .65);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = Math.max(0, 1 - progress * .72);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, "#fffbd0");
      glow.addColorStop(.18, "#ffc857");
      glow.addColorStop(.48, "#ff6b26");
      glow.addColorStop(1, "rgba(255,38,20,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,245,190,.8)";
      ctx.lineWidth = Math.max(3, radius * .035);
      ctx.beginPath();
      ctx.arc(0, 0, radius * .74, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < 18; i += 1) {
        const angle = i * Math.PI * 2 / 18;
        const distance = radius * (.35 + progress * .55);
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(2, radius * .025), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  window.BOMB_PUSH_CONFIG = CONFIG;
  window.BombPushGame = BombPushGame;
})();
