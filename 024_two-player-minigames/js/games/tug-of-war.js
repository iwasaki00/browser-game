(() => {
  "use strict";

  const CONFIG = Object.freeze({
    TAP_POWER: 18,
    STAMINA_MAX: 100,
    STAMINA_COST: 4.4,
    STAMINA_RECOVERY: 9,
    FRICTION: .88,
    CENTERING_FORCE: .014,
    GOOD_MIN_INTERVAL: 250,
    GOOD_MAX_INTERVAL: 600,
    GOOD_MULTIPLIER: 1.25,
    RAPID_TAP_THRESHOLD: 110,
    RAPID_MULTIPLIER: .45,
    WIN_POSITION: 100,
    TIME_LIMIT: 30
  });

  class TugOfWarGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.sprites = [];
      (this.spriteUrls || []).forEach((url, index) => {
        const image = new Image(); image.decoding = "async";
        image.addEventListener("load", () => { this.sprites[index] = this.removeLightBackdrop(image); this.render(); }, { once: true });
        image.src = url;
      });
      this.active = false; this.animationId = 0; this.lastFrame = 0; this.fps = 60;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.resize(); this.reset(); this.bindInput();
    }

    removeLightBackdrop(image) {
      const surface = document.createElement("canvas"); surface.width = image.naturalWidth; surface.height = image.naturalHeight;
      const context = surface.getContext("2d"); context.drawImage(image, 0, 0);
      try {
        const frame = context.getImageData(0, 0, surface.width, surface.height); const pixels = frame.data;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const red = pixels[offset]; const green = pixels[offset + 1]; const blue = pixels[offset + 2];
          const lightest = Math.max(red, green, blue); const darkest = Math.min(red, green, blue);
          if (darkest > 224 && lightest - darkest < 18) pixels[offset + 3] = 0;
        }
        context.putImageData(frame, 0, 0);
      } catch (_) {
        return image;
      }
      return surface;
    }

    reset() {
      this.ropePosition = 0; this.ropeVelocity = 0; this.elapsed = 0; this.lastRumbleAt = 0; this.shake = 0; this.active = false;
      this.players = [this.makePlayer(), this.makePlayer()]; this.lastFrame = performance.now();
      this.dangers.forEach((danger) => danger.classList.remove("visible"));
      this.updateHud(); this.render();
    }

    makePlayer() {
      return { stamina: CONFIG.STAMINA_MAX, lastTap: 0, interval: 0, currentPower: 0, pull: 0, recentTaps: [], feedback: "", feedbackUntil: 0 };
    }

    bindInput() {
      this.pointerHandlers = this.controls.map((control, index) => {
        const handler = (event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault(); if (control.setPointerCapture) control.setPointerCapture(event.pointerId);
          this.tap(index, performance.now());
        };
        control.addEventListener("pointerdown", handler, { passive: false });
        control.addEventListener("contextmenu", this.preventMenu);
        return handler;
      });
      this.keyHandler = (event) => {
        if (event.repeat) return;
        if (event.code === "KeyA" || event.code === "ArrowUp") { event.preventDefault(); this.tap(0, performance.now()); }
        if (event.code === "KeyL" || event.code === "ArrowDown") { event.preventDefault(); this.tap(1, performance.now()); }
      };
      window.addEventListener("keydown", this.keyHandler);
    }

    preventMenu(event) { event.preventDefault(); }

    start() {
      this.active = true; this.lastFrame = performance.now(); cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    stop() { this.active = false; cancelAnimationFrame(this.animationId); }

    destroy() {
      this.stop(); this.resizeObserver.disconnect();
      this.controls.forEach((control, index) => {
        control.removeEventListener("pointerdown", this.pointerHandlers[index]);
        control.removeEventListener("contextmenu", this.preventMenu);
      });
      window.removeEventListener("keydown", this.keyHandler);
    }

    tap(index, now) {
      if (!this.active) return;
      const player = this.players[index]; const interval = player.lastTap ? now - player.lastTap : 0;
      player.lastTap = now; player.interval = interval;
      player.recentTaps.push(now); player.recentTaps = player.recentTaps.filter((time) => now - time <= 650);
      const good = interval >= CONFIG.GOOD_MIN_INTERVAL && interval <= CONFIG.GOOD_MAX_INTERVAL;
      const rapid = interval > 0 && interval < CONFIG.RAPID_TAP_THRESHOLD;
      const staminaRatio = player.stamina / CONFIG.STAMINA_MAX;
      const staminaEfficiency = .16 + .84 * Math.pow(staminaRatio, .82);
      const densityPenalty = 1 / (1 + Math.max(0, player.recentTaps.length - 4) * .18);
      const timingMultiplier = good ? CONFIG.GOOD_MULTIPLIER : 1;
      const rapidMultiplier = rapid ? CONFIG.RAPID_MULTIPLIER : 1;
      const power = CONFIG.TAP_POWER * staminaEfficiency * densityPenalty * timingMultiplier * rapidMultiplier;
      const direction = index === 0 ? 1 : -1;
      this.ropeVelocity = Math.max(-48, Math.min(48, this.ropeVelocity + power * direction));
      player.stamina = Math.max(0, player.stamina - CONFIG.STAMINA_COST * (rapid ? 1.18 : 1));
      player.currentPower = power; player.pull = 1;
      player.feedback = good ? "GOOD!" : player.stamina < 18 ? "TIRED" : "";
      player.feedbackUntil = now + (good ? 520 : 380);
      this.shake = Math.min(1, this.shake + power / 90);
      const control = this.controls[index]; control.classList.remove("pressed"); void control.offsetWidth; control.classList.add("pressed");
      this.onTapSound(power / CONFIG.TAP_POWER, index); if (good && this.onGoodSound) this.onGoodSound(index);
      this.updateHud();
    }

    frame(now) {
      if (!this.active) return;
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / dt) - this.fps) * .08; this.lastFrame = now;
      this.update(dt, now); this.render();
      if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed += dt; const frameScale = dt * 60;
      for (const player of this.players) {
        player.stamina = Math.min(CONFIG.STAMINA_MAX, player.stamina + CONFIG.STAMINA_RECOVERY * dt);
        player.currentPower *= Math.pow(.84, frameScale); player.pull *= Math.pow(.77, frameScale);
        player.recentTaps = player.recentTaps.filter((time) => now - time <= 650);
        if (now > player.feedbackUntil) player.feedback = "";
      }
      this.ropeVelocity += -this.ropePosition * CONFIG.CENTERING_FORCE * dt;
      this.ropeVelocity *= Math.pow(CONFIG.FRICTION, frameScale);
      this.ropePosition += this.ropeVelocity * dt;
      this.shake *= Math.pow(.8, frameScale);
      this.dangers[0].classList.toggle("visible", this.ropePosition < -CONFIG.WIN_POSITION * .72);
      this.dangers[1].classList.toggle("visible", this.ropePosition > CONFIG.WIN_POSITION * .72);
      if (Math.abs(this.ropeVelocity) > 23 && now - this.lastRumbleAt > 440) {
        this.lastRumbleAt = now; this.onImpactSound(Math.min(1.5, Math.abs(this.ropeVelocity) / 24));
      }
      if (this.ropePosition >= CONFIG.WIN_POSITION) return this.finish(1, "綱を引き切った！");
      if (this.ropePosition <= -CONFIG.WIN_POSITION) return this.finish(2, "綱を引き切った！");
      if (this.elapsed >= CONFIG.TIME_LIMIT) {
        if (Math.abs(this.ropePosition) < 2) return this.finish(0, "時間切れ・互角！");
        return this.finish(this.ropePosition > 0 ? 1 : 2, "時間切れ判定！");
      }
      this.updateHud();
    }

    finish(winner, reason) {
      if (!this.active) return;
      this.active = false; cancelAnimationFrame(this.animationId); this.render(); this.onFinish(winner, reason);
    }

    updateHud() {
      this.players.forEach((player, index) => {
        const energy = Math.max(0, player.stamina / CONFIG.STAMINA_MAX);
        this.energyBars[index].style.transform = `scaleX(${energy.toFixed(3)})`;
        this.energyBars[index].classList.toggle("tired", energy < .3);
      });
      if (this.debug) {
        const [p1, p2] = this.players;
        this.debugPanel.textContent = [
          `rope position ${this.ropePosition.toFixed(2)}`, `rope velocity ${this.ropeVelocity.toFixed(2)}`,
          `P1 stamina   ${p1.stamina.toFixed(1)}`, `P2 stamina   ${p2.stamina.toFixed(1)}`,
          `P1 interval  ${Math.round(p1.interval)}ms`, `P2 interval  ${Math.round(p2.interval)}ms`,
          `P1 power     ${p1.currentPower.toFixed(2)}`, `P2 power     ${p2.currentPower.toFixed(2)}`,
          `elapsed      ${this.elapsed.toFixed(1)}s`, `FPS          ${Math.round(this.fps)}`
        ].join("\n");
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0); this.render();
    }

    render() {
      if (!this.context || !this.players) return;
      const ctx = this.context; const w = this.width; const h = this.height;
      ctx.save(); ctx.translate((Math.random() - .5) * this.shake * 3, (Math.random() - .5) * this.shake * 3);
      const floor = ctx.createLinearGradient(0, 0, 0, h);
      floor.addColorStop(0, "#083a4e"); floor.addColorStop(.48, "#071722"); floor.addColorStop(.52, "#071722"); floor.addColorStop(1, "#421924");
      ctx.fillStyle = floor; ctx.fillRect(-6, -6, w + 12, h + 12);
      this.drawField(ctx, w, h);
      const winOffset = h * .24; const markerY = h / 2 + (this.ropePosition / CONFIG.WIN_POSITION) * winOffset;
      const ropeX = w / 2; const topY = h * .1; const bottomY = h * .9;
      this.drawRope(ctx, ropeX, topY, bottomY, markerY);
      const size = Math.max(72, Math.min(w * .4, h * .24, 168));
      const topSlip = Math.max(0, -this.ropePosition / CONFIG.WIN_POSITION) * h * .055;
      const bottomSlip = Math.max(0, this.ropePosition / CONFIG.WIN_POSITION) * h * .055;
      this.drawPuller(ctx, 0, ropeX, h * .145 + topSlip, size, this.players[0]);
      this.drawPuller(ctx, 1, ropeX, h * .855 - bottomSlip, size, this.players[1]);
      this.drawFeedback(ctx, ropeX, h, size);
      const remaining = Math.max(0, CONFIG.TIME_LIMIT - this.elapsed);
      ctx.fillStyle = remaining < 6 ? "#ff736b" : "rgba(255,248,223,.86)";
      ctx.font = "900 " + Math.max(12, Math.min(18, h * .032)) + "px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(w / 2, h * .035); ctx.rotate(Math.PI); ctx.fillText(remaining.toFixed(1), 0, 0); ctx.restore();
      ctx.fillText(remaining.toFixed(1), w / 2, h * .965);
      ctx.restore();
    }

    drawField(ctx, w, h) {
      const topLine = h * .26; const bottomLine = h * .74;
      ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([7, 8]);
      ctx.strokeStyle = "rgba(255,200,87,.75)";
      for (const y of [topLine, bottomLine]) { ctx.beginPath(); ctx.moveTo(w * .12, y); ctx.lineTo(w * .88, y); ctx.stroke(); }
      ctx.setLineDash([3, 7]); ctx.strokeStyle = "rgba(255,255,255,.38)"; ctx.beginPath(); ctx.moveTo(w * .08, h / 2); ctx.lineTo(w * .92, h / 2); ctx.stroke();
      ctx.font = "900 " + Math.max(10, Math.min(13, w * .03)) + "px ui-monospace, Consolas, monospace";
      ctx.fillStyle = "rgba(255,200,87,.9)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(w / 2, topLine - 13); ctx.rotate(Math.PI); ctx.fillText("P2 WIN LINE", 0, 0); ctx.restore();
      ctx.fillText("P1 WIN LINE", w / 2, bottomLine + 13);
      ctx.restore();
    }

    drawRope(ctx, x, topY, bottomY, markerY) {
      const wave = Math.sin(this.elapsed * 12) * Math.min(12, Math.abs(this.ropeVelocity) * .32);
      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x + 4, topY + 4); ctx.bezierCurveTo(x + wave + 4, topY + (bottomY - topY) * .34, x - wave + 4, topY + (bottomY - topY) * .68, x + 4, bottomY + 4); ctx.stroke();
      ctx.strokeStyle = "#d8a85c"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x, topY); ctx.bezierCurveTo(x + wave, topY + (bottomY - topY) * .34, x - wave, topY + (bottomY - topY) * .68, x, bottomY); ctx.stroke();
      ctx.strokeStyle = "rgba(255,232,171,.7)"; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(x - 2, topY); ctx.bezierCurveTo(x + wave - 2, topY + (bottomY - topY) * .34, x - wave - 2, topY + (bottomY - topY) * .68, x - 2, bottomY); ctx.stroke();
      ctx.setLineDash([]); ctx.translate(x, markerY); ctx.rotate(Math.sin(this.elapsed * 9) * .08);
      ctx.fillStyle = "#ff4e49"; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-27, -18); ctx.lineTo(-19, 1); ctx.lineTo(-29, 16); ctx.lineTo(0, 9); ctx.lineTo(29, 16); ctx.lineTo(19, 1); ctx.lineTo(27, -18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffc857"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    drawPuller(ctx, index, x, y, size, player) {
      const slip = index === 0 ? Math.max(0, -this.ropePosition / CONFIG.WIN_POSITION) : Math.max(0, this.ropePosition / CONFIG.WIN_POSITION);
      ctx.save(); ctx.translate(x + Math.sin(this.elapsed * 15 + index) * player.pull * 2.5, y); if (index === 0) ctx.rotate(Math.PI);
      ctx.translate(0, player.pull * 5); ctx.scale(1 + player.pull * .035, 1 - player.pull * .025);
      if (slip > .55) {
        ctx.strokeStyle = "rgba(255,200,87,.5)"; ctx.lineWidth = 3;
        for (const offset of [-.34, .34]) { ctx.beginPath(); ctx.moveTo(size * offset, size * .44); ctx.lineTo(size * offset, size * (.62 + slip * .14)); ctx.stroke(); }
      }
      ctx.fillStyle = "rgba(0,0,0,.34)"; ctx.beginPath(); ctx.ellipse(3, size * .17, size * .4, size * .36, 0, 0, Math.PI * 2); ctx.fill();
      const sprite = this.sprites[index];
      if (sprite) {
        ctx.drawImage(sprite, -size * .55, -size * .55, size * 1.1, size * 1.1);
      } else {
        ctx.fillStyle = index === 0 ? "#27d9e6" : "#ff5a51";
        ctx.beginPath(); ctx.arc(0, 0, size * .34, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawFeedback(ctx, x, h, size) {
      ctx.save(); ctx.font = "950 " + Math.max(12, Math.min(17, size * .22)) + "px ui-monospace, Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      this.players.forEach((player, index) => {
        if (!player.feedback) return;
        ctx.fillStyle = player.feedback === "GOOD!" ? "#ffc857" : "#ff8f83";
        const y = index === 0 ? h * .2 + size * .42 : h * .8 - size * .42;
        ctx.save(); ctx.translate(x, y); if (index === 0) ctx.rotate(Math.PI); ctx.fillText(player.feedback, 0, 0); ctx.restore();
      });
      ctx.restore();
    }
  }

  window.TUG_OF_WAR_CONFIG = CONFIG;
  window.TugOfWarGame = TugOfWarGame;
})();
