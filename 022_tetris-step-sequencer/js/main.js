import TetrisGame from "./tetris.js";
import { AudioEngine } from "./audio.js";
import { StepSequencer } from "./sequencer.js";
import { GameStorage, DEFAULT_SETTINGS } from "./storage.js";
import EffectsManager from "./effects.js";
import BoardRenderer from "./renderer.js";
import InputController from "./input.js";
import GameUI from "./ui.js";
import DebugController from "./debug.js";

window.__BEAT_STACK_READY__ = true;

const BPM_VALUES = Object.freeze([80, 100, 120, 140, 160]);
const STEP_COUNT = 16;
const BAR_SPEEDS = Object.freeze([0.5, 1, 2]);
const DEBUG_FROM_URL = /^(1|true|on)$/i.test(
  new URLSearchParams(location.search).get("debug") ?? "",
);

const byId = (id) => document.getElementById(id);
const elements = {
  startScreen: byId("startScreen"),
  startButton: byId("startButton"),
  loadPanel: byId("loadPanel"),
  loadStatus: byId("loadStatus"),
  loadCount: byId("loadCount"),
  loadProgress: byId("loadProgress"),
  startLog: byId("startLog"),
  gameShell: byId("gameShell"),
  boardCanvas: byId("boardCanvas"),
  boardStage: byId("boardStage"),
  readyOverlay: byId("readyOverlay"),
  transportStatus: byId("transportStatus"),
  transportLamp: byId("transportLamp"),
  stepValue: byId("stepValue"),
  bpmButtons: byId("bpmButtons"),
  optionsButton: byId("optionsButton"),
  settingsOverlay: byId("settingsOverlay"),
  closeSettingsButton: byId("closeSettingsButton"),
  saveSettingsButton: byId("saveSettingsButton"),
  sequencerVolumeInput: byId("sequencerVolumeInput"),
  sequencerVolumeValue: byId("sequencerVolumeValue"),
  seVolumeInput: byId("seVolumeInput"),
  seVolumeValue: byId("seVolumeValue"),
  settingsBpm: byId("settingsBpm"),
  barSpeedInput: byId("barSpeedInput"),
  controlModeInput: byId("controlModeInput"),
  swipeToggle: byId("swipeToggle"),
  debugModeToggle: byId("debugModeToggle"),
  gestureHint: byId("gestureHint"),
  gameOverOverlay: byId("gameOverOverlay"),
  retryButton: byId("retryButton"),
  toast: byId("toast"),
};

function appendStartLog(message, type = "info") {
  if (!elements.startLog) return;
  const item = document.createElement("li");
  const time = document.createElement("time");
  const text = document.createElement("span");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  text.textContent = message;
  item.className = type === "error" ? "is-error" : type === "success" ? "is-success" : "";
  item.append(time, text);
  elements.startLog.append(item);
  while (elements.startLog.children.length > 30) {
    elements.startLog.firstElementChild?.remove();
  }
  elements.startLog.scrollTop = elements.startLog.scrollHeight;

  const logger = type === "error" ? console.error : type === "success" ? console.info : console.log;
  logger(`[BEAT STACK] ${message}`);
}

function showStartupFailure(error) {
  elements.loadPanel.hidden = false;
  elements.loadStatus.textContent = "起動中にエラーが発生しました";
  appendStartLog(error?.message || String(error), "error");
}

window.addEventListener("error", (event) => {
  showStartupFailure(event.error ?? new Error(event.message || "不明なエラー"));
});

