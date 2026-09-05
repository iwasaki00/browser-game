(() => {
  "use strict";
  class SumoGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.sprites = (this.spriteUrls || []).map((url) => {
        const sprite = new Image();
        sprite.decoding = "async"; sprite.src = url;
        sprite.addEventListener("load", () => this.render(), { once: true });
        return sprite;
      });
      this.active = false; this.animationId = 0; this.lastFrame = 0; this.fps = 60;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.resize(); this.reset(); this.bindInput();
    }
    reset() {
      this.players = [this.makePlayer(.37, 1), this.makePlayer(.63, -1)];
      this.elapsed = 0; this.lastImpactAt = 0; this.shake = 0; this.flash = 0; this.active = false; this.lastFrame = performance.now();
      this.updateHud(); this.render();
    }
    makePlayer(x, direction) { return { x, velocity: 0, force: 0, direction, heat: 0, squash: 0, lean: 0, taps: [], lastTap: 0, rhythm: 0 }; }
    bindInput() {
      this.pointerHandlers = this.controls.map((control, index) => {
        const handler = (event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault(); if (control.setPointerCapture) control.setPointerCapture(event.pointerId); this.tap(index, performance.now());
        };
        control.addEventListener("pointerdown", handler, { passive: false }); control.addEventListener("contextmenu", this.preventMenu); return handler;
      });
      this.keyHandler = (event) => {
        if (event.repeat) return;
        if (event.code === "KeyA" || event.code === "ArrowLeft") { event.preventDefault(); this.tap(0, performance.now()); }
        if (event.code === "KeyL" || event.code === "ArrowRight") { event.preventDefault(); this.tap(1, performance.now()); }
      };
      window.addEventListener("keydown", this.keyHandler);
    }
    preventMenu(event) { event.preventDefault(); }
    start() { this.active = true; this.lastFrame = performance.now(); cancelAnimationFrame(this.animationId); this.animationId = requestAnimationFrame((time) => this.frame(time)); }
    stop() { this.active = false; cancelAnimationFrame(this.animationId); }
    destroy() {
      this.stop(); this.resizeObserver.disconnect();
      this.controls.forEach((control, index) => { control.removeEventListener("pointerdown", this.pointerHandlers[index]); control.removeEventListener("contextmenu", this.preventMenu); });
      window.removeEventListener("keydown", this.keyHandler);
    }
    tap(index, now) {
      if (!this.active) return;
      const player = this.players[index]; const interval = player.lastTap ? now - player.lastTap : 0; player.lastTap = now;
      player.taps.push(now); player.taps = player.taps.filter((time) => now - time < 650);
      const steady = interval >= 135 && interval <= 280;
      player.rhythm = steady ? Math.min(1, player.rhythm + .23) : Math.max(0, player.rhythm - .17);
      const rapidPenalty = Math.max(0, player.taps.length - 5) * .075;
      player.heat = Math.min(1, player.heat + .16);
      const stamina = Math.max(.58, 1 - player.heat * .38 - rapidPenalty);
      const power = (.28 + player.rhythm * .075) * stamina;
      player.velocity += power * player.direction; player.force = Math.min(1.4, player.force + power * 1.8);
      player.squash = 1; player.lean = player.direction; this.shake = Math.min(1, this.shake + .22); this.flash = 1;
      const control = this.controls[index]; control.classList.remove("pressed"); void control.offsetWidth; control.classList.add("pressed");
      this.onTapSound(stamina, index); this.updateHud();
    }
    frame(now) {
      if (!this.active) return;
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000)); this.fps += ((1 / dt) - this.fps) * .08; this.lastFrame = now;
      this.update(dt, now); this.render(); if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }
    update(dt, now) {
      this.elapsed += dt; const frameScale = dt * 60; const [p1, p2] = this.players; const friction = Math.pow(.925, frameScale);
      for (const player of this.players) {
        player.velocity *= friction; player.force *= Math.pow(.88, frameScale); player.heat = Math.max(0, player.heat - dt * .43);
        player.rhythm = Math.max(0, player.rhythm - dt * .12); player.squash = Math.max(0, player.squash - dt * 6.5);
        player.lean *= Math.pow(.82, frameScale); player.taps = player.taps.filter((time) => now - time < 650); player.x += player.velocity * dt * .16;
      }
      const gap = p2.x - p1.x; const minGap = .145;
      if (gap < minGap) {
        const center = (p1.x + p2.x) / 2; const forceDifference = p1.force - p2.force; const momentum = (p1.velocity + p2.velocity) * .5;
        const overtime = Math.max(0, this.elapsed - 12) * .018; const push = momentum + forceDifference * (.12 + overtime);
        p1.x = center - minGap / 2 + push * dt; p2.x = center + minGap / 2 + push * dt; p1.velocity = push * .75; p2.velocity = push * .75;
        p1.lean = Math.max(-1, Math.min(1, forceDifference)); p2.lean = p1.lean; this.shake = Math.min(1, this.shake + Math.abs(forceDifference) * .06);
        if (now - this.lastImpactAt > 260 && Math.abs(forceDifference) > .26) { this.lastImpactAt = now; this.onImpactSound(Math.abs(forceDifference)); }
      }
      this.shake *= Math.pow(.82, frameScale); this.flash *= Math.pow(.78, frameScale);
      const leftEdge = .13; const rightEdge = .87;
      this.dangers[0].classList.toggle("visible", p1.x < leftEdge + .09); this.dangers[1].classList.toggle("visible", p2.x > rightEdge - .09);
      if (p1.x < leftEdge) return this.finish(2, "押し出し！");
      if (p2.x > rightEdge) return this.finish(1, "押し出し！");
      if (this.elapsed >= 25) return this.finish((p1.x + p2.x) / 2 >= .5 ? 1 : 2, "判定勝ち！");
      this.updateHud();
    }
    finish(winner, reason) { if (!this.active) return; this.active = false; this.render(); this.onFinish(winner, reason); }
    updateHud() {
      this.players.forEach((player, index) => { const energy = Math.max(.08, 1 - player.heat); this.energyBars[index].style.transform = `scaleX(${energy.toFixed(3)})`; this.energyBars[index].classList.toggle("tired", energy < .45); });
      if (this.debug) {
        const [p1, p2] = this.players;
        this.debugPanel.textContent = [`P1 velocity  ${p1.velocity.toFixed(3)}`, `P2 velocity  ${p2.velocity.toFixed(3)}`, `P1 tap rate  ${p1.taps.length}/650ms`, `P2 tap rate  ${p2.taps.length}/650ms`, `current force ${(p1.force - p2.force).toFixed(3)}`, `FPS ${Math.round(this.fps)}`].join("\n");
      }
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height); this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0); this.render();
    }
    render() {
      if (!this.context || !this.players) return;
      const ctx = this.context; const w = this.width; const h = this.height;
      ctx.save(); ctx.translate((Math.random() - .5) * this.shake * 5, (Math.random() - .5) * this.shake * 3);
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0b2b3f"); sky.addColorStop(1, "#07131d");
      ctx.fillStyle = sky; ctx.fillRect(-8, -8, w + 16, h + 16); this.drawBanners(ctx, w, h);
      const ringY = h * .67; const ringLeft = w * .13; const ringWidth = w * .74; const ringHeight = Math.max(52, h * .28);
      ctx.fillStyle = "rgba(0,0,0,.36)"; ctx.beginPath(); ctx.ellipse(w / 2, ringY + ringHeight * .45, ringWidth * .53, ringHeight * .35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8a512b"; ctx.beginPath(); ctx.ellipse(w / 2, ringY + 10, ringWidth * .53, ringHeight * .55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = Math.max(7, h * .035); ctx.stroke();
      const sand = ctx.createRadialGradient(w / 2, ringY - 10, 2, w / 2, ringY, ringWidth * .45); sand.addColorStop(0, "#e6b86a"); sand.addColorStop(1, "#b7783b");
      ctx.fillStyle = sand; ctx.beginPath(); ctx.ellipse(w / 2, ringY, ringWidth * .48, ringHeight * .42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,247,214,.72)"; ctx.lineWidth = 2; ctx.setLineDash([6, 7]); ctx.beginPath(); ctx.moveTo(ringLeft, ringY); ctx.lineTo(ringLeft + ringWidth, ringY); ctx.stroke(); ctx.setLineDash([]);
      const size = Math.max(88, Math.min(h * .58, w * .4));
      const wrestlerBase = ringY + ringHeight * .24;
      this.drawWrestler(ctx, this.players[0], w, wrestlerBase, size, 0);
      this.drawWrestler(ctx, this.players[1], w, wrestlerBase, size, 1);
      if (this.flash > .08 && this.players[1].x - this.players[0].x < .18) this.drawImpact(ctx, w * (this.players[0].x + this.players[1].x) / 2, ringY - size * .75, size * (.3 + this.flash * .25));
      const remaining = Math.max(0, 25 - this.elapsed); ctx.fillStyle = remaining < 6 ? "#ff5a51" : "rgba(255,248,223,.78)";
      ctx.font = `900 ${Math.max(11, h * .042)}px ui-monospace, Consolas, monospace`; ctx.textAlign = "center"; ctx.fillText(remaining.toFixed(1), w / 2, Math.max(18, h * .09)); ctx.restore();
    }
    drawBanners(ctx, w, h) {
      ctx.save(); ctx.globalAlpha = .34; ctx.fillStyle = "#27d9e6"; ctx.fillRect(w * .08, 0, w * .08, h * .43); ctx.fillStyle = "#ff5a51"; ctx.fillRect(w * .84, 0, w * .08, h * .43);
      ctx.fillStyle = "rgba(255,255,255,.16)"; for (let i = 0; i < 7; i += 1) ctx.fillRect(w * (.24 + i * .09), h * .09, 2, h * .2); ctx.restore();
    }
    drawWrestler(ctx, player, width, baseY, size, spriteIndex) {
      const x = player.x * width; const sprite = this.sprites[spriteIndex]; const squash = player.squash;
      ctx.save(); ctx.translate(x, baseY); ctx.rotate(player.lean * .1); ctx.scale(1 + squash * .07, 1 - squash * .055);
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, size * .42, size * .09, 0, 0, Math.PI * 2); ctx.fill();
      if (sprite && sprite.complete && sprite.naturalWidth) {
        ctx.drawImage(sprite, -size * .5, -size, size, size);
      } else {
        ctx.fillStyle = spriteIndex === 0 ? "#27d9e6" : "#ff5a51";
        ctx.beginPath(); ctx.ellipse(0, -size * .42, size * .42, size * .48, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    drawImpact(ctx, x, y, radius) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,200,87,${Math.min(1, this.flash)})`; ctx.beginPath();
      for (let i = 0; i < 16; i += 1) { const angle = Math.PI * 2 * i / 16; const length = i % 2 ? radius * .45 : radius; const px = Math.cos(angle) * length; const py = Math.sin(angle) * length; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  window.SumoGame = SumoGame;
})();
