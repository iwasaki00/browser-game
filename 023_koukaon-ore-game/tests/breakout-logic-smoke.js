const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const windowObject = {};
const context = {
  window: windowObject,
  document: { hidden:false, addEventListener(){}, removeEventListener(){} },
  navigator: { vibrate:null },
  performance: { now:() => 0 },
  requestAnimationFrame(){}, setTimeout, clearTimeout, console, Math
};
vm.runInNewContext(fs.readFileSync(path.join(root, "games/breakout/BreakoutLevels.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "games/breakout/BreakoutGame.js"), "utf8"), context);

const sounds = [];
const sound = { play(id){ sounds.push(id); return Promise.resolve(); }, resetPlayStats(){}, getPlayStats(){ return {}; } };
const drawingContext = new Proxy({}, { get(target, key) { if (!(key in target)) target[key] = () => {}; return target[key]; }, set(target, key, value) { target[key] = value; return true; } });
const canvas = { getContext(){ return drawingContext; }, parentElement:{}, addEventListener(){}, removeEventListener(){}, getBoundingClientRect(){ return { width:390, height:844, left:0 }; } };
const game = new windowObject.BreakoutGame(canvas, sound, { vibration:false }, () => {}, { bestScore:123 });
game.width = 390; game.height = 844; game.paddle.y = 772; game.loadStage(1);
windowObject.BREAKOUT_LEVELS[1].itemChance = 0;

if (windowObject.BREAKOUT_LEVELS.length !== 3) throw Error("Breakout must provide three data-driven stages");
if (!game.blocks.some(block => block.type === "hard")) throw Error("Stage 2 must contain hard blocks");
if (!windowObject.BreakoutLevel.createBlocks(windowObject.BREAKOUT_LEVELS[2], 390).some(block => block.type === "metal")) throw Error("Stage 3 must contain metal blocks");

const hard = game.blocks.find(block => block.type === "hard");
game.hitBlock(hard);
if (!hard.active || hard.hp !== 1 || sounds.at(-1) !== "breakoutHardBlock") throw Error("First hard-block hit must crack but not destroy it");
game.hitBlock(hard);
if (hard.active || !sounds.includes("breakoutHardBreak")) throw Error("Second hard-block hit must destroy it");

game.blocks = [];
game.state = windowObject.BreakoutGame.STATES.PLAYING;
game.paddle = { x:100, y:700, w:100, h:14, baseWidth:92, wideTimer:0 };
const centerBall = { x:150, y:691, vx:0, vy:260, radius:7, active:true };
game.stepBall(centerBall, .02);
if (centerBall.vy >= 0 || Math.abs(centerBall.vx) > 20) throw Error("Paddle center must reflect mostly upward");
const edgeBall = { x:194, y:691, vx:0, vy:260, radius:7, active:true };
game.stepBall(edgeBall, .02);
if (edgeBall.vy >= 0 || edgeBall.vx <= 80) throw Error("Paddle edge must steer the ball diagonally");

game.balls = [{ x:180, y:400, vx:120, vy:-240, radius:7, active:true }];
game.collectItem("multi");
if (game.balls.length !== 3 || game.stats.highestBallCount !== 3) throw Error("Multi-ball must add two balls and update peak count");
game.collectItem("multi");
if (game.balls.length > 5) throw Error("Ball count must be capped at five");

game.items = []; game.particles = []; game.state = windowObject.BreakoutGame.STATES.PLAYING; game.lives = 3;
game.balls = [{ x:100, y:300, vx:0, vy:-200, radius:7, active:true }, { x:100, y:900, vx:0, vy:200, radius:7, active:false }];
game.update(.001);
if (game.lives !== 3) throw Error("One surviving ball must keep the game running");
game.balls[0].active = false; game.update(.001);
if (game.lives !== 2 || game.state !== windowObject.BreakoutGame.STATES.LIFE_LOST) throw Error("Only all-ball loss must consume a life");

for (const [combo, expected] of [[2,1],[3,1.2],[5,1.5],[10,2]]) {
  if (windowObject.BreakoutGame.comboMultiplier(combo) !== expected) throw Error(`Wrong combo multiplier for ${combo}`);
}
console.log("Breakout logic passed: levels, hard blocks, aimed paddle reflection, multi-ball cap, all-ball miss, and combo multipliers.");
