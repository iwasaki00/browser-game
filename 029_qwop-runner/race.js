(function () {
  "use strict";

  const RACE_STATE = Object.freeze({
    READY: "READY",
    COUNTDOWN: "COUNTDOWN",
    RUNNING: "RUNNING",
    FINISHED: "FINISHED",
    GAME_OVER: "GAME_OVER"
  });
  const RECORD_VERSION = 2;
  const DISTANCE_SCALE = 2.5;
  const DEFAULT_GAME_OVER_GRACE_MS = 250;
  const STORAGE_KEYS = Object.freeze({
    bestTime: `qwopRunner.bestTimeMs.v${RECORD_VERSION}`,
    bestDistance: `qwopRunner.bestDistanceM.v${RECORD_VERSION}`
  });
  const storageKeysFor = category => category ? Object.freeze({
    bestTime: `qwopRunner.bestTimeMs.${String(category).toUpperCase()}.v${RECORD_VERSION}`,
    bestDistance: `qwopRunner.bestDistanceM.${String(category).toUpperCase()}.v${RECORD_VERSION}`
  }) : STORAGE_KEYS;
  const DEFAULT_COUNTDOWN = Object.freeze({
    ready: 400,
    three: 600,
    two: 600,
    one: 600,
    go: 500
  });

  const finiteNumber = value => value === null || value === undefined || value === ""
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;

  class FallGuard {
    constructor(graceMs = DEFAULT_GAME_OVER_GRACE_MS) {
      this.graceMs = graceMs;
      this.elapsedMs = 0;
    }

    reset() {
      this.elapsedMs = 0;
    }

    update(candidate, deltaMs) {
      this.elapsedMs = candidate ? this.elapsedMs + Math.max(0, deltaMs) : 0;
      return this.elapsedMs >= this.graceMs;
    }
  }

  class RaceController {
    constructor(options = {}) {
      this.goalDistance = options.goalDistance ?? 100;
      this.storage = options.storage ?? null;
      this.recordCategory = options.recordCategory ? String(options.recordCategory).toUpperCase() : null;
      this.storageKeys = storageKeysFor(this.recordCategory);
      this.countdown = { ...DEFAULT_COUNTDOWN, ...(options.countdown || {}) };
      this.loadRecords();
      this.reset(0);
    }

    readNumber(key) {
      try {
        const value = finiteNumber(this.storage?.getItem(key));
        return value !== null && value >= 0 ? value : null;
      } catch {
        return null;
      }
    }

    writeNumber(key, value) {
      try { this.storage?.setItem(key, String(value)); } catch {}
    }

    loadRecords() {
      this.bestTimeMs = this.readNumber(this.storageKeys.bestTime);
      const storedDistance = this.readNumber(this.storageKeys.bestDistance);
      this.bestDistance = storedDistance ?? 0;
      if (this.recordCategory !== "NORMAL") return;
      if (this.bestTimeMs === null) {
        this.bestTimeMs = this.readNumber(STORAGE_KEYS.bestTime);
        if (this.bestTimeMs !== null) this.writeNumber(this.storageKeys.bestTime, this.bestTimeMs);
      }
      if (storedDistance === null) {
        const legacyDistance = this.readNumber(STORAGE_KEYS.bestDistance);
        if (legacyDistance !== null) {
          this.bestDistance = legacyDistance;
          this.writeNumber(this.storageKeys.bestDistance, legacyDistance);
        }
      }
    }

    setRecordCategory(category, now = 0) {
      this.recordCategory = category ? String(category).toUpperCase() : null;
      this.storageKeys = storageKeysFor(this.recordCategory);
      this.loadRecords();
      return this.reset(now);
    }

    reset(now = 0) {
      this.bestDistanceAtStart = this.bestDistance;
      this.state = RACE_STATE.READY;
      this.countdownStartTime = null;
      this.raceStartTime = null;
      this.elapsedMs = 0;
      this.finalTimeMs = null;
      this.currentDistance = 0;
      this.maxDistance = 0;
      this.recordValid = true;
      this.invalidReasons = [];
      this.newBest = false;
      this.previousBestTimeMs = null;
      this.improvementMs = null;
      this.firstFinish = false;
      this.halfwayReached = false;
      this.finalTenReached = false;
      this.newDistanceBest = false;
      this.goVisibleUntil = 0;
      this.resetTime = now;
      return this.snapshot();
    }

    startCountdown(now) {
      this.state = RACE_STATE.COUNTDOWN;
      this.countdownStartTime = now;
      return this.snapshot();
    }

    invalidate(reason = "DEBUG") {
      if (this.recordValid && this.bestDistance > this.bestDistanceAtStart) {
        this.bestDistance = this.bestDistanceAtStart;
        this.writeNumber(this.storageKeys.bestDistance, this.bestDistance);
      }
      if (!this.invalidReasons.includes(reason)) this.invalidReasons.push(reason);
      this.recordValid = false;
    }

    countdownRunAt() {
      const c = this.countdown;
      return c.ready + c.three + c.two + c.one;
    }

    countdownLabel(now) {
      if (this.state === RACE_STATE.READY) return "READY";
      if (this.state === RACE_STATE.RUNNING) return now < this.goVisibleUntil ? "GO!" : "";
      if (this.state !== RACE_STATE.COUNTDOWN || this.countdownStartTime === null) return "";
      const elapsed = Math.max(0, now - this.countdownStartTime);
      const c = this.countdown;
      if (elapsed < c.ready) return "READY";
      if (elapsed < c.ready + c.three) return "3";
      if (elapsed < c.ready + c.three + c.two) return "2";
      if (elapsed < this.countdownRunAt()) return "1";
      return "GO!";
    }

    startRace(now) {
      this.state = RACE_STATE.RUNNING;
      this.raceStartTime = now;
      this.elapsedMs = 0;
      this.goVisibleUntil = now + this.countdown.go;
      return { started: true, finished: false, halfway: false, finalTen: false, newBest: false };
    }

    updateBestDistance(distance) {
      if (!this.recordValid || distance <= this.bestDistance) return false;
      this.bestDistance = distance;
      this.writeNumber(this.storageKeys.bestDistance, distance);
      return true;
    }

    finish(now) {
      if (this.state !== RACE_STATE.RUNNING) return { started: false, finished: false };
      this.elapsedMs = Math.max(0, now - this.raceStartTime);
      this.finalTimeMs = this.elapsedMs;
      this.state = RACE_STATE.FINISHED;
      this.updateBestDistance(Math.max(this.maxDistance, this.goalDistance));
      this.previousBestTimeMs = this.bestTimeMs;
      this.firstFinish = this.recordValid && this.previousBestTimeMs === null;
      if (this.recordValid && (this.bestTimeMs === null || this.finalTimeMs < this.bestTimeMs)) {
        this.bestTimeMs = this.finalTimeMs;
        this.newBest = true;
        this.improvementMs = this.previousBestTimeMs === null ? null : this.finalTimeMs - this.previousBestTimeMs;
        this.writeNumber(this.storageKeys.bestTime, this.bestTimeMs);
      }
      return { started: false, finished: true, newBest: this.newBest };
    }

    gameOver(now, distance = this.currentDistance) {
      if (this.state !== RACE_STATE.RUNNING) return { gameOver: false, newDistanceBest: false };
      this.currentDistance = finiteNumber(distance) ?? this.currentDistance;
      this.maxDistance = Math.max(this.maxDistance, this.currentDistance);
      this.elapsedMs = Math.max(0, now - this.raceStartTime);
      this.finalTimeMs = this.elapsedMs;
      this.state = RACE_STATE.GAME_OVER;
      this.updateBestDistance(this.maxDistance);
      this.newDistanceBest = this.recordValid && this.bestDistance > this.bestDistanceAtStart;
      return { gameOver: true, newDistanceBest: this.newDistanceBest };
    }

    update(now, distance) {
      const event = { started: false, finished: false, halfway: false, finalTen: false, newBest: false };
      if (this.state === RACE_STATE.COUNTDOWN && now - this.countdownStartTime >= this.countdownRunAt()) {
        Object.assign(event, this.startRace(now));
        return event;
      }
      if (this.state !== RACE_STATE.RUNNING) return event;
      this.currentDistance = finiteNumber(distance) ?? this.currentDistance;
      this.maxDistance = Math.max(this.maxDistance, this.currentDistance);
      this.elapsedMs = Math.max(0, now - this.raceStartTime);
      this.updateBestDistance(this.maxDistance);
      if (!this.halfwayReached && this.currentDistance >= 50) {
        this.halfwayReached = true;
        event.halfway = true;
      }
      if (!this.finalTenReached && this.currentDistance >= 90) {
        this.finalTenReached = true;
        event.finalTen = true;
      }
      if (this.currentDistance >= this.goalDistance) Object.assign(event, this.finish(now));
      return event;
    }

    get inputEnabled() {
      return this.state === RACE_STATE.RUNNING;
    }

    snapshot() {
      return {
        state: this.state,
        inputEnabled: this.inputEnabled,
        recordCategory: this.recordCategory,
        elapsedMs: this.elapsedMs,
        finalTimeMs: this.finalTimeMs,
        currentDistance: this.currentDistance,
        maxDistance: this.maxDistance,
        bestTimeMs: this.bestTimeMs,
        bestDistance: this.bestDistance,
        recordValid: this.recordValid,
        invalidReasons: [...this.invalidReasons],
        newBest: this.newBest,
        previousBestTimeMs: this.previousBestTimeMs,
        improvementMs: this.improvementMs,
        firstFinish: this.firstFinish,
        newDistanceBest: this.newDistanceBest,
        halfwayReached: this.halfwayReached,
        finalTenReached: this.finalTenReached
      };
    }
  }

  const api = {
    RaceController, FallGuard, RACE_STATE, STORAGE_KEYS, storageKeysFor, DEFAULT_COUNTDOWN,
    RECORD_VERSION, DISTANCE_SCALE, DEFAULT_GAME_OVER_GRACE_MS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.QWOPRace = api;
})();
