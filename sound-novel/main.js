(function () {
  const scenario = window.SCENARIO;
  const startId = window.SCENARIO_START_ID;
  const truthStartId = window.TRUTH_START_ID;
  const store = window.SaveStore;

  const state = {
    currentId: startId,
    currentNode: null,
    isTyping: false,
    textTimer: 0,
    autoTimer: 0,
    auto: false,
    skip: false,
    backlog: [],
    saveData: store.load()
  };

  const els = {
    app: document.getElementById("app"),
    titleScreen: document.getElementById("titleScreen"),
    gameScreen: document.getElementById("gameScreen"),
    endingScreen: document.getElementById("endingScreen"),
    menuOverlay: document.getElementById("menuOverlay"),
    backlogOverlay: document.getElementById("backlogOverlay"),
    background: document.getElementById("background"),
    noiseLayer: document.getElementById("noiseLayer"),
    nameBox: document.getElementById("nameBox"),
    messageArea: document.getElementById("messageArea"),
    messageText: document.getElementById("messageText"),
    tapIndicator: document.getElementById("tapIndicator"),
    choices: document.getElementById("choices"),
    endingTitle: document.getElementById("endingTitle"),
    endingText: document.getElementById("endingText"),
    endingRecords: document.getElementById("endingRecords"),
    truthButton: document.getElementById("truthButton"),
    toast: document.getElementById("toast"),
    volumeInput: document.getElementById("volumeInput"),
    backlogList: document.getElementById("backlogList")
  };

  bindEvents();
  hydrateSettings();
  showTitle();

  function bindEvents() {
    document.getElementById("startButton").addEventListener("click", () => startGame(startId, true));
    document.getElementById("loadButton").addEventListener("click", loadGame);
    document.getElementById("truthButton").addEventListener("click", startTruthRoute);
    document.getElementById("endingTitleButton").addEventListener("click", showTitle);
    document.getElementById("endingRestartButton").addEventListener("click", () => startGame(startId, true));

    document.getElementById("menuButton").addEventListener("click", openMenu);
    document.getElementById("closeMenuButton").addEventListener("click", closeMenu);
    document.getElementById("saveButton").addEventListener("click", saveGame);
    document.getElementById("menuLoadButton").addEventListener("click", loadGame);
    document.getElementById("autoButton").addEventListener("click", toggleAuto);
    document.getElementById("skipButton").addEventListener("click", toggleSkip);
    document.getElementById("backlogButton").addEventListener("click", openBacklog);
    document.getElementById("backTitleButton").addEventListener("click", showTitle);
    document.getElementById("closeBacklogButton").addEventListener("click", closeBacklog);

    els.volumeInput.addEventListener("input", () => {
      state.saveData = store.saveVolume(els.volumeInput.value);
      showToast("音量を保存しました");
    });

    els.messageArea.addEventListener("click", advance);
    els.background.addEventListener("click", advance);
    document.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        advance();
      }
    });
  }

  function hydrateSettings() {
    els.volumeInput.value = state.saveData.volume;
  }

  function showTitle() {
    stopAuto();
    state.skip = false;
    closeMenu();
    closeBacklog();
    els.gameScreen.classList.add("hidden");
    els.endingScreen.classList.add("hidden");
    els.titleScreen.classList.remove("hidden");
    state.saveData = store.load();
    renderEndingRecords();
    renderTruthButton();
  }

  function startGame(id, resetBacklog) {
    if (!scenario[id]) {
      showToast("シナリオが見つかりません");
      return;
    }
    if (resetBacklog) {
      state.backlog = [];
    }
    els.titleScreen.classList.add("hidden");
    els.endingScreen.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");
    closeMenu();
    closeBacklog();
    gotoNode(id);
  }

  function startTruthRoute() {
    state.saveData = store.load();
    if (!store.isTruthUnlocked(state.saveData.endings)) {
      showToast("A/B/Cの通常END到達後に解放されます");
      return;
    }
    startGame(truthStartId, true);
  }

  function loadGame() {
    state.saveData = store.load();
    if (!scenario[state.saveData.currentId]) {
      showToast("ロードできるセーブがありません");
      return;
    }
    showToast("ロードしました");
    startGame(state.saveData.currentId, false);
  }

  function saveGame() {
    if (!state.currentNode || state.currentNode.ending) {
      showToast("ここではセーブできません");
      return;
    }
    state.saveData = store.saveCurrent(state.currentId);
    showToast("セーブしました");
  }

  function gotoNode(id) {
    const node = scenario[id];
    if (!node) {
      showToast(`未定義ノード: ${id}`);
      return;
    }

    stopText();
    const wasRead = Boolean(state.saveData.read[id]);
    state.currentId = id;
    state.currentNode = node;
    state.saveData = store.markRead(id);

    applyBackground(node.bg);
    applyEffect(node.effect);
    renderChoices([]);

    if (node.ending) {
      showEnding(node);
      return;
    }

    const speaker = node.speaker || "SYSTEM";
    els.nameBox.textContent = speaker;
    els.messageText.classList.toggle("read", wasRead);
    addBacklog(speaker, node.text || "");

    if (node.choices) {
      typeText(node.text || "どうする？", () => {
        renderChoices(node.choices);
      });
    } else {
      typeText(node.text || "", scheduleAuto);
    }
  }

  function advance() {
    if (els.titleScreen.classList.contains("hidden") === false) return;
    if (els.menuOverlay.classList.contains("hidden") === false) return;
    if (els.backlogOverlay.classList.contains("hidden") === false) return;
    if (!state.currentNode || state.currentNode.ending || state.currentNode.choices) return;

    if (state.isTyping) {
      finishText();
      return;
    }

    if (state.currentNode.next) {
      gotoNode(state.currentNode.next);
    }
  }

  function typeText(text, done) {
    stopText();
    els.messageText.textContent = "";
    els.tapIndicator.classList.add("hidden");
    state.isTyping = true;

    let index = 0;
    const speed = state.skip || els.messageText.classList.contains("read") ? 8 : 26;
    state.textTimer = window.setInterval(() => {
      index += 1;
      els.messageText.textContent = text.slice(0, index);
      if (index >= text.length) {
        stopText();
        els.messageText.textContent = text;
        els.tapIndicator.classList.remove("hidden");
        if (done) done();
      }
    }, speed);
  }

  function finishText() {
    if (!state.currentNode) return;
    stopText();
    els.messageText.textContent = state.currentNode.text || "";
    els.tapIndicator.classList.remove("hidden");
    if (state.currentNode.choices) {
      renderChoices(state.currentNode.choices);
    } else {
      scheduleAuto();
    }
  }

  function stopText() {
    window.clearInterval(state.textTimer);
    state.isTyping = false;
  }

  function renderChoices(choices) {
    els.choices.innerHTML = "";
    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-button ${choice.danger ? "danger" : ""}`;
      button.textContent = choice.label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        playSE("choice");
        gotoNode(choice.next);
      });
      els.choices.appendChild(button);
    });
  }

  function showEnding(node) {
    stopAuto();
    state.skip = false;
    playBGM("ending");
    state.saveData = store.markEnding(node.endingId);
    renderEndingRecords();
    renderTruthButton();
    els.endingTitle.textContent = node.ending;
    els.endingText.textContent = node.text;
    els.endingScreen.classList.remove("hidden");
  }

  function renderEndingRecords() {
    const data = store.load();
    els.endingRecords.innerHTML = "";
    Object.entries(window.ENDING_DEFINITIONS).forEach(([id, label]) => {
      const chip = document.createElement("span");
      chip.className = `ending-chip ${data.endings[id] ? "done" : ""}`;
      chip.textContent = `${data.endings[id] ? "到達" : "未到達"}: ${label}`;
      els.endingRecords.appendChild(chip);
    });
  }

  function renderTruthButton() {
    const data = store.load();
    const unlocked = store.isTruthUnlocked(data.endings);
    els.truthButton.classList.toggle("hidden", !unlocked);
    els.truthButton.classList.toggle("locked", !unlocked);
    els.truthButton.textContent = "Last Memory Protocol";
  }

  function applyBackground(bg) {
    els.background.className = `background bg-${bg || "room_night"}`;
  }

  function applyEffect(effect) {
    if (effect === "noise") {
      els.noiseLayer.classList.remove("burst");
      void els.noiseLayer.offsetWidth;
      els.noiseLayer.classList.add("burst");
      vibrate(28);
      playSE("noise");
    }
    if (effect === "fade") {
      els.app.classList.add("fade-out");
      window.setTimeout(() => els.app.classList.remove("fade-out"), 260);
    }
    if (effect === "shake") {
      vibrate(40);
      els.app.classList.add("shake");
      window.setTimeout(() => els.app.classList.remove("shake"), 300);
    }
  }

  function vibrate(ms) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  function addBacklog(speaker, text) {
    if (!text) return;
    state.backlog.push({ speaker, text });
    if (state.backlog.length > 80) {
      state.backlog.shift();
    }
  }

  function openMenu() {
    els.menuOverlay.classList.remove("hidden");
  }

  function closeMenu() {
    els.menuOverlay.classList.add("hidden");
  }

  function openBacklog() {
    closeMenu();
    els.backlogList.innerHTML = "";
    if (!state.backlog.length) {
      const empty = document.createElement("div");
      empty.className = "backlog-text";
      empty.textContent = "ログはまだありません。";
      els.backlogList.appendChild(empty);
    }
    state.backlog.slice().reverse().forEach((item) => {
      const row = document.createElement("div");
      row.className = "backlog-item";
      const speaker = document.createElement("div");
      speaker.className = "backlog-speaker";
      speaker.textContent = item.speaker;
      const text = document.createElement("div");
      text.className = "backlog-text";
      text.textContent = item.text;
      row.append(speaker, text);
      els.backlogList.appendChild(row);
    });
    els.backlogOverlay.classList.remove("hidden");
  }

  function closeBacklog() {
    els.backlogOverlay.classList.add("hidden");
  }

  function toggleAuto() {
    state.auto = !state.auto;
    document.getElementById("autoButton").classList.toggle("active", state.auto);
    showToast(state.auto ? "オートON" : "オートOFF");
    scheduleAuto();
  }

  function toggleSkip() {
    state.skip = !state.skip;
    document.getElementById("skipButton").classList.toggle("active", state.skip);
    showToast(state.skip ? "スキップON" : "スキップOFF");
    if (state.skip && state.isTyping) {
      finishText();
    }
    scheduleAuto();
  }

  function scheduleAuto() {
    window.clearTimeout(state.autoTimer);
    if ((!state.auto && !state.skip) || !state.currentNode || state.currentNode.choices || state.currentNode.ending) {
      return;
    }
    const wait = state.skip ? 120 : 1300;
    state.autoTimer = window.setTimeout(advance, wait);
  }

  function stopAuto() {
    window.clearTimeout(state.autoTimer);
    state.auto = false;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 1500);
  }

  window.playBGM = function playBGM(_name) {
    return null;
  };

  window.playSE = function playSE(_name) {
    return null;
  };

  window.stopBGM = function stopBGM() {
    return null;
  };
})();
