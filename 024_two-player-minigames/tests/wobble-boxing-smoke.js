const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = {};
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const source = read("js/games/wobble-boxing-sideview.js");
const managerSource = read("js/game-manager.js");
const appSource = read("js/app.js");
const indexSource = read("index.html");
const styleSource = read("css/style.css");
const boxingCss = read("css/boxing.css");
vm.runInThisContext(source, { filename: "wobble-boxing-sideview.js" });
const Game = window.WobbleBoxingGame;
const CONFIG = window.WOBBLE_BOXING_CONFIG;

assert.ok(Game && CONFIG);
assert.strictEqual(CONFIG.BODY_HP, 100);
assert.ok(CONFIG.GRAVITY > 0 && CONFIG.AUTO_BALANCE > 0);
assert.ok(CONFIG.FALL_DURATION >= 1000);
assert.ok(CONFIG.HEAD_DAMAGE_MULTIPLIER > 1);
assert.ok(CONFIG.BLOCK_DAMAGE_MULTIPLIER <= .1);
assert.match(indexSource, /wobble-boxing-sideview\.js/);
assert.match(indexSource, /data-joint="arm1Shoulder"/);
assert.match(indexSource, /data-joint="arm2Elbow"/);
assert.doesNotMatch(indexSource, />前肩|>後肩|>前肘|>後肘/);
assert.match(managerSource, /横から見たリング/);
assert.match(indexSource, /id="testSpeedButton"/);
assert.match(appSource, /manager\.cycleTestSpeed\(\)/);
assert.match(styleSource, /\.test-speed-button/);
assert.match(boxingCss, /\.joint-grid\s*\{[\s\S]*?grid-template-columns/);
assert.match(source, /drawArena\(/);
assert.match(source, /drawTestOverlay\(/);
assert.match(source, /removeEventListener\("pointerdown"/);
assert.doesNotMatch(source, /Matter\./);

global.location = { search: "" };
vm.runInThisContext(managerSource, { filename: "game-manager.js" });
const button = () => ({ textContent: "", hidden: false, attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } });
const speedButton = button();
const manager = new window.GameManager({
  testModeButton: button(), menuTestModeButton: button(), testSpeedButton: speedButton,
  debugPanel: { hidden: true }
});
manager.currentGameKey = "boxing";
manager.currentGame = { testMode: false, gameSpeed: 1, updateHud() {}, render() {} };
manager.toggleTestMode();
assert.strictEqual(speedButton.hidden, false);
manager.cycleTestSpeed();
assert.strictEqual(manager.currentGame.gameSpeed, .5);
manager.cycleTestSpeed();
assert.strictEqual(manager.currentGame.gameSpeed, .25);
manager.cycleTestSpeed();
assert.strictEqual(manager.currentGame.gameSpeed, 1);

const game = Object.create(Game.prototype);
game.width = 390;
game.height = 520;
const p1 = game.makePlayer(0);
const p2 = game.makePlayer(1);
p1.pose = game.calculatePose(p1);
p2.pose = game.calculatePose(p2);
assert.strictEqual(p1.facing, 1);
assert.strictEqual(p2.facing, -1);
assert.ok(p1.x < p2.x);
assert.ok(p1.pose.head.y < p1.pose.hip.y);
assert.ok(p1.pose.feet.every((foot) => Math.abs(foot.y - CONFIG.GROUND_Y * game.height) < .001));
assert.ok(p1.pose.arms.arm1.hand.x > p1.pose.arms.arm1.shoulder.x);
assert.ok(p2.pose.arms.arm1.hand.x < p2.pose.arms.arm1.shoulder.x);

const targetAtRest = game.targetGeometry(p2);
assert.ok(game.distance(p1.pose.arms.arm1.hand, targetAtRest.head) > targetAtRest.head.radius + targetAtRest.fistRadius);
p1.joints.arm1Shoulder.angle = 0;
p1.joints.arm1Elbow.angle = CONFIG.ELBOW_MAX_ANGLE;
p1.pose = game.calculatePose(p1);
assert.ok(
  game.distance(p1.pose.arms.arm1.hand, targetAtRest.head) <= targetAtRest.head.radius + targetAtRest.fistRadius,
  "coordinated extension must reach"
);

const makeSimulation = (testMode = false) => {
  const sim = Object.create(Game.prototype);
  Object.assign(sim, {
    width: 390, height: 520, active: true, testMode, elapsed: 0, shake: 0,
    impact: null, collisionMarks: [], blockedPunches: new Set()
  });
  sim.players = [sim.makePlayer(0), sim.makePlayer(1)];
  sim.players.forEach((player) => { player.pose = sim.calculatePose(player); });
  sim.resolveHits = () => {};
  sim.resolveArmClashes = () => {};
  sim.updateHud = () => {};
  sim.jointButtons = [[{ classList: { remove() {} } }], [{ classList: { remove() {} } }]];
  return sim;
};

const motion = makeSimulation();
const elbowBefore = motion.players[0].joints.arm1Elbow.angle;
motion.beginJointInput(motion.players[0], "arm1Elbow", 1000);
motion.update(.05, 1000);
assert.ok(motion.players[0].joints.arm1Elbow.angle > elbowBefore);
assert.notStrictEqual(motion.players[0].angularVelocity, 0);
for (let frame = 0; frame < 180; frame += 1) motion.update(1 / 60, 1100 + frame * 16.7);
for (const [name, joint] of Object.entries(motion.players[0].joints)) {
  const [minimum, maximum] = motion.jointLimits(name);
  assert.ok(joint.angle >= minimum && joint.angle <= maximum);
}

const idle = makeSimulation();
for (let frame = 0; frame < 100; frame += 1) idle.update(.1, 1000 + frame * 100);
idle.players.forEach((player) => {
  assert.strictEqual(player.y, CONFIG.BODY_REST_Y, "idle boxer must not sink");
  assert.ok(Math.abs(player.bodyAngle) < .001);
  assert.strictEqual(player.balance, 100);
  assert.strictEqual(player.state, "NORMAL");
});

const response = makeSimulation();
const responsePlayer = response.players[0];
response.beginJointInput(responsePlayer, "arm1Shoulder", 1000);
for (let frame = 1; frame <= 24; frame += 1) {
  const now = 1000 + frame * 16.667;
  if (frame === 5) response.beginJointInput(responsePlayer, "arm1Elbow", now);
  if (frame === 18) {
    responsePlayer.joints.arm1Shoulder.holding = false;
    responsePlayer.joints.arm1Elbow.holding = false;
  }
  response.update(1 / 60, now);
}
assert.ok(responsePlayer.armTiming.arm1.responseMs >= 200 && responsePlayer.armTiming.arm1.responseMs <= 350);
assert.ok(Math.abs(responsePlayer.bodyAngle) > .04, "coordinated arm movement must visibly rock the torso");

const spam = makeSimulation();
Object.values(spam.players[0].joints).forEach((joint) => { joint.holding = true; });
for (let frame = 0; frame < 75; frame += 1) spam.update(1 / 60, 1000 + frame * 16.667);
assert.ok(spam.players[0].balance < 40, "holding all controls must sharply reduce balance");
assert.ok(["UNSTABLE", "STAGGER", "FALL"].includes(spam.players[0].state));

const powerPlayer = game.makePlayer(0);
const powerArm = { vx: 260, vy: 0, speed: 260 };
powerPlayer.joints.arm1Shoulder.angularVelocity = -4;
powerPlayer.joints.arm1Elbow.angularVelocity = 6;
const powerNow = performance.now();
powerPlayer.armTiming.arm1.shoulderAt = powerNow - 170;
powerPlayer.armTiming.arm1.elbowAt = powerNow - 30;
const syncedPower = game.classifyPunch(powerPlayer, "arm1", powerArm).damage;
powerPlayer.armTiming.arm1.shoulderAt = 0;
const elbowOnlyPower = game.classifyPunch(powerPlayer, "arm1", powerArm).damage;
assert.ok(syncedPower > elbowOnlyPower * 1.4, "well-timed shoulder and elbow input must beat elbow-only power");

const fallGame = makeSimulation();
const falling = fallGame.players[0];
falling.bodyAngle = .95;
fallGame.updateBody(falling, 1 / 60, 1, 2000);
assert.strictEqual(falling.state, "FALL");
fallGame.updateState(falling, falling.stateUntil + 1);
assert.strictEqual(falling.state, "STAGGER");

const farArm = () => ({
  shoulder: { x: -500, y: -500 }, elbow: { x: -480, y: -480 }, hand: { x: -460, y: -460 },
  vx: 0, vy: 0, speed: 0, lastHitAt: 0
});
const makeCombat = () => {
  const combat = makeSimulation();
  combat.resolveHits = Game.prototype.resolveHits;
  combat.players[1].pose.arms = { arm1: farArm(), arm2: farArm() };
  combat.onPunchSound = () => {};
  combat.onBlockSound = () => {};
  combat.finish = () => {};
  return combat;
};
const attackHead = (combat) => {
  const target = combat.targetGeometry(combat.players[1]).head;
  combat.players[0].pose.arms.arm1 = {
    shoulder: { x: target.x - 60, y: target.y }, elbow: { x: target.x - 30, y: target.y },
    hand: { x: target.x, y: target.y }, vx: 180, vy: 0, speed: 180, lastHitAt: 0
  };
  combat.players[0].joints.arm1Shoulder.angularVelocity = -2;
  combat.players[0].joints.arm1Elbow.angularVelocity = 3;
  return target;
};

let combat = makeCombat();
attackHead(combat);
combat.resolveHits(1000);
assert.ok(combat.players[1].hp < CONFIG.BODY_HP);
assert.ok(combat.players[1].angularVelocity > 0);

combat = makeCombat();
const blockPoint = attackHead(combat);
combat.players[1].pose.arms.arm1 = {
  shoulder: { x: blockPoint.x - 20, y: blockPoint.y }, elbow: blockPoint,
  hand: { x: blockPoint.x + 20, y: blockPoint.y }, vx: 0, vy: 0, speed: 0, lastHitAt: 0
};
combat.resolveHits(1000);
assert.strictEqual(combat.players[1].lastBlock, true);
assert.ok(CONFIG.BODY_HP - combat.players[1].hp < 2);

const hud = Object.create(Game.prototype);
Object.assign(hud, { width: 390, height: 520, testMode: true, debug: false, gameSpeed: .5, fps: 60, elapsed: 2 });
hud.players = [hud.makePlayer(0), hud.makePlayer(1)];
hud.players.forEach((player) => { player.pose = hud.calculatePose(player); });
hud.energyBars = [0, 1].map(() => ({ style: {}, classList: { toggle() {} } }));
hud.debugPanel = { textContent: "" };
hud.updateHud();
for (const label of ["BODY", "BALANCE", "①", "②", "FIST", "RESPONSE", "HIT POWER", "BLOCK", "STATE"]) {
  assert.ok(hud.debugPanel.textContent.includes(label));
}

const endless = makeSimulation(true);
endless.elapsed = CONFIG.TIME_LIMIT - .01;
let finished = false;
endless.finish = () => { finished = true; };
endless.update(.05, 1000);
assert.strictEqual(finished, false);

console.log("side-view wobble-boxing smoke tests passed");
