const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "../games/action/ActionGame.js"), "utf8");
const windowObject = {};
vm.runInNewContext(source, { window: windowObject, document: {}, navigator: {}, performance, console, requestAnimationFrame() {} });
const ActionGame = windowObject.ActionGame;

function createGame() {
  const played = [];
  const sound = { play(id) { played.push(id); }, resetPlayStats() {}, getPlayStats() { return Object.fromEntries(played.map((id) => [id, played.filter((entry) => entry === id).length])); } };
  const canvas = { getContext() { return {}; }, getBoundingClientRect() { return { width: 390, height: 520 }; } };
  let result = null;
  const game = new ActionGame(canvas, sound, { vibration: false }, (value) => { result = value; }, { controlsRoot: { querySelectorAll() { return []; } } });
  game.width = 390; game.height = 520; game.scaleY = 1;
  return { game, played, result: () => result };
}

const jump = createGame();
jump.game.player.x = 90; jump.game.player.y = 408; jump.game.player.onGround = true; jump.game.pressed.jump = true;
jump.game.update(.016);
jump.game.pressed.jump = true; jump.game.update(.016);
if (jump.played.filter((id) => id === "actionJump").length !== 2 || jump.game.player.state !== "double-jump") throw new Error("A second airborne press must perform exactly one double jump");
jump.game.pressed.jump = true; jump.game.update(.016);
if (jump.played.filter((id) => id === "actionJump").length !== 2) throw new Error("A third jump before landing must be rejected");

for (let i = 0; i < 90 && !jump.game.player.onGround; i++) jump.game.update(.016);
if (jump.played.filter((id) => id === "actionLand").length !== 1 || jump.game.player.jumpsUsed !== 0) throw new Error("Landing must play once and reset the double jump");

const attack = createGame();
attack.game.player.x = 390; attack.game.player.y = 408; attack.game.player.onGround = true; attack.game.pressed.attack = true;
for (let i = 0; i < 8; i++) attack.game.update(.016);
for (const id of ["actionAttack", "actionEnemyHit", "actionEnemyDestroy"]) {
  if (!attack.played.includes(id)) throw new Error(`Attack flow missing sound: ${id}`);
}

const fall = createGame();
fall.game.player.x = 670; fall.game.player.y = 590; fall.game.update(.016); fall.game.update(.016);
if (fall.played.filter((id) => id === "actionFall").length !== 1) throw new Error("Fall sound must play once per fall");

const clear = createGame();
clear.game.running = true; clear.game.player.x = 2930; clear.game.player.y = 408; clear.game.player.onGround = true; clear.game.update(.016);
if (!clear.played.includes("actionClear") || !clear.result()?.clear) throw new Error("Goal must finish with actionClear");

console.log("Action logic passed: double jump/land, attack/hit/destroy, fall, and clear events.");
