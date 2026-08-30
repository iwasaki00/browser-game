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
  let mediaPlayCalls = 0;
  let mediaPauseCalls = 0;
  windowObject.Audio = class { constructor() { this.currentTime = 0; } play() { mediaPlayCalls += 1; return Promise.resolve(); } pause() { mediaPauseCalls += 1; } };

  const beforeDeferredLoad = contextCalls;
  const iosManager = new windowObject.SoundManager({ defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: {}, soundDefinitions: [] });
  const loadedBeforeTap = await iosManager.loadPack({ sounds: {} }, []);
  if (loadedBeforeTap !== false || contextCalls !== beforeDeferredLoad || !iosManager.pendingPack) throw new Error("iPhone must defer AudioContext creation until a user gesture");
  await iosManager.unlock();
  if (contextCalls !== beforeDeferredLoad + 1 || iosManager.context.state !== "running" || iosManager.pendingPack) throw new Error("First iPhone tap must create, resume, prime, and begin loading audio");

  if (mediaPlayCalls !== 1 || mediaPauseCalls !== 1) throw new Error("First iPhone tap must open the HTML audio route while Web Audio resumes, then stop the helper");
  let retryResumeCalls = 0;
  class RetryAudioContext extends InterruptedAudioContext {
    constructor() { super(); this.state = "suspended"; }
    async resume() { retryResumeCalls += 1; if (retryResumeCalls >= 2) this.state = "running"; }
  }
  windowObject.AudioContext = RetryAudioContext;
  const retryManager = new windowObject.SoundManager({ defaultSettings: { masterVolume: 1, effectVolume: 1 }, soundCatalog: {}, soundDefinitions: [] });
  retryManager.userActivated = true;
  await retryManager.unlock();
  if (retryResumeCalls !== 2 || retryManager.context.state !== "running") {
    throw new Error("iPhone Web Audio must retry automatically after the HTML audio route opens");
  }

  for (const eventName of ["pointerdown", "touchstart", "touchend", "click"]) if (!appSource.includes(`addEventListener("${eventName}", unlockAudioOnGesture`)) throw new Error(`Missing iPhone audio gesture fallback: ${eventName}`);
  if (!source.includes("lastUnlockFailed") || !appSource.includes('#resumeAudioButton, #audioResumeNotice')) throw new Error("A failed unlock or manual recovery must rebuild the iPhone audio route on the next gesture");
  if (!source.includes("AudioContext resume timeout")) throw new Error("A stalled iPhone resume promise must not leave startup status loading forever");
  console.log("Audio recovery passed: iPhone creation is gesture-gated and silent contexts are rebuilt.");
  if (!source.includes("retryPromise") || !source.includes("mediaPromise, 650")) throw new Error("Web Audio must automatically retry after the HTML audio route opens");
})().catch((error) => { console.error(error); process.exitCode = 1; });
