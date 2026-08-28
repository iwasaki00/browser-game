(function defineAudio(global) {
  "use strict";
  const P = global.PythagoraLab;

  class AudioManager {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
      this.lastPlayed = new Map();
    }

    async unlock() {
      if (!this.enabled) return false;
      const Context = global.AudioContext || global.webkitAudioContext;
      if (!Context) return false;
      if (!this.context) {
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume().catch(() => false);
      return this.context.state === "running";
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.master) this.master.gain.value = this.enabled ? 0.16 : 0;
    }

    play(name, intensity = 1) {
      if (!this.enabled || !this.context || this.context.state !== "running") return;
      const nowMs = performance.now();
      if (nowMs - (this.lastPlayed.get(name) || 0) < (name === "ui" ? 45 : 85)) return;
      this.lastPlayed.set(name, nowMs);
      const presets = {
        ui: [420, 0.035, "sine"],
        roll: [160, 0.045, "triangle"],
        domino: [190, 0.07, "square"],
        wood: [130, 0.06, "triangle"],
        metal: [580, 0.08, "sine"],
        spring: [240, 0.16, "sine"],
        switch: [680, 0.09, "square"],
        goal: [760, 0.22, "sine"],
        clear: [520, 0.34, "sine"]
      };
      const [frequency, duration, type] = presets[name] || presets.ui;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (name === "spring") oscillator.frequency.exponentialRampToValueAtTime(980, now + duration);
      if (name === "goal" || name === "clear") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.55, now + duration);
      const volume = P.util.clamp(intensity, 0.1, 1.5) * 0.8;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    suspend() {
      void this.context?.suspend?.().catch(() => {});
    }
  }

  P.AudioManager = AudioManager;
})(window);
