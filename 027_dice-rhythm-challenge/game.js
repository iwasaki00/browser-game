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
    async unlock(sharedContext = null) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (sharedContext) this.context = sharedContext;
      else if (!this.context) this.context = new AudioContext();
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
      ["grid", "score", "combo", "beatNumber", "currentStage", "lives", "bpmDisplay", "readyOverlay", "beatProgress", "judgement", "startScreen", "gameOver", "pauseScreen", "finalScore", "maxCombo", "perfectTotal", "goodTotal", "missTotal", "resultKicker", "resultTitle", "testPanel", "testBpm", "testCell", "testTaps", "testElapsed", "midiPanel", "midiLibrary", "midiName", "midiTempo", "midiSignature", "midiDuration", "midiTracks", "midiTempoChanges", "midiStatus", "midiAnalysisPanel", "analysisTrack", "analysisBody", "analysisDebug", "analysisCopyStatus", "copyAnalysisButton", "diceChartPanel", "chartTrack", "chartPlayableRate", "chartStatistics", "chartWarning", "chartMeasures", "chartDetail", "chartCopyStatus", "copyChartButton", "gameTrack", "gameTrackActive", "gameTrackPlayable", "gameTrackFallback", "gameTrackWarning", "debugButton", "debugDrawer", "debugContent", "closeDebugButton", "midiPlayMeta", "playingSong", "playingTrack", "fallbackTotal"].forEach((id) => { this[id] = document.getElementById(id); });
      this.midiProgress = document.createElement("div");
      this.midiProgress.className = "midi-load-progress";
      this.midiProgress.hidden = true;
      this.midiProgress.innerHTML = '<div class="midi-progress-head"><span></span><b></b></div><progress max="1" value="0"></progress>';
      this.midiStatus.before(this.midiProgress);
      this.debugContent.append(this.midiAnalysisPanel, this.diceChartPanel);
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
    beatSourceMarker(beat, testMode) {
      this.grid.querySelectorAll(".source-warning").forEach((item) => item.remove());
      if (!testMode || !beat?.isFallback) return;
      const active = this.grid.querySelector(".die.active");
      if (!active) return;
      const marker = document.createElement("small");
      marker.className = "source-warning";
      marker.textContent = beat.sourcePattern === "TRIPLET" ? "3!" : "?";
      active.append(marker);
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
      this.testBpm.textContent = `${Math.round(data.bpm)} BPM`;
      this.testCell.textContent = `BEAT ${data.cell + 1} / ${CONFIG.ROW_SIZE}`;
      this.testTaps.textContent = `TAPS ${data.taps} / ${data.required}`;
      this.testElapsed.textContent = `TIME ${Math.round(data.elapsed)} / ${Math.round(data.duration)}ms`;
    }
    mode(isMidi) {
      this.startScreen.classList.toggle("midi-selected", isMidi);
      this.midiPanel.hidden = !isMidi;
    }
    midiMessage(message, type = "") {
      this.midiStatus.className = `midi-status${type ? ` ${type}` : ""}`;
      this.midiStatus.textContent = message;
    }
    libraryProgress(current, total, label, state = "loading") {
      const safeTotal = Math.max(0, Number(total) || 0);
      const safeCurrent = Math.min(safeTotal, Math.max(0, Number(current) || 0));
      const progress = this.midiProgress.querySelector("progress");
      this.midiProgress.hidden = false;
      this.midiProgress.className = `midi-load-progress ${state}`;
      this.midiProgress.querySelector("span").textContent = label;
      this.midiProgress.querySelector("b").textContent = safeTotal ? `${safeCurrent} / ${safeTotal}` : "— / —";
      progress.max = Math.max(1, safeTotal);
      progress.value = safeCurrent;
    }
    midiInfo(info) {
      const minutes = Math.floor(info.duration / 60);
      const seconds = Math.floor(info.duration % 60);
      this.midiName.textContent = info.fileName;
      this.midiTempo.textContent = `${Math.round(info.bpm)} BPM`;
      this.midiSignature.textContent = info.timeSignature;
      this.midiDuration.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      this.midiTracks.textContent = String(info.tracks);
      this.midiTempoChanges.textContent = String(info.tempoChanges);
      this.midiMessage(info.recommended ? `${info.notes} notes / MIDI準備完了` : `${info.notes} notes / 現在このゲームでは4/4を推奨`, info.recommended ? "" : "warning");
    }
    analysisVisible(visible) { this.midiAnalysisPanel.hidden = !visible; }
    analysisTracks(tracks, selected = "all") {
      this.analysisTrack.replaceChildren(...tracks.map((track) => {
        const option = document.createElement("option");
        option.value = track.value;
        option.textContent = track.label;
        return option;
      }));
      this.analysisTrack.value = selected;
    }
    analysisRows(analysis, currentTick = null) {
      if (!analysis?.beats?.length) {
        this.analysisBody.replaceChildren();
        this.analysisDebug.textContent = "解析可能な拍がありません。";
        return;
      }
      let currentIndex = currentTick === null ? 0 : analysis.beats.findIndex((beat) => currentTick >= beat.startTick && currentTick < beat.endTick);
      if (currentIndex < 0) currentIndex = Math.max(0, analysis.beats.length - 1);
      const start = Math.max(0, currentIndex - 3);
      const shown = analysis.beats.slice(start, start + 12);
      const formatPositions = (positions) => positions.length ? positions.map((position) => position.toFixed(3).replace(/0$/, "")).join(" ") : "-";
      this.analysisBody.replaceChildren(...shown.map((beat) => {
        const row = document.createElement("tr");
        row.classList.toggle("current", beat.index === currentIndex && currentTick !== null);
        [beat.measure, beat.beat, beat.rawNoteCount, beat.onsetCount, formatPositions(beat.onsetPositions), beat.pattern, beat.diceCandidate].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }));
      const beat = analysis.beats[currentIndex];
      this.analysisDebug.textContent = `Track ${analysis.track.label} | Bar ${beat.measure} Beat ${beat.beat} | Tick ${Math.round(beat.startTick)} | ${Math.round(beat.tempo)} BPM | Notes ${beat.rawNoteCount} | Onsets ${beat.onsetCount} | ${formatPositions(beat.onsetPositions)} | ${beat.pattern} | Dice ${beat.diceCandidate}`;
    }
    analysisCopyMessage(message, error = false) {
      this.analysisCopyStatus.textContent = message;
      this.analysisCopyStatus.classList.toggle("analysis-copy-error", error);
    }
    chartVisible(visible) { this.diceChartPanel.hidden = !visible; }
    formatRhythmPositions(positions) { return positions.length ? positions.map((position) => position.toFixed(3).replace(/0$/, "")).join(", ") : "-"; }
    showChartBeatDetail(beat, trackLabel) {
      if (!beat) return;
      this.selectedChartBeatKey = `${beat.measure}:${beat.beat}`;
      this.chartMeasures.querySelectorAll(".chart-die").forEach((die) => die.classList.toggle("selected", die.dataset.key === this.selectedChartBeatKey));
      this.chartDetail.textContent = `Measure ${beat.measure} / Beat ${beat.beat} | Dice ${beat.dice === null ? (beat.pattern === "REST" ? "REST" : "?") : beat.dice} | ${beat.pattern} | Onsets ${beat.onsetCount} | Positions ${this.formatRhythmPositions(beat.onsetPositions)} | Notes ${beat.rawNoteCount} | Track ${trackLabel}${beat.reason ? ` | ${beat.reason}` : ""}`;
    }
    chartPreview(chart, currentTick = null) {
      if (!chart?.measures?.length) {
        this.chartMeasures.replaceChildren();
        this.chartDetail.textContent = "譜面候補がありません。";
        return;
      }
      const stats = chart.statistics;
      this.chartTrack.textContent = `Track: ${chart.sourceTrack.label}`;
      this.chartPlayableRate.textContent = `Playable ${stats.playableRate.toFixed(1)}%`;
      this.chartStatistics.replaceChildren(...[
        `Measures ${stats.measures}`, `Playable ${stats.supportedBeats}/${stats.totalBeats}`, `REST ${stats.rest}`,
        `1 ${stats.dice1}`, `2 ${stats.dice2}`, `4 ${stats.dice4}`, `3! ${stats.unsupportedDice3}`, `OTHER ${stats.unsupportedOther}`
      ].map((text) => {
        const item = document.createElement("span");
        item.textContent = text;
        return item;
      }));
      this.chartWarning.hidden = stats.unsupportedTimeSignature === 0;
      this.chartWarning.textContent = stats.unsupportedTimeSignature ? `UNSUPPORTED TIME SIGNATURE：${stats.unsupportedTimeSignature}拍（現在4/4のみゲーム譜面化対応）` : "";
      const currentBeat = currentTick === null ? null : chart.beats.find((beat) => currentTick >= beat.startTick && currentTick < beat.endTick);
      const currentMeasure = currentBeat?.measure ?? chart.measures[0].measure;
      let measureIndex = chart.measures.findIndex((measure) => measure.measure === currentMeasure);
      if (measureIndex < 0) measureIndex = 0;
      const start = Math.max(0, Math.min(measureIndex - 2, Math.max(0, chart.measures.length - 8)));
      const shown = chart.measures.slice(start, start + 8);
      const pipClasses = { 1: ["c"], 2: ["tr", "bl"], 4: ["tl", "tr", "bl", "br"] };
      this.chartMeasures.replaceChildren(...shown.map((measure) => {
        const group = document.createElement("section");
        group.className = `chart-measure${measure.measure === currentMeasure && currentTick !== null ? " current" : ""}${measure.supported ? "" : " unsupported"}`;
        const label = document.createElement("b");
        label.textContent = `Measure ${measure.measure} · ${measure.timeSignature.numerator}/${measure.timeSignature.denominator}${measure.supported ? "" : " · UNSUPPORTED"}`;
        const row = document.createElement("div");
        row.className = "chart-dice-row";
        measure.beats.forEach((beat) => {
          const die = document.createElement("button");
          die.type = "button";
          die.dataset.key = `${beat.measure}:${beat.beat}`;
          const kind = beat.pattern === "REST" ? "rest" : beat.supported ? `value-${beat.dice}` : beat.dice === 3 ? "triplet" : "other";
          die.className = `chart-die ${kind}${currentBeat?.index === beat.index ? " now" : ""}${die.dataset.key === this.selectedChartBeatKey ? " selected" : ""}`;
          die.setAttribute("aria-label", `Measure ${beat.measure} Beat ${beat.beat}, ${beat.pattern}`);
          if (beat.supported && pipClasses[beat.dice]) {
            pipClasses[beat.dice].forEach((position) => {
              const pip = document.createElement("i");
              pip.className = `pip ${position}`;
              die.append(pip);
            });
          } else {
            const mark = document.createElement("span");
            mark.textContent = beat.pattern === "REST" ? "□" : beat.dice === 3 ? "3!" : "?";
            die.append(mark);
          }
          die.addEventListener("click", () => this.showChartBeatDetail(beat, chart.sourceTrack.label));
          row.append(die);
        });
        group.append(label, row);
        return group;
      }));
      const selected = chart.beats.find((beat) => `${beat.measure}:${beat.beat}` === this.selectedChartBeatKey) || currentBeat || chart.beats[0];
      this.showChartBeatDetail(selected, chart.sourceTrack.label);
    }
    chartCopyMessage(message, error = false) {
      this.chartCopyStatus.textContent = message;
      this.chartCopyStatus.classList.toggle("chart-copy-error", error);
    }
    gameTracks(options) {
      this.gameTrack.replaceChildren(...options.map((item) => {
        const stats = item.chart.statistics;
        const option = document.createElement("option");
        option.value = item.value;
        const active = `${stats.activeBeatRate.toFixed(1)}%`;
        const playable = stats.playableActiveRate === null ? "N/A" : `${stats.playableActiveRate.toFixed(1)}%`;
        option.textContent = `${item.label}${item.recommended ? " ★ Recommended" : ""} — Active ${active} / Playable ${playable}${stats.silent ? " [SILENT]" : ""}`;
        return option;
      }));
      const selected = options.find((item) => item.recommended) || options.find((item) => item.value !== "all" && !item.chart.statistics.silent) || options.find((item) => item.value !== "all") || options[0];
      this.gameTrack.value = selected?.value || "all";
      return this.gameTrack.value;
    }
    gameTrackInfo(chart) {
      if (!chart) return;
      const stats = chart.statistics;
      this.gameTrackActive.textContent = `Active ${stats.activeBeatRate.toFixed(1)}% (${stats.activeBeats})`;
      this.gameTrackPlayable.textContent = `Playable ${stats.playableActiveRate === null ? "N/A" : `${stats.playableActiveRate.toFixed(1)}%`}`;
      this.gameTrackFallback.textContent = `Fallback ${stats.fallbackBeats}`;
      this.gameTrackWarning.textContent = stats.silent ? "このTrackは無音です。ゲーム向けではありません。" : chart.selection === "all" ? "ALL Trackは複雑な譜面になる可能性があります。" : !chart.compatible ? "現在4/4のTrackのみ実ゲームに対応しています。" : "";
    }
    debugVisible(visible) { this.debugDrawer.hidden = !visible; }
    playMetadata(fileName, trackName, visible) {
      this.midiPlayMeta.hidden = !visible;
      this.playingSong.textContent = fileName || "";
      this.playingTrack.textContent = trackName ? `GAME TRACK · ${trackName}` : "";
    }
    results(score, maxCombo, totals, songClear, fallbackBeats = 0) {
      this.finalScore.textContent = score;
      this.maxCombo.textContent = maxCombo;
      this.perfectTotal.textContent = totals.PERFECT;
      this.goodTotal.textContent = totals.GOOD;
      this.missTotal.textContent = totals.MISS;
      this.fallbackTotal.textContent = fallbackBeats;
      this.resultKicker.textContent = songClear ? "MIDI COMPLETE" : "RUN COMPLETE";
      this.resultTitle.textContent = songClear ? "SONG CLEAR" : "GAME OVER";
      this.resultTitle.classList.toggle("song-clear", songClear);
    }
  }

  class Game {
    constructor() {
      this.chartGenerator = new ChartGenerator();
      this.judge = new RhythmJudge();
      this.audio = new AudioManager();
      this.ui = new UIManager();
      this.midi = null;
      this.midiAnalysis = null;
      this.midiDiceChart = null;
      this.selectedGameTrack = "";
      this.activeGameChart = null;
      this.currentGameBeat = null;
      this.midiMeasureCursor = 0;
      this.analysisTrackValue = "all";
      this.analysisTick = null;
      try { this.midi = new window.MidiIntegration({ onEnded: () => this.onMidiEnded() }); }
      catch (error) { console.error("MIDI common layer failed to initialize", error); }
      this.mode = "normal";
      this.bpm = CONFIG.DEFAULT_BPM;
      this.currentTempo = this.bpm;
      this.stageIndex = 0;
      this.rows = [];
      this.column = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.lives = CONFIG.STARTING_LIVES;
      this.totals = { PERFECT: 0, GOOD: 0, MISS: 0 };
      this.taps = [];
      this.wrongInput = false;
      this.running = false;
      this.preparing = false;
      this.testMode = false;
      this.beatStart = 0;
      this.currentBeatDuration = 60000 / this.bpm;
      this.midiBeatIndex = -CONFIG.ROW_SIZE;
      this.frame = 0;
      this.beatTimer = 0;
      this.bind();
      this.previewChart();
      this.setPlayMode("normal");
      this.loadMidiLibrary();
    }
    get beatDuration() { return this.currentBeatDuration; }
    get currentValue() { return this.mode === "midi" && this.currentGameBeat ? (this.currentGameBeat.playDice ?? 0) : (this.rows[CONFIG.ACTIVE_ROW]?.[this.column] ?? 0); }
    clockNow() { return this.mode === "midi" && this.midi?.context ? this.midi.context.currentTime * 1000 : performance.now(); }
    bind() {
      document.querySelectorAll('input[name="playMode"]').forEach((input) => input.addEventListener("change", () => this.setPlayMode(input.value)));
      document.getElementById("midiFile").addEventListener("change", (event) => this.loadMidiFile(event.target.files?.[0]));
      document.getElementById("midiLibrary").addEventListener("change", (event) => this.loadLibraryMidi(event.target.value));
      this.ui.analysisTrack.addEventListener("change", (event) => this.selectAnalysisTrack(event.target.value));
      this.ui.copyAnalysisButton.addEventListener("click", () => this.copyAnalysis());
      this.ui.copyChartButton.addEventListener("click", () => this.copyChart());
      this.ui.gameTrack.addEventListener("change", (event) => this.selectGameTrack(event.target.value));
      this.ui.debugButton.addEventListener("click", () => this.ui.debugVisible(true));
      this.ui.closeDebugButton.addEventListener("click", () => this.ui.debugVisible(false));
      document.getElementById("bpmOptions").addEventListener("pointerdown", (event) => {
        const button = event.target.closest("button[data-bpm]");
        if (!button) return;
        event.preventDefault();
        this.bpm = Number(button.dataset.bpm);
        this.currentTempo = this.bpm;
        this.currentBeatDuration = 60000 / this.bpm;
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
    setPlayMode(mode) {
      this.mode = mode === "midi" ? "midi" : "normal";
      this.ui.mode(this.mode === "midi");
      if (this.mode !== "midi") {
        this.ui.analysisVisible(false);
        this.ui.chartVisible(false);
      }
      if (this.mode === "midi" && this.midi?.ready) this.ui.midiInfo(this.midi.getInfo());
      this.ui.bpmDisplay.textContent = this.mode === "midi" && this.midi?.ready ? `MIDI ♪ ${Math.round(this.midi.getInfo().bpm)} BPM` : `♪ = ${this.bpm} BPM`;
    }
    refreshMidiAnalysis() {
      if (!this.midi?.ready) return;
      this.analysisTrackValue = "all";
      this.analysisTick = null;
      this.midiAnalysis = this.midi.getRhythmAnalysis(this.analysisTrackValue);
      this.midiDiceChart = this.midi.getDiceChart(this.analysisTrackValue);
      this.ui.selectedChartBeatKey = null;
      this.ui.analysisTracks(this.midi.getAnalysisTracks(), this.analysisTrackValue);
      this.ui.analysisRows(this.midiAnalysis, this.analysisTick);
      this.ui.chartPreview(this.midiDiceChart, this.analysisTick);
      this.ui.analysisCopyMessage("");
      this.ui.chartCopyMessage("");
      const gameOptions = this.midi.getGameTrackOptions();
      this.selectedGameTrack = this.ui.gameTracks(gameOptions);
      this.selectGameTrack(this.selectedGameTrack);
    }
    selectGameTrack(selection) {
      this.selectedGameTrack = selection;
      this.ui.gameTrackInfo(this.midi?.getGameChart(selection));
    }
    selectAnalysisTrack(selection) {
      if (!this.midi?.ready) return;
      this.analysisTrackValue = selection;
      this.midiAnalysis = this.midi.getRhythmAnalysis(selection);
      this.midiDiceChart = this.midi.getDiceChart(selection);
      this.ui.selectedChartBeatKey = null;
      this.ui.analysisRows(this.midiAnalysis, this.analysisTick);
      this.ui.chartPreview(this.midiDiceChart, this.analysisTick);
      this.ui.analysisCopyMessage("");
      this.ui.chartCopyMessage("");
    }
    async copyAnalysis() {
      if (!this.midiAnalysis) {
        this.ui.analysisCopyMessage("解析結果がありません", true);
        return;
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard APIを利用できません。");
        await navigator.clipboard.writeText(JSON.stringify(this.midiAnalysis, null, 2));
        this.ui.analysisCopyMessage(`${this.midiAnalysis.beats.length}拍をコピーしました`);
      } catch (error) {
        console.error("Analysis copy failed", error);
        this.ui.analysisCopyMessage("コピーできませんでした", true);
      }
    }
    async copyChart() {
      if (!this.midiDiceChart) {
        this.ui.chartCopyMessage("譜面候補がありません", true);
        return;
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard APIを利用できません。");
        await navigator.clipboard.writeText(JSON.stringify(this.midiDiceChart, null, 2));
        this.ui.chartCopyMessage(`${this.midiDiceChart.measures.length}小節をコピーしました`);
      } catch (error) {
        console.error("Chart copy failed", error);
        this.ui.chartCopyMessage("コピーできませんでした", true);
      }
    }
    async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try { return await fetch(url, { ...options, signal: controller.signal }); }
      finally { window.clearTimeout(timer); }
    }
    async loadMidiLibrary() {
      if (!this.midi) {
        this.ui.midiMessage("MIDI共通基盤を読み込めませんでした。", "error");
        return;
      }
      this.ui.midiLibrary.disabled = true;
      this.ui.midiLibrary.replaceChildren(new Option("曲目リストを取得中…", ""));
      this.ui.libraryProgress(0, 0, "曲目リストを取得中");
      this.ui.midiMessage("assets/midi/library.json を読み込んでいます…");
      try {
        if (window.location.protocol === "file:") {
          const error = new Error("HTMLの直接起動では収録曲を読み込めません。ローカルHTTPサーバーから起動してください。");
          error.code = "FILE_PROTOCOL";
          throw error;
        }
        const response = await this.fetchWithTimeout("assets/midi/library.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`曲目リストの取得に失敗しました（HTTP ${response.status}）。`);
        const source = await response.json();
        if (!Array.isArray(source)) throw new Error("library.json の形式が正しくありません。");
        const entries = source.filter((entry) => typeof entry?.file === "string" && /^(?!.*\.\.)[^/\\]+\.(mid|midi)$/i.test(entry.file));
        if (!entries.length) throw new Error("library.json に有効なMIDI曲がありません。");

        const options = entries.map((entry) => {
          const option = document.createElement("option");
          option.value = entry.file;
          option.textContent = entry.title || entry.file.replace(/_/g, " ").replace(/\.midi?$/i, "");
          return option;
        });
        this.ui.midiLibrary.replaceChildren(...options);
        this.ui.midiMessage(`${entries.length}曲を検出しました。ファイルを確認しています…`);

        const available = [];
        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index];
          this.ui.libraryProgress(index, entries.length, `MIDIファイルを確認中：${entry.title || entry.file}`);
          await new Promise((resolve) => requestAnimationFrame(resolve));
          try {
            const check = await this.fetchWithTimeout(`assets/midi/${encodeURIComponent(entry.file)}`, { method: "HEAD", cache: "no-store" }, 6000);
            if (!check.ok) throw new Error(`HTTP ${check.status}`);
            available.push(entry);
          } catch (error) {
            console.warn(`MIDI asset check failed: ${entry.file}`, error);
            options[index].disabled = true;
            options[index].textContent += "（読込不可）";
          }
          this.ui.libraryProgress(index + 1, entries.length, `MIDIファイルを確認中：${index + 1}/${entries.length}`);
        }
        if (!available.length) throw new Error(`${entries.length}曲を確認しましたが、読み込めるMIDIファイルがありません。`);

        this.ui.midiLibrary.disabled = false;
        const initial = available.find((entry) => entry.file === "sample.mid") || available[0];
        this.ui.midiLibrary.value = initial.file;
        await this.loadLibraryMidi(initial.file);
        const failed = entries.length - available.length;
        this.ui.libraryProgress(available.length, entries.length, failed ? `確認完了：${failed}曲を読み込めません` : `確認完了：${available.length}曲を利用できます`, failed ? "warning" : "complete");
      } catch (error) {
        console.error("MIDI library load failed", error);
        const directOpen = error.code === "FILE_PROTOCOL";
        this.ui.midiLibrary.replaceChildren(new Option(directOpen ? "HTTPサーバーで起動してください" : "曲目を読み込めませんでした", ""));
        this.ui.midiLibrary.disabled = true;
        this.ui.libraryProgress(0, 0, directOpen ? "直接起動では読込不可" : "曲目リストの読込失敗", "error");
        this.ui.midiMessage(error.name === "AbortError" ? "曲目リストの読み込みがタイムアウトしました。" : error.message, "error");
      }
    }
    async loadLibraryMidi(fileName) {
      if (!fileName || !this.midi) return;
      if (!/^(?!.*\.\.)[^/\\]+\.(mid|midi)$/i.test(fileName)) {
        this.ui.midiMessage("選択されたMIDIファイル名が不正です。", "error");
        return;
      }
      this.ui.midiLibrary.disabled = true;
      this.ui.libraryProgress(0, 1, `MIDIを解析中：${fileName}`);
      this.ui.midiMessage(`${fileName} を読み込んでいます…`);
      try {
        const info = await this.midi.loadUrl(`assets/midi/${encodeURIComponent(fileName)}`, fileName);
        this.ui.midiInfo(info);
        this.refreshMidiAnalysis();
        this.ui.libraryProgress(1, 1, `${fileName} の読み込み完了`, "complete");
        if (this.mode === "midi") this.ui.bpmDisplay.textContent = `MIDI ♪ ${Math.round(info.bpm)} BPM`;
      } catch (error) {
        console.error("Library MIDI load failed", error);
        this.ui.libraryProgress(0, 1, `${fileName} の読み込み失敗`, "error");
        this.ui.midiMessage(`${fileName} を読み込めませんでした。${error.message ? ` ${error.message}` : ""}`, "error");
      } finally {
        this.ui.midiLibrary.disabled = false;
      }
    }
    async loadMidiFile(file) {
      if (!file || !this.midi) return;
      this.ui.midiLibrary.value = "";
      this.ui.libraryProgress(0, 1, `端末のMIDIを解析中：${file.name}`);
      this.ui.midiMessage(`${file.name} を読み込んでいます…`);
      try {
        const info = await this.midi.loadFile(file);
        this.ui.midiInfo(info);
        this.refreshMidiAnalysis();
        this.ui.libraryProgress(1, 1, `${file.name} の読み込み完了`, "complete");
        if (this.mode === "midi") this.ui.bpmDisplay.textContent = `MIDI ♪ ${Math.round(info.bpm)} BPM`;
      } catch (error) {
        console.error("MIDI file load failed", error);
        this.ui.libraryProgress(0, 1, `${file.name} の読み込み失敗`, "error");
        this.ui.midiMessage(error.message || "MIDIファイルを読み込めませんでした。", "error");
      }
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
    gameMeasureRow(index) {
      const beats = this.activeGameChart?.measures?.[index]?.beats || [];
      return Array.from({ length: CONFIG.ROW_SIZE }, (_, beatIndex) => beats[beatIndex]?.playDice ?? 0);
    }
    makeMidiOpeningRows() {
      const blank = () => Array(CONFIG.ROW_SIZE).fill(0);
      this.midiMeasureCursor = 3;
      return [blank(), blank(), this.gameMeasureRow(0), this.gameMeasureRow(1), this.gameMeasureRow(2)];
    }
    stopTiming() {
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      if (this.mode === "midi") this.midi?.stop();
    }
    openStageMenu() {
      this.stopTiming();
      this.running = false;
      this.preparing = false;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.gameOver.hidden = true;
      this.ui.pauseScreen.hidden = true;
      this.ui.readyOverlay.hidden = true;
      this.ui.startScreen.hidden = false;
      this.ui.analysisVisible(false);
      this.ui.chartVisible(false);
      this.ui.debugVisible(false);
      this.ui.debugButton.hidden = true;
      this.ui.playMetadata("", "", false);
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
      this.mode = document.querySelector('input[name="playMode"]:checked')?.value === "midi" ? "midi" : "normal";
      if (this.mode === "midi" && !this.midi?.ready) {
        this.ui.midiMessage("MIDIファイルを読み込んでからSTARTしてください。", "error");
        return;
      }
      if (this.mode === "midi") {
        const selectedChart = this.midi.getGameChart(this.selectedGameTrack);
        if (!selectedChart?.compatible) {
          this.ui.midiMessage("選択したGAME TRACKは現在4/4の実ゲームに対応していません。", "error");
          return;
        }
        this.activeGameChart = selectedChart;
      } else this.activeGameChart = null;
      this.stopTiming();
      try {
        const sharedContext = this.mode === "midi" ? await this.midi.ensureAudio() : null;
        await this.audio.unlock(sharedContext);
      } catch (error) {
        console.error("AudioContext start failed", error);
        this.ui.midiMessage("音声を開始できませんでした。もう一度STARTしてください。", "error");
        return;
      }
      this.testMode = document.getElementById("testMode").checked;
      this.column = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.lives = CONFIG.STARTING_LIVES;
      this.totals = { PERFECT: 0, GOOD: 0, MISS: 0 };
      this.running = false;
      this.midiBeatIndex = -CONFIG.ROW_SIZE;
      this.currentTempo = this.mode === "midi" ? this.midi.getInfo().bpm : this.bpm;
      this.currentBeatDuration = 60000 / this.currentTempo;
      this.currentGameBeat = null;
      this.rows = this.mode === "midi" ? this.makeMidiOpeningRows() : this.makeOpeningRows();
      this.ui.renderChart(this.rows, -1);
      this.ui.stats(this.score, this.combo, this.lives, this.testMode);
      this.ui.bpmDisplay.textContent = this.mode === "midi" ? `MIDI ♪ ${Math.round(this.currentTempo)} BPM` : `♪ = ${this.bpm} BPM`;
      this.ui.currentStage.textContent = `L${this.stageIndex + 1}`;
      this.ui.testPanel.hidden = !this.testMode;
      this.ui.analysisVisible(this.testMode && this.mode === "midi");
      this.ui.chartVisible(this.testMode && this.mode === "midi");
      this.ui.debugButton.hidden = !(this.testMode && this.mode === "midi");
      this.ui.debugVisible(false);
      this.ui.playMetadata(this.midi?.getInfo()?.fileName, this.activeGameChart?.sourceTrack?.label, this.mode === "midi");
      if (this.testMode && this.mode === "midi" && this.midiAnalysis) {
        this.ui.analysisRows(this.midiAnalysis, null);
        this.ui.chartPreview(this.midiDiceChart, null);
      }
      this.ui.startScreen.hidden = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.applyBeatCss();
      this.showReady(false);
    }
    applyBeatCss() {
      document.documentElement.style.setProperty("--beat-duration", `${this.beatDuration}ms`);
      document.documentElement.style.setProperty("--row-shift-duration", `${Math.max(100, Math.min(180, this.beatDuration * 0.28))}ms`);
    }
    showReady(resuming) {
      this.preparing = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.progress(0);
      this.ui.beatNumber.textContent = "READY";
      this.ui.judgement.className = "judgement";
      this.ui.judgement.textContent = "";
      this.ui.readyOverlay.hidden = false;
      this.beatTimer = window.setTimeout(async () => {
        try {
          this.ui.readyOverlay.hidden = true;
          this.preparing = false;
          this.running = true;
          if (this.mode === "midi") {
            const timing = resuming ? await this.midi.resume() : await this.midi.startWithCountIn(CONFIG.ROW_SIZE);
            this.midiBeatIndex = timing.beatIndex;
            this.beginMidiBeat(timing);
          } else {
            this.currentTempo = this.bpm;
            this.beginBeat(performance.now(), 60000 / this.bpm);
          }
        } catch (error) {
          console.error("Game start failed", error);
          this.running = false;
          this.ui.startScreen.hidden = false;
          this.ui.analysisVisible(false);
          this.ui.chartVisible(false);
          this.ui.midiMessage(error.message || "ゲームを開始できませんでした。", "error");
        }
      }, 1000);
    }
    beginMidiBeat(timing = this.midi.getBeatTiming(this.midiBeatIndex)) {
      this.currentGameBeat = timing.countIn ? null : window.MidiGameChart.beatAtTick(this.activeGameChart, timing.tick);
      this.currentTempo = timing.bpm;
      this.ui.bpmDisplay.textContent = `MIDI ♪ ${Math.round(timing.bpm)} BPM`;
      if (this.testMode && this.midiAnalysis) {
        this.analysisTick = timing.countIn ? null : timing.tick;
        this.ui.analysisRows(this.midiAnalysis, this.analysisTick);
        this.ui.chartPreview(this.midiDiceChart, this.analysisTick);
      }
      this.beginBeat(timing.startAudioTime * 1000, timing.duration * 1000);
    }
    beginBeat(startTime, duration) {
      if (!this.running) return;
      this.taps = [];
      this.wrongInput = false;
      this.beatStart = startTime;
      this.currentBeatDuration = duration;
      this.applyBeatCss();
      const value = this.currentValue;
      this.ui.setActive(this.column, value === 0);
      this.ui.progress(0);
      const restInputWindow = this.mode === "midi" && Boolean(this.currentGameBeat?.isRest);
      this.ui.enableControls(value !== 0 || restInputWindow);
      this.ui.targetGuide(value, this.testMode && value !== 0);
      this.ui.beatSourceMarker(this.currentGameBeat, this.testMode);
      this.updateGuide(Math.max(0, this.clockNow() - this.beatStart));
      this.audio.metronome(this.column === 0);
      this.updateFrame();
      const delay = Math.max(0, this.beatStart + this.beatDuration - this.clockNow());
      this.beatTimer = window.setTimeout(() => this.finishBeat(), delay);
    }
    onTap(event, value) {
      event.preventDefault();
      const restBeat = this.mode === "midi" && Boolean(this.currentGameBeat?.isRest);
      if (!this.running || (this.currentValue === 0 && !restBeat)) return;
      const button = event.currentTarget;
      button.classList.remove("pressed");
      void button.offsetWidth;
      button.classList.add("pressed");
      this.ui.hitGuide(button);
      window.setTimeout(() => button.classList.remove("pressed"), 72);
      this.audio.tap(value);
      const elapsed = this.clockNow() - this.beatStart;
      if (elapsed < 0 || elapsed > this.beatDuration) return;
      if (restBeat) {
        this.taps.push(elapsed);
        this.wrongInput = true;
        this.updateTest(elapsed);
        return;
      }
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
      if (value !== 0) {
        const result = this.judge.judge(value, this.taps, this.wrongInput);
        this.totals[result.grade] += 1;
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
        if (this.lives <= 0 && !this.testMode) { this.end(false); return; }
      } else if (this.mode === "midi" && this.currentGameBeat?.isRest) {
        const restResult = window.MidiGameChart.judgeRest(this.taps.length);
        if (restResult.miss) {
          this.totals.MISS += 1;
          this.combo = 0;
          if (!this.testMode) this.lives -= 1;
          this.audio.result("MISS");
          this.ui.verdict("MISS");
        } else this.ui.judgement.textContent = "";
        this.ui.stats(this.score, this.combo, this.lives, this.testMode);
        if (this.lives <= 0 && !this.testMode) { this.end(false); return; }
      } else this.ui.judgement.textContent = "";
      this.advanceChart();
      if (this.mode === "midi") {
        this.midiBeatIndex += 1;
        this.beginMidiBeat();
      } else this.beginBeat(this.beatStart + this.beatDuration, 60000 / this.bpm);
    }
    advanceChart() {
      if (this.column < CONFIG.ROW_SIZE - 1) this.column += 1;
      else {
        const nextRow = this.mode === "midi" ? this.gameMeasureRow(this.midiMeasureCursor++) : this.chartGenerator.nextRow(STAGES[this.stageIndex]);
        this.rows = [...this.rows.slice(1), nextRow];
        this.column = 0;
        this.ui.scrollChart(this.rows, this.column, nextRow[0] === 0);
      }
    }
    updateFrame() {
      if (!this.running) return;
      const elapsed = this.clockNow() - this.beatStart;
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
      if (this.testMode) this.ui.test({ bpm: this.currentTempo, cell: this.column, taps: this.taps.length, required: this.currentValue, elapsed: Math.min(Math.max(0, elapsed), this.beatDuration), duration: this.beatDuration });
    }
    pause() {
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      if (this.mode === "midi") this.midi?.pause();
      this.running = false;
      this.preparing = false;
      this.ui.readyOverlay.hidden = true;
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.pauseScreen.hidden = false;
    }
    async resume() {
      try {
        const sharedContext = this.mode === "midi" ? await this.midi.ensureAudio() : null;
        await this.audio.unlock(sharedContext);
      } catch (error) {
        console.error("Audio resume failed", error);
        return;
      }
      this.ui.pauseScreen.hidden = true;
      this.showReady(true);
    }
    onMidiEnded() {
      if (this.mode === "midi" && this.running) this.end(true);
    }
    end(songClear = false) {
      this.running = false;
      clearTimeout(this.beatTimer);
      cancelAnimationFrame(this.frame);
      if (this.mode === "midi") this.midi?.stop();
      this.ui.enableControls(false);
      this.ui.targetGuide(0, false);
      this.ui.results(this.score, this.bestCombo, this.totals, songClear, this.activeGameChart?.statistics?.fallbackBeats || 0);
      this.ui.gameOver.hidden = false;
      this.ui.debugVisible(false);
      this.ui.debugButton.hidden = true;
      this.ui.analysisVisible(false);
      this.ui.chartVisible(false);
    }
  }
  new Game();
})();
