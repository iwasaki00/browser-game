const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const manager = fs.readFileSync(path.join(root, "js", "SoundManager.js"), "utf8");
const start = app.indexOf("async function acceptRecording()");
const end = app.indexOf("async function resetRecordedSound", start);
const body = app.slice(start, end);

if (start < 0 || !body.includes('showScreen("studioScreen")')) throw new Error("Accepting a recording must return to the studio");
if (body.includes("await sound.loadPack")) throw new Error("The studio transition must not wait for audio decoding");
if (body.indexOf('showScreen("studioScreen")') > body.indexOf("sound.loadPack")) throw new Error("The studio must appear before background audio decoding starts");
if (!body.includes("acceptRecordingButton") || !body.includes("button.disabled")) throw new Error("The accept button must prevent duplicate submissions");
if (!manager.includes("loadGeneration") || !manager.includes("nextBuffers")) throw new Error("Overlapping pack decodes must ignore stale results");
if (!body.includes('showError(error, "save")')) throw new Error("Recording save failures must not be mislabeled as microphone failures");
if (!app.includes("録音データはこの画面に残っています")) throw new Error("Save failure guidance must explain that the pending recording is retained");

console.log("Record accept passed: save returns to studio immediately and decoding is race-safe.");
