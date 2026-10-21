import type { Settings } from './progress';
export type Sound = 'switch' | 'correct' | 'wrong' | 'clear' | 'record';
const melodies: Record<Sound, number[]> = {
  switch: [520], correct: [660, 880], wrong: [200, 150], clear: [523, 659, 784], record: [784, 988, 1175, 1568],
};
interface Clock { set(callback: () => void, milliseconds: number): unknown; clear(id: unknown): void }
const clock: Clock = { set: (callback, ms) => setInterval(callback, ms), clear: id => clearInterval(id as ReturnType<typeof setInterval>) };

/** One lazy context and one BGM timer; all failures remain outside game logic. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  private timer?: unknown;
  private activated = false;
  private hidden = false;
  private note = 0;
  private oscillators = new Set<OscillatorNode>();
  constructor(private settings: Settings, private factory: () => AudioContext | undefined = () =>
    typeof globalThis.AudioContext === 'function' ? new AudioContext() : undefined, private timers: Clock = clock) {}

  async activate() {
    this.activated = true;
    if (this.hidden || this.settings.volume === 0 || (!this.settings.sfx && !this.settings.bgm)) return;
    try {
      if (!this.context) {
        const context = this.factory(); if (!context) return;
        this.context = context;
        this.master = context.createGain(); this.master.connect(context.destination);
        this.effects = context.createGain(); this.effects.connect(this.master);
        this.music = context.createGain(); this.music.connect(this.master);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.sync();
    } catch { this.stopMusic(); }
  }
  update(settings: Settings) {
    this.settings = { ...settings };
    try { this.sync(); } catch { this.stopMusic(); }
  }
  private sync() {
    if (!this.context || !this.master || !this.effects || !this.music) return;
    this.master.gain.value = this.hidden ? 0 : this.settings.volume;
    this.effects.gain.value = this.settings.sfx ? .14 : 0;
    this.music.gain.value = this.settings.bgm ? .035 : 0;
    const playMusic = this.activated && !this.hidden && this.settings.bgm && this.settings.volume > 0 && this.context.state === 'running';
    if (playMusic && this.timer === undefined) {
      this.timer = this.timers.set(() => this.musicNote(), 700);
    } else if (!playMusic) this.stopMusic();
  }
  play(sound: Sound) {
    if (!this.activated || this.hidden || !this.settings.sfx || this.settings.volume === 0 || this.context?.state !== 'running' || !this.effects) return;
    try { melodies[sound].forEach((frequency, i) => this.tone(frequency, i * .075, .09, this.effects!)); }
    catch { /* Unsupported audio never interrupts delivery. */ }
  }
  private musicNote() {
    if (!this.settings.bgm || !this.context || !this.music || this.hidden || this.context.state !== 'running') return;
    try { this.tone([262, 330, 392, 330, 294, 349, 440, 349][this.note++ % 8], 0, .35, this.music); }
    catch { this.stopMusic(); }
  }
  private tone(frequency: number, delay: number, duration: number, target: GainNode) {
    const context = this.context!;
    const oscillator = context.createOscillator(); const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(envelope); envelope.connect(target);
    this.oscillators.add(oscillator);
    oscillator.onended = () => { this.oscillators.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
  }
  private stopMusic() {
    if (this.timer !== undefined) { this.timers.clear(this.timer); this.timer = undefined; }
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.stopMusic();
      for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch { /* Already ended. */ } }
      this.oscillators.clear();
      try {
        this.sync();
        const suspended = this.context?.suspend(); void suspended?.catch(() => {});
      } catch { /* Continue silently. */ }
    }
    // Resume only on the next permitted user gesture, never from a visibility callback.
  }
}
