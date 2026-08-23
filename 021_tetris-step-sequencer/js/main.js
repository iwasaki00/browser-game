import TetrisGame from "./tetris.js";
import { AudioEngine, PIECE_SOUND_MAP } from "./audio.js";
import { StepSequencer } from "./sequencer.js";
import { GameStorage, DEFAULT_SETTINGS } from "./storage.js";
import EffectsManager from "./effects.js";
import BoardRenderer from "./renderer.js";
import InputController from "./input.js";
import GameUI from "./ui.js";
import DebugController from "./debug.js";
import MusicEngine, { ACCENT_STEPS } from "./musicEngine.js";
import GrooveEvaluator from "./grooveEvaluator.js";
import PerformanceRecorder from "./performanceRecorder.js";
import ReplayPlayer from "./replay.js";
import Mixer from "./mixer.js";

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
  chordValue: byId("chordValue"),
  grooveValue: byId("grooveValue"),
  multiplierValue: byId("multiplierValue"),
  comboValue: byId("comboValue"),
  loopValue: byId("loopValue"),
  stepIndicator: byId("stepIndicator"),
  listenButton: byId("listenButton"),
  bpmButtons: byId("bpmButtons"),
  optionsButton: byId("optionsButton"),
  settingsOverlay: byId("settingsOverlay"),
  closeSettingsButton: byId("closeSettingsButton"),
  saveSettingsButton: byId("saveSettingsButton"),
  sequencerVolumeInput: byId("sequencerVolumeInput"),
  sequencerVolumeValue: byId("sequencerVolumeValue"),
  masterVolumeInput: byId("masterVolumeInput"),
  masterVolumeValue: byId("masterVolumeValue"),
  bassVolumeInput: byId("bassVolumeInput"),
  bassVolumeValue: byId("bassVolumeValue"),
  chordVolumeInput: byId("chordVolumeInput"),
  chordVolumeValue: byId("chordVolumeValue"),
  seVolumeInput: byId("seVolumeInput"),
  seVolumeValue: byId("seVolumeValue"),
  settingsBpm: byId("settingsBpm"),
  barSpeedInput: byId("barSpeedInput"),
  controlModeInput: byId("controlModeInput"),
  swipeToggle: byId("swipeToggle"),
  debugModeToggle: byId("debugModeToggle"),
  chordModeToggle: byId("chordModeToggle"),
  bassModeInput: byId("bassModeInput"),
  replayRecordToggle: byId("replayRecordToggle"),
  gestureHint: byId("gestureHint"),
  gameOverOverlay: byId("gameOverOverlay"),
  retryButton: byId("retryButton"),
  playbackButton: byId("playbackButton"),
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
    masterVolume: clamp(
      value.masterVolume,
      0,
      1,
      DEFAULT_SETTINGS.masterVolume,
    ),
    drumVolume: clamp(
      value.drumVolume ?? value.sequencerVolume ?? value.bgmVolume,
      0,
      1,
      DEFAULT_SETTINGS.drumVolume,
    ),
    bassVolume: clamp(
      value.bassVolume,
      0,
      1,
      DEFAULT_SETTINGS.bassVolume,
    ),
    chordVolume: clamp(
      value.chordVolume,
      0,
      1,
      DEFAULT_SETTINGS.chordVolume,
    ),
    eventVolume: clamp(
      value.eventVolume ?? value.seVolume,
      0,
      1,
      DEFAULT_SETTINGS.eventVolume,
    ),
    muted: Object.fromEntries(
      ["master", "drum", "bass", "chord", "event"].map((bus) => [
        bus,
        Boolean(value.muted?.[bus]),
      ]),
    ),
    chordMode:
      typeof value.chordMode === "boolean"
        ? value.chordMode
        : DEFAULT_SETTINGS.chordMode,
    bassMode: ["OFF", "BASIC", "FOUR ON FLOOR", "SYNCOPATION"].includes(
      value.bassMode,
    )
      ? value.bassMode
      : DEFAULT_SETTINGS.bassMode,
    replayRecord:
      typeof value.replayRecord === "boolean"
        ? value.replayRecord
        : DEFAULT_SETTINGS.replayRecord,
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
    // Legacy aliases stay synchronized for older saved settings and UI code.
    sequencerVolume: clamp(
      value.drumVolume ?? value.sequencerVolume ?? value.bgmVolume,
      0,
      1,
      DEFAULT_SETTINGS.drumVolume,
    ),
    seVolume: clamp(
      value.eventVolume ?? value.seVolume,
      0,
      1,
      DEFAULT_SETTINGS.eventVolume,
    ),
  };
}

