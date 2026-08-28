(function definePhysics(global) {
  "use strict";
  const P = global.PythagoraLab;
  const M = global.Matter;

  class PhysicsWorld {
    constructor({ onCollisionStart, onCollisionActive } = {}) {
      const physics = P.CONFIG.physics;
      this.engine = M.Engine.create({ enableSleeping: false });
      this.world = this.engine.world;
      this.engine.gravity.x = physics.gravity.x;
      this.engine.gravity.y = physics.gravity.y;
      this.engine.gravity.scale = physics.gravity.scale;
      this.engine.positionIterations = physics.positionIterations;
      this.engine.velocityIterations = physics.velocityIterations;
      this.engine.constraintIterations = physics.constraintIterations;
      this.parts = [];
      this.lastCollision = "none";
      this.onCollisionStart = onCollisionStart || (() => {});
      this.onCollisionActive = onCollisionActive || (() => {});
      this._collisionStart = (event) => this.handleCollision(event, false);
      this._collisionActive = (event) => this.handleCollision(event, true);
      M.Events.on(this.engine, "collisionStart", this._collisionStart);
      M.Events.on(this.engine, "collisionActive", this._collisionActive);
    }

    rebuild(parts, mode = "edit") {
      M.Composite.clear(this.world, false, true);
      M.Engine.clear(this.engine);
      this.parts = parts;
      for (const part of parts) part.create(this.world, mode);
      this.lastCollision = "none";
    }

    update(delta = P.CONFIG.fixedStep) {
      M.Engine.update(this.engine, delta);
      const maxSpeed = P.CONFIG.physics.maxSpeed;
      const maxAngular = P.CONFIG.physics.maxAngularSpeed;
      for (const body of M.Composite.allBodies(this.world)) {
        if (body.isStatic || body.isSensor) continue;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          M.Body.setVelocity(body, { x: body.velocity.x * scale, y: body.velocity.y * scale });
        }
        if (Math.abs(body.angularVelocity) > maxAngular) {
          M.Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * maxAngular);
        }
      }
      for (const part of this.parts) part.update(delta);
    }

    handleCollision(event, active) {
      for (const pair of event.pairs) {
        const metaA = pair.bodyA.plugin?.pythagora;
        const metaB = pair.bodyB.plugin?.pythagora;
        if (!metaA || !metaB) continue;
        this.lastCollision = `${metaA.partType}:${metaA.partId} <> ${metaB.partType}:${metaB.partId}`;
        const detail = { pair, bodyA: pair.bodyA, bodyB: pair.bodyB, metaA, metaB };
        if (active) this.onCollisionActive(detail);
        else this.onCollisionStart(detail);
      }
    }

    get bodyCount() {
      return M.Composite.allBodies(this.world).length;
    }

    get constraintCount() {
      return M.Composite.allConstraints(this.world).length;
    }

    destroy() {
      M.Events.off(this.engine, "collisionStart", this._collisionStart);
      M.Events.off(this.engine, "collisionActive", this._collisionActive);
      M.Composite.clear(this.world, false, true);
      M.Engine.clear(this.engine);
      this.parts = [];
    }
  }

  P.PhysicsWorld = PhysicsWorld;
})(window);
