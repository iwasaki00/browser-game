(function () {
  "use strict";

  const Core = window.MinesweeperCore;
  const AudioEngine = window.MinesweeperAudio;
  const Settings = window.MinesweeperSettings;
  const Input = window.MinesweeperInput;
  const INSTRUMENTS = ["KICK", "SNARE", "CHH", "OHH", "TOM", "BASS", "SYN", "FX", "CLAP", "PERC", "SUB", "PLUCK"];
  const LONG_PRESS_MS = 520;
  const LONG_PRESS_MOVE_PX = 10;
  const DOUBLE_TAP_MS = 230;
  const FOLLOW_RESUME_MS = 1100;
  const SCHEDULE_AHEAD = 0.12;
  const LOOKAHEAD_MS = 25;
  const debugMode = new URLSearchParams(location.search).get("debug") === "1";

  const boardElement = document.querySelector("#board");
  const boardWrap = document.querySelector("#boardWrap");
  const boardSummary = document.querySelector("#boardSummary");
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
  const testOpenButton = document.querySelector("#testOpenButton");
  const testFlagButton = document.querySelector("#testFlagButton");
  const testChordButton = document.querySelector("#testChordButton");
  const testMissButton = document.querySelector("#testMissButton");
  const quickTouchMode = document.querySelector("#quickTouchMode");
  const switchControls = document.querySelector("#switchControls");
  const twoHandControls = document.querySelector("#twoHandControls");
  const touchHint = document.querySelector("#touchHint");
  const settingsButton = document.querySelector("#settingsButton");
  const settingsDialog = document.querySelector("#settingsDialog");
  const settingsForm = document.querySelector("#settingsForm");
  const settingsClose = document.querySelector("#settingsClose");
  const settingsCancel = document.querySelector("#settingsCancel");
  const settingPreset = document.querySelector("#settingPreset");
  const settingRows = document.querySelector("#settingRows");
  const settingSteps = document.querySelector("#settingSteps");
  const settingDifficulty = document.querySelector("#settingDifficulty");
  const settingMines = document.querySelector("#settingMines");
  const settingDensity = document.querySelector("#settingDensity");
  const settingRandomBpm = document.querySelector("#settingRandomBpm");
  const settingFixedBpm = document.querySelector("#settingFixedBpm");
  const settingCurrentTempo = document.querySelector("#settingCurrentTempo");
  const settingTouchMode = document.querySelector("#settingTouchMode");
  const settingBoardView = document.querySelector("#settingBoardView");
  const settingFollowPlayhead = document.querySelector("#settingFollowPlayhead");
  const settingsValidation = document.querySelector("#settingsValidation");

  let settings = Settings.loadSettings();
  let game = Core.createGame(Settings.toGameOptions(settings));
  let schedulerId = 0;
  let nextNoteTime = 0;
  let nextStepToSchedule = 0;
  let visualTimers = [];
  let completionStopTimer = 0;
  let glitchVisualTimer = 0;
  let pressTimer = 0;
  let pressedCell = null;
  let longPressTriggered = false;
  let pointerContext = null;
  let doubleTapTimer = 0;
  let pendingDoubleCell = null;
  let switchAction = "OPEN";
  let modifierAction = null;
  let userScrollUntil = 0;
  let followSuspended = false;

  function buildBoard() {
    boardElement.replaceChildren();
    boardElement.style.setProperty("--steps", game.columns);
    boardElement.setAttribute("aria-label", `${game.rows}行${game.columns}列のマインスイーパ盤面`);
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

  function followCurrentStep() {
    if (!settings.followPlayhead || settings.boardView !== "SCROLL" || followSuspended ||
        performance.now() < userScrollUntil) return;
    const header = boardElement.querySelector(`.step-label[data-column="${game.currentStep}"]`);
    if (!header) return;
    const viewport = boardWrap.getBoundingClientRect();
    const target = header.getBoundingClientRect();
    const margin = 14;
    if (target.left < viewport.left + margin || target.right > viewport.right - margin) {
      const offset = target.left - viewport.left - viewport.width / 2 + target.width / 2;
      boardWrap.scrollBy({ left: offset, behavior: "smooth" });
    }
  }

  function applyBoardPresentation() {
    boardWrap.classList.remove("view-fit", "view-scroll", "view-compact");
    boardWrap.classList.add(`view-${settings.boardView.toLowerCase()}`);
    boardSummary.textContent = `${game.rows} × ${game.columns} / ${game.mineCount} MINES`;
  }

  function updateTouchControls() {
    quickTouchMode.value = settings.touchMode;
    switchControls.hidden = settings.touchMode !== "SWITCH";
    twoHandControls.hidden = settings.touchMode !== "TWO HAND";
    const hints = {
      STANDARD: "TAP OPEN · LONG PRESS FLAG",
      SWITCH: `${switchAction} MODE · TAP CELL`,
      "TWO HAND": "HOLD A MODE + TAP CELL",
      "DOUBLE TAP": "SINGLE OPEN · DOUBLE FLAG"
    };
    touchHint.textContent = hints[settings.touchMode];
    switchControls.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.switchAction === switchAction);
    });
    twoHandControls.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.modifier === modifierAction);
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
    applyBoardPresentation();
    updateTouchControls();
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
        ,`board=${game.rows}x${game.columns}/${game.mineCount} (${(Settings.mineDensity(settings) * 100).toFixed(1)}%)`
        ,`preset=${settings.preset}/${settings.difficulty}`
        ,`touch=${settings.touchMode}/view=${settings.boardView}/follow=${settings.followPlayhead}`
        ,`pointer=${Boolean(pointerContext)}/longPress=${Boolean(pressTimer)}/followSuspended=${followSuspended}`
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
    const target = game.board[row] && game.board[row][column];
    const isChord = target && target.isOpen && !target.isMine && target.adjacentMines > 0;
    const result = isChord
      ? Core.chordOpen(game, row, column)
      : Core.openCell(game, row, column);
    if (result.type === "ignored") return;
    render();
    const now = AudioEngine.currentTime();
    if (result.type === "safe" || result.type === "chord") {
      result.opened.filter((cell) => cell.isNote).forEach((cell, index) => {
        AudioEngine.playCellNote(cell, now + index * (isChord ? 0.032 : 0.018), { preview: true });
      });
      if (result.cleared) startCompletionSequence();
    }
    if (result.type === "mine" || result.minesHit > 0) {
      if (result.gameOver) stopSequence();
      AudioEngine.playMissEffect(AudioEngine.currentTime());
      document.body.classList.add("glitching");
      window.clearTimeout(glitchVisualTimer);
      glitchVisualTimer = window.setTimeout(() => document.body.classList.remove("glitching"), Core.GLITCH_DURATION_MS);
      if (result.gameOver) showResult("gameover");
    }
  }

  async function flagSelectedCell(row, column, desiredState) {
    await wakeAudio();
    if (typeof desiredState === "boolean") Core.setFlag(game, row, column, desiredState);
    else Core.toggleFlag(game, row, column);
    const cell = game.board[row][column];
    if (cell.mineAccentEnabled) {
      AudioEngine.playMineAccent(cell.row, AudioEngine.currentTime(), { preview: true });
    }
    render();
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function performAction(action, row, column) {
    switch (action) {
      case Input.ACTIONS.OPEN:
        openSelectedCell(row, column);
        break;
      case Input.ACTIONS.TOGGLE_FLAG:
        flagSelectedCell(row, column);
        break;
      default:
        break;
    }
  }

  function positionFromElement(element) {
    return { row: Number(element.dataset.row), column: Number(element.dataset.column) };
  }

  function clearPress() {
    clearTimeout(pressTimer);
    pressTimer = 0;
    if (pressedCell) pressedCell.classList.remove("pressing");
  }

  function resetInputState() {
    clearPress();
    window.clearTimeout(doubleTapTimer);
    doubleTapTimer = 0;
    pendingDoubleCell = null;
    pressedCell = null;
    pointerContext = null;
    longPressTriggered = false;
    modifierAction = null;
    followSuspended = false;
    userScrollUntil = performance.now() + FOLLOW_RESUME_MS;
    updateTouchControls();
  }

  function handleDoubleTap(row, column) {
    if (doubleTapTimer && pendingDoubleCell &&
        pendingDoubleCell.row === row && pendingDoubleCell.column === column) {
      window.clearTimeout(doubleTapTimer);
      doubleTapTimer = 0;
      pendingDoubleCell = null;
      performAction(Input.doubleTapAction(settings.touchMode), row, column);
      return;
    }
    if (doubleTapTimer && pendingDoubleCell) {
      window.clearTimeout(doubleTapTimer);
      performAction(Input.ACTIONS.OPEN, pendingDoubleCell.row, pendingDoubleCell.column);
    }
    pendingDoubleCell = { row, column };
    doubleTapTimer = window.setTimeout(() => {
      const pending = pendingDoubleCell;
      doubleTapTimer = 0;
      pendingDoubleCell = null;
      if (pending) performAction(Input.ACTIONS.OPEN, pending.row, pending.column);
    }, DOUBLE_TAP_MS);
  }

  boardElement.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell || cell.disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    clearPress();
    pressedCell = cell;
    followSuspended = true;
    pointerContext = {
      cell,
      row: Number(cell.dataset.row),
      column: Number(cell.dataset.column),
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType || "mouse",
      moved: false
    };
    longPressTriggered = false;
    cell.classList.add("pressing");
    if (pointerContext.pointerType !== "mouse" &&
        Input.longPressAction(settings.touchMode) !== Input.ACTIONS.NONE) {
      pressTimer = window.setTimeout(() => {
        longPressTriggered = true;
        performAction(Input.longPressAction(settings.touchMode), pointerContext.row, pointerContext.column);
        clearPress();
      }, LONG_PRESS_MS);
    }
  });

  boardElement.addEventListener("pointermove", (event) => {
    if (!pointerContext) return;
    const distance = Math.hypot(event.clientX - pointerContext.startX, event.clientY - pointerContext.startY);
    if (distance > LONG_PRESS_MOVE_PX) {
      pointerContext.moved = true;
      clearPress();
    }
  });

  boardElement.addEventListener("pointerup", (event) => {
    const context = pointerContext;
    clearPress();
    pressedCell = null;
    pointerContext = null;
    followSuspended = false;
    userScrollUntil = performance.now() + FOLLOW_RESUME_MS;
    if (!context || longPressTriggered || event.button !== 0) return;
    if (context.pointerType === "mouse") {
      if (!context.moved) performAction(Input.ACTIONS.OPEN, context.row, context.column);
      return;
    }
    if (context.moved) return;
    const action = Input.tapAction(settings.touchMode, {
      pointerType: context.pointerType,
      switchAction,
      modifier: modifierAction
    });
    if (action === Input.ACTIONS.WAIT_FOR_DOUBLE) handleDoubleTap(context.row, context.column);
    else performAction(action, context.row, context.column);
  });

  boardElement.addEventListener("pointercancel", () => {
    resetInputState();
  });

  boardElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const cell = event.target.closest(".cell");
    if (!cell || event.button !== 2) return;
    const position = positionFromElement(cell);
    performAction(Input.ACTIONS.TOGGLE_FLAG, position.row, position.column);
  });

  ["selectstart", "dragstart"].forEach((eventName) => {
    boardElement.addEventListener(eventName, (event) => event.preventDefault());
  });

  boardWrap.addEventListener("scroll", () => {
    userScrollUntil = performance.now() + FOLLOW_RESUME_MS;
  }, { passive: true });

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
      followCurrentStep();
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
    resetInputState();
    stopSequence();
    game = Core.newGame(Settings.toGameOptions(settings));
    AudioEngine.setTrackCount(game.rows);
    hideResult();
    completionBanner.hidden = true;
    document.body.classList.remove("glitching");
    window.clearTimeout(glitchVisualTimer);
    buildBoard();
    boardWrap.scrollLeft = 0;
    render();
  }

  function populateSelect(select, values) {
    select.replaceChildren(...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }));
  }

  function settingsDraft() {
    return {
      preset: settingPreset.value,
      rows: settingRows.value,
      steps: settingSteps.value,
      difficulty: settingDifficulty.value,
      mines: settingMines.value,
      randomBpm: settingRandomBpm.checked,
      fixedBpm: settingFixedBpm.value,
      touchMode: settingTouchMode.value,
      boardView: settingBoardView.value,
      followPlayhead: settingFollowPlayhead.checked
    };
  }

  function updateSettingsPreview() {
    const normalized = Settings.normalizeSettings(settingsDraft());
    const customBoard = settingPreset.value === "CUSTOM";
    settingRows.disabled = !customBoard;
    settingSteps.disabled = !customBoard;
    settingMines.disabled = settingDifficulty.value !== "CUSTOM";
    settingFixedBpm.disabled = settingRandomBpm.checked;
    settingRows.value = normalized.rows;
    settingSteps.value = normalized.steps;
    settingMines.max = String(normalized.rows * normalized.steps - 1);
    settingMines.value = normalized.mines;
    settingBoardView.value = normalized.boardView;
    settingDensity.textContent = `DENSITY ${(Settings.mineDensity(normalized) * 100).toFixed(1)}%`;
    settingCurrentTempo.textContent = `CURRENT BPM ${game.bpm} / ${game.tempoCategory}`;
    settingsValidation.textContent = customBoard
      ? `CUSTOM RANGE: ROWS 6–12 / STEPS 6–16 / MINES 1–${normalized.rows * normalized.steps - 1}`
      : "";
  }

  function fillSettingsForm() {
    settingPreset.value = settings.preset;
    settingRows.value = settings.rows;
    settingSteps.value = settings.steps;
    settingDifficulty.value = settings.difficulty;
    settingMines.value = settings.mines;
    settingRandomBpm.checked = settings.randomBpm;
    settingFixedBpm.value = settings.fixedBpm;
    settingTouchMode.value = settings.touchMode;
    settingBoardView.value = settings.boardView;
    settingFollowPlayhead.checked = settings.followPlayhead;
    updateSettingsPreview();
  }

  function openSettings() {
    fillSettingsForm();
    if (typeof settingsDialog.showModal === "function") settingsDialog.showModal();
    else settingsDialog.setAttribute("open", "");
  }

  function closeSettings() {
    if (typeof settingsDialog.close === "function") settingsDialog.close();
    else settingsDialog.removeAttribute("open");
  }

  function debugOpen() {
    if (!game.minesPlaced) return openSelectedCell(0, 0);
    const cell = game.board.flat().find((item) => !item.isMine && !item.isOpen && !item.isFlagged);
    if (cell) openSelectedCell(cell.row, cell.column);
  }

  function debugFlag() {
    if (!game.minesPlaced) Core.placeMines(game, 0, 0);
    const cell = game.board.flat().find((item) => item.isMine && !item.isOpen);
    if (cell) flagSelectedCell(cell.row, cell.column);
  }

  function debugMiss() {
    if (!game.minesPlaced) Core.placeMines(game, 0, 0);
    const cell = game.board.flat().find((item) => item.isMine && !item.isOpen && !item.isFlagged);
    if (cell) openSelectedCell(cell.row, cell.column);
  }

  async function debugChord() {
    if (!game.minesPlaced) Core.placeMines(game, 0, 0);
    const target = game.board.flat().find((item) => !item.isMine && item.adjacentMines > 0);
    if (!target) return;
    await openSelectedCell(target.row, target.column);
    game.board.flat().filter((cell) =>
      cell.isMine && Math.abs(cell.row - target.row) <= 1 &&
      Math.abs(cell.column - target.column) <= 1
    ).forEach((cell) => Core.setFlag(game, cell.row, cell.column, true));
    render();
    openSelectedCell(target.row, target.column);
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
  testOpenButton.addEventListener("click", debugOpen);
  testFlagButton.addEventListener("click", debugFlag);
  testChordButton.addEventListener("click", debugChord);
  testMissButton.addEventListener("click", debugMiss);

  quickTouchMode.addEventListener("change", () => {
    settings = Settings.saveSettings({ ...settings, touchMode: quickTouchMode.value });
    resetInputState();
    render();
  });

  switchControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-switch-action]");
    if (!button) return;
    switchAction = button.dataset.switchAction;
    updateTouchControls();
  });

  twoHandControls.querySelectorAll("[data-modifier]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      modifierAction = button.dataset.modifier;
      updateTouchControls();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      button.addEventListener(eventName, () => {
        modifierAction = null;
        updateTouchControls();
      });
    });
  });

  settingsButton.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsCancel.addEventListener("click", closeSettings);
  settingsDialog.addEventListener("click", (event) => {
    if (event.target === settingsDialog) closeSettings();
  });
  [settingPreset, settingRows, settingSteps, settingDifficulty, settingMines,
    settingRandomBpm, settingFixedBpm, settingBoardView].forEach((control) => {
    control.addEventListener("input", updateSettingsPreview);
    control.addEventListener("change", updateSettingsPreview);
  });
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = Settings.saveSettings(settingsDraft());
    closeSettings();
    newGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.isPlaying) stopSequence();
    if (document.hidden) resetInputState();
  });
  window.addEventListener("blur", resetInputState);

  if (debugMode) {
    document.body.classList.add("debug-mode");
    debugPanel.hidden = false;
  }
  if (!AudioEngine.isAvailable()) document.querySelector("#audioNotice").hidden = false;
  populateSelect(settingPreset, Settings.PRESET_NAMES);
  populateSelect(settingDifficulty, Settings.DIFFICULTIES);
  populateSelect(settingTouchMode, Settings.TOUCH_MODES);
  populateSelect(settingBoardView, Settings.BOARD_VIEWS);
  document.documentElement.dataset.version = "0.3.1";
  AudioEngine.setTrackCount(game.rows);
  buildBoard();
  render();
})();
