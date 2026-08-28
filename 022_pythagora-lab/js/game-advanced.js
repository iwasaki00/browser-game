(function defineAdvancedGame(global) {
  "use strict";
  const P = global.PythagoraLab;
  const M = global.Matter;
  const BaseGame = P.Game;

  class AdvancedGame extends BaseGame {
    createStageFixedParts(stage) {
      if (!stage.free) return super.createStageFixedParts(stage);
      return P.PartFactory.createMany(stage.fixedObjects || []);
    }

    defaultPartPlacement(type) {
      const placement = super.defaultPartPlacement(type);
      const used = this.countType(type);
      if (type === "domino") {
        placement.x = Math.min(this.stage.fieldWidth - 58, 320 + used * 46);
        placement.y = this.stage.fieldHeight - 68;
      }
      if (type === "ramp" && this.stage.id === "stage-1") {
        placement.x = 385;
        placement.y = 282;
        placement.width = 330;
        placement.angle = P.util.radians(34);
      }
      if (type === "ball") placement.y = Math.max(45, this.stage.fieldHeight * 0.22 + used * 12);
      if (type === "floor") placement.y = this.stage.fieldHeight - 55 - used * 16;
      if (type === "start") {
        placement.settings = { velocity: { x: 3.1, y: 0 } };
        placement.rotatable = false;
      }
      return placement;
    }

    startExperiment(options = {}) {
      const hasStart = this.stage?.free ? this.designParts.some((part) => part.type === "start") : true;
      const hasGoal = this.stage?.free ? this.designParts.some((part) => part.type === "goal") : true;
      if (!hasStart || !hasGoal) {
        this.callbacks.onHint?.(!hasStart ? "STARTを1つ置いてください" : "GOALを1つ置いてください");
        return false;
      }
      const started = super.startExperiment(options);
      if (started) {
        for (const part of [...this.fixedParts, ...this.designParts, ...this.runtimeParts]) {
          if (part.type === "switch") part.runtime.on = false;
        }
      }
      return started;
    }

    onCollisionStart(detail) {
      if (!["running", "replay", "clear-pending"].includes(this.mode)) return;
      const partA = this.findPart(detail.metaA.partId);
      const partB = this.findPart(detail.metaB.partId);
      if (partA && partB) {
        this.activateSpring(partA, partB, detail);
        this.activateSpring(partB, partA, {
          bodyA: detail.bodyB,
          bodyB: detail.bodyA,
          metaA: detail.metaB,
          metaB: detail.metaA,
          pair: detail.pair
        });
        this.activateSwitch(partA, partB, detail.bodyB);
        this.activateSwitch(partB, partA, detail.bodyA);
      }
      super.onCollisionStart(detail);
    }

    activateSpring(spring, target, detail) {
      if (spring.type !== "spring" || !target.body || target.body.isStatic || target.body.isSensor) return;
      const now = this.elapsed * 1000;
      if (now < (spring.runtime.cooldownUntil || 0)) return;
      const normal = { x: Math.sin(spring.angle), y: -Math.cos(spring.angle) };
      const approach = target.body.velocity.x * normal.x + target.body.velocity.y * normal.y;
      if (approach > 4) return;
      const tangent = { x: Math.cos(spring.angle), y: Math.sin(spring.angle) };
      const tangentSpeed = target.body.velocity.x * tangent.x + target.body.velocity.y * tangent.y;
      const launchSpeed = 15.5;
      M.Body.setVelocity(target.body, {
        x: normal.x * launchSpeed + tangent.x * tangentSpeed * 0.28,
        y: normal.y * launchSpeed + tangent.y * tangentSpeed * 0.28
      });
      spring.runtime.cooldownUntil = now + (spring.def.physics?.cooldown || 300);
      spring.runtime.springUntil = performance.now() + 360;
      this.effects.push({ x: spring.x, y: spring.y, color: spring.def.color, startedAt: performance.now(), duration: 520 });
      this.callbacks.onSpring?.(spring, target);
    }

    activateSwitch(switchPart, source, sourceBody) {
      if (switchPart.type !== "switch" || switchPart.runtime.on || sourceBody.isStatic || sourceBody.isSensor) return;
      switchPart.runtime.on = true;
      this.effects.push({ x: switchPart.x, y: switchPart.y, color: "#f2c14e", startedAt: performance.now(), duration: 620 });
      this.callbacks.onSwitch?.(switchPart, source);
      const spawn = switchPart.settings?.spawn;
      if (spawn) {
        const ball = this.spawnBall(spawn, switchPart.id);
        if (ball) this.registerChainEvent(switchPart, ball, "switch-spawn");
      }
    }

    spawnBall(spawn, sourceId = "event") {
      if (!["running", "replay", "clear-pending"].includes(this.mode)) return null;
      const ball = P.PartFactory.create({
        id: P.util.uid("event-ball"),
        type: "ball",
        x: P.util.clamp(spawn.x, 22, this.stage.fieldWidth - 22),
        y: P.util.clamp(spawn.y, 22, this.stage.fieldHeight - 22),
        locked: true,
        settings: { source: sourceId }
      });
      this.runtimeParts.push(ball);
      ball.create(this.physics.world, "run");
      this.physics.parts.push(ball);
      M.Body.setVelocity(ball.body, spawn.velocity || { x: 0, y: 0 });
      this.effects.push({ x: ball.x, y: ball.y, color: ball.def.color, startedAt: performance.now(), duration: 600 });
      return ball;
    }

    registerChainEvent(source, target, keyType) {
      const key = `${keyType}|${source.id}|${target.id}`;
      if (this.chainSeen.has(key)) return;
      this.chainSeen.set(key, this.elapsed * 1000);
      this.chain += 1;
      this.callbacks.onChain?.(this.chain, { partA: source, partB: target, x: target.x, y: target.y, keyType });
    }

    update(frameDelta) {
      super.update(frameDelta);
      if (this.goalState === "candidate" && this.goalCandidate && this.elapsed * 1000 - this.goalCandidate.startedAt > 950) {
        this.goalState = "idle";
        this.goalCandidate = null;
      }
      if (["running", "replay"].includes(this.mode) && this.elapsed > (this.stage.id === "stage-5" ? 75 : 60)) {
        this.callbacks.onHint?.("動きが止まったら、リセットして調整しよう");
      }
    }

    reset() {
      if (this.mode !== "edit") return super.reset();
      this.runtimeParts = [];
      this.selectedId = null;
      this.elapsed = 0;
      this.chain = 0;
      this.chainSeen.clear();
      this.goalState = "idle";
      this.goalCandidate = null;
      this.effects = [];
      this.rebuild("edit");
      this.emitChange();
      return true;
    }

    loadDebugSolution() {
      if (!this.stage?.debugSolution) return false;
      this.designParts = P.PartFactory.createMany(this.stage.debugSolution.map((part) => Object.assign({ id: P.util.uid(`solution-${part.type}`) }, part)));
      this.runtimeParts = [];
      this.selectedId = null;
      this.history.reset();
      this.runSnapshot = null;
      this.mode = "edit";
      this.rebuild("edit");
      this.emitChange();
      return true;
    }

    exportWork(name, id = null) {
      return {
        id,
        name,
        fieldWidth: this.stage.fieldWidth,
        fieldHeight: this.stage.fieldHeight,
        parts: this.serializeDesign()
      };
    }
  }

  P.Game = AdvancedGame;
})(window);
