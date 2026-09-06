const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
const source = fs.readFileSync(path.join(__dirname, "..", "js", "games", "bomb-push.js"), "utf8");
const managerSource = fs.readFileSync(path.join(__dirname, "..", "js", "game-manager.js"), "utf8");
vm.runInThisContext(source, { filename: "bomb-push.js" });

const BombPushGame = window.BombPushGame;
const CONFIG = window.BOMB_PUSH_CONFIG;
assert.ok(BombPushGame);
assert.ok(CONFIG.BOMB_MIN_EXPLOSION_TIME >= 4500);
assert.ok(CONFIG.BOMB_MAX_EXPLOSION_TIME > CONFIG.BOMB_MIN_EXPLOSION_TIME);
assert.match(managerSource, /bomb-topdown\.png/);

const classList = { add() {}, remove() {}, toggle() {} };
const makePlayer = () => ({ pointerId: null, chargeStartedAt: 0, chargeTime: 0, lastPushAt: 0, lastTapInterval: 0, pulse: 0 });
const makeGame = () => {
  const game = Object.create(BombPushGame.prototype);
  game.active = true;
  game.exploding = false;
  game.bombPosition = 0;
  game.bombVelocity = 0;
  game.elapsed = 0;
  game.explosionTime = 10000;
  game.lastFuseAt = 0;
  game.shake = 0;
  game.players = [makePlayer(), makePlayer()];
  game.controls = [{ classList, offsetWidth: 10 }, { classList, offsetWidth: 10 }];
  game.energyBars = [{ style: {}, classList }, { style: {}, classList }];
  game.dangers = [{ classList }, { classList }];
  game.onTapSound = () => {};
  game.onChargeSound = () => {};
  game.onFuseSound = () => {};
  game.updateHud = () => {};
  return game;
};

let game = makeGame();
game.applyPush(0, CONFIG.TAP_POWER, 500, false);
assert.ok(game.bombVelocity > 0, "P1 should push toward the lower P2 side");

game = makeGame();
game.applyPush(1, CONFIG.TAP_POWER, 500, false);
assert.ok(game.bombVelocity < 0, "P2 should push toward the upper P1 side");

game = makeGame();
game.players[0].lastPushAt = 950;
game.applyPush(0, CONFIG.TAP_POWER, 1000, false);
assert.strictEqual(game.bombVelocity, CONFIG.TAP_POWER * CONFIG.RAPID_TAP_MULTIPLIER);

game = makeGame();
game.players[0].pointerId = 7;
game.players[0].chargeStartedAt = 0;
game.release(0, CONFIG.MAX_CHARGE_TIME);
assert.ok(game.bombVelocity > CONFIG.TAP_POWER, "a full charge should be stronger than a tap");

game = makeGame();
let winner = null;
game.active = false;
game.exploding = true;
game.explosionStartedAt = 0;
game.bombPosition = -.25;
game.onFinish = (value) => { winner = value; };
game.updateExplosion(CONFIG.EXPLOSION_DURATION + 1);
assert.strictEqual(winner, 2, "an explosion on the P1 side should award P2");

game = makeGame();
winner = null;
game.active = false;
game.exploding = true;
game.explosionStartedAt = 0;
game.bombPosition = 0;
game.onFinish = (value) => { winner = value; };
game.updateExplosion(CONFIG.EXPLOSION_DURATION + 1);
assert.strictEqual(winner, 0, "an explosion on the center line should draw");

console.log("bomb-push smoke tests passed");
