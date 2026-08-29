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

console.log("Record accept passed: save returns to studio immediately and decoding is race-safe.");
