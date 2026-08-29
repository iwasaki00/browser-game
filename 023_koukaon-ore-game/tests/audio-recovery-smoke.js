const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "../js/SoundManager.js"), "utf8");
let resumeCalls = 0;
let suspendCalls = 0;
class InterruptedAudioContext {
  constructor() { this.state = "interrupted"; this.destination = {}; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  async resume() { resumeCalls += 1; this.state = "running"; }
  async suspend() { suspendCalls += 1; this.state = "suspended"; }
}

const windowObject = { AudioContext: InterruptedAudioContext };
vm.runInNewContext(source, { window: windowObject, console, Math });
const manager = new windowObject.SoundManager({ defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: {}, soundDefinitions: [] });

(async () => {
  await manager.unlock();
  if (resumeCalls !== 1 || manager.context.state !== "running") throw new Error("An iOS interrupted AudioContext must resume on the next user-triggered sound");
  await manager.recover();
  if (suspendCalls !== 1 || resumeCalls !== 2 || manager.context.state !== "running") throw new Error("Manual recovery must cycle a running context through suspend and resume");
  console.log("Audio recovery passed: interrupted and silent-running iPhone contexts can recover.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
