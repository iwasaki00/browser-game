(function () {
  "use strict";

  const startupStatus = (label, detail, tone = "loading") => window.ORE_BOOT?.status(label, detail, tone);
  startupStatus("アプリを準備中", "メインプログラムを開始しました", "loading");
  const config = window.ORE_CONFIG;
  const storage = new window.StorageManager(config);
  const sound = new window.SoundManager(config);
  const recorder = new window.RecorderManager(sound);
  const games = new window.GameManager(sound, config.gameDefinitions)
    .registerGame("shooter", window.ShooterGame)
    .registerGame("action", window.ActionGame)
    .registerGame("puzzle", window.PuzzleGame)
    .registerGame("race", window.RaceGame)
    .registerGame("rhythm", window.RhythmGame)
    .registerGame("breakout", window.BreakoutGame)
    .registerGame("fight", window.FightGame)
    .registerGame("pinball", window.PinballGame);
  const initialPack = { id: config.defaultPackId, name: "オレ基本セット", createdAt: Date.now(), updatedAt: Date.now(), sounds: {} };
  const state = {
    packs: [initialPack], currentPack: initialPack, settings: { ...config.defaultSettings }, selectedGameId: config.defaultGameId,
    ready: true,
    recordingId: null, recordingMode: "slot", libraryRecordingName: "", pendingBlob: null, errors: [], shooterBest: 0, actionBest: 0, actionBestTime: null, puzzleBest: 0, puzzleBestChain: 0, puzzlePlays: 0, raceBest: 0, rhythmBest: 0, breakoutBest: 0, fightBest: 0, pinballBest: 0, rhythmBestAccuracy: 0, rhythmMaxCombo: 0, rhythmBestByStage: {}, rhythmAccuracyByStage: {}, rhythmStage: "eight", lastPuzzleChainKey: "puzzleMatch",
    lastGameId: config.defaultGameId, lastDebug: null, hudTimer: null, copyTargetId: null, rhythmTimers: [], metronomeTimer: null, calibration: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = $$(".screen");
  const gameDef = (id = state.selectedGameId) => games.getGameDefinition(id) || games.getGameDefinition(config.defaultGameId);
  const gameSounds = (id = state.selectedGameId) => config.getGameSounds(id);

  function showScreen(id) {
  const library = new window.SoundLibraryController(storage, sound, config, {
    recordLibrary: (name) => beginLibraryRecording(name),
    renderAll: () => renderAll(),
    packs: () => state.packs,
    toast: (message) => toast(message),
    error: (error) => showError(error)
  });

    if (id !== "gameScreen") { games.stop(); sound.stopAllLoops(); }
    screens.forEach((screen) => { screen.hidden = screen.id !== id; });
    $("#bottomNav").hidden = id === "gameScreen" || id === "recordScreen";
    $$(`[data-nav]`).forEach((button) => button.classList.toggle("is-active", button.dataset.nav === id));
    window.scrollTo(0, 0);
  }

  function toast(message) {
    if (!$("#libraryScreen").hidden) library.render();
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
    state.puzzleBest = await storage.getState("puzzleBestScore", 0);
    state.puzzleBestChain = await storage.getState("puzzleBestChain", 0);
    state.puzzlePlays = await storage.getState("puzzlePlayCount", 0);
    state.raceBest = await storage.getState("raceBestScore", 0);
    state.breakoutBest = await storage.getState("breakoutBestScore", 0);
    state.fightBest = await storage.getState("fightBestScore", 0);
    state.pinballBest = await storage.getState("pinballBestScore", 0);
    state.rhythmBest = await storage.getState("rhythmBestScore", 0);
    state.rhythmBestAccuracy = await storage.getState("rhythmBestAccuracy", 0);
    state.rhythmMaxCombo = await storage.getState("rhythmMaxCombo", 0);
    state.rhythmBestByStage = await storage.getState("rhythmBestByStage", {});
    state.rhythmAccuracyByStage = await storage.getState("rhythmAccuracyByStage", {});
    state.rhythmStage = await storage.getState("rhythmStage", "eight");
    sound.setSettings(state.settings);
    state.ready = true; renderAll();
    startupStatus("操作できます", "録音音声を読み込み中…", "loading");
    await library.refresh(state.currentPack, state.selectedGameId);
    sound.loadPack(state.currentPack, gameDef().sounds)
      .then((loaded) => startupStatus(loaded === false ? "起動完了・音声は最初のタップで有効化" : "起動完了・操作できます", `${gameDef().name}・録音 ${recordedCount()} / ${gameDef().sounds.length}`, "ready"))
      .catch((error) => { logError(error); startupStatus("操作できます（音声読込エラー）", error?.message || String(error), "warning"); });

  }

  function recordedCount(pack = state.currentPack, gameId = state.selectedGameId) {
    return gameSounds(gameId).filter((definition) => {
      if (pack?.id === state.currentPack?.id && library.hasAssignment(definition.id)) return true;
      return Boolean(pack?.sounds?.[definition.id]);
    }).length;
  }

  function renderAll() {
    renderGameModes(); renderStudio(); renderPads(); renderPacks(); renderSettings(); updateSelectionCopy(); library.decorateStudio(); library.render();
  }

  function renderGameModes() {
    $("#gameModeList").innerHTML = games.getGameDefinitions().map((definition) => {
      const selected = definition.id === state.selectedGameId;
      const enabled = definition.playable;
      return `<button class="mode-card ${definition.playable ? "is-ready" : ""} ${selected ? "is-selected" : ""}" type="button" data-select-game="${definition.id}" ${enabled ? "" : "disabled"}>
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
    const rhythm = definition.id === "rhythm";
    const breakout = definition.id === "breakout";
    $("#breakoutChallengeHints").hidden = !breakout;
    $("#fightChallengeHints").hidden = definition.id !== "fight";
    $("#pinballChallengeHints").hidden = definition.id !== "pinball";
    $("#rhythmStagePanel").hidden = !rhythm;
    if (rhythm) { const stage = window.RhythmChart.stages().find((entry) => entry.id === state.rhythmStage) || window.RhythmChart.stages()[1]; $("#rhythmStageSelect").value = stage.id; $("#rhythmStageCopy").textContent = `${stage.difficulty} · BPM ${stage.bpm} · ${stage.description}`; }
  }

  async function selectGame(id, announce = true) {
    const definition = gameDef(id); if (!definition?.playable) return false;
    state.selectedGameId = id;
    renderAll();
    storage.setState("selectedGameId", id).catch(logError); sound.loadPack(state.currentPack, definition.sounds).catch(logError);
    if (announce) toast(`${definition.name}を選びました`);
    library.refresh(state.currentPack, id)
      .then((applied) => { if (applied !== false && state.selectedGameId === id) renderAll(); })
      .catch(logError);
    return true;
  }

  function renderStudio() {
    const definitions = gameSounds(); const count = recordedCount();
    $("#studioGameName").textContent = gameDef().subtitle;
    $("#studioProgressText").textContent = `${count} / ${definitions.length} 録音済み`;
    $("#studioProgressBar").style.width = `${definitions.length ? count / definitions.length * 100 : 0}%`;
    $("#soundList").innerHTML = definitions.map((definition, index) => {
      const done = library.hasAssignment(definition.id) || Boolean(state.currentPack?.sounds?.[definition.id]);
      const canCopy = library.assignments.some(item => item.soundKey !== definition.id && item.assetIds?.length) || Object.keys(state.currentPack?.sounds || {}).some((id) => id !== definition.id && config.soundCatalog[id]);
      return `<article class="sound-row ${done ? "is-recorded" : ""}" data-sound-id="${definition.id}">
        <span class="sound-number">${String(index + 1).padStart(2, "0")}</span>
        <div class="sound-copy"><b>${definition.label}</b><small>おすすめ「${definition.example}」 · 最大${definition.max}秒${definition.description ? ` · ${definition.description}` : ""}</small><div class="sound-copy-actions"><button class="copy-sound-button" type="button" data-copy-sound="${definition.id}" ${canCopy ? "" : "disabled"}>他の音と同じにする</button>${done ? `<button class="reset-sound-button" type="button" data-reset-sound="${definition.id}">録音を削除して初期音に戻す</button>` : ""}</div></div>
        <span class="status-chip">${done ? "✓ オレ済み" : "○ まだ"}</span>
        <button class="mini-play" type="button" data-play="${definition.id}" aria-label="${definition.label}を再生">▶</button>
        <button class="record-button" type="button" data-record="${definition.id}">${done ? "録り直す" : "● 録音"}</button>
      </article>`;
    }).join("");
    const ready = count === definitions.length;
    $("#studioGameButton").classList.toggle("is-ready", ready);
    $("#studioGameButton").textContent = ready ? "全部オレ済み！ ゲーム開始 →" : "この音でゲーム開始 →";
    $("#rhythmChallengeHints").hidden = state.selectedGameId !== "rhythm";
    $("#breakoutChallengeHints").hidden = state.selectedGameId !== "breakout";
    $("#fightChallengeHints").hidden = state.selectedGameId !== "fight";
    $("#pinballChallengeHints").hidden = state.selectedGameId !== "pinball";
  }

  function renderPads() {
    $("#testGameName").textContent = gameDef().subtitle;
    $("#puzzleChainTest").hidden = state.selectedGameId !== "puzzle";
    $("#raceEngineTest").hidden = state.selectedGameId !== "race";
    $("#breakoutSoundTests").hidden = state.selectedGameId !== "breakout";
    $("#pinballSoundTests").hidden = state.selectedGameId !== "pinball";
    const fight = state.selectedGameId === "fight";
    $("#fightWorkshop").hidden = !fight;
    if (fight) {
      $("#fightSpecialName").value = state.settings.specialMoveName || "オレファイヤー";
      $("#fightEffect").value = state.settings.fightEffect || "fire";
      $("#fightDifficulty").value = state.settings.fightDifficulty || "easy";
    }
    $("#padGrid").innerHTML = gameSounds().map((definition, index) => {
      const done = library.hasAssignment(definition.id) || Boolean(state.currentPack?.sounds?.[definition.id]);
      return `<button class="sound-pad pad-${index % 4} ${done ? "is-recorded" : ""}" type="button" data-pad="${definition.id}"><span>${definition.short}</span><small>${done ? "✓ オレ済み" : "仮サウンド"}</small></button>`;
    }).join("");
    $("#rhythmTools").hidden = state.selectedGameId !== "rhythm";
    $("#rhythmMetronomeBpm").value = String(state.settings.rhythmMetronomeBpm || 120);
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
    $("#rhythmJudgeVoice").value = state.settings.rhythmJudgeVoice || "important";
    $("#rhythmOffset").value = state.settings.rhythmOffset || 0;
    $("#rhythmOffsetValue").textContent = `${Number(state.settings.rhythmOffset) || 0}ms`;
    state.settings = { ...state.settings, masterVolume: Number($("#masterVolume").value), effectVolume: Number($("#effectVolume").value), autoTrim: $("#autoTrim").checked, autoFire: $("#autoFire").checked, vibration: navigator.vibrate ? $("#vibration").checked : false, rhythmJudgeVoice: $("#rhythmJudgeVoice").value, rhythmOffset: Number($("#rhythmOffset").value), rhythmMetronomeBpm: Number($("#rhythmMetronomeBpm").value || state.settings.rhythmMetronomeBpm || 120), specialMoveName: $("#fightSpecialName")?.value.trim() || "オレファイヤー", fightEffect: $("#fightEffect")?.value || "fire", fightDifficulty: $("#fightDifficulty")?.value || "easy" };
    sound.setSettings(state.settings); await storage.setState("settings", state.settings);
  }

  async function choosePack(id) {
    const pack = state.packs.find((entry) => entry.id === id); if (!pack) return;
    state.currentPack = pack; await storage.setState("currentPackId", pack.id); await library.refresh(pack, state.selectedGameId); await sound.loadPack(pack, gameDef().sounds); renderAll(); toast(`「${pack.name}」に切り替えました`);
  }

  async function startRecording(id) {
    const libraryRecording = id === "__library__";
    const definition = libraryRecording ? { id, label: state.libraryRecordingName || "新しいオレ音", example: "好きな音を録音", max: 5 } : config.soundCatalog[id];
    if (!definition) return;
    state.recordingId = id; state.recordingMode = libraryRecording ? "library" : "slot"; state.pendingBlob = null;
    $("#recordSoundName").textContent = definition.label; $("#recordExample").textContent = `「${definition.example}」`; $("#recordMax").textContent = `最大 ${definition.max} 秒`;
    $("#libraryRecordMetadata").hidden = !libraryRecording;
    $("#libraryRecordName").value = state.libraryRecordingName || "";
    $("#libraryRecordTags").value = libraryRecording ? "声" : "";
    $("#recordReview").hidden = true; $("#recordLive").hidden = true; $("#countdown").hidden = false; showScreen("recordScreen");
    try {
      $("#recordPermissionStatus").textContent = "マイクの許可を確認しています…";
      await recorder.ensureStream();
      $("#recordPermissionStatus").textContent = "マイクを許可しました。声の準備はいい？";
      for (const value of [3, 2, 1]) { $("#countdownNumber").textContent = value; await new Promise((resolve) => setTimeout(resolve, 650)); }
      $("#countdown").hidden = true; $("#recordLive").hidden = false; $("#recordMeterBar").style.width = "0%";
      state.pendingBlob = await recorder.start(definition.max, (level) => { $("#recordMeterBar").style.width = `${Math.round(level * 100)}%`; }, (seconds) => { $("#recordTimer").textContent = `${seconds.toFixed(1)} / ${definition.max.toFixed(1)} 秒`; });
      $("#recordLive").hidden = true; $("#recordReview").hidden = false;
      $("#reviewSize").textContent = `${Math.max(1, Math.round(state.pendingBlob.size / 1024))} KB · ${state.pendingBlob.type || "audio"}`; toast("録れました！ まずは聞いてみよう");
    } catch (error) { showScreen(libraryRecording ? "libraryScreen" : "studioScreen"); showError(error); }
  }

  async function previewPending() {
    if (!state.pendingBlob) return;
    try { await sound.unlock(); const buffer = await sound.context.decodeAudioData(await state.pendingBlob.arrayBuffer()); const source = sound.context.createBufferSource(); source.buffer = buffer; source.connect(sound.master); source.start(); }
    catch (error) { showError(error); }
  }

  function beginLibraryRecording(name) {
    state.libraryRecordingName = name || "";
    startRecording("__library__");
  }

  async function acceptRecording() {
    if (!state.pendingBlob || !state.recordingId) return;
    const button = $("#acceptRecordingButton"); if (button.disabled) return; button.disabled = true;
    const recordingMode = state.recordingMode; const recordingId = state.recordingId; const blob = state.pendingBlob;
    try {
      if (recordingMode === "library") {
        const name = $("#libraryRecordName").value.trim() || state.libraryRecordingName;
        const tags = $("#libraryRecordTags").value.split(/[,、]/).map(value=>value.trim()).filter(Boolean);
        await library.saveLibraryRecording(blob, name, tags);
        state.pendingBlob = null; state.recordingId = null; state.recordingMode = "slot"; state.libraryRecordingName = ""; recorder.release();
        showScreen("libraryScreen"); renderAll(); toast("オレ音ライブラリへ保存しました");
        return;
      }
      await library.saveSlotRecording(state.currentPack, recordingId, blob);
      const pack = state.currentPack; const soundIds = [...gameDef().sounds];
      state.pendingBlob = null; state.recordingId = null; state.recordingMode = "slot"; recorder.release();
      showScreen("studioScreen"); renderAll(); toast("オレ効果音に登録しました");
      sound.loadPack(pack, soundIds).catch((error) => { logError(error); toast("音声はゲーム開始時に再読込します"); });
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  }

  async function resetRecordedSound(id) {
    const definition = config.soundCatalog[id];
    if (!definition || (!state.currentPack?.sounds?.[id] && !library.hasAssignment(id))) return;
    if (!confirm(`「${definition.label}」の録音を削除して初期音に戻しますか？`)) return;
    const sounds = { ...state.currentPack.sounds };
    delete sounds[id];
    state.currentPack.sounds = sounds;
    await library.clearAssignment(id);
    await storage.savePack(state.currentPack);
    const pack = state.currentPack; const soundIds = [...gameDef().sounds]; renderAll(); toast(`${definition.label}を初期音に戻しました`);
    sound.loadPack(pack, soundIds).catch(logError);
  }

  function copySourceOptions(targetId) {
    const keys = [...new Set([...Object.keys(state.currentPack?.sounds || {}), ...library.assignments.map(item => item.soundKey)])];
    return keys.filter((id) => id !== targetId && config.soundCatalog[id]).map((id) => {
      const definition = config.soundCatalog[id];
      const owner = Object.values(config.gameDefinitions).find((game) => game.sounds.includes(id));
      return { id, label: `${owner?.name || "共通"} / ${definition.label}` };
    });
  }

  function openCopySound(targetId) {
    const target = config.soundCatalog[targetId]; const sources = copySourceOptions(targetId);
    if (!target || !sources.length) { toast("先にコピー元の音を録音してください"); return; }
    state.copyTargetId = targetId; $("#copySoundTarget").textContent = `「${target.label}」へコピーします`;
    $("#copySoundSource").innerHTML = sources.map((source) => `<option value="${source.id}">${escapeHtml(source.label)}</option>`).join("");
    $("#copySoundDialog").hidden = false;
  }

  async function copyRecordedSound() {
    const targetId = state.copyTargetId; const sourceId = $("#copySoundSource").value;
    const stored = state.currentPack?.sounds?.[sourceId]; const sourceAssignment = library.assignment(sourceId); const target = config.soundCatalog[targetId];
    if (!target || (!stored && !sourceAssignment) || sourceId === targetId) return;
    const button = $("#confirmCopySoundButton"); if (button.disabled) return; button.disabled = true;
    try {
      if (stored && !sourceAssignment) {
        const copied = Array.isArray(stored) ? [...stored] : stored;
        state.currentPack.sounds = { ...(state.currentPack.sounds || {}), [targetId]: copied };
        await storage.savePack(state.currentPack);
      }
      await library.copyAssignment(sourceId, targetId);
      const pack = state.currentPack; const soundIds = [...gameDef().sounds];
      state.copyTargetId = null; $("#copySoundDialog").hidden = true; renderAll(); toast(`${target.label}を同じ音にしました`);
      sound.loadPack(pack, soundIds).catch(logError);
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  }

  async function gameCountdown() {
    const overlay = $("#gameCountdown"); overlay.hidden = false;
    const values=state.selectedGameId==="pinball"?["PINBALL","3","2","1","全部オレ！"]:["3","2","1","全部オレ！"];
    for (const value of values) { $("#gameCountdownText").textContent = value; overlay.classList.remove("is-pop"); void overlay.offsetWidth; overlay.classList.add("is-pop"); await new Promise((resolve) => setTimeout(resolve, value === "全部オレ！" ? 700 : 540)); }
    overlay.hidden = true;
  }

  function bestScoreFor(id) { return id === "pinball" ? state.pinballBest : id === "fight" ? state.fightBest : id === "breakout" ? state.breakoutBest : id === "rhythm" ? (state.rhythmBestByStage[state.rhythmStage] || 0) : id === "race" ? state.raceBest : id === "puzzle" ? state.puzzleBest : id === "action" ? state.actionBest : state.shooterBest; }

  async function startSelectedGame() {
    try {
      const definition = gameDef(); state.lastGameId = definition.id;
      startupStatus("ゲームを準備中", `${definition.name}を開始しています…`, "loading");
      games.stop(); sound.stopAllLoops();
      const audioReady = sound.unlock().then(() => sound.loadPack(state.currentPack, definition.sounds)).then(() => true).catch((error) => { logError(error); $("#audioResumeNotice").hidden = false; startupStatus("ゲーム起動済み（音声エラー）", error?.message || String(error), "warning"); return false; });
      $("#gameScreen").classList.toggle("is-action", definition.id === "action");
      $("#gameScreen").classList.toggle("is-puzzle", definition.id === "puzzle");
      $("#gameScreen").classList.toggle("is-race", definition.id === "race");
      $("#gameScreen").classList.toggle("is-rhythm", definition.id === "rhythm");
      $("#gameScreen").classList.toggle("is-fight", definition.id === "fight");
      $("#gameScreen").classList.toggle("is-pinball", definition.id === "pinball");
      $("#actionControls").hidden = definition.id !== "action";
      $("#raceControls").hidden = definition.id !== "race";
      $("#gameScreen").classList.toggle("is-breakout", definition.id === "breakout");
      $("#rhythmControls").hidden = definition.id !== "rhythm";
      $("#fightControls").hidden = definition.id !== "fight";
      $("#fightResumeButton").hidden = true;
      $("#pinballControls").hidden = definition.id !== "pinball";
      $("#pinballResumeButton").hidden = true;
      $("#pinballDebugTools").hidden = true;
      await library.refresh(state.currentPack, definition.id);
      $("#bossBar").hidden = true; $("#gameModeLabel").textContent = "SCORE"; $("#gameScore").textContent = "000000";
      $("#gameTip").textContent = definition.id === "pinball" ? "下部左右でフリッパー · 右レーンを下へ引いて発射 · NでNUDGE" : definition.id === "fight" ? "← →で移動 · Aパンチ · Sキック · Dガード · F必殺 · Spaceジャンプ" : definition.id === "breakout" ? "下部を左右ドラッグ · タップで発射 · Pでポーズ" : "シューティングはドラッグ · アクションはボタン · パズルはスワイプ · リズムは4パッド";
      $("#gameAuxLabel").textContent = definition.id === "pinball" ? "BALL" : definition.id === "rhythm" ? "COMBO" : definition.id === "puzzle" ? "TIME" : "HP"; $("#gameHp").textContent = definition.id === "pinball" ? "3 · ×1" : definition.id === "rhythm" ? "0" : definition.id === "puzzle" ? "60" : "♥ ♥ ♥";
      $("#gameBest").textContent = String(bestScoreFor(definition.id)).padStart(6, "0"); $("#gameAuxPanel").classList.remove("is-warning");
      const canvas = $("#gameCanvas"); const context = canvas.getContext("2d");
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.fillStyle = "#080b14"; context.fillRect(0, 0, canvas.width, canvas.height); context.restore();
      showScreen("gameScreen");
      await gameCountdown();
      await games.startGame(definition.id, $("#gameCanvas"), state.settings, finishGame, { controlsRoot: ["breakout", "fight", "pinball"].includes(definition.id) ? $("#gameScreen") : definition.id === "rhythm" ? $("#rhythmControls") : definition.id === "race" ? $("#raceControls") : $("#actionControls"), bestScore: bestScoreFor(definition.id), rhythmStage: state.rhythmStage });
      clearInterval(state.hudTimer);
      state.hudTimer = setInterval(updateGameHud, 100);
      audioReady.then((ready) => { if (ready && games.current?.running && state.lastGameId === definition.id) sound.startLoop(definition.bgm, { gain: .35 }).catch(logError); });
    } catch (error) { startupStatus("ゲーム開始エラー", error?.message || String(error), "error"); showScreen("titleScreen"); showError(error); }
  }

  function updateGameHud() {
    if (!games.current?.running) return clearInterval(state.hudTimer);
    const current = games.current; const hud = current.getHudState?.() || { score: current.score, hp: current.hp, maxHp: 3 };
    $("#gameScore").textContent = String(hud.score || 0).padStart(6, "0");
    if (hud.balls != null) {
      $("#gameAuxLabel").textContent = "BALL · MULTI"; $("#gameHp").textContent = `${hud.balls} · ×${hud.multiplier}`;
      $("#gameAuxPanel").classList.toggle("is-warning", hud.balls <= 1);
    } else if (hud.combo != null) {
      $("#gameAuxLabel").textContent = "COMBO"; $("#gameHp").textContent = String(hud.combo);
      $("#gameAuxPanel").classList.toggle("is-warning", hud.combo >= 30);
    } else if (hud.time != null) {
      $("#gameAuxLabel").textContent = "TIME"; $("#gameHp").textContent = String(Math.ceil(hud.time));
      $("#gameAuxPanel").classList.toggle("is-warning", hud.time <= 5);
    } else {
      $("#gameAuxLabel").textContent = "HP"; $("#gameHp").textContent = Array.from({ length: hud.maxHp || 3 }, (_, i) => i < hud.hp ? "♥" : "♡").join(" ");
      $("#gameAuxPanel").classList.remove("is-warning");
    }
    $("#gameBest").textContent = String(hud.best ?? bestScoreFor(games.currentId)).padStart(6, "0");
    $("#bossBar").hidden = !current.boss;
    if (current.boss) $("#bossBarFill").style.width = `${current.boss.hp / current.boss.maxHp * 100}%`;
    state.lastDebug = current.getDebugState?.() || { game: games.currentId, playerState: "playing", enemies: current.enemies?.length || 0 };
    if (!$("#gameDebugOverlay").hidden) renderLiveDebug();
  }

  async function finishGame(result) {
    clearInterval(state.hudTimer);
    sound.stopAllLoops();
    if (result.mode === "rhythm") { const stage=result.stats.stageId;state.rhythmBest=Math.max(state.rhythmBest,result.score);state.rhythmBestAccuracy=Math.max(state.rhythmBestAccuracy,result.stats.accuracy);state.rhythmMaxCombo=Math.max(state.rhythmMaxCombo,result.stats.maxCombo);state.rhythmBestByStage={...state.rhythmBestByStage,[stage]:Math.max(state.rhythmBestByStage[stage]||0,result.score)};state.rhythmAccuracyByStage={...state.rhythmAccuracyByStage,[stage]:Math.max(state.rhythmAccuracyByStage[stage]||0,result.stats.accuracy)};await storage.setState("rhythmBestScore",state.rhythmBest);await storage.setState("rhythmBestAccuracy",state.rhythmBestAccuracy);await storage.setState("rhythmMaxCombo",state.rhythmMaxCombo);await storage.setState("rhythmBestByStage",state.rhythmBestByStage);await storage.setState("rhythmAccuracyByStage",state.rhythmAccuracyByStage); }
    else if (result.mode === "race") { state.raceBest=Math.max(state.raceBest,result.score); await storage.setState("raceBestScore",state.raceBest); }
    else if (result.mode === "breakout") { state.breakoutBest=Math.max(state.breakoutBest,result.score); await storage.setState("breakoutBestScore",state.breakoutBest); }
    else if (result.mode === "fight") { state.fightBest=Math.max(state.fightBest,result.score); await storage.setState("fightBestScore",state.fightBest); }
    else if (result.mode === "pinball") { state.pinballBest=Math.max(state.pinballBest,result.score); await storage.setState("pinballBestScore",state.pinballBest); }
    else if (result.mode === "puzzle") {
      state.puzzleBest = Math.max(state.puzzleBest, result.score); state.puzzleBestChain = Math.max(state.puzzleBestChain, result.stats.maxChain); state.puzzlePlays += 1;
      await storage.setState("puzzleBestScore", state.puzzleBest); await storage.setState("puzzleBestChain", state.puzzleBestChain); await storage.setState("puzzlePlayCount", state.puzzlePlays);
    } else if (result.mode === "action") {
      state.actionBest = Math.max(state.actionBest, result.score); await storage.setState("actionBestScore", state.actionBest);
      if (result.clear && (!state.actionBestTime || result.stats.time < state.actionBestTime)) { state.actionBestTime = result.stats.time; await storage.setState("actionBestTime", state.actionBestTime); }
    } else { state.shooterBest = Math.max(state.shooterBest, result.score); await storage.setState("bestScore", state.shooterBest); }
    const definitions = gameSounds(state.lastGameId);
    const assetCounts = sound.getAssetPlayStats(); const assetBreakdown = sound.getAssetBreakdown();
    await storage.mergeSoundStats(assetCounts, result.mode || state.lastGameId);
    await library.refresh(state.currentPack, state.lastGameId);
    $("#resultLabel").textContent = result.mode === "puzzle" ? "TIME UP" : result.clear ? "STAGE CLEAR" : "GAME OVER";
    $("#resultTitle").textContent = result.clear ? "このステージの音は全部あなたでした。" : "今回も全部オレでした。";
    $("#resultScore").textContent = result.score.toLocaleString();
    $("#resultBest").textContent = bestScoreFor(result.mode || "shooter").toLocaleString();
    const action = result.mode === "action";
    const puzzle = result.mode === "puzzle";
    const race = result.mode === "race";
    $("#actionResultStats").hidden = !action;
    if (action) {
      $("#resultTime").textContent = formatTime(result.stats.time); $("#resultKills").textContent = result.stats.kills; $("#resultItems").textContent = result.stats.items;
      $("#resultDamage").textContent = result.stats.damage; $("#resultFalls").textContent = result.stats.falls; $("#resultFastest").textContent = state.actionBestTime ? formatTime(state.actionBestTime) : "--:--";
    }
    $("#raceResultStats").hidden=!race; $("#raceResultMessage").hidden=!race; $("#directEngineRerecordButton").hidden=!race;
    if(race){$("#raceResultTime").textContent=formatTime(result.stats.time);$("#raceResultMaxSpeed").textContent=`${Math.round(result.stats.maxSpeed)} km/h`;$("#raceResultAvgSpeed").textContent=`${Math.round(result.stats.averageSpeed)} km/h`;$("#raceResultOvertakes").textContent=result.stats.overtakes;$("#raceResultCrashes").textContent=result.stats.crashes;$("#raceResultBoosts").textContent=result.stats.boosts;$("#raceResultMessage").textContent=result.stats.crashes===0?"安全運転のオレ。":result.stats.crashes>=5?"だいぶオレがぶつかりました。":result.stats.overtakes>=20?"今日のオレ、かなり強気。":"今日もオレが走りました。";}
    $("#puzzleResultStats").hidden = !puzzle; $("#puzzleResultMessage").hidden = !puzzle; $("#directChainRerecordButton").hidden = !puzzle;
    const rhythm = result.mode === "rhythm";
    const breakout = result.mode === "breakout";
    const fight = result.mode === "fight";
    $("#fightResultStats").hidden=!fight; $("#fightResultMessage").hidden=!fight; $("#fightResultActions").hidden=!fight;
    if (fight) {
      $("#resultLabel").textContent = result.draw ? "DRAW" : result.clear ? "YOU WIN!" : "YOU LOSE";
      $("#resultTitle").textContent = result.draw ? "最後まで全部オレの互角勝負。" : result.clear ? "勝った声も必殺技も全部あなたでした。" : "負けても効果音は全部オレでした。";
      $("#fightResultHp").textContent=result.stats.remainingHp; $("#fightResultDealt").textContent=Math.round(result.stats.damageDealt);
      $("#fightResultTaken").textContent=Math.round(result.stats.damageTaken); $("#fightResultPunches").textContent=result.stats.punchHits;
      $("#fightResultKicks").textContent=result.stats.kickHits; $("#fightResultCombo").textContent=result.stats.maxCombo;
      $("#fightResultSpecials").textContent=result.stats.specialUses; $("#fightResultSpecialHits").textContent=result.stats.specialHits;
      $("#fightResultAccuracy").textContent=`${result.stats.specialAccuracy.toFixed(0)}%`; $("#fightResultGuards").textContent=result.stats.guards;
      $("#fightResultMessage").textContent=result.stats.specialUses>=3?"必殺技を叫びたかっただけ説。":result.stats.maxCombo>=5?"オレの声で華麗な連続技。":"殴る音も負け声も全部オレ。";
    }
    const pinball = result.mode === "pinball";
    $("#pinballResultStats").hidden=!pinball;$("#pinballResultMessage").hidden=!pinball;$("#pinballResultActions").hidden=!pinball;
    if(pinball){
      $("#resultLabel").textContent="GAME OVER";$("#resultTitle").textContent="跳ねた音も落ちた声も、台ごと全部オレでした。";
      $("#pinballResultJackpots").textContent=result.stats.jackpots;$("#pinballResultMultiball").textContent=result.stats.maxMultiball;
      $("#pinballResultBumpers").textContent=result.stats.bumperHits;$("#pinballResultTargets").textContent=result.stats.targetHits;
      $("#pinballResultOre").textContent=result.stats.oreCompletes;$("#pinballResultExtra").textContent=result.stats.extraBalls;
      $("#pinballResultDrains").textContent=result.stats.drains;$("#pinballResultTotalOre").textContent=result.stats.totalOre;
      $("#pinballResultPeakOre").textContent=`${result.stats.maxOrePerSecond}オレ / 秒`;$("#pinballResultDensity").textContent=`${result.stats.oreDensity.toFixed(2)}オレ / 秒`;
      $("#pinballResultMessage").innerHTML=result.stats.jackpots?`JACKPOT ${result.stats.jackpots}回。<strong>今日のオレ、大当たり。</strong>`:result.stats.bumperHits>=30?"今日のオレ、バンパーで大活躍。":"今日のオレ、カチャカチャしすぎ。";
    }
    $("#breakoutResultStats").hidden=!breakout; $("#breakoutResultMessage").hidden=!breakout; $("#breakoutResultActions").hidden=!breakout;
    if (breakout) {
      $("#resultLabel").textContent = result.allClear ? "ALL CLEAR!" : result.clear ? "STAGE CLEAR" : "GAME OVER";
      $("#resultTitle").textContent = result.allClear ? "このゲームの音は全部あなたでした。" : result.clear ? "全部オレ！" : "今回も全部オレでした。";
      $("#breakoutResultCombo").textContent=result.stats.maxCombo; $("#breakoutResultBlocks").textContent=result.stats.blocksDestroyed; $("#breakoutResultItems").textContent=result.stats.items;
      $("#breakoutResultMisses").textContent=result.stats.misses; $("#breakoutResultBalls").textContent=result.stats.highestBallCount; $("#breakoutResultMultiBlocks").textContent=result.stats.multiballDestroyed;
      $("#breakoutResultMessage").textContent=result.stats.blocksDestroyed>=80?"今日のオレ、かなり砕けました。":result.stats.highestBallCount>=3?"マルチボールでオレ大渋滞。":"跳ね返る音も壊れる音も全部オレ。";
    }
    if (puzzle) {
      $("#resultMaxChain").textContent = result.stats.maxChain; $("#resultTotalCleared").textContent = result.stats.totalCleared; $("#resultSpecialCreated").textContent = result.stats.specialsCreated; $("#resultSpecialActivated").textContent = result.stats.specialsActivated; $("#resultBigClears").textContent = result.stats.bigClears; $("#resultBestChain").textContent = state.puzzleBestChain;
      $("#puzzleResultMessage").textContent = result.stats.maxChain >= 7 ? "ほぼオレ祭り。" : result.stats.maxChain >= 5 ? "今回かなりオレが騒ぎました。" : result.stats.maxChain >= 4 ? "だいぶオレが騒がしい。" : "まだ静かなオレ。";
      state.lastPuzzleChainKey = result.stats.maxChain >= 5 ? "puzzleChain5" : result.stats.maxChain === 4 ? "puzzleChain4" : result.stats.maxChain === 3 ? "puzzleChain3" : result.stats.maxChain === 2 ? "puzzleChain2" : "puzzleMatch";
      $("#directChainRerecordButton").textContent = `${config.soundCatalog[state.lastPuzzleChainKey].label}を録り直す`;
    }
    $("#rhythmResultStats").hidden=!rhythm;$("#rhythmResultBanner").hidden=!rhythm;$("#rhythmResultActions").hidden=!rhythm;
    if(rhythm){$("#resultLabel").textContent=result.stats.allPerfect?"ALL PERFECT":result.stats.fullCombo?"FULL COMBO!":"RHYTHM FINISH";$("#resultTitle").textContent=result.stats.fullCombo?"全部オレ！！ 完璧なリズム！":"自分の声だけでリズムが生まれました。";$("#rhythmResultCombo").textContent=result.stats.maxCombo;$("#rhythmResultAccuracy").textContent=`${result.stats.accuracy.toFixed(1)}%`;$("#rhythmResultPerfect").textContent=result.stats.perfect;$("#rhythmResultGreat").textContent=result.stats.great;$("#rhythmResultGood").textContent=result.stats.good;$("#rhythmResultMiss").textContent=result.stats.miss;$("#rhythmResultBanner").textContent=result.stats.allPerfect?"ALL PERFECT · 今日のオレ、完全無欠。":result.stats.fullCombo?"FULL COMBO · 全部オレ！！":`${result.stats.stageName} · 平均判定ズレ ${result.stats.averageOffsetMs>=0?"+":""}${result.stats.averageOffsetMs}ms`;}
    const ranked = Object.entries(result.counts).filter(([id]) => definitions.some((definition) => definition.id === id)).sort((a, b) => b[1] - a[1]);
    const top = ranked[0] || [definitions[0]?.id, 0]; const topDef = config.soundCatalog[top[0]];
    $("#topSoundName").textContent = topDef?.label || top[0]; $("#topSoundCount").textContent = `${top[1]} 回`;
    $("#resultCounts").innerHTML = definitions.map((definition) => `<div><span>${definition.label}</span><b>${result.counts[definition.id] || 0}</b></div>`).join("");
    const assetDetails = Object.entries(assetBreakdown).filter(([,counts]) => Object.keys(counts).length).map(([soundKey,counts]) => {
      const label = config.soundCatalog[soundKey]?.label || soundKey;
      const rows = Object.entries(counts).map(([assetId,count]) => {
        const asset = library.asset(assetId);
        return `<span>${escapeHtml(asset?.name || assetId)} <b>${count}回</b></span>`;
      }).join("");
      return `<div><strong>${escapeHtml(label)}</strong>${rows}</div>`;
    }).join("");
    $("#resultAssetCounts").innerHTML = assetDetails || "<p>録音素材の再生はありませんでした。</p>";
    setTimeout(() => showScreen("resultScreen"), 650);
  }

  function formatTime(seconds) { const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${Math.floor(seconds % 1 * 10)}`; }

  function debugRows() {
    const live = state.lastDebug || {};
    const common = [
      ["UserAgent", navigator.userAgent], ["MediaRecorder", window.MediaRecorder ? "対応" : "非対応"], ["getUserMedia", navigator.mediaDevices?.getUserMedia ? "対応" : "非対応"],
      ["現在のゲーム", live.game || state.selectedGameId], ["FPS", live.fps ?? "--"], ["AudioContext", sound.context?.state || "未開始"], ["ロード済み効果音", sound.getLoadedBufferCount()], ["SoundAsset総数", library.assets.length], ["使用中SoundAsset数", new Set(library.allAssignments.flatMap(item=>item.assetIds||[])).size], ["未使用SoundAsset数", library.assets.filter(asset=>!library.usages(asset.id).length).length], ["AudioBufferキャッシュ数", sound.getAssetCacheCount()], ["SoundAssignment総数", library.allAssignments.length], ["一時割当", sound.hasTemporaryAssignments()?"あり":"なし"], ["IndexedDBバージョン", storage.db?.version||"--"]
    ];
    const gameRows = live.game === "pinball" ? [["ゲーム状態",live.playerState||"READY"],["ボール数",live.balls??0],["ボール座標",live.ballPositions||"--"],["ボール速度",live.ballSpeeds||"--"],["フリッパー角度",live.flippers||"--"],["現在BALL",live.currentBall??1],["MULTIPLIER",`×${live.multiplier??1}`],["ORE点灯",live.ore||"---"],["BALL SAVE",live.ballSave||"0"],["MULTIBALL",live.multiball?"ON":"OFF"],["JACKPOT",live.jackpot?"READY":"OFF"],["物理sub-step",live.substeps??1],["物理速度",`×${live.timeScale??1}`],["最大オレ密度",`${live.maxOre??0}/秒`]] : live.game === "fight" ? [["試合状態",live.playerState||"READY"],["CPU状態",live.cpuState||"--"],["ラウンド",live.round??1],["残り時間",live.time??"--"],["プレイヤーHP",live.playerHp??0],["CPU HP",live.cpuHp??0],["必殺ゲージ",`${live.special??0}%`],["CPU思考",live.cpuAI||"--"],["飛び道具",live.projectiles??0]] : live.game === "breakout" ? [["ゲーム状態",live.playerState||"READY"],["ボール数",live.balls??0],["ボール速度",live.speed??0],["パドル位置",live.paddleX??"--"],["残ブロック数",live.remaining??"--"],["破壊可能ブロック数",live.destructible??"--"],["現在コンボ",live.combo??0],["最大コンボ",live.maxCombo??0],["現在アイテム数",live.items??0]] : live.game === "rhythm" ? [["BPM",live.bpm??"--"],["譜面位置",live.position??"--"],["Audio現在時刻",live.audioTime??"--"],["開始AudioTime",live.startAudioTime??"--"],["ノーツ",`${live.pending??"--"} / ${live.notes??"--"}`],["入力オフセット",`${live.offset??0}ms`],["平均判定ズレ",`${live.averageOffset??0}ms`],["直近判定",live.lastJudge?JSON.stringify(live.lastJudge):"--"]] : live.game === "puzzle" ? [["盤面サイズ", "8 × 8"], ["現在CHAIN", live.chain ?? 0], ["処理状態", live.playerState || "IDLE"], ["有効交換数", live.enemies ?? "--"], ["残り時間", live.time ?? "--"]] : [["プレイヤー状態", live.playerState || "待機"], ["現在座標", live.x == null ? "--" : `${live.x}, ${live.y}`], ["接地状態", live.grounded == null ? "--" : live.grounded ? "接地" : "空中"], ["敵数", live.enemies ?? "--"]];
    return [...common, ...gameRows, ["IndexedDB", storage.db ? "接続済み" : "未接続"], ["現在のパック", state.currentPack?.name || "なし"], ["登録済み音声", `${recordedCount()} / ${gameDef().sounds.length}`], ["録音形式", recorder.preferredMimeType?.() || "ブラウザ既定"], ["エラー履歴", state.errors.join("\n") || "なし"]];
  }

  function renderDebug() { $("#debugInfo").innerHTML = debugRows().map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join(""); }
  function renderLiveDebug() { $("#gameDebugOverlay").textContent = debugRows().slice(3, 11).map(([key, value]) => `${key}: ${value}`).join("\n"); }
  function renderFightDebugTools() {
    const tools=$("#fightDebugTools"),fight=games.currentId==="fight"&&games.current;
    tools.hidden=!fight||$("#gameDebugOverlay").hidden;if(!fight)return;
    const options=games.current.getDebugOptions();
    $("#fightDebugCpuButton").textContent=`CPU AI: ${options.cpuEnabled?"ON":"OFF"}`;
    $("#fightDebugPlayerInvincibleButton").textContent=`PLAYER無敵: ${options.playerInvincible?"ON":"OFF"}`;
    $("#fightDebugCpuInvincibleButton").textContent=`CPU無敵: ${options.cpuInvincible?"ON":"OFF"}`;
  }
  function renderPinballDebugTools(){
    const tools=$("#pinballDebugTools"),pinball=games.currentId==="pinball"&&games.current;
    tools.hidden=!pinball||$("#gameDebugOverlay").hidden;if(!pinball)return;
    $("#pinballDebugSpeedButton").textContent=`PHYSICS: ×${games.current.timeScale}`;
  }
  async function runChainTest() { const button = $("#chainTestButton"); if (button.disabled) return; button.disabled = true; await sound.unlock(); const sequence = [["puzzleMatch", "1連鎖 ポン！"], ["puzzleChain2", "2連鎖 おっ！"], ["puzzleChain3", "3連鎖 きた！"], ["puzzleChain4", "4連鎖 うおお！"], ["puzzleChain5", "5連鎖 全部オレ！！"]]; for (const [id, label] of sequence) { $("#chainTestStatus").textContent = label; await sound.play(id); await new Promise((resolve) => setTimeout(resolve, 720)); } $("#chainTestStatus").textContent = "1 → 2 → 3 → 4 → 5+"; button.disabled = false; button.textContent = "▶ もう一度"; }

  async function runEngineTest(){const b=$("#engineTestButton");if(b.disabled)return;b.disabled=true;await sound.startLoop("raceEngine",{gain:.55,playbackRate:.85});for(const[label,rate,speed]of [["LOW",.85,80],["MID",1,120],["HIGH",1.15,180],["BOOST",1.3,220]]){$("#engineTestStatus").textContent=`${label} · ${speed} km/h`;sound.setLoopPlaybackRate("raceEngine",rate);await new Promise(r=>setTimeout(r,1250));}sound.stopLoop("raceEngine");$("#engineTestStatus").textContent="LOW → MID → HIGH → BOOST";b.disabled=false;}

  async function runBreakoutReflectTest(){const button=$("#breakoutReflectTestButton");if(button.disabled)return;button.disabled=true;await sound.unlock();for(const[id,label]of [["breakoutPaddle","パドル · ポン！"],["breakoutWall","壁 · カン！"],["breakoutBlock","ブロック · パキッ！"],["breakoutHardBlock","硬いブロック · ガン！"]]){$("#breakoutTestStatus").textContent=label;await sound.play(id);await new Promise(resolve=>setTimeout(resolve,620));}$("#breakoutTestStatus").textContent="パドル → 壁 → ブロック → 硬いブロック";button.disabled=false;}
  async function runBreakoutRushTest(){const button=$("#breakoutRushTestButton");if(button.disabled)return;button.disabled=true;await sound.unlock();for(let index=1;index<=8;index+=1){$("#breakoutTestStatus").textContent=`オレラッシュ ${index} / 8`;sound.play("breakoutBlock");await new Promise(resolve=>setTimeout(resolve,90));}await new Promise(resolve=>setTimeout(resolve,350));$("#breakoutTestStatus").textContent="パキッ！ × 8 · 高速再生OK";button.disabled=false;}
  async function runFightSpecialTest(){
    const button=$("#fightSpecialTestButton");if(button.disabled)return;button.disabled=true;
    try {
      await saveSettings();await sound.unlock();
      $("#fightSpecialTestStatus").textContent=state.settings.specialMoveName;$("#fightSpecialPreview").classList.add(`is-${state.settings.fightEffect}`,"is-calling");
      await sound.play("fightSpecialCall");await new Promise(resolve=>setTimeout(resolve,450));
      $("#fightSpecialPreview").classList.remove("is-calling");$("#fightSpecialPreview").classList.add("is-firing");sound.play("fightSpecialEffect");
      await new Promise(resolve=>setTimeout(resolve,750));
    } finally { $("#fightSpecialPreview").className="fight-special-preview";$("#fightSpecialTestStatus").textContent="技名ボイス → 0.45秒 → 発射音";button.disabled=false; }
  }
  async function runPinballRushTest(){const button=$("#pinballRushTestButton");if(button.disabled)return;button.disabled=true;await sound.unlock();const sequence=[["pinballLaunch","LAUNCH"],["pinballWall","WALL"],["pinballBumper","BUMPER"],["pinballBumper","BUMPER"],["pinballFlipper","FLIPPER"],["pinballTarget","TARGET"],["pinballBell","BELL"],["pinballBonus","BONUS"],["pinballJackpot","JACKPOT"]];for(const[id,label]of sequence){$("#pinballTestStatus").textContent=label;sound.play(id);await new Promise(resolve=>setTimeout(resolve,260));}$("#pinballTestStatus").textContent="台全体が全部オレ！";button.disabled=false;}
  async function runPinballMultiTest(){const button=$("#pinballMultiTestButton");if(button.disabled)return;button.disabled=true;await sound.unlock();sound.play("pinballMultiBall");const ids=["pinballWall","pinballBumper","pinballTarget","pinballFlipper","pinballBell"];for(let i=0;i<18;i+=1){$("#pinballTestStatus").textContent=`MULTIBALL ${i+1} / 18`;sound.play(ids[Math.floor(Math.random()*ids.length)]);await new Promise(resolve=>setTimeout(resolve,85));}sound.play("pinballJackpot");$("#pinballTestStatus").textContent="JACKPOT! · オレ大渋滞";button.disabled=false;}
  function bindEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-nav]"); if (nav) { if(nav.dataset.nav!=="testScreen")stopRhythmTools();showScreen(nav.dataset.nav); }
      const game = event.target.closest("[data-select-game]"); if (game) selectGame(game.dataset.selectGame);
      const recordButton = event.target.closest("[data-record]"); if (recordButton) startRecording(recordButton.dataset.record);
      const resetButton = event.target.closest("[data-reset-sound]"); if (resetButton) resetRecordedSound(resetButton.dataset.resetSound);
      const copyButton = event.target.closest("[data-copy-sound]"); if (copyButton) openCopySound(copyButton.dataset.copySound);
      const playButton = event.target.closest("[data-play]"); if (playButton) sound.play(playButton.dataset.play);
      const pad = event.target.closest("[data-pad]"); if (pad) { pad.classList.remove("is-hit"); void pad.offsetWidth; pad.classList.add("is-hit"); if(pad.dataset.pad==="raceEngine"){if(sound.isLoopPlaying("raceEngine"))sound.stopLoop("raceEngine");else sound.startLoop("raceEngine",{gain:.55});}else sound.play(pad.dataset.pad); }
      const pack = event.target.closest("[data-pack]"); if (pack) choosePack(pack.dataset.pack);
    });
  function stopRhythmTools(){state.rhythmTimers.splice(0).forEach(clearTimeout);if(state.metronomeTimer){clearTimeout(state.metronomeTimer);state.metronomeTimer=null;}$("#rhythmMetronome").classList.remove("is-running");$("#rhythmMetronomeButton").textContent="オレメトロノーム";}
  async function runRhythmBeatTest(){stopRhythmTools();await sound.unlock();const pattern=[0,2,1,2,0,2,1,3,0,2,1,2,0,3,1,3],step=250;pattern.forEach((lane,index)=>state.rhythmTimers.push(setTimeout(()=>sound.play(["rhythmKick","rhythmSnare","rhythmHiHat","rhythmClap"][lane]),index*step)));state.rhythmTimers.push(setTimeout(()=>{$("#rhythmBeatTestButton").textContent="▶ もう一度";},pattern.length*step));}
  function hitDrumPad(lane,button){button?.classList.add("is-hit");setTimeout(()=>button?.classList.remove("is-hit"),90);sound.play(["rhythmKick","rhythmSnare","rhythmHiHat","rhythmClap"][lane]);}
  function toggleMetronome(){if(state.metronomeTimer){stopRhythmTools();return;}const bpm=Number($("#rhythmMetronomeBpm").value)||120,interval=60000/bpm;state.settings.rhythmMetronomeBpm=bpm;storage.setState("settings",state.settings).catch(logError);$("#rhythmMetronome").classList.add("is-running");$("#rhythmMetronomeButton").textContent=`停止 · BPM ${bpm}`;const tick=()=>{sound.play("rhythmHiHat");state.metronomeTimer=setTimeout(tick,interval);};tick();}
  function startCalibration(){stopRhythmTools();const start=performance.now()+1000,expected=Array.from({length:8},(_,i)=>start+i*500);state.calibration={expected,taps:[],suggested:0};$("#calibrationTapButton").disabled=false;$("#calibrationApplyButton").disabled=true;$("#calibrationStatus").textContent="光に合わせてタップ";expected.forEach(time=>{state.rhythmTimers.push(setTimeout(()=>{$("#calibrationLight").classList.add("is-beat");setTimeout(()=>$("#calibrationLight").classList.remove("is-beat"),110);},Math.max(0,time-performance.now())));});}
  function calibrationTap(){const c=state.calibration;if(!c||c.taps.length>=c.expected.length)return;const index=c.taps.length,offset=performance.now()-c.expected[index];c.taps.push(offset);$("#calibrationStatus").textContent=`${c.taps.length} / 8 · ${offset>=0?"+":""}${Math.round(offset)}ms`;if(c.taps.length===8){const avg=c.taps.reduce((a,b)=>a+b,0)/c.taps.length;c.suggested=Math.max(-200,Math.min(200,Math.round(-avg/10)*10));$("#calibrationStatus").textContent=`平均 ${avg>=0?"+":""}${Math.round(avg)}ms · 推奨 ${c.suggested}ms`;$("#calibrationTapButton").disabled=true;$("#calibrationApplyButton").disabled=false;}}
  function applyCalibration(){if(!state.calibration)return;$("#rhythmOffset").value=state.calibration.suggested;$("#rhythmOffsetValue").textContent=`${state.calibration.suggested}ms`;saveSettings();toast("推奨タイミングを設定しました");}
    $("#recordStartButton").addEventListener("click", () => showScreen("studioScreen")); $("#studioShortcut").addEventListener("click", () => showScreen("studioScreen"));
    $("#quickStartButton").addEventListener("click", startSelectedGame); $("#studioGameButton").addEventListener("click", startSelectedGame);
    $("#stopRecordingButton").addEventListener("click", () => recorder.stop()); $("#previewRecordingButton").addEventListener("click", previewPending);
    $("#retryRecordingButton").addEventListener("click", () => startRecording(state.recordingId)); $("#acceptRecordingButton").addEventListener("click", acceptRecording);
    $("#cancelRecordingButton").addEventListener("click", () => { const target=state.recordingMode==="library"?"libraryScreen":"studioScreen";state.recordingMode="slot";recorder.release();showScreen(target); });
    $("#playGameButton").addEventListener("click", startSelectedGame); $("#gameQuitButton").addEventListener("click", () => showScreen("titleScreen"));
    $("#gameDebugButton").addEventListener("click", () => { $("#gameDebugOverlay").hidden = !$("#gameDebugOverlay").hidden; if(["breakout","fight","pinball"].includes(games.currentId))games.current.debugHitboxes=!$("#gameDebugOverlay").hidden; renderLiveDebug();renderFightDebugTools();renderPinballDebugTools(); });
    $("#replayButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); startSelectedGame(); });
    $("#resultStudioButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); showScreen("studioScreen"); });
    $("#resultTestButton").addEventListener("click", async () => { await selectGame(state.lastGameId, false); showScreen("testScreen"); });
    $("#resultHomeButton").addEventListener("click", () => showScreen("titleScreen"));
    $("#chainTestButton").addEventListener("click", runChainTest);
    $("#directChainRerecordButton").addEventListener("click", async () => { await selectGame("puzzle", false); startRecording(state.lastPuzzleChainKey); });
    $("#directEngineRerecordButton").addEventListener("click",async()=>{await selectGame("race",false);startRecording("raceEngine")});
    $("#newPackForm").addEventListener("submit", async (event) => { event.preventDefault(); const input = $("#newPackName"); const name = input.value.trim(); if (!name) return; const pack = { id: `pack-${Date.now()}`, name, createdAt: Date.now(), updatedAt: Date.now(), sounds: {} }; await storage.savePack(pack); state.packs.push(pack); input.value = ""; await choosePack(pack.id); });
    $("#renamePackButton").addEventListener("click", async () => { const name = $("#packActionName").value.trim(); if (!name) return; state.currentPack.name = name; await storage.savePack(state.currentPack); renderAll(); toast("パック名を変更しました"); });
    $("#duplicatePackButton").addEventListener("click", async () => { const copy = await storage.duplicatePack(state.currentPack.id, `${state.currentPack.name} コピー`); state.packs.push(copy); await choosePack(copy.id); });
    $("#deletePackButton").addEventListener("click", async () => { if (state.packs.length <= 1 || !confirm(`「${state.currentPack.name}」を削除しますか？`)) return; await storage.deletePack(state.currentPack.id); state.packs = state.packs.filter((pack) => pack.id !== state.currentPack.id); await choosePack(state.packs[0].id); });
    $$(`.settings-input`).forEach((input) => input.addEventListener("change", saveSettings));
    $("#debugToggleButton").addEventListener("click", () => { renderDebug(); $("#debugPanel").hidden = !$("#debugPanel").hidden; });
    $("#engineTestButton").addEventListener("click",runEngineTest);
    $("#closeErrorButton").addEventListener("click", () => { $("#errorDialog").hidden = true; });
    $("#cancelCopySoundButton").addEventListener("click", () => { state.copyTargetId = null; $("#copySoundDialog").hidden = true; });
    $("#breakoutReflectTestButton").addEventListener("click",runBreakoutReflectTest);
    $("#breakoutRushTestButton").addEventListener("click",runBreakoutRushTest);
    $("#confirmCopySoundButton").addEventListener("click", copyRecordedSound);
    const recoverAudio = async (force = false) => { startupStatus("音声を有効化中", "iPhoneの音声出力を再開しています…", "loading"); try { await (force ? sound.recover() : sound.unlock()); $("#audioResumeNotice").hidden = true; startupStatus("起動完了・音声有効", `${gameDef().name}のサウンドを再生できます`, "ready"); return true; } catch (error) { logError(error); $("#audioResumeNotice").hidden = false; startupStatus("音声を有効にできません", error?.message || String(error), "warning"); return false; } };
    $("#resumeAudioButton").addEventListener("click", async () => { if (await recoverAudio(true)) toast("サウンドを再開しました"); });
    window.addEventListener("resize", () => games.current?.resize());
    const unlockAudioOnGesture = (event) => { if (event.target.closest?.("#resumeAudioButton, #audioResumeNotice")) return; if (!sound.context || sound.context.state !== "running") recoverAudio(); };
    document.addEventListener("pointerdown", unlockAudioOnGesture, { capture: true });
    document.addEventListener("touchstart", unlockAudioOnGesture, { capture: true, passive: true });
    document.addEventListener("touchend", unlockAudioOnGesture, { capture: true, passive: true });
    document.addEventListener("click", unlockAudioOnGesture, { capture: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && sound.context && sound.context.state !== "running") $("#audioResumeNotice").hidden = false; });
    window.addEventListener("pageshow", () => { if (sound.context && sound.context.state !== "running") $("#audioResumeNotice").hidden = false; });
    $("#rhythmStageSelect").addEventListener("change",async(event)=>{state.rhythmStage=event.target.value;await storage.setState("rhythmStage",state.rhythmStage);updateSelectionCopy();});
    $("#rhythmBeatTestButton").addEventListener("click",runRhythmBeatTest);$("#rhythmBeatStopButton").addEventListener("click",stopRhythmTools);$("#rhythmMetronomeButton").addEventListener("click",toggleMetronome);
    $("#oreDrumPads").querySelectorAll("[data-rhythm-drum]").forEach(button=>button.addEventListener("pointerdown",event=>{event.preventDefault();hitDrumPad(Number(button.dataset.rhythmDrum),button);}));
    $("#rhythmOffset").addEventListener("input",()=>{$("#rhythmOffsetValue").textContent=`${$("#rhythmOffset").value}ms`;});
    $("#calibrationStartButton").addEventListener("click",startCalibration);$("#calibrationTapButton").addEventListener("pointerdown",event=>{event.preventDefault();calibrationTap();});$("#calibrationApplyButton").addEventListener("click",applyCalibration);
    $("#resultRhythmDrumButton").addEventListener("click",async()=>{await selectGame("rhythm",false);showScreen("testScreen");});
    $("#resultRhythmBeatButton").addEventListener("click",async()=>{await selectGame("rhythm",false);showScreen("testScreen");runRhythmBeatTest();});
    $("#resultRhythmSongsButton").addEventListener("click",async()=>{await selectGame("rhythm",false);showScreen("titleScreen");});
    $("#resultRhythmInstrumentsButton").addEventListener("click",async()=>{await selectGame("rhythm",false);showScreen("studioScreen");setTimeout(()=>document.querySelector('[data-sound-id="rhythmKick"]')?.scrollIntoView({behavior:"smooth"}),50);});
    $("#breakoutResultBlockButton").addEventListener("click",async()=>{await selectGame("breakout",false);startRecording("breakoutBlock");});
    $("#breakoutResultReflectButton").addEventListener("click",async()=>{await selectGame("breakout",false);showScreen("testScreen");runBreakoutReflectTest();});
    $("#breakoutResultRushButton").addEventListener("click",async()=>{await selectGame("breakout",false);showScreen("testScreen");runBreakoutRushTest();});
    $("#breakoutResultSoundsButton").addEventListener("click",async()=>{await selectGame("breakout",false);showScreen("studioScreen");});
    $("#fightSpecialTestButton").addEventListener("click",runFightSpecialTest);
    [$("#fightSpecialName"),$("#fightEffect"),$("#fightDifficulty")].forEach(input=>input.addEventListener("change",saveSettings));
    $("#fightResultSpecialVoiceButton").addEventListener("click",async()=>{await selectGame("fight",false);startRecording("fightSpecialCall");});
    $("#fightResultDamageButton").addEventListener("click",async()=>{await selectGame("fight",false);startRecording("fightDamage");});
    $("#fightResultTestButton").addEventListener("click",async()=>{await selectGame("fight",false);showScreen("testScreen");runFightSpecialTest();});
    $("#fightResultSoundsButton").addEventListener("click",async()=>{await selectGame("fight",false);showScreen("studioScreen");});
    [["#fightDebugCpuButton","cpu"],["#fightDebugPlayerInvincibleButton","playerInvincible"],["#fightDebugCpuInvincibleButton","cpuInvincible"]].forEach(([selector,option])=>$(selector).addEventListener("click",()=>{if(games.currentId!=="fight")return;games.current.toggleDebugOption(option);renderFightDebugTools();renderLiveDebug();}));
    $("#pinballRushTestButton").addEventListener("click",runPinballRushTest);$("#pinballMultiTestButton").addEventListener("click",runPinballMultiTest);
    $("#pinballResultBumperButton").addEventListener("click",async()=>{await selectGame("pinball",false);startRecording("pinballBumper");});
    $("#pinballResultRushButton").addEventListener("click",async()=>{await selectGame("pinball",false);showScreen("testScreen");runPinballRushTest();});
    $("#pinballResultMultiButton").addEventListener("click",async()=>{await selectGame("pinball",false);showScreen("testScreen");runPinballMultiTest();});
    $("#pinballResultSoundsButton").addEventListener("click",async()=>{await selectGame("pinball",false);showScreen("studioScreen");});
    $("#pinballDebugSpeedButton").addEventListener("click",()=>{if(games.currentId!=="pinball")return;games.current.toggleDebugSpeed();renderPinballDebugTools();renderLiveDebug();});
    $("#pinballDebugMultiButton").addEventListener("click",()=>{if(games.currentId!=="pinball")return;games.current.debugMultiball();renderLiveDebug();});
    $("#audioResumeNotice").addEventListener("click", () => recoverAudio(true));
  }

  async function init() {
    startupStatus("画面を準備中", "ボタン操作を有効にしています…", "loading");
    bindEvents();
    renderAll();
    showScreen("titleScreen");
    startupStatus("操作できます", "保存領域に接続中…", "loading");
    try {
      await storage.init();
      await storage.migrateLegacyRecordings();
      library.bind();
      startupStatus("操作できます", "保存データを読み込み中…", "loading");
      await loadState();
    }
    catch (error) { logError(error); renderAll(); startupStatus("操作できます（保存機能なし）", error?.message || String(error), "warning"); toast("保存機能なしで起動しました"); }
    showScreen("titleScreen");
  }

  init();
})();
