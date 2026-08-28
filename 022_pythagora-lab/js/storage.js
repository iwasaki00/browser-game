(function defineStorage(global) {
  "use strict";
  const P = global.PythagoraLab;
  const KEYS = Object.freeze({
    settings: "pythagoraLab:settings:v1",
    progress: "pythagoraLab:progress:v1",
    works: "pythagoraLab:works:v1",
    tutorial: "pythagoraLab:tutorial:v1"
  });

  class StorageManager {
    constructor() {
      this.memory = new Map();
    }

    read(key, fallback) {
      try {
        const value = global.localStorage.getItem(key);
        return value == null ? fallback : P.util.safeJsonParse(value, fallback);
      } catch {
        return this.memory.has(key) ? P.util.deepClone(this.memory.get(key)) : fallback;
      }
    }

    write(key, value) {
      this.memory.set(key, P.util.deepClone(value));
      try {
        global.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    loadSettings() {
      return Object.assign({ grid: true, snap: true, sound: true, debug: false }, this.read(KEYS.settings, {}));
    }

    saveSettings(settings) {
      return this.write(KEYS.settings, settings);
    }

    loadProgress() {
      return this.read(KEYS.progress, {});
    }

    saveStageResult(stageId, result) {
      const progress = this.loadProgress();
      const previous = progress[stageId];
      if (!previous || result.stars > previous.stars || (result.stars === previous.stars && result.time < previous.time)) {
        progress[stageId] = {
          stars: result.stars,
          time: result.time,
          parts: result.parts,
          chain: result.chain,
          clearedAt: new Date().toISOString()
        };
      }
      this.write(KEYS.progress, progress);
      return progress[stageId];
    }

    hasSeenTutorial() {
      return Boolean(this.read(KEYS.tutorial, false));
    }

    markTutorialSeen(value = true) {
      this.write(KEYS.tutorial, Boolean(value));
    }

    listWorks() {
      const works = this.read(KEYS.works, []);
      return Array.isArray(works) ? works : [];
    }

    saveWork(work) {
      const works = this.listWorks();
      const now = new Date().toISOString();
      const record = Object.assign({}, P.util.deepClone(work), {
        id: work.id || P.util.uid("work"),
        updatedAt: now,
        createdAt: work.createdAt || now,
        schemaVersion: 1
      });
      const index = works.findIndex((item) => item.id === record.id);
      if (index >= 0) works[index] = record;
      else works.unshift(record);
      this.write(KEYS.works, works.slice(0, 24));
      return record;
    }

    deleteWork(id) {
      const next = this.listWorks().filter((work) => work.id !== id);
      this.write(KEYS.works, next);
      return next;
    }
  }

  P.StorageManager = StorageManager;
})(window);
