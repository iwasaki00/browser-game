import { PIECE_COLORS, PIECE_SHAPES } from "./renderer.js";

const ID_ALIASES = Object.freeze({
  score: ["scoreValue", "score-value", "score"],
  level: ["levelValue", "level-value", "level"],
  lines: ["linesValue", "lines-value", "lines"],
  bpm: ["bpmValue", "bpm-value", "bpm-display"],
  highScore: ["highScoreValue", "high-score-value", "highScore", "high-score"],
  loadingScreen: [
    "loadingScreen",
    "loading-screen",
    "loadingOverlay",
    "loadPanel",
  ],
  loadingText: [
    "loadingText",
    "loading-text",
    "audioStatus",
    "loadStatus",
  ],
  loadingProgress: ["loadingProgress", "loading-progress", "loadProgress"],
  loadingCount: ["loadingCount", "loading-count", "loadCount"],
  titleScreen: ["titleScreen", "title-screen", "startScreen", "start-screen"],
  gameScreen: [
    "gameScreen",
    "game-screen",
    "gameView",
    "game-view",
    "gameShell",
  ],
  gameOver: ["gameOverOverlay", "game-over-overlay", "gameOver"],
  gameOverScore: [
    "gameOverScore",
    "game-over-score",
    "finalScore",
    "finalScoreValue",
  ],
  gameOverHighScore: [
    "gameOverHighScore",
    "game-over-high-score",
    "finalHighScore",
  ],
  gameOverLevel: ["gameOverLevel", "game-over-level", "finalLevelValue"],
  gameOverLines: ["gameOverLines", "game-over-lines", "finalLinesValue"],
  newHighScore: [
    "newHighScore",
    "new-high-score",
    "newBestBadge",
  ],
  optionsDialog: [
    "optionsDialog",
    "options-dialog",
    "settingsDialog",
    "settings-dialog",
    "settingsOverlay",
  ],
  pauseOverlay: ["pauseOverlay", "pause-overlay"],
  liveRegion: ["liveRegion", "live-region", "announcer"],
  bpmInput: ["bpmSelect", "bpm-select", "settingsBpm", "settings-bpm"],
  bgmVolume: [
    "bgmVolume",
    "bgm-volume",
    "sequencerVolumeInput",
  ],
  seVolume: [
    "seVolume",
    "se-volume",
    "sfxVolume",
    "sfx-volume",
    "seVolumeInput",
  ],
  swipeEnabled: ["swipeEnabled", "swipe-enabled", "swipeToggle"],
  controlMethod: ["controlMethod", "control-method", "controlModeInput"],
  barSpeed: ["barSpeed", "bar-speed", "barSpeedInput"],
  debugMode: ["debugMode", "debug-mode", "debugModeToggle"],
  bgmVolumeValue: [
    "bgmVolumeValue",
    "bgm-volume-value",
    "sequencerVolumeValue",
  ],
  seVolumeValue: [
    "seVolumeValue",
    "se-volume-value",
    "sfxVolumeValue",
    "sfx-volume-value",
  ],
});

const PREVIEW_IDS = Object.freeze({
  next: ["nextList", "next-list", "nextPreview", "next-preview"],
  nextDesktop: [
    "nextListDesktop",
    "next-list-desktop",
    "nextPreviewDesktop",
    "next-preview-desktop",
  ],
  hold: ["holdPreview", "hold-preview", "holdCanvas", "hold-canvas"],
  holdDesktop: [
    "holdPreviewDesktop",
    "hold-preview-desktop",
    "holdCanvasDesktop",
    "hold-canvas-desktop",
  ],
});

function firstByIds(root, ids) {
  for (const id of ids) {
    const element = root.getElementById?.(id) ?? root.querySelector?.(`#${id}`);
    if (element) return element;
  }
  return null;
}

function allByIds(root, ids) {
  const result = [];
  const seen = new Set();
  for (const id of ids) {
    const element = root.getElementById?.(id) ?? root.querySelector?.(`#${id}`);
    if (element && !seen.has(element)) {
      seen.add(element);
      result.push(element);
    }
  }
  return result;
}

function setVisible(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.setAttribute("aria-hidden", visible ? "false" : "true");
  element.classList?.toggle("is-visible", visible);
}

function writeValue(element, value) {
  if (!element || value === undefined || value === null) return;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLOutputElement
  ) {
    element.value = String(value);
  } else {
    element.textContent = String(value);
  }
}

function numericText(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ja-JP") : String(value);
}

function getPieceType(piece) {
  return String(
    typeof piece === "string"
      ? piece
      : piece?.type ?? piece?.pieceType ?? piece?.kind ?? "",
  ).toUpperCase();
}

