(function () {
  "use strict";

  const RACE_STATE = Object.freeze({
    READY: "READY",
    COUNTDOWN: "COUNTDOWN",
    RUNNING: "RUNNING",
    FINISHED: "FINISHED"
  });
  const STORAGE_KEYS = Object.freeze({
    bestTime: "qwopRunner.bestTimeMs.v1",
    bestDistance: "qwopRunner.bestDistanceM.v1"
  });
  const DEFAULT_COUNTDOWN = Object.freeze({
    ready: 400,
    three: 600,
    two: 600,
    one: 600,
    go: 500
  });

  const finiteNumber = value => value === null || value === undefined || value === ""
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;

  class RaceController {
    constructor(options = {}) {
      this.goalDistance = options.goalDistance ?? 100;
      this.storage = options.storage ?? null;
      this.countdown = { ...DEFAULT_COUNTDOWN, ...(options.countdown || {}) };
      this.bestTimeMs = this.readNumber(STORAGE_KEYS.bestTime);
      this.bestDistance = this.readNumber(STORAGE_KEYS.bestDistance) ?? 0;
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
        this.writeNumber(STORAGE_KEYS.bestDistance, this.bestDistance);
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
      return { started: true, finished: false };
    }

    updateBestDistance(distance) {
      if (!this.recordValid || distance <= this.bestDistance) return false;
      this.bestDistance = distance;
      this.writeNumber(STORAGE_KEYS.bestDistance, distance);
      return true;
    }

    finish(now) {
      if (this.state !== RACE_STATE.RUNNING) return { started: false, finished: false };
      this.elapsedMs = Math.max(0, now - this.raceStartTime);
      this.finalTimeMs = this.elapsedMs;
      this.state = RACE_STATE.FINISHED;
      this.updateBestDistance(Math.max(this.maxDistance, this.goalDistance));
      if (this.recordValid && (this.bestTimeMs === null || this.finalTimeMs < this.bestTimeMs)) {
        this.bestTimeMs = this.finalTimeMs;
        this.newBest = true;
        this.writeNumber(STORAGE_KEYS.bestTime, this.bestTimeMs);
      }
      return { started: false, finished: true };
    }

    update(now, distance) {
      const event = { started: false, finished: false };
      if (this.state === RACE_STATE.COUNTDOWN && now - this.countdownStartTime >= this.countdownRunAt()) {
        Object.assign(event, this.startRace(now));
        return event;
      }
      if (this.state !== RACE_STATE.RUNNING) return event;
      this.currentDistance = finiteNumber(distance) ?? this.currentDistance;
      this.maxDistance = Math.max(this.maxDistance, this.currentDistance);
      this.elapsedMs = Math.max(0, now - this.raceStartTime);
      this.updateBestDistance(this.maxDistance);
      if (this.currentDistance >= this.goalDistance) Object.assign(event, this.finish(now));
      return event;
    }

    get inputEnabled() {
      return this.state === RACE_STATE.RUNNING;
    }

    snapshot() {
      return {
        state: this.state,
        elapsedMs: this.elapsedMs,
        finalTimeMs: this.finalTimeMs,
        currentDistance: this.currentDistance,
        maxDistance: this.maxDistance,
        bestTimeMs: this.bestTimeMs,
        bestDistance: this.bestDistance,
        recordValid: this.recordValid,
        invalidReasons: [...this.invalidReasons],
        newBest: this.newBest
      };
    }
  }

  const api = { RaceController, RACE_STATE, STORAGE_KEYS, DEFAULT_COUNTDOWN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.QWOPRace = api;
})();