const storage = new GameStorage();
const audio = new AudioEngine(DEFAULT_SETTINGS);
const effects = new EffectsManager();
const renderer = new BoardRenderer(elements.boardCanvas, effects, {
  columns: STEP_COUNT,
  accentSteps: ACCENT_STEPS,
});
const ui = new GameUI(document);
const mixer = new Mixer(audio, DEFAULT_SETTINGS);
const music = new MusicEngine(DEFAULT_SETTINGS);
const grooveEvaluator = new GrooveEvaluator({ accentSteps: ACCENT_STEPS });
const recorder = new PerformanceRecorder({
  enabled: DEFAULT_SETTINGS.replayRecord,
});

let settings = {
  ...DEFAULT_SETTINGS,
  muted: { ...DEFAULT_SETTINGS.muted },
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
let visualStepAudioTime = 0;
let currentLoop = 0;
let currentChord = "Cmaj";
let grooveResult = grooveEvaluator.last;
let listenMode = false;
let replayMode = false;
let lineClearedSinceLoop = false;
let hitStopUntil = 0;
let lastRiserAt = -Infinity;
let lastLevel = 1;
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

const replay = new ReplayPlayer(audio, {
  onVisualStep: showReplayStep,
  onEnd: finishReplay,
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
      lastRiserAt = audio.currentTime;
      break;
    case "pieceLock":
      effects.shake(1.2, 55);
      break;
    case "lineClear":
      effects.lineClear(detail.rows, {
        columns: STEP_COUNT,
        fragments: detail.count === 4 ? 5 : 2,
      });
      playLineClearMusic(detail.count);
      lineClearedSinceLoop = true;
      updateGroove(state, { lineCleared: true });
      if (detail.count === 4) {
        effects.screenFlash();
        effects.shake(12, 260);
        hitStopUntil = performance.now() + 120;
        music.queueLineClear(4);
        tryPlayRiser("TETRIS");
      }
      if (state.level > lastLevel) {
        lastLevel = state.level;
        tryPlayRiser("LEVEL UP");
      }
      showToast(
        grooveResult.recoveryBonus
          ? `${detail.count} LINE CLEAR · RECOVERY BONUS`
          : `${detail.count} LINE CLEAR`,
      );
      break;
    case "gameOver":
      sequencer.stop();
      scheduledStepCells.clear();
      debugPaused = false;
      debugStepOverride = null;
      debug.setPaused(false);
      currentVisualStep = -1;
      listenMode = false;
      elements.stepValue.textContent = "--";
      elements.transportStatus.textContent = "SESSION ENDED";
      elements.transportLamp.classList.remove("is-running");
      effects.gameOver();
      audio.playEvent("gameOver");
      elements.playbackButton.disabled = recorder.createReplay(64).length === 0;
      updateListenButton();
      void finishGame(detail);
      break;
    case "stateChange":
      syncUi(state);
      if (isDangerousBoard(state.board)) tryPlayRiser("DANGER");
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
  const loop = music.loopNumber;
  const chord = music.getChord(loop);
  const accented = music.isAccent(step);
  const cells = getStepCells(step);
  const scheduleKey = `${step}@${Number(when).toFixed(6)}`;
  const stackReduction = cells.length >= 4
    ? Math.sqrt(3 / cells.length)
    : 1;

  for (const cell of cells) {
    const heightRatio = Math.max(
      0,
      Math.min(1, cell.y / Math.max(1, (latestState?.height ?? 20) - 1)),
    );
    const heightVelocity = 0.45 + heightRatio * 0.55;
    const velocity = Math.min(
      1,
      heightVelocity * (accented ? 1.1 : 1) * stackReduction,
    );
    audio.playPiece(cell.type, when, velocity);
    recorder.record({
      playedAt: when,
      loop,
      step,
      filename: PIECE_SOUND_MAP[cell.type],
      bus: "drum",
      kind: "note",
      pieceType: cell.type,
      velocity,
      chord: chord.name,
      cells: [cell],
    });
  }

  const musicEvents = music.getStepEvents(step, loop);
  for (const event of musicEvents) {
    audio.playFile(event.filename, {
      bus: event.bus,
      when,
      gain: event.gain,
    });
    recorder.record({
      ...event,
      playedAt: when,
      loop,
      step,
      velocity: event.gain,
      chord: event.chord ?? chord.name,
    });
  }

  scheduledStepCells.set(scheduleKey, {
    cells,
    loop,
    chord: chord.name,
    accented,
    musicEvents,
  });
  while (scheduledStepCells.size > STEP_COUNT * 4) {
    scheduledStepCells.delete(scheduledStepCells.keys().next().value);
  }
  music.completeStep(step);
}

function showVisualStep(step, when) {
  if (!gameStarted || latestState?.status === "gameover") return;
  currentVisualStep = step;
  visualStepAudioTime = Number(when) || audio.currentTime;
  visualStepStartedAt = performance.now();
  elements.stepValue.textContent = String(step + 1).padStart(2, "0");
  const scheduleKey = `${step}@${Number(when).toFixed(6)}`;
  const scheduled = scheduledStepCells.get(scheduleKey) ?? {
    cells: getStepCells(step),
    loop: currentLoop,
    chord: currentChord,
    accented: music.isAccent(step),
  };
  scheduledStepCells.delete(scheduleKey);
  currentLoop = scheduled.loop;
  currentChord = scheduled.chord;
  effects.flashCells(scheduled.cells);
  updateStepIndicator(step);
  updateMusicStatus();

  if (step === 0) {
    updateGroove(latestState, {
      advanceLoop: true,
      lineCleared: lineClearedSinceLoop,
    });
    lineClearedSinceLoop = false;
  }

  elements.transportStatus.textContent = listenMode
    ? "PAUSE & LISTEN"
    : "SEQUENCER PLAYING";
}

function updateStepIndicator(step = currentVisualStep) {
  const items = elements.stepIndicator?.children ?? [];
  const noteSteps = new Set();
  for (let index = 0; index < STEP_COUNT; index += 1) {
    if (getStepCells(index).length) noteSteps.add(index);
  }
  Array.from(items).forEach((item, index) => {
    item.classList.toggle("is-current", index === step);
    item.classList.toggle("has-note", noteSteps.has(index));
    item.classList.toggle("is-accent", ACCENT_STEPS.includes(index));
    item.setAttribute(
      "aria-label",
      `ステップ${index + 1}${noteSteps.has(index) ? " 音あり" : " 無音"}${
        ACCENT_STEPS.includes(index) ? " アクセント" : ""
      }`,
    );
  });
}

function updateMusicStatus() {
  elements.chordValue.textContent = settings.chordMode ? currentChord : "OFF";
  elements.loopValue.textContent = `${(currentLoop % 4) + 1} / 4`;
  elements.grooveValue.textContent = grooveResult.grade;
  elements.multiplierValue.textContent =
    `×${Number(grooveResult.multiplier.toFixed(2))}`;
  elements.comboValue.textContent = `×${grooveResult.combo}`;
}

function updateGroove(state = latestState, options = {}) {
  const previousGrade = grooveResult.grade;
  const previousCombo = grooveResult.combo;
  grooveResult = grooveEvaluator.evaluate(state?.board ?? [], options);
  game.setScoreMultiplier(grooveResult.multiplier);
  updateMusicStatus();

  if (grooveResult.grade !== previousGrade && gameStarted) {
    showToast(
      `${grooveResult.grade}!  SCORE ×${grooveResult.multiplier}`,
    );
  } else if (grooveResult.combo > previousCombo) {
    showToast(`GROOVE COMBO ×${grooveResult.combo}`);
  }
  if (grooveResult.recoveryBonus) showToast("RECOVERY BONUS");
  if (grooveResult.combo >= 5) tryPlayRiser("COMBO");
  return grooveResult;
}

function playLineClearMusic(count) {
  const sounds = {
    1: [["seq_synth_pluck_c.wav", 0.55]],
    2: [
      ["seq_synth_pluck_e.wav", 0.42],
      ["seq_synth_pluck_g.wav", 0.42],
    ],
    3: [["seq_synth_stab_cmaj.wav", 0.55]],
  }[Number(count)] ?? [];
  const when = audio.currentTime + 0.01;
  for (const [filename, velocity] of sounds) {
    audio.playFile(filename, { bus: "event", when, gain: velocity });
    recorder.record({
      playedAt: when,
      loop: currentLoop,
      step: Math.max(0, currentVisualStep),
      filename,
      bus: "event",
      kind: "lineClear",
      velocity,
      chord: currentChord,
      lineCount: count,
    });
  }
  if (Number(count) === 4) {
    recorder.record({
      playedAt: when,
      loop: currentLoop,
      step: Math.max(0, currentVisualStep),
      kind: "lineClear",
      bus: "event",
      velocity: 0,
      chord: currentChord,
      lineCount: 4,
    });
  }
}

function tryPlayRiser(reason) {
  const now = audio.currentTime || performance.now() / 1000;
  if (now - lastRiserAt < 10) return false;
  lastRiserAt = now;
  audio.playFile("seq_synth_rise.wav", {
    bus: "event",
    when: now + 0.01,
    gain: 0.5,
  });
  recorder.record({
    playedAt: now + 0.01,
    loop: currentLoop,
    step: Math.max(0, currentVisualStep),
    filename: "seq_synth_rise.wav",
    bus: "event",
    kind: "riser",
    velocity: 0.5,
    chord: currentChord,
  });
  showToast(`${reason} RISER`);
  return true;
}

function isDangerousBoard(board = []) {
  const firstOccupiedRow = board.findIndex((row) => row?.some(Boolean));
  return firstOccupiedRow >= 0 && firstOccupiedRow <= 4;
}

async function toggleListenMode() {
  if (!gameStarted || settingsOpen) return;
  if (replayMode) {
    stopReplay();
    return;
  }
  if (latestState?.status === "gameover") return;

  if (!listenMode && latestState?.status === "running") {
    listenMode = true;
    game.setPaused(true);
    elements.transportStatus.textContent = "PAUSE & LISTEN";
  } else if (listenMode && latestState?.status === "paused") {
    await audio.unlock().catch(() => false);
    listenMode = false;
    game.setPaused(false);
    elements.transportStatus.textContent = "SEQUENCER PLAYING";
  }
  updateListenButton();
}

function updateListenButton() {
  const icon = elements.listenButton?.querySelector("span");
  const label = elements.listenButton?.querySelector("b");
  if (!icon || !label) return;
  if (replayMode) {
    icon.textContent = "■";
    label.textContent = "STOP PLAYBACK";
    elements.listenButton.setAttribute("aria-label", "リプレイを停止");
  } else if (listenMode) {
    icon.textContent = "▶";
    label.textContent = "RESUME";
    elements.listenButton.setAttribute("aria-label", "ゲームを再開");
  } else {
    icon.textContent = "◉";
    label.textContent = "PAUSE & LISTEN";
    elements.listenButton.setAttribute("aria-label", "盤面を固定して試聴");
  }
  elements.listenButton.classList.toggle(
    "is-active",
    replayMode || listenMode,
  );
}

async function startReplay() {
  const frames = recorder.createReplay(64);
  if (!frames.length) {
    showToast("再生できる演奏履歴がありません");
    return;
  }
  await audio.unlock().catch(() => false);
  sequencer.stop();
  scheduledStepCells.clear();
  replayMode = true;
  listenMode = false;
  ui.hideGameOver();
  effects.reset();
  elements.transportLamp.classList.add("is-running");
  elements.transportStatus.textContent = "PLAYBACK";
  updateListenButton();
  replay.start(frames, {
    bpm: settings.bpm,
    speed: settings.barSpeed,
  });
}

function showReplayStep(frame) {
  if (!replayMode) return;
  currentVisualStep = frame.step;
  visualStepAudioTime = audio.currentTime;
  visualStepStartedAt = performance.now();
  currentLoop = frame.loop;
  const chordEvent = frame.events.find((event) => event.chord);
  if (chordEvent?.chord) currentChord = chordEvent.chord;
  const cells = frame.events.flatMap((event) => event.cells ?? []);
  effects.flashCells(cells);
  elements.stepValue.textContent = String(frame.step + 1).padStart(2, "0");
  updateStepIndicator(frame.step);
  updateMusicStatus();
}

function stopReplay() {
  replay.stop(false);
  finishReplay();
}

function finishReplay() {
  if (!replayMode) return;
  replayMode = false;
  currentVisualStep = -1;
  elements.transportLamp.classList.remove("is-running");
  elements.transportStatus.textContent = "PLAYBACK COMPLETE";
  elements.stepValue.textContent = "--";
  updateListenButton();
  ui.showGameOver({
    score: latestState?.score ?? 0,
    level: latestState?.level ?? 1,
    lines: latestState?.lines ?? 0,
    highScore,
    isHighScore: false,
  });
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
    if (latestState?.status === "paused" && !listenMode) game.setPaused(false);
    sequencer.start();
    elements.transportStatus.textContent = listenMode
      ? "PAUSE & LISTEN"
      : "SEQUENCER PLAYING";
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
  mixer.apply(settings);
  music.configure({
    chordMode: settings.chordMode,
    bassMode: settings.bassMode,
    accentSteps: ACCENT_STEPS,
  });
  recorder.setEnabled(settings.replayRecord);
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
    bgmVolume: settings.drumVolume,
    controlMethod: settings.controlMode,
  });
  ui.updateStats({ bpm: settings.bpm, highScore });

  for (const button of elements.bpmButtons?.querySelectorAll("[data-bpm]") ?? []) {
    button.classList.toggle(
      "is-active",
      Number(button.dataset.bpm) === settings.bpm,
    );
  }
  syncSettingsControls();
  updateMusicStatus();
  updateVolumeLabels();
}

