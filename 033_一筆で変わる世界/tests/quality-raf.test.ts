import { afterEach, expect, it, vi } from 'vitest';
import { RafMonitor } from '../src/quality/raf';
import { QualityMetrics } from '../src/quality/metrics';
import { bindRafEnvironment } from '../src/quality/environment';
import { RafDisplayDeadline } from '../src/quality/deadline';
import { SimulationRunner } from '../src/core/runner';

const front = { visibilityState: 'visible', hasFocus: true };
const hidden = { visibilityState: 'hidden', hasFocus: false };
const unfocused = { visibilityState: 'visible', hasFocus: false };
afterEach(() => { vi.useRealTimers(); });

it('PV-01: 非表示とフォーカス喪失を通常RAF分布に混ぜない', () => {
  const r = new RafMonitor(); r.frame(0, front); r.frame(16, front);
  r.observe(20, hidden, 'visibilitychange'); r.frame(1000, hidden); r.frame(2000, hidden);
  r.observe(2100, unfocused, 'visibilitychange'); r.frame(3000, unfocused); r.frame(4000, unfocused);
  const s = r.snapshot(4000);
  expect(s.conditions.FOREGROUND.count).toBe(1); expect(s.conditions.FOREGROUND.meanMs).toBe(16);
  expect(s.conditions.HIDDEN.meanMs).toBe(1000); expect(s.conditions.UNFOCUSED.meanMs).toBe(1000);
  expect(s.boundaryIntervals.count).toBe(2); expect(s.conditions.HIDDEN.over100Ms).toBe(1);
  expect(s.currentFps).toBeNull(); expect(s.context).toEqual(unfocused);
});
it('PV-02: 非表示中RAFが0回でも環境区間と経過時間を記録する', () => {
  const r = new RafMonitor(); r.observe(0, front, 'on'); r.frame(10, front); r.observe(20, hidden, 'visibilitychange');
  const s = r.snapshot(5020);
  expect(s.conditions.HIDDEN.count).toBe(0); expect(s.conditions.HIDDEN.window.medianMs).toBeNull();
  expect(s.observedDurationMs.HIDDEN).toBe(5000); expect(s.segments.at(-1)?.context.visibilityState).toBe('hidden');
  expect(s.currentFps).toBeNull();
});
it('PV-03: 復帰最初の空白と復帰1秒の間隔を通常FPSから除外する', () => {
  const r = new RafMonitor(); r.frame(0, front); r.frame(16, front); r.observe(20, hidden);
  r.observe(10000, front, 'focus'); r.frame(10010, front); r.frame(10026, front); r.frame(11010, front); r.frame(11026, front);
  const s = r.snapshot(11026);
  expect(s.firstResumeGaps.count).toBe(1); expect(s.firstResumeGaps.meanMs).toBe(9994);
  expect(s.conditions.RESUMING.count).toBe(1); expect(s.conditions.RESUMING.meanMs).toBe(16);
  expect(s.conditions.FOREGROUND.count).toBe(2); expect(s.conditions.FOREGROUND.meanMs).toBe(16);
  expect(s.boundaryIntervals.count).toBe(2); expect(s.currentFps).toBe(62.5);
});
it('PV-04: 復帰後の最初のRAF自体が遅れても長い間隔は通常へ入らない', () => {
  const r = new RafMonitor(); r.frame(0, front); r.frame(16, front); r.observe(20, unfocused); r.observe(100, front);
  r.frame(5000, front); expect(r.snapshot().conditions.FOREGROUND.count).toBe(1); expect(r.snapshot().currentFps).toBeNull();
  r.frame(5016, front); expect(r.snapshot().conditions.FOREGROUND.count).toBe(2);
});
it('PV-05: 前面かつフォーカスありの1秒間隔も捨てずに記録する', () => {
  const r = new RafMonitor(); for (const t of [0, 16, 48, 1048, 1148, 1249]) r.frame(t, front);
  const s = r.snapshot(1249).conditions.FOREGROUND;
  expect(s.count).toBe(5); expect(s.meanMs).toBe(249.8); expect(s.window.medianMs).toBe(100);
  expect(s.window.p95Ms).toBe(1000); expect(s.window.maximumMs).toBe(1000); expect(s.over100Ms).toBe(2);
});
it('PV-06: 同じ母集団の平均・中央値・p95・最大・件数を最大240件で返す', () => {
  const r = new RafMonitor(); for (let i = 0; i <= 500; i++) r.frame(i * 10, front);
  const s = r.snapshot().conditions.FOREGROUND;
  expect(s.count).toBe(500); expect(s.window).toEqual({ count: 240, meanMs: 10, medianMs: 10, p95Ms: 10, maximumMs: 10, over100Ms: 0 });
});
it('PV-07: 古いFPS・復帰待ち・診断OFFは現在値をnullにする', () => {
  const r = new RafMonitor(); r.frame(0, front); r.frame(16, front);
  expect(r.snapshot(100).currentFps).toBe(62.5); expect(r.snapshot(1016).currentFps).toBeNull();
  r.observe(1100, unfocused); r.observe(1200, front); expect(r.snapshot(1210).currentFps).toBeNull();
  r.pause(1210); expect(r.snapshot(100000).currentFps).toBeNull(); expect(r.snapshot(100000).observedDurationMs.RESUMING).toBe(10);
});
it('PV-08: OFF期間とRESET前の統計を新しい通常値に混ぜない', () => {
  const m = new QualityMetrics();
  try {
    m.setEnabled(true); m.frame(0, front); m.frame(16, front); m.setEnabled(false, 20);
    m.frame(10000, front); m.observeContext(10000, hidden); expect(m.snapshot(10000).recentRafFps).toBeNull();
    m.setEnabled(true); m.frame(20000, front); expect(m.snapshot().frameIntervals.count).toBe(1);
    m.frame(20020, front); expect(m.snapshot().recentRafFps).toBe(50);
    m.reset(); expect(m.snapshot().frameIntervals.count).toBe(0); expect(m.snapshot().raf.segments).toHaveLength(0);
  } finally { m.setEnabled(false); }
});
it('PV-09: 環境イベントはOFFで時計を読まず、解除後には通知しない', () => {
  class Target { listeners = new Map<string, Set<() => void>>();
    addEventListener(type: string, fn: () => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(fn); }
    removeEventListener(type: string, fn: () => void) { this.listeners.get(type)?.delete(fn); }
    emit(type: string) { this.listeners.get(type)?.forEach(fn => fn()); }
  }
  const d = Object.assign(new Target(), { visibilityState: 'visible', hasFocus: () => false }), w = new Target();
  let enabled = false; const clock = vi.fn(() => 10), observe = vi.fn();
  const dispose = bindRafEnvironment(d, w, () => enabled, observe, clock);
  w.emit('blur'); d.emit('visibilitychange'); expect(clock).not.toHaveBeenCalled();
  enabled = true; w.emit('focus'); expect(observe).toHaveBeenCalledExactlyOnceWith(10, unfocused, 'focus');
  dispose(); w.emit('focus'); expect(observe).toHaveBeenCalledTimes(1);
});
it('PV-10: RAF停止を示すUI期限は最大1件で、自動ループや論理計算を作らない', () => {
  vi.useFakeTimers(); const r = new SimulationRunner({ width: 1, height: 1, heights: [0], water: [8] });
  const initial = structuredClone(r.world), invalidated = vi.fn(); const deadline = new RafDisplayDeadline(invalidated);
  for (let i = 0; i < 100; i++) deadline.refresh(true);
  expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(1100); expect(invalidated).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0); expect(r.world).toEqual(initial);
  deadline.refresh(true); deadline.refresh(false); expect(vi.getTimerCount()).toBe(0);
});
it('PV-11: 計測の区間・観測イベント履歴は120件に制限され不変', () => {
  const r = new RafMonitor(); for (let i = 0; i < 1000; i++) r.observe(i * 10, i % 2 ? unfocused : front);
  const s = r.snapshot(10000); expect(s.segments).toHaveLength(120); expect(s.discardedSegments).toBe(880);
  expect(Object.isFrozen(s.segments[0])).toBe(true); expect(Object.isFrozen(s.context)).toBe(true);
});
