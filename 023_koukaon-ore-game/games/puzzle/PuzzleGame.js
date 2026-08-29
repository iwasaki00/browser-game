(function () {
  "use strict";

  class PuzzleGame {
    constructor(canvas, soundManager, settings, onEnd, options = {}) {
      this.canvas = canvas; this.sound = soundManager; this.settings = settings; this.onEnd = onEnd;
      this.board = new window.PuzzleBoard(8, 8, 6); this.renderer = new window.PuzzleRenderer(canvas, this.board);
      this.running = false; this.finished = false; this.timeUp = false; this.warningPlayed = false; this.last = 0; this.elapsed = 0; this.fps = 60;
      this.timeRemaining = options.duration || 60; this.score = 0; this.bestScore = options.bestScore || 0; this.state = "IDLE"; this.chain = 0; this.maxChain = 0;
      this.selected = null; this.pointerStart = null; this.hint = null; this.idleTime = 0; this.clearing = null; this.chainDisplay = 0; this.chainDisplayTimer = 0; this.banner = ""; this.bannerTimer = 0; this.popups = [];
      this.stats = { totalCleared: 0, specialsCreated: 0, specialsActivated: 0, bigClears: 0 };
      this.cleanup = []; this.boundLoop = (time) => this.loop(time);
      this.chainDelay = 340; this.fallDelay = 170;
    }

    start() {
      this.sound.resetPlayStats(); this.board.generate(); this.renderer.resize(); this.bindInput(); this.running = true; this.last = performance.now(); requestAnimationFrame(this.boundLoop);
    }

    stop() { this.running = false; this.cleanup.splice(0).forEach((remove) => remove()); }
    resize() { this.renderer.resize(); }

    bindInput() {
      const down = (event) => { if (!this.canInput()) return; event.preventDefault(); const cell = this.renderer.cellAt(event.clientX, event.clientY); if (!cell) return; this.pointerStart = { cell, x: event.clientX, y: event.clientY }; this.canvas.setPointerCapture?.(event.pointerId); };
      const up = (event) => {
        if (!this.pointerStart || !this.canInput()) { this.pointerStart = null; return; }
        event.preventDefault(); const start = this.pointerStart; this.pointerStart = null; const dx = event.clientX - start.x, dy = event.clientY - start.y; const threshold = this.renderer.cellSize * .24;
        let target = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) target = Math.abs(dx) > Math.abs(dy) ? { row: start.cell.row, col: start.cell.col + Math.sign(dx) } : { row: start.cell.row + Math.sign(dy), col: start.cell.col };
        if (target && this.board.inBounds(target.row, target.col)) this.trySwap(start.cell, target);
        else this.handleTap(start.cell);
      };
      const cancel = () => { this.pointerStart = null; };
      this.canvas.addEventListener("pointerdown", down); this.canvas.addEventListener("pointerup", up); this.canvas.addEventListener("pointercancel", cancel);
      this.cleanup.push(() => { this.canvas.removeEventListener("pointerdown", down); this.canvas.removeEventListener("pointerup", up); this.canvas.removeEventListener("pointercancel", cancel); });
    }

    canInput() { return this.running && !this.timeUp && this.state === "IDLE"; }

    handleTap(cell) {
      if (!this.selected) { this.selected = cell; return; }
      if (this.selected.row === cell.row && this.selected.col === cell.col) { this.selected = null; return; }
      if (this.board.adjacent(this.selected, cell)) { const first = this.selected; this.selected = null; this.trySwap(first, cell); }
      else this.selected = cell;
    }

    async trySwap(first, second) {
      if (!this.canInput() || !this.board.adjacent(first, second)) return;
      this.idleTime = 0; this.hint = null; this.state = "SWAPPING"; this.board.swap(first, second); this.sound.play("puzzleSwap"); await this.wait(130);
      if (!this.running) return;
      const matches = this.board.findMatches();
      if (!matches.groups.length) { this.board.swap(first, second); this.sound.play("puzzleInvalid"); this.banner = "NO MATCH"; this.bannerTimer = .45; await this.wait(150); this.state = this.timeUp ? "GAME_OVER" : "IDLE"; if (this.timeUp) this.finish(); return; }
      await this.resolveChains([first, second]);
    }

    async resolveChains(preferred) {
      this.chain = 0; let matches = this.board.findMatches();
      while (matches.groups.length) {
        this.chain += 1; this.maxChain = Math.max(this.maxChain, this.chain); this.state = "CLEARING";
        const specialPlans = this.board.planSpecials(matches.groups, this.chain === 1 ? preferred : []);
        specialPlans.forEach((plan) => matches.positions.delete(this.board.key(plan.row, plan.col)));
        const expanded = this.board.expandSpecials(matches.positions); this.clearing = expanded.positions;
        const clearedCount = expanded.positions.size; const chainSound = this.chain === 1 ? "puzzleMatch" : this.chain === 2 ? "puzzleChain2" : this.chain === 3 ? "puzzleChain3" : this.chain === 4 ? "puzzleChain4" : "puzzleChain5";
        this.sound.play(chainSound); if (specialPlans.length) { this.sound.play("puzzleSpecialCreate"); this.stats.specialsCreated += specialPlans.length; }
        if (expanded.activated) { this.sound.play("puzzleSpecialActivate"); this.stats.specialsActivated += expanded.activated; }
        if (clearedCount >= 10) { this.sound.play("puzzleBigClear"); this.stats.bigClears += 1; }
        this.chainDisplay = this.chain; this.chainDisplayTimer = .75;
        const gained = this.calculateScore(clearedCount, this.chain); this.score += gained; this.stats.totalCleared += clearedCount;
        const center = this.centerOf(expanded.positions); this.popups.push({ x: center.x, y: center.y, score: gained, life: 1 });
        await this.wait(this.chainDelay); this.board.clear(expanded.positions, specialPlans); this.clearing = null;
        if (!this.running) return;
        this.state = "FALLING"; this.board.collapse(); await this.wait(this.fallDelay);
        if (!this.running) return;
        this.state = "REFILLING"; this.board.refill(); await this.wait(this.fallDelay);
        if (!this.running) return;
        matches = this.board.findMatches(); preferred = [];
      }
      if (!this.board.findValidMoves(1).length) { this.state = "SHUFFLING"; this.banner = "SHUFFLE"; this.bannerTimer = .8; await this.wait(350); if (!this.running) return; this.board.shuffle(); await this.wait(300); if (!this.running) return; }
      this.chain = 0; this.state = this.timeUp ? "GAME_OVER" : "IDLE"; this.idleTime = 0;
      if (this.timeUp) this.finish();
    }

    calculateScore(count, chain) {
      const base = count === 3 ? 100 : count === 4 ? 150 : 200 + Math.max(0, count - 5) * 55;
      const multiplier = chain === 1 ? 1 : chain === 2 ? 1.5 : chain === 3 ? 2 : chain === 4 ? 3 : 4 + (chain - 5) * .5;
      return Math.round(base * multiplier);
    }

    centerOf(positions) {
      let row = 0, col = 0; const entries = [...positions]; entries.forEach((key) => { const [r, c] = this.board.parseKey(key); row += r; col += c; });
      return { x: this.renderer.offsetX + (col / Math.max(1, entries.length) + .5) * this.renderer.cellSize, y: this.renderer.offsetY + (row / Math.max(1, entries.length) + .5) * this.renderer.cellSize };
    }

    wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

    loop(time) {
      if (!this.running) return; const dt = Math.min(.05, (time - this.last) / 1000); this.last = time; this.fps += (1 / Math.max(.001, dt) - this.fps) * .08; this.elapsed += dt;
      if (!this.timeUp) {
        this.timeRemaining = Math.max(0, this.timeRemaining - dt);
        if (this.timeRemaining <= 10 && !this.warningPlayed) { this.warningPlayed = true; this.sound.play("puzzleWarning"); }
        if (this.timeRemaining <= 0) { this.timeUp = true; if (this.state === "IDLE") { this.state = "GAME_OVER"; this.finish(); } }
      }
      if (this.state === "IDLE") { this.idleTime += dt; if (this.idleTime > 5 && !this.hint) this.hint = this.board.findValidMoves(1)[0] || null; }
      this.chainDisplayTimer = Math.max(0, this.chainDisplayTimer - dt); if (!this.chainDisplayTimer) this.chainDisplay = 0;
      this.bannerTimer = Math.max(0, this.bannerTimer - dt); if (!this.bannerTimer) this.banner = "";
      this.popups.forEach((popup) => popup.life -= dt * 1.25); this.popups = this.popups.filter((popup) => popup.life > 0);
      this.renderer.draw(this); requestAnimationFrame(this.boundLoop);
    }

    finish() {
      if (this.finished) return; this.finished = true; this.running = false; this.sound.play("puzzleGameOver");
      this.onEnd({ mode: "puzzle", clear: false, score: this.score, counts: this.sound.getPlayStats(), stats: { maxChain: this.maxChain, ...this.stats } });
    }

    getHudState() { return { mode: "puzzle", score: this.score, best: Math.max(this.bestScore, this.score), time: this.timeRemaining }; }
    getDebugState() { return { game: "puzzle", playerState: this.state, fps: Math.round(this.fps), x: "8列", y: "8行", grounded: "--", enemies: this.board.findValidMoves().length, chain: this.chain, time: this.timeRemaining.toFixed(1) }; }
  }

  window.PuzzleGame = PuzzleGame;
})();
