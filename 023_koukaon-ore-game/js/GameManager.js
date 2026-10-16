(function () {
  "use strict";

  class GameManager {
    constructor(soundManager, definitions) {
      this.soundManager = soundManager;
      this.definitions = definitions;
      this.registry = new Map();
      this.current = null;
      this.currentId = null;
      this.session = 0;
    }

    registerGame(id, GameClass) {
      if (!this.definitions[id]) throw new Error(`Unknown game definition: ${id}`);
      this.registry.set(id, GameClass);
      return this;
    }

    getGameDefinition(id) { return this.definitions[id] || null; }
    getGameDefinitions() { return Object.values(this.definitions).sort((a, b) => a.order - b.order); }

    async startGame(id, canvas, settings, onEnd, options = {}) {
      this.stop();
      const GameClass = this.registry.get(id);
      if (!GameClass) throw new Error(`Game is not registered: ${id}`);
      this.currentId = id;
      const session = this.session;
      let ended = false;
      this.current = new GameClass(canvas, this.soundManager, settings, result => {
        if (session !== this.session || ended) return;
        ended = true; onEnd(result);
      }, options);
      return this.current.start();
    }

    startShooter(canvas, settings, onEnd, options) { return this.startGame("shooter", canvas, settings, onEnd, options); }

    stop() {
      ++this.session;
      this.current?.stop();
      this.current = null;
      this.currentId = null;
    }
  }

  window.GameManager = GameManager;
})();
