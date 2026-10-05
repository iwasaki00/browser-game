(function (root) {
  "use strict";

  let context = null;
  let master = null;
  let compressor = null;
  let noiseBuffer = null;
  let trackCount = 8;
  const activeSources = new Set();

  function ensureContext() {
    if (!context) {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = Math.max(0.25, Math.min(0.34, 0.32 * Math.sqrt(8 / trackCount)));
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(context.destination);
    }
    return context;
  }

  async function resume() {
    const audioContext = ensureContext();
    if (audioContext && audioContext.state === "suspended") await audioContext.resume();
    return audioContext;
  }

  function track(source) {
    activeSources.add(source);
    source.addEventListener("ended", () => activeSources.delete(source), { once: true });
    return source;
  }

  function makeNoise() {
    const audioContext = ensureContext();
    if (!audioContext) return null;
    if (!noiseBuffer) {
      noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    }
    const source = track(audioContext.createBufferSource());
    source.buffer = noiseBuffer;
    return source;
  }

  function envelope(destination, time, velocity, attack, duration, peakScale = 1) {
    const audioContext = ensureContext();
    const gain = audioContext.createGain();
    const peak = Math.max(0.0001, velocity * peakScale);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(destination || master);
    return gain;
  }

  function oscillator(type, frequency, time, duration, velocity, destination, endFrequency) {
    const audioContext = ensureContext();
    const osc = track(audioContext.createOscillator());
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    osc.connect(envelope(destination || master, time, velocity, 0.006, duration));
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  function noiseHit(time, duration, velocity, highpass, lowpass) {
    const audioContext = ensureContext();
    const source = makeNoise();
    const high = audioContext.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = highpass;
    let finalNode = high;
    source.connect(high);
    if (lowpass) {
      const low = audioContext.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = lowpass;
      high.connect(low);
      finalNode = low;
    }
    finalNode.connect(envelope(master, time, velocity, 0.003, duration, 0.55));
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  function midiToFrequency(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
  }

  function playInstrument(row, velocity, pitch, time, options = {}) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    const strength = velocity * (options.gainScale == null ? 1 : options.gainScale);
    const pitchOffset = options.glitch ? 6 : 0;
    switch (row) {
      case 0:
        oscillator("sine", options.glitch ? 190 : 145, when, options.glitch ? 0.09 : 0.22, strength * 1.1, master, 48);
        break;
      case 1:
        noiseHit(when, options.glitch ? 0.055 : 0.14, strength, options.glitch ? 2300 : 700, 9000);
        oscillator("triangle", 190, when, 0.08, strength * 0.22, master, 130);
        break;
      case 2:
        noiseHit(when, options.glitch ? 0.025 : 0.055, strength, 6500);
        break;
      case 3:
        noiseHit(when, options.glitch ? 0.07 : 0.28, strength, 5200);
        break;
      case 4:
        oscillator("sine", options.glitch ? 315 : 210, when, options.glitch ? 0.1 : 0.24, strength * 0.76, master, 105);
        break;
      case 5:
        oscillator("square", midiToFrequency(pitch - 12 + pitchOffset), when, options.glitch ? 0.08 : 0.25, strength * 0.34, master);
        break;
      case 6:
        oscillator("triangle", midiToFrequency(pitch + pitchOffset), when, options.glitch ? 0.09 : 0.3, strength * 0.32, master);
        break;
      case 7:
        noiseHit(when, options.glitch ? 0.035 : 0.09, strength, 1200, 5500);
        oscillator("sine", options.glitch ? 780 : 520, when, 0.07, strength * 0.16, master, 260);
        break;
      case 8:
        noiseHit(when, 0.075, strength, 900, 5200);
        noiseHit(when + 0.012, 0.045, strength * 0.55, 1800, 7600);
        break;
      case 9:
        oscillator("triangle", 430, when, 0.1, strength * 0.3, master, 245);
        noiseHit(when, 0.04, strength * 0.4, 2600, 7200);
        break;
      case 10:
        oscillator("sine", midiToFrequency(pitch - 24), when, 0.34, strength * 0.65, master);
        break;
      default:
        oscillator("square", midiToFrequency(pitch + 12), when, 0.13, strength * 0.2, master);
        oscillator("sine", midiToFrequency(pitch), when, 0.2, strength * 0.16, master);
    }
  }

  function playCellNote(cell, time, options = {}) {
    if (!cell || !cell.isNote) return;
    playInstrument(cell.row, cell.velocity, cell.pitch, time, {
      gainScale: options.preview ? 0.58 : 1,
      glitch: Boolean(options.glitch)
    });
  }

  function playMineAccent(row, time, options = {}) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    const scale = options.preview ? 0.6 : 0.82;
    noiseHit(when, 0.045, scale, 3800, 10500);
    oscillator("square", 760 + row * 37, when, 0.065, 0.16 * scale, master, 430 + row * 20);
  }

  function playMissEffect(time) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    noiseHit(when, 0.2, 0.72, 80, 2400);
    oscillator("sawtooth", 230, when, 0.3, 0.22, master, 44);
  }

  function playGlitchTick(time) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    for (let index = 0; index < 3; index += 1) {
      noiseHit(when + index * 0.025, 0.016, 0.22, 1700 + index * 1200, 7000);
    }
  }

  function playClearEffect(isPerfect, time) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    const chord = isPerfect ? [60, 63, 67, 72] : [60, 63, 67];
    chord.forEach((pitch, index) => {
      oscillator("sine", midiToFrequency(pitch), when + index * 0.055, 0.5, 0.14, master);
    });
    if (isPerfect) playMineAccent(7, when + 0.24, { preview: false });
  }

  function stopAll() {
    activeSources.forEach((source) => {
      try { source.stop(); } catch (_) { /* The source may already be stopped. */ }
    });
    activeSources.clear();
  }

  function setTrackCount(count) {
    trackCount = Math.max(1, Number(count) || 8);
    if (master) master.gain.setTargetAtTime(
      Math.max(0.25, Math.min(0.34, 0.32 * Math.sqrt(8 / trackCount))),
      context.currentTime,
      0.03
    );
  }

  root.MinesweeperAudio = {
    resume,
    playInstrument,
    playCellNote,
    playMineAccent,
    playMissEffect,
    playGlitchTick,
    playClearEffect,
    setTrackCount,
    stopAll,
    currentTime() { return context ? context.currentTime : 0; },
    isAvailable() { return Boolean(root.AudioContext || root.webkitAudioContext); }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
