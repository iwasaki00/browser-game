const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const windowObject = {};
const context = { window:windowObject, console, Object };
for (const file of ["js/config.js", "js/race-config.js", "js/rhythm-config.js", "js/breakout-config.js", "js/fight-config.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}

const definition = windowObject.ORE_CONFIG.gameDefinitions.fight;
if (!definition?.playable || definition.order !== 7 || definition.sounds.length !== 20) throw Error("Fight must be the seventh playable game with 20 sounds");
if (windowObject.ORE_CONFIG.gameDefinitions.fighting) throw Error("Old fighting placeholder must be removed");
for (const id of ["fightPunchSwing","fightKickSwing","fightHitLight","fightHitHeavy","fightDamage","fightGuard","fightGuardBreak","fightJump","fightLand","fightSpecialCall","fightSpecialEffect","fightSpecialHit","fightDown","fightKO","fightWin","fightLose","fightRoundStart","fightFinalRound","fightCombo","fightCounter"]) {
  if (!windowObject.ORE_CONFIG.soundCatalog[id]) throw Error(`Missing fight sound ${id}`);
}
if (windowObject.ORE_CONFIG.defaultSettings.specialMoveName !== "オレファイヤー") throw Error("Default special move name is missing");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
for (const token of ["fight-config.js","FightGame.js","fightWorkshop","fightChallengeHints","fightControls","fightResumeButton","fightResultStats","fightResultActions"]) {
  if (!html.includes(token)) throw Error(`Fight HTML integration missing ${token}`);
}
for (const token of ['registerGame("fight"',"runFightSpecialTest","fightBestScore",'classList.toggle("is-fight"',"fightSpecialCall","fightDamage"]) {
  if (!app.includes(token)) throw Error(`Fight app integration missing ${token}`);
}
const regions = {
  fightWorkshop:[html.indexOf('id="testScreen"'),html.indexOf('id="libraryScreen"')],
  fightChallengeHints:[html.indexOf('id="packsScreen"'),html.indexOf('id="gameScreen"')],
  fightControls:[html.indexOf('id="gameScreen"'),html.indexOf('id="resultScreen"')],
  fightResultActions:[html.indexOf('id="resultScreen"'),html.indexOf('id="settingsScreen"')]
};
for (const [id,[start,end]] of Object.entries(regions)) {
  const position=html.indexOf(`id="${id}"`);
  if (position<start || position>end) throw Error(`${id} is outside its parent screen`);
}
console.log("Fight static passed: 20 sounds, playable registration, workshop, controls, result UI, challenges, and settings.");
