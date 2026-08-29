(function () {
  "use strict";

  class StorageManager {
    constructor(config) {
      this.config = config;
      this.db = null;
    }

    async init() {
      if (!window.indexedDB) throw new Error("IndexedDB is not supported");
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.config.dbName, this.config.dbVersion);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "id" });
          if (!db.objectStoreNames.contains("state")) db.createObjectStore("state", { keyPath: "key" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const packs = await this.getAllPacks();
      if (!packs.length) {
        await this.savePack({ id: this.config.defaultPackId, name: "オレ基本セット", createdAt: Date.now(), updatedAt: Date.now(), sounds: {} });
      }
      return this;
    }

    request(store, mode, operation) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(store, mode);
        const req = operation(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    getAllPacks() { return this.request("packs", "readonly", (store) => store.getAll()); }
    getPack(id) { return this.request("packs", "readonly", (store) => store.get(id)); }
    savePack(pack) { pack.updatedAt = Date.now(); return this.request("packs", "readwrite", (store) => store.put(pack)); }
    deletePack(id) { return this.request("packs", "readwrite", (store) => store.delete(id)); }

    async duplicatePack(id, name) {
      const source = await this.getPack(id);
      if (!source) throw new Error("Sound pack not found");
      const copy = { ...source, id: `pack-${Date.now()}`, name, createdAt: Date.now(), updatedAt: Date.now(), sounds: { ...source.sounds } };
      await this.savePack(copy);
      return copy;
    }

    async getState(key, fallback) {
      const entry = await this.request("state", "readonly", (store) => store.get(key));
      return entry ? entry.value : fallback;
    }

    setState(key, value) { return this.request("state", "readwrite", (store) => store.put({ key, value })); }
  }

  window.StorageManager = StorageManager;
})();
