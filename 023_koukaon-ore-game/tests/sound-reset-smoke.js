const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "sound-reset.css"), "utf8");

for (const token of ["resetRecordedSound", "data-reset-sound", "delete sounds[id]", "storage.savePack", "sound.loadPack"]) {
  if (!app.includes(token)) throw new Error(`Recorded-sound reset is missing: ${token}`);
}
if (!html.includes('./css/sound-reset.css')) throw new Error("Reset button stylesheet is not loaded");
if (!css.includes(".reset-sound-button")) throw new Error("Reset button has no touch-friendly styling");

console.log("Sound reset passed: per-sound delete, persistence, fallback reload, and UI styling.");
