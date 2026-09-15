(function (global) {
  "use strict";

  class MidiSynth {
    constructor() {
      this.context = null;
      this.master = null;
      this.volume = 0.65;
      this.activeNodes = new Set();
    }

    async ensureContext() {
      if (!this.context) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error("このブラウザはWeb Audio APIに対応していません。");
        this.context = new AudioCtx();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume();
      return this.context;
    }

    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value)));
      if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
    }

    schedule(note, when, duration) {
      if (!this.context || !this.master || when + duration < this.context.currentTime) return null;
      const osc = this.context.createOscillator();
      const overtone = this.context.createOscillator();
      const overtoneGain = this.context.createGain();
      const gain = this.context.createGain();
      const velocity = Math.max(0.02, note.velocity / 127);
      const frequency = 440 * Math.pow(2, (note.noteNumber - 69) / 12);
      osc.type = "triangle"; osc.frequency.value = frequency;
      overtone.type = "sine"; overtone.frequency.value = frequency * 2;
      overtoneGain.gain.value = 0.12;
      const start = Math.max(when, this.context.currentTime);
      const release = Math.max(start + 0.04, when + Math.max(0.04, duration));
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity * 0.22), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity * 0.1), Math.min(release, start + 0.15));
      gain.gain.exponentialRampToValueAtTime(0.0001, release + 0.12);
      osc.connect(gain); overtone.connect(overtoneGain); overtoneGain.connect(gain); gain.connect(this.master);
      const record = { osc, overtone, gain, noteNumber: note.noteNumber, end: release + 0.13 };
      this.activeNodes.add(record);
      osc.onended = () => this.activeNodes.delete(record);
      osc.start(start); overtone.start(start);
      osc.stop(release + 0.13); overtone.stop(release + 0.13);
      return record;
    }

    stopAll() {
      if (!this.context) return;
      const now = this.context.currentTime;
      this.activeNodes.forEach((node) => {
        try {
          node.gain.gain.cancelScheduledValues(now);
          node.gain.gain.setTargetAtTime(0.0001, now, 0.008);
          node.osc.stop(now + 0.04); node.overtone.stop(now + 0.04);
        } catch (_) { /* already stopped */ }
      });
      this.activeNodes.clear();
    }

    activeNoteNames() {
      if (!this.context) return [];
      const now = this.context.currentTime;
      return [...this.activeNodes].filter((n) => n.end > now).map((n) => window.MidiCore.noteName(n.noteNumber));
    }
  }

  class AudioClockPlayer {
    constructor(synth, onStateChange) {
      this.synth = synth; this.song = null; this.position = 0; this.playing = false;
      this.startedAt = 0; this.events = []; this.cursor = 0; this.timer = null;
      this.lookAhead = 0.12; this.intervalMs = 25; this.lastSchedulerDelay = 0;
      this.lastSchedulerAt = 0; this.onStateChange = onStateChange || (() => {});
    }
    setSong(song) { this.stop(); this.song = song; this.position = 0; this.rebuildEvents(); this.onStateChange(); }
    rebuildEvents() {
      this.events = this.song ? this.song.tracks.flatMap((track) => track.notes.map((note) => ({ track, note }))).sort((a, b) => a.note.startTime - b.note.startTime) : [];
    }
    currentTime() {
      if (!this.playing || !this.synth.context) return this.position;
      return Math.min(this.song?.duration || Infinity, this.position + this.synth.context.currentTime - this.startedAt);
    }
    async play() {
      if (!this.song || !this.song.totalNotes) throw new Error("再生するノートがありません。");
      const ctx = await this.synth.ensureContext();
      if (this.position >= this.song.duration - 0.001) this.position = 0;
      this.playing = true; this.startedAt = ctx.currentTime;
      this.cursor = this.events.findIndex((e) => e.note.startTime >= this.position - 0.001);
      if (this.cursor < 0) this.cursor = this.events.length;
      this.lastSchedulerAt = performance.now();
      this.schedule();
      this.timer = window.setInterval(() => this.schedule(), this.intervalMs);
      this.onStateChange();
    }
    schedule() {
      if (!this.playing || !this.synth.context) return;
      const perfNow = performance.now();
      this.lastSchedulerDelay = Math.max(0, perfNow - this.lastSchedulerAt - this.intervalMs);
      this.lastSchedulerAt = perfNow;
      const songNow = this.currentTime(), horizon = songNow + this.lookAhead;
      while (this.cursor < this.events.length && this.events[this.cursor].note.startTime <= horizon) {
        const event = this.events[this.cursor++];
        if (event.track.enabled && event.note.startTime + event.note.duration >= songNow) {
          const when = this.synth.context.currentTime + Math.max(0, event.note.startTime - songNow);
          const remaining = event.note.duration - Math.max(0, songNow - event.note.startTime);
          this.synth.schedule(event.note, when, remaining);
        }
      }
      if (songNow >= this.song.duration) this.stop(true);
    }
    pause() {
      if (!this.playing) return;
      this.position = this.currentTime(); this.playing = false;
      clearInterval(this.timer); this.timer = null; this.synth.stopAll(); this.onStateChange();
    }
    stop(ended = false) {
      if (this.playing) this.position = this.currentTime();
      this.playing = false; clearInterval(this.timer); this.timer = null; this.synth.stopAll();
      this.position = 0; this.cursor = 0; this.onStateChange(ended);
    }
    rewind() {
      const wasPlaying = this.playing; this.stop();
      if (wasPlaying) this.play().catch(() => {});
    }
    seek(seconds) {
      const wasPlaying = this.playing;
      if (wasPlaying) this.pause();
      this.position = Math.max(0, Math.min(this.song?.duration || 0, Number(seconds)));
      if (wasPlaying) this.play().catch(() => {}); else this.onStateChange();
    }
  }

  global.MidiAudio = { MidiSynth, AudioClockPlayer };
})(window);
