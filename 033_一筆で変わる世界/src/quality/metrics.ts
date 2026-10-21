import { SimulationRunner } from '../core/runner';
import { ComparisonController } from '../comparison/controller';
import { RafMonitor, type RafContext } from './raf';

class Samples {
  count = 0; total = 0; maximum: number | null = null;
  readonly recent: number[] = [];
  add(value: number, weight = 1): void {
    if (!Number.isFinite(value) || value < 0 || weight <= 0) return;
    this.count += weight; this.total += value * weight;
    this.maximum = Math.max(this.maximum ?? value, value);
    if (this.recent.length === 240) this.recent.shift();
    this.recent.push(value);
  }
  result() {
    const sorted = [...this.recent].sort((a, b) => a - b);
    return Object.freeze({ count: this.count, meanMs: this.count ? this.total / this.count : null, maximumMs: this.maximum,
      recentMeanMs: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
      recentP95Ms: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null, recentCount: sorted.length });
  }
}
export type TimingKind = 'single' | 'comparison' | 'summary';
export function stepAgreement(steps: readonly [number, number] | null): boolean | null { return steps ? steps[0] === steps[1] : null; }

/** Observes calls without changing their arguments, return values, exceptions or update order. */
export class QualityMetrics {
  #enabled = false;
  #restore: (() => void) | null = null;
  #raf = new RafMonitor();
  #draw = new Samples(); #frame = new Samples();
  #steps: Record<TimingKind, Samples> = { single: new Samples(), comparison: new Samples(), summary: new Samples() };
  constructor(private readonly clock: () => number = () => performance.now(), private readonly comparisonVisible: () => boolean = () => true) {}
  get enabled(): boolean { return this.#enabled; }
  suspendFrameClock(): void { this.#raf.interrupt(); }
  observeContext(now: number, context: RafContext, reason?: string): void { if (this.#enabled) this.#raf.observe(now, context, reason); }
  setEnabled(enabled: boolean, now?: number): void {
    if (this.#enabled === enabled) return;
    this.#enabled = enabled;
    if (!enabled) { this.#raf.pause(now); this.#restore?.(); this.#restore = null; return; }
    this.#raf.interrupt();
    const probe = this;
    const single = SimulationRunner.prototype.step, pair = ComparisonController.prototype.step, batch = ComparisonController.prototype.advance;
    SimulationRunner.prototype.step = function () {
      const before = this.world.step, started = probe.clock();
      try { return single.call(this); }
      finally { probe.recordSteps('single', probe.clock() - started, this.world.step - before); }
    };
    ComparisonController.prototype.step = function () {
      const before = this.stepNumber, started = probe.clock(), kind = probe.comparisonVisible() ? 'comparison' : 'summary';
      try { return pair.call(this); }
      finally { probe.recordSteps(kind, probe.clock() - started, this.stepNumber - before); }
    };
    ComparisonController.prototype.advance = function (milliseconds: number) {
      // A paused controller has no work and does not need timing reads.
      if (!this.playing) return batch.call(this, milliseconds);
      const before = this.stepNumber, started = probe.clock(), kind = probe.comparisonVisible() ? 'comparison' : 'summary';
      try { return batch.call(this, milliseconds); }
      finally { probe.recordSteps(kind, probe.clock() - started, this.stepNumber - before); }
    };
    this.#restore = () => { SimulationRunner.prototype.step = single; ComparisonController.prototype.step = pair; ComparisonController.prototype.advance = batch; };
  }
  reset(): void {
    this.#raf = new RafMonitor(); this.#draw = new Samples(); this.#frame = new Samples();
    this.#steps = { single: new Samples(), comparison: new Samples(), summary: new Samples() };
  }
  frame(timestamp: number, context: boolean | RafContext): void {
    if (!this.#enabled) return;
    this.#raf.frame(timestamp, typeof context === 'boolean' ? { visibilityState: context ? 'hidden' : 'visible', hasFocus: true } : context);
  }
  measure<T>(kind: 'draw' | 'frame', action: () => T, record: (result: T) => boolean = () => true): T {
    if (!this.#enabled) return action();
    const start = this.clock();
    const result = action();
    const elapsed = this.clock() - start;
    if (record(result)) (kind === 'draw' ? this.#draw : this.#frame).add(elapsed);
    return result;
  }
  private recordSteps(kind: TimingKind, elapsed: number, count: number): void {
    if (this.#enabled && count > 0) this.#steps[kind].add(elapsed / count, count);
  }
  snapshot(now?: number) {
    const raf = this.#raf.snapshot(now), foreground = raf.conditions.FOREGROUND;
    const interval = Object.freeze({ count: foreground.count, meanMs: foreground.meanMs, maximumMs: foreground.maximumMs,
      recentMeanMs: foreground.window.meanMs, recentMedianMs: foreground.window.medianMs,
      recentP95Ms: foreground.window.p95Ms, recentCount: foreground.window.count });
    return Object.freeze({ enabled: this.#enabled, frameIntervals: interval,
      averageRafFps: interval.meanMs !== null && interval.meanMs > 0 ? 1000 / interval.meanMs : null,
      recentRafFps: this.#enabled ? raf.currentFps : null, raf,
      longFrameThresholdMs: 50, longFrames: foreground.over50Ms, drawCpu: this.#draw.result(), frameCpu: this.#frame.result(),
      logicalStepCpu: Object.freeze({ single: this.#steps.single.result(), comparison: this.#steps.comparison.result(), summary: this.#steps.summary.result() }) });
  }
}
