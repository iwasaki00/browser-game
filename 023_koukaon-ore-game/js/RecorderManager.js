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
      this.startedAt = 0;
    }

    get supported() { return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }

    async ensureStream() {
      if (!this.supported) throw new Error("このブラウザは録音機能に対応していません。");
      if (this.stream?.active) return this.stream;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = await this.soundManager.unlock();
      this.source = context.createMediaStreamSource(this.stream);
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 256;
      this.source.connect(this.analyser);
      return this.stream;
    }

    preferredMimeType() {
      const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
    }

    async start(maxSeconds, onLevel, onTime) {
      await this.ensureStream();
      this.chunks = [];
      const mimeType = this.preferredMimeType();
      this.recorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
      const finished = new Promise((resolve, reject) => {
        this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
        this.recorder.onerror = () => reject(this.recorder.error || new Error("録音に失敗しました"));
        this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.recorder.mimeType || mimeType || "audio/webm" }));
      });
      this.startedAt = performance.now();
      this.recorder.start(100);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const update = () => {
        if (!this.recorder || this.recorder.state !== "recording") return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) { const sample = (value - 128) / 128; sum += sample * sample; }
        onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        onTime((performance.now() - this.startedAt) / 1000);
        this.meterFrame = requestAnimationFrame(update);
      };
      update();
      this.timer = window.setTimeout(() => this.stop(), maxSeconds * 1000);
      return finished;
    }

    stop() {
      clearTimeout(this.timer);
      cancelAnimationFrame(this.meterFrame);
      if (this.recorder?.state === "recording") this.recorder.stop();
    }

    release() {
      this.stop();
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      try { this.source?.disconnect(); } catch (_) {}
    }
  }

  window.RecorderManager = RecorderManager;
})();
