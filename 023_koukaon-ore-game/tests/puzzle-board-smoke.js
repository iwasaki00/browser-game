const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "../games/puzzle/PuzzleBoard.js"), "utf8");
const windowObject = {};
vm.runInNewContext(source, { window: windowObject, console });
const PuzzleBoard = windowObject.PuzzleBoard;

let seed = 0x12345678;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 0x100000000);
const board = new PuzzleBoard(8, 8, 6, random);
board.generate();
if (board.hasMatch()) throw new Error("Generated board must not contain an initial match");
if (!board.findValidMoves(1).length) throw new Error("Generated board must contain a valid move");

const known = new PuzzleBoard(8, 8, 6, random);
known.cells = Array.from({ length: 64 }, (_, index) => ({ type: (Math.floor(index / 8) * 2 + index % 8) % 6, special: null }));
for (let col = 0; col < 5; col++) known.set(0, col, { type: 1, special: null });
for (let row = 2; row < 5; row++) known.set(row, 7, { type: 2, special: null });
const matches = known.findMatches();
if (matches.groups.length !== 2 || matches.positions.size !== 8) throw new Error("Horizontal and vertical matches must resolve as one simultaneous stage");

const rowPlan = known.planSpecials([matches.groups.find((group) => group.cells.length === 5)], [{ row: 0, col: 2 }])[0];
if (rowPlan.special !== "color" || rowPlan.row !== 0 || rowPlan.col !== 2) throw new Error("A five-match must create a color special at the preferred swap cell");
const colPlan = known.planSpecials([{ orientation: "col", type: 3, cells: [0, 1, 2, 3].map((row) => ({ row, col: 6 })) }])[0];
if (colPlan.special !== "col") throw new Error("A vertical four-match must create a column special");

const falling = new PuzzleBoard(3, 4, 3, random);
falling.cells = [null, { type: 1 }, null, { type: 0 }, null, { type: 2 }, null, { type: 2 }, null, { type: 1 }, null, { type: 0 }];
falling.collapse();
if (falling.get(3, 0)?.type !== 1 || falling.get(2, 0)?.type !== 0 || falling.get(3, 1)?.type !== 2) throw new Error("Collapse must pack pieces at the bottom of each column");
falling.refill();
if (falling.cells.some((piece) => !piece)) throw new Error("Refill must fill every empty cell");

board.shuffle();
if (board.hasMatch() || !board.findValidMoves(1).length) throw new Error("Shuffle must leave a playable board without immediate matches");

console.log("Puzzle board passed: generation, matches, specials, gravity, refill, and shuffle.");
