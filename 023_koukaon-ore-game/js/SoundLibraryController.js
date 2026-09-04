(function () {
  "use strict";

  class SoundLibraryController {
    constructor(storage, sound, config, hooks = {}) {
      this.storage = storage;
      this.sound = sound;
      this.config = config;
      this.hooks = hooks;
      this.assets = [];
      this.assignments = [];
      this.allAssignments = [];
      this.stats = [];
      this.pack = null;
      this.gameId = config.defaultGameId;
      this.view = "list";
      this.search = "";
      this.tag = "";
      this.favoriteOnly = false;
      this.unusedOnly = false;
      this.sort = "new";
      this.assignmentTarget = null;
      this.detailAssetId = null;
      this.refreshRevision = 0;
      this.selected = new Set();
      this.bound = false;
      this.temporaryBackup = null;
      this.assignmentDraftIds = new Set();
    }

    esc(value) {
      const node = document.createElement("span");
      node.textContent = String(value ?? "");
      return node.innerHTML;
    }
    definition(soundKey) { return this.config.soundCatalog[soundKey]; }
    assignment(soundKey) { return this.assignments.find(item => item.soundKey === soundKey) || null; }
    hasAssignment(soundKey) { return Boolean(this.assignment(soundKey)?.assetIds?.length); }
    asset(assetId) { return this.assets.find(item => item.id === assetId); }
    usages(assetId) { return this.allAssignments.filter(item => item.assetIds?.includes(assetId)); }
    stat(assetId) { return this.stats.find(item => item.assetId === assetId) || { total: 0, games: {} }; }

    async init(pack, gameId) {
      const migration = await this.storage.migrateLegacyRecordings();
      await this.refresh(pack, gameId);
      this.bind();
      return migration;
    }

    async refresh(pack = this.pack, gameId = this.gameId) {
      this.pack = pack;
      const revision = ++this.refreshRevision;
      this.gameId = gameId;
      if (!pack) return;
      const [assets, assignments, allAssignments, stats] = await Promise.all([
        this.storage.getAllSoundAssets(),
        this.storage.getAssignmentsForPack(pack.id),
        this.storage.getAllSoundAssignments(),
        this.storage.getAllSoundStats()
      ]);
      if (revision !== this.refreshRevision) return false;
      this.assets = assets;
      this.assignments = assignments;
      this.allAssignments = allAssignments;
      this.stats = stats;
      this.sound.setAssetLibrary(assets, assignments, gameId);
      this.render();
      this.decorateStudio();
      return true;
    }

    defaultTags(soundKey) {
      const key = String(soundKey || "").toLowerCase();
      const tags = ["声"];
      if (/rhythm|clap|kick|snare|hat/.test(key)) tags.push("リズム");
      if (/explosion|destroy|crash/.test(key)) tags.push("爆発");
      if (/attack|shot|hit/.test(key)) tags.push("攻撃");
      return tags;
    }

    async analyzeBlob(blob) {
      try {
        if (!this.sound.context || this.sound.context.state !== "running") await this.sound.unlock();
        const buffer = await this.sound.context.decodeAudioData(await blob.arrayBuffer());
        const channel = buffer.getChannelData(0);
        const points = 48;
        const waveformData = [];
        let totalSquares = 0;
        let totalSamples = 0;
        let overallPeak = 0;
        for (let point = 0; point < points; point += 1) {
          const start = Math.floor(point * channel.length / points);
          const end = Math.max(start + 1, Math.floor((point + 1) * channel.length / points));
          let peak = 0;
          for (let index = start; index < end; index += 1) {
            const absolute = Math.abs(channel[index]);
            peak = Math.max(peak, absolute);
            overallPeak = Math.max(overallPeak, absolute);
            totalSquares += channel[index] * channel[index];
            totalSamples += 1;
          }
          waveformData.push(Math.round(peak * 100) / 100);
        }
        const rms = totalSamples ? Math.sqrt(totalSquares / totalSamples) : 0;
        const safePeakGain = overallPeak ? .95 / overallPeak : 1;
        const suggestedGain = Math.max(1, Math.min(4, safePeakGain, rms ? .16 / rms : 1));
        return { duration: buffer.duration, waveformData, suggestedGain: Math.round(suggestedGain * 10) / 10 };
      } catch (error) {
        console.warn("Waveform analysis failed", error);
        return { duration: 0, waveformData: [], suggestedGain: 1 };
      }
    }

    async createAsset(blob, options = {}) {
      const analysis = await this.analyzeBlob(blob);
      await this.storage.ensureReady?.();
      const number = String(this.assets.length + 1).padStart(3, "0");
      const asset = {
        id: window.ORE_SOUND_ASSET_ID("asset"),
        name: options.name || "オレ音 " + number,
        blob,
        mimeType: blob.type || "audio/webm",
        duration: analysis.duration,
        waveformData: analysis.waveformData,
        tags: options.tags || [],
        favorite: false,
        volume: analysis.suggestedGain || 1,
        playbackRate: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: options.source || { type: "library" }
      };
      await this.storage.saveSoundAsset(asset);
      this.assets.push(asset);
      return asset;
    }

    async saveSlotRecording(pack, soundKey, blob) {
      const definition = this.definition(soundKey);
      const asset = await this.createAsset(blob, {
        name: definition?.label || soundKey,
        tags: this.defaultTags(soundKey),
        source: { type: "recording", packId: pack.id, soundKey }
      });
      await this.storage.saveSoundAssignment({
        packId: pack.id,
        gameId: this.gameId,
        soundKey,
        assetIds: [asset.id],
        playMode: "fixed"
      });
      await this.refresh(pack, this.gameId);
      return asset;
    }

    async saveLibraryRecording(blob, name, tags = ["声"]) {
      const asset = await this.createAsset(blob, { name: name || undefined, tags });
      await this.refresh();
      return asset;
    }

    async clearAssignment(soundKey) {
      await this.storage.deleteSoundAssignment(this.pack.id, soundKey);
      await this.refresh();
    }

    async copyAssignment(sourceKey, targetKey) {
      const source = this.assignment(sourceKey);
      if (!source) return false;
      await this.storage.saveSoundAssignment({ ...source, packId: this.pack.id, gameId: this.gameId, soundKey: targetKey });
      await this.refresh();
      return true;
    }

    waveform(asset) {
      if (!asset.waveformData?.length) return "";
      return '<span class="asset-wave" aria-hidden="true">' + asset.waveformData.map(value => '<i style="height:' + Math.max(2, Math.round(value * 26)) + 'px"></i>').join("") + "</span>";
    }

    filteredAssets() {
      const used = new Set(this.allAssignments.flatMap(item => item.assetIds || []));
      let values = this.assets.filter(asset => {
        const text = (asset.name + " " + (asset.tags || []).join(" ")).toLowerCase();
        return (!this.search || text.includes(this.search.toLowerCase()))
          && (!this.tag || asset.tags?.includes(this.tag))
          && (!this.favoriteOnly || asset.favorite)
          && (!this.unusedOnly || !used.has(asset.id));
      });
      const usage = asset => this.usages(asset.id).length;
      values.sort((a, b) => this.sort === "old" ? a.createdAt - b.createdAt
        : this.sort === "name" ? a.name.localeCompare(b.name, "ja")
        : this.sort === "usage" ? usage(b) - usage(a)
        : this.sort === "plays" ? this.stat(b.id).total - this.stat(a.id).total
        : this.sort === "favorite" ? Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt
        : b.createdAt - a.createdAt);
      return values;
    }

    async storageInfo() {
      const bytes = this.assets.reduce((sum, asset) => sum + (asset.byteSize || asset.blob?.size || 0), 0);
      let quota = 0, usage = 0;
      try {
        const estimate = await navigator.storage?.estimate?.();
        quota = estimate?.quota || 0;
        usage = estimate?.usage || 0;
      } catch (_) {}
      return { bytes, quota, usage };
    }

    async render() {
      const root = document.querySelector("#soundLibraryList");
      if (!root) return;
      const tags = [...new Set(this.assets.flatMap(asset => asset.tags || []))].sort((a, b) => a.localeCompare(b, "ja"));
      const tagSelect = document.querySelector("#libraryTagFilter");
      if (tagSelect) {
        const current = this.tag;
        tagSelect.innerHTML = '<option value="">すべてのタグ</option>' + tags.map(tag => '<option value="' + this.esc(tag) + '">' + this.esc(tag) + "</option>").join("");
        tagSelect.value = current;
      }
      const values = this.filteredAssets();
      root.className = "asset-grid" + (this.view === "catalog" ? " is-catalog" : "");
      root.innerHTML = values.length ? values.map(asset => {
        const usage = this.usages(asset.id).length;
        const plays = this.stat(asset.id).total || asset.playCount || 0;
        return '<article class="asset-card ' + (asset.favorite ? "is-favorite" : "") + '" data-asset-card="' + asset.id + '">'
          + '<button class="asset-play" type="button" data-asset-play="' + asset.id + '" aria-label="再生">▶</button>'
          + '<div data-asset-detail="' + asset.id + '"><h3>' + (asset.favorite ? '<span class="asset-favorite">★</span> ' : "") + this.esc(asset.name) + '</h3>'
          + '<p>' + (asset.duration ? asset.duration.toFixed(2) + "秒" : "長さ未解析") + " · 使用中 " + usage + "か所 · 累計 " + plays + "回</p>"
          + this.waveform(asset) + '<span class="asset-tags">' + (asset.tags || []).map(tag => "<i>" + this.esc(tag) + "</i>").join("") + "</span></div>"
          + '<label><input type="checkbox" data-asset-select="' + asset.id + '" ' + (this.selected.has(asset.id) ? "checked" : "") + '>選択</label></article>';
      }).join("") : '<p class="library-empty">条件に合うオレ音がありません。<br>「＋ 新しいオレ音」で録音できます。</p>';
      const summary = document.querySelector("#librarySummary");
      if (summary) summary.textContent = values.length + " / " + this.assets.length + " オレ音";
      document.querySelector("#libraryFavoriteFilter")?.classList.toggle("is-active", this.favoriteOnly);
      document.querySelector("#libraryUnusedFilter")?.classList.toggle("is-active", this.unusedOnly);
      document.querySelector("#libraryViewToggle").textContent = this.view === "catalog" ? "☷ リスト表示" : "▦ 図鑑表示";
      this.renderStats();
      const info = await this.storageInfo();
      const storageNode = document.querySelector("#libraryStorage");
      if (storageNode) {
        const own = (info.bytes / 1048576).toFixed(1);
        const browser = info.quota ? " · ブラウザ " + (info.usage / 1048576).toFixed(1) + " / " + (info.quota / 1048576).toFixed(0) + "MB" : "";
        storageNode.textContent = "推定録音容量 " + own + "MB" + browser;
      }
      const banner = document.querySelector("#temporarySoundBanner");
      if (banner) banner.hidden = !this.sound.hasTemporaryAssignments();
    }

    renderStats() {
      const used = new Set(this.allAssignments.flatMap(item => item.assetIds || []));
      const totalPlays = this.stats.reduce((sum, item) => sum + (item.total || 0), 0);
      const statRoot = document.querySelector("#libraryStats");
      if (statRoot) statRoot.innerHTML = "<div><dt>オレ音</dt><dd>" + this.assets.length + "</dd></div><div><dt>使用中</dt><dd>" + used.size + "</dd></div><div><dt>累計再生</dt><dd>" + totalPlays.toLocaleString() + "</dd></div>";
      const ranking = [...this.assets].sort((a, b) => this.stat(b.id).total - this.stat(a.id).total).slice(0, 5);
      const rankRoot = document.querySelector("#libraryRanking");
      if (rankRoot) rankRoot.innerHTML = ranking.length ? ranking.map(asset => "<li>" + this.esc(asset.name) + " <b>" + this.stat(asset.id).total.toLocaleString() + "回</b></li>").join("") : "<li>まだ再生記録がありません</li>";
      const history = [...this.assets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
      const historyRoot = document.querySelector("#libraryHistory");
      if (historyRoot) historyRoot.innerHTML = history.length ? history.map(asset => "<li>" + new Date(asset.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " · " + this.esc(asset.name) + "</li>").join("") : "<li>録音履歴はまだありません</li>";
    }

    decorateStudio() {
      const list = document.querySelector("#soundList");
      if (!list) return;
      list.querySelectorAll("[data-sound-id]").forEach(row => {
        const soundKey = row.dataset.soundId;
        const assignment = this.assignment(soundKey);
        const names = (assignment?.assetIds || []).map(id => this.asset(id)?.name).filter(Boolean);
        let editor = row.querySelector(".assignment-editor");
        if (!editor) {
          editor = document.createElement("div");
          editor.className = "assignment-editor";
          row.appendChild(editor);
        }
        editor.innerHTML = '<small>現在のオレ</small><span class="assignment-assets">' + (names.length ? names.map(name => "<i>" + this.esc(name) + "</i>").join("") : "<i>初期音</i>") + '</span>'
          + '<div class="assignment-controls"><select data-assignment-mode="' + soundKey + '">'
          + [["fixed","固定"],["random","ランダム"],["sequence","順番"],["randomNoRepeat","ランダム（直前と違う）"]].map(([value,label]) => '<option value="' + value + '" ' + ((assignment?.playMode || "fixed") === value ? "selected" : "") + ">" + label + "</option>").join("")
          + '</select><button type="button" data-open-assignment="' + soundKey + '">＋ オレ音を追加</button></div>';
      });
    }

    openAssignment(soundKey) {
      this.assignmentTarget = soundKey;
      const assignment = this.assignment(soundKey);
      this.assignmentDraftIds = new Set(assignment?.assetIds || []);
      document.querySelector("#assignmentTitle").textContent = (this.definition(soundKey)?.label || soundKey) + "へ割り当て";
      document.querySelector("#assignmentMode").value = assignment?.playMode || "fixed";
      document.querySelector("#assignmentSearch").value = "";
      this.renderAssignmentChoices("");
      document.querySelector("#assignmentDialog").hidden = false;
    }

    renderAssignmentChoices(search) {
      const selected = this.assignmentDraftIds;
      const values = this.assets.filter(asset => !search || (asset.name + " " + (asset.tags || []).join(" ")).toLowerCase().includes(search.toLowerCase()));
      document.querySelector("#assignmentAssetList").innerHTML = values.length ? values.map(asset =>
        '<label class="assignment-choice"><input type="checkbox" value="' + asset.id + '" ' + (selected.has(asset.id) ? "checked" : "") + '><span><b>' + this.esc(asset.name) + "</b><small>" + this.esc((asset.tags || []).join(" / ")) + '</small></span><button type="button" data-asset-play="' + asset.id + '">▶</button></label>'
      ).join("") : '<p class="library-empty">選べるオレ音がありません</p>';
    }

    async saveAssignmentDialog() {
      const assetIds = [...this.assignmentDraftIds];
      if (!assetIds.length) {
        await this.storage.deleteSoundAssignment(this.pack.id, this.assignmentTarget);
        const sounds = { ...(this.pack.sounds || {}) };
        delete sounds[this.assignmentTarget];
        this.pack.sounds = sounds;
        await this.storage.savePack(this.pack);
      }
      else await this.storage.saveSoundAssignment({
        packId: this.pack.id, gameId: this.gameId, soundKey: this.assignmentTarget,
        assetIds, playMode: document.querySelector("#assignmentMode").value
      });
      document.querySelector("#assignmentDialog").hidden = true;
      await this.refresh();
      this.hooks.renderAll?.();
    }

    openDetail(assetId) {
      const asset = this.asset(assetId);
      if (!asset) return;
      this.detailAssetId = assetId;
      const usages = this.usages(assetId);
      document.querySelector("#assetDetailName").value = asset.name;
      document.querySelector("#assetDetailTags").value = (asset.tags || []).join(", ");
      document.querySelector("#assetDetailVolume").value = asset.volume ?? 1;
      document.querySelector("#assetDetailRate").value = asset.playbackRate ?? 1;
      document.querySelector("#assetDetailMeta").textContent = (asset.duration ? asset.duration.toFixed(2) + "秒" : "長さ未解析") + " · " + new Date(asset.createdAt).toLocaleString("ja-JP") + " · 累計 " + this.stat(asset.id).total.toLocaleString() + "回";
      document.querySelector("#assetDetailFavorite").textContent = asset.favorite ? "★ お気に入り解除" : "☆ お気に入り";
      document.querySelector("#assetUsageList").innerHTML = usages.length ? usages.map(item => {
        const pack = this.hooks.packs?.().find(entry => entry.id === item.packId);
        return "<li>" + this.esc(pack?.name || item.packId) + " ＞ " + this.esc(this.definition(item.soundKey)?.label || item.soundKey) + "</li>";
      }).join("") : "<li>未使用</li>";
      document.querySelector("#assetDetailDialog").hidden = false;
    }

    async saveDetail() {
      const asset = this.asset(this.detailAssetId);
      if (!asset) return;
      asset.name = document.querySelector("#assetDetailName").value.trim() || asset.name;
      asset.tags = document.querySelector("#assetDetailTags").value.split(/[,、]/).map(value => value.trim()).filter(Boolean);
      asset.volume = Number(document.querySelector("#assetDetailVolume").value) || 1;
      asset.playbackRate = Number(document.querySelector("#assetDetailRate").value) || 1;
      await this.storage.saveSoundAsset(asset);
      document.querySelector("#assetDetailDialog").hidden = true;
      await this.refresh();
      this.hooks.renderAll?.();
    }

    async toggleFavorite(assetId = this.detailAssetId) {
      const asset = this.asset(assetId);
      if (!asset) return;
      asset.favorite = !asset.favorite;
      await this.storage.saveSoundAsset(asset);
      await this.refresh();
      if (!document.querySelector("#assetDetailDialog").hidden) this.openDetail(assetId);
    }
    async unlinkAsset(assetId) {
      const usages = await this.storage.unlinkAndDeleteSoundAsset(assetId);
      for (const assignment of usages) {
        if (assignment.packId !== this.pack?.id || assignment.assetIds.length > 1) continue;
        const sounds = { ...(this.pack.sounds || {}) };
        delete sounds[assignment.soundKey];
        this.pack.sounds = sounds;
      }
      return usages;
    }


    async deleteAsset(assetId = this.detailAssetId) {
      const asset = this.asset(assetId);
      if (!asset) return;
      const usages = this.usages(assetId);
      const list = usages.map(item => (this.definition(item.soundKey)?.label || item.soundKey)).join("、");
      const message = usages.length
        ? "このオレ音は" + usages.length + "か所で使用されています（" + list + "）。使用解除して削除しますか？"
        : "「" + asset.name + "」を削除しますか？";
      if (!confirm(message)) return;
      await this.unlinkAsset(assetId);
      this.selected.delete(assetId);
      document.querySelector("#assetDetailDialog").hidden = true;
      await this.refresh();
      this.hooks.renderAll?.();
    }

    async deleteSelected() {
      if (!this.selected.size) return;
      const usedCount = [...this.selected].filter(id => this.usages(id).length).length;
      if (!confirm(this.selected.size + "件を削除します。" + (usedCount ? "使用中の" + usedCount + "件は割り当ても解除されます。" : ""))) return;
      for (const id of this.selected) await this.unlinkAsset(id);
      this.selected.clear();
      await this.refresh();
      this.hooks.renderAll?.();
    }

    async duplicateAsset() {
      await this.storage.duplicateSoundAsset(this.detailAssetId);
      document.querySelector("#assetDetailDialog").hidden = true;
      await this.refresh();
    }

    async previewAsset(assetId) {
      await this.sound.playAsset(assetId);
      await this.storage.mergeSoundStats({ [assetId]: 1 }, "library");
      const current = this.stat(assetId);
      if (!this.stats.includes(current)) this.stats.push(current);
      current.total = (current.total || 0) + 1;
      current.games = { ...(current.games || {}), library: (current.games?.library || 0) + 1 };
      this.renderStats();
    }

    previewLoop() {
      const button = document.querySelector("#assetDetailLoop");
      if (this.sound.previewSource) {
        try { this.sound.previewSource.stop(); } catch (_) {}
        this.sound.previewSource = null;
        button.textContent = "🔁 ループ確認";
        return;
      }
      this.previewAsset(this.detailAssetId).then(() => {
        if (this.sound.previewSource) this.sound.previewSource.loop = true;
        button.textContent = "■ ループ停止";
      }).catch(this.hooks.error);
    }

    shuffleCurrentGame(assetIds = this.assets.map(asset => asset.id)) {
      if (!assetIds.length) return;
      const temporary = {};
      for (const soundKey of this.config.gameDefinitions[this.gameId].sounds) {
        temporary[soundKey] = { soundKey, assetIds: [assetIds[Math.floor(Math.random() * assetIds.length)]], playMode: "fixed", temporary: true };
      }
      this.sound.setTemporaryAssignments(temporary);
      this.render();
      this.hooks.toast?.("現在のゲームをオレ音シャッフルしました");
    }

    sameAssetEverywhere(assetId) {
      const temporary = {};
      for (const soundKey of this.config.gameDefinitions[this.gameId].sounds) temporary[soundKey] = { soundKey, assetIds: [assetId], playMode: "fixed", temporary: true };
      this.sound.setTemporaryAssignments(temporary);
      document.querySelector("#assetDetailDialog").hidden = true;
      this.render();
      this.hooks.toast?.("全部このオレを一時設定しました");
    }

    undoTemporary() {
      this.sound.clearTemporaryAssignments();
      this.render();
      this.hooks.toast?.("元の割り当てに戻しました");
    }

    async saveTemporary() {
      for (const [soundKey, assignment] of this.sound.temporaryAssignments) {
        await this.storage.saveSoundAssignment({ ...assignment, packId: this.pack.id, gameId: this.gameId, soundKey, temporary: false });
      }
      this.sound.clearTemporaryAssignments();
      await this.refresh();
      this.hooks.renderAll?.();
      this.hooks.toast?.("一時設定を現在のパックへ保存しました");
    }

    async runDiagnostic() {
      const result = await this.storage.diagnoseSoundLibrary();
      document.querySelector("#libraryDiagnosticResult").textContent =
        "SoundAsset: " + result.assets + "\nAssignment: " + result.assignments
        + "\n参照切れ: " + result.broken.length + "\n未使用: " + result.unused.length
        + "\nBlob異常: " + result.blobFailures.length + "\n重複ID: " + result.duplicateIds.length;
    }

    bind() {
      if (this.bound) return;
      this.bound = true;
      document.addEventListener("click", event => {
        const play = event.target.closest("[data-asset-play]");
        if (play) { event.preventDefault(); this.previewAsset(play.dataset.assetPlay).catch(this.hooks.error); return; }
        const detail = event.target.closest("[data-asset-detail]");
        if (detail) { this.openDetail(detail.dataset.assetDetail); return; }
        const assign = event.target.closest("[data-open-assignment]");
        if (assign) { this.openAssignment(assign.dataset.openAssignment); return; }
      });
      document.addEventListener("change", event => {
        if (event.target.matches("[data-assignment-mode]")) {
          const assignment = this.assignment(event.target.dataset.assignmentMode);
          if (assignment) this.storage.saveSoundAssignment({ ...assignment, playMode: event.target.value }).then(() => this.refresh()).catch(this.hooks.error);
        }
        if (event.target.matches("[data-asset-select]")) {
        if (event.target.closest("#assignmentAssetList") && event.target.matches('input[type="checkbox"]')) {
          if (event.target.checked) this.assignmentDraftIds.add(event.target.value);
          else this.assignmentDraftIds.delete(event.target.value);
        }
          if (event.target.checked) this.selected.add(event.target.dataset.assetSelect);
          else this.selected.delete(event.target.dataset.assetSelect);
        }
      });
      document.querySelector("#librarySearch").addEventListener("input", event => { this.search = event.target.value; this.render(); });
      document.querySelector("#libraryTagFilter").addEventListener("change", event => { this.tag = event.target.value; this.render(); });
      document.querySelector("#librarySort").addEventListener("change", event => { this.sort = event.target.value; this.render(); });
      document.querySelector("#libraryFavoriteFilter").addEventListener("click", () => { this.favoriteOnly = !this.favoriteOnly; this.render(); });
      document.querySelector("#libraryUnusedFilter").addEventListener("click", () => { this.unusedOnly = !this.unusedOnly; this.render(); });
      document.querySelector("#libraryViewToggle").addEventListener("click", () => { this.view = this.view === "list" ? "catalog" : "list"; this.render(); });
      document.querySelector("#newLibraryRecordingButton").addEventListener("click", () => {
        const name = prompt("録音名を入力してください（空欄なら自動命名）", "");
        if (name !== null) this.hooks.recordLibrary?.(name.trim());
      });
      document.querySelector("#libraryShuffleButton").addEventListener("click", () => this.shuffleCurrentGame());
      document.querySelector("#libraryDeleteSelected").addEventListener("click", () => this.deleteSelected().catch(this.hooks.error));
      document.querySelector("#temporaryUndoButton").addEventListener("click", () => this.undoTemporary());
      document.querySelector("#temporarySaveButton").addEventListener("click", () => this.saveTemporary().catch(this.hooks.error));
      document.querySelector("#assignmentSearch").addEventListener("input", event => this.renderAssignmentChoices(event.target.value));
      document.querySelector("#assignmentCancel").addEventListener("click", () => { document.querySelector("#assignmentDialog").hidden = true; });
      document.querySelector("#assignmentSave").addEventListener("click", () => this.saveAssignmentDialog().catch(this.hooks.error));
      document.querySelector("#assetDetailClose").addEventListener("click", () => { document.querySelector("#assetDetailDialog").hidden = true; });
      document.querySelector("#assetDetailSave").addEventListener("click", () => this.saveDetail().catch(this.hooks.error));
      document.querySelector("#assetDetailPlay").addEventListener("click", () => this.previewAsset(this.detailAssetId).catch(this.hooks.error));
      document.querySelector("#assetDetailLoop").addEventListener("click", () => this.previewLoop());
      document.querySelector("#assetDetailFavorite").addEventListener("click", () => this.toggleFavorite().catch(this.hooks.error));
      document.querySelector("#assetDetailDuplicate").addEventListener("click", () => this.duplicateAsset().catch(this.hooks.error));
      document.querySelector("#assetDetailDelete").addEventListener("click", () => this.deleteAsset().catch(this.hooks.error));
      document.querySelector("#assetDetailSame").addEventListener("click", () => this.sameAssetEverywhere(this.detailAssetId));
      document.querySelector("#libraryDiagnosticButton").addEventListener("click", () => this.runDiagnostic().catch(this.hooks.error));
    }
  }

  window.SoundLibraryController = SoundLibraryController;
})();
