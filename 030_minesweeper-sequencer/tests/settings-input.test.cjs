const test = require("node:test");
const assert = require("node:assert/strict");
const Settings = require("../settings.js");
const Input = require("../input-controller.js");

test("board presets produce their specified dimensions", () => {
  const expected = {
    COMPACT: [6, 8],
    STANDARD: [8, 8],
    WIDE: [8, 12],
    "16 STEP": [8, 16],
    LARGE: [10, 12]
  };
  Object.entries(expected).forEach(([preset, [rows, steps]]) => {
    const settings = Settings.normalizeSettings({ preset, difficulty: "NORMAL" });
    assert.deepEqual([settings.rows, settings.steps], [rows, steps]);
  });
});

test("difficulty calculates approximately 12, 16, and 22 percent mines", () => {
  const total = 120;
  assert.equal(Settings.calculateMines(10, 12, "EASY"), Math.round(total * 0.12));
  assert.equal(Settings.calculateMines(10, 12, "NORMAL"), Math.round(total * 0.16));
  assert.equal(Settings.calculateMines(10, 12, "HARD"), Math.round(total * 0.22));
  assert.equal(Settings.calculateMines(8, 8, "NORMAL"), 10);
});

test("custom values are applied and invalid values are clamped", () => {
  const settings = Settings.normalizeSettings({
    preset: "CUSTOM",
    rows: 99,
    steps: -4,
    difficulty: "CUSTOM",
    mines: 999,
    fixedBpm: 999,
    touchMode: "INVALID",
    boardView: "INVALID"
  });
  assert.equal(settings.rows, 12);
  assert.equal(settings.steps, 6);
  assert.equal(settings.mines, 71);
  assert.equal(settings.fixedBpm, 150);
  assert.equal(settings.touchMode, "STANDARD");
  assert.equal(settings.boardView, "FIT");
});

test("settings save and load round-trip through storage", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  Settings.saveSettings({
    preset: "16 STEP",
    difficulty: "HARD",
    randomBpm: false,
    fixedBpm: 133,
    touchMode: "FLICK",
    boardView: "SCROLL",
    followPlayhead: false
  }, storage);
  const loaded = Settings.loadSettings(storage);
  assert.deepEqual({
    preset: loaded.preset,
    rows: loaded.rows,
    steps: loaded.steps,
    mines: loaded.mines,
    fixedBpm: loaded.fixedBpm,
    touchMode: loaded.touchMode,
    boardView: loaded.boardView,
    followPlayhead: loaded.followPlayhead
  }, {
    preset: "16 STEP",
    rows: 8,
    steps: 16,
    mines: 28,
    fixedBpm: 133,
    touchMode: "FLICK",
    boardView: "SCROLL",
    followPlayhead: false
  });
});

test("corrupt stored settings fall back safely", () => {
  const storage = { getItem: () => "{broken", setItem() {} };
  assert.deepEqual(Settings.loadSettings(storage), Settings.normalizeSettings(Settings.DEFAULTS));
});

test("touch mode tap interpretation maps to game actions", () => {
  assert.equal(Input.tapAction("STANDARD", { pointerType: "touch" }), Input.ACTIONS.OPEN);
  assert.equal(Input.longPressAction("STANDARD"), Input.ACTIONS.TOGGLE_FLAG);
  assert.equal(Input.tapAction("SWITCH", { pointerType: "touch", switchAction: "FLAG" }), Input.ACTIONS.TOGGLE_FLAG);
  assert.equal(Input.tapAction("SWITCH", { pointerType: "touch", switchAction: "OPEN" }), Input.ACTIONS.OPEN);
  assert.equal(Input.tapAction("TWO HAND", { pointerType: "touch", modifier: "FLAG" }), Input.ACTIONS.TOGGLE_FLAG);
  assert.equal(Input.tapAction("TWO HAND", { pointerType: "touch" }), Input.ACTIONS.OPEN);
  assert.equal(Input.tapAction("DOUBLE TAP", { pointerType: "touch" }), Input.ACTIONS.WAIT_FOR_DOUBLE);
  assert.equal(Input.doubleTapAction("DOUBLE TAP"), Input.ACTIONS.TOGGLE_FLAG);
});

test("flick interpretation uses only dominant vertical gestures", () => {
  assert.equal(Input.flickAction(2, -30), Input.ACTIONS.SET_FLAG);
  assert.equal(Input.flickAction(2, 30), Input.ACTIONS.REMOVE_FLAG);
  assert.equal(Input.flickAction(4, 5), Input.ACTIONS.OPEN);
  assert.equal(Input.flickAction(40, 8), Input.ACTIONS.NONE);
});
