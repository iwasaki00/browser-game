(() => {
  "use strict";
  class GameManager {
    constructor(elements) {
      this.elements = elements; this.scores = [0, 0]; this.currentGame = null; this.countdownTimers = [];
      this.currentGameKey = "sumo";
      this.audioContext = null; this.muted = false;
      const params = new URLSearchParams(location.search);
      this.debug = params.get("debug") === "1";
      this.testMode = params.get("test") === "1";
      this.testSpeed = 1;
      elements.debugPanel.hidden = !this.debug;
      this.syncTestModeButtons();
      this.syncTestSpeedButton();
    }
    launchSumo() {
      this.launch("sumo");
    }
    launchTugOfWar() {
      this.launch("tug");
    }
    launchBombPush() {
      this.launch("bomb");
    }
    launchWobbleBoxing() {
      this.launch("boxing");
    }
    launch(gameKey) {
      this.currentGameKey = gameKey; this.configureGameScreen();
      this.resumeAudio(); this.elements.menuScreen.hidden = true; this.elements.gameScreen.hidden = false; this.elements.resultPanel.hidden = true;
      this.createGame(); requestAnimationFrame(() => { this.currentGame.resize(); this.beginCountdown(); });
    }
    configureGameScreen() {
      this.elements.debugPanel.hidden = !this.debug;
      this.elements.testModeButton.hidden = this.currentGameKey !== "boxing";
      this.elements.testSpeedButton.hidden = this.currentGameKey !== "boxing" || !this.testMode;
      if (this.currentGameKey === "boxing") {
        this.elements.debugPanel.hidden = !(this.debug || this.testMode);
        this.elements.gameScreen.dataset.game = "boxing";
        this.elements.gameScreen.setAttribute("aria-label", "\u3088\u308d\u3088\u308d\u30dc\u30af\u30b7\u30f3\u30b0 \u5bfe\u6226\u753b\u9762");
        this.elements.canvas.setAttribute("aria-label", "横から見たリングで向かい合う2体のロボットボクサー");
        this.elements.controlActions.forEach((element) => { element.textContent = "JOINTS"; });
        this.elements.energyNames.forEach((element) => { element.textContent = "HP"; });
        this.elements.centerBadge.textContent = "FIGHT";
        return;
      }
      if (this.currentGameKey === "bomb") {
        this.elements.gameScreen.dataset.game = "bomb";
        this.elements.gameScreen.setAttribute("aria-label", "\u7206\u5f3e\u62bc\u3057\u4ed8\u3051 \u5bfe\u6226\u753b\u9762");
        this.elements.canvas.setAttribute("aria-label", "\u7206\u5f3e\u3092\u76f8\u624b\u5074\u3078\u62bc\u3057\u8fd4\u3059\u7af6\u6280\u5834");
        this.elements.controlActions.forEach((element) => { element.textContent = "PUSH!"; });
        this.elements.energyNames.forEach((element) => { element.textContent = "CHARGE"; });
        this.elements.centerBadge.textContent = "BOMB";
        return;
      }
      const tug = this.currentGameKey === "tug"; const action = tug ? "ひっぱれ！" : "トントン！"; const energyName = tug ? "STAMINA" : "POWER";
      this.elements.gameScreen.dataset.game = this.currentGameKey;
      this.elements.gameScreen.setAttribute("aria-label", tug ? "綱引きバトル 対戦画面" : "トントン相撲DX 対戦画面");
      this.elements.canvas.setAttribute("aria-label", tug ? "2人が上下から綱を引く競技場" : "2人の力士が押し合う土俵");
      this.elements.controlActions.forEach((element) => { element.textContent = action; });
      this.elements.energyNames.forEach((element) => { element.textContent = energyName; });
      this.elements.centerBadge.textContent = tug ? "PULL" : "VS";
    }
    createGame() {
      if (this.currentGame) this.currentGame.destroy();
      const tug = this.currentGameKey === "tug";
      const bomb = this.currentGameKey === "bomb";
      const boxing = this.currentGameKey === "boxing";
      const GameClass = boxing ? window.WobbleBoxingGame : bomb ? window.BombPushGame : tug ? window.TugOfWarGame : window.SumoGame;
      this.currentGame = new GameClass({
        canvas: this.elements.canvas, controls: [this.elements.p1Control, this.elements.p2Control],
        spriteUrls: bomb ? undefined : tug
          ? ["./assets/tug-puller-cyan.webp", "./assets/tug-puller-coral.webp"]
          : ["./assets/rikishi-cyan.webp", "./assets/rikishi-coral.webp"],
        spriteUrl: boxing ? "./assets/sideview-boxer-torso.png" : bomb ? "./assets/bomb-topdown.png" : undefined,
        jointButtons: this.elements.jointButtons,
        energyBars: [this.elements.p1Energy, this.elements.p2Energy], dangers: [this.elements.dangerLeft, this.elements.dangerRight],
        debugPanel: this.elements.debugPanel, debug: this.debug, testMode: boxing && this.testMode, gameSpeed: this.testSpeed,
        centerRivet: this.elements.centerBadge.parentElement,
        onTapSound: (power, player) => this.playTap(power, player), onImpactSound: (power) => this.playImpact(power),
        onGoodSound: (player) => this.playGood(player),
        onChargeSound: (player) => this.playCharge(player),
        onFuseSound: (progress) => this.playFuse(progress),
        onExplosionSound: () => this.playExplosion(),
        onPunchSound: (power, head) => this.playPunch(power, head),
        onBlockSound: () => this.playBlock(),
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
      if (winner === 0) {
        this.elements.resultTitle.textContent = "DRAW!"; this.elements.resultTitle.style.color = "var(--gold)"; this.playCount(true);
      } else {
        this.scores[winner - 1] += 1; this.updateScore(); this.elements.resultTitle.textContent = `PLAYER ${winner} WIN!`;
        this.elements.resultTitle.style.color = winner === 1 ? "var(--cyan)" : "var(--coral)"; this.playWin(winner);
      }
      this.elements.resultReason.textContent = reason;
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
    toggleTestMode() {
      this.testMode = !this.testMode;
      this.syncTestModeButtons();
      if (!this.currentGame || this.currentGameKey !== "boxing") return;
      this.currentGame.testMode = this.testMode;
      this.elements.debugPanel.hidden = !(this.debug || this.testMode);
      this.elements.testSpeedButton.hidden = !this.testMode;
      this.currentGame.updateHud();
      this.currentGame.render();
    }
    syncTestModeButtons() {
      const label = this.testMode ? "TEST ON" : "TEST OFF";
      const ariaLabel = this.testMode ? "テストモードを無効にする" : "テストモードを有効にする";
      [this.elements.testModeButton, this.elements.menuTestModeButton].forEach((button) => {
        button.textContent = label;
        button.setAttribute("aria-pressed", String(this.testMode));
        button.setAttribute("aria-label", ariaLabel);
      });
    }
    cycleTestSpeed() {
      const speeds = [1, .5, .25];
      const index = speeds.indexOf(this.testSpeed);
      this.testSpeed = speeds[(index + 1) % speeds.length];
      this.syncTestSpeedButton();
      if (this.currentGame && this.currentGameKey === "boxing") {
        this.currentGame.gameSpeed = this.testSpeed;
        this.currentGame.updateHud();
      }
    }
    syncTestSpeedButton() {
      const label = this.testSpeed === 1 ? "1.0x" : `${this.testSpeed}x`;
      this.elements.testSpeedButton.textContent = label;
      this.elements.testSpeedButton.setAttribute("aria-label", `テスト速度 ${label}`);
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
    playGood(player) { this.resumeAudio(); this.tone(player === 0 ? 560 : 510, .08, "sine", .035); this.tone(player === 0 ? 720 : 660, .09, "triangle", .025, .055); }
    playImpact(power) { this.tone(76 + power * 22, .13, "square", .025); }
    playCharge(player) { this.resumeAudio(); this.tone(player === 0 ? 92 : 82, .2, "sawtooth", .05); this.tone(58, .24, "square", .035, .035); }
    playFuse(progress) { this.resumeAudio(); this.tone(1250 + progress * 720, .035, "square", .018); }
    playExplosion() { this.resumeAudio(); this.tone(52, .48, "sawtooth", .12); this.tone(34, .62, "square", .08, .02); }
    playPunch(power, head) { this.resumeAudio(); this.tone((head ? 210 : 105) + power * 90, .11, head ? "square" : "triangle", .045 + power * .035); }
    playBlock() { this.resumeAudio(); this.tone(720, .055, "square", .028); this.tone(430, .07, "triangle", .022, .02); }
    playCount(start) { this.tone(start ? 470 : 270, start ? .18 : .08, "square", .035); }
    playWin(winner) {
      const base = winner === 1 ? 440 : 392; [0, 4, 7, 12].forEach((step, index) => this.tone(base * (2 ** (step / 12)), .16, "triangle", .04, index * .09));
      if (navigator.vibrate) navigator.vibrate([35, 35, 70]);
    }
  }
  window.GameManager = GameManager;
})();
