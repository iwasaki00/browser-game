const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

const firstInlineScript = html.indexOf("<script>");
const assignmentDialog = html.indexOf('id="assignmentDialog"');
const detailDialog = html.indexOf('id="assetDetailDialog"');
if (assignmentDialog < 0 || detailDialog < 0 || assignmentDialog > firstInlineScript || detailDialog > firstInlineScript) {
  throw Error("Library dialogs must be outside the startup script");
}

const resultStart = html.indexOf('id="resultScreen"');
const resultEnd = html.indexOf('id="settingsScreen"', resultStart);
const assetCounts = html.indexOf('id="resultAssetCounts"');
if (assetCounts < resultStart || assetCounts > resultEnd) throw Error("Asset result breakdown must be inside result screen");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw Error("Duplicate HTML IDs: " + [...new Set(duplicates)].join(", "));

for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  new Function(match[1]);
}
for (const file of ["css/sound-library.css", "js/sound-library-storage.js", "js/sound-library-manager.js", "js/SoundLibraryController.js"]) {
  if (!fs.existsSync(path.resolve(__dirname, "..", file))) throw Error("Missing library asset " + file);
  if (!html.includes("./" + file + "?v=20260905-2")) throw Error("Unversioned library asset " + file);
}

console.log("Sound library HTML passed: dialog placement, result nesting, unique IDs, inline script, and versioned assets.");
