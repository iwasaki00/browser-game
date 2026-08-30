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
      this.loopStats = {};
      this.loadGeneration = 0;
      this.settings = { ...config.defaultSettings };
      this.currentPack = null;
      this.userActivated = false;
      this.pendingPack = null;
      this.pendingLoadPromise = null;
      this.mediaUnlock = null;
      this.lastUnlockFailed = false;
      const navigatorInfo = window.navigator || {};
      this.requiresGestureContext = /iPad|iPhone|iPod/.test(navigatorInfo.userAgent || "") || (navigatorInfo.platform === "MacIntel" && navigatorInfo.maxTouchPoints > 1);
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

    rebuildContext() {
      this.stopAllLoops();
      const previous = this.context;
      this.context = null;
      this.master = null;
      if (previous?.close) {
        try { const closing = previous.close(); closing?.catch?.(() => {}); }
        catch (error) { console.warn("Could not close the previous AudioContext", error); }
      }
      return this.ensureContext();
    }

    primeContext(context = this.context) {
      if (!context?.createBuffer || !context?.createBufferSource || !this.master) return;
      try {
        const buffer = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.master);
        source.start(0);
      } catch (error) { console.warn("Could not prime AudioContext", error); }
    }

    primeMediaElement() {
      if (typeof window.Audio !== "function") return null;
      try {
        if (!this.mediaUnlock) {
          const audio = new window.Audio();
          audio.preload = "auto";
          audio.playsInline = true;
          audio.volume = 0.01;
          audio.loop = true;
          audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";
          this.mediaUnlock = audio;
        }
        this.mediaUnlock.currentTime = 0;
        return this.mediaUnlock.play();
      } catch (error) { console.warn("Could not prime HTML audio", error); return null; }
    }

    async waitForAudioPromise(promise, milliseconds) {
      if (!promise) return;
      if (typeof setTimeout !== "function") { await promise; return; }
      let timeoutId;
      const timeout = new Promise((resolve) => { timeoutId = setTimeout(resolve, milliseconds); });
      try { await Promise.race([Promise.resolve(promise).catch(() => false), timeout]); }
      finally { clearTimeout(timeoutId); }
    }

    async waitForResume(context, resumePromise, mediaPromise) {
      await this.waitForAudioPromise(resumePromise, 650);
      if (context.state === "running") return;
      await this.waitForAudioPromise(mediaPromise, 650);
      this.primeContext(context);
      const retryPromise = context.resume ? context.resume() : null;
      await this.waitForAudioPromise(retryPromise, 1200);
      if (context.state !== "running") {
        throw new Error(`AudioContext resume timeout (${context.state || "unknown"})`);
      }
    }

    stopMediaUnlock() {
      if (!this.mediaUnlock) return;
      try { this.mediaUnlock.pause(); this.mediaUnlock.currentTime = 0; }
      catch (error) { console.warn("Could not stop HTML audio unlock", error); }
    }

    loadPendingPack() {
      if (!this.pendingPack) return;
      const pending = this.pendingPack;
      this.pendingPack = null;
      this.pendingLoadPromise = this.loadPack(pending.pack, pending.soundIds).catch((error) => console.warn("Could not load deferred audio", error));
    }

    async unlock(forceRestart = false) {
      if (this.unlockPromise) return this.unlockPromise;
      if (this.lastUnlockFailed) forceRestart = true;
      const mediaPromise = this.primeMediaElement();
      this.userActivated = true;
      this.unlockPromise = (async () => {
        if (forceRestart || this.context?.state === "closed") this.rebuildContext();
        const context = this.ensureContext();
        this.primeContext(context);
        const resumePromise = context.state !== "running" && context.resume ? context.resume() : null;
        await this.waitForResume(context, resumePromise, mediaPromise);
        this.applyVolume();
        this.loadPendingPack();
        return context;
      })();
      try { const context = await this.unlockPromise; this.lastUnlockFailed = false; this.stopMediaUnlock(); return context; }
      catch (error) { this.lastUnlockFailed = true; this.stopMediaUnlock(); throw error; }
      finally { this.unlockPromise = null; }
    }

    recover() { return this.unlock(true); }

    applyVolume() { if (this.master) this.master.gain.value = this.settings.masterVolume * this.settings.effectVolume; }
    setSettings(settings) { this.settings = { ...this.settings, ...settings }; this.applyVolume(); }

    async loadPack(pack, soundIds = null) {
      if (this.requiresGestureContext && !this.userActivated && !this.context) {
        this.currentPack = pack;
        this.pendingPack = { pack, soundIds: soundIds ? [...soundIds] : null };
        return false;
      }
      this.ensureContext(); this.stopAllLoops(); const generation=++this.loadGeneration,nextBuffers=new Map(); this.buffers.clear();
      const definitions=soundIds?soundIds.map(id=>this.config.soundCatalog[id]).filter(Boolean):this.config.soundDefinitions;
      await Promise.all(definitions.map(async definition=>{
        const stored=pack.sounds&&pack.sounds[definition.id];if(!stored)return;const blobs=Array.isArray(stored)?stored:[stored];
        const decoded=(await Promise.all(blobs.map(async blob=>{
          try{
            const decoding=this.context.decodeAudioData(await blob.arrayBuffer());
            if(typeof setTimeout!=="function")return await decoding;
            return await Promise.race([
              decoding,
            new Promise((_,reject)=>setTimeout(()=>reject(new Error("Audio decode timeout")),2500))
            ]);
          }catch(error){console.warn(`Could not decode ${definition.id}`,error);return null;}
        }))).filter(Boolean);
        if(decoded.length)nextBuffers.set(definition.id,decoded);
      }));
      if(generation===this.loadGeneration){this.currentPack=pack;this.buffers=nextBuffers;}
      return generation===this.loadGeneration;
    }

    resetPlayStats() { this.counts = {}; this.loopStats = {}; }
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
      if (!id) return false; if(this.loops.has(id)){this.setLoopVolume(id,options.gain??.35);this.setLoopPlaybackRate(id,options.playbackRate??1);return true;}
      await this.unlock(); const entries=this.buffers.get(id); if(!entries?.length)return false;
      this.counts[id]=(this.counts[id]||0)+1; const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=entries[Math.floor(Math.random()*entries.length)];source.loop=true;if(source.playbackRate)source.playbackRate.value=options.playbackRate??1;gain.gain.value=options.gain??.35;source.connect(gain).connect(this.master);
      const loop={source,gain,startedAt:this.context.currentTime};source.onended=()=>{if(this.loops.get(id)===loop)this.loops.delete(id)};this.loops.set(id,loop);source.start();return true;
    }
    setLoopVolume(id,value){const loop=this.loops.get(id);if(loop)loop.gain.gain.value=Math.max(0,Math.min(1,value));}
    setLoopPlaybackRate(id,value){const loop=this.loops.get(id);if(loop?.source.playbackRate)loop.source.playbackRate.value=Math.max(.5,Math.min(2,value));}
    isLoopPlaying(id){return this.loops.has(id);}
    getLoopStats(){const result={...this.loopStats};for(const[id,loop]of this.loops){const old=result[id]||{count:this.counts[id]||0,duration:0};result[id]={count:old.count,duration:old.duration+Math.max(0,this.context.currentTime-loop.startedAt)};}return result;}

    stopLoop(id) {
      const loop = this.loops.get(id);
      if (!loop) return;
      loop.source.onended = null;
      try { loop.source.stop(); } catch (error) { console.warn(`Could not stop loop ${id}`, error); }
      const duration=Math.max(0,this.context.currentTime-loop.startedAt),old=this.loopStats[id]||{count:this.counts[id]||0,duration:0};
      this.loopStats[id]={count:old.count,duration:old.duration+duration};
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
