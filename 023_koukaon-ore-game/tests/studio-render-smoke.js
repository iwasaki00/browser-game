const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const windowObject = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), { window: windowObject });
const config = windowObject.ORE_CONFIG;
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const start = app.indexOf("function renderStudio()");
const source = app.slice(start, app.indexOf("function renderPads()", start));
if (start < 0 || !source.includes('$("#soundList").innerHTML')) throw new Error("Studio renderer is missing");

for (const [gameId, expected] of [["action", 13], ["puzzle", 14]]) {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: "",
      innerHTML: "",
      hidden: false,
      style: {},
      classList: { toggle() {} }
    });
    return nodes.get(selector);
  };
  const library = { assignments: [], hasAssignment() { return false; } };
  const state = { currentPack: { sounds: {} }, selectedGameId: gameId };
  const context = {
    $: node,
    config,
    library,
    state,
    gameSounds: () => config.getGameSounds(gameId),
    recordedCount: () => 0,
    gameDef: () => config.gameDefinitions[gameId]
  };
  vm.runInNewContext(`${source}; renderStudio();`, context);
  const html = nodes.get("#soundList").innerHTML;
  const cards = [...html.matchAll(/data-sound-id=/g)].length;
  const recordButtons = [...html.matchAll(/data-record=/g)].length;
  if (cards !== expected || recordButtons !== expected) {
    throw new Error(`${gameId} studio rendered ${cards} cards and ${recordButtons} record buttons; expected ${expected}`);
  }
  if (nodes.get("#studioProgressText").textContent !== `0 / ${expected} 録音済み`) {
    throw new Error(`${gameId} studio progress does not match its sound cards`);
  }
}

console.log("Studio render passed: action 13 and puzzle 14 recording cards render without library scope errors.");
