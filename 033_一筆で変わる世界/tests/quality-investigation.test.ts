import { expect, it } from 'vitest';
import { RafLifecycleProbe, type RafHost } from '../src/quality/lifecycle';
import { RafMonitor, type RafActivity } from '../src/quality/raf';
import { SimulationRunner } from '../src/core/runner';

const context = { visibilityState: 'visible', hasFocus: true };
const paused: RafActivity = { scene: 'stage-01', screen: 'GAME', playback: 'PAUSED', phase: 'READY', comparison: false, view: 'combined', flow: false, speed: 20 };
const playing: RafActivity = { ...paused, playback: 'PLAYING', phase: 'SIMULATING' };
function host() {
  let id = 0, time = 0; const queued = new Map<number, FrameRequestCallback>();
  const api: RafHost = { requestAnimationFrame(fn) { queued.set(++id, fn); return id; }, cancelAnimationFrame(key) { queued.delete(key); } };
  const original = { request: api.requestAnimationFrame, cancel: api.cancelAnimationFrame };
  return { api, original, queued, clock: () => ++time, tick(timestamp: number) {
    const callbacks = [...queued.values()]; queued.clear(); callbacks.forEach(fn => fn.call(api, timestamp));
  } };
}
it('RI-01: 1本の再登録ループを100回観測しても待機は1件で、観測が追加登録しない', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: paused }), h.clock);
  const runner = new SimulationRunner({ width: 1, height: 1, heights: [0], water: [8] });
  const initial = structuredClone(runner.world); let calls = 0;
  const frame = () => { calls++; h.api.requestAnimationFrame(frame); };
  probe.start(); probe.start(); h.api.requestAnimationFrame(frame);
  for (let i = 0; i < 100; i++) h.tick(i * 16);
  expect(calls).toBe(100); expect(h.queued.size).toBe(1); expect(probe.snapshot().peakPendingObserved).toBe(1);
  expect(probe.snapshot().requestsObserved).toBe(101); expect(probe.snapshot().callbacksObserved).toBe(100);
  expect(runner.world).toEqual(initial); probe.stop();
});
it('RI-02: 多重登録を検出でき、既存コールバックやcancelを勝手に省略しない', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: paused }), h.clock);
  let calls = 0; probe.start(); const first = h.api.requestAnimationFrame(() => calls++); h.api.requestAnimationFrame(() => calls++);
  expect(probe.snapshot().peakPendingObserved).toBe(2); expect(probe.snapshot().events.some(e => e.event === 'PENDING_OVERLAP')).toBe(true);
  h.api.cancelAnimationFrame(first); h.tick(16); expect(calls).toBe(1); expect(probe.snapshot().cancelsObserved).toBe(1); probe.stop();
});
it('RI-03: 診断OFFは元APIを復元し、待機済みRAFを消さず、再ONで二重計上しない', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: paused }), h.clock); let calls = 0;
  probe.start(); h.api.requestAnimationFrame(() => { calls++; h.api.requestAnimationFrame(() => calls++); });
  probe.stop(); expect(h.api.requestAnimationFrame).toBe(h.original.request); expect(h.api.cancelAnimationFrame).toBe(h.original.cancel);
  probe.start(); h.tick(16); expect(calls).toBe(1); h.tick(32); expect(calls).toBe(2);
  expect(probe.snapshot().peakPendingObserved).toBe(1); probe.stop();
});
it('RI-04: 例外はそのまま伝播し、自動再開しない。例外と残待機数を記録する', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: playing }), h.clock);
  const failure = new Error('draw failure'); probe.start(); h.api.requestAnimationFrame(() => { throw failure; });
  expect(() => h.tick(16)).toThrow(failure); expect(h.queued.size).toBe(0);
  expect(probe.snapshot().exceptionsObserved).toBe(1); expect(probe.snapshot().events.at(-1)?.event).toBe('CALLBACK_EXCEPTION'); probe.stop();
});
it('RI-05: 長いRAF間隔に直前・当該コールバックCPUと操作状態を対応付ける', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: playing }), h.clock);
  const frame = () => h.api.requestAnimationFrame(frame); probe.start(); h.api.requestAnimationFrame(frame); h.tick(0); h.tick(1001);
  const gap = probe.snapshot().events.find(e => e.event === 'LONG_INTERVAL');
  expect(gap?.intervalMs).toBe(1001); expect(gap?.previousCallbackCpuMs).toBeTypeOf('number'); expect(gap?.callbackCpuMs).toBeTypeOf('number');
  expect(gap?.before).toEqual({ context, activity: playing }); expect(gap?.rafId).toBeTypeOf('number'); probe.stop();
  expect(probe.snapshot().events.at(-1)?.lastIntervalMs).toBe(1001);
});
it('RI-06: 診断読取り失敗がゲームのコールバックを停止させない', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => { throw new Error('observer'); }, h.clock);
  let calls = 0; probe.start(); h.api.requestAnimationFrame(function (this: RafHost) { expect(this).toBe(h.api); calls++; }); h.tick(16);
  expect(calls).toBe(1); expect(probe.snapshot().observerErrors).toBeGreaterThan(0); expect(probe.snapshot().exceptionsObserved).toBe(0); probe.stop();
});
it('RI-07: ライフサイクル履歴は120件、フレームごとのconsole出力はない', () => {
  const h = host(), probe = new RafLifecycleProbe(h.api, () => ({ context, activity: paused }), h.clock);
  probe.start(); for (let i = 0; i < 500; i++) probe.note('UI_RESET');
  expect(probe.snapshot().events).toHaveLength(120); expect(probe.snapshot().droppedEvents).toBe(381); probe.stop();
});
it('RI-08: 再生・PAUSE・ステージ変更で区間を分け、停止後の1秒間隔を再生へ混ぜない', () => {
  const r = new RafMonitor(); r.frame(0, context, paused); r.frame(16, context, paused);
  r.observe(20, context, 'PLAY', playing); r.frame(32, context, playing); r.frame(48, context, playing);
  r.observe(50, context, 'PAUSE', paused); r.frame(60, context, paused); r.frame(1060, context, paused);
  r.observe(1065, context, 'stage-change', { ...paused, scene: 'stage-02' });
  const s = r.snapshot(1070); expect(s.segments).toHaveLength(4);
  expect(s.segments[1].activity?.playback).toBe('PLAYING'); expect(s.segments[1].intervals?.window.maximumMs).toBe(16);
  expect(s.segments[2].activity?.playback).toBe('PAUSED'); expect(s.segments[2].intervals?.window.maximumMs).toBe(1000);
  expect(s.segments[3].activity?.scene).toBe('stage-02'); expect(s.boundaryIntervals.count).toBe(2);
});
it('RI-09: p99・厳密な閾値超の件数/割合・最長連続異常期間を同じ窓から返す', () => {
  const r = new RafMonitor(); let now = 0; r.frame(now, context, playing);
  for (const ms of [100, 101, 500, 501, 900, 901, 16, 1000]) { now += ms; r.frame(now, context, playing); }
  const w = r.snapshot().segments[0].intervals!.window;
  expect(w.count).toBe(8); expect(w.p99Ms).toBe(1000); expect(w.over100Ms).toBe(6); expect(w.over100Ratio).toBe(.75);
  expect(w.over500Ms).toBe(4); expect(w.over500Ratio).toBe(.5); expect(w.over900Ms).toBe(2); expect(w.over900Ratio).toBe(.25);
  expect(w.longestOver100RunMs).toBe(2903); expect(w.sampledIntervalTotalMs).toBe(now);
});
it('RI-10: 操作ツール等の別RAFをゲームの多重登録・間隔・CPUへ混入しない', () => {
  const h = host(); const frame = () => h.api.requestAnimationFrame(frame);
  const probe = new RafLifecycleProbe(h.api, () => ({ context, activity: playing }), h.clock, callback => callback === frame);
  probe.start(); h.api.requestAnimationFrame(frame); h.api.requestAnimationFrame(() => {}); h.tick(0);
  h.api.requestAnimationFrame(() => {}); h.tick(1001);
  expect(probe.snapshot().peakPendingObserved).toBe(2); expect(probe.snapshot().peakGamePendingObserved).toBe(1);
  expect(probe.snapshot().callbacksObserved).toBe(4); expect(probe.snapshot().gameCallbacksObserved).toBe(2);
  expect(probe.snapshot().events.filter(e => e.event === 'LONG_INTERVAL')).toHaveLength(1); probe.stop();
});
