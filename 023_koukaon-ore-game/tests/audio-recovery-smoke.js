const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appSource = fs.readFileSync(path.resolve(__dirname, "../js/app.js"), "utf8");
const source = fs.readFileSync(path.resolve(__dirname, "../js/SoundManager.js"), "utf8");
let resumeCalls = 0;
let contextCalls = 0;
let closeCalls = 0;
let suspendCalls = 0;
class InterruptedAudioContext {
  constructor() { contextCalls += 1; this.state = "interrupted"; this.destination = {}; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createBuffer() { return {}; }
  createBufferSource() { return { connect() {}, start() {} }; }
  async resume() { resumeCalls += 1; this.state = "running"; }
  async suspend() { suspendCalls += 1; this.state = "suspended"; }
  async close() { closeCalls += 1; this.state = "closed"; }
}

const windowObject = { AudioContext: InterruptedAudioContext };
vm.runInNewContext(source, { window: windowObject, console, Math, setTimeout, clearTimeout });
const manager = new windowObject.SoundManager({ defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: {}, soundDefinitions: [] });

(async () => {
  await manager.unlock();
  if (resumeCalls !== 1 || manager.context.state !== "running") throw new Error("An iOS interrupted AudioContext must resume on the next user-triggered sound");
  await manager.recover();
  if (contextCalls !== 2 || closeCalls !== 1 || suspendCalls !== 0 || resumeCalls !== 2 || manager.context.state !== "running") throw new Error("Manual recovery must rebuild a silent-running context inside the user gesture");

  windowObject.navigator = { userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 5 };
  const beforeDeferredLoad = contextCalls;
  const iosManager = new windowObject.SoundManager({ defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: {}, soundDefinitions: [] });
  const loadedBeforeTap = await iosManager.loadPack({ sounds: {} }, []);
  if (loadedBeforeTap !== false || contextCalls !== beforeDeferredLoad || !iosManager.pendingPack) throw new Error("iPhone must defer AudioContext creation until a user gesture");
  await iosManager.unlock();
  if (contextCalls !== beforeDeferredLoad + 1 || iosManager.context.state !== "running" || iosManager.pendingPack) throw new Error("First iPhone tap must create, resume, prime, and begin loading audio");

  for (const eventName of ["pointerdown", "touchstart", "click"]) if (!appSource.includes(`addEventListener("${eventName}", unlockAudioOnGesture`)) throw new Error(`Missing iPhone audio gesture fallback: ${eventName}`);
  if (!source.includes("AudioContext resume timeout")) throw new Error("A stalled iPhone resume promise must not leave startup status loading forever");
  console.log("Audio recovery passed: iPhone creation is gesture-gated and silent contexts are rebuilt.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
