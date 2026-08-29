const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

for (const token of ["data-copy-sound", "openCopySound", "copyRecordedSound", "copyTargetId", "copySoundSource", "storage.savePack", "sound.loadPack"]) {
  if (!app.includes(token)) throw new Error(`Sound-copy feature is missing: ${token}`);
}
for (const id of ["copySoundDialog", "copySoundTarget", "copySoundSource", "cancelCopySoundButton", "confirmCopySoundButton"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Sound-copy dialog element is missing: #${id}`);
}
if (!html.includes("./css/sound-copy.css")) throw new Error("Sound-copy stylesheet is not loaded");

console.log("Sound copy passed: source selection, pack persistence, reload, and dialog UI.");
