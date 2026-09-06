const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
const source = fs.readFileSync(path.join(__dirname, "..", "js", "games", "wobble-boxing.js"), "utf8");
const managerSource = fs.readFileSync(path.join(__dirname, "..", "js", "game-manager.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8");
const boxingCss = fs.readFileSync(path.join(__dirname, "..", "css", "boxing.css"), "utf8");
vm.runInThisContext(source, { filename: "wobble-boxing.js" });

const WobbleBoxingGame = window.WobbleBoxingGame;
const CONFIG = window.WOBBLE_BOXING_CONFIG;
assert.ok(WobbleBoxingGame);
assert.strictEqual(CONFIG.BODY_HP, 100);
assert.ok(CONFIG.HEAD_DAMAGE_MULTIPLIER > 1);
assert.ok(CONFIG.MIN_HIT_SPEED > 0);
assert.ok(CONFIG.SHOULDER_TORQUE > 0);
assert.ok(CONFIG.ELBOW_TORQUE > CONFIG.SHOULDER_TORQUE);
assert.ok(CONFIG.JOINT_FRICTION > 0 && CONFIG.JOINT_FRICTION < 1);
assert.ok(CONFIG.UPPER_ARM_LENGTH <= .62);
assert.ok(CONFIG.FOREARM_LENGTH <= .6);
assert.ok(CONFIG.BLOCK_DAMAGE_MULTIPLIER <= .2);
assert.match(managerSource, /wobble-boxer-torso\.png/);
assert.match(managerSource, /params\.get\("test"\) === "1"/);
assert.match(managerSource, /testMode: boxing && this\.testMode/);
assert.match(indexSource, /id="menuTestModeButton"/);
assert.match(indexSource, /id="testModeButton"/);
assert.match(appSource, /manager\.toggleTestMode\(\)/);
assert.match(styleSource, /\.test-mode-button\[aria-pressed="true"\]/);
assert.match(source, /removeEventListener\("pointerdown"/);
assert.doesNotMatch(source, /Matter\./);
assert.match(boxingCss, /\.countdown\s*\{[\s\S]*?z-index:\s*12/);
assert.match(boxingCss, /\.control-zone::before\s*\{[\s\S]*?pointer-events:\s*none/);
assert.match(boxingCss, /\.joint-grid\s*\{[\s\S]*?position:\s*relative/);
assert.match(boxingCss, /\.joint-direction\s*\{[\s\S]*?display:\s*none/);
assert.match(source, /drawGlove\(/);
assert.doesNotMatch(source, /direction \*= -1/);

global.location = { search: "" };
vm.runInThisContext(managerSource, { filename: "game-manager.js" });
const makeToggle = () => ({
  textContent: "",
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; }
});
const liveTestButton = makeToggle();
const menuTestButton = makeToggle();
const debugPanel = { hidden: true };
const manager = new window.GameManager({ testModeButton: liveTestButton, menuTestModeButton: menuTestButton, debugPanel });
let hudRefreshes = 0;
let renders = 0;
manager.currentGameKey = "boxing";
manager.currentGame = { testMode: false, updateHud() { hudRefreshes += 1; }, render() { renders += 1; } };
manager.toggleTestMode();
assert.strictEqual(manager.testMode, true);
assert.strictEqual(manager.currentGame.testMode, true);
assert.strictEqual(liveTestButton.textContent, "TEST ON");
assert.strictEqual(menuTestButton.attributes["aria-pressed"], "true");
assert.strictEqual(debugPanel.hidden, false);
assert.strictEqual(hudRefreshes, 1);
assert.strictEqual(renders, 1);
manager.toggleTestMode();
assert.strictEqual(manager.testMode, false);
assert.strictEqual(debugPanel.hidden, true);

const game = Object.create(WobbleBoxingGame.prototype);
game.width = 390;
game.height = 520;
const p1 = game.makePlayer(0);
const p2 = game.makePlayer(1);
const first = game.calculateArms(p1);
const second = game.calculateArms(p2);
const ownHead = game.targetGeometry(p1).head;
assert.strictEqual(p1.joints.leftShoulder.angle, CONFIG.GUARD_SHOULDER_ANGLE);
assert.strictEqual(p1.joints.rightShoulder.angle, -CONFIG.GUARD_SHOULDER_ANGLE);
assert.ok(first.left.shoulder.x > first.right.shoulder.x, "top player's left arm must be on their own left");
assert.ok(second.left.shoulder.x < second.right.shoulder.x, "bottom player's left arm must be on their own left");
assert.ok(game.distance(first.left.hand, ownHead) < game.characterScale() * .5, "left fist must begin beside the head in guard");
assert.ok(game.distance(first.right.hand, ownHead) < game.characterScale() * .5, "right fist must begin beside the head in guard");
p1.joints.leftShoulder.angle += .45;
const moved = game.calculateArms(p1);
assert.notStrictEqual(first.left.hand.x, moved.left.hand.x, "shoulder angle must move the fist");
assert.notStrictEqual(first.left.hand.y, moved.left.hand.y, "two-link arm must update fist coordinates");

const targetAtRest = game.targetGeometry(p2);
let aimedArm = game.calculateArms(p1).left;
p1.joints.leftShoulder.angle = Math.atan2(
  targetAtRest.head.x - aimedArm.shoulder.x,
  targetAtRest.head.y - aimedArm.shoulder.y
) - p1.facing;
p1.joints.leftElbow.angle = 0;
aimedArm = game.calculateArms(p1).left;
assert.ok(
  game.distance(aimedArm.hand, targetAtRest.head) <= targetAtRest.head.radius + targetAtRest.fistRadius,
  "a fully extended arm must be able to reach the opponent's head"
);

const motion = Object.create(WobbleBoxingGame.prototype);
motion.width = 390;
motion.height = 520;
motion.active = true;
motion.elapsed = 0;
motion.lastClashAt = 0;
motion.shake = 0;
motion.impact = null;
motion.players = [motion.makePlayer(0), motion.makePlayer(1)];
motion.players.forEach((player) => { player.arms = motion.calculateArms(player); });
motion.resolveHits = () => {};
motion.resolveArmClash = () => {};
motion.updateHud = () => {};
const shoulderBefore = motion.players[0].joints.leftShoulder.angle;
motion.players[0].joints.leftShoulder.holding = true;
motion.update(.1, 1000);
assert.ok(motion.players[0].joints.leftShoulder.angle < shoulderBefore, "holding a joint control must rotate that joint");
const poweredAngle = motion.players[0].joints.leftShoulder.angle;
const poweredVelocity = motion.players[0].joints.leftShoulder.angularVelocity;
motion.players[0].joints.leftShoulder.holding = false;
motion.update(.05, 1050);
assert.ok(motion.players[0].joints.leftShoulder.angle < poweredAngle, "a released joint must keep rotating through inertia");
assert.ok(
  motion.players[0].joints.leftShoulder.angularVelocity < 0
    && motion.players[0].joints.leftShoulder.angularVelocity > poweredVelocity,
  "joint inertia must decay through friction"
);
const releasedDistance = Math.abs(motion.players[0].joints.leftShoulder.angle - motion.guardAngle("leftShoulder"));
for (let index = 0; index < 120; index += 1) motion.update(1 / 60, 1100 + index * 16.7);
assert.ok(
  Math.abs(motion.players[0].joints.leftShoulder.angle - motion.guardAngle("leftShoulder")) < releasedDistance,
  "a released joint must return toward its guard angle"
);

const twist = Object.create(WobbleBoxingGame.prototype);
twist.width = 390;
twist.height = 520;
twist.active = true;
twist.elapsed = 0;
twist.shake = 0;
twist.impact = null;
twist.players = [twist.makePlayer(0), twist.makePlayer(1)];
twist.players.forEach((player) => { player.arms = twist.calculateArms(player); });
twist.resolveHits = () => {};
twist.resolveArmClash = () => {};
twist.updateHud = () => {};
twist.players[0].joints.leftShoulder.holding = true;
for (let index = 0; index < 45; index += 1) twist.update(1 / 60, 1000 + index * 16.7);
assert.ok(Math.abs(twist.players[0].bodyAngle) > .025, "shoulder drive must rotate the torso");
assert.ok(Math.abs(twist.players[0].bodyAngle) <= CONFIG.BODY_MAX_ROTATION, "torso rotation must stay subtle");

const punchPlayer = game.makePlayer(0);
punchPlayer.joints.leftShoulder.angularVelocity = -2;
punchPlayer.joints.leftElbow.angularVelocity = 3;
let punch = game.classifyPunch(punchPlayer, "left", { vx: 15, vy: 220, speed: 221 }, .95);
assert.strictEqual(punch.type, "STRAIGHT", "coordinated shoulder and elbow drive must produce a straight");
punchPlayer.joints.leftElbow.angle = 1;
punch = game.classifyPunch(punchPlayer, "left", { vx: 210, vy: 70, speed: 221 }, .35);
assert.strictEqual(punch.type, "HOOK", "fast lateral motion with a bent elbow must produce a hook");

const testHud = Object.create(WobbleBoxingGame.prototype);
testHud.width = 390;
testHud.height = 520;
testHud.testMode = true;
testHud.debug = false;
testHud.players = [testHud.makePlayer(0), testHud.makePlayer(1)];
testHud.players.forEach((player) => { player.arms = testHud.calculateArms(player); });
testHud.energyBars = [0, 1].map(() => ({ style: {}, classList: { toggle() {} } }));
testHud.debugPanel = { textContent: "" };
testHud.updateHud();
assert.match(testHud.debugPanel.textContent, /TEST MODE  TIME/);
assert.ok(testHud.debugPanel.textContent.includes("\u5de6\u80a9"));
assert.ok(testHud.debugPanel.textContent.includes("\u53f3\u8098"));

const endless = Object.create(WobbleBoxingGame.prototype);
endless.width = 390;
endless.height = 520;
endless.active = true;
endless.testMode = true;
endless.elapsed = CONFIG.TIME_LIMIT - .01;
endless.shake = 0;
endless.impact = null;
endless.players = [endless.makePlayer(0), endless.makePlayer(1)];
endless.players.forEach((player) => { player.arms = endless.calculateArms(player); });
endless.resolveHits = () => {};
endless.resolveArmClash = () => {};
endless.updateHud = () => {};
let testModeFinished = false;
endless.finish = () => { testModeFinished = true; };
endless.update(.05, 1000);
assert.strictEqual(testModeFinished, false, "test mode must not finish at the normal time limit");

const timed = Object.create(WobbleBoxingGame.prototype);
Object.assign(timed, {
  width: 390,
  height: 520,
  active: true,
  testMode: false,
  elapsed: CONFIG.TIME_LIMIT - .01,
  shake: 0,
  impact: null
});
timed.players = [timed.makePlayer(0), timed.makePlayer(1)];
timed.players.forEach((player) => { player.arms = timed.calculateArms(player); });
timed.resolveHits = () => {};
timed.resolveArmClash = () => {};
timed.updateHud = () => {};
let normalModeFinished = false;
timed.finish = () => { normalModeFinished = true; };
timed.update(.05, 1000);
assert.strictEqual(normalModeFinished, true, "normal mode must keep the existing time limit");

const crossingA = { shoulder: { x: 100, y: 100 }, elbow: { x: 120, y: 120 }, hand: { x: 200, y: 200 } };
const crossingB = { shoulder: { x: 200, y: 100 }, elbow: { x: 180, y: 120 }, hand: { x: 100, y: 200 } };
const quietArm = () => ({ shoulder: { x: -100, y: -100 }, elbow: { x: -80, y: -80 }, hand: { x: -60, y: -60 }, vx: 0, vy: 0, speed: 0, lastHitAt: 0 });
assert.ok(game.armCollision(crossingA, crossingB, 100), "crossing upper arms and forearms must collide");

const clash = Object.create(WobbleBoxingGame.prototype);
clash.width = 390;
clash.height = 520;
clash.players = [clash.makePlayer(0), clash.makePlayer(1)];
clash.players.forEach((player) => {
  player.previousJointAngles = Object.fromEntries(Object.entries(player.joints).map(([name, joint]) => [name, joint.angle]));
});
clash.players[0].joints.leftShoulder.angularVelocity = 1;
clash.players[1].joints.leftShoulder.angularVelocity = -1;
clash.players[0].arms = { left: { ...crossingA, vx: 80, vy: 80, speed: 113, lastHitAt: 0 }, right: quietArm() };
clash.players[1].arms = { left: { ...crossingB, vx: -80, vy: 80, speed: 113, lastHitAt: 0 }, right: quietArm() };
clash.onBlockSound = () => {};
clash.resolveArmClash(1000);
assert.ok(clash.blockedPunches.has("0:left") && clash.blockedPunches.has("1:left"), "colliding arms must block both punches");
assert.ok(clash.players[0].joints.leftShoulder.angularVelocity < 0, "arm collision must bounce the joint back");

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
const blockedDamage = CONFIG.BODY_HP - combat.players[1].hp;
assert.ok(blockedDamage <= headDamage * .2, "an arm in front of the target must heavily reduce head damage");
assert.strictEqual(combat.players[1].lastBlock, true, "an arm-first hit must register as BLOCK");

console.log("wobble-boxing smoke tests passed");