function getPreviewMatrix(piece) {
  const matrix = piece?.matrix ?? piece?.shape;
  if (Array.isArray(matrix) && Array.isArray(matrix[0])) return matrix;
  return PIECE_SHAPES[getPieceType(piece)] ?? [];
}

function roundedPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPreview(canvas, piece) {
  const type = getPieceType(piece);
  const matrix = getPreviewMatrix(piece);
  const cssWidth = Number(canvas.clientWidth) || 72;
  const cssHeight = Number(canvas.clientHeight) || 54;
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  canvas.style.aspectRatio ||= "4 / 3";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", type ? `${type} ミノ` : "空");
  canvas.dataset.piece = type;

  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  if (!type || !matrix.length) return;

  const occupied = [];
  matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value) occupied.push({ x, y });
    }),
  );
  if (!occupied.length) return;

  const minX = Math.min(...occupied.map((cell) => cell.x));
  const maxX = Math.max(...occupied.map((cell) => cell.x));
  const minY = Math.min(...occupied.map((cell) => cell.y));
  const maxY = Math.max(...occupied.map((cell) => cell.y));
  const cellSize = Math.min(
    (cssWidth - 8) / (maxX - minX + 1),
    (cssHeight - 8) / (maxY - minY + 1),
  );
  const pieceWidth = (maxX - minX + 1) * cellSize;
  const pieceHeight = (maxY - minY + 1) * cellSize;
  const originX = (cssWidth - pieceWidth) / 2 - minX * cellSize;
  const originY = (cssHeight - pieceHeight) / 2 - minY * cellSize;
  const color = piece?.color ?? PIECE_COLORS[type] ?? "#8a9ab5";

  for (const cell of occupied) {
    const gap = Math.max(1, cellSize * 0.06);
    const x = originX + cell.x * cellSize + gap;
    const y = originY + cell.y * cellSize + gap;
    const size = cellSize - gap * 2;
    context.save();
    context.shadowColor = color;
    context.shadowBlur = cellSize * 0.2;
    roundedPath(context, x, y, size, size, cellSize * 0.14);
    context.fillStyle = color;
    context.fill();
    const gloss = context.createLinearGradient(x, y, x, y + size);
    gloss.addColorStop(0, "rgba(255,255,255,.46)");
    gloss.addColorStop(0.4, "rgba(255,255,255,.06)");
    gloss.addColorStop(1, "rgba(0,0,0,.25)");
    roundedPath(context, x, y, size, size, cellSize * 0.14);
    context.fillStyle = gloss;
    context.fill();
    context.restore();
  }
}

/**
 * Small DOM adapter. Every element is optional, which makes it safe to use
 * while the mobile and desktop layouts expose different controls.
 */
export class GameUI {
  constructor(root = document) {
    this.root = root;
    this.elements = {};
    this._previewSignatures = new WeakMap();
    this.refresh();
  }

  refresh() {
    for (const [name, aliases] of Object.entries(ID_ALIASES)) {
      this.elements[name] = firstByIds(this.root, aliases);
    }
    this.elements.nextPreviews = allByIds(this.root, [
      ...PREVIEW_IDS.next,
      ...PREVIEW_IDS.nextDesktop,
    ]);
    this.elements.holdPreviews = allByIds(this.root, [
      ...PREVIEW_IDS.hold,
      ...PREVIEW_IDS.holdDesktop,
    ]);
    return this.elements;
  }

  updateStats({ score, level, lines, bpm, highScore } = {}) {
    if (score !== undefined) writeValue(this.elements.score, numericText(score));
    if (level !== undefined) writeValue(this.elements.level, numericText(level));
    if (lines !== undefined) writeValue(this.elements.lines, numericText(lines));
    if (bpm !== undefined) this.setBpm(bpm);
    if (highScore !== undefined) this.setHighScore(highScore);
  }

  setBpm(bpm) {
    writeValue(this.elements.bpm, bpm);
    writeValue(this.elements.bpmInput, bpm);
  }

  setHighScore(score) {
    writeValue(this.elements.highScore, numericText(score));
  }

  setNext(pieces) {
    const list = Array.isArray(pieces)
      ? pieces
      : Array.isArray(pieces?.queue)
        ? pieces.queue
        : pieces
          ? [pieces]
          : [];
    for (const target of this.elements.nextPreviews ?? []) {
      this._renderPreviewTarget(target, list, true);
    }
  }

  updateNext(pieces) {
    this.setNext(pieces);
  }

  setHold(piece) {
    const list = piece ? [piece] : [];
    for (const target of this.elements.holdPreviews ?? []) {
      this._renderPreviewTarget(target, list, false);
    }
  }

