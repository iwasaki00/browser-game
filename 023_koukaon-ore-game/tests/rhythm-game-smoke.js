const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const played = [];
let result = null;
const sound = {
  context: { state: "running", currentTime: 1 },
  play(id) { played.push(id); },
  resetPlayStats() {},
  getPlayStats() { return {}; }
};
const windowObject = {
  addEventListener() {},
  removeEventListener() {},
  RhythmRenderer: class {
    constructor() {}
    resize() {}
    draw() {}
  }
};
const sandbox = {
  window: windowObject,
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  performance: { now: () => 1000 },
  requestAnimationFrame() {},
  console,
  Math,
  Set
};

for (const file of ["RhythmChart.js", "RhythmJudge.js", "RhythmGame.js"]) {
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "games/rhythm", file), "utf8"),
    sandbox
  );
}

const game = new windowObject.RhythmGame(
  {},
  sound,
  { rhythmOffset: 0, rhythmJudgeVoice: "important" },
  value => { result = value; },
  { rhythmStage: "eight" }
);
game.running = true;
game.startAudioTime = 0;
game.notes = [
  { lane: 0, time: 1, type: "tap", status: "pending" },
  { lane: 1, time: 1.08, type: "tap", status: "pending" },
  { lane: 2, time: 1.15, type: "tap", status: "pending" }
];

game.input(0);
sound.context.currentTime = 1.08;
game.input(1);
sound.context.currentTime = 1.15;
game.input(2);
if (game.stats.perfect !== 3) throw Error("Timed taps were not judged PERFECT");
if (!["rhythmKick", "rhythmSnare", "rhythmHiHat"].every(id => played.includes(id))) {
  throw Error("Every lane tap must play its instrument sound");
}

for (let i = game.combo; i < 30; i += 1) game.applyJudge("PERFECT", 0, 0, 1);
if (played.filter(id => id === "rhythmCombo10").length !== 1) throw Error("Combo 10 voice must play once");
if (played.filter(id => id === "rhythmCombo30").length !== 1) throw Error("Combo 30 voice must play once");
if (played.filter(id => id === "rhythmFever").length !== 1 || !game.fever) throw Error("FEVER must start at combo 30");

game.miss({ lane: 3, time: 0, status: "pending" });
if (game.combo !== 0 || game.fever) throw Error("MISS must break combo and FEVER");
game.finish();
if (!result || result.mode !== "rhythm" || result.stats.stageId !== "eight") throw Error("Rhythm result was not returned");
if (!played.includes("rhythmFinish")) throw Error("Finish voice was not played");

console.log("Rhythm game passed: taps, timing, combo voices, FEVER, MISS, and result.");
