const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const windowObject = {};
const context = { window:windowObject, console, Object };
for (const file of ["js/config.js", "js/race-config.js", "js/rhythm-config.js", "js/breakout-config.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}
const definition = windowObject.ORE_CONFIG.gameDefinitions.breakout;
if (!definition?.playable || definition.sounds.length !== 15) throw Error("Breakout GameDefinition must be playable with 15 sounds");
for (const id of ["breakoutLaunch","breakoutPaddle","breakoutWall","breakoutBlock","breakoutHardBlock","breakoutHardBreak","breakoutCombo","breakoutItem","breakoutPowerUp","breakoutMultiBall","breakoutMiss","breakoutLifeUp","breakoutWarning","breakoutClear","breakoutGameOver"]) {
if (windowObject.ORE_CONFIG.gameDefinitions.fighting?.playable !== false) throw Error("Fighting must remain a COMING SOON entry");
  if (!windowObject.ORE_CONFIG.soundCatalog[id]) throw Error(`Missing breakout sound ${id}`);
}
if (windowObject.ORE_CONFIG.soundCatalog.breakoutBlock.minInterval !== 28) throw Error("Rapid block sound needs a short minInterval");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
for (const token of ["breakout-config.js","BreakoutLevels.js","BreakoutGame.js","breakoutSoundTests","breakoutResultStats","breakoutChallengeHints"]) {
  if (!html.includes(token)) throw Error(`Breakout HTML integration missing ${token}`);
}
for (const token of ['registerGame("breakout"',"runBreakoutReflectTest","runBreakoutRushTest","breakoutBestScore","debugHitboxes"]) {
const regions = {
  breakoutSoundTests:[html.indexOf('id="testScreen"'),html.indexOf('id="libraryScreen"')],
  breakoutChallengeHints:[html.indexOf('id="packsScreen"'),html.indexOf('id="gameScreen"')],
  breakoutActionButton:[html.indexOf('id="gameScreen"'),html.indexOf('id="resultScreen"')],
  breakoutResultActions:[html.indexOf('id="resultScreen"'),html.indexOf('id="settingsScreen"')]
};
for(const [id,[start,end]] of Object.entries(regions)) {
  const position=html.indexOf(`id="${id}"`);
  if(position<start||position>end)throw Error(`${id} is outside its parent screen`);
}
const breakoutResultBranch=app.indexOf('const breakout = result.mode === "breakout"');
if(breakoutResultBranch<0||breakoutResultBranch>app.indexOf("if (puzzle)",breakoutResultBranch))throw Error("Breakout result branch must not be nested in puzzle result handling");
  if (!app.includes(token)) throw Error(`Breakout app integration missing ${token}`);
}
console.log("Breakout static passed: 15 sounds, playable registration, tests, result UI, challenges, and debug integration.");