function syncSettingsControls() {
  const inputValues = [
    [elements.masterVolumeInput, settings.masterVolume],
    [elements.sequencerVolumeInput, settings.drumVolume],
    [elements.bassVolumeInput, settings.bassVolume],
    [elements.chordVolumeInput, settings.chordVolume],
    [elements.seVolumeInput, settings.eventVolume],
  ];
  for (const [input, value] of inputValues) {
    if (input) input.value = String(value);
  }
  if (elements.chordModeToggle) {
    elements.chordModeToggle.checked = settings.chordMode;
  }
  if (elements.bassModeInput) elements.bassModeInput.value = settings.bassMode;
  if (elements.replayRecordToggle) {
    elements.replayRecordToggle.checked = settings.replayRecord;
  }
  for (const button of document.querySelectorAll("[data-mixer-mute]")) {
    const muted = Boolean(settings.muted[button.dataset.mixerMute]);
    button.classList.toggle("is-muted", muted);
    button.textContent = muted ? "ON" : "MUTE";
    button.setAttribute("aria-pressed", String(muted));
  }
}

function updateVolumeLabels() {
  const pairs = [
    [elements.masterVolumeInput, elements.masterVolumeValue],
    [elements.sequencerVolumeInput, elements.sequencerVolumeValue],
    [elements.bassVolumeInput, elements.bassVolumeValue],
    [elements.chordVolumeInput, elements.chordVolumeValue],
    [elements.seVolumeInput, elements.seVolumeValue],
  ];
  for (const [input, output] of pairs) {
    if (input && output) {
      output.textContent = `${Math.round(Number(input.value) * 100)}%`;
    }
  }
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
  replay.stop(false);
  ui.hideGameOver();
  effects.reset();
  scheduledStepCells.clear();
  recorder.reset();
  music.reset();
  grooveResult = grooveEvaluator.reset();
  debugPaused = false;
  listenMode = false;
  replayMode = false;
  lineClearedSinceLoop = false;
  hitStopUntil = 0;
  currentLoop = 0;
  currentChord = music.getChord(0).name;
  lastLevel = 1;
  lastRiserAt = -Infinity;
  debugStepOverride = null;
  debug.setPaused(false);
  currentVisualStep = -1;
  visualStepStartedAt = performance.now();
  visualStepAudioTime = audio.currentTime;
  gameStarted = true;
  game.restart();
  sequencer.stop();
  sequencer.setBpm(settings.bpm);
  sequencer.setSpeed(settings.barSpeed);
  sequencer.start();
  elements.transportStatus.textContent = "SEQUENCER PLAYING";
  elements.transportLamp.classList.add("is-running");
  elements.stepValue.textContent = "01";
  updateMusicStatus();
  updateStepIndicator(-1);
  updateListenButton();
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
    bgmVolume: settings.drumVolume,
    controlMethod: settings.controlMode,
  });
  syncSettingsControls();
  window.setTimeout(() => elements.closeSettingsButton?.focus(), 0);
}

