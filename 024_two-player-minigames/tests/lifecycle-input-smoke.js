const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const timers = new Map(), frames = new Map(); let id = 0;
class Element {
  constructor() { this.hidden = false; this.style = {}; this.dataset = {}; this.handlers = {}; this.captures = new Set(); this.classes = new Set(); this.classList = { add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)), toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n) }; }
  setAttribute() {} focus() {} addEventListener(n, fn) { (this.handlers[n] ||= new Set()).add(fn); }
  removeEventListener(n, fn) { this.handlers[n]?.delete(fn); }
  emit(n, pointerId = 1) { for (const fn of this.handlers[n] || []) fn({ pointerId, pointerType: "touch", preventDefault() {}, stopPropagation() {} }); }
  setPointerCapture(id) { this.captures.add(id); } hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.emit("lostpointercapture", id); }
}
const window = new Element();
Object.assign(window, { setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, delay }); return key; }, clearTimeout(key) { timers.delete(key); } });
const context = vm.createContext({ window, location: { search: "" }, URLSearchParams, performance: { now: () => 1000 }, navigator: {}, requestAnimationFrame(fn) { const key = ++id; frames.set(key, fn); return key; }, cancelAnimationFrame(key) { frames.delete(key); } });
const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
load("js/game-manager.js");
const names = ["debugPanel", "testModeButton", "menuTestModeButton", "testSpeedButton", "menuScreen", "gameScreen", "resultPanel", "countdown", "p1Score", "p2Score", "resultTitle", "resultTitleTop", "resultReason", "resultReasonTop", "replayButton", "sumoCard", "canvas", "p1Control", "p2Control", "centerBadge"];
const elements = Object.fromEntries(names.map(n => [n, new Element()]));
elements.controlActions = [new Element(), new Element()]; elements.energyNames = [new Element(), new Element()];
let created = 0;
class FakeGame { constructor(options) { Object.assign(this, options); this.starts = 0; this.released = 0; created++; } resize() {} reset() {} start() { this.starts++; } releaseInputs() { this.released++; } destroy() { this.destroyed = true; this.releaseInputs(); } }
for (const n of ["SumoGame", "TugOfWarGame", "BombHotPotatoGame", "WobbleBoxingGame", "TableHockeyGame"]) window[n] = FakeGame;
const manager = new window.GameManager(elements);
manager.launch("sumo"); const old = manager.currentGame; const staleFrame = frames.get(manager.countdownFrame);
manager.showMenu(); staleFrame(); assert.equal(old.starts, 0); assert.equal(timers.size, 0); assert.equal(frames.size, 0);
manager.launch("tug"); frames.get(manager.countdownFrame)(); const match = manager.currentGame;
assert.deepEqual([...timers.values()].map(t => t.delay), [0, 680, 1360, 2040]);
const staleStart = [...timers.values()].find(t => t.delay === 2040).fn;
manager.launch("bomb"); staleStart(); assert.equal(match.starts, 0); old.onFinish(1, "stale"); assert.equal(manager.scores[0], 0);
const bomb = manager.currentGame; bomb.onFinish(1, "win"); bomb.onFinish(1, "duplicate");
assert.equal(manager.scores[0], 1); assert.equal([...timers.values()].filter(t => t.delay === 420).length, 1);
const staleResult = timers.get(manager.resultTimer).fn;
manager.showMenu(); staleResult(); assert.equal(elements.resultPanel.hidden, true); assert.equal(manager.scores[0], 0);
manager.launch("boxing"); manager.currentGame.onFinish(0, "draw"); timers.get(manager.resultTimer).fn();
assert.equal(elements.resultTitle.textContent, "DRAW!"); assert.equal(elements.resultTitleTop.textContent, "DRAW!");
const before = created; manager.replay(); manager.replay(); assert.equal(created, before + 1); assert.equal(elements.resultPanel.hidden, true);
manager.testMode = true; manager.currentGameKey = "boxing"; manager.currentGame.gameSpeed = .25;
const testGame = manager.currentGame; manager.toggleTestMode(); assert.equal(testGame.destroyed, true); assert.equal(manager.currentGame.gameSpeed, 1); assert.equal(manager.currentGame.testMode, false);
manager.showMenu();

