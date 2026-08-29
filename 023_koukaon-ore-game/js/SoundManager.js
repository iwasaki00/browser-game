(function () {
  "use strict";

  class SoundManager {
    constructor(config) {
      this.config = config;
      this.context = null;
      this.master = null;
      this.buffers = new Map();
      this.counts = {};
      this.loops = new Map();
      this.settings = { ...config.defaultSettings };
      this.currentPack = null;
    }

    ensureContext() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio API is not supported");
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      this.applyVolume();
      return this.context;
    }

    async unlock(forceRestart = false) {
      if (this.unlockPromise) return this.unlockPromise;
      this.unlockPromise = (async () => {
        this.ensureContext();
        if (forceRestart && this.context.state === "running" && this.context.suspend) await this.context.suspend();
        if (this.context.state !== "running") await this.context.resume();
        this.applyVolume();
        return this.context;
      })();
      try { return await this.unlockPromise; }
      finally { this.unlockPromise = null; }
    }

    recover() { return this.unlock(true); }

    applyVolume() { if (this.master) this.master.gain.value = this.settings.masterVolume * this.settings.effectVolume; }
    setSettings(settings) { this.settings = { ...this.settings, ...settings }; this.applyVolume(); }

    async loadPack(pack, soundIds = null) {
      this.ensureContext();
      this.stopAllLoops();
      this.currentPack = pack;
      this.buffers.clear();
      const definitions = soundIds ? soundIds.map((id) => this.config.soundCatalog[id]).filter(Boolean) : this.config.soundDefinitions;
      for (const definition of definitions) {
        const stored = pack.sounds && pack.sounds[definition.id];
        if (!stored) continue;
        const blobs = Array.isArray(stored) ? stored : [stored];
        const decoded = [];
        for (const blob of blobs) {
          try { decoded.push(await this.context.decodeAudioData(await blob.arrayBuffer())); }
          catch (error) { console.warn(`Could not decode ${definition.id}`, error); }
        }
        if (decoded.length) this.buffers.set(definition.id, decoded);
      }
    }

    resetPlayStats() { this.counts = {}; }
    getPlayStats() { return { ...this.counts }; }
    resetCounts() { this.resetPlayStats(); }
    getCounts() { return this.getPlayStats(); }
    getLoadedBufferCount() { return [...this.buffers.values()].reduce((sum, entries) => sum + entries.length, 0); }

    async play(id, options = {}) {
      this.counts[id] = (this.counts[id] || 0) + 1;
      await this.unlock();
      const entries = this.buffers.get(id);
      if (entries?.length) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = entries[Math.floor(Math.random() * entries.length)];
        gain.gain.value = options.gain ?? 1;
        source.connect(gain).connect(this.master);
        source.start();
        return;
      }
      this.playFallback(id, options.gain ?? 1);
    }

    async startLoop(id, options = {}) {
      if (!id) return false;
      this.stopLoop(id);
      await this.unlock();
      const entries = this.buffers.get(id);
      if (!entries?.length) return false;
      this.counts[id] = (this.counts[id] || 0) + 1;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = entries[Math.floor(Math.random() * entries.length)];
      source.loop = true;
      gain.gain.value = options.gain ?? .35;
      source.connect(gain).connect(this.master);
      const loop = { source, gain };
      source.onended = () => { if (this.loops.get(id) === loop) this.loops.delete(id); };
      this.loops.set(id, loop);
      source.start();
      return true;
    }

    stopLoop(id) {
      const loop = this.loops.get(id);
      if (!loop) return;
      loop.source.onended = null;
      try { loop.source.stop(); } catch (error) { console.warn(`Could not stop loop ${id}`, error); }
      this.loops.delete(id);
    }

    stopAllLoops() {
      [...this.loops.keys()].forEach((id) => this.stopLoop(id));
    }

    playFallback(id, gainValue) {
      const profiles = {
        shot:[620,180,.09,"square"],enemyShot:[220,420,.12,"sawtooth"],enemyDestroy:[260,80,.17,"square"],explosion:[110,34,.35,"sawtooth"],damage:[150,72,.24,"square"],item:[520,1040,.28,"sine"],boss:[95,48,.7,"sawtooth"],gameOver:[260,65,.8,"triangle"],clear:[440,990,.75,"sine"],
        actionJump:[330,720,.18,"square"],actionLand:[105,55,.15,"triangle"],actionAttack:[480,120,.14,"sawtooth"],actionEnemyHit:[210,85,.1,"square"],actionEnemyDestroy:[310,70,.25,"sawtooth"],actionDamage:[135,68,.28,"square"],actionItem:[570,1140,.3,"sine"],actionFall:[380,42,.85,"sawtooth"],actionCheckpoint:[420,840,.42,"sine"],actionClear:[440,1320,.8,"sine"],actionGameOver:[240,48,.9,"triangle"],actionDash:[220,760,.13,"sawtooth"],actionPowerUp:[280,1240,.55,"square"],
        puzzleSwap:[410,610,.08,"square"],puzzleInvalid:[150,90,.2,"sawtooth"],puzzleMatch:[520,760,.12,"sine"],puzzleChain2:[560,850,.2,"sine"],puzzleChain3:[620,980,.28,"square"],puzzleChain4:[700,1180,.36,"sawtooth"],puzzleChain5:[760,1520,.6,"square"],puzzleSpecialCreate:[420,1060,.35,"sine"],puzzleSpecialActivate:[150,42,.42,"sawtooth"],puzzleBigClear:[100,28,.65,"sawtooth"],puzzleItem:[650,1300,.3,"sine"],puzzleWarning:[260,180,.45,"square"],puzzleClear:[520,1560,.8,"sine"],puzzleGameOver:[250,45,.9,"triangle"]
      };
      const [start,end,duration,type] = profiles[id] || profiles.shot;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      gain.gain.setValueAtTime(Math.max(.001, .18 * gainValue), now);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now); oscillator.stop(now + duration);
    }
  }

  window.SoundManager = SoundManager;
})();
