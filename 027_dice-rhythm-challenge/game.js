(() => {
  "use strict";

  const CONFIG = Object.freeze({
    DEFAULT_BPM: 120,
    STARTING_LIVES: 3,
    GRID_SIZE: 16,
    PERFECT_WINDOW_MS: 68,
    GOOD_WINDOW_MS: 165,
    CHART_WEIGHTS: Object.freeze([{ value: 1, weight: 0.30 }, { value: 2, weight: 0.40 }, { value: 4, weight: 0.30 }]),
    SCORE_MULTIPLIER: Object.freeze({ PERFECT: 100, GOOD: 50, MISS: 0 }),
    INTRO_BEATS: 4
  });

  const STAGES = Object.freeze([
    { name: "1だけ", hint: "1の目だけ。まずは1拍に1回のタップを覚えよう。", pattern: [1] },
    { name: "1と2", hint: "1・1・2・2を繰り返して、2連打に慣れよう。", pattern: [1, 1, 2, 2] },
    { name: "2を練習", hint: "2を中心に、1を合図としてはさむ練習。", pattern: [2, 2, 1, 2] },
    { name: "4を練習", hint: "1・2から4連打へ、段階的に速くしよう。", pattern: [1, 2, 4, 4] },
    { name: "ミックス", hint: "決まった混合パターンを覚えて安定させよう。", pattern: [1, 2, 1, 4, 2, 4, 1, 2, 4, 2, 1, 4, 2, 1, 4, 4] },
    { name: "シャッフル", hint: "1・2・4が毎セット変化する実戦ステージ。", random: true }
  ]);
  class ChartGenerator {
    generate(stage, size = CONFIG.GRID_SIZE) {
      if (!stage.random) return Array.from({ length: size }, (_, index) => stage.pattern[index % stage.pattern.length]);
      return Array.from({ length: size }, () => {
        const roll = Math.random();
        let total = 0;
        for (const item of CONFIG.CHART_WEIGHTS) {
          total += item.weight;
          if (roll < total) return item.value;
        }
        return 4;
      });
    }
  }

  class RhythmJudge {
    judge(value, taps, wrongInput, beatDuration) {
      if (wrongInput || taps.length !== value) return { grade: "MISS", error: Infinity };
      const errors = taps.map((tap, index) => Math.abs(tap - beatDuration * ((index + 0.5) / value)));
      const averageError = errors.reduce((sum, error) => sum + error, 0) / errors.length;
      if (averageError <= CONFIG.PERFECT_WINDOW_MS) return { grade: "PERFECT", error: averageError };
      if (averageError <= CONFIG.GOOD_WINDOW_MS) return { grade: "GOOD", error: averageError };
      return { grade: "GOOD", error: averageError };
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
    }
    renderChart(chart, activeIndex = 0) {
      this.grid.replaceChildren(...chart.map((value, index) => {
        const die = document.createElement("div");
        die.className = value === 0 ? `die countdown${index === activeIndex ? " active" : ""}` : `die value-${value}${index === activeIndex ? " active" : ""}`;
        die.setAttribute("role", "listitem");
        die.setAttribute("aria-label", value === 0 ? `${index + 1}番目、カウントイン` : `${index + 1}番目、${value}の目`);
        const positions = value === 0 ? [] : value === 1 ? ["c"] : value === 2 ? ["tr", "bl"] : ["tl", "tr", "bl", "br"];
        positions.forEach((position) => { const pip = document.createElement("i"); pip.className = `pip ${position}`; die.append(pip); });
        return die;
      }));
    }
    setActive(index) {

      [...this.grid.children].forEach((die, cellIndex) => {
        die.classList.toggle("active", cellIndex === index);
        die.classList.toggle("done", cellIndex < index);
      });
      this.beatNumber.textContent = `BEAT ${String(index + 1).padStart(2, "0")} / ${CONFIG.GRID_SIZE}`;
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
    test(data) {
      this.testBpm.textContent = `${data.bpm} BPM`;
      this.testCell.textContent = `CELL ${String(data.cell + 1).padStart(2, "0")}`;
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
      this.chart = [];
      this.index = 0;
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
    openStageMenu() {
      this.running = false;
      this.preparing = false;
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.ui.enableControls(false);
      this.ui.gameOver.hidden = true;
      this.ui.pauseScreen.hidden = true;
      this.ui.readyOverlay.hidden = true;
      this.ui.startScreen.hidden = false;
      this.ui.judgement.textContent = "";
      this.previewChart();
    }
    previewChart() {
      this.chart = this.chartGenerator.generate(STAGES[this.stageIndex]);
      this.ui.renderChart(this.chart);
      this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      this.ui.enableControls(false);
    }
    async start() {
      await this.audio.unlock();
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.testMode = document.getElementById("testMode").checked;
      this.index = 0; this.score = 0; this.combo = 0; this.bestCombo = 0; this.lives = CONFIG.STARTING_LIVES; this.running = false;
      const openingNotes = this.chartGenerator.generate(STAGES[this.stageIndex]);
      this.chart = [...Array(CONFIG.INTRO_BEATS).fill(0), ...openingNotes.slice(0, CONFIG.GRID_SIZE - CONFIG.INTRO_BEATS)];
      this.ui.renderChart(this.chart, -1);
      this.ui.stats(this.score, this.combo, this.lives, this.testMode);
      this.ui.bpmDisplay.textContent = `♪ = ${this.bpm} BPM`;
      this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      this.ui.testPanel.hidden = !this.testMode;
      this.ui.startScreen.hidden = true;
      this.ui.enableControls(false);
      document.documentElement.style.setProperty("--beat-duration", `${this.beatDuration}ms`);
      this.showReady();
    }
    showReady() {
      this.preparing = true;
      this.ui.enableControls(false);
      this.ui.progress(0);
      this.ui.beatNumber.textContent = "READY";
      this.ui.judgement.className = "judgement";
      this.ui.judgement.textContent = "";
      this.ui.readyOverlay.hidden = false;
      this.beatTimer = window.setTimeout(() => {
        this.ui.readyOverlay.hidden = true;
        this.preparing = false;
        this.running = true;
        this.beginBeat();
      }, 1000);
    }
    beginBeat() {
      if (!this.running) return;
      this.taps = [];
      this.wrongInput = false;
      this.beatStart = performance.now();
      this.ui.setActive(this.index);
      this.ui.progress(0);
      this.ui.enableControls(this.chart[this.index] !== 0);
      this.audio.metronome(this.index % 4 === 0);
      this.updateFrame();
      this.beatTimer = window.setTimeout(() => this.finishBeat(), this.beatDuration);
    }
    onTap(event, value) {
      event.preventDefault();
      if (!this.running || this.chart[this.index] === 0) return;
      const button = event.currentTarget;
      button.classList.remove("pressed");
      void button.offsetWidth;
      button.classList.add("pressed");
      window.setTimeout(() => button.classList.remove("pressed"), 72);
      this.audio.tap(value);
      const elapsed = performance.now() - this.beatStart;
      if (elapsed > this.beatDuration) return;
      if (value !== this.chart[this.index]) this.wrongInput = true;
      else this.taps.push(elapsed);
      if (this.taps.length > this.chart[this.index]) this.wrongInput = true;
      this.updateTest(elapsed);
    }
    finishBeat() {
      if (!this.running) return;
      cancelAnimationFrame(this.frame);
      this.ui.progress(1);
      const value = this.chart[this.index];
      if (value === 0) {
        this.index += 1;
        this.ui.judgement.textContent = "";
        this.beginBeat();
        return;
      }
      const result = this.judge.judge(value, this.taps, this.wrongInput, this.beatDuration);
      this.audio.result(result.grade);
      this.ui.verdict(result.grade);
      if (result.grade === "MISS") { this.combo = 0; if (!this.testMode) this.lives -= 1; }
      else { this.combo += 1; this.bestCombo = Math.max(this.bestCombo, this.combo); this.score += CONFIG.SCORE_MULTIPLIER[result.grade] * value; }
      this.ui.stats(this.score, this.combo, this.lives, this.testMode);
      if (this.lives <= 0 && !this.testMode) { this.end(); return; }
      this.index += 1;
      if (this.index >= CONFIG.GRID_SIZE) { this.chart = this.chartGenerator.generate(STAGES[this.stageIndex]); this.index = 0; this.ui.renderChart(this.chart); }
      this.beginBeat();
    }
    updateFrame() {
      if (!this.running) return;
      const elapsed = performance.now() - this.beatStart;
      this.ui.progress(elapsed / this.beatDuration);
      this.updateTest(elapsed);
      this.frame = requestAnimationFrame(() => this.updateFrame());
    }
    updateTest(elapsed) {
      if (this.testMode) this.ui.test({ bpm: this.bpm, cell: this.index, taps: this.taps.length, required: this.chart[this.index], elapsed: Math.min(elapsed, this.beatDuration), duration: this.beatDuration });
    }
    pause() {
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      this.running = false;
      this.preparing = false;
      this.ui.readyOverlay.hidden = true;
      this.ui.enableControls(false);
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
      this.ui.finalScore.textContent = this.score;
      this.ui.maxCombo.textContent = this.bestCombo;
      this.ui.gameOver.hidden = false;
    }
  }

  new Game();
})();
