(function () {
  "use strict";

  const config = window.ORE_CONFIG;
  const storage = new window.StorageManager(config);
  const sound = new window.SoundManager(config);
  const recorder = new window.RecorderManager(sound);
  const games = new window.GameManager(sound, config.gameDefinitions)
    .registerGame("shooter", window.ShooterGame)
    .registerGame("action", window.ActionGame);
  const state = {
    packs: [], currentPack: null, settings: { ...config.defaultSettings }, selectedGameId: config.defaultGameId,
    recordingId: null, pendingBlob: null, errors: [], shooterBest: 0, actionBest: 0, actionBestTime: null,
    lastGameId: config.defaultGameId, lastDebug: null, hudTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = $$(".screen");
  const gameDef = (id = state.selectedGameId) => games.getGameDefinition(id) || games.getGameDefinition(config.defaultGameId);
  const gameSounds = (id = state.selectedGameId) => config.getGameSounds(id);

  function showScreen(id) {
    if (id !== "gameScreen") games.stop();
    screens.forEach((screen) => { screen.hidden = screen.id !== id; });
    $("#bottomNav").hidden = id === "gameScreen" || id === "recordScreen";
    $$(`[data-nav]`).forEach((button) => button.classList.toggle("is-active", button.dataset.nav === id));
    window.scrollTo(0, 0);
  }

  function toast(message) {
    const element = $("#toast"); element.textContent = message; element.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { element.hidden = true; }, 2300);
  }

  function logError(error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    state.errors.unshift(`${new Date().toLocaleTimeString()} ${message}`); state.errors = state.errors.slice(0, 8); console.error(error);
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
    logError(error); const info = micErrorMessage(error);
    $("#errorTitle").textContent = info.title; $("#errorMessage").textContent = info.body; $("#errorDetail").textContent = info.detail; $("#errorDialog").hidden = false;
  }

  async function loadState() {
    state.packs = (await storage.getAllPacks()).sort((a, b) => a.createdAt - b.createdAt);
    const currentId = await storage.getState("currentPackId", config.defaultPackId);
    state.currentPack = state.packs.find((pack) => pack.id === currentId) || state.packs[0];
    state.settings = { ...config.defaultSettings, ...(await storage.getState("settings", {})) };
    state.selectedGameId = await storage.getState("selectedGameId", config.defaultGameId);
    if (!gameDef(state.selectedGameId)?.playable) state.selectedGameId = config.defaultGameId;
    state.shooterBest = await storage.getState("bestScore", 0);
    state.actionBest = await storage.getState("actionBestScore", 0);
    state.actionBestTime = await storage.getState("actionBestTime", null);
    sound.setSettings(state.settings);
    await sound.loadPack(state.currentPack, gameDef().sounds);
    renderAll();
  }

  function recordedCount(pack = state.currentPack, gameId = state.selectedGameId) {
    return gameSounds(gameId).filter((definition) => pack?.sounds?.[definition.id]).length;
  }

  function renderAll() {
    renderGameModes(); renderStudio(); renderPads(); renderPacks(); renderSettings(); updateSelectionCopy();
  }

  function renderGameModes() {
    $("#gameModeList").innerHTML = games.getGameDefinitions().map((definition) => {
      const selected = definition.id === state.selectedGameId;
      return `<button class="mode-card ${definition.playable ? "is-ready" : ""} ${selected ? "is-selected" : ""}" type="button" data-select-game="${definition.id}" ${definition.playable ? "" : "disabled"}>
        <span>${String(definition.order).padStart(2, "0")}</span><div><b>${definition.name}</b><small>${definition.playable ? "PLAY" : "COMING SOON"}</small></div><i>${selected ? "✓" : definition.playable ? "→" : ""}</i>
      </button>`;
    }).join("");
  }

  function updateSelectionCopy() {
    const definition = gameDef(); const count = recordedCount(); const total = definition.sounds.length;
    $("#currentPackName").textContent = state.currentPack?.name || "オレ基本セット";
    $("#homeProgress").textContent = `${count} / ${total} オレ済み`;
    $("#selectedGameName").textContent = definition.subtitle;
    $("#selectedGameDescription").textContent = definition.description;
    $("#recordStartButton").querySelector("small").textContent = `${definition.name} · 必要なオレ ${total}種類`;
  }

  async function selectGame(id, announce = true) {
    const definition = gameDef(id); if (!definition?.playable) return;
    state.selectedGameId = id; await storage.setState("selectedGameId", id); renderAll();
    if (announce) toast(`${definition.name}を選びました`);
  }

  function renderStudio() {
    const definitions = gameSounds(); const count = recordedCount();
    $("#studioGameName").textContent = gameDef().subtitle;
    $("#studioProgressText").textContent = `${count} / ${definitions.length} 録音済み`;
    $("#studioProgressBar").style.width = `${definitions.length ? count / definitions.length * 100 : 0}%`;
    $("#soundList").innerHTML = definitions.map((definition, index) => {
      const done = Boolean(state.currentPack?.sounds?.[definition.id]);
      return `<article class="sound-row ${done ? "is-recorded" : ""}" data-sound-id="${definition.id}">
        <span class="sound-number">${String(index + 1).padStart(2, "0")}</span>
        <div class="sound-copy"><b>${definition.label}</b><small>おすすめ「${definition.example}」 · 最大${definition.max}秒</small></div>
        <span class="status-chip">${done ? "✓ オレ済み" : "○ まだ"}</span>
        <button class="mini-play" type="button" data-play="${definition.id}" aria-label="${definition.label}を再生">▶</button>
        <button class="record-button" type="button" data-record="${definition.id}">${done ? "録り直す" : "● 録音"}</button>
      </article>`;
    }).join("");
    const ready = count === definitions.length;
    $("#studioGameButton").classList.toggle("is-ready", ready);
    $("#studioGameButton").textContent = ready ? "全部オレ済み！ ゲーム開始 →" : "この音でゲーム開始 →";
  }

  function renderPads() {
    $("#testGameName").textContent = gameDef().subtitle;
    $("#padGrid").innerHTML = gameSounds().map((definition, index) => {
      const done = Boolean(state.currentPack?.sounds?.[definition.id]);
      return `<button class="sound-pad pad-${index % 4} ${done ? "is-recorded" : ""}" type="button" data-pad="${definition.id}"><span>${definition.short}</span><small>${done ? "✓ オレ済み" : "仮サウンド"}</small></button>`;
    }).join("");
  }

  function renderPacks() {
    const total = gameDef().sounds.length;
    $("#packList").innerHTML = state.packs.map((pack) => `<button class="pack-card ${pack.id === state.currentPack.id ? "is-current" : ""}" type="button" data-pack="${pack.id}"><span class="pack-icon">♫</span><span><b>${escapeHtml(pack.name)}</b><small>${gameDef().name}: ${recordedCount(pack)} / ${total} オレ済み</small></span><i>${pack.id === state.currentPack.id ? "使用中" : "選ぶ"}</i></button>`).join("");
    $("#packActionName").value = state.currentPack.name; $("#deletePackButton").disabled = state.packs.length <= 1;
  }

  function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }

  function renderSettings() {
    $("#masterVolume").value = state.settings.masterVolume; $("#effectVolume").value = state.settings.effectVolume;
    $("#autoTrim").checked = state.settings.autoTrim; $("#autoFire").checked = state.settings.autoFire;
    $("#vibration").checked = state.settings.vibration; $("#vibrationSetting").classList.toggle("is-disabled", !navigator.vibrate);
  }

  async function saveSettings() {
    state.settings = { masterVolume: Number($("#masterVolume").value), effectVolume: Number($("#effectVolume").value), autoTrim: $("#autoTrim").checked, autoFire: $("#autoFire").checked, vibration: navigator.vibrate ? $("#vibration").checked : false };
    sound.setSettings(state.settings); await storage.setState("settings", state.settings);
  }

  async function choosePack(id) {
    const pack = state.packs.find((entry) => entry.id === id); if (!pack) return;
    state.currentPack = pack; await storage.setState("currentPackId", pack.id); await sound.loadPack(pack, gameDef().sounds); renderAll(); toast(`「${pack.name}」に切り替えました`);
  }

  async function startRecording(id) {
    const definition = config.soundCatalog[id]; if (!definition) return;
    state.recordingId = id; state.pendingBlob = null;
    $("#recordSoundName").textContent = definition.label; $("#recordExample").textContent = `「${definition.example}」`; $("#recordMax").textContent = `最大 ${definition.max} 秒`;
    $("#recordReview").hidden = true; $("#recordLive").hidden = true; $("#countdown").hidden = false; showScreen("recordScreen");
    try {
      await sound.unlock(); await recorder.ensureStream();
      for (const value of [3, 2, 1]) { $("#countdownNumber").textContent = value; await new Promise((resolve) => setTimeout(resolve, 650)); }
      $("#countdown").hidden = true; $("#recordLive").hidden = false; $("#recordMeterBar").style.width = "0%";
      state.pendingBlob = await recorder.start(definition.max, (level) => { $("#recordMeterBar").style.width = `${Math.round(level * 100)}%`; }, (seconds) => { $("#recordTimer").textContent = `${seconds.toFixed(1)} / ${definition.max.toFixed(1)} 秒`; });
      $("#recordLive").hidden = true; $("#recordReview").hidden = false;
      $("#reviewSize").textContent = `${Math.max(1, Math.round(state.pendingBlob.size / 1024))} KB · ${state.pendingBlob.type || "audio"}`; toast("録れました！ まずは聞いてみよう");
    } catch (error) { showScreen("studioScreen"); showError(error); }
  }

  async function previewPending() {
    if (!state.pendingBlob) return;
    try { await sound.unlock(); const buffer = await sound.context.decodeAudioData(await state.pendingBlob.arrayBuffer()); const source = sound.context.createBufferSource(); source.buffer = buffer; source.connect(sound.master); source.start(); }
    catch (error) { showError(error); }
  }

  async function acceptRecording() {
    if (!state.pendingBlob || !state.recordingId) return;
    state.currentPack.sounds = { ...(state.currentPack.sounds || {}), [state.recordingId]: state.pendingBlob };
    await storage.savePack(state.currentPack); await sound.loadPack(state.currentPack, gameDef().sounds); recorder.release(); showScreen("studioScreen"); renderAll(); toast("オレ効果音に登録しました");
  }

  async function gameCountdown() {
    const overlay = $("#gameCountdown"); overlay.hidden = false;
    for (const value of ["3", "2", "1", "全部オレ！"]) { $("#gameCountdownText").textContent = value; overlay.classList.remove("is-pop"); void overlay.offsetWidth; overlay.classList.add("is-pop"); await new Promise((resolve) => setTimeout(resolve, value === "全部オレ！" ? 700 : 540)); }
    overlay.hidden = true;
  }

  async function startSelectedGame() {
    try {
      const definition = gameDef(); state.lastGameId = definition.id;
      await sound.unlock(); await sound.loadPack(state.currentPack, definition.sounds);
      showScreen("gameScreen");
      $("#gameScreen").classList.toggle("is-action", definition.id === "action");
      $("#actionControls").hidden = definition.id !== "action";
      $("#bossBar").hidden = true; $("#gameModeLabel").textContent = definition.name.toUpperCase(); $("#gameScore").textContent = "000000"; $("#gameHp").textContent = "♥ ♥ ♥";
      await gameCountdown();
      await games.startGame(definition.id, $("#gameCanvas"), state.settings, finishGame, { controlsRoot: $("#actionControls") });
      clearInterval(state.hudTimer);
      state.hudTimer = setInterval(updateGameHud, 100);
    } catch (error) { showScreen("titleScreen"); showError(error); }
  }

  function updateGameHud() {
    if (!games.current?.running) return clearInterval(state.hudTimer);
    const current = games.current; const hud = current.getHudState?.() || { score: current.score, hp: current.hp, maxHp: 3 };
    $("#gameScore").textContent = String(hud.score || 0).padStart(6, "0");
    $("#gameHp").textContent = Array.from({ length: hud.maxHp || 3 }, (_, i) => i < hud.hp ? "♥" : "♡").join(" ");
    $("#bossBar").hidden = !current.boss;
    if (current.boss) $("#bossBarFill").style.width = `${current.boss.hp / current.boss.maxHp * 100}%`;
    state.lastDebug = current.getDebugState?.() || { game: games.currentId, playerState: "playing", enemies: current.enemies?.length || 0 };
    if (!$("#gameDebugOverlay").hidden) renderLiveDebug();
  }

  async function finishGame(result) {
    clearInterval(state.hudTimer);
    if (result.mode === "action") {
      state.actionBest = Math.max(state.actionBest, result.score); await storage.setState("actionBestScore", state.actionBest);
      if (result.clear && (!state.actionBestTime || result.stats.time < state.actionBestTime)) { state.actionBestTime = result.stats.time; await storage.setState("actionBestTime", state.actionBestTime); }
    } else { state.shooterBest = Math.max(state.shooterBest, result.score); await storage.setState("bestScore", state.shooterBest); }
    const definitions = gameSounds(state.lastGameId);
    $("#resultLabel").textContent = result.clear ? "STAGE CLEAR" : "GAME OVER";
    $("#resultTitle").textContent = result.clear ? "このステージの音は全部あなたでした。" : "今回も全部オレでした。";
    $("#resultScore").textContent = result.score.toLocaleString();
    $("#resultBest").textContent = (result.mode === "action" ? state.actionBest : state.shooterBest).toLocaleString();
    const action = result.mode === "action";
    $("#actionResultStats").hidden = !action;
    if (action) {
      $("#resultTime").textContent = formatTime(result.stats.time); $("#resultKills").textContent = result.stats.kills; $("#resultItems").textContent = result.stats.items;
      $("#resultDamage").textContent = result.stats.damage; $("#resultFalls").textContent = result.stats.falls; $("#resultFastest").textContent = state.actionBestTime ? formatTime(state.actionBestTime) : "--:--";
    }
    const ranked = Object.entries(result.counts).filter(([id]) => definitions.some((definition) => definition.id === id)).sort((a, b) => b[1] - a[1]);
    const top = ranked[0] || [definitions[0]?.id, 0]; const topDef = config.soundCatalog[top[0]];
    $("#topSoundName").textContent = topDef?.label || top[0]; $("#topSoundCount").textContent = `${top[1]} 回`;
    $("#resultCounts").innerHTML = definitions.map((definition) => `<div><span>${definition.label}</span><b>${result.counts[definition.id] || 0}</b></div>`).join("");
    setTimeout(() => showScreen("resultScreen"), 650);
  }

  function formatTime(seconds) { const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${Math.floor(seconds % 1 * 10)}`; }

  function debugRows() {
    const live = state.lastDebug || {};
    return [
      ["UserAgent", navigator.userAgent], ["MediaRecorder", window.MediaRecorder ? "対応" : "非対応"], ["getUserMedia", navigator.mediaDevices?.getUserMedia ? "対応" : "非対応"],
      ["現在のゲーム", live.game || state.selectedGameId], ["プレイヤー状態", live.playerState || "待機"], ["FPS", live.fps ?? "--"], ["現在座標", live.x == null ? "--" : `${live.x}, ${live.y}`],
      ["接地状態", live.grounded == null ? "--" : live.grounded ? "接地" : "空中"], ["敵数", live.enemies ?? "--"], ["AudioContext", sound.context?.state || "未開始"],
      ["ロード済み効果音", sound.getLoadedBufferCount()], ["IndexedDB", storage.db ? "接続済み" : "未接続"], ["現在のパック", state.currentPack?.name || "なし"],
      ["登録済み音声", `${recordedCount()} / ${gameDef().sounds.length}`], ["録音形式", recorder.preferredMimeType?.() || "ブラウザ既定"], ["エラー履歴", state.errors.join("\n") || "なし"]
    ];
  }

  function renderDebug() { $("#debugInfo").innerHTML = debugRows().map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join(""); }
  function renderLiveDebug() { $("#gameDebugOverlay").textContent = debugRows().slice(3, 11).map(([key, value]) => `${key}: ${value}`).join("\n"); }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-nav]"); if (nav) showScreen(nav.dataset.nav);
      const game = event.target.closest("[data-select-game]"); if (game) selectGame(game.dataset.selectGame);
      const recordButton = event.target.closest("[data-record]"); if (recordButton) startRecording(recordButton.dataset.record);
      const playButton = event.target.closest("[data-play]"); if (playButton) sound.play(playButton.dataset.play);
      const pad = event.target.closest("[data-pad]"); if (pad) { pad.classList.remove("is-hit"); void pad.offsetWidth; pad.classList.add("is-hit"); sound.play(pad.dataset.pad); }
      const pack = event.target.closest("[data-pack]"); if (pack) choosePack(pack.dataset.pack);
    });
    $("#recordStartButton").addEventListener("click", () => showScreen("studioScreen")); $("#studioShortcut").addEventListener("click", () => showScreen("studioScreen"));
    $("#quickStartButton").addEventListener("click", startSelectedGame); $("#studioGameButton").addEventListener("click", startSelectedGame);
    $("#stopRecordingButton").addEventListener("click", () => recorder.stop()); $("#previewRecordingButton").addEventListener("click", previewPending);
    $("#retryRecordingButton").addEventListener("click", () => startRecording(state.recordingId)); $("#acceptRecordingButton").addEventListener("click", acceptRecording);
    $("#cancelRecordingButton").addEventListener("click", () => { recorder.release(); showScreen("studioScreen"); });
    $("#playGameButton").addEventListener("click", startSelectedGame); $("#gameQuitButton").addEventListener("click", () => showScreen("titleScreen"));
    $("#gameDebugButton").addEventListener("click", () => { $("#gameDebugOverlay").hidden = !$("#gameDebugOverlay").hidden; renderLiveDebug(); });
    $("#replayButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); startSelectedGame(); });
    $("#resultStudioButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); showScreen("studioScreen"); });
    $("#resultTestButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); showScreen("testScreen"); });
    $("#resultHomeButton").addEventListener("click", () => showScreen("titleScreen"));
    $("#newPackForm").addEventListener("submit", async (event) => { event.preventDefault(); const input = $("#newPackName"); const name = input.value.trim(); if (!name) return; const pack = { id: `pack-${Date.now()}`, name, createdAt: Date.now(), updatedAt: Date.now(), sounds: {} }; await storage.savePack(pack); state.packs.push(pack); input.value = ""; await choosePack(pack.id); });
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