window.addEventListener("unhandledrejection", (event) => {
  showStartupFailure(event.reason ?? new Error("非同期処理でエラーが発生しました"));
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
};

function normalizeSettings(value = {}) {
  const requestedBpm = Number(value.bpm);
  const requestedSpeed = Number(value.barSpeed);
  const requestedMode = value.controlMode ?? value.controlMethod;

  return {
    bpm: BPM_VALUES.includes(requestedBpm) ? requestedBpm : DEFAULT_SETTINGS.bpm,
    sequencerVolume: clamp(
      value.sequencerVolume ?? value.bgmVolume,
      0,
      1,
      DEFAULT_SETTINGS.sequencerVolume,
    ),
    seVolume: clamp(value.seVolume, 0, 1, DEFAULT_SETTINGS.seVolume),
    controlMode: requestedMode === "buttons" ? "buttons" : "hybrid",
    swipeEnabled:
      typeof value.swipeEnabled === "boolean"
        ? value.swipeEnabled
        : DEFAULT_SETTINGS.swipeEnabled,
    barSpeed: BAR_SPEEDS.includes(requestedSpeed)
      ? requestedSpeed
      : DEFAULT_SETTINGS.barSpeed,
    debugMode:
      typeof value.debugMode === "boolean"
        ? value.debugMode
        : DEFAULT_SETTINGS.debugMode,
  };
}

const storage = new GameStorage();
const audio = new AudioEngine(DEFAULT_SETTINGS);
const effects = new EffectsManager();
const renderer = new BoardRenderer(elements.boardCanvas, effects, {
  columns: STEP_COUNT,
});
const ui = new GameUI(document);

let settings = {
  ...DEFAULT_SETTINGS,
  debugMode: DEBUG_FROM_URL || DEFAULT_SETTINGS.debugMode,
};
let highScore = 0;
let latestState = null;
let gameStarted = false;
let startInProgress = false;
let settingsOpen = false;
let resumeAfterSettings = false;
let currentVisualStep = -1;
let visualStepStartedAt = performance.now();
let lastFrameAt = performance.now();
let toastTimer = 0;
let readyTimer = 0;
let gameOverTimer = 0;
let backgroundResume = null;
let debugPaused = false;
let debugStepOverride = null;
let debugFrameCount = 0;
let debugFps = 0;
let debugFpsStartedAt = performance.now();
let lastDebugUpdateAt = 0;
const scheduledStepCells = new Map();

const game = new TetrisGame({ onEvent: handleGameEvent });
latestState = game.getState();

const sequencerClock = {
  get currentTime() {
    if (audio.context?.state === "running") return audio.currentTime;
    return performance.now() / 1000;
  },
};

const sequencer = new StepSequencer(sequencerClock, {
  bpm: settings.bpm,
  speed: settings.barSpeed,
  onSchedule: scheduleStepAudio,
  onVisualStep: showVisualStep,
});

const input = new InputController({
  root: document,
  surface: elements.boardStage,
  swipeEnabled: settings.swipeEnabled,
  actions: {
    left: () => runGameAction(() => game.move(-1)),
    right: () => runGameAction(() => game.move(1)),
    hardDrop: () => runGameAction(() => game.hardDrop()),
    drop: () => runGameAction(() => game.hardDrop()),
    rotate: () => runGameAction(() => game.rotate(1)),
    rotateCW: () => runGameAction(() => game.rotate(1)),
    rotateCCW: () => runGameAction(() => game.rotate(-1)),
    pause: () => {
      if (!gameStarted) return;
      if (settingsOpen) {
        void closeSettings(true);
      } else {
        openSettings();
      }
    },
    restart: () => {
      if (latestState?.status === "gameover") void restartGame();
    },
    start: () => {
      if (!gameStarted && !startInProgress) void startSession();
    },
  },
});

const debug = new DebugController({
  root: document,
  enabled: settings.debugMode,
  actions: {
    pause: toggleDebugPause,
    action: runDebugAction,
    sound: playDebugSound,
    step: setDebugStep,
  },
});

const storedStatePromise = storage
  .loadState()
  .then((state) => {
    highScore = state.highScore;
    settings = normalizeSettings({
      ...state.settings,
      ...(DEBUG_FROM_URL ? { debugMode: true } : {}),
    });
    applySettings(settings);
    syncUi(latestState);
    return state;
  })
  .catch((error) => {
    console.warn("設定の読み込みを継続できませんでした。", error);
    return { highScore: 0, settings: { ...DEFAULT_SETTINGS } };
  });

function runGameAction(action) {
  if (!gameStarted || settingsOpen || latestState?.status !== "running") {
    return false;
  }
  return action();
}

function syncUi(state = latestState) {
  if (!state) return;
  ui.updateStats({
    score: state.score,
    level: state.level,
    lines: state.lines,
    bpm: settings.bpm,
    highScore: Math.max(highScore, state.score ?? 0),
  });
  ui.setNext(state.next);
}

function handleGameEvent(type, detail, state) {
  if (state) latestState = state;

  switch (type) {
    case "gameStart":
      audio.playEvent("start");
      break;
    case "pieceLock":
      effects.shake(1.2, 55);
      break;
    case "lineClear":
      effects.lineClear(detail.rows);
      audio.playEvent("lineClear");
      showToast(`${detail.count} LINE CLEAR`);
      break;
    case "gameOver":
      sequencer.stop();
      scheduledStepCells.clear();
      debugPaused = false;
      debugStepOverride = null;
      debug.setPaused(false);
      currentVisualStep = -1;
      elements.stepValue.textContent = "--";
      elements.transportStatus.textContent = "SESSION ENDED";
      elements.transportLamp.classList.remove("is-running");
      effects.gameOver();
      audio.playEvent("gameOver");
      void finishGame(detail);
      break;
    case "stateChange":
      syncUi(state);
      break;
    default:
      break;
  }
}

function columnStep(column, width = STEP_COUNT) {
  const position = ((column + 0.5) / width) * STEP_COUNT - 0.5;
  return Math.max(0, Math.min(STEP_COUNT - 1, Math.round(position)));
}

function getStepCells(step) {
  const board = latestState?.board;
  if (!Array.isArray(board)) return [];
  const width = latestState?.width ?? board[0]?.length ?? STEP_COUNT;
  const cells = [];

  for (let y = 0; y < board.length; y += 1) {
    const row = board[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (!cell?.sound || columnStep(x, width) !== step) continue;
      cells.push({ x, y, type: cell.type, sound: true });
    }
  }
  return cells;
}

function scheduleStepAudio(step, when) {
  if (!gameStarted || latestState?.status === "gameover") return;
  const cells = getStepCells(step);
  const scheduleKey = `${step}@${Number(when).toFixed(6)}`;
  scheduledStepCells.set(scheduleKey, cells);
  while (scheduledStepCells.size > STEP_COUNT * 2) {
    scheduledStepCells.delete(scheduledStepCells.keys().next().value);
  }
  if (!cells.length) return;

  const voices = new Map();
  for (const cell of cells) {
    const voice = voices.get(cell.type) ?? { count: 0 };
    voice.count += 1;
    voices.set(cell.type, voice);
  }

  const voiceGain = Math.max(0.32, 0.72 / Math.sqrt(voices.size));
  for (const [type, voice] of voices) {
    const stackAccent = Math.min(1.12, 0.9 + Math.log2(voice.count + 1) * 0.06);
    audio.playPiece(type, when, voiceGain * stackAccent);
  }
}

function showVisualStep(step, when) {
  if (!gameStarted || latestState?.status === "gameover") return;
  currentVisualStep = step;
  visualStepStartedAt = performance.now();
  elements.stepValue.textContent = String(step + 1).padStart(2, "0");
  elements.transportStatus.textContent = "SEQUENCER PLAYING";
  const scheduleKey = `${step}@${Number(when).toFixed(6)}`;
  const cells = scheduledStepCells.get(scheduleKey) ?? getStepCells(step);
  scheduledStepCells.delete(scheduleKey);
  effects.flashCells(cells);
}

function setDebugPaused(paused) {
  if (!gameStarted || latestState?.status === "gameover") return false;
  const shouldPause = Boolean(paused);
  if (shouldPause === debugPaused) return true;

  debugPaused = shouldPause;
  if (shouldPause) {
    if (latestState?.status === "running") game.setPaused(true);
    sequencer.stop();
    scheduledStepCells.clear();
    debugStepOverride = currentVisualStep >= 0 ? currentVisualStep : 0;
    elements.transportStatus.textContent = "DEBUG PAUSED";
  } else {
    debugStepOverride = null;
    if (latestState?.status === "paused") game.setPaused(false);
    sequencer.start();
    elements.transportStatus.textContent = "SEQUENCER PLAYING";
  }
  debug.setPaused(debugPaused);
  return true;
}

function toggleDebugPause() {
  return setDebugPaused(!debugPaused);
}

function runDebugAction(action) {
  if (!settings.debugMode || !gameStarted) return false;
  let completed = false;

  switch (action) {
    case "clear":
      completed = game.debugClearBoard();
      if (completed) {
        effects.reset();
        showToast("DEBUG: 盤面を全消去");
      }
      break;
    case "demo":
      completed = game.debugLoadDemoBoard();
      if (completed) {
        effects.reset();
        showToast("DEBUG: デモ盤面を配置");
      }
      break;
    case "prepare-line":
      completed = game.debugPrepareLineClear();
      if (completed) {
        effects.reset();
        showToast("DEBUG: DROPで1ライン消去");
      }
      break;
    case "line-effect":
      effects.lineClear([17, 18, 19]);
      audio.playEvent("lineClear");
      showToast("DEBUG: ライン演出");
      completed = true;
      break;
    case "game-over":
      completed = game.debugForceGameOver();
      break;
    case "reset":
      beginGame();
      showToast("DEBUG: ゲームをリセット");
      completed = true;
      break;
    default:
      break;
  }

  if (!completed && action !== "game-over") {
    showToast("ゲーム開始後に利用できます");
  }
  return completed;
}

function playDebugSound(type) {
  if (!settings.debugMode) return;
  void audio.unlock().then(() => {
    audio.playPiece(type);
    showToast(`SOUND TEST: ${type}`);
  });
}

function setDebugStep(value) {
  if (!settings.debugMode || !gameStarted) return;
  const step = Math.max(0, Math.min(STEP_COUNT - 1, Math.round(Number(value) || 0)));
  if (!debugPaused) setDebugPaused(true);
  debugStepOverride = step;
  currentVisualStep = step;
  elements.stepValue.textContent = String(step + 1).padStart(2, "0");
  effects.flashCells(getStepCells(step));
}

function applySettings(nextSettings) {
  const wasDebugEnabled = Boolean(settings.debugMode);
  settings = normalizeSettings(nextSettings);
  audio.setSequencerVolume(settings.sequencerVolume);
  audio.setSeVolume(settings.seVolume);
  sequencer.setBpm(settings.bpm);
  sequencer.setSpeed(settings.barSpeed);

  const swipeActive =
    settings.controlMode !== "buttons" && settings.swipeEnabled;
  input.setSwipeEnabled(swipeActive);
  elements.gestureHint.hidden = !swipeActive;
  if (!settings.debugMode && debugPaused) setDebugPaused(false);
  debug.setEnabled(settings.debugMode, {
    open: settings.debugMode && debug.open,
  });
  if (settings.debugMode && !wasDebugEnabled && gameStarted) {
    debug.setOpen(true);
  }

  ui.updateSettings({
    ...settings,
    bgmVolume: settings.sequencerVolume,
    controlMethod: settings.controlMode,
  });
  ui.updateStats({ bpm: settings.bpm, highScore });

  for (const button of elements.bpmButtons?.querySelectorAll("[data-bpm]") ?? []) {
    button.classList.toggle(
      "is-active",
      Number(button.dataset.bpm) === settings.bpm,
    );
  }
  updateVolumeLabels();
}

function updateVolumeLabels() {
  elements.sequencerVolumeValue.textContent =
    `${Math.round(Number(elements.sequencerVolumeInput.value) * 100)}%`;
  elements.seVolumeValue.textContent =
    `${Math.round(Number(elements.seVolumeInput.value) * 100)}%`;
}

function showReadyMessage() {
  clearTimeout(readyTimer);
  if (!elements.readyOverlay) return;
  elements.readyOverlay.hidden = false;
  elements.readyOverlay.classList.remove("is-leaving");
  readyTimer = window.setTimeout(() => {
    elements.readyOverlay.classList.add("is-leaving");
    readyTimer = window.setTimeout(() => {
      elements.readyOverlay.hidden = true;
    }, 260);
  }, 650);
}

function beginGame() {
  clearTimeout(gameOverTimer);
  ui.hideGameOver();
  effects.reset();
  scheduledStepCells.clear();
  debugPaused = false;
  debugStepOverride = null;
  debug.setPaused(false);
  currentVisualStep = -1;
  visualStepStartedAt = performance.now();
  gameStarted = true;
  game.restart();
  sequencer.stop();
  sequencer.setBpm(settings.bpm);
  sequencer.setSpeed(settings.barSpeed);
  sequencer.start();
  elements.transportStatus.textContent = "SEQUENCER PLAYING";
  elements.transportLamp.classList.add("is-running");
  elements.stepValue.textContent = "01";
  showReadyMessage();
  if (settings.debugMode) debug.setOpen(true);
  requestAnimationFrame(() => renderer.resize());
}

async function startSession() {
  if (startInProgress || gameStarted) return;
  const sessionStartedAt = performance.now();
  startInProgress = true;
  elements.startButton.disabled = true;
  elements.loadPanel.hidden = false;
  elements.loadProgress.max = audio.totalCount || 21;
  elements.loadProgress.value = 0;
  elements.loadCount.textContent = `0 / ${audio.totalCount || 21}`;
  appendStartLog("START SESSION を受け付けました");

  const buttonTitle = elements.startButton.querySelector("strong");
  const buttonSubtitle = elements.startButton.querySelector("small");
  if (buttonTitle) buttonTitle.textContent = "LOADING…";
  if (buttonSubtitle) buttonSubtitle.textContent = "音源を準備しています";

  let audioReady = false;
  try {
    elements.loadStatus.textContent = "AudioContextを開始中…";
    appendStartLog("AudioContextを再開しています");
    const unlockPromise = audio.unlock();

    appendStartLog("IndexedDBから設定を読み込んでいます");
    await storedStatePromise;
    appendStartLog("保存設定の読み込み完了", "success");

    const unlocked = await unlockPromise;
    if (!unlocked) {
      throw new Error("このブラウザではAudioContextを開始できませんでした");
    }
    appendStartLog(`AudioContext: ${audio.context.state.toUpperCase()}`, "success");

    elements.loadStatus.textContent = "WAV音源を読み込み中…";
    appendStartLog(`${audio.totalCount}個のWAV音源を事前ロードします`);
    let lastLoggedCount = -1;
    await audio.loadAll((loaded, total, filename) => {
      elements.loadProgress.max = total;
      elements.loadProgress.value = loaded;
      elements.loadCount.textContent = `${loaded} / ${total}`;
      elements.loadStatus.textContent =
        loaded === total ? "サウンド準備完了" : `WAV音源を読み込み中… ${loaded}/${total}`;
      if (loaded !== lastLoggedCount && filename) {
        lastLoggedCount = loaded;
        appendStartLog(`[${loaded}/${total}] ${filename}`);
      }
    });
    audioReady = true;
    appendStartLog("全WAV音源をAudioBufferへ展開しました", "success");
  } catch (error) {
    appendStartLog(error?.message || "音源の準備に失敗しました", "error");
    appendStartLog("音声なしでゲームを続行します", "error");
    elements.loadStatus.textContent = "音声の準備に失敗（ゲームは続行可能）";
  }

  elements.loadProgress.value = audioReady
    ? elements.loadProgress.max
    : elements.loadProgress.value;
  appendStartLog("ゲーム盤面と16ステップを初期化しています");

  const minimumLogTime = 650;
  const remainingLogTime = Math.max(
    0,
    minimumLogTime - (performance.now() - sessionStartedAt),
  );
  await new Promise((resolve) => window.setTimeout(resolve, remainingLogTime));
  ui.showScreen("game");
  beginGame();
  appendStartLog("ゲーム開始", "success");
  startInProgress = false;
}

async function restartGame() {
  await audio.unlock().catch(() => false);
  beginGame();
}

async function finishGame(detail) {
  const score = Number(detail.score) || 0;
  const isHighScore = score > highScore;
  highScore = await storage.saveHighScore(score);
  syncUi(latestState);
  clearTimeout(gameOverTimer);
  gameOverTimer = window.setTimeout(() => {
    ui.showGameOver({
      score,
      level: detail.level,
      lines: detail.lines,
      highScore,
      isHighScore,
    });
  }, 380);
}

function openSettings() {
  if (!gameStarted || settingsOpen) return;
  settingsOpen = true;
  resumeAfterSettings = latestState?.status === "running";
  if (resumeAfterSettings) game.setPaused(true);
  ui.openSettings({
    ...settings,
    bgmVolume: settings.sequencerVolume,
    controlMethod: settings.controlMode,
  });
  window.setTimeout(() => elements.closeSettingsButton?.focus(), 0);
}

async function closeSettings(save = true) {
  if (!settingsOpen) return;
  const values = ui.readSettings();
  applySettings({
    bpm: values.bpm,
    sequencerVolume: values.sequencerVolume,
    seVolume: values.seVolume,
    controlMode: values.controlMethod,
    swipeEnabled: values.swipeEnabled,
    barSpeed: values.barSpeed,
    debugMode: values.debugMode,
  });
  if (save) {
    await storage.saveSettings(settings);
    showToast("設定を保存しました");
  }
  ui.closeSettings(save ? "save" : "cancel");
  settingsOpen = false;
  if (resumeAfterSettings && latestState?.status === "paused") {
    game.setPaused(false);
  }
  resumeAfterSettings = false;
  elements.optionsButton?.focus();
}

function setBpm(value, persist = true) {
  const bpm = Number(value);
  if (!BPM_VALUES.includes(bpm)) return;
  applySettings({ ...settings, bpm });
  if (persist) void storage.saveSettings(settings);
  showToast(`BPM ${bpm}`);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1800);
}

