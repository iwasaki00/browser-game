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
  const config = fs.readFileSync(path.resolve(__dirname, "../js/config.js"), "utf8");
  const source = fs.readFileSync(path.resolve(__dirname, "../js/sound-library-storage.js"), "utf8");
  if (!config.includes('dbVersion:3') || !source.includes('Math.max(3,')) {
    throw Error("Sound library stores must upgrade existing v2 databases to schema v3");
  if (!source.includes("openPromise") || !source.includes("ensureReady")) throw Error("Recording saves must wait for a shared IndexedDB open request");
  }


  for (const store of ["soundAssets", "soundAssignments", "soundStats"]) {
    if (!source.includes('objectStoreNames.contains("' + store + '")')) throw Error("Missing IndexedDB store " + store);
  }
  if (/delete\s+pack\.sounds|deleteObjectStore/.test(source)) throw Error("Migration must not delete legacy recordings or stores");
  console.log("Sound library storage passed: v3 upgrade, stable assignment IDs, deduplication, and non-destructive migration.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
