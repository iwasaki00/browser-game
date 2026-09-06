const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
const source = fs.readFileSync(path.join(__dirname, "..", "js", "games", "wobble-boxing.js"), "utf8");
const managerSource = fs.readFileSync(path.join(__dirname, "..", "js", "game-manager.js"), "utf8");
vm.runInThisContext(source, { filename: "wobble-boxing.js" });

const WobbleBoxingGame = window.WobbleBoxingGame;
const CONFIG = window.WOBBLE_BOXING_CONFIG;
assert.ok(WobbleBoxingGame);
assert.strictEqual(CONFIG.BODY_HP, 100);
assert.ok(CONFIG.HEAD_DAMAGE_MULTIPLIER > 1);
assert.ok(CONFIG.MIN_HIT_SPEED > 0);
assert.match(managerSource, /wobble-boxer-torso\.png/);
assert.match(source, /removeEventListener\("pointerdown"/);
assert.doesNotMatch(source, /Matter\./);

const game = Object.create(WobbleBoxingGame.prototype);
game.width = 390;
game.height = 520;
const p1 = game.makePlayer(0);
const p2 = game.makePlayer(1);
const first = game.calculateArms(p1);
p1.joints.leftShoulder.angle += .45;
const moved = game.calculateArms(p1);
assert.notStrictEqual(first.left.hand.x, moved.left.hand.x, "shoulder angle must move the fist");
assert.notStrictEqual(first.left.hand.y, moved.left.hand.y, "two-link arm must update fist coordinates");

const farArm = () => ({ shoulder: { x: -100, y: -100 }, elbow: { x: -80, y: -80 }, hand: { x: -60, y: -60 }, vx: 0, vy: 0, speed: 0, lastHitAt: 0 });
const attackArm = (point, speed = 150) => ({ shoulder: { x: point.x, y: point.y - 50 }, elbow: { x: point.x, y: point.y - 25 }, hand: { x: point.x, y: point.y }, vx: 0, vy: speed, speed, lastHitAt: 0 });

const makeCombat = () => {
  const combat = Object.create(WobbleBoxingGame.prototype);
  combat.width = 390;
  combat.height = 520;
  combat.active = true;
  combat.players = [combat.makePlayer(0), combat.makePlayer(1)];
  combat.players.forEach((player) => { player.arms = { left: farArm(), right: farArm() }; });
  combat.shake = 0;
  combat.impact = null;
  combat.onPunchSound = () => {};
  combat.onBlockSound = () => {};
  combat.finish = () => {};
  return combat;
};

let combat = makeCombat();
let target = combat.targetGeometry(combat.players[1]);
combat.players[0].arms.left = attackArm(target.head);
combat.resolveHits(1000);
const headDamage = CONFIG.BODY_HP - combat.players[1].hp;
assert.ok(headDamage > 0, "a fast fist should damage the head");

combat = makeCombat();
target = combat.targetGeometry(combat.players[1]);
const bodyPoint = { x: target.body.x, y: target.body.y + target.body.radius * .7 };
combat.players[0].arms.left = attackArm(bodyPoint);
combat.resolveHits(1000);
const bodyDamage = CONFIG.BODY_HP - combat.players[1].hp;
assert.ok(bodyDamage > 0, "a fast fist should damage the body");
assert.ok(headDamage > bodyDamage, "head damage should exceed body damage");

combat = makeCombat();
target = combat.targetGeometry(combat.players[1]);
combat.players[0].arms.left = attackArm(target.head);
combat.players[1].arms.left = {
  shoulder: { x: target.head.x - 20, y: target.head.y },
  elbow: { x: target.head.x, y: target.head.y },
  hand: { x: target.head.x + 20, y: target.head.y },
  vx: 0, vy: 0, speed: 0, lastHitAt: 0
};
combat.resolveHits(1000);
assert.strictEqual(combat.players[1].hp, CONFIG.BODY_HP, "an arm in front of the target should guard the hit");

console.log("wobble-boxing smoke tests passed");
