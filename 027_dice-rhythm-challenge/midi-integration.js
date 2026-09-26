(function (global) {
  "use strict";

  class MidiPlayer {
    constructor(synth, onEnded) {
      this.synth = synth;
      this.onEnded = onEnded || (() => {});
      this.song = null;
      this.events = [];
      this.cursor = 0;
      this.position = 0;
      this.songStartAudioTime = 0;
      this.playing = false;
      this.timer = 0;
      this.lookAhead = 0.12;
    }

    setSong(song) {
      this.stop();
      this.song = song;
      this.events = global.MidiCommon.getNotes(song).slice().sort((a, b) => a.startTime - b.startTime);
    }

    async startAt(songStartAudioTime, position = 0) {
      if (!this.song || !this.events.length) throw new Error("再生できるノートがありません。");
      const context = await this.synth.ensureContext();
      this.stop(false);
      this.position = Math.max(0, Math.min(this.song.duration, Number(position) || 0));
      this.songStartAudioTime = songStartAudioTime;
      this.cursor = this.events.findIndex((note) => note.endTime > this.position - 0.001);
      if (this.cursor < 0) this.cursor = this.events.length;
      this.playing = true;
      this.schedule();
      this.timer = global.setInterval(() => this.schedule(), 25);
      return context;
    }

    currentTime() {
      if (!this.playing || !this.synth.context) return this.position;
      return Math.max(0, this.synth.context.currentTime - this.songStartAudioTime);
    }

    schedule() {
      if (!this.playing || !this.synth.context) return;
      const context = this.synth.context;
      const songNow = context.currentTime - this.songStartAudioTime;
      const horizon = songNow + this.lookAhead;
      while (this.cursor < this.events.length && this.events[this.cursor].startTime <= horizon) {
        const note = this.events[this.cursor++];
        if (note.endTime <= songNow) continue;
        const when = Math.max(context.currentTime, this.songStartAudioTime + note.startTime);
        const duration = note.endTime - Math.max(songNow, note.startTime);
        this.synth.schedule(note, when, Math.max(0.04, duration));
      }
      if (songNow >= this.song.duration) {
        this.stop(false);
        this.position = this.song.duration;
        this.onEnded();
      }
    }

    pause() {
      if (!this.playing) return this.position;
      this.position = Math.min(this.song.duration, this.currentTime());
      this.playing = false;
      global.clearInterval(this.timer);
      this.timer = 0;
      this.synth.stopAll();
      return this.position;
    }

    stop(reset = true) {
      this.playing = false;
      global.clearInterval(this.timer);
      this.timer = 0;
      this.synth.stopAll();
      if (reset) this.position = 0;
    }
  }

  class MidiIntegration {
    constructor(options = {}) {
      if (!global.MidiCommon || !global.MidiAudio) throw new Error("MIDI共通基盤を読み込めませんでした。");
      this.synth = new global.MidiAudio.MidiSynth();
      this.player = new MidiPlayer(this.synth, () => options.onEnded?.());
      this.song = null;
      this.fileName = "";
      this.songStartAudioTime = 0;
      this.countInBeats = 4;
      this.pausedTimelineTime = null;
    }

    async ensureAudio() { return this.synth.ensureContext(); }
    get context() { return this.synth.context; }
    get ready() { return Boolean(this.song && this.song.totalNotes > 0); }

    parse(arrayBuffer, fileName) {
      const song = global.MidiCommon.parse(arrayBuffer, { fileName });
      if (!song.totalNotes) throw new Error("ノートが含まれていないMIDIです。");
      if (!song.tempoMap?.length) throw new Error("テンポ情報を取得できませんでした。");
      this.song = song;
      this.fileName = fileName || song.fileName || "MIDI";
      this.player.setSong(song);
      return this.getInfo();
    }

    async loadFile(file) {
      if (!file) throw new Error("MIDIファイルを選択してください。");
      if (!/\.(mid|midi)$/i.test(file.name)) throw new Error(".mid または .midi ファイルを選択してください。");
      return this.parse(await file.arrayBuffer(), file.name);
    }

    async loadUrl(url, fileName = "sample.mid") {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        const error = new Error(response.status === 404 ? "サンプルMIDIがありません" : "サンプルMIDIを読み込めませんでした。");
        error.code = response.status === 404 ? "SAMPLE_MISSING" : "LOAD_FAILED";
        throw error;
      }
      return this.parse(await response.arrayBuffer(), fileName);
    }

    getInfo() {
      if (!this.song) return null;
      const signature = this.song.timeSignature || this.song.timeSignatureMap?.[0] || { numerator: 4, denominator: 4 };
      return {
        fileName: this.fileName,
        bpm: this.song.bpm || 120,
        timeSignature: `${signature.numerator}/${signature.denominator}`,
        duration: this.song.duration,
        tracks: global.MidiCommon.getTracks(this.song).length,
        notes: global.MidiCommon.getNotes(this.song).length,
        tempoChanges: this.song.tempoMap.length,
        recommended: this.song.timeSignatureMap.every((item) => item.numerator === 4 && item.denominator === 4)
      };
    }

    initialBeatDuration() { return 60 / (this.song?.tempoMap?.[0]?.bpm || this.song?.bpm || 120); }

    async startWithCountIn(beats = 4) {
      if (!this.ready) throw new Error("MIDIファイルを読み込んでください。");
      const context = await this.ensureAudio();
      this.countInBeats = beats;
      const countInStart = context.currentTime + 0.05;
      this.songStartAudioTime = countInStart + beats * this.initialBeatDuration();
      this.pausedTimelineTime = null;
      await this.player.startAt(this.songStartAudioTime, 0);
      return this.getBeatTiming(-beats);
    }

    getTimelineTime() {
      if (!this.context) return this.pausedTimelineTime || 0;
      if (this.pausedTimelineTime !== null) return this.pausedTimelineTime;
      return this.context.currentTime - this.songStartAudioTime;
    }

    tempoAtTick(tick) {
      let tempo = this.song.tempoMap[0];
      for (let index = 1; index < this.song.tempoMap.length && this.song.tempoMap[index].tick <= tick; index++) tempo = this.song.tempoMap[index];
      return tempo;
    }

    getBeatTiming(beatIndex) {
      if (beatIndex < 0) {
        const duration = this.initialBeatDuration();
        const startSongTime = beatIndex * duration;
        return { beatIndex, startAudioTime: this.songStartAudioTime + startSongTime, endAudioTime: this.songStartAudioTime + startSongTime + duration, duration, bpm: 60 / duration, tick: 0, countIn: true };
      }
      const startTick = beatIndex * this.song.ppq;
      const endTick = startTick + this.song.ppq;
      const startSongTime = global.MidiCommon.tickToSeconds(this.song, startTick);
      const endSongTime = global.MidiCommon.tickToSeconds(this.song, endTick);
      return { beatIndex, startAudioTime: this.songStartAudioTime + startSongTime, endAudioTime: this.songStartAudioTime + endSongTime, duration: endSongTime - startSongTime, bpm: this.tempoAtTick(startTick).bpm, tick: startTick, countIn: false };
    }

    getCurrentState() {
      const timeline = this.getTimelineTime();
      if (timeline < 0) {
        const duration = this.initialBeatDuration();
        const beatIndex = Math.max(-this.countInBeats, Math.floor(timeline / duration));
        const timing = this.getBeatTiming(beatIndex);
        return { ...timing, timeline, progress: Math.max(0, Math.min(1, (this.context.currentTime - timing.startAudioTime) / timing.duration)) };
      }
      const tick = global.MidiCommon.secondsToTick(this.song, timeline);
      const beatIndex = Math.max(0, Math.floor(tick / this.song.ppq));
      const timing = this.getBeatTiming(beatIndex);
      return { ...timing, timeline, progress: Math.max(0, Math.min(1, (this.context.currentTime - timing.startAudioTime) / timing.duration)), musicalTime: global.MidiCommon.tickToBarBeat(this.song, tick) };
    }

    pause() {
      this.pausedTimelineTime = this.getTimelineTime();
      this.player.pause();
      return this.pausedTimelineTime;
    }

    async resume() {
      if (this.pausedTimelineTime === null) return this.getCurrentState();
      const context = await this.ensureAudio();
      const timeline = this.pausedTimelineTime;
      this.songStartAudioTime = context.currentTime - timeline;
      this.pausedTimelineTime = null;
      await this.player.startAt(this.songStartAudioTime, Math.max(0, timeline));
      return this.getCurrentState();
    }

    stop() {
      this.player.stop();
      this.pausedTimelineTime = null;
      this.songStartAudioTime = 0;
    }
  }

  global.MidiIntegration = MidiIntegration;
})(window);
