const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const index = read("index.html");
const app = read("js/app.js");
const manager = read("js/game-manager.js");
const style = read("css/style.css");
const sumo = read("js/games/sumo.js");
const tug = read("js/games/tug-of-war.js");
const bomb = read("js/games/bomb-hot-potato.js");
const boxing = read("js/games/wobble-boxing-sideview.js");
const hockey = read("js/games/table-hockey.js");

assert.match(style, /\.control-one[^}]*transform:rotate\(180deg\)/);
assert.match(style, /\.countdown::before[^}]*transform:rotate\(180deg\)/);
assert.match(style, /\.result-card-top[^}]*transform:rotate\(180deg\)/);
assert.match(index, /id="resultTitleTop"/);
assert.match(index, /id="replayButtonTop"/);
assert.match(index, /id="menuButtonTop"/);
assert.match(app, /replayButtonTop\.addEventListener/);
assert.match(app, /menuButtonTop\.addEventListener/);
assert.match(manager, /countdown\.dataset\.label = step/);
assert.match(manager, /resultTitleTop\.textContent = this\.elements\.resultTitle\.textContent/);

assert.match(sumo, /ctx\.rotate\(Math\.PI\); ctx\.fillText\(remaining/);
assert.ok((sumo.match(/remaining\.toFixed\(1\)/g) || []).length >= 2);
assert.match(tug, /if \(index === 0\) ctx\.rotate\(Math\.PI\)/);
assert.ok((tug.match(/remaining\.toFixed\(1\)/g) || []).length >= 2);
assert.match(bomb, /ctx\.rotate\(Math\.PI\); ctx\.fillText\("P1 · PASS OR HOLD"/);
assert.match(boxing, /if \(playerIndex === 0\) ctx\.rotate\(Math\.PI\)/);
assert.match(boxing, /if \(player\.index === 0\) ctx\.rotate\(Math\.PI\)/);
assert.ok((boxing.match(/ctx\.fillText\(remaining/g) || []).length >= 2);
assert.match(hockey, /\[-1, 1\]\.forEach\(\(side\)/);
assert.match(hockey, /if \(side < 0\) ctx\.rotate\(Math\.PI\)/);

console.log("symmetry smoke tests passed");