for (const [file, className] of [["sumo.js", "SumoGame"], ["tug-of-war.js", "TugOfWarGame"], ["bomb-hot-potato.js", "BombHotPotatoGame"], ["wobble-boxing-sideview.js", "WobbleBoxingGame"], ["table-hockey.js", "TableHockeyGame"]]) {
  load("js/games/" + file); const game = Object.create(window[className].prototype);
  game.controls = [new Element(), new Element()]; game.dangers = [new Element(), new Element()]; game.canvas = new Element(); game.active = true; game.resizeObserver = { disconnect() {} };
  game.render = () => {}; game.width = 390; game.height = 520;
  if (className === "WobbleBoxingGame") {
    game.jointButtons = [0, 1].map(() => ["arm1Shoulder", "arm2Shoulder", "arm1Elbow", "arm2Elbow"].map(joint => { const b = new Element(); b.dataset.joint = joint; return b; }));
    game.players = [game.makePlayer(0), game.makePlayer(1)]; game.bindInput();
    const a = game.jointButtons[0][0], b = game.jointButtons[1][3];
    a.emit("pointerdown", 11); b.emit("pointerdown", 22); a.emit("pointerdown", 33); a.emit("pointerup", 33);
    assert.equal(game.players[0].joints.arm1Shoulder.holding, true, "ignored second finger must not release joint");
    a.emit("pointercancel", 11); assert.equal(game.players[0].joints.arm1Shoulder.holding, false); assert.equal(game.players[1].joints.arm2Elbow.holding, true);
    b.emit("lostpointercapture", 22); assert.equal(game.players[1].joints.arm2Elbow.holding, false);
    b.emit("pointerdown", 24); game.releaseInputs(); assert.equal(game.inputPointers.size, 0); assert.equal(game.players[1].joints.arm2Elbow.holding, false);
  } else if (className === "TableHockeyGame") {
    game.players = [game.makePlayer(0), game.makePlayer(1)];
    for (let i = 0; i < 2; i++) { const p = game.players[i]; assert.equal(game.claimPointer(i, 11 + i, p.x, p.y, 1000), true); }
    assert.equal(game.claimPointer(1, 11, 0, 0, 1000), false);
    game.releasePointer(11); assert.equal(game.players[1].pointerId, 12); game.releaseInputs();
    assert.ok(game.players.every(p => p.pointerId === null && p.speed === 0 && p.vx === 0 && p.vy === 0));
    continue;
  } else {
    game.players = [game.makePlayer(), game.makePlayer()]; let taps = [0, 0];
    game.tap = game.pass = index => taps[index]++; game.bindInput();
    game.controls[0].emit("pointerdown", 11); game.controls[1].emit("pointerdown", 22); game.controls[0].emit("pointerdown", 11);
    assert.deepEqual(taps, [1, 1]); game.controls[0].emit("pointerup", 11);
    if (className === "BombHotPotatoGame") assert.equal(game.players[1].pointerId, 22);
    else assert.equal(game.inputPointers.get(22), 1);
    game.releaseInputs(); assert.ok(game.controls.every(c => c.captures.size === 0));
  }
  game.destroy(); assert.ok(game.controls.every(c => c.captures.size === 0));
}
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
for (const name of ["touchmove", "touchend", "gesturestart", "dblclick"]) assert.equal(app.includes('document.addEventListener("' + name + '"'), false);
assert.ok(app.includes('window.addEventListener("blur"')); assert.match(app, /visibilitychange/);
console.log("lifecycle and independent input smoke tests passed");
