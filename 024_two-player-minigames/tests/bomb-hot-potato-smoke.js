const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
global.navigator = {};
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const source = read("js/games/bomb-hot-potato.js");
const managerSource = read("js/game-manager.js");
const appSource = read("js/app.js");
const indexSource = read("index.html");
vm.runInThisContext(source, { filename: "bomb-hot-potato.js" });

const Game = window.BombHotPotatoGame;
const CONFIG = window.BOMB_HOT_POTATO_CONFIG;
assert.ok(Game && CONFIG);
assert.ok(CONFIG.MIN_EXPLOSION_TIME >= 5000);
assert.ok(CONFIG.MAX_EXPLOSION_TIME > CONFIG.MIN_EXPLOSION_TIME);
assert.ok(CONFIG.PASS_COOLDOWN >= 300 && CONFIG.PASS_COOLDOWN <= 500);
assert.ok(CONFIG.PASS_ANIMATION_TIME >= 200 && CONFIG.PASS_ANIMATION_TIME <= 400);
assert.match(indexSource, /爆弾ホットポテト/);
assert.match(indexSource, /bomb-hot-potato\.js/);
assert.doesNotMatch(indexSource, /爆弾押し付け/);
assert.match(appSource, /launchBombHotPotato/);
assert.match(managerSource, /window\.BombHotPotatoGame/);
assert.doesNotMatch(source, /bombVelocity|TAP_POWER|CHARGE_POWER|pushForce|applyPush/);

const classList = { add() {}, remove() {}, toggle() {} };
const control = () => ({ classList, offsetWidth: 10 });
function makeGame() {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    width: 390, height: 520, active: true, exploding: false, bombOwner: 0,
    startedAt: 1000, elapsed: 0, explosionTime: 8000, explosionAt: 9000,
    lastFuseAt: 0, lastPassPlayer: null, passCount: 0, transit: null,
    fakeSparkUntil: 0, shake: 0, fps: 60, debug: false, testMode: false, testExplosionTime: 0,
    controls: [control(), control()], actionLabels: [{ textContent: "" }, { textContent: "" }],
    energyBars: [{ style: {}, classList }, { style: {}, classList }],
    dangers: [{ classList }, { classList }], debugPanel: { textContent: "" },
    onPassSound() {}, onFuseSound() {}, onExplosionSound() {}
  });
  game.players = [game.makePlayer(), game.makePlayer()];
  return game;
}

let game = makeGame();
const fixedDeadline = game.explosionAt;
assert.strictEqual(game.pass(0, 2000), true);
assert.strictEqual(game.bombOwner, 1);
assert.strictEqual(game.explosionAt, fixedDeadline, "PASS must never reset the explosion deadline");
assert.strictEqual(game.lastPassPlayer, 0);
assert.strictEqual(game.passCount, 1);
assert.strictEqual(game.pass(1, 2200), false, "the receiver must respect PASS cooldown");
assert.strictEqual(game.bombOwner, 1);
assert.strictEqual(game.pass(1, 2000 + CONFIG.PASS_COOLDOWN + 1), true);
assert.strictEqual(game.bombOwner, 0);
assert.strictEqual(game.explosionAt, fixedDeadline);

game = makeGame();
assert.strictEqual(game.pass(1, 1500), false, "the non-owner cannot PASS");
assert.strictEqual(game.bombOwner, 0);

game = makeGame();
game.testMode = true;
game.testExplosionTime = 3000;
assert.strictEqual(game.chooseExplosionTime(), 3000);
game.setTestExplosionTime(5000);
assert.strictEqual(game.explosionAt, game.startedAt + 5000);

game = makeGame();
game.bombOwner = 1;
game.active = false;
game.exploding = true;
game.explosionStartedAt = 1000;
let winner = 0;
let reason = "";
game.onFinish = (value, detail) => { winner = value; reason = detail; };
game.updateExplosion(1000 + CONFIG.EXPLOSION_DURATION + 1);
assert.strictEqual(winner, 1, "if P2 holds the bomb, P1 wins");
assert.match(reason, /P2/);

game = makeGame();
game.bombOwner = 0;
game.explosionAt = 1500;
let exploded = false;
game.explode = () => { exploded = true; };
game.update(.016, 1501);
assert.strictEqual(exploded, true);

game = makeGame();
game.updateHud(2000);
assert.strictEqual(game.debugPanel.textContent, "", "normal mode must not expose the exact timer");
game.testMode = true;
game.updateHud(2000);
for (const label of ["bombOwner", "elapsedTime", "explosionAt", "timeRemaining", "passCooldown P1", "passCooldown P2", "lastPassPlayer", "passCount"]) {
  assert.ok(game.debugPanel.textContent.includes(label));
}

console.log("bomb-hot-potato smoke tests passed");
