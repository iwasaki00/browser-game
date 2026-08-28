(function defineApplication(global) {
  "use strict";
  const P = global.PythagoraLab;

  P.startApplication = function startApplication() {
    if (!global.Matter || !P) {
      document.getElementById("fatalError").hidden = false;
      return;
    }

    const byId = (id) => document.getElementById(id);
    const storage = new P.StorageManager();
    const audio = new P.AudioManager();
    const ui = new P.UI(storage);
    const renderer = new P.Renderer(ui.elements.gameCanvas);
    const settings = storage.loadSettings();
    const runtimeErrors = [];
    let currentStage = null;
    let currentWork = null;
    let resizeFrame = 0;
    let lastFrameAt = performance.now();
    let frameCount = 0;
    let fps = 0;
    let fpsStartedAt = performance.now();
    let tutorialIndex = 0;

    const tutorialSteps = [
      { icon: "▰", title: "部品を選ぶ", text: "下の部品箱から、使いたい部品をタップします。" },
      { icon: "☝", title: "ドラッグして移動", text: "フィールドの部品を指でつかみ、置きたい場所へ動かします。" },
      { icon: "↷", title: "15°ずつ回転", text: "部品を選ぶと出る編集パネルで、角度を少しずつ変えられます。" },
      { icon: "▶", title: "実験スタート", text: "「実験」を押すとボールが出て、装置がいっせいに動きます。" },
      { icon: "↻", title: "すぐリセット", text: "失敗しても大丈夫。リセットで実験前の配置へ戻ります。" },
      { icon: "✦", title: "もう少しだけ調整", text: "位置や角度を少し直して再実験。気持ちいい連鎖を完成させよう！" }
    ];

    const game = new P.Game({
      onChange(state) {
        ui.update(state);
        renderer.setOptions({ grid: game.settings.grid, debug: game.settings.debug });
      },
      onModeChange(mode) {
        if (mode === "running" || mode === "replay") ui.setHint(mode === "replay" ? "完成した装置をリプレイ中…" : "装置を見守ろう…", true);
        if (mode === "edit") ui.setHint("部品を動かして、もう一度試そう");
      },
      onChain(value, detail) {
        ui.bumpChain(value);
        const domino = detail.partA.type === "domino" || detail.partB.type === "domino";
        audio.play(domino ? "domino" : "wood", 0.6);
      },
      onSpring() { audio.play("spring"); },
      onSwitch() { audio.play("switch"); },
      onGoal() {
        ui.setHint("GOAL! 連鎖の余韻を楽しもう", true);
        audio.play("goal");
      },
      onClear(result) {
        if (!currentStage.free) storage.saveStageResult(result.stageId, result);
        audio.play("clear");
        showClearResult(result);
      },
      onHint(message) { ui.setHint(message); }
    });
    game.setSettings(settings);
    audio.setEnabled(settings.sound);
    const input = new P.InputController(ui.elements.gameCanvas, renderer, game);

    function openStage(stageId) {
      currentWork = null;
      currentStage = P.getStage(stageId);
      ui.showGame(currentStage);
      ui.elements.saveWorkButton.hidden = true;
      game.loadStage(currentStage);
      renderer.setStage(currentStage);
      scheduleResize();
      global.setTimeout(() => {
        const hints = {
          "stage-1": "下の坂道をタップして置いてみよう",
          "stage-2": "残りのドミノをタップして、すき間をつなごう",
          "stage-3": "箱・シーソー・坂道の位置を調整しよう",
          "stage-4": "バネの向きがGOALを向くように調整しよう",
          "stage-5": "まずはこの配置で実験し、止まった場所を直そう"
        };
        ui.setHint(hints[currentStage.id] || currentStage.description, true);
      }, 80);
      if (!storage.hasSeenTutorial()) showTutorial(false);
    }

    function openFree(work = null) {
      currentWork = work ? P.util.deepClone(work) : null;
      currentStage = P.createFreeStage(work);
      ui.showGame(currentStage);
      ui.elements.saveWorkButton.hidden = false;
      game.loadStage(currentStage);
      renderer.setStage(currentStage);
      scheduleResize();
      ui.setHint("STARTとGOALを動かし、好きな部品を組み合わせよう", true);
    }

    function scheduleResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => renderer.resize());
    }

    function showTutorial(force) {
      if (!force && storage.hasSeenTutorial()) return;
      tutorialIndex = 0;
      renderTutorial();
      ui.openOverlay("tutorialOverlay");
    }

    function renderTutorial() {
      const step = tutorialSteps[tutorialIndex];
      byId("tutorialCount").textContent = `${tutorialIndex + 1} / ${tutorialSteps.length}`;
      byId("tutorialVisual").textContent = step.icon;
      byId("tutorialTitle").textContent = step.title;
      byId("tutorialText").textContent = step.text;
      byId("nextTutorialButton").textContent = tutorialIndex === tutorialSteps.length - 1 ? "工作を始める" : "次へ";
    }

    function finishTutorial() {
      storage.markTutorialSeen(true);
      ui.closeOverlay("tutorialOverlay");
    }

    function showClearResult(result) {
      byId("starRating").textContent = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
      byId("starRating").setAttribute("aria-label", `${result.stars}つ星`);
      byId("resultParts").textContent = String(result.parts);
      byId("resultChain").textContent = String(result.chain);
      byId("resultTime").textContent = P.util.formatTime(result.time);
      const stageIndex = P.STAGES.findIndex((stage) => stage.id === result.stageId);
      const hasNext = stageIndex >= 0 && stageIndex < P.STAGES.length - 1;
      byId("nextStageButton").textContent = hasNext ? "次のステージ" : "ステージ一覧へ";
      byId("nextStageButton").dataset.nextStage = hasNext ? P.STAGES[stageIndex + 1].id : "home";
      ui.openOverlay("clearOverlay");
    }

    function openSaveDialog() {
      byId("workNameInput").value = currentWork?.name || currentStage?.workName || "";
      ui.openOverlay("saveOverlay");
      global.setTimeout(() => byId("workNameInput").focus(), 50);
    }

    function updateSettings() {
      const next = {
        grid: ui.elements.gridToggle.checked,
        snap: ui.elements.snapToggle.checked,
        sound: ui.elements.soundToggle.checked,
        debug: P.DEBUG && ui.elements.debugToggle.checked
      };
      game.setSettings(next);
      audio.setEnabled(next.sound);
      storage.saveSettings(next);
      ui.elements.debugPanel.hidden = !next.debug;
    }

    ui.renderHome();
    ui.elements.debugSetting.hidden = !P.DEBUG;
    ui.elements.gridToggle.checked = settings.grid;
    ui.elements.snapToggle.checked = settings.snap;
    ui.elements.soundToggle.checked = settings.sound;
    ui.elements.debugToggle.checked = P.DEBUG && settings.debug;

    ui.elements.stageList.addEventListener("click", (event) => {
      const card = event.target.closest("[data-stage-id]");
      if (!card) return;
      void audio.unlock().then(() => audio.play("ui"));
      openStage(card.dataset.stageId);
    });

    ui.elements.savedWorks.addEventListener("click", (event) => {
      const loadButton = event.target.closest("[data-load-work]");
      const deleteButton = event.target.closest("[data-delete-work]");
      if (loadButton) {
        const work = storage.listWorks().find((item) => item.id === loadButton.dataset.loadWork);
        if (work) openFree(work);
      }
      if (deleteButton) {
        storage.deleteWork(deleteButton.dataset.deleteWork);
        ui.renderSavedWorks();
        ui.toast("保存した工作を削除しました");
      }
    });

    ui.elements.newFreeButton.addEventListener("click", () => {
      void audio.unlock().then(() => audio.play("ui"));
      openFree();
    });

    ui.elements.partsPalette.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-part]");
      if (!button || button.disabled) return;
      void audio.unlock().then(() => audio.play("ui"));
      const part = game.addPart(button.dataset.addPart);
      if (part) ui.setHint(`${part.def.name}を追加しました。ドラッグで移動できます`);
    });

    ui.elements.startButton.addEventListener("click", () => {
      void audio.unlock().then(() => {
        audio.play("ui");
        game.startExperiment();
      });
    });
    ui.elements.stopButton.addEventListener("click", () => { audio.play("ui"); game.stopExperiment(); });
    ui.elements.resetButton.addEventListener("click", () => { audio.play("ui"); game.reset(); });
    ui.elements.undoButton.addEventListener("click", () => { audio.play("ui"); game.undo(); });
    ui.elements.redoButton.addEventListener("click", () => { audio.play("ui"); game.redo(); });
    ui.elements.speedSelect.addEventListener("change", () => game.setSpeed(Number(ui.elements.speedSelect.value)));
    ui.elements.saveWorkButton.addEventListener("click", openSaveDialog);

    document.querySelector(".inspector-actions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-part-action]");
      if (!button) return;
      audio.play("ui");
      const action = button.dataset.partAction;
      if (action === "rotate-left") game.rotateSelected(-1);
      if (action === "rotate-right") game.rotateSelected(1);
      if (action === "duplicate" && !game.duplicateSelected()) ui.toast("この部品はもう追加できません");
      if (action === "delete") game.deleteSelected();
    });

    ui.elements.homeButton.addEventListener("click", () => {
      if (["running", "replay", "clear-pending"].includes(game.mode)) game.stopExperiment();
      ui.showHome();
      currentStage = null;
      currentWork = null;
    });

    for (const button of [ui.elements.settingsButton, ui.elements.homeSettingsButton]) {
      button.addEventListener("click", () => ui.openOverlay("settingsOverlay"));
    }
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close-overlay]");
      if (close) ui.closeOverlay(close.dataset.closeOverlay);
    });
    for (const overlayId of ["settingsOverlay", "saveOverlay"]) {
      byId(overlayId).addEventListener("pointerdown", (event) => {
        if (event.target === byId(overlayId)) ui.closeOverlay(overlayId);
      });
    }
    for (const toggle of [ui.elements.gridToggle, ui.elements.snapToggle, ui.elements.soundToggle, ui.elements.debugToggle]) {
      toggle.addEventListener("change", updateSettings);
    }

    ui.elements.restartTutorialButton.addEventListener("click", () => {
      ui.closeOverlay("settingsOverlay");
      showTutorial(true);
    });
    byId("skipTutorialButton").addEventListener("click", finishTutorial);
    byId("nextTutorialButton").addEventListener("click", () => {
      if (tutorialIndex >= tutorialSteps.length - 1) finishTutorial();
      else { tutorialIndex += 1; renderTutorial(); }
    });

    byId("replayButton").addEventListener("click", () => {
      ui.closeOverlay("clearOverlay");
      game.startExperiment({ replay: true });
    });
    byId("returnToEditButton").addEventListener("click", () => {
      ui.closeOverlay("clearOverlay");
      game.stopExperiment();
    });
    byId("nextStageButton").addEventListener("click", () => {
      const next = byId("nextStageButton").dataset.nextStage;
      ui.closeOverlay("clearOverlay");
      if (next === "home") {
        ui.showHome();
        currentStage = null;
      } else openStage(next);
    });

    byId("saveForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = byId("workNameInput").value.trim() || "名前のない工作";
      const saved = storage.saveWork(game.exportWork(name, currentWork?.id || currentStage?.workId || null));
      currentWork = saved;
      currentStage.workId = saved.id;
      currentStage.workName = saved.name;
      currentStage.name = saved.name;
      ui.elements.stageName.textContent = saved.name;
      ui.closeOverlay("saveOverlay");
      ui.toast("工作をブラウザに保存しました");
    });

    function animationFrame(now) {
      const delta = Math.min(P.CONFIG.maxFrameDelta, Math.max(0, now - lastFrameAt));
      lastFrameAt = now;
      frameCount += 1;
      if (now - fpsStartedAt >= 500) {
        fps = Math.round(frameCount * 1000 / (now - fpsStartedAt));
        frameCount = 0;
        fpsStartedAt = now;
      }
      game.update(delta);
      if (!ui.elements.gameScreen.hidden && currentStage) {
        const state = game.getState();
        renderer.draw(state, now);
        if (game.settings.debug) {
          const selected = state.selectedPart?.body;
          ui.elements.debugPanel.textContent = [
            `FPS ${fps || "--"}`,
            `MODE ${state.mode.toUpperCase()}  SPEED ×${game.speed}`,
            `BODIES ${state.bodyCount}  CONSTRAINTS ${state.constraintCount}`,
            `CAM ${renderer.camera.x.toFixed(1)},${renderer.camera.y.toFixed(1)} ×${renderer.camera.zoom.toFixed(2)}`,
            `SELECT ${selected ? `#${selected.id} X${selected.position.x.toFixed(1)} Y${selected.position.y.toFixed(1)} A${selected.angle.toFixed(3)}` : "none"}`,
            `VELOCITY ${selected ? `${selected.velocity.x.toFixed(2)},${selected.velocity.y.toFixed(2)}  AV ${selected.angularVelocity.toFixed(3)}` : "--"}`,
            `COLLISION ${state.lastCollision}`,
            `CHAIN ${state.chain}  GOAL ${state.goalState}`
          ].join("\n");
        }
      }
      requestAnimationFrame(animationFrame);
    }
    requestAnimationFrame(animationFrame);

    global.addEventListener("resize", scheduleResize);
    global.addEventListener("orientationchange", scheduleResize);
    global.visualViewport?.addEventListener("resize", scheduleResize);
    if (global.ResizeObserver) new ResizeObserver(scheduleResize).observe(byId("fieldShell"));
    global.addEventListener("error", (event) => runtimeErrors.push(String(event.error?.stack || event.message || event.error)));
    global.addEventListener("unhandledrejection", (event) => runtimeErrors.push(String(event.reason?.stack || event.reason)));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (["running", "replay", "clear-pending"].includes(game.mode)) game.stopExperiment();
        audio.suspend();
      }
      lastFrameAt = performance.now();
    });

    global.__PYTHAGORA_TEST__ = Object.freeze({
      game, renderer, ui, storage,
      openStage,
      openFree,
      snapshot: () => game.getState(),
      errors: () => runtimeErrors.slice(),
      loadSolution(stageId) {
        openStage(stageId);
        return game.loadDebugSolution();
      },
      resetRepeatedly(count = 10) {
        const baseline = { bodies: game.physics.bodyCount, constraints: game.physics.constraintCount };
        const counts = [];
        for (let index = 0; index < count; index += 1) {
          game.startExperiment();
          game.stopExperiment();
          counts.push({ bodies: game.physics.bodyCount, constraints: game.physics.constraintCount });
        }
        return { baseline, counts, stable: counts.every((item) => item.bodies === baseline.bodies && item.constraints === baseline.constraints) };
      },
      coordinateRoundTrip(x, y) {
        const screen = renderer.worldToScreen(x, y);
        const rect = renderer.canvas.getBoundingClientRect();
        const world = renderer.screenToWorld(screen.x + rect.left, screen.y + rect.top);
        return { screen, world, error: Math.hypot(world.x - x, world.y - y) };
      }
    });
  };
})(window);