  updateHold(piece) {
    this.setHold(piece);
  }

  setLoading(value, message) {
    const options =
      typeof value === "object" && value !== null
        ? value
        : { progress: value, message };
    const loaded = Number(options.loaded);
    const total = Number(options.total);
    const progress = Number.isFinite(Number(options.progress))
      ? Number(options.progress)
      : Number.isFinite(loaded) && Number.isFinite(total) && total > 0
        ? loaded / total
        : Number.NaN;
    const progressElement = this.elements.loadingProgress;

    if (progressElement && Number.isFinite(progress)) {
      const normalized = progress > 1 ? progress / 100 : progress;
      if (progressElement instanceof HTMLProgressElement) {
        progressElement.max = 1;
        progressElement.value = Math.min(1, Math.max(0, normalized));
      } else {
        progressElement.style.setProperty(
          "--progress",
          `${Math.round(Math.min(1, Math.max(0, normalized)) * 100)}%`,
        );
        progressElement.setAttribute(
          "aria-valuenow",
          String(Math.round(normalized * 100)),
        );
      }
    }
    if (options.message !== undefined) {
      writeValue(this.elements.loadingText, options.message);
    }
    if (Number.isFinite(loaded) && Number.isFinite(total)) {
      writeValue(this.elements.loadingCount, `${loaded} / ${total}`);
    }
    if (options.visible !== undefined) {
      setVisible(this.elements.loadingScreen, options.visible);
    }
  }

  updateLoading(progress, message) {
    this.setLoading(progress, message);
  }

  setAudioStatus(message, isError = false) {
    const element = this.elements.loadingText;
    writeValue(element, message);
    element?.classList.toggle("is-error", Boolean(isError));
  }

  showScreen(name) {
    const normalized = String(name).toLowerCase();
    if (normalized === "loading") {
      setVisible(this.elements.titleScreen, true);
      setVisible(this.elements.gameScreen, false);
      setVisible(this.elements.loadingScreen, true);
      return;
    }
    const selected =
      normalized === "title" || normalized === "start"
          ? this.elements.titleScreen
          : this.elements.gameScreen;

    const declaredScreens = [
      this.elements.loadingScreen,
      this.elements.titleScreen,
      this.elements.gameScreen,
      ...(this.root.querySelectorAll?.("[data-screen]") ?? []),
    ];
    for (const screen of new Set(declaredScreens.filter(Boolean))) {
      setVisible(screen, screen === selected);
    }
  }

  showGameOver({
    score,
    level,
    lines,
    highScore,
    isHighScore = false,
  } = {}) {
    writeValue(this.elements.gameOverScore, numericText(score ?? 0));
    if (level !== undefined) {
      writeValue(this.elements.gameOverLevel, numericText(level));
    }
    if (lines !== undefined) {
      writeValue(this.elements.gameOverLines, numericText(lines));
    }
    if (highScore !== undefined) {
      writeValue(this.elements.gameOverHighScore, numericText(highScore));
      this.setHighScore(highScore);
    }
    setVisible(this.elements.newHighScore, Boolean(isHighScore));
    setVisible(this.elements.gameOver, true);
    this.announce(
      isHighScore
        ? `ゲームオーバー。新記録 ${numericText(score ?? 0)} 点`
        : `ゲームオーバー。${numericText(score ?? 0)} 点`,
    );
  }

  hideGameOver() {
    setVisible(this.elements.gameOver, false);
  }

  setPaused(paused) {
    setVisible(this.elements.pauseOverlay, Boolean(paused));
    this.root.documentElement?.classList.toggle("is-paused", Boolean(paused));
  }

