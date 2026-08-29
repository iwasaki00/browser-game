(function () {
  "use strict";

  class GameManager {
    constructor(soundManager) { this.soundManager = soundManager; this.current = null; }
    startShooter(canvas, settings, onEnd) { this.stop(); this.current = new window.ShooterGame(canvas, this.soundManager, settings, onEnd); return this.current.start(); }
    stop() { this.current?.stop(); this.current = null; }
  }

  window.GameManager = GameManager;
})();
