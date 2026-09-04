const fs = require("fs");
const path = require("path");
const vm = require("vm");

class BaseSoundManager {
  constructor(config) {
    this.config = config;
    this.context = {
      state: "running",
      createBufferSource() {
        return { buffer: null, playbackRate: { value: 1 }, connect(node) { return node; }, start() {}, stop() {} };
      },
      createGain() { return { gain: { value: 1 }, connect(node) { return node; } }; }
    };
    this.master = {};
    this.counts = {};
    this.loops = new Map();
  }
  async unlock() { return this.context; }
  async loadPack() { return true; }
  resetPlayStats() { this.counts = {}; }
  async play(id) { this.counts[id] = (this.counts[id] || 0) + 1; return "fallback"; }
  async startLoop() { return false; }
}

const windowObject = { SoundManager: BaseSoundManager };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "../js/sound-library-manager.js"), "utf8"),
  { window: windowObject, console, Map, Object, Math, Set }
);

const sound = new windowObject.SoundManager({ defaultGameId: "action", soundDefinitions: [] });
const assets = ["a", "b", "c"].map(id => ({ id, name: id, volume: 1, playbackRate: 1 }));
sound.setAssetLibrary(assets, [
  { soundKey: "fixed", assetIds: ["a", "b"], playMode: "fixed" },
  { soundKey: "sequence", assetIds: ["a", "b", "c"], playMode: "sequence" },
  { soundKey: "random", assetIds: ["a", "b", "c"], playMode: "randomNoRepeat" }
], "action");
for (const asset of assets) sound.assetBuffers.set(asset.id, { id: asset.id });

(async () => {
  if (await sound.play("fixed") !== "a") throw Error("Fixed mode must use first asset");
  const sequence = [await sound.play("sequence"), await sound.play("sequence"), await sound.play("sequence"), await sound.play("sequence")];
  if (sequence.join(",") !== "a,b,c,a") throw Error("Sequence mode order is invalid: " + sequence.join(","));
  let previous = null;
  for (let index = 0; index < 30; index += 1) {
    const selected = await sound.play("random");
    if (selected === previous) throw Error("randomNoRepeat repeated the previous asset");
    previous = selected;
  }
  sound.setTemporaryAssignments({ fixed: { assetIds: ["c"], playMode: "fixed" } });
  if (await sound.play("fixed") !== "c" || !sound.hasTemporaryAssignments()) throw Error("Temporary assignment was not applied");
  sound.clearTemporaryAssignments();
  if (await sound.play("fixed") !== "a") throw Error("Temporary assignment did not restore original");
  const stats = sound.getAssetPlayStats();
  if (!stats.a || !stats.b || !stats.c) throw Error("Asset statistics are incomplete");
  console.log("Sound library manager passed: fixed, sequence, no-repeat random, temporary assignment, and asset stats.");
})().catch(error => {
const controllerSource=fs.readFileSync(path.resolve(__dirname,"../js/SoundLibraryController.js"),"utf8");
const recorderSource=fs.readFileSync(path.resolve(__dirname,"../js/RecorderManager.js"),"utf8");
if(controllerSource.indexOf("asset.volume = Number")>controllerSource.indexOf("await this.storage.saveSoundAsset(asset)"))throw Error("Asset volume must be assigned before it is persisted");
if(!controllerSource.includes("suggestedGain")||!recorderSource.includes("autoGainControl: true"))throw Error("New recordings must receive safe automatic gain correction");
if(!fs.readFileSync(path.resolve(__dirname,"../js/sound-library-manager.js"),"utf8").includes("(options.gain ?? .35) * assetVolume"))throw Error("Loop playback must apply recorded asset volume");

  console.error(error);
  process.exitCode = 1;
});
