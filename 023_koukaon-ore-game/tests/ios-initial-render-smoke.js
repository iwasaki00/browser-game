const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const managerSource = fs.readFileSync(path.join(root, "js", "SoundManager.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");

let resumeCalls = 0;
class SuspendedAudioContext {
  constructor() { this.state = "suspended"; this.destination = {}; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  async resume() { resumeCalls += 1; this.state = "running"; }
}

const windowObject = { AudioContext: SuspendedAudioContext };
vm.runInNewContext(managerSource, { window: windowObject, console, Math });
const config = {
  defaultSettings: { masterVolume: 1, effectVolume: 1 },
  soundCatalog: { shot: { id: "shot" } },
  soundDefinitions: [{ id: "shot" }]
};
const manager = new windowObject.SoundManager(config);

(async () => {
  await manager.loadPack({ id: "empty", sounds: {} }, ["shot"]);
  if (resumeCalls !== 0) throw new Error("Initial pack loading must not resume AudioContext before an iPhone user gesture");
  await manager.unlock();
  if (resumeCalls !== 1) throw new Error("AudioContext must resume when unlock is called from a user action");

  const initStart = appSource.indexOf("async function init()");
  const firstAwait = appSource.indexOf("await storage.init()", initStart);
  const earlyRender = appSource.indexOf("renderAll()", initStart);
  const earlyScreen = appSource.indexOf('showScreen("titleScreen")', initStart);
  if (initStart < 0 || earlyRender < initStart || earlyRender > firstAwait || earlyScreen > firstAwait) {
    throw new Error("All interactive UI and the title screen must render before asynchronous storage initialization");
  }
  if (!appSource.includes("ready: true") || !appSource.includes("packs: [initialPack], currentPack: initialPack")) {
    throw new Error("A usable in-memory sound pack must exist before storage initialization");
  }
  if (!appSource.includes("const enabled = definition.playable;")) {
    throw new Error("Playable game buttons must not depend on asynchronous initialization");
  }

  console.log("iPhone initial render passed: game list is immediate and audio resume waits for a user action.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
