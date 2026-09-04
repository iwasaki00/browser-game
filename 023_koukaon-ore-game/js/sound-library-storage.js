(function () {
  "use strict";

  const proto = window.StorageManager.prototype;
  const originalDuplicatePack = proto.duplicatePack;
  const originalDeletePack = proto.deletePack;
  const uid = prefix => prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);

  proto.init = async function () {
    if (!window.indexedDB) throw new Error("IndexedDB is not supported");
    if (this.db) return this;
    if (this.openPromise) { this.db = await this.openPromise; return this; }
    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, Math.max(3, this.config.dbVersion || 1));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state", { keyPath: "key" });
        if (!db.objectStoreNames.contains("soundAssets")) {
          const assets = db.createObjectStore("soundAssets", { keyPath: "id" });
          assets.createIndex("createdAt", "createdAt");
          assets.createIndex("favorite", "favorite");
          assets.createIndex("name", "name");
        }
        if (!db.objectStoreNames.contains("soundAssignments")) {
          const assignments = db.createObjectStore("soundAssignments", { keyPath: "id" });
          assignments.createIndex("packId", "packId");
          assignments.createIndex("soundKey", "soundKey");
        }
        if (!db.objectStoreNames.contains("soundStats")) db.createObjectStore("soundStats", { keyPath: "assetId" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => console.warn("保存領域の更新待ちです。ほかのタブを閉じると続行します。");
    });
    try { this.db = await this.openPromise; }
    finally { this.openPromise = null; }
    const packs = await this.getAllPacks();
    if (!packs.length) {
      await this.savePack({ id: this.config.defaultPackId, name: "オレ基本セット", createdAt: Date.now(), updatedAt: Date.now(), sounds: {} });
    }
    return this;
  };

  proto.getAllSoundAssets = function () { return this.request("soundAssets", "readonly", store => store.getAll()); };
  proto.ensureReady = async function () {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("保存領域に接続できませんでした");
    return this;
  };
  proto.getSoundAsset = function (id) { return this.request("soundAssets", "readonly", store => store.get(id)); };
  proto.saveSoundAsset = function (asset) {
    const now = Date.now();
    const normalized = {
      mimeType: asset.blob?.type || "audio/webm", duration: 0, tags: [], favorite: false,
      trimSettings: null, volume: 1, playbackRate: 1, waveformData: [], playCount: 0,
      createdAt: now, updatedAt: now, ...asset, tags: [...new Set(asset.tags || [])]
    };
    normalized.updatedAt = now;
    normalized.byteSize = normalized.blob?.size || normalized.byteSize || 0;
    return this.request("soundAssets", "readwrite", store => store.put(normalized));
  };
  proto.deleteSoundAsset = function (id) { return this.request("soundAssets", "readwrite", store => store.delete(id)); };
  proto.getAllSoundAssignments = function () { return this.request("soundAssignments", "readonly", store => store.getAll()); };
  proto.getAssignmentsForPack = async function (packId) {
    return (await this.getAllSoundAssignments()).filter(item => item.packId === packId);
  };
  proto.getSoundAssignment = function (packId, soundKey) {
    return this.request("soundAssignments", "readonly", store => store.get(packId + "::" + soundKey));
  };
  proto.saveSoundAssignment = function (assignment) {
    const normalized = {
      assetIds: [], playMode: "fixed", createdAt: Date.now(), ...assignment,
      id: assignment.packId + "::" + assignment.soundKey,
      updatedAt: Date.now()
    };
    normalized.assetIds = [...new Set(normalized.assetIds || [])];
    return this.request("soundAssignments", "readwrite", store => store.put(normalized));
  };
  proto.deleteSoundAssignment = function (packId, soundKey) {
    return this.request("soundAssignments", "readwrite", store => store.delete(packId + "::" + soundKey));
  };

  proto.findAssetUsages = async function (assetId) {
    return (await this.getAllSoundAssignments()).filter(item => item.assetIds?.includes(assetId));
  };
  proto.unlinkAndDeleteSoundAsset = async function (assetId) {
    const usages = await this.findAssetUsages(assetId);
    for (const assignment of usages) {
      const assetIds = assignment.assetIds.filter(id => id !== assetId);
      if (assetIds.length) await this.saveSoundAssignment({ ...assignment, assetIds });
      else await this.deleteSoundAssignment(assignment.packId, assignment.soundKey);
      if (!assetIds.length) {
        const pack = await this.getPack(assignment.packId);
        if (pack?.sounds?.[assignment.soundKey]) {
          const sounds = { ...pack.sounds };
          delete sounds[assignment.soundKey];
          pack.sounds = sounds;
          await this.savePack(pack);
        }
      }
    }
    await this.deleteSoundAsset(assetId);
    return usages;
  };
  proto.duplicateSoundAsset = async function (assetId) {
    const source = await this.getSoundAsset(assetId);
    if (!source) throw new Error("オレ音が見つかりません");
    const copy = { ...source, id: uid("asset"), name: source.name + " コピー", favorite: false, playCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    await this.saveSoundAsset(copy);
    return copy;
  };

  proto.getAllSoundStats = function () { return this.request("soundStats", "readonly", store => store.getAll()); };
  proto.mergeSoundStats = async function (counts, gameId) {
    for (const [assetId, count] of Object.entries(counts || {})) {
      if (!count) continue;
      const current = await this.request("soundStats", "readonly", store => store.get(assetId)) || { assetId, total: 0, games: {}, updatedAt: 0 };
      current.total += count;
      current.games[gameId || "library"] = (current.games[gameId || "library"] || 0) + count;
      current.updatedAt = Date.now();
      await this.request("soundStats", "readwrite", store => store.put(current));
    }
  };

  proto.migrateLegacyRecordings = async function () {
    if (await this.getState("soundAssetMigrationV2", false)) return { migrated: 0, skipped: true };
    const packs = await this.getAllPacks();
    const existingAssignments = await this.getAllSoundAssignments();
    const assigned = new Set(existingAssignments.map(item => item.id));
    let migrated = 0;
    for (const pack of packs) {
      for (const [soundKey, stored] of Object.entries(pack.sounds || {})) {
        const assignmentId = pack.id + "::" + soundKey;
        if (assigned.has(assignmentId)) continue;
        const blobs = (Array.isArray(stored) ? stored : [stored]).filter(blob => blob && typeof blob.arrayBuffer === "function");
        if (!blobs.length) continue;
        const definition = this.config.soundCatalog[soundKey];
        const owner = Object.values(this.config.gameDefinitions).find(game => game.sounds.includes(soundKey));
        const assetIds = [];
        for (let index = 0; index < blobs.length; index += 1) {
          const asset = {
            id: uid("asset"),
            name: (definition?.label || soundKey) + (blobs.length > 1 ? " " + (index + 1) : ""),
            blob: blobs[index],
            mimeType: blobs[index].type || "audio/webm",
            duration: 0,
            tags: ["移行済み", owner?.name || "ゲーム音"],
            favorite: false,
            source: { type: "legacy", packId: pack.id, soundKey },
            createdAt: pack.updatedAt || pack.createdAt || Date.now(),
            updatedAt: Date.now()
          };
          await this.saveSoundAsset(asset);
          assetIds.push(asset.id);
          migrated += 1;
        }
        await this.saveSoundAssignment({ packId: pack.id, gameId: owner?.id || "shared", soundKey, assetIds, playMode: assetIds.length > 1 ? "randomNoRepeat" : "fixed", migratedFromLegacy: true });
      }
    }
    await this.setState("soundAssetMigrationV2", { completedAt: Date.now(), migrated });
    return { migrated, skipped: false };
  };

  proto.duplicatePack = async function (id, name) {
    const source = await this.getPack(id);
    if (!source) throw new Error("Sound pack not found");
    const copy = { ...source, id: uid("pack"), name, sounds: {}, createdAt: Date.now(), updatedAt: Date.now() };
    await this.savePack(copy);
    const assignments = await this.getAssignmentsForPack(id);
    for (const assignment of assignments) {
      await this.saveSoundAssignment({ ...assignment, id: undefined, packId: copy.id, createdAt: Date.now(), updatedAt: Date.now() });
    }
    return copy;
  };
  proto.deletePack = async function (id) {
    for (const assignment of await this.getAssignmentsForPack(id)) {
      await this.deleteSoundAssignment(id, assignment.soundKey);
    }
    return originalDeletePack.call(this, id);
  };

  proto.diagnoseSoundLibrary = async function () {
    const assets = await this.getAllSoundAssets();
    const assignments = await this.getAllSoundAssignments();
    const ids = new Set(assets.map(asset => asset.id));
    const broken = assignments.flatMap(assignment => (assignment.assetIds || []).filter(id => !ids.has(id)).map(id => ({ assignment: assignment.id, missingAssetId: id })));
    const used = new Set(assignments.flatMap(assignment => assignment.assetIds || []));
    const unused = assets.filter(asset => !used.has(asset.id)).map(asset => asset.id);
    const blobFailures = assets.filter(asset => !asset.blob || typeof asset.blob.arrayBuffer !== "function").map(asset => asset.id);
    return { assets: assets.length, assignments: assignments.length, broken, unused, blobFailures, duplicateIds: [] };
  };

  window.ORE_SOUND_ASSET_ID = uid;
})();
