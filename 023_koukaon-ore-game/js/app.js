(function () {
  "use strict";

  const config = window.ORE_CONFIG;
  const storage = new window.StorageManager(config);
  const sound = new window.SoundManager(config);
  const recorder = new window.RecorderManager(sound);
  const games = new window.GameManager(sound);
  const state = { packs: [], currentPack: null, settings: { ...config.defaultSettings }, recordingId: null, pendingBlob: null, errors: [], bestScore: 0 };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = $$(".screen");

  function showScreen(id) {
    games.stop();
    screens.forEach((screen) => { screen.hidden = screen.id !== id; });
    $("#bottomNav").hidden = id === "gameScreen" || id === "recordScreen";
    $$(`[data-nav]`).forEach((button) => button.classList.toggle("is-active", button.dataset.nav === id));
    window.scrollTo(0, 0);
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 2300);
  }

  function logError(error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    state.errors.unshift(`${new Date().toLocaleTimeString()} ${message}`);
    state.errors = state.errors.slice(0, 8);
    console.error(error);
  }

  function micErrorMessage(error) {
    const insecure = !window.isSecureContext;
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    const busy = error?.name === "NotReadableError";
    return {
      title: "マイクを使用できませんでした",
      body: insecure ? "録音にはHTTPSまたはlocalhostで開く必要があります。" : denied ? "Safariのサイト設定でマイクを許可して、もう一度お試しください。" : busy ? "別のアプリがマイクを使用している可能性があります。閉じてからお試しください。" : "マイクの接続とブラウザの許可設定を確認してください。",
      detail: `${error?.name || "UnknownError"}: ${error?.message || "No details"}`
    };
  }

  function showError(error) {
    logError(error);
    const info = micErrorMessage(error);
    $("#errorTitle").textContent = info.title;
    $("#errorMessage").textContent = info.body;
    $("#errorDetail").textContent = info.detail;
    $("#errorDialog").hidden = false;
  }

  async function loadState() {
    state.packs = (await storage.getAllPacks()).sort((a, b) => a.createdAt - b.createdAt);
    const currentId = await storage.getState("currentPackId", config.defaultPackId);
    state.currentPack = state.packs.find((pack) => pack.id === currentId) || state.packs[0];
    state.settings = { ...config.defaultSettings, ...(await storage.getState("settings", {})) };
    state.bestScore = await storage.getState("bestScore", 0);
    sound.setSettings(state.settings);
    await sound.loadPack(state.currentPack);
    renderAll();
  }

  function recordedCount(pack = state.currentPack) {
    return config.soundDefinitions.filter((definition) => pack?.sounds?.[definition.id]).length;
  }

  function renderAll() {
    renderStudio();
    renderPads();
    renderPacks();
    renderSettings();
    $("#currentPackName").textContent = state.currentPack?.name || "オレ基本セット";
    const count = recordedCount();
    $("#homeProgress").textContent = `${count} / ${config.soundDefinitions.length} オレ済み`;
  }

  function renderStudio() {
    const count = recordedCount();
    $("#studioProgressText").textContent = `${count} / ${config.soundDefinitions.length} 録音済み`;
    $("#studioProgressBar").style.width = `${(count / config.soundDefinitions.length) * 100}%`;
    $("#soundList").innerHTML = config.soundDefinitions.map((definition, index) => {
      const done = Boolean(state.currentPack?.sounds?.[definition.id]);
      return `<article class="sound-row ${done ? "is-recorded" : ""}" data-sound-id="${definition.id}">
        <span class="sound-number">${String(index + 1).padStart(2, "0")}</span>
        <div class="sound-copy"><b>${definition.label}</b><small>「${definition.example}」 · 最大${definition.max}秒</small></div>
        <span class="status-chip">${done ? "✓ オレ済み" : "○ まだ"}</span>
        <button class="mini-play" type="button" data-play="${definition.id}" ${done ? "" : "aria-label=仮音を再生"}>▶</button>
        <button class="record-button" type="button" data-record="${definition.id}">${done ? "録り直す" : "● 録音"}</button>
      </article>`;
    }).join("");
    const ready = count === config.soundDefinitions.length;
    $("#studioGameButton").classList.toggle("is-ready", ready);
    $("#studioGameButton").innerHTML = ready ? "全部オレ済み！ ゲーム開始 →" : "この音でゲーム開始 →";
  }

  function renderPads() {
    $("#padGrid").innerHTML = config.soundDefinitions.map((definition, index) => {
      const done = Boolean(state.currentPack?.sounds?.[definition.id]);
      return `<button class="sound-pad pad-${index % 4} ${done ? "is-recorded" : ""}" type="button" data-pad="${definition.id}"><span>${definition.short}</span><small>${done ? "✓ オレ済み" : "仮サウンド"}</small></button>`;
    }).join("");
  }

  function renderPacks() {
    $("#packList").innerHTML = state.packs.map((pack) => `<button class="pack-card ${pack.id === state.currentPack.id ? "is-current" : ""}" type="button" data-pack="${pack.id}"><span class="pack-icon">♫</span><span><b>${escapeHtml(pack.name)}</b><small>${recordedCount(pack)} / ${config.soundDefinitions.length} オレ済み</small></span><i>${pack.id === state.currentPack.id ? "使用中" : "選ぶ"}</i></button>`).join("");
    $("#packActionName").value = state.currentPack.name;
    $("#deletePackButton").disabled = state.packs.length <= 1;
  }

  function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }

  function renderSettings() {
    $("#masterVolume").value = state.settings.masterVolume;
    $("#effectVolume").value = state.settings.effectVolume;
    $("#autoTrim").checked = state.settings.autoTrim;
    $("#autoFire").checked = state.settings.autoFire;
    $("#vibration").checked = state.settings.vibration;
    $("#vibrationSetting").classList.toggle("is-disabled", !navigator.vibrate);
  }

  async function saveSettings() {
    state.settings = {
      masterVolume: Number($("#masterVolume").value), effectVolume: Number($("#effectVolume").value),
      autoTrim: $("#autoTrim").checked, autoFire: $("#autoFire").checked,
      vibration: navigator.vibrate ? $("#vibration").checked : false
    };
    sound.setSettings(state.settings);
    await storage.setState("settings", state.settings);
  }

  async function choosePack(id) {
    const pack = state.packs.find((entry) => entry.id === id);
    if (!pack) return;
    state.currentPack = pack;
    await storage.setState("currentPackId", pack.id);
    await sound.loadPack(pack);
    renderAll();
    toast(`「${pack.name}」に切り替えました`);
  }

  async function startRecording(id) {
    const definition = config.soundDefinitions.find((entry) => entry.id === id);
    state.recordingId = id;
    state.pendingBlob = null;
    $("#recordSoundName").textContent = definition.label;
    $("#recordExample").textContent = `「${definition.example}」`;
    $("#recordMax").textContent = `最大 ${definition.max} 秒`;
    $("#recordReview").hidden = true;
    $("#recordLive").hidden = true;
    $("#countdown").hidden = false;
    showScreen("recordScreen");
    try {
      await sound.unlock();
      await recorder.ensureStream();
      for (const value of [3, 2, 1]) {
        $("#countdownNumber").textContent = value;
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      $("#countdown").hidden = true;
      $("#recordLive").hidden = false;
      $("#recordMeterBar").style.width = "0%";
      const blobPromise = recorder.start(definition.max, (level) => { $("#recordMeterBar").style.width = `${Math.round(level * 100)}%`; }, (seconds) => { $("#recordTimer").textContent = `${seconds.toFixed(1)} / ${definition.max.toFixed(1)} 秒`; });
      state.pendingBlob = await blobPromise;
      $("#recordLive").hidden = true;
      $("#recordReview").hidden = false;
      $("#reviewSize").textContent = `${Math.max(1, Math.round(state.pendingBlob.size / 1024))} KB · ${state.pendingBlob.type || "audio"}`;
      toast("録れました！ まずは聞いてみよう");
    } catch (error) {
      showScreen("studioScreen");
      showError(error);
    }
  }

  async function previewPending() {
    if (!state.pendingBlob) return;
    try {
      await sound.unlock();
      const buffer = await sound.context.decodeAudioData(await state.pendingBlob.arrayBuffer());
      const source = sound.context.createBufferSource();
      source.buffer = buffer; source.connect(sound.master); source.start();
    } catch (error) { showError(error); }
  }

  async function acceptRecording() {
    if (!state.pendingBlob || !state.recordingId) return;
    state.currentPack.sounds = { ...(state.currentPack.sounds || {}), [state.recordingId]: state.pendingBlob };
    await storage.savePack(state.currentPack);
    await sound.loadPack(state.currentPack);
    recorder.release();
    showScreen("studioScreen");
    renderAll();
    toast("オレ効果音に登録しました");
  }

  async function startGame() {
    try {
      await sound.unlock();
      await sound.loadPack(state.currentPack);
      $("#gameScore").textContent = "0";
      $("#gameHp").textContent = "♥ ♥ ♥";
      showScreen("gameScreen");
      const canvas = $("#gameCanvas");
      await games.startShooter(canvas, state.settings, finishGame);
      const hudTimer = setInterval(() => {
        if (!games.current?.running) return clearInterval(hudTimer);
        $("#gameScore").textContent = String(games.current.score).padStart(6, "0");
        $("#gameHp").textContent = Array.from({ length: 3 }, (_, i) => i < games.current.hp ? "♥" : "♡").join(" ");
        $("#bossBar").hidden = !games.current.boss;
        if (games.current.boss) $("#bossBarFill").style.width = `${games.current.boss.hp / games.current.boss.maxHp * 100}%`;
      }, 100);
    } catch (error) { showError(error); }
  }

  async function finishGame(result) {
    state.bestScore = Math.max(state.bestScore, result.score);
    await storage.setState("bestScore", state.bestScore);
    $("#resultLabel").textContent = result.clear ? "STAGE CLEAR" : "GAME OVER";
    $("#resultTitle").textContent = result.clear ? "全部オレで突破！" : "今回も全部オレでした。";
    $("#resultScore").textContent = result.score.toLocaleString();
    $("#resultBest").textContent = state.bestScore.toLocaleString();
    const ranked = Object.entries(result.counts).sort((a, b) => b[1] - a[1]);
    const top = ranked[0] || ["shot", 0];
    const topDef = config.soundDefinitions.find((definition) => definition.id === top[0]);
    $("#topSoundName").textContent = topDef?.short || top[0];
    $("#topSoundCount").textContent = `${top[1]} 回`;
    $("#resultCounts").innerHTML = config.soundDefinitions.map((definition) => `<div><span>${definition.short}</span><b>${result.counts[definition.id] || 0}</b></div>`).join("");
    setTimeout(() => showScreen("resultScreen"), 700);
  }

  function renderDebug() {
    const rows = [
      ["UserAgent", navigator.userAgent], ["MediaRecorder", window.MediaRecorder ? "対応" : "非対応"],
      ["getUserMedia", navigator.mediaDevices?.getUserMedia ? "対応" : "非対応"], ["AudioContext", sound.context?.state || "未開始"],
      ["IndexedDB", storage.db ? "接続済み" : "未接続"], ["現在のパック", state.currentPack?.name || "なし"],
      ["登録済み音声", `${recordedCount()} / ${config.soundDefinitions.length}`], ["録音形式", recorder.preferredMimeType?.() || "ブラウザ既定"],
      ["エラー履歴", state.errors.join("\n") || "なし"]
    ];
    $("#debugInfo").innerHTML = rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const nav = event.target.closest("[data-nav]"); if (nav) showScreen(nav.dataset.nav);
      const recordButton = event.target.closest("[data-record]"); if (recordButton) startRecording(recordButton.dataset.record);
      const playButton = event.target.closest("[data-play]"); if (playButton) sound.play(playButton.dataset.play);
      const pad = event.target.closest("[data-pad]"); if (pad) { pad.classList.remove("is-hit"); void pad.offsetWidth; pad.classList.add("is-hit"); sound.play(pad.dataset.pad); }
      const pack = event.target.closest("[data-pack]"); if (pack) choosePack(pack.dataset.pack);
    });
    $("#recordStartButton").addEventListener("click", () => showScreen("studioScreen"));
    $("#studioShortcut").addEventListener("click", () => showScreen("studioScreen"));
    $("#quickStartButton").addEventListener("click", startGame);
    $("#studioGameButton").addEventListener("click", startGame);
    $("#stopRecordingButton").addEventListener("click", () => recorder.stop());
    $("#previewRecordingButton").addEventListener("click", previewPending);
    $("#retryRecordingButton").addEventListener("click", () => startRecording(state.recordingId));
    $("#acceptRecordingButton").addEventListener("click", acceptRecording);
    $("#cancelRecordingButton").addEventListener("click", () => { recorder.release(); showScreen("studioScreen"); });
    $("#playGameButton").addEventListener("click", startGame);
    $("#gameQuitButton").addEventListener("click", () => { games.stop(); showScreen("titleScreen"); });
    $("#replayButton").addEventListener("click", startGame);
    $("#resultStudioButton").addEventListener("click", () => showScreen("studioScreen"));
    $("#resultHomeButton").addEventListener("click", () => showScreen("titleScreen"));
    $("#newPackForm").addEventListener("submit", async (event) => {
      event.preventDefault(); const input = $("#newPackName"); const name = input.value.trim(); if (!name) return;
      const pack = { id: `pack-${Date.now()}`, name, createdAt: Date.now(), updatedAt: Date.now(), sounds: {} };
      await storage.savePack(pack); state.packs.push(pack); input.value = ""; await choosePack(pack.id);
    });
    $("#renamePackButton").addEventListener("click", async () => { const name = $("#packActionName").value.trim(); if (!name) return; state.currentPack.name = name; await storage.savePack(state.currentPack); renderAll(); toast("パック名を変更しました"); });
    $("#duplicatePackButton").addEventListener("click", async () => { const copy = await storage.duplicatePack(state.currentPack.id, `${state.currentPack.name} コピー`); state.packs.push(copy); await choosePack(copy.id); });
    $("#deletePackButton").addEventListener("click", async () => { if (state.packs.length <= 1 || !confirm(`「${state.currentPack.name}」を削除しますか？`)) return; await storage.deletePack(state.currentPack.id); state.packs = state.packs.filter((pack) => pack.id !== state.currentPack.id); await choosePack(state.packs[0].id); });
    $$(`.settings-input`).forEach((input) => input.addEventListener("change", saveSettings));
    $("#debugToggleButton").addEventListener("click", () => { renderDebug(); $("#debugPanel").hidden = !$("#debugPanel").hidden; });
    $("#closeErrorButton").addEventListener("click", () => { $("#errorDialog").hidden = true; });
    $("#resumeAudioButton").addEventListener("click", async () => { await sound.unlock(); toast("サウンドを再開しました"); });
    window.addEventListener("resize", () => games.current?.resize());
    document.addEventListener("visibilitychange", () => { if (!document.hidden && sound.context?.state === "suspended") $("#audioResumeNotice").hidden = false; });
    $("#audioResumeNotice").addEventListener("click", async () => { await sound.unlock(); $("#audioResumeNotice").hidden = true; });
  }

  async function init() {
    bindEvents();
    try { await storage.init(); await loadState(); }
    catch (error) { logError(error); state.currentPack = { id: config.defaultPackId, name: "オレ基本セット", sounds: {} }; renderAll(); toast("保存機能なしで起動しました"); }
    showScreen("titleScreen");
  }

  init();
})();
