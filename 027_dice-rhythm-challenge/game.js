(() => {
  "use strict";

  const CONFIG = Object.freeze({
    DEFAULT_BPM: 120,
    STARTING_LIVES: 3,
    ROW_SIZE: 4,
    VISIBLE_ROWS: 5,
    ACTIVE_ROW: 1,
    PREVIEW_SIZE: 20,
    GUIDE_PULSE_MS: 82,
    CHART_WEIGHTS: Object.freeze([{ value: 1, weight: 0.30 }, { value: 2, weight: 0.40 }, { value: 4, weight: 0.30 }]),
    SCORE_MULTIPLIER: Object.freeze({ PERFECT: 100, GOOD: 50, MISS: 0 })
  });

  const STAGES = Object.freeze([
    { name: "1だけ", hint: "1の目だけ。まずは1拍に1回のタップを覚えよう。", pattern: [1] },
    { name: "2だけ", hint: "2の目だけ。1拍を半分に分けて2回叩こう。", pattern: [2] },
    { name: "4だけ", hint: "4の目だけ。1拍を4分割して一定に叩こう。", pattern: [4] },
    { name: "1と2", hint: "1・1・2・2を繰り返して切り替えに慣れよう。", pattern: [1, 1, 2, 2] },
    { name: "2を練習", hint: "2を中心に、1を合図としてはさむ練習。", pattern: [2, 2, 1, 2] },
    { name: "4を練習", hint: "1・2から4連打へ、段階的に速くしよう。", pattern: [1, 2, 4, 4] },
    { name: "ミックス", hint: "決まった混合パターンを覚えて安定させよう。", pattern: [1, 2, 1, 4, 2, 4, 1, 2, 4, 2, 1, 4, 2, 1, 4, 4] },
    { name: "シャッフル", hint: "1・2・4が毎セット変化する実戦ステージ。", random: true }
  ]);
  class ChartGenerator {
    constructor() { this.cursor = 0; }
    reset() { this.cursor = 0; }
    randomValue() {
      const roll = Math.random();
      let total = 0;
      for (const item of CONFIG.CHART_WEIGHTS) {
        total += item.weight;
        if (roll < total) return item.value;
      }
      return 4;
    }
    nextValue(stage) {
      if (stage.random) return this.randomValue();
      const value = stage.pattern[this.cursor % stage.pattern.length];
      this.cursor += 1;
      return value;
    }
    nextRow(stage) { return Array.from({ length: CONFIG.ROW_SIZE }, () => this.nextValue(stage)); }
    generate(stage, size = CONFIG.PREVIEW_SIZE) {
      if (!stage.random) return Array.from({ length: size }, (_, index) => stage.pattern[index % stage.pattern.length]);
      return Array.from({ length: size }, () => this.randomValue());
    }
  }

  class RhythmJudge {
    judge(value, taps, wrongInput) {
      if (wrongInput || taps.length < value) return { grade: "MISS", error: Infinity };
      return { grade: "PERFECT", error: 0 };
    }
  }

  class AudioManager {
    constructor() { this.context = null; }
    async unlock() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
    }
    tone(frequency, duration, type = "sine", volume = 0.07, delay = 0) {
      if (!this.context) return;
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
    metronome(accent = false) { this.tone(accent ? 950 : 720, 0.045, "square", accent ? 0.045 : 0.026); }
    tap(value) { this.tone({ 1: 250, 2: 330, 4: 440 }[value], 0.055, "triangle", 0.065); }
    result(grade) {
      if (grade === "PERFECT") { this.tone(660, 0.12, "sine", 0.07); this.tone(990, 0.16, "sine", 0.055, 0.055); }
      else if (grade === "GOOD") this.tone(560, 0.13, "triangle", 0.06);
      else this.tone(135, 0.19, "sawtooth", 0.055);
    }
  }

  class UIManager {
    constructor() {
      ["grid", "score", "combo", "beatNumber", "currentStage", "lives", "bpmDisplay", "readyOverlay", "beatProgress", "judgement", "startScreen", "gameOver", "pauseScreen", "finalScore", "maxCombo", "testPanel", "testBpm", "testCell", "testTaps", "testElapsed"].forEach((id) => { this[id] = document.getElementById(id); });
      this.buttons = [...document.querySelectorAll(".dice-button")];
      this.gridWindow = this.grid.parentElement;
      this.renderId = 0;
    }
    createDie(value, rowIndex, column, activeColumn) {
      const die = document.createElement("div");
      const isActive = rowIndex === CONFIG.ACTIVE_ROW && column === activeColumn;
      die.className = value === 0 ? `die countdown${isActive ? " active" : ""}` : `die value-${value}${isActive ? " active" : ""}`;
      die.setAttribute("role", "listitem");
      die.setAttribute("aria-label", value === 0 ? `${column + 1}拍目、カウントイン` : `${column + 1}拍目、${value}の目`);
      const positions = value === 0 ? [] : value === 1 ? ["c"] : value === 2 ? ["tr", "bl"] : ["tl", "tr", "bl", "br"];
      positions.forEach((position) => { const pip = document.createElement("i"); pip.className = `pip ${position}`; die.append(pip); });
      return die;
    }
    createRow(values, rowIndex, activeColumn) {
      const row = document.createElement("div");
      row.className = "dice-row";
      row.setAttribute("role", "group");
      row.replaceChildren(...values.map((value, column) => this.createDie(value, rowIndex, column, activeColumn)));
      return row;
    }
    positionPlayLine() {
      const row = this.grid.children[CONFIG.ACTIVE_ROW];
      if (!row) return;
      this.gridWindow.style.setProperty("--play-line-top", `${this.grid.offsetTop + row.offsetTop}px`);
      this.gridWindow.style.setProperty("--play-line-height", `${row.offsetHeight}px`);
      this.gridWindow.style.setProperty("--play-line-center", `${this.grid.offsetTop + row.offsetTop + row.offsetHeight / 2}px`);
    }
    renderChart(rows, activeColumn = 0) {
      this.renderId += 1;
      this.grid.classList.remove("row-shift");
      this.grid.style.removeProperty("--row-shift-distance");
      this.gridWindow.style.removeProperty("height");
      this.grid.replaceChildren(...rows.map((row, rowIndex) => this.createRow(row, rowIndex, activeColumn)));
      this.setActive(activeColumn, rows[CONFIG.ACTIVE_ROW]?.[activeColumn] === 0);
      this.positionPlayLine();
    }
    scrollChart(rows, activeColumn = 0, countIn = false) {
      const oldRows = [...this.grid.children];
      if (oldRows.length !== CONFIG.VISIBLE_ROWS) {
        this.renderChart(rows, activeColumn);
        return;
      }
      const renderId = ++this.renderId;
      const windowHeight = this.gridWindow.getBoundingClientRect().height;
      const distance = oldRows[1].offsetTop - oldRows[0].offsetTop;
      this.gridWindow.style.height = `${windowHeight}px`;
      this.grid.append(this.createRow(rows[CONFIG.VISIBLE_ROWS - 1], CONFIG.VISIBLE_ROWS, activeColumn));
      this.grid.style.setProperty("--row-shift-distance", `${distance}px`);
      this.setActive(activeColumn, countIn);
      this.grid.classList.remove("row-shift");
      void this.grid.offsetWidth;
      this.grid.classList.add("row-shift");
      let finished = false;
      const finish = () => {
        if (finished || renderId !== this.renderId) return;
        finished = true;
        this.grid.classList.remove("row-shift");
        this.grid.firstElementChild?.remove();
        this.grid.style.removeProperty("--row-shift-distance");
        this.gridWindow.style.removeProperty("height");
        this.setActive(activeColumn, countIn);
        this.positionPlayLine();
      };
      this.grid.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, 360);
    }
    setActive(column, countIn = false) {
      const shifting = this.grid.children.length > CONFIG.VISIBLE_ROWS;
      const activeDomRow = CONFIG.ACTIVE_ROW + (shifting ? 1 : 0);
      [...this.grid.querySelectorAll(".dice-row")].forEach((row, rowIndex) => {
        const logicalRow = rowIndex - (shifting ? 1 : 0);
        row.classList.toggle("play-line", rowIndex === activeDomRow);
        row.classList.toggle("past-row", logicalRow <= 0);
        row.setAttribute("aria-label", rowIndex === activeDomRow ? "現在の演奏ライン" : `${Math.max(1, logicalRow + 1)}段目`);
        [...row.children].forEach((die, cellColumn) => {
          die.classList.toggle("active", rowIndex === activeDomRow && cellColumn === column);
          die.classList.toggle("done", logicalRow < CONFIG.ACTIVE_ROW || (rowIndex === activeDomRow && cellColumn < column));
        });
      });
      this.beatNumber.textContent = countIn ? `COUNT IN ${column + 1} / ${CONFIG.ROW_SIZE}` : `BEAT ${String(column + 1).padStart(2, "0")} / ${String(CONFIG.ROW_SIZE).padStart(2, "0")}`;
    }
    stats(score, combo, lives, testMode) {
      this.score.textContent = String(score).padStart(6, "0");
      this.combo.textContent = combo;
      this.lives.textContent = testMode ? "∞ TEST" : Array.from({ length: CONFIG.STARTING_LIVES }, (_, i) => i < lives ? "●" : "○").join(" ");
      this.lives.setAttribute("aria-label", testMode ? "テストモード、ライフ無限" : `ライフ${lives}`);
    }
    verdict(grade) {
      this.judgement.className = `judgement ${grade.toLowerCase()}`;
      this.judgement.textContent = grade === "PERFECT" ? "Perfect!" : grade === "GOOD" ? "Good!" : "Miss";
      void this.judgement.offsetWidth;
      this.judgement.classList.add("show");
    }
    progress(ratio) { this.beatProgress.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`; }
    enableControls(enabled) { this.buttons.forEach((button) => { button.disabled = !enabled; }); }
    targetGuide(value, enabled) {
      this.buttons.forEach((button) => {
        const active = enabled && Number(button.dataset.value) === value;
        const label = button.querySelector(".target-guide");
        button.classList.toggle("test-target", active);
        button.classList.remove("guide-hit", "guide-cue");
        label.hidden = !active;
        label.textContent = active ? `TARGET ${value} / ${value} taps` : "";
      });
    }
    guideCue(active) {
      this.buttons.forEach((button) => button.classList.toggle("guide-cue", active && button.classList.contains("test-target")));
    }
    hitGuide(button) {
      if (!button.classList.contains("test-target")) return;
      button.classList.remove("guide-hit");
      void button.offsetWidth;
      button.classList.add("guide-hit");
      window.setTimeout(() => button.classList.remove("guide-hit"), 110);
    }
    test(data) {
      this.testBpm.textContent = `${data.bpm} BPM`;
      this.testCell.textContent = `BEAT ${data.cell + 1} / ${CONFIG.ROW_SIZE}`;
      this.testTaps.textContent = `TAPS ${data.taps} / ${data.required}`;
      this.testElapsed.textContent = `TIME ${Math.round(data.elapsed)} / ${Math.round(data.duration)}ms`;
    }
  }

  class Game {
    constructor() {
      this.chartGenerator = new ChartGenerator();
      this.judge = new RhythmJudge();
      this.audio = new AudioManager();
      this.ui = new UIManager();
      this.bpm = CONFIG.DEFAULT_BPM;
      this.stageIndex = 0;
      this.rows = [];
      this.column = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.lives = CONFIG.STARTING_LIVES;
      this.taps = [];
      this.wrongInput = false;
      this.running = false;
      this.preparing = false;
      this.testMode = false;
      this.beatStart = 0;
      this.frame = 0;
      this.beatTimer = 0;
      this.bind();
      this.previewChart();
    }
    get beatDuration() { return 60000 / this.bpm; }
    get currentValue() { return this.rows[CONFIG.ACTIVE_ROW]?.[this.column] ?? 0; }
    bind() {
      document.getElementById("bpmOptions").addEventListener("pointerdown", (event) => {
        const button = event.target.closest("button[data-bpm]");
        if (!button) return;
        event.preventDefault();
        this.bpm = Number(button.dataset.bpm);
        document.querySelectorAll("[data-bpm]").forEach((item) => item.classList.toggle("selected", item === button));
        this.ui.bpmDisplay.textContent = `♪ = ${this.bpm} BPM`;
        this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      });
      document.getElementById("stageOptions").addEventListener("pointerdown", (event) => {
        const button = event.target.closest("button[data-stage]");
        if (!button) return;
        event.preventDefault();
        this.stageIndex = Number(button.dataset.stage);
        document.querySelectorAll("[data-stage]").forEach((item) => {
          const selected = item === button;
          item.classList.toggle("selected", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        document.getElementById("stageHint").textContent = STAGES[this.stageIndex].hint;
        this.previewChart();
      });
      document.getElementById("stageMenu").addEventListener("pointerdown", (event) => { event.preventDefault(); this.openStageMenu(); });
      document.getElementById("stageSelectButton").addEventListener("pointerdown", (event) => { event.preventDefault(); this.openStageMenu(); });
      document.getElementById("startButton").addEventListener("pointerdown", (event) => { event.preventDefault(); this.start(); });
      document.getElementById("retryButton").addEventListener("pointerdown", (event) => { event.preventDefault(); this.ui.gameOver.hidden = true; this.start(); });
      document.getElementById("resumeButton").addEventListener("pointerdown", (event) => { event.preventDefault(); this.resume(); });
      this.ui.buttons.forEach((button) => button.addEventListener("pointerdown", (event) => this.onTap(event, Number(button.dataset.value)), { passive: false }));
      document.addEventListener("contextmenu", (event) => event.preventDefault());
      document.addEventListener("visibilitychange", () => { if (document.hidden && (this.running || this.preparing)) this.pause(); });
      window.addEventListener("pagehide", () => { if (this.running || this.preparing) this.pause(); });
    }
    makePreviewRows() {
      const values = this.chartGenerator.generate(STAGES[this.stageIndex], CONFIG.PREVIEW_SIZE);
      return Array.from({ length: CONFIG.VISIBLE_ROWS }, (_, row) => values.slice(row * CONFIG.ROW_SIZE, (row + 1) * CONFIG.ROW_SIZE));
    }
    makeOpeningRows() {
      this.chartGenerator.reset();
      const blankRow = () => Array(CONFIG.ROW_SIZE).fill(0);
      return [blankRow(), blankRow(), this.chartGenerator.nextRow(STAGES[this.stageIndex]), this.chartGenerator.nextRow(STAGES[this.stageIndex]), this.chartGenerator.nextRow(STAGES[this.stageIndex])];
    }
    openStageMenu() {
      this.running = false;
      this.preparing = false;
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.gameOver.hidden = true;
      this.ui.pauseScreen.hidden = true;
      this.ui.readyOverlay.hidden = true;
      this.ui.startScreen.hidden = false;
      this.ui.judgement.textContent = "";
      this.previewChart();
    }
    previewChart() {
      this.rows = this.makePreviewRows();
      this.column = 0;
      this.ui.renderChart(this.rows, this.column);
      this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
    }
    async start() {
      await this.audio.unlock();
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.testMode = document.getElementById("testMode").checked;
      this.column = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.lives = CONFIG.STARTING_LIVES;
      this.running = false;
      this.rows = this.makeOpeningRows();
      this.ui.renderChart(this.rows, -1);
      this.ui.stats(this.score, this.combo, this.lives, this.testMode);
      this.ui.bpmDisplay.textContent = `♪ = ${this.bpm} BPM`;
      this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      this.ui.testPanel.hidden = !this.testMode;
      this.ui.startScreen.hidden = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      document.documentElement.style.setProperty("--beat-duration", `${this.beatDuration}ms`);
      document.documentElement.style.setProperty("--row-shift-duration", `${Math.max(180, Math.min(260, this.beatDuration * 0.45))}ms`);
      this.showReady();
    }
    showReady() {
      this.preparing = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.progress(0);
      this.ui.beatNumber.textContent = "READY";
      this.ui.judgement.className = "judgement";
      this.ui.judgement.textContent = "";
      this.ui.readyOverlay.hidden = false;
      this.beatTimer = window.setTimeout(() => {
        this.ui.readyOverlay.hidden = true;
        this.preparing = false;
        this.running = true;
        this.beginBeat(performance.now());
      }, 1000);
    }
    beginBeat(startTime = performance.now()) {
      if (!this.running) return;
      this.taps = [];
      this.wrongInput = false;
      this.beatStart = startTime;
      const value = this.currentValue;
      this.ui.setActive(this.column, value === 0);
      this.ui.progress(0);
      this.ui.enableControls(value !== 0);
      this.ui.targetGuide(value, this.testMode && value !== 0);
      this.updateGuide(Math.max(0, performance.now() - this.beatStart));
      this.audio.metronome(this.column === 0);
      this.updateFrame();
      const delay = Math.max(0, this.beatStart + this.beatDuration - performance.now());
      this.beatTimer = window.setTimeout(() => this.finishBeat(), delay);
    }
    onTap(event, value) {
      event.preventDefault();
      if (!this.running || this.currentValue === 0) return;
      const button = event.currentTarget;
      button.classList.remove("pressed");
      void button.offsetWidth;
      button.classList.add("pressed");
      this.ui.hitGuide(button);
      window.setTimeout(() => button.classList.remove("pressed"), 72);
      this.audio.tap(value);
      const elapsed = performance.now() - this.beatStart;
      if (elapsed > this.beatDuration) return;
      if (this.taps.length >= this.currentValue) {
        this.updateTest(elapsed);
        return;
      }
      if (value !== this.currentValue) this.wrongInput = true;
      else this.taps.push(elapsed);
      this.updateTest(elapsed);
    }
    finishBeat() {
      if (!this.running) return;
      cancelAnimationFrame(this.frame);
      this.ui.progress(1);
      const value = this.currentValue;
      const nextBeatStart = this.beatStart + this.beatDuration;
      if (value === 0) {
        this.ui.judgement.textContent = "";
        this.advanceChart(nextBeatStart);
        return;
      }
      const result = this.judge.judge(value, this.taps, this.wrongInput);
      this.audio.result(result.grade);
      this.ui.verdict(result.grade);
      if (result.grade === "MISS") {
        this.combo = 0;
        if (!this.testMode) this.lives -= 1;
      } else {
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.score += CONFIG.SCORE_MULTIPLIER[result.grade] * value;
      }
      this.ui.stats(this.score, this.combo, this.lives, this.testMode);
      if (this.lives <= 0 && !this.testMode) { this.end(); return; }
      this.advanceChart(nextBeatStart);
    }
    advanceChart(nextBeatStart) {
      if (this.column < CONFIG.ROW_SIZE - 1) {
        this.column += 1;
      } else {
        this.rows = [...this.rows.slice(1), this.chartGenerator.nextRow(STAGES[this.stageIndex])];
        this.column = 0;
        this.ui.scrollChart(this.rows, this.column, this.currentValue === 0);
      }
      this.beginBeat(nextBeatStart);
    }
    updateFrame() {
      if (!this.running) return;
      const elapsed = performance.now() - this.beatStart;
      this.ui.progress(elapsed / this.beatDuration);
      this.updateGuide(elapsed);
      this.updateTest(elapsed);
      this.frame = requestAnimationFrame(() => this.updateFrame());
    }
    updateGuide(elapsed) {
      const value = this.currentValue;
      if (!this.testMode || !value || elapsed < 0 || elapsed >= this.beatDuration) {
        this.ui.guideCue(false);
        return;
      }
      const subdivision = this.beatDuration / value;
      const pulseWindow = Math.min(CONFIG.GUIDE_PULSE_MS, subdivision * 0.55);
      this.ui.guideCue(elapsed % subdivision < pulseWindow);
    }
    updateTest(elapsed) {
      if (this.testMode) this.ui.test({ bpm: this.bpm, cell: this.column, taps: this.taps.length, required: this.currentValue, elapsed: Math.min(Math.max(0, elapsed), this.beatDuration), duration: this.beatDuration });
    }
    pause() {
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.running = false;
      this.preparing = false;
      this.ui.readyOverlay.hidden = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.pauseScreen.hidden = false;
    }
    async resume() {
      await this.audio.unlock();
      this.ui.pauseScreen.hidden = true;
      this.showReady();
    }
    end() {
      this.running = false;
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.finalScore.textContent = this.score;
      this.ui.maxCombo.textContent = this.bestCombo;
      this.ui.gameOver.hidden = false;
    }
  }
  new Game();
})();
