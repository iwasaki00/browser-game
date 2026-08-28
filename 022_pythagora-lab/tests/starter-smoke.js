"use strict";

const path = require("node:path");
const root = path.resolve(__dirname, "..");
global.window = global;
global.location = { search: "" };
global.document = {
  createElement() {
    return { dataset: {}, style: {}, textContent: "" };
  },
  head: { appendChild() {} }
};
global.Matter = require(path.join(root, "vendor", "matter.min.js"));
for (const file of [
  "config.js", "stages.js", "parts.js", "physics.js", "history.js", "game.js", "ui.js",
  "stages-full.js", "parts-advanced.js", "game-advanced.js", "release.js"
]) require(path.join(root, "js", file));

const P = global.PythagoraLab;
const results = ["stage-3", "stage-4", "stage-5"].map((stageId) => {
  const game = new P.Game();
  game.loadStage(P.getStage(stageId));
  game.startExperiment();
  for (let tick = 0; tick < 20 * 60 && game.mode !== "cleared"; tick += 1) {
    game.update(P.CONFIG.fixedStep);
  }
  return {
    stageId,
    stayedUncleared: game.mode !== "cleared",
    chain: game.chain,
    elapsed: Number(game.elapsed.toFixed(2))
  };
});

console.log(JSON.stringify(results, null, 2));
if (!results.every((result) => result.stayedUncleared)) process.exitCode = 1;
