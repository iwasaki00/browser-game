(function defineGame(global) {
  "use strict";
  const P = global.PythagoraLab;
  const M = global.Matter;

  class Game {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.history = new P.HistoryManager();
      this.physics = new P.PhysicsWorld({
        onCollisionStart: (detail) => this.onCollisionStart(detail),
        onCollisionActive: (detail) => this.onCollisionActive(detail)
      });
      this.stage = null;
      this.mode = "edit";
      this.fixedParts = [];
      this.designParts = [];
      this.runtimeParts = [];
      this.selectedId = null;
      this.runSnapshot = null;
      this.accumulator = 0;
      this.elapsed = 0;
      this.speed = 1;
      this.chain = 0;
      this.chainSeen = new Map();
      this.goalState = "idle";
      this.goalCandidate = null;
      this.clearPendingElapsed = 0;
      this.clearResult = null;
      this.effects = [];
      this.settings = { grid: true, snap: true, sound: true, debug: false };
      this.addOffset = 0;
    }

    loadStage(stage) {
      this.stage = stage;
      this.mode = "edit";
      this.fixedParts = this.createStageFixedParts(stage);
      this.designParts = P.PartFactory.createMany(stage.starterParts || []);
      this.runtimeParts = [];
      this.selectedId = null;
      this.runSnapshot = null;
      this.accumulator = 0;
      this.elapsed = 0;
      this.chain = 0;
      this.chainSeen.clear();
      this.goalState = "idle";
      this.goalCandidate = null;
      this.clearPendingElapsed = 0;
      this.clearResult = null;
      this.effects = [];
      this.history.reset();
      this.addOffset = 0;
      this.rebuild("edit");
      this.emitChange();
    }

    createStageFixedParts(stage) {
      const fixed = P.PartFactory.createMany(stage.fixedObjects || []);
      const start = P.PartFactory.create({
        id: `${stage.id}-start`, type: "start", x: stage.startPosition.x, y: stage.startPosition.y,
        locked: true, settings: { velocity: stage.startPosition.velocity || { x: 0, y: 0 } }
      });
      const goal = P.PartFactory.create({
        id: `${stage.id}-goal`, type: "goal", x: stage.goalPosition.x, y: stage.goalPosition.y,
        width: stage.goalPosition.width, height: stage.goalPosition.height, locked: true
      });
      return [...fixed, start, goal];
    }

    rebuild(mode = this.mode) {
      const parts = [...this.fixedParts, ...this.designParts, ...this.runtimeParts];
      this.physics.rebuild(parts, mode === "edit" ? "edit" : "run");
      this.callbacks.onWorldRebuilt?.({ bodies: this.physics.bodyCount, constraints: this.physics.constraintCount });
    }

    serializeDesign() {
      return this.designParts.map((part) => part.serialize());
    }

    restoreDesign(snapshot, { preserveHistory = true } = {}) {
      this.designParts = P.PartFactory.createMany(snapshot || []);
      this.runtimeParts = [];
      this.selectedId = null;
      if (!preserveHistory) this.history.reset();
      this.mode = "edit";
      this.goalState = "idle";
      this.rebuild("edit");
      this.emitChange();
    }

    countType(type) {
      return this.designParts.filter((part) => part.type === type).length;
    }

    canAdd(type) {
      if (this.mode !== "edit" || !this.stage) return false;
      const allowance = this.stage.availableParts?.[type];
      if (allowance == null) return false;
      if (allowance !== Infinity && this.countType(type) >= allowance) return false;
      return this.stage.maxParts === Infinity || this.designParts.length < this.stage.maxParts;
    }

    defaultPartPlacement(type) {
      this.addOffset = (this.addOffset + 1) % 5;
      const def = P.PART_DEFS[type];
      const x = this.stage.fieldWidth * 0.48 + this.addOffset * 12;
      const y = this.stage.fieldHeight * 0.55 - this.addOffset * 7;
      const defaults = {
        ramp: { angle: P.util.radians(24), width: Math.min(300, this.stage.fieldWidth * 0.4) },
        wall: { angle: 0 },
        domino: { y: this.stage.fieldHeight - 68 },
        box: { y: this.stage.fieldHeight * 0.35 },
        spring: { y: this.stage.fieldHeight - 58 },
        seesaw: { y: this.stage.fieldHeight - 98 },
        pendulum: { y: this.stage.fieldHeight * 0.48 },
        switch: { y: this.stage.fieldHeight - 45 },
        goal: { y: this.stage.fieldHeight - 70 },
        start: { x: this.stage.fieldWidth * 0.18, y: this.stage.fieldHeight * 0.25 }
      };
      return Object.assign({ type, x, y, width: def.width, height: def.height, angle: 0 }, defaults[type] || {});
    }

    addPart(type, placement = null) {
      if (!this.canAdd(type)) return null;
      const before = this.serializeDesign();
      const part = P.PartFactory.create(Object.assign(this.defaultPartPlacement(type), placement || {}));
      this.designParts.push(part);
      part.create(this.physics.world, "edit");
      this.selectedId = part.id;
      this.history.push(before, this.serializeDesign());
      this.effects.push({ x: part.x, y: part.y, color: part.def.color, startedAt: performance.now(), duration: 420 });
      this.emitChange();
      return part;
    }

    get selectedPart() {
      return this.designParts.find((part) => part.id === this.selectedId) || null;
    }

    selectPart(part) {
      this.selectedId = part?.movable ? part.id : null;
      this.emitChange();
      return this.selectedPart;
    }

    partAt(point, scale = 1) {
      if (this.mode !== "edit") return null;
      const padding = Math.max(10, 22 / Math.max(scale, 0.1));
      for (let index = this.designParts.length - 1; index >= 0; index -= 1) {
        const part = this.designParts[index];
        if (part.movable && part.hitTest(point, padding)) return part;
      }
      return null;
    }

    movePart(part, point) {
      if (this.mode !== "edit" || !part?.movable) return;
      const width = part.width / 2;
      const height = part.height / 2;
      let x = P.util.clamp(point.x, width, this.stage.fieldWidth - width);
      let y = P.util.clamp(point.y, height, this.stage.fieldHeight - height);
      if (this.settings.snap) {
        x = P.util.snap(x);
        y = P.util.snap(y);
      }
      part.setPosition(x, y);
      this.emitChange(false);
    }

    rotateSelected(direction) {
      const part = this.selectedPart;
      if (this.mode !== "edit" || !part?.rotatable) return false;
      const before = this.serializeDesign();
      part.setAngle(part.angle + P.util.radians(15) * Math.sign(direction || 1));
      this.history.push(before, this.serializeDesign());
      this.emitChange();
      return true;
    }

    duplicateSelected() {
      const part = this.selectedPart;
      if (!part || !this.canAdd(part.type)) return null;
      const copy = part.serialize();
      delete copy.id;
      copy.x += 24;
      copy.y += 18;
      return this.addPart(part.type, copy);
    }

    deleteSelected() {
      const part = this.selectedPart;
      if (!part || this.mode !== "edit") return false;
      const before = this.serializeDesign();
      part.destroy(this.physics.world);
      this.designParts = this.designParts.filter((item) => item !== part);
      this.selectedId = null;
      this.history.push(before, this.serializeDesign());
      this.emitChange();
      return true;
    }

    commitDrag(beforeSnapshot) {
      this.history.push(beforeSnapshot, this.serializeDesign());
      this.emitChange();
    }

    undo() {
      if (this.mode !== "edit") return false;
      const snapshot = this.history.undo(this.serializeDesign());
      if (!snapshot) return false;
      this.restoreDesign(snapshot);
      return true;
    }

    redo() {
      if (this.mode !== "edit") return false;
      const snapshot = this.history.redo(this.serializeDesign());
      if (!snapshot) return false;
      this.restoreDesign(snapshot);
      return true;
    }

    startExperiment({ replay = false } = {}) {
      if (!this.stage || !["edit", "cleared"].includes(this.mode)) return false;
      if (this.mode === "edit") this.runSnapshot = this.serializeDesign();
      if (!this.runSnapshot) this.runSnapshot = this.serializeDesign();
      this.designParts = P.PartFactory.createMany(this.runSnapshot);
      this.fixedParts = this.createStageFixedParts(this.stage);
      this.runtimeParts = [];
      this.mode = replay ? "replay" : "running";
      this.selectedId = null;
      this.accumulator = 0;
      this.elapsed = 0;
      this.chain = 0;
      this.chainSeen.clear();
      this.goalState = "idle";
      this.goalCandidate = null;
      this.clearPendingElapsed = 0;
      this.clearResult = null;
      this.effects = [];

      const startPart = [...this.fixedParts, ...this.designParts].find((part) => part.type === "start");
      const startData = startPart || { x: this.stage.startPosition.x, y: this.stage.startPosition.y, settings: {} };
      const startBall = P.PartFactory.create({
        id: P.util.uid("run-ball"), type: "ball", x: startData.x, y: startData.y,
        settings: { source: "start" }, locked: true
      });
      this.runtimeParts.push(startBall);
      this.rebuild("run");
      const velocity = startData.settings?.velocity || this.stage.startPosition.velocity || { x: 0, y: 0 };
      if (startBall.body) M.Body.setVelocity(startBall.body, velocity);
      this.callbacks.onModeChange?.(this.mode);
      this.emitChange();
      return true;
    }

    stopExperiment() {
      if (!this.runSnapshot) return false;
      this.fixedParts = this.createStageFixedParts(this.stage);
      this.designParts = P.PartFactory.createMany(this.runSnapshot);
      this.runtimeParts = [];
      this.mode = "edit";
      this.selectedId = null;
      this.accumulator = 0;
      this.elapsed = 0;
      this.chain = 0;
      this.chainSeen.clear();
      this.goalState = "idle";
      this.goalCandidate = null;
      this.clearPendingElapsed = 0;
      this.clearResult = null;
      this.effects = [];
      this.rebuild("edit");
      this.callbacks.onModeChange?.(this.mode);
      this.emitChange();
      return true;
    }

    reset() {
      if (this.mode === "edit" && !this.runSnapshot) {
        this.loadStage(this.stage);
        return true;
      }
      return this.stopExperiment();
    }

    update(frameDelta) {
      if (!["running", "replay", "clear-pending"].includes(this.mode)) return;
      const delta = Math.min(P.CONFIG.maxFrameDelta, Math.max(0, frameDelta));
      this.accumulator += delta * this.speed;
      let steps = 0;
      while (this.accumulator >= P.CONFIG.fixedStep && steps < P.CONFIG.maxSubSteps) {
        this.physics.update(P.CONFIG.fixedStep);
        this.elapsed += P.CONFIG.fixedStep / 1000;
        if (this.mode === "clear-pending") this.clearPendingElapsed += P.CONFIG.fixedStep;
        this.accumulator -= P.CONFIG.fixedStep;
        steps += 1;
      }
      if (steps >= P.CONFIG.maxSubSteps) this.accumulator = 0;
      this.effects = this.effects.filter((effect) => performance.now() - effect.startedAt < effect.duration);

      if (this.mode === "clear-pending" && this.clearPendingElapsed >= P.CONFIG.clearCelebrationMs && !this.clearResult) {
        this.finishClear();
      }
      this.emitChange(false);
    }

    onCollisionStart(detail) {
      if (!["running", "replay", "clear-pending"].includes(this.mode)) return;
      const partA = this.findPart(detail.metaA.partId);
      const partB = this.findPart(detail.metaB.partId);
      if (!partA || !partB || partA === partB) return;
      const ball = partA.type === "ball" ? partA : partB.type === "ball" ? partB : null;
      const goal = partA.type === "goal" ? partA : partB.type === "goal" ? partB : null;
      if (ball && goal && this.goalState === "idle") {
        this.goalState = "candidate";
        this.goalCandidate = { ballId: ball.id, goalId: goal.id, startedAt: this.elapsed * 1000 };
      }
      this.considerChain(partA, partB, detail);
    }

    onCollisionActive(detail) {
      if (this.goalState !== "candidate" || !this.goalCandidate) return;
      const ids = [detail.metaA.partId, detail.metaB.partId];
      if (!ids.includes(this.goalCandidate.ballId) || !ids.includes(this.goalCandidate.goalId)) return;
      if (this.elapsed * 1000 - this.goalCandidate.startedAt >= P.CONFIG.clearDwellMs) this.latchClear();
    }

    considerChain(partA, partB, detail) {
      if (this.mode === "clear-pending") return;
      if (!P.CHAIN_ACTIVE_TYPES.has(partA.type) || !P.CHAIN_ACTIVE_TYPES.has(partB.type)) return;
      if (partA.type === "goal" || partB.type === "goal") return;
      const relativeX = detail.bodyA.velocity.x - detail.bodyB.velocity.x;
      const relativeY = detail.bodyA.velocity.y - detail.bodyB.velocity.y;
      if (Math.hypot(relativeX, relativeY) < 0.65 && ![partA.type, partB.type].includes("spring")) return;
      const key = [partA.id, partB.id].sort().join("|");
      const now = this.elapsed * 1000;
      if (now - (this.chainSeen.get(key) ?? -Infinity) < P.CONFIG.chainCooldownMs) return;
      this.chainSeen.set(key, now);
      this.chain += 1;
      const x = (detail.bodyA.position.x + detail.bodyB.position.x) / 2;
      const y = (detail.bodyA.position.y + detail.bodyB.position.y) / 2;
      this.effects.push({ x, y, color: "#ef5b45", startedAt: performance.now(), duration: 520 });
      this.callbacks.onChain?.(this.chain, { partA, partB, x, y });
    }

    latchClear() {
      if (this.goalState === "latched" || this.mode === "clear-pending") return;
      const requiredChain = this.stage.clearConditions?.minChain || 0;
      if (this.chain < requiredChain) {
        this.goalState = "idle";
        this.goalCandidate = null;
        this.callbacks.onHint?.(`あと ${requiredChain - this.chain} CHAIN 必要です`);
        return;
      }
      this.goalState = "latched";
      this.mode = "clear-pending";
      this.clearPendingElapsed = 0;
      const goal = this.findPart(this.goalCandidate?.goalId);
      if (goal) this.effects.push({ x: goal.x, y: goal.y, color: "#f2c14e", startedAt: performance.now(), duration: P.CONFIG.clearCelebrationMs });
      this.callbacks.onGoal?.();
      this.callbacks.onModeChange?.(this.mode);
      this.emitChange();
    }

    finishClear() {
      if (this.clearResult) return;
      const partCount = this.designParts.length;
      const conditions = this.stage.clearConditions || {};
      let stars = 1;
      if (partCount <= (conditions.twoStarsParts ?? Infinity)) stars = 2;
      if (partCount <= (conditions.threeStarsParts ?? -1)) stars = 3;
      this.clearResult = { stars, parts: partCount, chain: this.chain, time: this.elapsed, stageId: this.stage.id };
      this.mode = "cleared";
      this.callbacks.onModeChange?.(this.mode);
      this.callbacks.onClear?.(this.clearResult);
      this.emitChange();
    }

    findPart(id) {
      return [...this.fixedParts, ...this.designParts, ...this.runtimeParts].find((part) => part.id === id) || null;
    }

    setSpeed(speed) {
      this.speed = P.util.clamp(speed, 0.25, 2);
    }

    setSettings(settings) {
      this.settings = Object.assign({}, this.settings, settings);
      this.emitChange(false);
    }

    getState() {
      return {
        stage: this.stage,
        mode: this.mode,
        parts: [...this.fixedParts, ...this.designParts, ...this.runtimeParts],
        selectedPart: this.selectedPart,
        usedParts: this.designParts.length,
        chain: this.chain,
        elapsed: this.elapsed,
        goalState: this.goalState,
        effects: this.effects,
        canUndo: this.history.canUndo,
        canRedo: this.history.canRedo,
        bodyCount: this.physics.bodyCount,
        constraintCount: this.physics.constraintCount,
        lastCollision: this.physics.lastCollision
      };
    }

    emitChange(full = true) {
      this.callbacks.onChange?.(this.getState(), full);
    }
  }

  P.Game = Game;
})(window);
