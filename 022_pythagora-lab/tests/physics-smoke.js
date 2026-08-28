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
const clearCounts = new Map();
const game = new P.Game({
  onClear(result) {
    clearCounts.set(result.stageId, (clearCounts.get(result.stageId) || 0) + 1);
  }
});

game.loadStage(P.getStage("stage-3"));
const baseline = { bodies: game.physics.bodyCount, constraints: game.physics.constraintCount };
const resetCounts = [];
for (let index = 0; index < 15; index += 1) {
  game.startExperiment();
  game.stopExperiment();
  resetCounts.push({ bodies: game.physics.bodyCount, constraints: game.physics.constraintCount });
}
const reset = {
  baseline,
  stable: resetCounts.every((count) => count.bodies === baseline.bodies && count.constraints === baseline.constraints)
};

game.loadStage(P.createFreeStage());
const ramp = game.addPart("ramp", { x: 300, y: 210, angle: 0 });
const beforeMove = game.serializeDesign();
game.movePart(ramp, { x: 420, y: 260 });
game.commitDrag(beforeMove);
const moved = game.serializeDesign();
game.rotateSelected(1);
const rotated = game.serializeDesign();
const undoOk = game.undo();
const afterUndo = game.serializeDesign();
const redoOk = game.redo();
const afterRedo = game.serializeDesign();
const restored = game.designParts.find((part) => part.id === ramp.id);
const history = {
  undoOk,
  redoOk,
  moveChanged: JSON.stringify(beforeMove) !== JSON.stringify(moved),
  undoMatchesMoved: JSON.stringify(afterUndo) === JSON.stringify(moved),
  redoMatchesRotated: JSON.stringify(afterRedo) === JSON.stringify(rotated),
  bodyMatchesDescriptor: Boolean(restored?.body) &&
    Math.abs(restored.body.position.x - restored.x) < 0.001 &&
    Math.abs(restored.body.angle - restored.angle) < 0.001
};

const stages = P.STAGES.map((stage) => {
  game.loadStage(stage);
  game.loadDebugSolution();
  game.startExperiment();
  const maxSeconds = stage.id === "stage-5" ? 75 : 60;
  for (let tick = 0; tick < maxSeconds * 60 && game.mode !== "cleared"; tick += 1) {
    game.update(P.CONFIG.fixedStep);
  }
  const state = game.getState();
  return {
    id: stage.id,
    cleared: state.mode === "cleared",
    clearEvents: clearCounts.get(stage.id) || 0,
    chain: state.chain,
    minChain: stage.clearConditions.minChain,
    elapsed: Number(state.elapsed.toFixed(2)),
    bodyCount: state.bodyCount,
    constraintCount: state.constraintCount
  };
});

console.log(JSON.stringify({ reset, history, stages }, null, 2));
const structuralPass = reset.stable && history.undoOk && history.redoOk &&
  history.undoMatchesMoved && history.redoMatchesRotated && history.bodyMatchesDescriptor;
const stagePass = stages.every((stage) => {
  return stage.cleared && stage.clearEvents === 1 && stage.chain >= stage.minChain;
});
if (!structuralPass || !stagePass) process.exitCode = 1;
