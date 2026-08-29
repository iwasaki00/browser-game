(function () {
  "use strict";

  class SoundManager {
    constructor(config) {
      this.config = config;
      this.context = null;
      this.master = null;
      this.buffers = new Map();
      this.counts = {};
      this.settings = { ...config.defaultSettings };
      this.currentPack = null;
    }

    async unlock() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio API is not supported");
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.applyVolume();
      return this.context;
    }

    applyVolume() {
      if (this.master) this.master.gain.value = this.settings.masterVolume * this.settings.effectVolume;
    }

    setSettings(settings) { this.settings = { ...this.settings, ...settings }; this.applyVolume(); }

    async loadPack(pack) {
      await this.unlock();
      this.currentPack = pack;
      this.buffers.clear();
      for (const definition of this.config.soundDefinitions) {
        const blob = pack.sounds && pack.sounds[definition.id];
        if (!blob) continue;
        try {
          const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
          this.buffers.set(definition.id, buffer);
        } catch (error) {
          console.warn(`Could not decode ${definition.id}`, error);
        }
      }
    }

    resetCounts() { this.counts = {}; }
    getCounts() { return { ...this.counts }; }

    async play(id, options = {}) {
      this.counts[id] = (this.counts[id] || 0) + 1;
      await this.unlock();
      const buffer = this.buffers.get(id);
      if (buffer) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = buffer;
        gain.gain.value = options.gain ?? 1;
        source.connect(gain).connect(this.master);
        source.start();
        return;
      }
      this.playFallback(id, options.gain ?? 1);
    }

    playFallback(id, gainValue) {
      const now = this.context.currentTime;
      const profiles = {
        shot: [620, 180, 0.09, "square"], enemyShot: [220, 420, 0.12, "sawtooth"],
        enemyDestroy: [260, 80, 0.17, "square"], explosion: [110, 34, 0.35, "sawtooth"],
        damage: [150, 72, 0.24, "square"], item: [520, 1040, 0.28, "sine"],
        boss: [95, 48, 0.7, "sawtooth"], gameOver: [260, 65, 0.8, "triangle"], clear: [440, 990, 0.75, "sine"]
      };
      const [start, end, duration, type] = profiles[id] || profiles.shot;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      gain.gain.setValueAtTime(Math.max(0.001, 0.18 * gainValue), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration);
    }
  }

  window.SoundManager = SoundManager;
})();
