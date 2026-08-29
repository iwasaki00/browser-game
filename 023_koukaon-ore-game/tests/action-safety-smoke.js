const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "../games/action/ActionGame.js"), "utf8");
const windowObject = {};
vm.runInNewContext(source, { window: windowObject, document: {}, navigator: {}, performance, console, requestAnimationFrame() {} });

function setup() {
  const played = [];
  const sound = { play(id) { played.push(id); }, resetPlayStats() {}, getPlayStats() { return {}; } };
  const canvas = { getContext() { return {}; }, getBoundingClientRect() { return { width: 390, height: 520 }; } };
  const game = new windowObject.ActionGame(canvas, sound, { vibration: false }, () => {}, { controlsRoot: { querySelectorAll() { return []; } } });
  game.width = 390; game.height = 520; game.scaleY = 1;
  return { game, played };
}

const damage = setup();
damage.game.damage(1); damage.game.damage(1);
if (damage.game.hp !== 2 || damage.played.filter((id) => id === "actionDamage").length !== 1) throw new Error("Invincibility must suppress repeated damage sound");

const checkpoint = setup();
checkpoint.game.player.x = 1800; checkpoint.game.player.y = 408; checkpoint.game.player.onGround = true;
checkpoint.game.update(.016); checkpoint.game.update(.016);
if (!checkpoint.game.checkpoint.active || checkpoint.played.filter((id) => id === "actionCheckpoint").length !== 1) throw new Error("Checkpoint sound must play once");

console.log("Action safety passed: damage cooldown and one-shot checkpoint event.");