  openSettings(settings = {}) {
    this.updateSettings(settings);
    const dialog = this.elements.optionsDialog;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      setVisible(dialog, true);
    }
  }

  closeSettings(returnValue) {
    const dialog = this.elements.optionsDialog;
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close(returnValue);
    } else {
      setVisible(dialog, false);
    }
  }

  updateSettings(settings = {}) {
    if (settings.bpm !== undefined) writeValue(this.elements.bpmInput, settings.bpm);
    this._writeVolume(
      this.elements.bgmVolume,
      settings.bgmVolume ?? settings.sequencerVolume,
    );
    this._writeVolume(
      this.elements.seVolume,
      settings.seVolume ?? settings.sfxVolume,
    );
    if (settings.swipeEnabled !== undefined && this.elements.swipeEnabled) {
      this.elements.swipeEnabled.checked = Boolean(settings.swipeEnabled);
    }
    if (settings.controlMethod !== undefined) {
      writeValue(this.elements.controlMethod, settings.controlMethod);
    }
    if (settings.barSpeed !== undefined) {
      writeValue(this.elements.barSpeed, settings.barSpeed);
    }
    if (settings.debugMode !== undefined && this.elements.debugMode) {
      this.elements.debugMode.checked = Boolean(settings.debugMode);
    }
    this._updateVolumeLabels();
  }

  readSettings() {
    const bgmVolume = this._readVolume(this.elements.bgmVolume);
    return {
      bpm: Number(this.elements.bpmInput?.value),
      bgmVolume,
      sequencerVolume: bgmVolume,
      seVolume: this._readVolume(this.elements.seVolume),
      swipeEnabled: Boolean(this.elements.swipeEnabled?.checked),
      controlMethod: this.elements.controlMethod?.value ?? "swipe",
      barSpeed: Number(this.elements.barSpeed?.value) || 1,
      debugMode: Boolean(this.elements.debugMode?.checked),
    };
  }

  announce(message) {
    writeValue(this.elements.liveRegion, message);
  }

  setActionEnabled(action, enabled) {
    for (const button of this.root.querySelectorAll?.(
      `[data-action="${action}"]`,
    ) ?? []) {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
    }
  }

  _renderPreviewTarget(target, pieces, isList) {
    const visiblePieces = isList ? pieces.slice(0, 3) : pieces.slice(0, 1);
    const signature = visiblePieces.map(getPieceType).join(",");
    if (this._previewSignatures.get(target) === signature) return;
    this._previewSignatures.set(target, signature);

    if (target instanceof HTMLCanvasElement) {
      drawPreview(target, visiblePieces[0] ?? null);
      return;
    }

    target.replaceChildren();
    target.dataset.empty = visiblePieces.length ? "false" : "true";
    if (!visiblePieces.length) {
      const empty = this.root.createElement("span");
      empty.className = "empty-piece piece-preview-empty";
      empty.textContent = "EMPTY";
      empty.setAttribute("aria-label", "空");
      target.append(empty);
      return;
    }

    for (const piece of visiblePieces) {
      const preview = this.root.createElement("div");
      const grid = this.root.createElement("div");
      const type = getPieceType(piece);
      const matrix = getPreviewMatrix(piece);
      const color = piece?.color ?? PIECE_COLORS[type] ?? "#8a9ab5";
      const rawCells = [];
      const occupied = new Set();
      matrix.forEach((row, y) =>
        row.forEach((value, x) => {
          if (value) rawCells.push({ x, y });
        }),
      );
      if (rawCells.length) {
        const minX = Math.min(...rawCells.map((cell) => cell.x));
        const maxX = Math.max(...rawCells.map((cell) => cell.x));
        const minY = Math.min(...rawCells.map((cell) => cell.y));
        const maxY = Math.max(...rawCells.map((cell) => cell.y));
        const offsetX = Math.floor((4 - (maxX - minX + 1)) / 2) - minX;
        const offsetY = Math.floor((4 - (maxY - minY + 1)) / 2) - minY;
        for (const cell of rawCells) {
          occupied.add(`${cell.x + offsetX}:${cell.y + offsetY}`);
        }
      }

      preview.className = "piece-preview";
      preview.dataset.piece = type;
      preview.setAttribute("role", "img");
      preview.setAttribute("aria-label", `${type} ミノ`);
      grid.className = "piece-grid";
      grid.style.setProperty("--piece-color", color);

      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const cell = this.root.createElement("i");
          if (occupied.has(`${x}:${y}`)) cell.className = "is-filled";
          grid.append(cell);
        }
      }

      preview.append(grid);
      target.append(preview);
    }
  }

  _writeVolume(element, value) {
    if (!element || value === undefined) return;
    const number = Number(value);
    const maximum = Number(element.max);
    element.value = String(maximum > 1 && number <= 1 ? number * 100 : number);
  }

  _readVolume(element) {
    if (!element) return 1;
    const number = Number(element.value);
    return Number(element.max) > 1 ? number / 100 : number;
  }

  _updateVolumeLabels() {
    if (this.elements.bgmVolume) {
      writeValue(
        this.elements.bgmVolumeValue,
        `${Math.round(this._readVolume(this.elements.bgmVolume) * 100)}%`,
      );
    }
    if (this.elements.seVolume) {
      writeValue(
        this.elements.seVolumeValue,
        `${Math.round(this._readVolume(this.elements.seVolume) * 100)}%`,
      );
    }
  }
}

export const GAME_UI_IDS = Object.freeze({
  ...ID_ALIASES,
  ...PREVIEW_IDS,
});

export default GameUI;
