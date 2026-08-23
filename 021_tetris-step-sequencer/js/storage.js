export const DEFAULT_SETTINGS = Object.freeze({
  bpm: 100,
  masterVolume: 0.8,
  drumVolume: 0.8,
  bassVolume: 0.45,
  chordVolume: 0.35,
  eventVolume: 0.5,
  sequencerVolume: 0.8,
  seVolume: 0.5,
  muted: Object.freeze({
    master: false,
    drum: false,
    bass: false,
    chord: false,
    event: false,
  }),
  chordMode: true,
  bassMode: "BASIC",
  replayRecord: true,
  controlMode: "hybrid",
  swipeEnabled: true,
  barSpeed: 1,
  debugMode: false,
});

const DB_NAME = "tetris-step-sequencer";
const DB_VERSION = 1;
const STORE_NAME = "state";
const SETTINGS_KEY = "settings";
const HIGH_SCORE_KEY = "highScore";
const ALLOWED_BAR_SPEEDS = Object.freeze([0.5, 1, 2]);
const ALLOWED_BASS_MODES = Object.freeze([
  "OFF",
  "BASIC",
  "FOUR ON FLOOR",
  "SYNCOPATION",
]);

// Shared by instances so the fallback remains useful for the page lifetime.
const memoryState = {
  highScore: 0,
  settings: { ...DEFAULT_SETTINGS },
};

const copyState = () => ({
  highScore: memoryState.highScore,
  settings: {
    ...memoryState.settings,
    muted: { ...memoryState.settings.muted },
  },
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
    masterVolume: finiteNumber(
      input.masterVolume,
      base.masterVolume,
      0,
      1,
    ),
    drumVolume: finiteNumber(
      input.drumVolume ?? input.sequencerVolume,
      base.drumVolume,
      0,
      1,
    ),
    bassVolume: finiteNumber(input.bassVolume, base.bassVolume, 0, 1),
    chordVolume: finiteNumber(input.chordVolume, base.chordVolume, 0, 1),
    eventVolume: finiteNumber(
      input.eventVolume ?? input.seVolume,
      base.eventVolume,
      0,
      1,
    ),
    sequencerVolume: finiteNumber(
      input.drumVolume ?? input.sequencerVolume,
      base.sequencerVolume,
      0,
      1,
    ),
    seVolume: finiteNumber(
      input.eventVolume ?? input.seVolume,
      base.seVolume,
      0,
      1,
    ),
    muted: Object.fromEntries(
      ["master", "drum", "bass", "chord", "event"].map((bus) => [
        bus,
        Boolean(input.muted?.[bus] ?? base.muted?.[bus]),
      ]),
    ),
    chordMode:
      typeof input.chordMode === "boolean"
        ? input.chordMode
        : base.chordMode,
    bassMode: ALLOWED_BASS_MODES.includes(input.bassMode)
      ? input.bassMode
      : base.bassMode,
    replayRecord:
      typeof input.replayRecord === "boolean"
        ? input.replayRecord
        : base.replayRecord,
    controlMode:
      typeof input.controlMode === "string" && input.controlMode.trim()
        ? input.controlMode
        : base.controlMode,
    swipeEnabled:
      typeof input.swipeEnabled === "boolean"
        ? input.swipeEnabled
        : base.swipeEnabled,
    barSpeed: ALLOWED_BAR_SPEEDS.includes(speed) ? speed : base.barSpeed,
    debugMode:
      typeof input.debugMode === "boolean"
        ? input.debugMode
        : base.debugMode,
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

      return {
        ...memoryState.settings,
        muted: { ...memoryState.settings.muted },
      };
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