elements.startButton.addEventListener("click", () => {
  void startSession();
});

elements.retryButton.addEventListener("click", () => {
  void restartGame();
});

elements.optionsButton.addEventListener("click", openSettings);
elements.closeSettingsButton.addEventListener("click", () => {
  void closeSettings(true);
});
elements.saveSettingsButton.addEventListener("click", () => {
  void closeSettings(true);
});
elements.settingsOverlay.addEventListener("pointerdown", (event) => {
  if (event.target === elements.settingsOverlay) void closeSettings(true);
});

elements.bpmButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bpm]");
  if (!button) return;
  setBpm(button.dataset.bpm);
});

elements.sequencerVolumeInput.addEventListener("input", () => {
  settings.sequencerVolume = clamp(
    elements.sequencerVolumeInput.value,
    0,
    1,
    settings.sequencerVolume,
  );
  audio.setSequencerVolume(settings.sequencerVolume);
  updateVolumeLabels();
});

elements.seVolumeInput.addEventListener("input", () => {
  settings.seVolume = clamp(
    elements.seVolumeInput.value,
    0,
    1,
    settings.seVolume,
  );
  audio.setSeVolume(settings.seVolume);
  updateVolumeLabels();
});

elements.settingsBpm.addEventListener("change", () => {
  setBpm(elements.settingsBpm.value, false);
});

