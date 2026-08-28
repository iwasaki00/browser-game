(function applyReleaseConfiguration(global) {
  "use strict";
  const P = global.PythagoraLab;

  const stages = P.util.deepClone(P.STAGES);

  const stage1 = stages.find((stage) => stage.id === "stage-1");
  stage1.debugSolution = [
    { type: "ramp", x: 300, y: 240, width: 480, angle: P.util.radians(24) }
  ];

  const stage2 = stages.find((stage) => stage.id === "stage-2");
  stage2.goalPosition = { x: 625, y: 354, width: 170, height: 106 };
  stage2.fixedObjects.find((part) => part.id === "s2-waiting-ball").x = 520;
  stage2.starterParts = [
    { id: "s2-domino-a", type: "domino", x: 330, y: 372 },
    { id: "s2-domino-b", type: "domino", x: 362, y: 372 }
  ];
  stage2.debugSolution = [330, 362, 394, 426, 458].map((x) => {
    return { type: "domino", x, y: 372 };
  });

  const stage3 = stages.find((stage) => stage.id === "stage-3");
  stage3.goalPosition = { x: 700, y: 270, width: 130, height: 110 };
  stage3.starterParts.find((part) => part.type === "seesaw").x = 500;

  const stage4 = stages.find((stage) => stage.id === "stage-4");
  stage4.goalPosition = { x: 650, y: 170, width: 130, height: 100 };
  stage4.starterParts.find((part) => part.type === "spring").angle = 0;

  const stage5 = stages.find((stage) => stage.id === "stage-5");
  stage5.starterParts.find((part) => part.type === "spring").angle = 0;

  P.STAGES = Object.freeze(stages.map((stage) => Object.freeze(stage)));

  const originalDefaultPlacement = P.Game.prototype.defaultPartPlacement;
  P.Game.prototype.defaultPartPlacement = function releaseDefaultPartPlacement(type) {
    const placement = originalDefaultPlacement.call(this, type);
    if (this.stage?.id === "stage-1" && type === "ramp") {
      placement.x = 300;
      placement.y = 240;
      placement.width = 480;
      placement.angle = P.util.radians(24);
    }
    if (this.stage?.id === "stage-2" && type === "domino") {
      placement.x = 330 + this.countType(type) * 32;
      placement.y = 372;
    }
    return placement;
  };

  const originalCollisionStart = P.Game.prototype.onCollisionStart;
  P.Game.prototype.onCollisionStart = function releaseCollisionStart(detail) {
    const partA = this.findPart(detail.metaA.partId);
    const partB = this.findPart(detail.metaB.partId);
    if (partA && partB) {
      const ball = partA.type === "ball" ? partA : partB.type === "ball" ? partB : null;
      const goal = partA.type === "goal" ? partA : partB.type === "goal" ? partB : null;
      if (ball && goal && ["running", "replay"].includes(this.mode)) {
        this.registerChainEvent(ball, goal, "goal-arrival");
      }

      const waitingBall = partA.type === "ball" && partA.settings?.role === "waiting"
        ? partA
        : partB.type === "ball" && partB.settings?.role === "waiting" ? partB : null;
      const domino = partA.type === "domino" ? partA : partB.type === "domino" ? partB : null;
      if (waitingBall?.body && domino && this.stage?.id === "stage-2") {
        global.Matter.Body.setVelocity(waitingBall.body, { x: 5.8, y: -0.25 });
      }
    }
    return originalCollisionStart.call(this, detail);
  };

  const originalCollisionActive = P.Game.prototype.onCollisionActive;
  P.Game.prototype.onCollisionActive = function releaseCollisionActive(detail) {
    const requiredChain = this.stage.clearConditions?.minChain || 0;
    if (
      this.goalState === "idle" &&
      ["running", "replay"].includes(this.mode) &&
      this.chain >= requiredChain
    ) {
      const partA = this.findPart(detail.metaA.partId);
      const partB = this.findPart(detail.metaB.partId);
      const ball = partA?.type === "ball" ? partA : partB?.type === "ball" ? partB : null;
      const goal = partA?.type === "goal" ? partA : partB?.type === "goal" ? partB : null;
      if (ball && goal) {
        this.goalState = "candidate";
        this.goalCandidate = {
          ballId: ball.id,
          goalId: goal.id,
          startedAt: this.elapsed * 1000 - P.CONFIG.clearDwellMs
        };
      }
    }
    return originalCollisionActive.call(this, detail);
  };

  const originalRenderPalette = P.UI.prototype.renderPalette;
  P.UI.prototype.renderPalette = function cachedRenderPalette(stage, designParts = []) {
    const locked = Boolean(this.paletteLocked);
    const counts = Object.keys(stage.availableParts || {}).map((type) => {
      return `${type}:${designParts.filter((part) => part.type === type).length}`;
    }).join("|");
    const key = `${stage.id}|${locked ? "locked" : "edit"}|${counts}`;
    if (this.paletteRenderKey === key) return;

    const scrollLeft = this.elements.partsPalette.scrollLeft;
    originalRenderPalette.call(this, stage, designParts);
    if (locked) {
      this.elements.partsPalette.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
        button.classList.add("is-run-locked");
      });
    }
    this.elements.partsPalette.scrollLeft = scrollLeft;
    this.paletteRenderKey = key;
  };

  P.UI.prototype.update = function efficientUpdate(state) {
    if (!state.stage) return;
    const max = state.stage.maxParts === Infinity ? "∞" : state.stage.maxParts;
    const partsText = `${state.usedParts} / ${max}`;
    const chainText = String(state.chain);
    const timeText = P.util.formatTime(state.elapsed);
    if (this.elements.partsStat.textContent !== partsText) this.elements.partsStat.textContent = partsText;
    if (this.elements.chainStat.textContent !== chainText) this.elements.chainStat.textContent = chainText;
    if (this.elements.timeStat.textContent !== timeText) this.elements.timeStat.textContent = timeText;

    const running = ["running", "replay", "clear-pending"].includes(state.mode);
    const editing = state.mode === "edit";
    const modeText = running ? state.mode === "replay" ? "リプレイ中" : "実験モード" : "編集モード";
    this.elements.modeBadge.classList.toggle("is-edit", !running);
    this.elements.modeBadge.classList.toggle("is-running", running);
    if (this.elements.modeBadge.dataset.modeText !== modeText) {
      this.elements.modeBadge.innerHTML = `<span></span>${modeText}`;
      this.elements.modeBadge.dataset.modeText = modeText;
    }

    this.elements.startButton.disabled = running || state.mode === "cleared";
    this.elements.stopButton.disabled = !running;
    this.elements.resetButton.disabled = false;
    this.elements.undoButton.disabled = !editing || !state.canUndo;
    this.elements.redoButton.disabled = !editing || !state.canRedo;
    this.elements.speedSelect.disabled = !running;
    this.elements.partInspector.hidden = !state.selectedPart || !editing;
    if (state.selectedPart && editing) this.updateInspector(state.selectedPart);

    this.paletteLocked = !editing;
    this.renderPalette(state.stage, state.parts.filter((part) => !part.locked));
  };

  const style = document.createElement("style");
  style.dataset.releasePolish = "true";
  style.textContent = `
    .parts-palette button.is-run-locked {
      filter: grayscale(.45);
      opacity: .55;
    }

    @media (orientation: landscape) and (max-height: 540px) and (max-width: 760px) {
      .game-hud {
        grid-template-columns: 43px minmax(130px, 1fr) auto 43px;
        grid-template-areas: "home heading stats settings";
      }
      .stats-strip {
        grid-template-columns: repeat(3, minmax(42px, 1fr));
        width: auto;
      }
    }
  `;
  document.head.appendChild(style);
})(window);
