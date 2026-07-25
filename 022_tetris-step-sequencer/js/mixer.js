export const MIXER_BUSES = Object.freeze([
  "master",
  "drum",
  "bass",
  "chord",
  "event",
]);

export class Mixer {
  constructor(audio, settings = {}) {
    this.audio = audio;
    this.state = {};
    this.apply(settings);
  }

  apply(settings = {}) {
    const muted = settings.muted ?? {};
    const values = {
      master: settings.masterVolume,
      drum: settings.drumVolume ?? settings.sequencerVolume,
      bass: settings.bassVolume,
      chord: settings.chordVolume,
      event: settings.eventVolume ?? settings.seVolume,
    };
    for (const bus of MIXER_BUSES) {
      if (values[bus] !== undefined) this.audio.setBusVolume(bus, values[bus]);
      if (muted[bus] !== undefined) this.audio.setBusMuted(bus, muted[bus]);
    }
    this.state = this.audio.getMixerState();
    return this.snapshot();
  }

  setVolume(bus, value) {
    this.audio.setBusVolume(bus, value);
    this.state = this.audio.getMixerState();
    return this.state.volumes[bus];
  }

  toggleMute(bus) {
    const muted = !Boolean(this.state.muted?.[bus]);
    this.audio.setBusMuted(bus, muted);
    this.state = this.audio.getMixerState();
    return muted;
  }

  snapshot() {
    return {
      volumes: { ...this.state.volumes },
      muted: { ...this.state.muted },
    };
  }
}

export default Mixer;
