export const DEFAULT_SETTINGS = Object.freeze({
  bpm: 100,
  sequencerVolume: 0.8,
  seVolume: 0.9,
  controlMode: "hybrid",
  swipeEnabled: true,
  barSpeed: 1,
});

const DB_NAME = "tetris-step-sequencer";
const DB_VERSION = 1;
const STORE_NAME = "state";
const SETTINGS_KEY = "settings";
const HIGH_SCORE_KEY = "highScore";
const ALLOWED_BAR_SPEEDS = Object.freeze([0.5, 1, 2]);

// Shared by instances so the fallback remains useful for the page lifetime.
const memoryState = {
  highScore: 0,
  settings: { ...DEFAULT_SETTINGS },
};

const copyState = () => ({
  highScore: memoryState.highScore,
  settings: { ...memoryState.settings },
});

const finiteNumber = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const normalizeSettings = (value = {}, base = DEFAULT_SETTINGS) => {
  const input = value && typeof value === "object" ? value : {};
  const speed = Number(input.barSpeed);

  return {
    bpm: finiteNumber(input.bpm, base.bpm, 40, 300),
    sequencerVolume: finiteNumber(
      input.sequencerVolume,
      base.sequencerVolume,
      0,
      1,
    ),
    seVolume: finiteNumber(input.seVolume, base.seVolume, 0, 1),
    controlMode:
      typeof input.controlMode === "string" && input.controlMode.trim()
        ? input.controlMode
        : base.controlMode,
    swipeEnabled:
      typeof input.swipeEnabled === "boolean"
        ? input.swipeEnabled
        : base.swipeEnabled,
    barSpeed: ALLOWED_BAR_SPEEDS.includes(speed) ? speed : base.barSpeed,
  };
};

/**
 * IndexedDB state store. If IndexedDB is unavailable or fails, public methods
 * continue with a page-lifetime in-memory store and never reject.
 */
export class GameStorage {
  constructor() {
    this._db = null;
    this._initPromise = null;
    this._saveQueue = Promise.resolve();
    this.usingMemoryFallback = false;
  }

  async init() {
    if (this._db || this.usingMemoryFallback) return this;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._openDatabase()
      .then((db) => {
        this._db = db;
        db.onversionchange = () => {
          db.close();
          this._db = null;
          this.usingMemoryFallback = true;
        };
        return this;
      })
      .catch((error) => {
        console.warn(
          "IndexedDB is unavailable; using in-memory game storage.",
          error,
        );
        this._useMemoryFallback();
        return this;
      });

    return this._initPromise;
  }

  async loadState() {
    await this.init();

    if (this._db) {
      try {
        const [storedHighScore, storedSettings] = await Promise.all([
          this._read(HIGH_SCORE_KEY),
          this._read(SETTINGS_KEY),
        ]);

        memoryState.highScore = finiteNumber(
          storedHighScore,
          memoryState.highScore,
          0,
          Number.MAX_SAFE_INTEGER,
        );
        memoryState.settings = normalizeSettings(
          storedSettings,
          memoryState.settings,
        );
      } catch (error) {
        console.warn(
          "Could not read IndexedDB; continuing with in-memory state.",
          error,
        );
        this._useMemoryFallback();
      }
    }

    return copyState();
  }

  saveSettings(settings = {}) {
    const operation = this._saveQueue.then(async () => {
      await this.loadState();
      memoryState.settings = normalizeSettings(
        settings,
        memoryState.settings,
      );

      if (this._db) {
        try {
          await this._write(SETTINGS_KEY, memoryState.settings);
        } catch (error) {
          console.warn(
            "Could not save settings to IndexedDB; kept them in memory.",
            error,
          );
          this._useMemoryFallback();
        }
      }

      return { ...memoryState.settings };
    });

    this._saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  saveHighScore(score) {
    const operation = this._saveQueue.then(async () => {
      await this.loadState();
      const candidate = Math.floor(
        finiteNumber(score, 0, 0, Number.MAX_SAFE_INTEGER),
      );
      memoryState.highScore = Math.max(memoryState.highScore, candidate);

      if (this._db) {
        try {
          await this._write(HIGH_SCORE_KEY, memoryState.highScore);
        } catch (error) {
          console.warn(
            "Could not save high score to IndexedDB; kept it in memory.",
            error,
          );
          this._useMemoryFallback();
        }
      }

      return memoryState.highScore;
    });

    this._saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  _openDatabase() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB API is not available."));
        return;
      }

      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open IndexedDB."));
      request.onblocked = () =>
        reject(new Error("IndexedDB upgrade was blocked."));
    });
  }

  _read(key) {
    return new Promise((resolve, reject) => {
      if (!this._db) {
        resolve(undefined);
        return;
      }

      const transaction = this._db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to read ${key}.`));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error(`Read of ${key} was aborted.`));
    });
  }

  _write(key, value) {
    return new Promise((resolve, reject) => {
      if (!this._db) {
        resolve();
        return;
      }

      const transaction = this._db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error(`Failed to write ${key}.`));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error(`Write of ${key} was aborted.`));
    });
  }

  _useMemoryFallback() {
    if (this._db) this._db.close();
    this._db = null;
    this.usingMemoryFallback = true;
  }
}
