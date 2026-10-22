export type RafCondition = 'FOREGROUND' | 'HIDDEN' | 'UNFOCUSED' | 'RESUMING';
export interface RafContext { readonly visibilityState: string; readonly hasFocus: boolean }
export interface RafActivity {
  scene: string; screen: string; playback: 'PLAYING' | 'PAUSED'; phase: string;
  comparison: boolean; view: string; flow: boolean; speed: number;
}
const sameActivity = (a: RafActivity, b: Readonly<RafActivity> | null) => b !== null && a.scene === b.scene && a.screen === b.screen
  && a.playback === b.playback && a.phase === b.phase && a.comparison === b.comparison && a.view === b.view && a.flow === b.flow && a.speed === b.speed;
export const RAF_WINDOW = 240;
export const RECOVERY_MS = 1000;
export const STALE_MS = 1000;

/** RAF distributions use exact bounded windows; lifetime aggregates never stand in for window quantiles. */
class Intervals {
  count = 0; total = 0; maximum: number | null = null; over50 = 0; over100 = 0; over500 = 0; over900 = 0;
  runMs = 0; longestRunMs = 0;
  readonly values: number[] = [];
  add(ms: number): void {
    this.count++; this.total += ms; this.maximum = Math.max(this.maximum ?? ms, ms);
    if (ms > 50) this.over50++; if (ms > 100) this.over100++;
    if (ms > 500) this.over500++; if (ms > 900) this.over900++;
    this.runMs = ms > 100 ? this.runMs + ms : 0; this.longestRunMs = Math.max(this.longestRunMs, this.runMs);
    if (this.values.length === RAF_WINDOW) this.values.shift(); this.values.push(ms);
  }
  breakRun(): void { this.runMs = 0; }
  snapshot() {
    const sorted = [...this.values].sort((a, b) => a - b), n = sorted.length;
    const frequency = (limit: number) => { const count = sorted.filter(ms => ms > limit).length; return { count, ratio: n ? count / n : null }; };
    let run = 0, longest = 0;
    for (const ms of this.values) { run = ms > 100 ? run + ms : 0; longest = Math.max(longest, run); }
    return Object.freeze({ count: this.count, meanMs: this.count ? this.total / this.count : null,
      maximumMs: this.maximum, over50Ms: this.over50, over100Ms: this.over100,
      over500Ms: this.over500, over900Ms: this.over900, longestOver100RunMs: this.longestRunMs,
      over100Ratio: this.count ? this.over100 / this.count : null, over500Ratio: this.count ? this.over500 / this.count : null,
      over900Ratio: this.count ? this.over900 / this.count : null,
      window: Object.freeze({ count: n, meanMs: n ? sorted.reduce((a, b) => a + b, 0) / n : null,
        medianMs: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
        p95Ms: n ? sorted[Math.ceil(n * .95) - 1] : null, maximumMs: n ? sorted[n - 1] : null,
        p99Ms: n ? sorted[Math.ceil(n * .99) - 1] : null, sampledIntervalTotalMs: this.values.reduce((a, b) => a + b, 0),
        longestOver100RunMs: longest, over100Ms: frequency(100).count, over100Ratio: frequency(100).ratio,
        over500Ms: frequency(500).count, over500Ratio: frequency(500).ratio, over900Ms: frequency(900).count, over900Ratio: frequency(900).ratio }) });
  }
}
interface Segment { condition: RafCondition; startMs: number; endMs: number | null; context: RafContext; activity: Readonly<RafActivity> | null;
  reason: string; endReason: string | null; intervals: ReturnType<Intervals['snapshot']> | null }
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
  #activity: Readonly<RafActivity> | null = null;
  observe(now: number, context: RafContext, reason = 'environment', activity?: RafActivity): void {
    if (!Number.isFinite(now)) return;
    const changed = !this.#context || context.visibilityState !== this.#context.visibilityState || context.hasFocus !== this.#context.hasFocus;
    const activityChanged = activity !== undefined && !sameActivity(activity, this.#activity);
    if (activityChanged) this.#activity = Object.freeze({ ...activity! });
    if (changed) {
      const wasInactive = this.#context && (this.#context.visibilityState !== 'visible' || !this.#context.hasFocus);
      this.#context = Object.freeze({ ...context }); this.#epoch++;
      if (wasInactive && context.visibilityState === 'visible' && context.hasFocus) {
        this.#recoverUntil = now + RECOVERY_MS; this.#awaitingResumeFrame = true;
      }
    }
    const next: RafCondition = context.visibilityState !== 'visible' ? 'HIDDEN' : !context.hasFocus ? 'UNFOCUSED'
      : now < this.#recoverUntil ? 'RESUMING' : 'FOREGROUND';
    if (next !== this.#condition || changed || activityChanged) this.transition(now, next, activityChanged ? `${reason}:activity-change` : reason);
  }
  private transition(now: number, next: RafCondition, reason: string): void {
    const old = this.#segments.at(-1);
    if (old && old.endMs === null) { old.endMs = now; old.endReason = reason; old.intervals = this.#segmentFrames.snapshot(); this.#durations[old.condition] += Math.max(0, now - old.startMs); }
    for (const samples of Object.values(this.#groups)) samples.breakRun();
    this.#condition = next; this.#epoch++; this.#segmentFrames = new Intervals();
    if (this.#segments.length === 120) { this.#segments.shift(); this.#discardedSegments++; }
    this.#segments.push({ condition: next, startMs: now, endMs: null, context: this.#context!, activity: this.#activity, reason, endReason: null, intervals: null });
  }
  frame(now: number, context: RafContext, activity?: RafActivity): void {
    if (!Number.isFinite(now)) return;
    this.observe(now, context, 'raf-observed', activity);
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
    if (open && open.endMs === null) { open.endMs = now; open.endReason = 'diagnostic-off'; open.intervals = this.#segmentFrames.snapshot(); this.#durations[open.condition] += Math.max(0, now - open.startMs); }
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
      segments: Object.freeze(this.#segments.map(segment => Object.freeze({ ...segment,
        intervals: segment.intervals ?? current }))) });
  }
}
