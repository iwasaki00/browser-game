(() => {
  "use strict";
  class GameManager {
    constructor(elements) {
      this.elements = elements; this.scores = [0, 0]; this.currentGame = null; this.countdownTimers = [];
      this.audioContext = null; this.muted = false;
      this.debug = new URLSearchParams(location.search).get("debug") === "1";
      elements.debugPanel.hidden = !this.debug;
    }
    launchSumo() {
      this.resumeAudio(); this.elements.menuScreen.hidden = true; this.elements.gameScreen.hidden = false; this.elements.resultPanel.hidden = true;
      this.createGame(); requestAnimationFrame(() => { this.currentGame.resize(); this.beginCountdown(); });
    }
    createGame() {
      if (this.currentGame) this.currentGame.destroy();
      this.currentGame = new window.SumoGame({
        canvas: this.elements.canvas, controls: [this.elements.p1Control, this.elements.p2Control],
        energyBars: [this.elements.p1Energy, this.elements.p2Energy], dangers: [this.elements.dangerLeft, this.elements.dangerRight],
        debugPanel: this.elements.debugPanel, debug: this.debug,
        onTapSound: (power, player) => this.playTap(power, player), onImpactSound: (power) => this.playImpact(power),
        onFinish: (winner, reason) => this.showResult(winner, reason)
      });
    }
    beginCountdown() {
      this.clearCountdown(); this.currentGame.reset();
      ["3", "2", "1", "START!"].forEach((step, index) => {
        const timer = window.setTimeout(() => {
          this.elements.countdown.textContent = step; this.elements.countdown.classList.remove("pop"); void this.elements.countdown.offsetWidth;
          this.elements.countdown.classList.add("pop"); this.playCount(step === "START!");
          if (step === "START!") { this.currentGame.start(); this.countdownTimers.push(window.setTimeout(() => { this.elements.countdown.textContent = ""; }, 570)); }
        }, index * 680);
        this.countdownTimers.push(timer);
      });
    }
    clearCountdown() { this.countdownTimers.forEach(window.clearTimeout); this.countdownTimers = []; this.elements.countdown.textContent = ""; }
    showResult(winner, reason) {
      this.scores[winner - 1] += 1; this.updateScore(); this.elements.resultTitle.textContent = `PLAYER ${winner} WIN!`;
      this.elements.resultTitle.style.color = winner === 1 ? "var(--cyan)" : "var(--coral)"; this.elements.resultReason.textContent = reason; this.playWin(winner);
      window.setTimeout(() => { this.elements.resultPanel.hidden = false; this.elements.replayButton.focus({ preventScroll: true }); }, 420);
    }
    replay() { this.resumeAudio(); this.elements.resultPanel.hidden = true; this.createGame(); requestAnimationFrame(() => { this.currentGame.resize(); this.beginCountdown(); }); }
    showMenu() {
      this.clearCountdown(); if (this.currentGame) { this.currentGame.destroy(); this.currentGame = null; }
      this.scores = [0, 0]; this.updateScore(); this.elements.gameScreen.hidden = true; this.elements.resultPanel.hidden = true; this.elements.menuScreen.hidden = false;
      this.elements.sumoCard.focus({ preventScroll: true });
    }
    updateScore() { this.elements.p1Score.textContent = this.scores[0]; this.elements.p2Score.textContent = this.scores[1]; }
    toggleMute() {
      this.muted = !this.muted; const symbol = this.muted ? "×" : "♪"; const label = this.muted ? "音を出す" : "音をミュート";
      [this.elements.muteButton, this.elements.menuMuteButton].forEach((button) => { button.textContent = symbol; button.setAttribute("aria-label", label); });
      if (!this.muted) this.resumeAudio();
    }
    resumeAudio() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return;
      if (!this.audioContext) this.audioContext = new AudioContextClass(); if (this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
    }
    tone(frequency, duration, type = "sine", volume = .05, delay = 0) {
      if (this.muted || !this.audioContext) return; const now = this.audioContext.currentTime + delay;
      const oscillator = this.audioContext.createOscillator(); const gain = this.audioContext.createGain(); oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now); gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(this.audioContext.destination); oscillator.start(now); oscillator.stop(now + duration);
    }
    playTap(power, player) { this.resumeAudio(); this.tone((player === 0 ? 150 : 132) + power * 28, .055, "triangle", .035); }
    playImpact(power) { this.tone(76 + power * 22, .13, "square", .025); }
    playCount(start) { this.tone(start ? 470 : 270, start ? .18 : .08, "square", .035); }
    playWin(winner) {
      const base = winner === 1 ? 440 : 392; [0, 4, 7, 12].forEach((step, index) => this.tone(base * (2 ** (step / 12)), .16, "triangle", .04, index * .09));
      if (navigator.vibrate) navigator.vibrate([35, 35, 70]);
    }
  }
  window.GameManager = GameManager;
})();
