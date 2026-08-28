(function defineAdvancedParts(global) {
  "use strict";
  const P = global.PythagoraLab;
  const M = global.Matter;
  const BasePart = P.Part;

  class SeesawPart extends BasePart {
    create(world, mode = "edit") {
      super.create(world, mode);
      this.runtime.anchor = { x: this.x, y: this.y };
      if (mode !== "edit" && this.body) {
        const pivot = M.Constraint.create({
          label: `pivot:${this.id}`,
          pointA: { x: this.x, y: this.y },
          bodyB: this.body,
          pointB: { x: 0, y: 0 },
          length: 0,
          stiffness: 0.98,
          damping: 0.16
        });
        this.constraints = [pivot];
        M.Composite.add(world, pivot);
      }
      return this;
    }

    update(delta) {
      if (this.body && !this.body.isStatic) {
        const limit = P.util.radians(31);
        if (Math.abs(this.body.angle) > limit) {
          M.Body.setAngle(this.body, Math.sign(this.body.angle) * limit);
          M.Body.setAngularVelocity(this.body, -this.body.angularVelocity * 0.16);
        }
      }
      super.update(delta);
    }
  }

  class PendulumPart extends BasePart {
    create(world, mode = "edit") {
      this.destroy(world);
      const physics = this.def.physics || {};
      const length = Number(this.settings.length) || physics.length || 92;
      this.runtime.anchor = { x: this.x, y: this.y - length };
      this.body = M.Bodies.circle(this.x, this.y, this.width / 2, {
        label: `part:${this.type}`,
        isStatic: mode === "edit",
        density: physics.density,
        friction: physics.friction,
        frictionAir: physics.frictionAir,
        restitution: physics.restitution
      });
      this.tagBody(this.body, "bob");
      this.bodies = [this.body];
      M.Composite.add(world, this.body);
      if (mode !== "edit") {
        const rope = M.Constraint.create({
          label: `rope:${this.id}`,
          pointA: this.runtime.anchor,
          bodyB: this.body,
          length,
          stiffness: 1,
          damping: 0.015
        });
        this.constraints = [rope];
        M.Composite.add(world, rope);
      }
      return this;
    }
  }

  const advanced = {
    seesaw: SeesawPart,
    pendulum: PendulumPart
  };

  P.PartFactory = Object.freeze({
    create(data = {}) {
      const safeType = P.PART_DEFS[data.type] ? data.type : "box";
      const safe = Object.assign({}, data, { type: safeType });
      const Constructor = advanced[safeType] || BasePart;
      return new Constructor(safe);
    },
    createMany(items = []) {
      return items.filter((item) => item && P.PART_DEFS[item.type]).map((item) => this.create(P.util.deepClone(item)));
    }
  });
})(window);
