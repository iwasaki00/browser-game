export const DEFAULT_STEP_COUNT = 16;

const ALLOWED_SPEEDS = Object.freeze([0.5, 1, 2]);
const noop = () => {};

/**
 * Audio-clock-based 16th-note scheduler.
 *
 * `onSchedule` runs ahead of playback so callers can schedule AudioBufferSources
 * at the supplied `when`. `onVisualStep` runs close to the audible step.
 */
export class StepSequencer {
  constructor(
    clock,
    {
      bpm = 100,
      speed = 1,
      stepCount = DEFAULT_STEP_COUNT,
      lookAheadMs = 25,
      scheduleAheadTime = 0.1,
      startDelay = 0.05,
      onSchedule = noop,
      onVisualStep = noop,
    } = {},
  ) {
    if (!clock) {
      throw new TypeError("StepSequencer requires an AudioEngine or AudioContext.");
    }

    this.clock = clock;
    this.stepCount = Math.max(1, Math.floor(Number(stepCount) || 16));
    this.lookAheadMs = Math.max(10, Number(lookAheadMs) || 25);
    this.scheduleAheadTime = Math.max(
      0.025,
      Number(scheduleAheadTime) || 0.1,
    );
    this.startDelay = Math.max(0, Number(startDelay) || 0);
    this.onSchedule =
      typeof onSchedule === "function" ? onSchedule : noop;
    this.onVisualStep =
      typeof onVisualStep === "function" ? onVisualStep : noop;

    this.bpm = 100;
    this.speed = 1;
    this.currentStep = -1;

    this._running = false;
    this._nextStep = 0;
    this._nextNoteTime = 0;
    this._timerId = null;
    this._visualTimerIds = new Set();
    this._generation = 0;

    this.setBpm(bpm);
    this.setSpeed(speed);
  }

  get isRunning() {
    return this._running;
  }

  get secondsPerStep() {
    // One sequencer step is a sixteenth note; speed is a playback multiplier.
    return 60 / this.bpm / 4 / this.speed;
  }

  start(reset = true) {
    if (this._running) return false;

    if (reset !== false) {
      this._nextStep = 0;
      this.currentStep = -1;
    }

    this._running = true;
    this._generation += 1;
    this._nextNoteTime = this._now() + this.startDelay;
    this._scheduler();
    this._timerId = globalThis.setInterval(
      () => this._scheduler(),
      this.lookAheadMs,
    );
    return true;
  }

  stop() {
    if (this._timerId !== null) {
      globalThis.clearInterval(this._timerId);
      this._timerId = null;
    }

    for (const timerId of this._visualTimerIds) {
      globalThis.clearTimeout(timerId);
    }
    this._visualTimerIds.clear();
    this._generation += 1;
    this._running = false;
    this.currentStep = -1;
  }

  setBpm(value) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      this.bpm = Math.min(300, Math.max(40, number));
    }
    return this.bpm;
  }

  setSpeed(value) {
    const number = Number(value);
    if (ALLOWED_SPEEDS.includes(number)) {
      this.speed = number;
    }
    return this.speed;
  }

  setCallbacks({ onSchedule, onVisualStep } = {}) {
    if (typeof onSchedule === "function") this.onSchedule = onSchedule;
    if (typeof onVisualStep === "function") {
      this.onVisualStep = onVisualStep;
    }
  }

  _now() {
    if (Number.isFinite(Number(this.clock.currentTime))) {
      return Number(this.clock.currentTime);
    }
    if (Number.isFinite(Number(this.clock.context?.currentTime))) {
      return Number(this.clock.context.currentTime);
    }
    return globalThis.performance.now() / 1000;
  }

  _scheduler() {
    if (!this._running) return;

    const now = this._now();
    const stepDuration = this.secondsPerStep;

    // Browser timers are throttled in the background. Skip stale beats instead
    // of emitting a burst when the page becomes active again.
    if (this._nextNoteTime < now - stepDuration) {
      const skippedSteps =
        Math.floor((now - this._nextNoteTime) / stepDuration) + 1;
      this._nextStep =
        (this._nextStep + skippedSteps) % this.stepCount;
      this._nextNoteTime += skippedSteps * stepDuration;
    }

    let scheduled = 0;
    const safetyLimit = this.stepCount * 4;
    while (
      this._nextNoteTime < now + this.scheduleAheadTime &&
      scheduled < safetyLimit
    ) {
      this._scheduleStep(this._nextStep, this._nextNoteTime);
      this._nextStep = (this._nextStep + 1) % this.stepCount;
      this._nextNoteTime += this.secondsPerStep;
      scheduled += 1;
    }
  }

  _scheduleStep(step, when) {
    try {
      this.onSchedule(step, when);
    } catch (error) {
      console.error("Sequencer schedule callback failed.", error);
    }

    const generation = this._generation;
    const delayMs = Math.max(0, (when - this._now()) * 1000);
    const timerId = globalThis.setTimeout(() => {
      this._visualTimerIds.delete(timerId);
      if (!this._running || generation !== this._generation) return;

      this.currentStep = step;
      try {
        this.onVisualStep(step, when);
      } catch (error) {
        console.error("Sequencer visual callback failed.", error);
      }
    }, delayMs);

    this._visualTimerIds.add(timerId);
  }

  destroy() {
    this.stop();
  }
}

export { ALLOWED_SPEEDS };
