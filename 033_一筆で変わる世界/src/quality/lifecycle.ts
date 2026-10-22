import type { RafActivity, RafContext } from './raf';

export interface RafHost {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
}
type Observation = { context: RafContext; activity: RafActivity };
/** DEV observer only: forwards each request/cancel/callback exactly once; never restarts a failed loop. */
export class RafLifecycleProbe {
  #enabled = false; #generation = 0; #restore: (() => void) | null = null;
  #pending = new Map<number, string>(); #gamePending = new Set<number>(); #peakPending = 0; #peakGamePending = 0; #trackingTruncated = false;
  #gameRequests = 0; #gameCallbacks = 0;
  #requests = 0; #callbacks = 0; #cancels = 0; #exceptions = 0;
  #observerErrors = 0;
  #previous: number | null = null; #previousCpu: number | null = null; #lastId: number | null = null;
  #lastInterval: number | null = null;
  #events: Readonly<Record<string, unknown>>[] = []; #dropped = 0;
  constructor(private readonly host: RafHost, private readonly read: () => Observation,
    private readonly clock: () => number = () => performance.now(), private readonly isGameCallback: (callback: FrameRequestCallback) => boolean = () => true) {}
  start(): void {
    if (this.#enabled) return;
    this.#enabled = true; this.#generation++; this.#previous = null; this.#previousCpu = null; this.#lastInterval = null; this.#pending.clear(); this.#gamePending.clear();
    const request = this.host.requestAnimationFrame, cancel = this.host.cancelAnimationFrame;
    const probe = this, generation = this.#generation;
    this.host.requestAnimationFrame = function (callback) {
      const gameCallback = probe.isGameCallback(callback);
      const id = request.call(this, timestamp => {
        if (!probe.#enabled || generation !== probe.#generation) { callback.call(probe.host, timestamp); return; }
        probe.#pending.delete(id); probe.#gamePending.delete(id); probe.#callbacks++;
        if (!gameCallback) { callback.call(probe.host, timestamp); return; }
        probe.#gameCallbacks++; probe.#lastId = id;
        const intervalMs = probe.#previous === null ? null : timestamp - probe.#previous;
        probe.#lastInterval = intervalMs;
        probe.#previous = timestamp;
        const started = probe.clock(), before = probe.safeRead(), previousCallbackCpuMs = probe.#previousCpu;
        let error: string | null = null;
        try { callback.call(probe.host, timestamp); }
        catch (cause) { error = String(cause); probe.#exceptions++; throw cause; }
        finally {
          const callbackCpuMs = probe.clock() - started; probe.#previousCpu = callbackCpuMs;
          if (error || (intervalMs !== null && intervalMs > 100)) probe.event(error ? 'CALLBACK_EXCEPTION' : 'LONG_INTERVAL',
            { rafId: id, rafTimestampMs: timestamp, intervalMs, previousCallbackCpuMs, callbackCpuMs, before, after: probe.safeRead(), error });
        }
      });
      probe.#requests++;
      if (gameCallback) probe.#gameRequests++;
      if (probe.#pending.size < 256) { probe.#pending.set(id, gameCallback ? 'GAME_FRAME' : callback.name || 'OTHER_ANONYMOUS'); if (gameCallback) probe.#gamePending.add(id); }
      else probe.#trackingTruncated = true;
      const newPeak = probe.#pending.size > probe.#peakPending || probe.#gamePending.size > probe.#peakGamePending;
      probe.#peakPending = Math.max(probe.#peakPending, probe.#pending.size);
      probe.#peakGamePending = Math.max(probe.#peakGamePending, probe.#gamePending.size);
      if (probe.#requests === 1 || (newPeak && probe.#pending.size > 1)) probe.event(probe.#pending.size > 1 ? 'PENDING_OVERLAP' : 'FIRST_REQUEST',
        { rafId: id, gameCallback, pendingCallbacks: [...probe.#pending].map(([rafId, callbackName]) => ({ rafId, callbackName })) });
      return id;
    };
    this.host.cancelAnimationFrame = function (id) {
      probe.#cancels++; probe.#pending.delete(id); probe.#gamePending.delete(id); probe.event('CANCEL', { rafId: id }); cancel.call(this, id);
    };
    this.#restore = () => { this.host.requestAnimationFrame = request; this.host.cancelAnimationFrame = cancel; };
    this.event('ENABLE');
  }
  stop(): void {
    if (!this.#enabled) return;
    this.event('DISABLE'); this.#enabled = false; this.#restore?.(); this.#restore = null;
  }
  note(reason: string): void { if (this.#enabled) this.event(reason); }
  private safeRead(): unknown { try { return this.read(); } catch (cause) { this.#observerErrors++; return { diagnosticReadError: String(cause) }; } }
  private event(event: string, detail: Record<string, unknown> = {}): void {
    if (this.#events.length === 120) { this.#events.shift(); this.#dropped++; }
    this.#events.push(Object.freeze({ event, atPerformanceMs: this.clock(), generation: this.#generation,
      pendingObserved: this.#pending.size, lastIntervalMs: this.#lastInterval, state: this.safeRead(), ...detail }));
  }
  snapshot() {
    return Object.freeze({ enabled: this.#enabled, generation: this.#generation, requestsObserved: this.#requests,
      callbacksObserved: this.#callbacks, cancelsObserved: this.#cancels, exceptionsObserved: this.#exceptions,
      observerErrors: this.#observerErrors,
      pendingObservedIds: Object.freeze([...this.#pending.keys()]), peakPendingObserved: this.#peakPending,
      gameRequestsObserved: this.#gameRequests, gameCallbacksObserved: this.#gameCallbacks, peakGamePendingObserved: this.#peakGamePending,
      trackingTruncated: this.#trackingTruncated, lastCallbackId: this.#lastId,
      droppedEvents: this.#dropped, events: Object.freeze([...this.#events]),
      coverage: 'Only requests registered while enabled; initial/pre-existing RAF is unobserved. Game callback identity is injected by main; timing/errors are game-only. Other callbacks are forwarded and counted separately. No console logging.' });
  }
}
