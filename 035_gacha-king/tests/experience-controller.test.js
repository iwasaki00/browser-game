import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/game-state.js";
import { createGachaExperience } from "../js/experience.js";

// A small event-target fixture tests controller timing without a real clock or GUI.
class Surface extends EventTarget {
  constructor() {
    super(); this.dataset = {}; this.hidden = false; this.open = false;
    this.classes = new Set();
    this.classList = { add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
    this.style = { setProperty() {} };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture() { this.captured = null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
}

function fixture(t, mode = "normal") {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const selectors = ["#gacha-machine", "#handle", "#result-dialog", "#draw-button", "#mode-label", "#machine-hint", "#capsule-stage", "#result-card", "#open-hint", "#open-capsule", "#dispense-skip", "[data-skip]"];
  const elements = new Map(selectors.map((selector) => [selector, new Surface()]));
  const doc = new Surface();
  doc.querySelector = (selector) => elements.get(selector);
  elements.get("#result-dialog").querySelector = doc.querySelector;
  const win = new Surface();
  const previous = new Map(["document", "window", "matchMedia"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.assign(globalThis, { document: doc, window: win, matchMedia: () => ({ matches: false }) });
  t.after(() => previous.forEach((value, name) => value ? Object.defineProperty(globalThis, name, value) : delete globalThis[name]));
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const game = createGame({ storage, rng: () => .45 });
  game.setPlayMode(mode);
  const results = [];
  const experience = createGachaExperience({ game, showResult: (pending) => results.push(pending), notify() {} });
  function pointer(name, angle, id = 1) {
    const event = new Event(name, { cancelable: true });
    Object.assign(event, { pointerId: id, pointerType: "touch", button: 0,
      clientX: 50 + 40 * Math.cos(angle * Math.PI / 180), clientY: 50 + 40 * Math.sin(angle * Math.PI / 180) });
    elements.get("#handle").dispatchEvent(event);
  }
  return { game, experience, elements, results, pointer, doc, tick: (ms) => t.mock.timers.tick(ms) };
}

test("Pointer Eventsで一周の途中まで回すと購入せず、240度で一度だけ購入する", (t) => {
  const ctx = fixture(t, "careful");
  ctx.pointer("pointerdown", 0);
  ctx.pointer("pointermove", 60);
  ctx.pointer("pointerup", 60);
  assert.equal(ctx.game.getState().stats.draws, 0);
  ctx.pointer("pointerdown", 0);
  for (let angle = 30; angle <= 240; angle += 30) ctx.pointer("pointermove", angle);
  ctx.pointer("pointermove", 270);
  ctx.pointer("pointerup", 270);
  assert.equal(ctx.game.getState().stats.draws, 1);
  assert.equal(ctx.game.getState().pendingDraw.revealed, false);
  ctx.tick(1350);
  assert.equal(ctx.elements.get("#result-dialog").open, true);
  assert.equal(ctx.elements.get("#result-card").hidden, true);
  ctx.tick(10000);
  assert.equal(ctx.results.length, 0);
  ctx.experience.open(); ctx.tick(320);
  assert.equal(ctx.results.length, 1);
  assert.equal(ctx.results[0].revealed, true);
});

test("タップ連打をロックし、途中キャンセルの古いタイマーを破棄する", (t) => {
  const ctx = fixture(t);
  ctx.experience.tapTurn(); ctx.experience.tapTurn();
  ctx.tick(300);
  assert.equal(ctx.game.getState().stats.draws, 1);
  ctx.experience.open({ skip: true }); ctx.tick(0);
  assert.equal(ctx.results.length, 1);
  ctx.experience.finish();
  ctx.experience.tapTurn(); ctx.tick(100);
  ctx.experience.cancelTurn();
  ctx.tick(1000);
  assert.equal(ctx.game.getState().stats.draws, 1);
  ctx.experience.tapTurn(); ctx.tick(299);
  assert.equal(ctx.game.getState().stats.draws, 1);
  ctx.tick(1);
  assert.equal(ctx.game.getState().stats.draws, 2);
});

test("通常モードは短い自動開封で、スキップ後に古い演出が再発火しない", (t) => {
  const ctx = fixture(t);
  ctx.experience.tapTurn(); ctx.tick(300); ctx.tick(1350);
  assert.equal(ctx.results.length, 0);
  ctx.tick(750); ctx.tick(320);
  assert.equal(ctx.results.length, 1);
  ctx.experience.finish();
  ctx.experience.tapTurn(); ctx.tick(300);
  ctx.experience.open({ skip: true }); ctx.tick(0);
  ctx.tick(10000);
  assert.equal(ctx.results.length, 2);
  assert.equal(ctx.game.getState().stats.draws, 2);
});

test("画面離脱で自動演出を止め、復帰時に同じカプセルを再開する", (t) => {
  const ctx = fixture(t, "careful");
  ctx.experience.tapTurn(); ctx.tick(300);
  const before = ctx.game.getState();
  ctx.doc.hidden = true; ctx.doc.dispatchEvent(new Event("visibilitychange"));
  ctx.tick(10000);
  assert.equal(ctx.results.length, 0);
  ctx.doc.hidden = false; ctx.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(ctx.elements.get("#result-dialog").open, true);
  assert.equal(ctx.game.getState().pendingDraw.uid, before.pendingDraw.uid);
  assert.equal(ctx.game.getState().coins, before.coins);
  ctx.experience.open(); ctx.tick(320);
  assert.equal(ctx.results.length, 1);
});

test("サクサクと演出軽減は短縮し、手動モードの開封判断は維持する", (t) => {
  const ctx = fixture(t, "quick");
  ctx.experience.tapTurn(); ctx.tick(70); ctx.tick(300); ctx.tick(180); ctx.tick(120);
  assert.equal(ctx.results.length, 1);
  ctx.experience.finish();
  ctx.game.setPlayMode("careful"); ctx.game.setReducedMotion(true);
  ctx.experience.tapTurn(); ctx.tick(70); ctx.tick(300); ctx.tick(5000);
  assert.equal(ctx.results.length, 1);
  ctx.experience.finish(); // Unopened results cannot be silently dismissed.
  assert.notEqual(ctx.game.getState().pendingDraw, null);
  ctx.experience.open(); ctx.tick(0);
  assert.equal(ctx.results.length, 2);
});
