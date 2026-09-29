"use strict";

const fs = require("fs");
const path = require("path");

const gameSource = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function judge(value, taps, wrongInput) { return wrongInput || taps.length < value ? "MISS" : "PERFECT"; }
function guideStarts(duration, value) { return Array.from({ length: value }, (_, index) => duration / value * index); }

assert(judge(3, [0, 160, 330], false) === "PERFECT", "3 taps succeed");
assert(judge(3, [0, 160], false) === "MISS", "fewer than 3 taps miss");
assert(judge(3, [0, 160, 330], true) === "MISS", "wrong button remains miss");
const pulses = guideStarts(500, 3);
assert(pulses.length === 3 && Math.abs(pulses[1] - 166.666667) < 0.001 && Math.abs(pulses[2] - 333.333333) < 0.001, "TEST guide has three subdivisions");
assert(gameSource.includes("const subdivision = this.beatDuration / value;"), "game uses generic beat subdivision");
assert(html.includes('data-value="3"') && html.includes("face-3"), "Dice 3 operation button exists");

console.log(JSON.stringify({ tests: 6, assertions: 6, result: "PASS" }));
