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
const scenarios = [
  {
    stageId: "stage-3",
    apply(game) {
      const seesaw = game.designParts.find((part) => part.type === "seesaw");
      game.movePart(seesaw, { x: 590, y: seesaw.y });
    }
  },
  {
    stageId: "stage-4",
    apply(game) {
      const spring = game.designParts.find((part) => part.type === "spring");
      game.selectPart(spring);
      game.rotateSelected(1);
      game.rotateSelected(1);
    }
  },
  {
    stageId: "stage-5",
    apply(game) {
      const spring = game.designParts.find((part) => part.type === "spring");
      game.selectPart(spring);
      game.rotateSelected(1);
      game.rotateSelected(1);
    }
  }
];

const results = scenarios.map((scenario) => {
  const game = new P.Game();
  game.loadStage(P.getStage(scenario.stageId));
  scenario.apply(game);
  game.startExperiment();
  for (let tick = 0; tick < 25 * 60 && game.mode !== "cleared"; tick += 1) {
    game.update(P.CONFIG.fixedStep);
  }
  return {
    stageId: scenario.stageId,
    cleared: game.mode === "cleared",
    chain: game.chain,
    elapsed: Number(game.elapsed.toFixed(2))
  };
});

console.log(JSON.stringify(results, null, 2));
if (!results.every((result) => result.cleared)) process.exitCode = 1;
