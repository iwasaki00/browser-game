const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const storage = fs.readFileSync(path.join(root, "js/sound-library-storage.js"), "utf8");
const manager = fs.readFileSync(path.join(root, "js/sound-library-manager.js"), "utf8");
const controller = fs.readFileSync(path.join(root, "js/SoundLibraryController.js"), "utf8");
for (const token of ["libraryScreen", "soundLibraryList", "assignmentDialog", "assetDetailDialog", "newLibraryRecordingButton", "resultAssetCounts"]) {
  if (!html.includes(token)) throw Error("Library UI missing " + token);
}
for (const token of ["soundAssets", "soundAssignments", "soundStats", "migrateLegacyRecordings"]) {
  if (!storage.includes(token)) throw Error("Library storage missing " + token);
}
for (const token of ["randomNoRepeat", "sequence", "temporaryAssignments", "assetBuffers", "getAssetPlayStats"]) {
  if (!manager.includes(token)) throw Error("Library manager missing " + token);
}
for (const token of ["saveSlotRecording", "saveLibraryRecording", "deleteSelected", "shuffleCurrentGame", "sameAssetEverywhere", "runDiagnostic"]) {
  if (!controller.includes(token)) throw Error("Library controller missing " + token);
}
if (!app.includes("library.saveSlotRecording") || !app.includes("storage.mergeSoundStats")) throw Error("App integration is missing");
console.log("Sound library static passed: screens, stores, playback modes, collection tools, and app integration.");
