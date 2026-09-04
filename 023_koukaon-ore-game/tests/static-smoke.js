const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map((match) => match[1]);
for (const ref of refs) {
  const file = path.resolve(root, ref.split(/[?#]/)[0]);
  if (!fs.existsSync(file)) throw new Error(`Missing referenced file: ${ref}`);
}

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const selectors = new Set([...app.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]));
for (const id of selectors) {
  if (!ids.has(id)) throw new Error(`app.js references missing element: #${id}`);
}

const requiredSounds = ["shot", "enemyShot", "enemyDestroy", "explosion", "damage", "item", "boss", "gameOver", "clear"];
const config = fs.readFileSync(path.join(root, "js", "config.js"), "utf8");
for (const sound of requiredSounds) {
  if (!new RegExp(`id\\s*:\\s*"${sound}"`).test(config)) throw new Error(`Missing required sound category: ${sound}`);
}

const libraryAt = app.indexOf("const library = new window.SoundLibraryController");
const showScreenAt = app.indexOf("function showScreen");
if (libraryAt < 0 || libraryAt > showScreenAt) throw new Error("The shared sound library controller must not be scoped inside showScreen");
if (!/id="rhythmControls"[\s\S]*?<\/nav>\s*<\/section>\s*<section id="resultScreen"/.test(html)) {
  throw new Error("Rhythm controls must stay inside the game screen");
}
if (!/id="calibrationApplyButton"[\s\S]*?<\/section>\s*<\/section>\s*<\/main>/.test(html)) {
  throw new Error("Rhythm settings and calibration must stay inside the settings screen");
}
console.log(`Static smoke passed: ${refs.length} assets, ${selectors.size} UI bindings, ${requiredSounds.length} sound categories.`);
