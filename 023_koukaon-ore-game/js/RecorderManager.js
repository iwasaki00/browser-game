(function () {
  "use strict";

  class RecorderManager {
    constructor(soundManager) {
      this.soundManager = soundManager;
      this.stream = null;
      this.recorder = null;
      this.analyser = null;
      this.source = null;
      this.chunks = [];
      this.timer = null;
      this.meterFrame = 0;
      this.permissionPromise = null;
      this.startedAt = 0;
      this.session = 0;
      this.streamPromise = null;
      this.starting = false;
    }

    get supported() { return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }

    audioConstraints() {
      return { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } };
    }

    async requestPermission() {
      if (!this.supported) throw new Error("このブラウザは録音機能に対応していません。");
      if (this.stream?.active) return true;
      if (this.permissionPromise) return this.permissionPromise;
      this.permissionPromise = navigator.mediaDevices.getUserMedia(this.audioConstraints())
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          return true;
        });
      try { return await this.permissionPromise; }
      finally { this.permissionPromise = null; }
    }

    async ensureStream() {
      if (!this.supported) throw new Error("このブラウザは録音機能に対応していません。");
      if (this.stream?.active) return this.stream;
      if (this.streamPromise) return this.streamPromise;
      const session = this.session;
      const pending = (async () => {
        const stream = await navigator.mediaDevices.getUserMedia(this.audioConstraints());
        try {
          if (session !== this.session) throw new DOMException("録音をキャンセルしました", "AbortError");
          this.stream = stream;
          const context = await this.soundManager.unlock();
          if (session !== this.session) throw new DOMException("録音をキャンセルしました", "AbortError");
          this.source = context.createMediaStreamSource(stream);
          this.analyser = context.createAnalyser();
          this.analyser.fftSize = 256;
          this.source.connect(this.analyser);
          return stream;
        } catch (error) {
          stream.getTracks().forEach(track => track.stop());
          if (session === this.session) this.release();
          throw error;
        }
      })();
      this.streamPromise = pending;
      try { return await pending; }
      finally { if (this.streamPromise === pending) this.streamPromise = null; }
    }

    preferredMimeType() {
      const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
    }

    async start(maxSeconds, onLevel, onTime) {
      if (this.starting || this.recorder) throw new Error("録音処理中です");
      this.starting = true;
      const session = this.session;
      try {
        const stream = await this.ensureStream();
        if (session !== this.session) throw new DOMException("録音をキャンセルしました", "AbortError");
        const mimeType = this.preferredMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const chunks = [];
        this.recorder = recorder;
        const finished = new Promise((resolve, reject) => {
          recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
          recorder.onerror = () => { if (this.recorder === recorder) this.release(); reject(recorder.error || new Error("録音に失敗しました")); };
          recorder.onstop = () => {
            if (this.recorder === recorder) { this.recorder = null; this.cleanupStream(); }
            resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
          };
        });
        this.startedAt = performance.now();
        recorder.start(100);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        const update = () => {
          if (session !== this.session || recorder.state !== "recording") return;
          this.analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) { const sample = (value - 128) / 128; sum += sample * sample; }
          onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          onTime((performance.now() - this.startedAt) / 1000);
          this.meterFrame = requestAnimationFrame(update);
        };
        update();
        this.timer = window.setTimeout(() => this.stop(), maxSeconds * 1000);
        return await finished;
      } catch (error) {
        if (session === this.session) this.release();
        throw error;
      } finally { if (session === this.session) this.starting = false; }
    }

    cleanupStream() {
      clearTimeout(this.timer); this.timer = null;
      cancelAnimationFrame(this.meterFrame); this.meterFrame = 0;
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      try { this.source?.disconnect(); this.analyser?.disconnect(); } catch (_) {}
      this.source = null; this.analyser = null;
    }

    stop() {
      const recorder = this.recorder;
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
      }
      this.cleanupStream();
    }

    release() {
      ++this.session;
      this.stop();
      this.recorder = null; this.starting = false; this.streamPromise = null;
    }

  }

  window.RecorderManager = RecorderManager;
})();
