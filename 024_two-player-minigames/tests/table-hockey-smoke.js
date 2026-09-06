const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
global.navigator = {};
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const source = read("js/games/table-hockey.js");
const managerSource = read("js/game-manager.js");
const appSource = read("js/app.js");
const indexSource = read("index.html");
vm.runInThisContext(source, { filename: "table-hockey.js" });

const Game = window.TableHockeyGame;
const CONFIG = window.TABLE_HOCKEY_CONFIG;
assert.ok(Game && CONFIG);
assert.strictEqual(CONFIG.SCORE_TO_WIN, 3);
assert.ok(CONFIG.MAX_PADDLE_SPEED > 0 && CONFIG.MAX_PUCK_SPEED > 0);
assert.ok(CONFIG.MAX_SUBSTEPS > 1);
assert.match(indexSource, /id="hockeyCard"/);
assert.match(indexSource, /table-hockey\.js/);
assert.match(indexSource, /hockey\.css/);
assert.match(appSource, /launchTableHockey/);
assert.match(managerSource, /window\.TableHockeyGame/);
assert.match(managerSource, /onPaddleSound/);
assert.doesNotMatch(source, /Matter\./);

const classList = { toggle() {} };
function makeGame() {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    width: 390, height: 520, active: true, roundPaused: false, pendingWinner: 0,
    scores: [0, 0], fps: 60, debug: false, testMode: false, lastCollision: "none",
    energyBars: [{ style: {}, classList }, { style: {}, classList }],
    debugPanel: { textContent: "" }, onPaddleSound() {}, onWallSound() {}, onGoalSound() {}
  });
  game.players = [game.makePlayer(0), game.makePlayer(1)];
  game.resetPuck();
  return game;
}

let game = makeGame();
const p1Start = { x: game.players[0].x, y: game.players[0].y };
const p2Start = { x: game.players[1].x, y: game.players[1].y };
assert.strictEqual(game.claimPointer(0, 11, p1Start.x, p1Start.y, 1000), true);
assert.strictEqual(game.claimPointer(1, 22, p2Start.x, p2Start.y, 1000), true);
assert.strictEqual(game.releasePointer(11), true);
assert.strictEqual(game.players[0].pointerId, null);
assert.strictEqual(game.players[1].pointerId, 22, "releasing P1 must not release P2");

game.movePointer(1, -100, -100, 1016);
const table = game.tableBounds();
const paddleRadius = game.paddleRadius();
assert.ok(game.players[1].x >= table.left + paddleRadius);
assert.ok(game.players[1].y >= table.centerY + paddleRadius, "P2 must remain in the lower half");
game.releasePointer(22);

function collisionWithPaddleSpeed(paddleSpeed) {
  const sim = makeGame();
  const player = sim.players[0];
  player.x = 100; player.y = 100; player.vx = paddleSpeed; player.vy = 0; player.lastHitAt = 0;
  sim.puck = { x: 100 + sim.paddleRadius() + sim.puckRadius() - 1, y: 100, vx: -180, vy: 0 };
  sim.resolvePaddleCollision(player, 1000);
  return sim.puck.vx;
}
const restingHit = collisionWithPaddleSpeed(0);
const fastHit = collisionWithPaddleSpeed(430);
assert.ok(restingHit > 0, "a stationary paddle should reflect an incoming puck");
assert.ok(fastHit > restingHit * 2, "a fast paddle should produce a substantially stronger shot");

game = makeGame();
const angled = game.players[0];
angled.x = 120; angled.y = 120; angled.vx = 300; angled.vy = 180; angled.lastHitAt = 0;
const separation = game.paddleRadius() + game.puckRadius() - 1;
game.puck = { x: angled.x + separation / Math.SQRT2, y: angled.y + separation / Math.SQRT2, vx: -120, vy: -120 };
game.resolvePaddleCollision(angled, 1000);
assert.ok(game.puck.vx > 0 && game.puck.vy > 0, "contact normal must affect the shot angle");

game = makeGame();
const bounds = game.tableBounds();
game.puck.x = bounds.left + game.puckRadius() - 1;
game.puck.vx = -400;
game.resolveWalls(1000);
assert.ok(game.puck.vx > 0, "left wall should reflect the puck");

game = makeGame();
game.puck.x = (bounds.left + bounds.right) / 2;
game.puck.y = bounds.top - game.puckRadius() - 1;
game.puck.vy = -500;
game.resolveWalls(1000);
assert.deepStrictEqual(game.scores, [0, 1], "a puck entering the top P1 goal awards P2");
assert.strictEqual(game.roundMessage, "P2 SCORE!");

game = makeGame();
game.scores = [2, 0];
game.scoreGoal(0, 2000);
assert.strictEqual(game.pendingWinner, 1);
let winner = 0;
game.onFinish = (value) => { winner = value; };
game.stop = () => { game.active = false; };
game.update(0.016, game.roundEndsAt + 1);
assert.strictEqual(winner, 1, "the first player to three goals wins the match");

game = makeGame();
game.testMode = true;
game.players[0].pointerId = 41;
game.updateHud();
for (const label of ["P1 pointerId", "P1 paddle", "P2 pointerId", "puck velocity", "puck speed", "FPS", "last collision"]) {
  assert.ok(game.debugPanel.textContent.includes(label));
}

console.log("table-hockey smoke tests passed");
