const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.resolve(__dirname, "../js/app.js"), "utf8");
const renderStart = app.indexOf("function renderPads()");
const mapEnd = app.indexOf('}).join("");', renderStart);
const toolsToggle = app.indexOf('$("#rhythmTools").hidden', renderStart);
const metronomeValue = app.indexOf('$("#rhythmMetronomeBpm").value', renderStart);
if (renderStart < 0 || mapEnd < 0 || toolsToggle < mapEnd || metronomeValue < mapEnd) {
  throw Error("Rhythm tools must be updated after sound-pad map generation");
}
console.log("Rhythm pad render passed: tools and metronome update outside the sound map.");
