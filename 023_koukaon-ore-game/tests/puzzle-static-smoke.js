const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const config = fs.readFileSync(path.join(root, "js", "config.js"), "utf8");
const game = fs.readFileSync(path.join(root, "games", "puzzle", "PuzzleGame.js"), "utf8");

const sounds = ["puzzleSwap", "puzzleInvalid", "puzzleMatch", "puzzleChain2", "puzzleChain3", "puzzleChain4", "puzzleChain5", "puzzleSpecialCreate", "puzzleSpecialActivate", "puzzleBigClear", "puzzleItem", "puzzleWarning", "puzzleClear", "puzzleGameOver"];
for (const id of sounds) if (!new RegExp(`id\\s*:\\s*"${id}"`).test(config)) throw new Error(`Missing puzzle sound: ${id}`);
for (const file of ["PuzzleBoard.js", "PuzzleRenderer.js", "PuzzleGame.js"]) if (!html.includes(`./games/puzzle/${file}`)) throw new Error(`Missing puzzle script tag: ${file}`);
for (const id of ["puzzleChainTest", "chainTestButton", "puzzleResultStats", "resultMaxChain", "resultTotalCleared", "resultSpecialCreated", "resultSpecialActivated", "resultBigClears", "resultBestChain", "directChainRerecordButton"]) if (!html.includes(`id="${id}"`)) throw new Error(`Missing puzzle UI: #${id}`);
if (!app.includes('registerGame("puzzle"') || !app.includes("runChainTest")) throw new Error("Puzzle registration or chain tester is missing");
for (const state of ["IDLE", "SWAPPING", "CLEARING", "FALLING", "REFILLING", "SHUFFLING", "GAME_OVER"]) if (!game.includes(`"${state}"`)) throw new Error(`Puzzle state is missing: ${state}`);

console.log(`Puzzle static passed: ${sounds.length} sounds, scripts, UI, registration, and states.`);
