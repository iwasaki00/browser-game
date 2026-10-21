export type RafCondition = 'FOREGROUND' | 'HIDDEN' | 'UNFOCUSED' | 'RESUMING';
export interface RafContext { readonly visibilityState: string; readonly hasFocus: boolean }
export const RAF_WINDOW = 240;
export const RECOVERY_MS = 1000;
export const STALE_MS = 1000;

/** RAF distributions use exact bounded windows; lifetime aggregates never stand in for window quantiles. */
class Intervals {
  count = 0; total = 0; maximum: number | null = null; over50 = 0; over100 = 0;
  readonly values: number[] = [];
  add(ms: number): void {
    this.count++; this.total += ms; this.maximum = Math.max(this.maximum ?? ms, ms);
    if (ms > 50) this.over50++; if (ms > 100) this.over100++;
    if (this.values.length === RAF_WINDOW) this.values.shift(); this.values.push(ms);
  }
  snapshot() {
    const sorted = [...this.values].sort((a, b) => a - b), n = sorted.length;
    return Object.freeze({ count: this.count, meanMs: this.count ? this.total / this.count : null,
      maximumMs: this.maximum, over50Ms: this.over50, over100Ms: this.over100,
      window: Object.freeze({ count: n, meanMs: n ? sorted.reduce((a, b) => a + b, 0) / n : null,
        medianMs: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
        p95Ms: n ? sorted[Math.ceil(n * .95) - 1] : null, maximumMs: n ? sorted[n - 1] : null,
        over100Ms: sorted.filter(ms => ms > 100).length }) });
  }
}
interface Segment { condition: RafCondition; startMs: number; endMs: number | null; context: RafContext; reason: string; endReason: string | null }
const groups = (): Record<RafCondition, Intervals> => ({ FOREGROUND: new Intervals(), HIDDEN: new Intervals(), UNFOCUSED: new Intervals(), RESUMING: new Intervals() });

/** Observation only. No browser APIs, game state, timers or simulation callbacks. */
export class RafMonitor {
  #groups = groups();
  #boundary = new Intervals(); #resumeGaps = new Intervals(); #segmentFrames = new Intervals();
  #context: RafContext | null = null; #condition: RafCondition | null = null;
  #previous: { time: number; condition: RafCondition; epoch: number } | null = null;
  #epoch = 0; #recoverUntil = -Infinity; #awaitingResumeFrame = false;
  #segments: Segment[] = []; #discardedSegments = 0;
  #durations: Record<RafCondition, number> = { FOREGROUND: 0, HIDDEN: 0, UNFOCUSED: 0, RESUMING: 0 };
  #lastFrame: number | null = null;
  observe(now: number, context: RafContext, reason = 'environment'): void {
    if (!Number.isFinite(now)) return;
    const changed = !this.#context || context.visibilityState !== this.#context.visibilityState || context.hasFocus !== this.#context.hasFocus;
    if (changed) {
      const wasInactive = this.#context && (this.#context.visibilityState !== 'visible' || !this.#context.hasFocus);
      this.#context = Object.freeze({ ...context }); this.#epoch++;
      if (wasInactive && context.visibilityState === 'visible' && context.hasFocus) {
        this.#recoverUntil = now + RECOVERY_MS; this.#awaitingResumeFrame = true;
      }
    }
    const next: RafCondition = context.visibilityState !== 'visible' ? 'HIDDEN' : !context.hasFocus ? 'UNFOCUSED'
      : now < this.#recoverUntil ? 'RESUMING' : 'FOREGROUND';
    if (next !== this.#condition || changed) this.transition(now, next, reason);
  }
  private transition(now: number, next: RafCondition, reason: string): void {
    const old = this.#segments.at(-1);
    if (old && old.endMs === null) { old.endMs = now; old.endReason = reason; this.#durations[old.condition] += Math.max(0, now - old.startMs); }
    this.#condition = next; this.#epoch++; this.#segmentFrames = new Intervals();
    if (this.#segments.length === 120) { this.#segments.shift(); this.#discardedSegments++; }
    this.#segments.push({ condition: next, startMs: now, endMs: null, context: this.#context!, reason, endReason: null });
  }
  frame(now: number, context: RafContext): void {
    if (!Number.isFinite(now)) return;
    this.observe(now, context, 'raf-observed');
    const previous = this.#previous, condition = this.#condition!;
    if (previous && now > previous.time) {
      const ms = now - previous.time;
      if (this.#awaitingResumeFrame) { this.#resumeGaps.add(ms); this.#awaitingResumeFrame = false; }
      if (previous.epoch === this.#epoch && previous.condition === condition) {
        this.#groups[condition].add(ms); this.#segmentFrames.add(ms);
      } else this.#boundary.add(ms);
    } else this.#awaitingResumeFrame = false;
    this.#previous = { time: now, condition, epoch: this.#epoch }; this.#lastFrame = now;
  }
  /** Explicit measurement interruption: discard the next cross-pause interval, retain collected history. */
  interrupt(): void { this.#previous = null; this.#lastFrame = null; this.#segmentFrames = new Intervals(); }
  pause(now = this.#lastFrame ?? this.#segments.at(-1)?.startMs ?? 0): void {
    const open = this.#segments.at(-1);
    if (open && open.endMs === null) { open.endMs = now; open.endReason = 'diagnostic-off'; this.#durations[open.condition] += Math.max(0, now - open.startMs); }
    this.interrupt(); this.#context = null; this.#condition = null; this.#recoverUntil = -Infinity; this.#awaitingResumeFrame = false;
  }
  snapshot(now = this.#lastFrame ?? 0) {
    const age = this.#lastFrame === null ? null : Math.max(0, now - this.#lastFrame);
    const live = this.#condition === 'FOREGROUND' && age !== null && age < STALE_MS;
    const current = this.#segmentFrames.snapshot();
    const duration = { ...this.#durations }, open = this.#segments.at(-1);
    if (open && open.endMs === null) duration[open.condition] += Math.max(0, now - open.startMs);
    return Object.freeze({ context: this.#context, condition: this.#condition, observedAtMs: this.#lastFrame, ageMs: age,
      stale: !live, currentFps: live && current.window.meanMs ? 1000 / current.window.meanMs : null,
      recoveryWindowMs: RECOVERY_MS, staleAfterMs: STALE_MS, windowLimit: RAF_WINDOW,
      conditions: Object.freeze({ FOREGROUND: this.#groups.FOREGROUND.snapshot(), HIDDEN: this.#groups.HIDDEN.snapshot(),
        UNFOCUSED: this.#groups.UNFOCUSED.snapshot(), RESUMING: this.#groups.RESUMING.snapshot() }),
      boundaryIntervals: this.#boundary.snapshot(), firstResumeGaps: this.#resumeGaps.snapshot(),
      observedDurationMs: Object.freeze(duration), discardedSegments: this.#discardedSegments,
      segments: Object.freeze(this.#segments.map(segment => Object.freeze({ ...segment }))) });
  }
}
