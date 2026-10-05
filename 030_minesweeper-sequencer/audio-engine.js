(function (root) {
  "use strict";

  let context = null;
  let master = null;
  let noiseBuffer = null;
  const activeSources = new Set();

  function ensureContext() {
    if (!context) {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.42;
      master.connect(context.destination);
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

  function playInstrument(row, velocity, pitch, time) {
    if (!ensureContext()) return;
    const when = Math.max(time || context.currentTime, context.currentTime);
    switch (row) {
      case 0:
        oscillator("sine", 145, when, 0.22, velocity * 1.1, master, 48);
        break;
      case 1:
        noiseHit(when, 0.14, velocity, 700, 9000);
        oscillator("triangle", 190, when, 0.08, velocity * 0.22, master, 130);
        break;
      case 2:
        noiseHit(when, 0.055, velocity, 6500);
        break;
      case 3:
        noiseHit(when, 0.28, velocity, 5200);
        break;
      case 4:
        oscillator("sine", 210, when, 0.24, velocity * 0.76, master, 105);
        break;
      case 5:
        oscillator("square", midiToFrequency(pitch - 12), when, 0.25, velocity * 0.34, master);
        break;
      case 6:
        oscillator("triangle", midiToFrequency(pitch), when, 0.3, velocity * 0.32, master);
        break;
      default:
        noiseHit(when, 0.09, velocity, 1200, 5500);
        oscillator("sine", 520, when, 0.07, velocity * 0.16, master, 260);
    }
  }

  function stopAll() {
    activeSources.forEach((source) => {
      try { source.stop(); } catch (_) { /* The source may already be stopped. */ }
    });
    activeSources.clear();
  }

  root.MinesweeperAudio = {
    resume,
    playInstrument,
    stopAll,
    currentTime() { return context ? context.currentTime : 0; },
    isAvailable() { return Boolean(root.AudioContext || root.webkitAudioContext); }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