async function closeSettings(save = true) {
  if (!settingsOpen) return;
  const values = ui.readSettings();
  applySettings({
    bpm: values.bpm,
    masterVolume: Number(elements.masterVolumeInput.value),
    drumVolume: values.sequencerVolume,
    bassVolume: Number(elements.bassVolumeInput.value),
    chordVolume: Number(elements.chordVolumeInput.value),
    eventVolume: values.seVolume,
    muted: { ...settings.muted },
    chordMode: elements.chordModeToggle.checked,
    bassMode: elements.bassModeInput.value,
    replayRecord: elements.replayRecordToggle.checked,
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
  if (
    resumeAfterSettings &&
    latestState?.status === "paused" &&
    !listenMode
  ) {
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
elements.playbackButton.addEventListener("click", () => {
  void startReplay();
});
elements.listenButton.addEventListener("click", () => {
  void toggleListenMode();
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

const mixerInputs = [
  [elements.masterVolumeInput, "master", "masterVolume"],
  [elements.sequencerVolumeInput, "drum", "drumVolume"],
  [elements.bassVolumeInput, "bass", "bassVolume"],
  [elements.chordVolumeInput, "chord", "chordVolume"],
  [elements.seVolumeInput, "event", "eventVolume"],
];
for (const [input, bus, settingKey] of mixerInputs) {
  input.addEventListener("input", () => {
    const value = clamp(input.value, 0, 1, settings[settingKey]);
    settings[settingKey] = value;
    if (bus === "drum") settings.sequencerVolume = value;
    if (bus === "event") settings.seVolume = value;
    mixer.setVolume(bus, value);
    updateVolumeLabels();
  });
}

elements.settingsOverlay.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mixer-mute]");
  if (!button) return;
  const bus = button.dataset.mixerMute;
  const muted = mixer.toggleMute(bus);
  settings.muted = { ...settings.muted, [bus]: muted };
  syncSettingsControls();
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
elements.chordModeToggle.addEventListener("change", () => {
  applySettings({ ...settings, chordMode: elements.chordModeToggle.checked });
});
elements.bassModeInput.addEventListener("change", () => {
  applySettings({ ...settings, bassMode: elements.bassModeInput.value });
});
elements.replayRecordToggle.addEventListener("change", () => {
  applySettings({
    ...settings,
    replayRecord: elements.replayRecordToggle.checked,
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

  if (
    gameStarted &&
    latestState?.status === "running" &&
    now >= hitStopUntil
  ) {
    game.update(delta);
  }

  let stepPosition;
  if (debugStepOverride !== null) {
    stepPosition = debugStepOverride + 0.5;
  } else if (
    (sequencer.isRunning || replay.running) &&
    currentVisualStep >= 0
  ) {
    const stepDuration = replay.running
      ? replay.secondsPerStep
      : sequencer.secondsPerStep;
    const elapsed = audio.context?.state === "running"
      ? audio.currentTime - visualStepAudioTime
      : (now - visualStepStartedAt) / 1000;
    const progress = elapsed / stepDuration;
    stepPosition = currentVisualStep + 0.5 + Math.max(0, progress);
  }
  const renderState = replayMode && latestState
    ? { ...latestState, status: "replay" }
    : latestState ?? game.getState();
  renderer.render(renderState, {
    now,
    stepPosition,
    accented: music.isAccent(currentVisualStep),
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
      replayWasRunning: replay.running,
    };
    if (backgroundResume.gameWasRunning) game.setPaused(true);
    sequencer.stop();
    if (replay.running) {
      replay.stop(false);
      replayMode = false;
      currentVisualStep = -1;
      elements.stepValue.textContent = "--";
      elements.transportLamp.classList.remove("is-running");
      elements.transportStatus.textContent = "PLAYBACK STOPPED";
      updateListenButton();
      ui.showGameOver({
        score: latestState?.score ?? 0,
        level: latestState?.level ?? 1,
        lines: latestState?.lines ?? 0,
        highScore,
      });
    }
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
  replay.stop(false);
});
