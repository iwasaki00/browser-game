const AUDIO_FILES = Object.freeze([
  "seq_clap.wav",
  "seq_hat_closed.wav",
  "seq_hat_open.wav",
  "seq_hat_tick.wav",
  "seq_kick_deep.wav",
  "seq_kick_soft.wav",
  "seq_kick_tight.wav",
  "seq_snare_crisp.wav",
  "seq_snare_noise.wav",
  "seq_snare_soft.wav",
  "seq_synth_bass_c.wav",
  "seq_synth_bass_g.wav",
  "seq_synth_drop.wav",
  "seq_synth_pluck_c.wav",
  "seq_synth_pluck_e.wav",
  "seq_synth_pluck_g.wav",
  "seq_synth_rise.wav",
  "seq_synth_stab_amin.wav",
  "seq_synth_stab_cmaj.wav",
  "seq_tom_low.wav",
  "seq_tom_mid.wav",
]);

export const PIECE_SOUND_MAP = Object.freeze({
  I: "seq_hat_closed.wav",
  O: "seq_kick_deep.wav",
  T: "seq_snare_crisp.wav",
  S: "seq_clap.wav",
  Z: "seq_hat_open.wav",
  J: "seq_tom_low.wav",
  L: "seq_tom_mid.wav",
});

export const EVENT_SOUND_MAP = Object.freeze({
  start: "seq_synth_rise.wav",
  lineClear: "seq_synth_drop.wav",
  gameOver: "seq_synth_stab_amin.wav",
});

const EVENT_ALIASES = Object.freeze({
  "line-clear": "lineClear",
  line_clear: "lineClear",
  "game-over": "gameOver",
  game_over: "gameOver",
});

const clampVolume = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};

/**
 * Preloaded Web Audio player with separate sequencer and event-effect buses.
 *
 * `unlock()` must be called directly from the first pointer/touch interaction.
 */
export class AudioEngine {
  constructor(options = {}) {
    const {
      masterVolume = 0.8,
      sequencerVolume,
      drumVolume = sequencerVolume ?? 0.8,
      bassVolume = 0.45,
      chordVolume = 0.35,
      seVolume,
      eventVolume = seVolume ?? 0.5,
      muted = {},
      maxVoices = 32,
    } = options;
    this._volumes = {
      master: clampVolume(masterVolume, 0.8),
      drum: clampVolume(drumVolume, 0.8),
      bass: clampVolume(bassVolume, 0.45),
      chord: clampVolume(chordVolume, 0.35),
      event: clampVolume(eventVolume, 0.5),
    };
    this._muted = {
      master: Boolean(muted.master),
      drum: Boolean(muted.drum),
      bass: Boolean(muted.bass),
      chord: Boolean(muted.chord),
      event: Boolean(muted.event),
    };
    this._sequencerVolume = this._volumes.drum;
    this._seVolume = this._volumes.event;
    this.maxVoices = Math.max(8, Math.floor(Number(maxVoices) || 32));
    this._buffers = new Map();
    this._activeSources = new Set();
    this._progressListeners = new Set();
    this._loadPromise = null;
    this._closed = false;

    this.context = null;
    this.masterGain = null;
    this.compressor = null;
    this.busGains = {};
    this.sequencerGain = null;
    this.seGain = null;

    this._createContext();
  }

  static get isSupported() {
    return Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
  }

  get currentTime() {
    return this.context?.currentTime ?? 0;
  }

  get loaded() {
    return this._buffers.size === AUDIO_FILES.length;
  }

  get loadedCount() {
    return this._buffers.size;
  }

  get totalCount() {
    return AUDIO_FILES.length;
  }

  get sequencerVolume() {
    return this._sequencerVolume;
  }

  get seVolume() {
    return this._seVolume;
  }

  _createContext() {
    const AudioContextClass =
      globalThis.AudioContext || globalThis.webkitAudioContext;

    if (!AudioContextClass) return;

    try {
      this.context = new AudioContextClass({ latencyHint: "interactive" });
    } catch {
      // Older Safari versions do not accept AudioContextOptions.
      try {
        this.context = new AudioContextClass();
      } catch {
        this.context = null;
        return;
      }
    }

    this.masterGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor?.() ?? null;
    this.busGains = {
      drum: this.context.createGain(),
      bass: this.context.createGain(),
      chord: this.context.createGain(),
      event: this.context.createGain(),
    };

    if (this.compressor) {
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    } else {
      this.masterGain.connect(this.context.destination);
    }

    for (const gain of Object.values(this.busGains)) {
      gain.connect(this.masterGain);
    }
    this.sequencerGain = this.busGains.drum;
    this.seGain = this.busGains.event;
    this._applyAllBusGains(false);
  }

  /**
   * Resumes Web Audio and primes iOS Safari's output path.
   * Call this synchronously from the first user gesture.
   */
  async unlock() {
    if (!this.context || this._closed || this.context.state === "closed") {
      return false;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }

    if (this.context.state === "running") {
      const silentBuffer = this.context.createBuffer(
        1,
        1,
        this.context.sampleRate,
      );
      const source = this.context.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(this.context.destination);
      source.start(this.context.currentTime);
      source.onended = () => source.disconnect();
    }

    return this.context.state === "running";
  }

