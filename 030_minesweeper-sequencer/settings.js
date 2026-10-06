(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MinesweeperSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  const STORAGE_KEY = "minesweeper-sequencer.settings.v3";
  const PRESETS = { COMPACT: { rows: 6, steps: 8 }, STANDARD: { rows: 8, steps: 8 }, WIDE: { rows: 8, steps: 12 }, "16 STEP": { rows: 8, steps: 16 }, LARGE: { rows: 10, steps: 12 } };
  const DENSITIES = { EASY: 0.12, NORMAL: 0.16, HARD: 0.22 };
  const TOUCH_MODES = ["STANDARD", "SWITCH", "TWO HAND", "DOUBLE TAP"];
  const BOARD_VIEWS = ["FIT", "SCROLL", "COMPACT"];
  const DIFFICULTIES = ["EASY", "NORMAL", "HARD", "CUSTOM"];
  const PRESET_NAMES = [...Object.keys(PRESETS), "CUSTOM"];
  const DEFAULTS = { preset: "STANDARD", rows: 8, steps: 8, difficulty: "NORMAL", mines: 10, randomBpm: true, fixedBpm: 120, touchMode: "STANDARD", boardView: "FIT", followPlayhead: false };
  function clampInteger(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }
  function calculateMines(rows, steps, difficulty) {
    if (rows === 8 && steps === 8 && difficulty === "NORMAL") return 10;
    const density = DENSITIES[difficulty] || DENSITIES.NORMAL;
    return Math.max(1, Math.round(rows * steps * density));
  }
  function normalizeSettings(input = {}) {
    const preset = PRESET_NAMES.includes(input.preset) ? input.preset : DEFAULTS.preset;
    const presetSize = PRESETS[preset];
    const rows = presetSize ? presetSize.rows : clampInteger(input.rows, 6, 12, DEFAULTS.rows);
    const steps = presetSize ? presetSize.steps : clampInteger(input.steps, 6, 16, DEFAULTS.steps);
    const difficulty = DIFFICULTIES.includes(input.difficulty) ? input.difficulty : DEFAULTS.difficulty;
    const maximumMines = Math.max(1, rows * steps - 1);
    const mines = difficulty === "CUSTOM" ? clampInteger(input.mines, 1, maximumMines, Math.min(DEFAULTS.mines, maximumMines)) : Math.min(maximumMines, calculateMines(rows, steps, difficulty));
    const requestedView = BOARD_VIEWS.includes(input.boardView) ? input.boardView : DEFAULTS.boardView;
    const boardView = steps > 8 && requestedView === "FIT" ? "SCROLL" : requestedView;
    return { preset, rows, steps, difficulty, mines, randomBpm: typeof input.randomBpm === "boolean" ? input.randomBpm : DEFAULTS.randomBpm, fixedBpm: clampInteger(input.fixedBpm, 90, 150, DEFAULTS.fixedBpm), touchMode: TOUCH_MODES.includes(input.touchMode) ? input.touchMode : DEFAULTS.touchMode, boardView, followPlayhead: typeof input.followPlayhead === "boolean" ? input.followPlayhead : DEFAULTS.followPlayhead };
  }
  function mineDensity(settings) { return settings.mines / (settings.rows * settings.steps); }
  function loadSettings(storage) {
    try {
      const source = storage || root.localStorage;
      return normalizeSettings(JSON.parse(source.getItem(STORAGE_KEY) || "{}"));
    } catch (_) { return normalizeSettings(DEFAULTS); }
  }
  function saveSettings(settings, storage) {
    const normalized = normalizeSettings(settings);
    try { (storage || root.localStorage).setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) { /* Storage may be unavailable. */ }
    return normalized;
  }
  function toGameOptions(settings) {
    const normalized = normalizeSettings(settings);
    return { rows: normalized.rows, columns: normalized.steps, mineCount: normalized.mines, ...(normalized.randomBpm ? {} : { bpm: normalized.fixedBpm }) };
  }
  return { STORAGE_KEY, PRESETS, DENSITIES, TOUCH_MODES, BOARD_VIEWS, DIFFICULTIES, PRESET_NAMES, DEFAULTS, clampInteger, calculateMines, normalizeSettings, mineDensity, loadSettings, saveSettings, toGameOptions };
});
