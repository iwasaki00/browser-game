const fs = require("fs");
const path = require("path");
const vm = require("vm");

const boardSource = fs.readFileSync(path.resolve(__dirname, "../games/puzzle/PuzzleBoard.js"), "utf8");
const gameSource = fs.readFileSync(path.resolve(__dirname, "../games/puzzle/PuzzleGame.js"), "utf8");
const windowObject = {};
class FakeRenderer {
  constructor() { this.cellSize = 40; this.offsetX = 0; this.offsetY = 0; }
  resize() {}
  draw() {}
  cellAt() { return null; }
}
windowObject.PuzzleRenderer = FakeRenderer;
const context = { window: windowObject, console, performance, setTimeout, requestAnimationFrame() {} };
vm.runInNewContext(boardSource, context);
vm.runInNewContext(gameSource, context);
const PuzzleGame = windowObject.PuzzleGame;

function makeGame(onEnd = () => {}) {
  const played = [];
  const canvas = { addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { width: 390, height: 520 }; } };
  const sound = { play(id) { played.push(id); }, resetPlayStats() {}, getPlayStats() { return {}; } };
  const game = new PuzzleGame(canvas, sound, {}, onEnd, { duration: 60 });
  game.wait = async () => {};
  return { game, played };
}

(async () => {
  const chain = makeGame();
  chain.game.running = true;
  let stage = 0;
  chain.game.board = {
    findMatches() {
      if (stage >= 5) return { groups: [], positions: new Set() };
      return { groups: [{ orientation: "row", type: stage, cells: [{ row: stage, col: 0 }, { row: stage, col: 1 }, { row: stage, col: 2 }] }], positions: new Set([`${stage},0`, `${stage},1`, `${stage},2`]) };
    },
    planSpecials() { return []; },
    expandSpecials(positions) { return { positions, activated: 0 }; },
    clear() {}, collapse() {}, refill() { stage += 1; },
    findValidMoves() { return [[{ row: 0, col: 0 }, { row: 0, col: 1 }]]; },
    parseKey(key) { return key.split(",").map(Number); },
    key(row, col) { return `${row},${col}`; }
  };
  await chain.game.resolveChains([]);
  const expected = ["puzzleMatch", "puzzleChain2", "puzzleChain3", "puzzleChain4", "puzzleChain5"];
  if (expected.some((id, index) => chain.played[index] !== id)) throw new Error(`Wrong chain sound order: ${chain.played.join(", ")}`);
  if (chain.game.maxChain !== 5 || chain.game.stats.totalCleared !== 15) throw new Error("Five-stage cascade stats are incorrect");

  const invalid = makeGame();
  invalid.game.board.generate(); invalid.game.running = true; invalid.game.state = "IDLE";
  const validKeys = new Set(invalid.game.board.findValidMoves().map(([a, b]) => `${a.row},${a.col}-${b.row},${b.col}`));
  let pair = null;
  for (let row = 0; row < 8 && !pair; row++) for (let col = 0; col < 7 && !pair; col++) if (!validKeys.has(`${row},${col}-${row},${col + 1}`)) pair = [{ row, col }, { row, col: col + 1 }];
  const before = invalid.game.board.cells.map((piece) => piece.type).join("");
  await invalid.game.trySwap(pair[0], pair[1]);
  const after = invalid.game.board.cells.map((piece) => piece.type).join("");
  if (before !== after || !invalid.played.includes("puzzleInvalid")) throw new Error("Invalid swaps must play feedback and revert the board");

  let result = null;
  const timeout = makeGame((value) => { result = value; });
  timeout.game.running = true; timeout.game.state = "IDLE"; timeout.game.last = 0; timeout.game.timeRemaining = 0.01;
  timeout.game.loop(20);
  if (!result || !timeout.played.includes("puzzleGameOver") || timeout.game.running) throw new Error("Timer expiry must end an idle game exactly once");

  console.log("Puzzle game passed: chain sounds, cascade stats, invalid swap, and timeout.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