  /**
   * Fetches and decodes all WAV files once.
   * onProgress receives (loadedCount, totalCount, filename).
   */
  async loadAll(onProgress) {
    if (!this.context) {
      throw new Error("Web Audio API is not available in this browser.");
    }

    if (typeof onProgress === "function") {
      this._progressListeners.add(onProgress);
      this._notifyProgress(null);
    }

    if (!this._loadPromise && !this.loaded) {
      this._loadPromise = this._loadMissingFiles();
    }

    try {
      if (this._loadPromise) await this._loadPromise;
      return this._buffers;
    } finally {
      if (typeof onProgress === "function") {
        this._progressListeners.delete(onProgress);
      }
      if (!this.loaded) this._loadPromise = null;
    }
  }

  async _loadMissingFiles() {
    const missingFiles = AUDIO_FILES.filter(
      (filename) => !this._buffers.has(filename),
    );

    const results = await Promise.all(
      missingFiles.map(async (filename) => {
        try {
          const url = new URL(`../assets/sfx/${filename}`, import.meta.url);
          const response = await fetch(url, { cache: "force-cache" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          const audioData = await response.arrayBuffer();
          const buffer = await this._decodeAudioData(audioData);
          this._buffers.set(filename, buffer);
          this._notifyProgress(filename);
          return null;
        } catch (error) {
          return { filename, error };
        }
      }),
    );

    const failures = results.filter(Boolean);
    if (failures.length > 0) {
      const failedNames = failures.map(({ filename }) => filename).join(", ");
      const error = new Error(`Failed to load audio files: ${failedNames}`);
      error.failures = failures;
      throw error;
    }
  }

  _decodeAudioData(audioData) {
    return new Promise((resolve, reject) => {
      this.context.decodeAudioData(audioData, resolve, reject);
    });
  }

  _notifyProgress(filename) {
    const loaded = this._buffers.size;
    const total = AUDIO_FILES.length;

    for (const listener of this._progressListeners) {
      try {
        listener(loaded, total, filename);
      } catch (error) {
        console.error("Audio load progress callback failed.", error);
      }
    }
  }

  playPiece(type, when = this.currentTime, gain = 1) {
    const filename = PIECE_SOUND_MAP[String(type).toUpperCase()];
    return filename
      ? this.playFile(filename, { bus: "drum", when, gain })
      : null;
  }

  playEvent(name, when = this.currentTime) {
    const normalizedName = EVENT_ALIASES[name] ?? name;
    const filename = EVENT_SOUND_MAP[normalizedName];
    return filename
      ? this.playFile(filename, { bus: "event", when, gain: 1 })
      : null;
  }

  playFile(filename, {
    bus = "event",
    when = this.currentTime,
    gain = 1,
  } = {}) {
    const destination = this.busGains[bus] ?? this.seGain;
    return this._playBuffer(filename, destination, when, gain);
  }

  _playBuffer(filename, destination, when, gain) {
    if (
      !this.context ||
      !destination ||
      this._closed ||
      this.context.state === "closed"
    ) {
      return null;
    }

    const buffer = this._buffers.get(filename);
    if (!buffer) return null;

    while (this._activeSources.size >= this.maxVoices) {
      const oldest = this._activeSources.values().next().value;
      if (!oldest) break;
      this._activeSources.delete(oldest);
      try {
        oldest.stop();
      } catch {
        // The voice may have completed while the limiter was running.
      }
    }

    const source = this.context.createBufferSource();
    const voiceGain = this.context.createGain();
    const startTime = Number.isFinite(Number(when))
      ? Math.max(Number(when), this.context.currentTime)
      : this.context.currentTime;

    source.buffer = buffer;
    voiceGain.gain.value = Math.min(1.25, Math.max(0, Number(gain) || 0));
    source.connect(voiceGain);
    voiceGain.connect(destination);
    this._activeSources.add(source);

    source.onended = () => {
      this._activeSources.delete(source);
      source.disconnect();
      voiceGain.disconnect();
    };

    source.start(startTime);
    return source;
  }

  setSequencerVolume(value) {
    this._sequencerVolume = this.setBusVolume("drum", value);
    return this._sequencerVolume;
  }

  setSeVolume(value) {
    this._seVolume = this.setBusVolume("event", value);
    return this._seVolume;
  }

  setBusVolume(bus, value) {
    if (!(bus in this._volumes)) return 0;
    this._volumes[bus] = clampVolume(value, this._volumes[bus]);
    this._applyBusGain(bus);
    return this._volumes[bus];
  }

  setBusMuted(bus, muted) {
    if (!(bus in this._muted)) return false;
    this._muted[bus] = Boolean(muted);
    this._applyBusGain(bus);
    return this._muted[bus];
  }

  getMixerState() {
    return {
      volumes: { ...this._volumes },
      muted: { ...this._muted },
    };
  }

  _applyAllBusGains(smooth = true) {
    for (const bus of Object.keys(this._volumes)) {
      this._applyBusGain(bus, smooth);
    }
  }

  _applyBusGain(bus, smooth = true) {
    const gainNode = bus === "master"
      ? this.masterGain
      : this.busGains[bus];
    const value = this._muted[bus] ? 0 : this._volumes[bus];
    if (smooth) this._setGain(gainNode, value);
    else if (gainNode) gainNode.gain.value = value;
  }

  _setGain(gainNode, value) {
    if (!gainNode || !this.context || this.context.state === "closed") return;
    gainNode.gain.cancelScheduledValues(this.context.currentTime);
    gainNode.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  async close() {
    if (this._closed) return;
    this._closed = true;

    for (const source of this._activeSources) {
      try {
        source.stop();
      } catch {
        // A source may already have finished between iteration and stop().
      }
    }
    this._activeSources.clear();

    for (const gain of Object.values(this.busGains)) gain?.disconnect();
    this.masterGain?.disconnect();
    this.compressor?.disconnect();

    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
  }
}

export { AUDIO_FILES };
