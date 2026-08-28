(function defineUI(global) {
  "use strict";
  const P = global.PythagoraLab;

  class UI {
    constructor(storage) {
      this.storage = storage;
      this.toastTimer = 0;
      this.elements = {};
      for (const id of [
        "homeScreen", "gameScreen", "stageList", "progressText", "savedWorks", "newFreeButton",
        "homeSettingsButton", "homeButton", "settingsButton", "stageNumber", "stageName", "stageDescription",
        "partsStat", "chainStat", "chainStatBox", "timeStat", "gameCanvas", "modeBadge", "chainPop",
        "fieldHint", "partInspector", "selectedPartIcon", "selectedPartName", "selectedPartPosition",
        "startButton", "stopButton", "resetButton", "undoButton", "redoButton", "speedSelect",
        "saveWorkButton", "partsPalette", "paletteHelp", "settingsOverlay", "gridToggle", "snapToggle",
        "soundToggle", "debugSetting", "debugToggle", "restartTutorialButton", "tutorialOverlay",
        "clearOverlay", "saveOverlay", "toast", "fatalError", "debugPanel"
      ]) this.elements[id] = document.getElementById(id);
    }

    renderHome() {
      const progress = this.storage.loadProgress();
      const cleared = P.STAGES.filter((stage) => progress[stage.id]).length;
      this.elements.progressText.textContent = `${cleared} / ${P.STAGES.length} CLEAR`;
      this.elements.stageList.innerHTML = P.STAGES.map((stage) => {
        const result = progress[stage.id];
        const stars = result ? "★".repeat(result.stars) + "☆".repeat(3 - result.stars) : "☆☆☆";
        return `<button class="stage-card" type="button" data-stage-id="${stage.id}" data-number="${stage.number}">
          <span class="card-number">${String(stage.number).padStart(2, "0")}</span>
          <span class="card-stars" aria-label="${result ? `${result.stars}つ星` : "未クリア"}">${stars}</span>
          <strong>${stage.name}</strong><small>${stage.short || stage.description}</small>
        </button>`;
      }).join("");
      this.renderSavedWorks();
    }

    renderSavedWorks() {
      const works = this.storage.listWorks();
      this.elements.savedWorks.innerHTML = works.length ? works.map((work) => `
        <div class="saved-work"><button type="button" data-load-work="${work.id}">${this.escape(work.name || "名前のない工作")}</button>
        <button class="delete-save" type="button" data-delete-work="${work.id}" aria-label="${this.escape(work.name || "工作")}を削除">×</button></div>
      `).join("") : "";
    }

    renderPalette(stage, designParts = []) {
      const entries = Object.entries(stage.availableParts || {});
      this.elements.partsPalette.innerHTML = entries.map(([type, total]) => {
        const def = P.PART_DEFS[type];
        const used = designParts.filter((part) => part.type === type).length;
        const remaining = total === Infinity ? "∞" : Math.max(0, total - used);
        const empty = remaining === 0;
        return `<button type="button" data-add-part="${type}" ${empty ? "disabled" : ""} class="${empty ? "is-empty" : ""}">
          <span class="palette-icon" aria-hidden="true">${def.icon}</span>
          <span class="palette-copy"><strong>${def.name}</strong><small>残り ${remaining}</small></span>
        </button>`;
      }).join("");
    }

    showGame(stage) {
      this.elements.homeScreen.hidden = true;
      this.elements.gameScreen.hidden = false;
      this.elements.stageNumber.textContent = stage.id.startsWith("free") ? "FREE BUILD" : `STAGE ${stage.number}`;
      this.elements.stageName.textContent = stage.name;
      this.elements.stageDescription.textContent = stage.description;
      this.renderPalette(stage);
    }

    showHome() {
      this.elements.gameScreen.hidden = true;
      this.elements.homeScreen.hidden = false;
      this.closeAllOverlays();
      this.renderHome();
    }

    update(state) {
      if (!state.stage) return;
      const max = state.stage.maxParts === Infinity ? "∞" : state.stage.maxParts;
      this.elements.partsStat.textContent = `${state.usedParts} / ${max}`;
      this.elements.chainStat.textContent = String(state.chain);
      this.elements.timeStat.textContent = P.util.formatTime(state.elapsed);
      const running = ["running", "replay", "clear-pending"].includes(state.mode);
      this.elements.modeBadge.classList.toggle("is-edit", !running);
      this.elements.modeBadge.classList.toggle("is-running", running);
      this.elements.modeBadge.innerHTML = `<span></span>${running ? state.mode === "replay" ? "リプレイ中" : "実験モード" : "編集モード"}`;
      this.elements.startButton.disabled = running || state.mode === "cleared";
      this.elements.stopButton.disabled = !running;
      this.elements.resetButton.disabled = false;
      this.elements.undoButton.disabled = running || !state.canUndo;
      this.elements.redoButton.disabled = running || !state.canRedo;
      this.elements.speedSelect.disabled = !running;
      this.elements.partInspector.hidden = !state.selectedPart || running;
      if (state.selectedPart) this.updateInspector(state.selectedPart);
      this.renderPalette(state.stage, state.parts.filter((part) => !part.locked));
    }

    updateInspector(part) {
      this.elements.selectedPartIcon.textContent = part.def.icon;
      this.elements.selectedPartName.textContent = part.def.name;
      this.elements.selectedPartPosition.textContent = `X ${Math.round(part.x)} · Y ${Math.round(part.y)} · ${Math.round(P.util.degrees(part.angle))}°`;
    }

    bumpChain(value) {
      this.elements.chainPop.textContent = `${value} CHAIN!`;
      this.elements.chainPop.classList.remove("show");
      void this.elements.chainPop.offsetWidth;
      this.elements.chainPop.classList.add("show");
      this.elements.chainStatBox.classList.remove("chain-bump");
      void this.elements.chainStatBox.offsetWidth;
      this.elements.chainStatBox.classList.add("chain-bump");
    }

    setHint(message, persist = false) {
      this.elements.fieldHint.textContent = message;
      this.elements.fieldHint.classList.remove("is-hidden");
      if (!persist) global.setTimeout(() => this.elements.fieldHint.classList.add("is-hidden"), 2400);
    }

    openOverlay(id) {
      const overlay = document.getElementById(id);
      if (overlay) overlay.hidden = false;
    }

    closeOverlay(id) {
      const overlay = document.getElementById(id);
      if (overlay) overlay.hidden = true;
    }

    closeAllOverlays() {
      document.querySelectorAll(".overlay").forEach((overlay) => { overlay.hidden = true; });
    }

    toast(message) {
      global.clearTimeout(this.toastTimer);
      this.elements.toast.textContent = message;
      this.elements.toast.hidden = false;
      this.toastTimer = global.setTimeout(() => { this.elements.toast.hidden = true; }, 1900);
    }

    fatal() {
      this.elements.fatalError.hidden = false;
    }

    escape(value) {
      const span = document.createElement("span");
      span.textContent = String(value);
      return span.innerHTML;
    }
  }

  P.UI = UI;
})(window);
