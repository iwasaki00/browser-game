const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const managerSource = fs.readFileSync(path.join(root, "js", "SoundManager.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "js", "bgm-config.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const interactionCss = fs.readFileSync(path.join(root, "css", "interaction-fixes.css"), "utf8");

let lastSource = null;
class FakeAudioContext {
  constructor() { this.state = "running"; this.destination = {}; }
  createGain() { return { gain: { value: 0 }, connect() { return this; } }; }
  createBufferSource() { lastSource = { loop: false, connect() { return this; }, start() { this.started = true; }, stop() { this.stopped = true; }, onended: null }; return lastSource; }
  async decodeAudioData() { return { duration: 2 }; }
}

const windowObject = { AudioContext: FakeAudioContext };
vm.runInNewContext(managerSource, { window: windowObject, console, Math });
const config = { defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: { shooterBgm: { id: "shooterBgm" } }, soundDefinitions: [{ id: "shooterBgm" }] };
const manager = new windowObject.SoundManager(config);

(async () => {
  await manager.loadPack({ sounds: { shooterBgm: { async arrayBuffer() { return new ArrayBuffer(1); } } } }, ["shooterBgm"]);
  const started = await manager.startLoop("shooterBgm");
  if (!started || !lastSource?.loop || !lastSource.started) throw new Error("Recorded BGM must start as a looping AudioBufferSourceNode");
  manager.stopAllLoops();
  if (!lastSource.stopped) throw new Error("BGM loop must stop when leaving or switching games");

  for (const id of ["shooterBgm", "actionBgm", "puzzleBgm"]) if (!configSource.includes(id)) throw new Error(`Missing game BGM definition: ${id}`);
  for (const token of ["startLoop(definition.bgm", "sound.stopAllLoops()", "fillRect(0, 0, canvas.width, canvas.height)"]) if (!appSource.includes(token)) throw new Error(`Missing BGM or canvas transition integration: ${token}`);
  if (!html.includes("./js/bgm-config.js") || !html.includes("./css/interaction-fixes.css")) throw new Error("BGM config or interaction CSS is not loaded");
  if (!interactionCss.includes("touch-action: manipulation") || !interactionCss.includes(".game-countdown")) throw new Error("Double-tap zoom or opaque game transition styling is missing");

  console.log("BGM loop passed: per-game recording, looping playback, stop lifecycle, zoom prevention, and clean transition.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
