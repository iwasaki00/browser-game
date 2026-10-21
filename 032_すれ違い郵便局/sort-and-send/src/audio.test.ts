import { describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import { defaultSettings } from './progress';
function harness() {
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const gains: { gain: ReturnType<typeof parameter> }[] = [];
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }), suspend: vi.fn(async () => { context.state = 'suspended'; }),
    createGain: vi.fn(() => { const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node; }),
    createOscillator: vi.fn(() => ({ frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const callbacks = new Set<() => void>();
  const timers = { set: vi.fn((callback: () => void) => { callbacks.add(callback); return callback; }), clear: vi.fn((id: unknown) => { callbacks.delete(id as () => void); }) };
  const audio = new GameAudio({ ...defaultSettings }, factory, timers);
  return { audio, context, factory, timers, callbacks, gains };
}
describe('audio isolation', () => {
  it('creates no context or sound before a user gesture', () => {
    const h = harness(); h.audio.play('clear'); h.audio.update({ ...defaultSettings, bgm: true });
    expect(h.factory).not.toHaveBeenCalled(); expect(h.timers.set).not.toHaveBeenCalled();
  });
  it('resumes after a gesture, uses independent SFX and BGM gates and volume zero', async () => {
    const h = harness(); await h.audio.activate(); h.audio.play('correct');
    expect(h.context.resume).toHaveBeenCalledTimes(1); expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
    h.audio.update({ ...defaultSettings, sfx: false, bgm: true }); h.audio.play('wrong');
    expect(h.context.createOscillator).toHaveBeenCalledTimes(2); expect(h.gains[1].gain.value).toBe(0);
    for (const callback of h.callbacks) callback(); expect(h.context.createOscillator).toHaveBeenCalledTimes(3);
    h.audio.update({ ...defaultSettings, bgm: false }); h.audio.play('switch');
    expect(h.context.createOscillator).toHaveBeenCalledTimes(4); expect(h.gains[2].gain.value).toBe(0); expect(h.callbacks.size).toBe(0);
    h.audio.update({ ...defaultSettings, bgm: true, volume: 0 }); h.audio.play('record');
    expect(h.context.createOscillator).toHaveBeenCalledTimes(4); expect(h.gains[0].gain.value).toBe(0); expect(h.callbacks.size).toBe(0);
  });
  it('never starts multiple BGM timers across repeated activation or settings updates', async () => {
    const h = harness(); h.audio.update({ ...defaultSettings, bgm: true }); await h.audio.activate();
    await h.audio.activate(); await h.audio.activate(); h.audio.update({ ...defaultSettings, bgm: true });
    expect(h.factory).toHaveBeenCalledTimes(1); expect(h.timers.set).toHaveBeenCalledTimes(1); expect(h.callbacks.size).toBe(1);
  });
  it('stops background sound and resumes only with another gesture', async () => {
    const h = harness(); h.audio.update({ ...defaultSettings, bgm: true }); await h.audio.activate(); h.audio.play('switch');
    h.audio.setHidden(true); expect(h.callbacks.size).toBe(0); expect(h.context.suspend).toHaveBeenCalledTimes(1);
    expect(h.gains[0].gain.value).toBe(0); h.audio.play('clear'); expect(h.context.createOscillator).toHaveBeenCalledTimes(1);
    h.audio.setHidden(false); expect(h.callbacks.size).toBe(0); await h.audio.activate(); expect(h.callbacks.size).toBe(1);
  });
  it('continues silently when audio is unsupported or context creation/resume fails', async () => {
    const unsupported = new GameAudio(defaultSettings, () => undefined); await expect(unsupported.activate()).resolves.toBeUndefined();
    const denied = new GameAudio(defaultSettings, () => { throw Error('denied'); }); await expect(denied.activate()).resolves.toBeUndefined();
    expect(() => denied.play('clear')).not.toThrow();
    const h = harness(); h.context.resume.mockRejectedValueOnce(Error('blocked')); await expect(h.audio.activate()).resolves.toBeUndefined();
    h.audio.play('wrong'); expect(h.context.createOscillator).not.toHaveBeenCalled();
  });
});
