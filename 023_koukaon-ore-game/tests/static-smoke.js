const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map((match) => match[1]);
for (const ref of refs) {
  const file = path.resolve(root, ref);
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
  if (!config.includes(`id: "${sound}"`)) throw new Error(`Missing required sound category: ${sound}`);
}

console.log(`Static smoke passed: ${refs.length} assets, ${selectors.size} UI bindings, ${requiredSounds.length} sound categories.`);
