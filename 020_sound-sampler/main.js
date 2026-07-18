"use strict";

const DB_NAME = "sound-sampler-db";
const DB_VERSION = 2;
const STORES = { sounds: "sounds", overrides: "overrides", settings: "settings" };
const DEFAULT_COLOR = "#3b82f6";
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#64748b"];
const LONG_PRESS_MS = 600;

const $ = (selector) => document.querySelector(selector);
const uid = () => `user-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
const fileStem = (name) => name.replace(/\.[^.]+$/, "").replaceAll("_", " ");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const withTimeout = (promise, milliseconds, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))
]);

class StorageManager {
  constructor() { this.db = null; this.available = false; }
  async open() {
    if (!window.indexedDB) throw new Error("このブラウザではIndexedDBを利用できません");
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.sounds)) db.createObjectStore(STORES.sounds, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(STORES.overrides)) db.createObjectStore(STORES.overrides, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("データベースが別のタブで使用されています"));
    });
    this.available = true;
  }
  request(storeName, mode, action) {
    if (!this.available) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const request = action(this.db.transaction(storeName, mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  getAll(store) { return this.request(store, "readonly", (s) => s.getAll()); }
  put(store, value) { return this.request(store, "readwrite", (s) => s.put(value)); }
  delete(store, key) { return this.request(store, "readwrite", (s) => s.delete(key)); }
  clear(store) { return this.request(store, "readwrite", (s) => s.clear()); }
  async getSetting(key, fallback) {
    const record = await this.request(STORES.settings, "readonly", (s) => s.get(key));
    return record?.value ?? fallback;
  }
  setSetting(key, value) { return this.put(STORES.settings, { key, value }); }
}

class AudioManager {
  constructor() { this.context = null; this.master = null; this.sources = new Set(); this.loops = new Map(); }
  async start(volume) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio APIに対応していません");
    this.context ||= new AudioContextClass();
    if (!this.master) { this.master = this.context.createGain(); this.master.connect(this.context.destination); }
    this.setMasterVolume(volume);
    await this.resume();
  }
  async resume() { if (this.context?.state === "suspended") await this.context.resume(); }
  setMasterVolume(value) { if (this.master) this.master.gain.setValueAtTime(Number(value), this.context.currentTime); }
  async decode(data) { return withTimeout(this.context.decodeAudioData(data.slice ? data.slice(0) : data), 15000, "音声デコードがタイムアウトしました"); }
  createSource(sound, looping = false) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = sound.audioBuffer;
    source.loop = looping;
    source.playbackRate.value = sound.playbackRate;
    gain.gain.value = sound.volume;
    source.connect(gain).connect(this.master);
    this.sources.add(source);
    source.addEventListener("ended", () => { this.sources.delete(source); if (this.loops.get(sound.id) === source) this.loops.delete(sound.id); }, { once: true });
    return source;
  }
  async play(sound) {
    await this.resume();
    if (!sound.audioBuffer) throw new Error("音声を読み込めませんでした");
    if (sound.loop) {
      const current = this.loops.get(sound.id);
      if (current) { current.stop(); this.loops.delete(sound.id); return false; }
      const source = this.createSource(sound, true); this.loops.set(sound.id, source); source.start(); return true;
    }
    const source = this.createSource(sound); source.start(); return true;
  }
  stopSound(id) { const source = this.loops.get(id); if (source) { try { source.stop(); } catch (_) {} this.loops.delete(id); } }
  stopAll() { for (const source of this.sources) { try { source.stop(); } catch (_) {} } this.sources.clear(); this.loops.clear(); }
}

class RecordingManager {
  constructor(onMeter) { this.onMeter = onMeter; this.stream = null; this.recorder = null; this.chunks = []; this.timer = null; this.startedAt = 0; this.analyserFrame = 0; }
  mimeType() {
    const options = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    return options.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
  }
  async start(onTick, onAutoStop) {
    if (!window.isSecureContext) throw new Error("マイク録音にはHTTPS接続が必要です");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("この環境ではマイク録音を利用できません");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    const type = this.mimeType();
    this.recorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
    this.recorder.start(100);
    this.startedAt = Date.now();
    this.timer = setInterval(() => { const seconds = Math.floor((Date.now() - this.startedAt) / 1000); onTick(seconds); if (seconds >= 30) onAutoStop(); }, 250);
    this.startMeter();
  }
  startMeter() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = context.createAnalyser(); analyser.fftSize = 256;
    context.createMediaStreamSource(this.stream).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => { analyser.getByteFrequencyData(values); this.onMeter(Math.max(...values) / 255); this.analyserFrame = requestAnimationFrame(draw); };
    draw(); this.meterContext = context;
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === "inactive") return resolve(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType || "audio/webm" });
        this.cleanup(); resolve(blob);
      };
      this.recorder.stop();
    });
  }
  cancel() { if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop(); this.cleanup(); }
  cleanup() { clearInterval(this.timer); cancelAnimationFrame(this.analyserFrame); this.stream?.getTracks().forEach((track) => track.stop()); this.meterContext?.close(); this.stream = null; }
}

class SamplerApp {
  constructor() {
    this.storage = new StorageManager(); this.audio = new AudioManager();
    this.recording = new RecordingManager((level) => { $("#recordMeter").style.width = `${Math.round(level * 100)}%`; });
    this.rhythm = new RhythmManager(this.audio, { onBeat: (beat) => this.showBeat(beat), onStep: (step) => this.showRhythmStep(step), onState: (playing) => this.showRhythmState(playing) });
    this.sounds = []; this.defaults = new Map(); this.category = "すべて"; this.editing = false; this.pendingFiles = []; this.recordBlob = null; this.statusTimer = null;
    this.rhythmReady = false; this.tapTimes = [];
  }
  async init() {
    this.bindUI(); this.renderColorPresets();
    $("#startButton").addEventListener("click", () => this.start());
  }
  bindUI() {
    $("#stopButton").addEventListener("click", () => this.stopEverything());
    $("#masterVolume").addEventListener("input", (e) => { const value = Number(e.target.value); $("#masterVolumeValue").value = `${Math.round(value * 100)}%`; this.audio.setMasterVolume(value); this.storage.setSetting("masterVolume", value); });
    $("#addButton").addEventListener("click", () => $("#fileInput").click());
    $("#fileInput").addEventListener("change", (e) => this.prepareFiles(e.target.files));
    $("#editButton").addEventListener("click", () => this.toggleEdit());
    $("#statusClose").addEventListener("click", () => $("#status").hidden = true);
    $("#settingsDialog").addEventListener("close", () => { if ($("#settingsDialog").returnValue === "save") this.savePadSettings(); });
    $("#settingVolume").addEventListener("input", (e) => $("#settingVolumeValue").value = `${Math.round(e.target.value * 100)}%`);
    $("#settingRate").addEventListener("input", (e) => $("#settingRateValue").value = `${Number(e.target.value).toFixed(1)}×`);
    $("#resetColorButton").addEventListener("click", () => { const sound = this.find($("#settingId").value); $("#settingColor").value = sound.defaultData?.color || DEFAULT_COLOR; });
    $("#resetPadButton").addEventListener("click", () => this.resetPad($("#settingId").value));
    $("#deletePadButton").addEventListener("click", () => this.deletePad($("#settingId").value));
    document.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => this.movePad($("#settingId").value, button.dataset.move)));
    $("#addDialog").addEventListener("close", () => { if ($("#addDialog").returnValue === "save") this.addPendingFiles(); });
    $("#recordButton").addEventListener("click", () => this.openRecorder());
    $("#recordStart").addEventListener("click", () => this.startRecording());
    $("#recordStop").addEventListener("click", () => this.stopRecording());
    $("#recordCancel").addEventListener("click", () => this.closeRecorder());
    $("#recordClose").addEventListener("click", () => this.closeRecorder());
    $("#recordRetry").addEventListener("click", () => this.resetRecorder());
    $("#recordSave").addEventListener("click", () => this.saveRecording());
    $("#dataButton").addEventListener("click", () => this.openData());
    $("#rhythmButton").addEventListener("click", () => this.openRhythmScreen());
    $("#rhythmBack").addEventListener("click", () => this.closeRhythmScreen());
    $("#rhythmStart").addEventListener("click", () => this.startRhythm());
    $("#rhythmStop").addEventListener("click", () => { this.rhythm.stop(); this.rhythmMessage("リズムを停止しました"); });
    $("#tapTempo").addEventListener("click", () => this.tapTempo());
    $("#bpm").addEventListener("input", (event) => { this.rhythm.config.bpm = Number(event.target.value); $("#bpmValue").value = event.target.value; this.saveRhythmConfig(); });
    $("#rhythmPattern").addEventListener("change", (event) => { this.rhythm.config.pattern = event.target.value; $("#sequencerSection").hidden = event.target.value !== "custom"; this.renderSequencer(); this.saveRhythmConfig(); });
    for (const [id, key] of [["rhythmVolume","volume"],["drumVolume","drumVolume"],["bassVolume","bassVolume"]]) $("#" + id).addEventListener("input", (event) => { this.rhythm.config[key] = Number(event.target.value); $("#" + id + "Value").value = `${Math.round(event.target.value * 100)}%`; this.rhythm.updateGains(); this.saveRhythmConfig(); });
    for (const [id, key] of [["drumEnabled","drumEnabled"],["bassEnabled","bassEnabled"],["countIn","countIn"],["ducking","ducking"]]) $("#" + id).addEventListener("change", (event) => { this.rhythm.config[key] = event.target.checked; this.saveRhythmConfig(); });
    $("#bassNote").addEventListener("change", (event) => { this.rhythm.config.bassNote = event.target.value; this.saveRhythmConfig(); });
    $("#clearSequence").addEventListener("click", () => this.clearSequence());
    $("[data-close=dataDialog]").addEventListener("click", () => $("#dataDialog").close());
    $("#exportButton").addEventListener("click", () => this.exportSettings());
    $("#importInput").addEventListener("change", (e) => this.importSettings(e.target.files[0]));
    $("#deleteUploadsButton").addEventListener("click", () => this.deleteByType("uploaded"));
    $("#deleteRecordingsButton").addEventListener("click", () => this.deleteByType("recorded"));
    $("#resetSettingsButton").addEventListener("click", () => this.resetAllSettings());
    $("#resetAllButton").addEventListener("click", () => this.resetAllData());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.stopEverything(false); });
  }
  async start() {
    const button = $("#startButton"); button.disabled = true; button.textContent = "読み込み中…";
    $("#loadProgress").hidden = false;
    try {
      this.updateLoadingProgress(0, 0, "音声機能を開始しています", "AudioContextを有効化中…");
      await this.audio.start(.8);
      this.updateLoadingProgress(0, 0, "保存データを確認しています", "IndexedDBを読み込み中…");
      try { await withTimeout(this.storage.open(), 8000, "保存データの読み込みがタイムアウトしました"); } catch (error) { console.warn("IndexedDB:", error); this.status("保存機能を利用できないため、一時利用モードで起動します", true, true); }
      const volume = await this.storage.getSetting("masterVolume", .8); $("#masterVolume").value = volume; $("#masterVolumeValue").value = `${Math.round(volume * 100)}%`;
      this.category = await this.storage.getSetting("lastCategory", "すべて");
      this.audio.setMasterVolume(volume);
      const result = await this.loadSounds();
      this.updateLoadingProgress(result.loaded + result.failed, result.loaded + result.failed, "リズム機能を準備しています", "バックリズム音源を確認中…");
      const rhythmConfig = await this.storage.getSetting("rhythmConfig", {});
      const rhythmResult = await this.rhythm.init(rhythmConfig); this.rhythmReady = true; this.setupRhythmUI();
      if (rhythmResult.fallback.length) { console.info(`内蔵リズム音を使用: ${rhythmResult.fallback.join(", ")}`); this.rhythmMessage("専用音源がないトラックは内蔵リズム音で再生します"); }
      this.updateLoadingProgress(result.loaded + result.failed, result.loaded + result.failed, "読み込み完了", `${result.loaded}件成功・${result.failed}件失敗`);
      $("#startScreen").hidden = true; $("#app").hidden = false;
      this.render();
      const storageNote = this.storage.available ? "" : "／保存機能なし（一時利用モード）";
      this.status(`音声機能を開始しました：${result.loaded}件成功、${result.failed}件失敗${storageNote}`, result.failed > 0 || !this.storage.available, result.failed > 0 || !this.storage.available);
    } catch (error) { console.error(error); button.disabled = false; button.textContent = "もう一度試す"; this.updateLoadingProgress(0, 0, "開始できませんでした", error.message); this.showStartError(error.message); }
  }
  showStartError(message) { const note = document.querySelector(".start-card small"); note.textContent = message; note.style.color = "#fecdd3"; }
  updateLoadingProgress(current, total, label, detail) {
    $("#loadProgressText").textContent = label;
    $("#loadProgressCount").textContent = total ? `${current} / ${total}` : "準備中";
    $("#loadProgressBar").max = Math.max(total, 1);
    $("#loadProgressBar").value = total ? current : 0;
    $("#loadProgressDetail").textContent = detail || "";
  }
  async loadSounds() {
    this.sounds = []; this.defaults.clear();
    let definitions = [];
    this.updateLoadingProgress(0, 0, "音源一覧を取得しています", "sounds.json");
    try { const response = await withTimeout(fetch("assets/sounds/sounds.json"), 10000, "音源一覧の取得がタイムアウトしました"); if (!response.ok) throw new Error(`HTTP ${response.status}`); definitions = await response.json(); if (!Array.isArray(definitions)) throw new Error("配列ではありません"); }
    catch (error) { console.error("sounds.jsonを読み込めません", error); this.status("デフォルト音源一覧を読み込めませんでした", true, true); }
    const overrides = new Map((await this.storage.getAll(STORES.overrides) || []).map((item) => [item.id, item]));
    definitions.forEach((definition, order) => {
      const base = this.normalize({ ...definition, sourceType: "default", fileName: definition.file, order });
      base.defaultData = { ...base }; Object.assign(base, overrides.get(base.id) || {}); base.defaultData = this.normalize({ ...definition, sourceType: "default", fileName: definition.file, order }); this.defaults.set(base.id, base.defaultData); this.sounds.push(base);
    });
    const saved = await this.storage.getAll(STORES.sounds) || [];
    saved.forEach((record, index) => {
      const id = typeof record.id === "number" ? `legacy-${record.id}` : record.id;
      this.sounds.push(this.normalize({ ...record, id, dbKey: record.id, sourceType: record.sourceType || "uploaded", fileName: record.fileName || record.name, displayName: record.displayName || record.name, blob: record.blob, order: record.order ?? definitions.length + index }));
    });
    this.sortSounds();
    let loaded = 0, failed = 0;
    const total = this.sounds.length;
    this.updateLoadingProgress(0, total, "効果音を読み込んでいます", "開始します…");
    let cursor = 0, completed = 0;
    const worker = async () => {
      while (cursor < total) {
        const sound = this.sounds[cursor++];
        try { await this.loadOneSound(sound); loaded++; }
        catch (error) { sound.loadFailed = true; failed++; console.error(`音声読み込み失敗: ${sound.fileName}`, error); }
        completed++;
        this.updateLoadingProgress(completed, total, "効果音を読み込んでいます", `${sound.fileName}${sound.loadFailed ? "（読み込み失敗・続行します）" : ""}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, total) }, () => worker()));
    return { loaded, failed };
  }
  async loadOneSound(sound) {
    let data;
    if (sound.sourceType === "default") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`assets/sounds/${encodeURIComponent(sound.fileName)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.arrayBuffer();
      } finally { clearTimeout(timer); }
    } else {
      if (!sound.blob) throw new Error("保存された音声データがありません");
      data = await withTimeout(sound.blob.arrayBuffer(), 10000, "保存音源の読み込みがタイムアウトしました");
    }
    sound.audioBuffer = await this.audio.decode(data);
  }
  normalize(sound) { return { id: sound.id || uid(), dbKey: sound.dbKey ?? sound.id, sourceType: sound.sourceType || "uploaded", fileName: sound.fileName || sound.file || "sound", displayName: sound.displayName || sound.name || fileStem(sound.fileName || sound.file || "sound"), category: sound.category || "未分類", color: sound.color || DEFAULT_COLOR, favorite: Boolean(sound.favorite), loop: Boolean(sound.loop), volume: Number(sound.volume ?? 1), playbackRate: Number(sound.playbackRate ?? 1), order: Number(sound.order ?? this.sounds.length), blob: sound.blob || null, audioBuffer: sound.audioBuffer || null, loadFailed: Boolean(sound.loadFailed) }; }
  find(id) { return this.sounds.find((sound) => sound.id === id); }
  sortSounds() { this.sounds.sort((a, b) => a.order - b.order); this.sounds.forEach((sound, index) => sound.order = index); }
  render() { this.renderCategories(); this.renderPads(); }
  categories() { return [...new Set(this.sounds.map((sound) => sound.category || "未分類"))].sort((a, b) => a.localeCompare(b, "ja")); }
  renderCategories() {
    const categories = ["すべて", "お気に入り", "未分類", ...this.categories().filter((value) => value !== "未分類")];
    if (!categories.includes(this.category)) this.category = "すべて";
    $("#categoryTabs").replaceChildren(...categories.map((category) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `category-tab${category === this.category ? " active" : ""}`; button.textContent = category;
      button.addEventListener("click", () => { this.category = category; this.storage.setSetting("lastCategory", category); this.render(); }); return button;
    }));
    $("#categoryList").replaceChildren(...this.categories().map((category) => Object.assign(document.createElement("option"), { value: category })));
  }
  visibleSounds() { return this.sounds.filter((sound) => this.category === "すべて" || (this.category === "お気に入り" ? sound.favorite : (sound.category || "未分類") === this.category)); }
  renderPads() {
    const visible = this.visibleSounds(); const fragment = document.createDocumentFragment();
    visible.forEach((sound) => fragment.append(this.createPad(sound))); $("#padGrid").replaceChildren(fragment);
    $("#soundCount").textContent = `${visible.length} / ${this.sounds.length} sounds`; $("#emptyState").hidden = visible.length > 0;
  }
  createPad(sound) {
    const pad = document.createElement("article"); pad.className = `pad${sound.loadFailed ? " failed" : ""}${this.audio.loops.has(sound.id) ? " looping" : ""}`; pad.style.setProperty("--pad-color", sound.color); pad.style.setProperty("--pad-text", this.textColor(sound.color));
    const main = document.createElement("button"); main.type = "button"; main.className = "pad-main"; main.setAttribute("aria-label", `${sound.displayName}を再生`);
    const typeBadge = sound.sourceType === "recorded" ? "REC" : sound.sourceType === "uploaded" ? "ADD" : "";
    main.innerHTML = `<span class="pad-top"><span class="pad-badges">${typeBadge ? `<span class="badge">${typeBadge}</span>` : ""}${sound.loop ? '<span class="badge">LOOP</span>' : ""}</span></span><span><strong class="pad-name"></strong><small class="pad-file"></small></span><span class="pad-category"></span>`;
    main.querySelector(".pad-name").textContent = sound.displayName; main.querySelector(".pad-file").textContent = sound.fileName; main.querySelector(".pad-file").title = sound.fileName; main.querySelector(".pad-category").textContent = sound.category;
    pad.append(main);
    if (this.editing) {
      const favorite = document.createElement("button"); favorite.type = "button"; favorite.className = `favorite-button${sound.favorite ? " active" : ""}`; favorite.textContent = "★"; favorite.setAttribute("aria-label", `${sound.displayName}のお気に入りを切り替え`); favorite.addEventListener("click", (event) => { event.stopPropagation(); this.toggleFavorite(sound); });
      pad.append(favorite);
    }
    this.bindPadGesture(main, sound, pad); pad.addEventListener("contextmenu", (event) => event.preventDefault()); return pad;
  }
  bindPadGesture(button, sound, pad) {
    let timer, startX, startY, longPressed = false;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); startX = event.clientX; startY = event.clientY; longPressed = false; timer = setTimeout(() => { longPressed = true; navigator.vibrate?.(25); this.openSettings(sound.id); }, LONG_PRESS_MS); });
    button.addEventListener("pointermove", (event) => { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 14) clearTimeout(timer); });
    const finish = () => { clearTimeout(timer); if (!longPressed) this.editing ? this.openSettings(sound.id) : this.play(sound, pad); longPressed = false; };
    button.addEventListener("pointerup", finish); button.addEventListener("pointercancel", () => clearTimeout(timer));
  }
  async play(sound, pad) { try { this.rhythm.duck(); const active = await this.audio.play(sound); pad.classList.toggle("looping", sound.loop && active); if (!sound.loop) { pad.classList.add("playing"); setTimeout(() => pad.classList.remove("playing"), 130); } } catch (error) { console.error(error); this.status(`${sound.displayName}を再生できません`, true, true); } }
  textColor(hex) { const value = hex.replace("#", ""); const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#07111a" : "#ffffff"; }
  async toggleFavorite(sound) { sound.favorite = !sound.favorite; await this.persistSound(sound); this.render(); }
  toggleEdit() { this.editing = !this.editing; $("#editButton").classList.toggle("active", this.editing); $("#editButton").setAttribute("aria-pressed", this.editing); $("#editButton").textContent = this.editing ? "完了" : "編集"; $("#editBanner").hidden = !this.editing; this.renderPads(); }
  renderColorPresets() { $("#colorPresets").replaceChildren(...COLORS.map((color) => { const button = document.createElement("button"); button.type = "button"; button.className = "color-preset"; button.style.setProperty("--color", color); button.setAttribute("aria-label", color); button.addEventListener("click", () => $("#settingColor").value = color); return button; })); }
  openSettings(id) {
    const sound = this.find(id); if (!sound) return;
    $("#settingId").value = id; $("#settingName").value = sound.displayName; $("#settingFile").textContent = sound.fileName; $("#settingCategory").value = sound.category; $("#settingColor").value = sound.color; $("#settingFavorite").checked = sound.favorite; $("#settingLoop").checked = sound.loop; $("#settingVolume").value = sound.volume; $("#settingVolumeValue").value = `${Math.round(sound.volume * 100)}%`; $("#settingRate").value = sound.playbackRate; $("#settingRateValue").value = `${sound.playbackRate.toFixed(1)}×`; $("#deletePadButton").hidden = sound.sourceType === "default"; $("#settingsDialog").showModal();
  }
  async savePadSettings() {
    const sound = this.find($("#settingId").value); if (!sound) return;
    Object.assign(sound, { displayName: $("#settingName").value.trim() || sound.fileName, category: $("#settingCategory").value.trim() || "未分類", color: $("#settingColor").value, favorite: $("#settingFavorite").checked, loop: $("#settingLoop").checked, volume: Number($("#settingVolume").value), playbackRate: Number($("#settingRate").value) });
    if (!sound.loop) this.audio.stopSound(sound.id); await this.persistSound(sound); this.render(); this.status("パッド設定を保存しました");
  }
  serializable(sound, includeBlob = true) { const { audioBuffer, loadFailed, defaultData, ...data } = sound; if (!includeBlob) delete data.blob; return data; }
  async persistSound(sound) {
    if (sound.sourceType === "default") await this.storage.put(STORES.overrides, this.serializable(sound, false));
    else {
      if (sound.dbKey != null && sound.dbKey !== sound.id) await this.storage.delete(STORES.sounds, sound.dbKey);
      sound.dbKey = sound.id;
      await this.storage.put(STORES.sounds, this.serializable(sound));
    }
  }
  async resetPad(id) { const sound = this.find(id); if (!sound || !confirm("このパッドの設定を初期化しますか？")) return; this.audio.stopSound(id); if (sound.sourceType === "default") { const buffer = sound.audioBuffer, failed = sound.loadFailed; Object.assign(sound, this.defaults.get(id), { audioBuffer: buffer, loadFailed: failed }); await this.storage.delete(STORES.overrides, id); } else { Object.assign(sound, { displayName: fileStem(sound.fileName), category: "未分類", color: DEFAULT_COLOR, favorite: false, loop: false, volume: 1, playbackRate: 1 }); await this.persistSound(sound); } $("#settingsDialog").close(); this.render(); this.status("設定を初期化しました"); }
  async deletePad(id) { const sound = this.find(id); if (!sound || sound.sourceType === "default" || !confirm(`「${sound.displayName}」を削除しますか？`)) return; this.audio.stopSound(id); await this.storage.delete(STORES.sounds, sound.dbKey ?? sound.id); this.sounds = this.sounds.filter((item) => item.id !== id); $("#settingsDialog").close(); this.render(); this.status("音源を削除しました"); }
  async movePad(id, direction) { this.sortSounds(); const index = this.sounds.findIndex((sound) => sound.id === id); if (index < 0) return; let target = direction === "first" ? 0 : direction === "last" ? this.sounds.length - 1 : clamp(index + (direction === "prev" ? -1 : 1), 0, this.sounds.length - 1); const [sound] = this.sounds.splice(index, 1); this.sounds.splice(target, 0, sound); this.sounds.forEach((item, order) => item.order = order); await Promise.all(this.sounds.map((item) => this.persistSound(item))); this.render(); }
  prepareFiles(fileList) { this.pendingFiles = [...fileList]; if (!this.pendingFiles.length) return; const first = this.pendingFiles[0]; $("#addFileSummary").textContent = this.pendingFiles.length === 1 ? first.name : `${first.name} ほか${this.pendingFiles.length - 1}件`; $("#addName").value = this.pendingFiles.length === 1 ? fileStem(first.name) : ""; $("#addDialog").showModal(); $("#fileInput").value = ""; }
  async addPendingFiles() {
    if (!this.storage.available) return this.status("一時利用モードでは音源を保存できません", true, true);
    let added = 0, failed = 0;
    for (const [index, file] of this.pendingFiles.entries()) {
      try {
        const buffer = await this.audio.decode(await file.arrayBuffer());
        const sound = this.normalize({ id: uid(), sourceType: "uploaded", fileName: file.name, displayName: index === 0 && $("#addName").value.trim() ? $("#addName").value.trim() : fileStem(file.name), category: $("#addCategory").value.trim() || "未分類", color: $("#addColor").value, favorite: $("#addFavorite").checked, loop: $("#addLoop").checked, blob: file, audioBuffer: buffer, order: this.sounds.length });
        await this.persistSound(sound); this.sounds.push(sound); added++;
      } catch (error) { console.error(`追加失敗: ${file.name}`, error); failed++; }
    }
    this.pendingFiles = []; this.render(); this.status(`${added}件追加しました${failed ? `（${failed}件失敗）` : ""}`, failed > 0, failed > 0);
  }
  setupRhythmUI() {
    const config = this.rhythm.config;
    $("#rhythmPattern").replaceChildren(...Object.entries(RHYTHM_PATTERNS).map(([value, pattern]) => Object.assign(document.createElement("option"), { value, textContent: pattern.name })));
    $("#rhythmPattern").value = config.pattern; $("#bpm").value = config.bpm; $("#bpmValue").value = config.bpm;
    for (const [id, key] of [["rhythmVolume","volume"],["drumVolume","drumVolume"],["bassVolume","bassVolume"]]) { $("#" + id).value = config[key]; $("#" + id + "Value").value = `${Math.round(config[key] * 100)}%`; }
    for (const [id, key] of [["drumEnabled","drumEnabled"],["bassEnabled","bassEnabled"],["countIn","countIn"],["ducking","ducking"]]) $("#" + id).checked = config[key];
    $("#bassNote").value = config.bassNote; $("#sequencerSection").hidden = config.pattern !== "custom";
    const labels = { kick: "KICK", snare: "SNARE", hihat: "HI-HAT", clap: "CLAP", bass: "BASS", metronome: "CLICK" };
    $("#trackControls").replaceChildren(...Object.entries(labels).map(([track, label]) => {
      const box = document.createElement("div"); box.className = "track-control";
      const row = document.createElement("label"), enabled = document.createElement("input"), name = document.createElement("span"), range = document.createElement("input");
      enabled.type = "checkbox"; enabled.checked = config.trackEnabled[track] !== false; name.textContent = label; range.type = "range"; range.min = "0"; range.max = "1"; range.step = ".01"; range.value = config.trackVolumes[track] ?? 1;
      enabled.addEventListener("change", () => { config.trackEnabled[track] = enabled.checked; this.saveRhythmConfig(); });
      range.addEventListener("input", () => { config.trackVolumes[track] = Number(range.value); this.rhythm.updateGains(); this.saveRhythmConfig(); });
      row.append(name, enabled); box.append(row, range); return box;
    }));
    this.renderSequencer();
  }
  openRhythmScreen() { $("#app").hidden = true; $("#rhythmScreen").hidden = false; window.scrollTo(0, 0); }
  closeRhythmScreen() { $("#rhythmScreen").hidden = true; $("#app").hidden = false; window.scrollTo(0, 0); this.renderPads(); }
  async startRhythm() {
    if (!this.rhythmReady) return this.rhythmMessage("リズム機能をまだ準備できていません", true);
    try { await this.rhythm.start(); this.rhythmMessage(this.rhythm.config.countIn ? "4拍のカウントイン後に開始します" : "バックリズムを開始しました"); }
    catch (error) { console.error(error); this.rhythmMessage(`リズムを開始できません：${error.message}`, true); }
  }
  stopEverything(showStatus = true) { this.audio.stopAll(); this.rhythm.stop(); this.renderPads(); if (showStatus) this.status("パッド、ループ、バックリズムをすべて停止しました"); }
  showRhythmState(playing) { $("#rhythmStart").classList.toggle("active", playing); $("#rhythmStart").textContent = playing ? "▶ 再生中" : "▶ リズム開始"; $("#rhythmRunningBadge").hidden = !playing; }
  showBeat(beat) { document.querySelectorAll(".beat-lamps i").forEach((lamp, index) => lamp.classList.toggle("active", index === beat)); }
  showRhythmStep(step) { document.querySelectorAll(".seq-step").forEach((cell) => cell.classList.toggle("current", Number(cell.dataset.step) === step)); }
  rhythmMessage(message, error = false) { $("#rhythmStatus").textContent = message; $("#rhythmStatus").classList.toggle("error", error); }
  saveRhythmConfig() { this.storage.setSetting("rhythmConfig", this.rhythm.config).catch((error) => console.warn("リズム設定を保存できません", error)); }
  tapTempo() {
    const now = performance.now(); if (this.tapTimes.length && now - this.tapTimes[this.tapTimes.length - 1] > 2000) this.tapTimes = [];
    this.tapTimes.push(now); this.tapTimes = this.tapTimes.slice(-8); if (this.tapTimes.length < 2) return this.rhythmMessage("続けてTAPしてください");
    const intervals = this.tapTimes.slice(1).map((time, index) => time - this.tapTimes[index]);
    const bpm = clamp(Math.round(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length)), 60, 200);
    this.rhythm.config.bpm = bpm; $("#bpm").value = bpm; $("#bpmValue").value = bpm; this.saveRhythmConfig(); this.rhythmMessage(`タップテンポ：${bpm} BPM`);
  }
  renderSequencer() {
    const pattern = RHYTHM_PATTERNS.custom, tracks = [["kick","KICK"],["snare","SNARE"],["hihat","HI-HAT"],["clap","CLAP"],["bass","BASS"]], fragment = document.createDocumentFragment();
    for (const [track, label] of tracks) {
      const heading = document.createElement("span"); heading.className = "seq-label"; heading.textContent = label; fragment.append(heading);
      for (let step = 0; step < 16; step++) { const button = document.createElement("button"); button.type = "button"; button.className = `seq-step${pattern[track][step] ? " on" : ""}`; button.dataset.step = step; button.setAttribute("aria-label", `${label} ステップ${step + 1}`); button.addEventListener("click", () => { pattern[track][step] = pattern[track][step] ? 0 : 1; button.classList.toggle("on", Boolean(pattern[track][step])); this.rhythm.config.customPattern = pattern; this.saveRhythmConfig(); }); fragment.append(button); }
    }
    $("#sequencer").replaceChildren(fragment);
  }
  clearSequence() { if (!confirm("カスタムパターンをすべて消去しますか？")) return; for (const track of ["kick","snare","hihat","clap","bass"]) RHYTHM_PATTERNS.custom[track] = Array(16).fill(0); this.rhythm.config.customPattern = RHYTHM_PATTERNS.custom; this.renderSequencer(); this.saveRhythmConfig(); }
  openDialog(dialog) {
    try {
      if (typeof dialog.showModal === "function") { dialog.showModal(); return; }
    } catch (error) { console.warn("ネイティブダイアログを開けません。フォールバック表示を使用します", error); }
    dialog.setAttribute("open", ""); dialog.classList.add("fallback-open");
    const backdrop = document.createElement("div"); backdrop.className = "dialog-fallback-backdrop"; backdrop.dataset.forDialog = dialog.id;
    document.body.append(backdrop);
  }
  closeDialog(dialog) {
    if (dialog.classList.contains("fallback-open")) { dialog.removeAttribute("open"); dialog.classList.remove("fallback-open"); document.querySelector(`[data-for-dialog="${dialog.id}"]`)?.remove(); }
    else if (typeof dialog.close === "function" && dialog.open) dialog.close();
  }
  openRecorder() {
    try { this.resetRecorder(); this.openDialog($("#recordDialog")); }
    catch (error) { console.error("録音画面を開けません", error); this.status(`録音画面を開けません：${error.message}`, true, true); }
  }
  resetRecorder() { this.recording.cancel(); if (this.recordBlob) URL.revokeObjectURL($("#recordAudio").src); this.recordBlob = null; $("#recordIdle").hidden = false; $("#recordActive").hidden = true; $("#recordPreview").hidden = true; $("#recordTimer").textContent = "00:00"; }
  async startRecording() {
    try { await this.recording.start((seconds) => $("#recordTimer").textContent = `00:${String(seconds).padStart(2, "0")}`, () => this.stopRecording()); $("#recordIdle").hidden = true; $("#recordActive").hidden = false; }
    catch (error) { console.error(error); this.status(error.name === "NotAllowedError" ? "マイクの使用が許可されませんでした。iPhoneの設定でブラウザのマイク権限を確認してください" : error.message, true, true); this.closeDialog($("#recordDialog")); }
  }
  async stopRecording() { if ($("#recordActive").hidden) return; this.recordBlob = await this.recording.stop(); $("#recordActive").hidden = true; $("#recordPreview").hidden = false; $("#recordAudio").src = URL.createObjectURL(this.recordBlob); }
  closeRecorder() { this.resetRecorder(); this.closeDialog($("#recordDialog")); }
  async saveRecording() {
    if (!this.recordBlob || !this.storage.available) return this.status("録音音源を保存できません", true, true);
    try {
      const extension = this.recordBlob.type.includes("mp4") ? "m4a" : this.recordBlob.type.includes("ogg") ? "ogg" : "webm";
      const sound = this.normalize({ id: uid(), sourceType: "recorded", fileName: `recording-${Date.now()}.${extension}`, displayName: $("#recordName").value.trim() || "録音音源", category: $("#recordCategory").value.trim() || "録音", color: $("#recordColor").value, favorite: $("#recordFavorite").checked, loop: $("#recordLoop").checked, blob: this.recordBlob, audioBuffer: await this.audio.decode(await this.recordBlob.arrayBuffer()), order: this.sounds.length });
      await this.persistSound(sound); this.sounds.push(sound); this.closeRecorder(); this.render(); this.status("録音音源を保存しました");
    } catch (error) { console.error(error); this.status("録音音源のデコードまたは保存に失敗しました", true, true); }
  }
  async openData() { $("#dataDialog").showModal(); let usage = 0; if (navigator.storage?.estimate) { const estimate = await navigator.storage.estimate(); usage = estimate.usage || 0; } else usage = this.sounds.reduce((sum, sound) => sum + (sound.blob?.size || 0), 0); $("#storageUsage").textContent = `${(usage / 1024 / 1024).toFixed(2)} MB`; }
  async exportSettings() { const data = { version: 1, exportedAt: new Date().toISOString(), settings: await this.storage.getAll(STORES.settings) || [], overrides: await this.storage.getAll(STORES.overrides) || [], userSettings: this.sounds.filter((s) => s.sourceType !== "default").map((s) => this.serializable(s, false)) }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "sound-sampler-settings.json" }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  async importSettings(file) { if (!file) return; try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.settings) || !Array.isArray(data.overrides)) throw new Error("形式が不正です"); await Promise.all(data.settings.map((item) => this.storage.put(STORES.settings, item))); await Promise.all(data.overrides.map((item) => this.storage.put(STORES.overrides, item))); if (Array.isArray(data.userSettings)) { for (const imported of data.userSettings) { const sound = this.find(imported.id); if (sound && sound.sourceType !== "default") { Object.assign(sound, imported, { blob: sound.blob, audioBuffer: sound.audioBuffer }); await this.persistSound(sound); } } } this.status("設定をインポートしました。再読み込みすると反映されます"); } catch (error) { console.error(error); this.status("設定ファイルを読み込めませんでした", true, true); } }
  async deleteByType(type) { const label = type === "recorded" ? "録音音源" : "追加音源"; if (!confirm(`${label}をすべて削除しますか？`)) return; const targets = this.sounds.filter((s) => s.sourceType === type); await Promise.all(targets.map((s) => this.storage.delete(STORES.sounds, s.dbKey ?? s.id))); this.sounds = this.sounds.filter((s) => s.sourceType !== type); this.render(); this.status(`${label}を削除しました`); }
  async resetAllSettings() { if (!confirm("すべてのパッド設定を初期化しますか？")) return; await this.storage.clear(STORES.overrides); for (const sound of this.sounds) { this.audio.stopSound(sound.id); if (sound.sourceType === "default") { const buffer = sound.audioBuffer, failed = sound.loadFailed; Object.assign(sound, this.defaults.get(sound.id), { audioBuffer: buffer, loadFailed: failed }); } else { Object.assign(sound, { displayName: fileStem(sound.fileName), category: "未分類", color: DEFAULT_COLOR, favorite: false, loop: false, volume: 1, playbackRate: 1 }); await this.persistSound(sound); } } this.render(); this.status("パッド設定を初期化しました"); }
  async resetAllData() { if (!confirm("追加・録音音源と設定をすべて削除しますか？この操作は元に戻せません。")) return; this.stopEverything(false); await Promise.all(Object.values(STORES).map((store) => this.storage.clear(store))); location.reload(); }
  status(message, error = false, persistent = false) { clearTimeout(this.statusTimer); $("#statusText").textContent = message; $("#status").classList.toggle("error", error); $("#status").hidden = false; if (!persistent) this.statusTimer = setTimeout(() => $("#status").hidden = true, 4500); }
}

new SamplerApp().init();
