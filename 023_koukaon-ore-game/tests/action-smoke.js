const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const config = fs.readFileSync(path.join(root, "js", "config.js"), "utf8");
const manager = fs.readFileSync(path.join(root, "js", "GameManager.js"), "utf8");
const action = fs.readFileSync(path.join(root, "games", "action", "ActionGame.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const sounds = ["actionJump", "actionLand", "actionAttack", "actionEnemyHit", "actionEnemyDestroy", "actionDamage", "actionItem", "actionFall", "actionCheckpoint", "actionClear", "actionGameOver", "actionDash", "actionPowerUp"];
for (const id of sounds) {
  if (!config.includes(`${id}: { id: "${id}"`)) throw new Error(`Missing action sound definition: ${id}`);
  if (!action.includes(`"${id}"`) && !["actionDash"].includes(id)) throw new Error(`ActionGame does not use sound: ${id}`);
}
for (const method of ["registerGame", "startGame", "getGameDefinition"]) {
  if (!manager.includes(`${method}(`)) throw new Error(`GameManager missing ${method}`);
}
for (const control of ["left", "right", "jump", "attack"]) {
  if (!html.includes(`data-action-control="${control}"`)) throw new Error(`Missing action control: ${control}`);
}
for (const key of ["ArrowLeft", "ArrowRight", "Space", "KeyZ"]) {
  if (!action.includes(key)) throw new Error(`Missing keyboard binding: ${key}`);
}
console.log(`Action smoke passed: ${sounds.length} sounds, 4 touch controls, 4 keyboard bindings.`);