elements.barSpeedInput.addEventListener("change", () => {
  applySettings({ ...settings, barSpeed: Number(elements.barSpeedInput.value) });
});

elements.swipeToggle.addEventListener("change", () => {
  applySettings({ ...settings, swipeEnabled: elements.swipeToggle.checked });
});

elements.controlModeInput.addEventListener("change", () => {
  applySettings({ ...settings, controlMode: elements.controlModeInput.value });
});

elements.debugModeToggle.addEventListener("change", () => {
  applySettings({
    ...settings,
    debugMode: elements.debugModeToggle.checked,
  });
});

function animationFrame(now) {
  const delta = Math.min(100, Math.max(0, now - lastFrameAt));
  lastFrameAt = now;
  debugFrameCount += 1;
  const fpsElapsed = now - debugFpsStartedAt;
  if (fpsElapsed >= 500) {
    debugFps = Math.round((debugFrameCount * 1000) / fpsElapsed);
    debugFrameCount = 0;
    debugFpsStartedAt = now;
  }

  if (gameStarted && latestState?.status === "running") {
    game.update(delta);
  }

  let stepPosition;
  if (debugStepOverride !== null) {
    stepPosition = debugStepOverride + 0.5;
  } else if (sequencer.isRunning && currentVisualStep >= 0) {
    const progress =
      (now - visualStepStartedAt) / (sequencer.secondsPerStep * 1000);
    stepPosition = currentVisualStep + 0.5 + Math.max(0, progress);
  }
  renderer.render(latestState ?? game.getState(), {
    now,
    stepPosition,
  });

  if (settings.debugMode && now - lastDebugUpdateAt >= 200) {
    lastDebugUpdateAt = now;
    debug.update({
      status: debugPaused
        ? "PAUSED"
        : String(latestState?.status ?? "idle").toUpperCase(),
      fps: `${debugFps || "--"} FPS`,
      viewport: `${window.innerWidth}×${window.innerHeight} @${Math.min(
        window.devicePixelRatio || 1,
        3,
      ).toFixed(1)}`,
      audioState: String(audio.context?.state ?? "unsupported").toUpperCase(),
      step:
        debugStepOverride ??
        (currentVisualStep >= 0 ? currentVisualStep : 0),
    });
  }
  requestAnimationFrame(animationFrame);
}
requestAnimationFrame(animationFrame);

document.addEventListener("visibilitychange", () => {
  if (!gameStarted) return;

  if (document.hidden) {
    backgroundResume = {
      gameWasRunning: latestState?.status === "running",
      sequencerWasRunning: sequencer.isRunning,
    };
    if (backgroundResume.gameWasRunning) game.setPaused(true);
    sequencer.stop();
    scheduledStepCells.clear();
    void audio.context?.suspend?.().catch(() => {});
    return;
  }

  if (!backgroundResume) return;
  const resumeState = backgroundResume;
  backgroundResume = null;
  showToast("画面をタップして音声を再開");
  document.addEventListener(
    "pointerdown",
    () => {
      void audio.unlock().then(() => {
        if (resumeState.sequencerWasRunning && latestState?.status !== "gameover") {
          sequencer.start();
        }
        if (
          resumeState.gameWasRunning &&
          !settingsOpen &&
          latestState?.status === "paused"
        ) {
          game.setPaused(false);
        }
        lastFrameAt = performance.now();
      });
    },
    { once: true },
  );
});

window.addEventListener("pagehide", () => {
  sequencer.stop();
});
