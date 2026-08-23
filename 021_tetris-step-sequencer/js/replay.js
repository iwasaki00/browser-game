export class ReplayPlayer {
  constructor(audio, {
    lookAheadMs = 25,
    scheduleAheadTime = 0.12,
    onVisualStep = () => {},
    onEnd = () => {},
  } = {}) {
    this.audio = audio;
    this.lookAheadMs = lookAheadMs;
    this.scheduleAheadTime = scheduleAheadTime;
    this.onVisualStep = onVisualStep;
    this.onEnd = onEnd;
    this.running = false;
    this.frames = [];
    this.frameIndex = 0;
    this.nextTime = 0;
    this.secondsPerStep = 0.15;
    this.timer = null;
    this.endTimer = null;
    this.visualTimers = new Set();
  }

  start(frames, { bpm = 100, speed = 1 } = {}) {
    this.stop(false);
    if (!Array.isArray(frames) || !frames.length) return false;
    this.frames = frames;
    this.frameIndex = 0;
    this.secondsPerStep = 60 / Number(bpm || 100) / 4 / Number(speed || 1);
    this.nextTime = this.audio.currentTime + 0.06;
    this.running = true;
    this._schedule();
    this.timer = globalThis.setInterval(() => this._schedule(), this.lookAheadMs);
    return true;
  }

  stop(notify = true) {
    if (this.timer !== null) globalThis.clearInterval(this.timer);
    if (this.endTimer !== null) globalThis.clearTimeout(this.endTimer);
    this.timer = null;
    this.endTimer = null;
    for (const timer of this.visualTimers) globalThis.clearTimeout(timer);
    this.visualTimers.clear();
    const wasRunning = this.running;
    this.running = false;
    if (notify && wasRunning) this.onEnd();
  }

  _schedule() {
    if (!this.running) return;
    const now = this.audio.currentTime;
    while (
      this.frameIndex < this.frames.length &&
      this.nextTime < now + this.scheduleAheadTime
    ) {
      const frame = this.frames[this.frameIndex];
      const scheduledIndex = this.frameIndex;
      for (const event of frame.events) {
        if (!event.filename) continue;
        this.audio.playFile(event.filename, {
          bus: event.bus,
          when: this.nextTime,
          gain: event.velocity || 0.7,
        });
      }
      const delay = Math.max(0, (this.nextTime - now) * 1000);
      const timer = globalThis.setTimeout(() => {
        this.visualTimers.delete(timer);
        if (this.running) this.onVisualStep(frame, scheduledIndex);
      }, delay);
      this.visualTimers.add(timer);
      this.frameIndex += 1;
      this.nextTime += this.secondsPerStep;
    }

    if (this.frameIndex >= this.frames.length && this.endTimer === null) {
      const delay = Math.max(0, (this.nextTime - now) * 1000) + 20;
      this.endTimer = globalThis.setTimeout(() => {
        this.endTimer = null;
        if (!this.running) return;
        this.stop(false);
        this.onEnd();
      }, delay);
    }
  }
}

export default ReplayPlayer;
