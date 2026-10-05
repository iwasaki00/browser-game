(function () {
  "use strict";

  const Core = window.MinesweeperCore;
  const AudioEngine = window.MinesweeperAudio;
  const INSTRUMENTS = ["KICK", "SNARE", "CHH", "OHH", "TOM", "BASS", "SYN", "FX"];
  const LONG_PRESS_MS = 520;
  const SCHEDULE_AHEAD = 0.12;
  const LOOKAHEAD_MS = 25;
  const debugMode = new URLSearchParams(location.search).get("debug") === "1";

  const boardElement = document.querySelector("#board");
  const statusElement = document.querySelector("#gameStatus");
  const missElement = document.querySelector("#missCount");
  const tempoReadout = document.querySelector("#tempoReadout");
  const stepReadout = document.querySelector("#stepReadout");
  const playButton = document.querySelector("#playButton");
  const stopButton = document.querySelector("#stopButton");
  const newGameButton = document.querySelector("#newGameButton");
  const overlayNewGame = document.querySelector("#overlayNewGame");
  const closeResultButton = document.querySelector("#closeResult");
  const resultOverlay = document.querySelector("#resultOverlay");
  const resultKicker = document.querySelector("#resultKicker");
  const resultTitle = document.querySelector("#resultTitle");
  const resultMessage = document.querySelector("#resultMessage");
  const debugPanel = document.querySelector("#debugPanel");
  const debugState = document.querySelector("#debugState");
  const completionBanner = document.querySelector("#completionBanner");
  const completionTitle = document.querySelector("#completionTitle");
  const completionProgress = document.querySelector("#completionProgress");
  const forceClearButton = document.querySelector("#forceClearButton");
  const forcePerfectButton = document.querySelector("#forcePerfectButton");

  let game = Core.createGame();
  let schedulerId = 0;
  let nextNoteTime = 0;
  let nextStepToSchedule = 0;
  let visualTimers = [];
  let completionStopTimer = 0;
  let glitchVisualTimer = 0;
  let pressTimer = 0;
  let pressedCell = null;
  let pressStart = null;
  let longPressTriggered = false;

  function buildBoard() {
    boardElement.replaceChildren();
    const corner = document.createElement("span");
    corner.className = "grid-corner";
    corner.textContent = "TRACK";
    boardElement.append(corner);

    for (let column = 0; column < game.columns; column += 1) {
      const header = document.createElement("span");
      header.className = "step-label";
      header.dataset.column = String(column);
      header.innerHTML = `<small>STEP</small>${column + 1}`;
      boardElement.append(header);
    }

    game.board.forEach((row, rowIndex) => {
      const label = document.createElement("span");
      label.className = "instrument-label";
      label.innerHTML = `<i aria-hidden="true"></i>${INSTRUMENTS[rowIndex]}`;
      boardElement.append(label);

      row.forEach((cell) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.row = String(cell.row);
        button.dataset.column = String(cell.column);
        button.setAttribute("role", "gridcell");
        boardElement.append(button);
      });
    });
  }

  function cellDescription(cell) {
    const position = `${cell.row + 1}行${cell.column + 1}列`;
    if (cell.isFlagged) return `${position}、フラグ`;
    if (!cell.isOpen) return `${position}、未開封`;
    if (cell.isMine) return `${position}、地雷`;
    return `${position}、周囲の地雷${cell.adjacentMines}`;
  }

  function renderCell(cell) {
    const element = boardElement.querySelector(`.cell[data-row="${cell.row}"][data-column="${cell.column}"]`);
    element.className = "cell";
    element.textContent = "";
    element.removeAttribute("data-number");
    if (cell.isOpen) element.classList.add("open");
    if (cell.isFlagged) {
      element.classList.add("flagged");
      if (cell.mineAccentEnabled) element.classList.add("mine-accent");
      element.textContent = "⚑";
    } else if (cell.isOpen && cell.isMine) {
      element.classList.add("mine");
      element.textContent = "✹";
    } else if (cell.isOpen && cell.adjacentMines > 0) {
      element.dataset.number = String(cell.adjacentMines);
      element.textContent = String(cell.adjacentMines);
    }
    if (debugMode) {
      element.dataset.debug = `${cell.row},${cell.column} · ${cell.adjacentMines}\n${cell.isNote ? "N" : "–"}${cell.mineAccentEnabled ? " A" : ""} · ${cell.velocity.toFixed(2)}`;
      if (cell.isMine && !cell.isOpen) element.classList.add("debug-mine");
    }
    element.setAttribute("aria-label", cellDescription(cell));
    element.disabled = game.gameState === "gameover" || game.gameState === "clear";
  }

  function renderPlayhead() {
    boardElement.querySelectorAll(".is-current").forEach((element) => element.classList.remove("is-current"));
    if (!game.isPlaying) return;
    boardElement.querySelectorAll(`[data-column="${game.currentStep}"]`).forEach((element) => {
      element.classList.add("is-current");
    });
  }

  function render() {
    game.board.flat().forEach(renderCell);
    missElement.textContent = `${game.missCount} / ${game.maxMisses}`;
    tempoReadout.textContent = `BPM ${game.bpm} / ${game.tempoCategory}`;
    stepReadout.textContent = `STEP ${game.currentStep + 1}`;
    const labels = { ready: "READY", playing: "DIGGING", clear: "CLEAR", gameover: "GAME OVER" };
    statusElement.textContent = game.completionMode ? "COMPLETE" : labels[game.gameState];
    statusElement.dataset.state = game.gameState;
    playButton.classList.toggle("active", game.isPlaying);
    playButton.setAttribute("aria-pressed", String(game.isPlaying));
    renderPlayhead();
    if (debugMode) {
      Core.refreshGlitch(game);
      debugState.textContent = [
        `state=${game.gameState}`,
        `step=${game.currentStep + 1}`,
        `playing=${game.isPlaying}`,
        `tempo=${game.bpm}/${game.tempoCategory}`,
        `accents=${Core.getCorrectFlagCount(game)}`,
        `glitch=${game.glitchState.active}`,
        `completion=${game.completionMode} ${game.completionLoopCount}/${game.completionLoopTarget}`,
        `perfect=${game.isPerfect}`
      ].join(" / ");
    }
  }

  function updateCompletionBanner(finished = false) {
    if (game.gameState !== "clear") {
      completionBanner.hidden = true;
      return;
    }
    completionBanner.hidden = false;
    completionBanner.classList.toggle("perfect", game.isPerfect);
    completionTitle.textContent = game.isPerfect ? "PERFECT SWEEP" : "COMPLETE SEQUENCE";
    completionProgress.textContent = finished
      ? "PLAY TO REPEAT"
      : `LOOP ${Math.min(game.completionLoopCount + 1, game.completionLoopTarget)} / ${game.completionLoopTarget}`;
  }

  function showResult(type) {
    const isClear = type === "clear";
    resultOverlay.classList.toggle("gameover", !isClear);
    resultKicker.textContent = isClear ? "SEQUENCE COMPLETE" : "SIGNAL LOST";
    resultTitle.textContent = isClear ? "CLEAR" : "GAME OVER";
    resultMessage.textContent = isClear
      ? "完成した盤面は、このままPLAYできます。"
      : "MISSが3回に到達しました。新しい盤面へ進みましょう。";
    closeResultButton.hidden = !isClear;
    resultOverlay.hidden = false;
  }

  function hideResult() {
    resultOverlay.hidden = true;
  }

  async function wakeAudio() {
    try { return await AudioEngine.resume(); } catch (_) { return null; }
  }

  async function openSelectedCell(row, column) {
    await wakeAudio();
    const result = Core.openCell(game, row, column);
    if (result.type === "ignored") return;
    render();
    const now = AudioEngine.currentTime();
    if (result.type === "safe") {
      result.opened.filter((cell) => cell.isNote).forEach((cell, index) => {
        AudioEngine.playCellNote(cell, now + Math.min(index, 7) * 0.018, { preview: true });
      });
      if (result.cleared) startCompletionSequence();
    } else if (result.type === "mine") {
      if (result.gameOver) stopSequence();
      AudioEngine.playMissEffect(AudioEngine.currentTime());
      document.body.classList.add("glitching");
      window.clearTimeout(glitchVisualTimer);
      glitchVisualTimer = window.setTimeout(() => document.body.classList.remove("glitching"), Core.GLITCH_DURATION_MS);
      if (result.gameOver) showResult("gameover");
    }
  }

  async function flagSelectedCell(row, column) {
    await wakeAudio();
    Core.toggleFlag(game, row, column);
    const cell = game.board[row][column];
    if (cell.mineAccentEnabled) {
      AudioEngine.playMineAccent(cell.row, AudioEngine.currentTime(), { preview: true });
    }
    render();
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function positionFromElement(element) {
    return { row: Number(element.dataset.row), column: Number(element.dataset.column) };
  }

  function clearPress() {
    clearTimeout(pressTimer);
    pressTimer = 0;
    if (pressedCell) pressedCell.classList.remove("pressing");
  }

  boardElement.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || cell.disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    clearPress();
    pressedCell = cell;
    pressStart = { x: event.clientX, y: event.clientY };
    longPressTriggered = false;
    cell.classList.add("pressing");
    pressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      const position = positionFromElement(cell);
      flagSelectedCell(position.row, position.column);
      clearPress();
    }, LONG_PRESS_MS);
  });

  boardElement.addEventListener("pointermove", (event) => {
    if (!pressedCell || !pressStart) return;
    if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 12) {
      clearPress();
      pressedCell = null;
      pressStart = null;
    }
  });

  boardElement.addEventListener("pointerup", (event) => {
    const cell = event.target.closest(".cell");
    const shouldOpen = cell && cell === pressedCell && !longPressTriggered && event.button === 0;
    clearPress();
    pressedCell = null;
    pressStart = null;
    if (shouldOpen) {
      const position = positionFromElement(cell);
      openSelectedCell(position.row, position.column);
    }
  });

  boardElement.addEventListener("pointercancel", () => {
    clearPress();
    pressedCell = null;
    pressStart = null;
  });

  boardElement.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    event.preventDefault();
    const position = positionFromElement(cell);
    flagSelectedCell(position.row, position.column);
  });

  function scheduleStep(step, time) {
    const glitch = Core.refreshGlitch(game);
    Core.getNotesAtStep(game, step).forEach((cell) => {
      AudioEngine.playCellNote(cell, time, { glitch });
    });
    Core.getMineAccentsAtStep(game, step).forEach((cell) => {
      AudioEngine.playMineAccent(cell.row, time);
    });
    if (glitch) AudioEngine.playGlitchTick(time);
    const delay = Math.max(0, (time - AudioEngine.currentTime()) * 1000);
    visualTimers.push(window.setTimeout(() => {
      if (!game.isPlaying) return;
      game.currentStep = step;
      stepReadout.textContent = `STEP ${step + 1}`;
      renderPlayhead();
      if (game.completionMode && step === game.columns - 1) {
        const completed = Core.recordCompletionLoop(game);
        updateCompletionBanner(completed);
        if (completed) {
          const tail = ((60 / game.bpm) / 2) * 850;
          completionStopTimer = window.setTimeout(() => {
            stopSequence();
            updateCompletionBanner(true);
          }, tail);
        }
      }
    }, delay));
  }

  function schedulerTick() {
    const secondsPerStep = (60 / game.bpm) / 2;
    while (nextNoteTime < AudioEngine.currentTime() + SCHEDULE_AHEAD) {
      scheduleStep(nextStepToSchedule, nextNoteTime);
      nextStepToSchedule = Core.nextStep(nextStepToSchedule, game.columns);
      nextNoteTime += secondsPerStep;
    }
  }

  async function startSequence(options = {}) {
    if (game.gameState === "gameover" || game.isPlaying) return;
    const context = await AudioEngine.resume();
    if (!context) return;
    game.isPlaying = true;
    game.currentStep = 0;
    nextStepToSchedule = 0;
    nextNoteTime = AudioEngine.currentTime() + (options.delay == null ? 0.06 : options.delay);
    schedulerTick();
    schedulerId = window.setInterval(schedulerTick, LOOKAHEAD_MS);
    render();
  }

  function stopSequence() {
    window.clearInterval(schedulerId);
    schedulerId = 0;
    window.clearTimeout(completionStopTimer);
    completionStopTimer = 0;
    visualTimers.forEach(window.clearTimeout);
    visualTimers = [];
    AudioEngine.stopAll();
    game.isPlaying = false;
    game.currentStep = 0;
    render();
  }

  async function startCompletionSequence() {
    stopSequence();
    Core.beginCompletion(game);
    updateCompletionBanner();
    render();
    const context = await wakeAudio();
    if (!context) return;
    AudioEngine.playClearEffect(game.isPerfect, AudioEngine.currentTime());
    await startSequence({ delay: 0.42 });
  }

  function newGame() {
    stopSequence();
    game = Core.newGame();
    hideResult();
    completionBanner.hidden = true;
    document.body.classList.remove("glitching");
    window.clearTimeout(glitchVisualTimer);
    buildBoard();
    render();
  }

  function forceCompletion(perfect) {
    stopSequence();
    if (!game.minesPlaced) Core.placeMines(game, 0, 0);
    game.board.flat().forEach((cell) => {
      if (cell.isMine) {
        cell.isFlagged = perfect;
        cell.mineAccentEnabled = perfect;
      } else {
        cell.isFlagged = false;
        cell.isOpen = true;
        Core.updateNote(cell);
      }
    });
    Core.checkClear(game);
    render();
    startCompletionSequence();
  }

  playButton.addEventListener("click", startSequence);
  stopButton.addEventListener("click", () => {
    game.completionMode = false;
    stopSequence();
    updateCompletionBanner(true);
  });
  newGameButton.addEventListener("click", newGame);
  overlayNewGame.addEventListener("click", newGame);
  closeResultButton.addEventListener("click", hideResult);
  forceClearButton.addEventListener("click", () => forceCompletion(false));
  forcePerfectButton.addEventListener("click", () => forceCompletion(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden && game.isPlaying) stopSequence(); });

  if (debugMode) {
    document.body.classList.add("debug-mode");
    debugPanel.hidden = false;
  }
  if (!AudioEngine.isAvailable()) document.querySelector("#audioNotice").hidden = false;
  buildBoard();
  render();
})();
