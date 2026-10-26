// Quiet, locally synthesized mechanical/toy sounds. Audio failure never blocks play.
export function createToyAudio({ isMuted = () => false } = {}) {
  let context;
  let lastTick = 0;
  async function unlock() {
    if (isMuted()) return;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      context ||= new Audio();
      if (context.state === "suspended") await context.resume();
    } catch { /* Sound is optional. */ }
  }
  function tone(frequency, at, duration, type = "sine", volume = .055, end = frequency) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), at + duration);
    gain.gain.setValueAtTime(.001, at);
    gain.gain.linearRampToValueAtTime(volume, at + .005);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(at); oscillator.stop(at + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function play(name, stars = 1) {
    if (isMuted() || !context || context.state !== "running") return;
    try {
      const at = context.currentTime;
      if (name === "tick") {
        if (at - lastTick < .035) return;
        lastTick = at; tone(360, at, .028, "triangle", .04, 100);
      } else if (name === "coin") {
        tone(1600, at, .07); tone(2200, at + .055, .1, "sine", .035);
      } else if (name === "roll") {
        [0, .09, .2].forEach((offset) => tone(180, at + offset, .07, "triangle", .035, 65));
      } else if (name === "drop") {
        tone(140, at, .12, "triangle", .08, 45); tone(220, at + .14, .065, "sine", .04, 90);
      } else if (name === "open") {
        tone(650, at, .075, "triangle", .045, 1600);
      } else if (name === "reward") {
        const notes = stars >= 4 ? [523, 659, 784, 1047] : stars === 3 ? [659, 784, 988] : [784, 988];
        notes.forEach((note, index) => tone(note, at + index * .085, .23, "sine", .035));
      }
    } catch { /* Browsers may interrupt the context on backgrounding. */ }
  }
  function suspend() { try { context?.suspend()?.catch(() => {}); } catch { /* optional */ } }
  return { unlock, play, suspend };
}
