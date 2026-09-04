(function () {
  "use strict";

  const BaseSoundManager = window.SoundManager;

  class LibrarySoundManager extends BaseSoundManager {
    constructor(config) {
      super(config);
      this.soundAssets = new Map();
      this.soundAssignments = new Map();
      this.assetBuffers = new Map();
      this.temporaryAssignments = new Map();
      this.sequencePositions = new Map();
      this.lastAssetSelections = new Map();
      this.assetCounts = {};
      this.assetBreakdown = {};
      this.currentGameId = config.defaultGameId;
      this.previewSource = null;
      this.lastSoundPlayAt = new Map();
    }

    setAssetLibrary(assets, assignments, gameId) {
      this.soundAssets = new Map((assets || []).map(asset => [asset.id, asset]));
      this.soundAssignments = new Map((assignments || []).map(item => [item.soundKey, item]));
      this.currentGameId = gameId || this.currentGameId;
    }

    setTemporaryAssignments(assignments) {
      this.temporaryAssignments = new Map(Object.entries(assignments || {}));
    }
    clearTemporaryAssignments() { this.temporaryAssignments.clear(); }
    hasTemporaryAssignments() { return this.temporaryAssignments.size > 0; }

    assignmentFor(soundKey) {
      return this.temporaryAssignments.get(soundKey) || this.soundAssignments.get(soundKey) || null;
    }

    chooseAssetId(soundKey) {
      const assignment = this.assignmentFor(soundKey);
      const ids = (assignment?.assetIds || []).filter(id => this.soundAssets.has(id));
      if (!ids.length) return null;
      const mode = assignment.playMode || "fixed";
      let selected = ids[0];
      if (mode === "sequence") {
        const position = this.sequencePositions.get(soundKey) || 0;
        selected = ids[position % ids.length];
        this.sequencePositions.set(soundKey, position + 1);
      } else if (mode === "random" || mode === "randomNoRepeat") {
        const previous = this.lastAssetSelections.get(soundKey);
        const choices = mode === "randomNoRepeat" && ids.length > 1 ? ids.filter(id => id !== previous) : ids;
        selected = choices[Math.floor(Math.random() * choices.length)];
      }
      this.lastAssetSelections.set(soundKey, selected);
      return selected;
    }

    async decodeAsset(assetId) {
      if (this.assetBuffers.has(assetId)) return this.assetBuffers.get(assetId);
      const asset = this.soundAssets.get(assetId);
      if (!asset?.blob) return null;
      try {
        const buffer = await this.context.decodeAudioData(await asset.blob.arrayBuffer());
        this.assetBuffers.set(assetId, buffer);
        return buffer;
      } catch (error) {
        console.warn("Could not decode SoundAsset " + assetId, error);
        return null;
      }
    }

    async loadPack(pack, soundIds = null) {
      const loaded = await super.loadPack(pack, soundIds);
      if (loaded === false) return false;
      const ids = soundIds || this.config.soundDefinitions.map(item => item.id);
      const needed = new Set();
      for (const soundKey of ids) {
        const assignment = this.assignmentFor(soundKey);
        for (const assetId of assignment?.assetIds || []) needed.add(assetId);
      }
      await Promise.all([...needed].map(assetId => this.decodeAsset(assetId)));
      return loaded;
    }

    resetPlayStats() {
      super.resetPlayStats();
      this.assetCounts = {};
      this.assetBreakdown = {};
    }
    getAssetPlayStats() { return { ...this.assetCounts }; }
    getAssetBreakdown() {
      return Object.fromEntries(Object.entries(this.assetBreakdown).map(([key, counts]) => [key, { ...counts }]));
    }
    getAssetCacheCount() { return this.assetBuffers.size; }

    countAsset(soundKey, assetId) {
      this.assetCounts[assetId] = (this.assetCounts[assetId] || 0) + 1;
      if (!this.assetBreakdown[soundKey]) this.assetBreakdown[soundKey] = {};
      this.assetBreakdown[soundKey][assetId] = (this.assetBreakdown[soundKey][assetId] || 0) + 1;
    }

    playDecoded(buffer, options = {}) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      if (source.playbackRate) source.playbackRate.value = options.playbackRate || 1;
      gain.gain.value = options.gain ?? 1;
      source.connect(gain).connect(this.master);
      source.start();
      return source;
    }

    canPlayNow(id) {
      const interval = Number(this.config.soundCatalog?.[id]?.minInterval) || 0;
      if (!interval) return true;
      const now = Date.now();
      const previous = this.lastSoundPlayAt.get(id) || 0;
      if (now - previous < interval) return false;
      this.lastSoundPlayAt.set(id, now);
      return true;
    }

    async play(id, options = {}) {
      if (!this.context || this.context.state !== "running") await this.unlock();
      if (!this.canPlayNow(id)) return false;
      const assetId = this.chooseAssetId(id);
      const buffer = assetId ? (this.assetBuffers.get(assetId) || await this.decodeAsset(assetId)) : null;
      if (!buffer) return super.play(id, options);
      this.counts[id] = (this.counts[id] || 0) + 1;
      this.countAsset(id, assetId);
      this.playDecoded(buffer, {
        ...options,
        playbackRate: options.playbackRate || this.soundAssets.get(assetId)?.playbackRate || 1,
        gain: (options.gain ?? 1) * (this.soundAssets.get(assetId)?.volume ?? 1)
      });
      return assetId;
    }

    async playAsset(assetId, options = {}) {
      if (!this.context || this.context.state !== "running") await this.unlock();
      const buffer = this.assetBuffers.get(assetId) || await this.decodeAsset(assetId);
      if (!buffer) throw new Error("オレ音を再生できません");
      if (options.exclusive !== false && this.previewSource) {
        try { this.previewSource.stop(); } catch (_) {}
      }
      this.assetCounts[assetId] = (this.assetCounts[assetId] || 0) + 1;
      this.previewSource = this.playDecoded(buffer, {
        gain: (options.gain ?? 1) * (this.soundAssets.get(assetId)?.volume ?? 1),
        playbackRate: this.soundAssets.get(assetId)?.playbackRate || 1
      });
      this.previewSource.onended = () => { this.previewSource = null; };
      return assetId;
    }

    async startLoop(id, options = {}) {
      if (!id) return false;
      if (this.loops.has(id)) {
        this.setLoopVolume(id, options.gain ?? .35);
        this.setLoopPlaybackRate(id, options.playbackRate ?? 1);
        return true;
      }
      if (!this.context || this.context.state !== "running") await this.unlock();
      const assetId = this.chooseAssetId(id);
      const buffer = assetId ? (this.assetBuffers.get(assetId) || await this.decodeAsset(assetId)) : null;
      if (!buffer) return super.startLoop(id, options);
      this.counts[id] = (this.counts[id] || 0) + 1;
      this.countAsset(id, assetId);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      if (source.playbackRate) source.playbackRate.value = options.playbackRate ?? 1;
      const assetVolume = this.soundAssets.get(assetId)?.volume ?? 1;
      gain.gain.value = (options.gain ?? .35) * assetVolume;
      source.connect(gain).connect(this.master);
      const loop = { source, gain, assetId, assetVolume, startedAt: this.context.currentTime };
      source.onended = () => { if (this.loops.get(id) === loop) this.loops.delete(id); };
      this.loops.set(id, loop);
      source.start();
      return true;
    }

    setLoopVolume(id, value) {
      const loop = this.loops.get(id);
      if (loop) loop.gain.gain.value = Math.max(0, Math.min(1, value)) * (loop.assetVolume ?? 1);
    }
  }

  window.SoundManager = LibrarySoundManager;
})();
