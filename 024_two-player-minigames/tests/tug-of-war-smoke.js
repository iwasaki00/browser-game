const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
const source = fs.readFileSync(path.join(__dirname, "..", "js", "games", "tug-of-war.js"), "utf8");
const managerSource = fs.readFileSync(path.join(__dirname, "..", "js", "game-manager.js"), "utf8");
vm.runInThisContext(source, { filename: "tug-of-war.js" });

const TugOfWarGame = window.TugOfWarGame;
const CONFIG = window.TUG_OF_WAR_CONFIG;
assert.ok(TugOfWarGame);
assert.strictEqual(CONFIG.STAMINA_MAX, 100);
assert.ok(CONFIG.GOOD_MIN_INTERVAL < CONFIG.GOOD_MAX_INTERVAL);
assert.match(managerSource, /tug-puller-cyan\.webp/);
assert.match(managerSource, /tug-puller-coral\.webp/);
assert.doesNotMatch(source, /ctx\.ellipse\(0, size \* \.14/);

const classList = { add() {}, remove() {}, toggle() {} };
const makePlayer = () => ({
  stamina: 100, lastTap: 0, interval: 0, currentPower: 0, pull: 0,
  recentTaps: [], feedback: "", feedbackUntil: 0
});
const makeGame = () => {
  const game = Object.create(TugOfWarGame.prototype);
  game.active = true; game.ropePosition = 0; game.ropeVelocity = 0; game.elapsed = 0;
  game.lastRumbleAt = 0; game.shake = 0; game.fps = 60;
  game.players = [makePlayer(), makePlayer()];
  game.controls = [{ classList }, { classList }];
  game.energyBars = [{ style: {}, classList }, { style: {}, classList }];
  game.dangers = [{ classList }, { classList }];
  game.onTapSound = () => {}; game.onGoodSound = () => {}; game.onImpactSound = () => {};
  game.updateHud = () => {};
  return game;
};

let game = makeGame();
game.players[0].lastTap = 500;
game.tap(0, 800);
const goodPower = game.players[0].currentPower;
assert.ok(game.ropeVelocity > 0, "P1 should pull toward the lower P1 win line");
assert.strictEqual(game.players[0].feedback, "GOOD!");

game = makeGame();
game.players[0].lastTap = 750;
game.tap(0, 800);
assert.ok(game.players[0].currentPower < goodPower, "rapid tapping should be less efficient than a good pull");

game = makeGame();
game.tap(1, 800);
assert.ok(game.ropeVelocity < 0, "P2 should pull toward the upper P2 win line");

game = makeGame();
game.players[0].stamina = 50;
game.update(.5, 1000);
assert.ok(game.players[0].stamina > 50, "stamina should recover over time");

game = makeGame();
let winner = null;
game.finish = (value) => { winner = value; };
game.ropePosition = CONFIG.WIN_POSITION + 1;
game.update(.016, 1000);
assert.strictEqual(winner, 1, "crossing the lower line should award P1");

game = makeGame();
winner = null;
game.finish = (value) => { winner = value; };
game.ropePosition = -CONFIG.WIN_POSITION - 1;
game.update(.016, 1000);
assert.strictEqual(winner, 2, "crossing the upper line should award P2");

console.log("tug-of-war smoke tests passed");
