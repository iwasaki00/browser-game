const fs = require("fs");
const path = require("path");
const vm = require("vm");

class StorageManager {}
const windowObject = { StorageManager };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "../js/sound-library-storage.js"), "utf8"),
  { window: windowObject, console, Date, Math, Object, Set }
);

(async () => {
  const storage = new windowObject.StorageManager();
  let saved = null;
  storage.request = (_store, _mode, operation) => Promise.resolve(operation({ put(value) { saved = value; return value; } }));
  await storage.saveSoundAssignment({ id: "wrong-old-id", packId: "pack-new", soundKey: "actionJump", assetIds: ["a", "a", "b"], playMode: "sequence" });
  if (saved.id !== "pack-new::actionJump") throw Error("Assignment ID must follow pack and sound key");
  if (saved.assetIds.join(",") !== "a,b") throw Error("Duplicate asset references were not removed");

  const source = fs.readFileSync(path.resolve(__dirname, "../js/sound-library-storage.js"), "utf8");
  for (const store of ["soundAssets", "soundAssignments", "soundStats"]) {
    if (!source.includes('objectStoreNames.contains("' + store + '")')) throw Error("Missing IndexedDB store " + store);
  }
  if (/delete\s+pack\.sounds|deleteObjectStore/.test(source)) throw Error("Migration must not delete legacy recordings or stores");
  console.log("Sound library storage passed: v2 stores, stable assignment IDs, deduplication, and non-destructive migration.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
