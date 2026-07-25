export class PerformanceRecorder {
  constructor({ maxEvents = 4096, enabled = true, stepCount = 16 } = {}) {
    this.maxEvents = Math.max(64, Math.floor(maxEvents));
    this.enabled = Boolean(enabled);
    this.stepCount = stepCount;
    this.events = [];
  }

  reset() {
    this.events = [];
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  record(event = {}) {
    if (!this.enabled) return null;
    const item = {
      playedAt: Number(event.playedAt) || 0,
      loop: Math.max(0, Math.floor(Number(event.loop) || 0)),
      step: Math.max(0, Math.min(
        this.stepCount - 1,
        Math.floor(Number(event.step) || 0),
      )),
      filename: event.filename ?? null,
      bus: event.bus ?? "drum",
      kind: event.kind ?? "note",
      pieceType: event.pieceType ?? null,
      velocity: Number(event.velocity) || 0,
      chord: event.chord ?? null,
      bass: event.bass ?? null,
      lineCount: Number(event.lineCount) || 0,
      cells: Array.isArray(event.cells)
        ? event.cells.map(({ x, y, type }) => ({ x, y, type }))
        : [],
    };
    item.absoluteStep = item.loop * this.stepCount + item.step;
    this.events.push(item);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return item;
  }

  createReplay(maxSteps = 64) {
    if (!this.events.length) return [];
    const lastEventStep = Math.max(...this.events.map((event) => event.absoluteStep));
    const lastAbsoluteStep = Math.max(15, lastEventStep);
    const firstAbsoluteStep = Math.max(0, lastAbsoluteStep - maxSteps + 1);
    const frames = Array.from(
      { length: lastAbsoluteStep - firstAbsoluteStep + 1 },
      (_, index) => ({
        index,
        absoluteStep: firstAbsoluteStep + index,
        step: (firstAbsoluteStep + index) % this.stepCount,
        loop: Math.floor((firstAbsoluteStep + index) / this.stepCount),
        events: [],
      }),
    );
    for (const event of this.events) {
      if (event.absoluteStep < firstAbsoluteStep) continue;
      frames[event.absoluteStep - firstAbsoluteStep]?.events.push({ ...event });
    }
    return frames;
  }
}

export default PerformanceRecorder;
