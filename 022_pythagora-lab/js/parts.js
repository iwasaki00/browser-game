(function defineParts(global) {
  "use strict";
  const P = global.PythagoraLab;
  const { Body, Bodies, Composite, Constraint, Vertices } = global.Matter || {};

  class Part {
    constructor(data = {}) {
      const def = P.PART_DEFS[data.type] || P.PART_DEFS.box;
      this.id = data.id || P.util.uid(data.type || "part");
      this.type = data.type || "box";
      this.x = Number.isFinite(Number(data.x)) ? Number(data.x) : 380;
      this.y = Number.isFinite(Number(data.y)) ? Number(data.y) : 220;
      this.width = Number(data.width) || def.width;
      this.height = Number(data.height) || def.height;
      this.angle = P.util.normalizeAngle(Number(data.angle) || 0);
      this.locked = Boolean(data.locked);
      this.movable = data.movable !== false && !this.locked;
      this.rotatable = data.rotatable !== false && def.rotatable !== false && !this.locked;
      this.settings = P.util.deepClone(data.settings || {});
      this.body = null;
      this.bodies = [];
      this.constraints = [];
      this.runtime = Object.create(null);
    }

    get def() {
      return P.PART_DEFS[this.type];
    }

    create(world, mode = "edit") {
      this.destroy(world);
      if (!Bodies || this.def.shape === "start") return this;
      const physics = this.def.physics || {};
      const common = {
        label: `part:${this.type}`,
        angle: this.angle,
        isStatic: mode === "edit" || Boolean(this.def.static),
        isSensor: Boolean(this.def.sensor),
        friction: physics.friction,
        frictionStatic: physics.frictionStatic,
        frictionAir: physics.frictionAir,
        restitution: physics.restitution,
        density: physics.density,
        chamfer: this.type === "domino" || this.type === "box" ? { radius: Math.min(6, this.width * 0.2) } : undefined
      };

      if (this.def.shape === "circle") {
        this.body = Bodies.circle(this.x, this.y, this.width / 2, common);
      } else {
        this.body = Bodies.rectangle(this.x, this.y, this.width, this.height, common);
      }
      this.tagBody(this.body);
      this.bodies = [this.body];
      Composite.add(world, this.body);
      return this;
    }

    tagBody(body, role = "main") {
      body.plugin = body.plugin || {};
      body.plugin.pythagora = { partId: this.id, partType: this.type, role };
    }

    update() {
      if (!this.body) return;
      this.x = this.body.position.x;
      this.y = this.body.position.y;
      this.angle = this.body.angle;
    }

    setPosition(x, y) {
      this.x = Number(x);
      this.y = Number(y);
      if (this.body) Body.setPosition(this.body, { x: this.x, y: this.y });
    }

    setAngle(angle) {
      this.angle = P.util.normalizeAngle(angle);
      if (this.body) Body.setAngle(this.body, this.angle);
    }

    reset(data) {
      this.x = Number(data.x) || this.x;
      this.y = Number(data.y) || this.y;
      this.angle = P.util.normalizeAngle(Number(data.angle) || 0);
      this.settings = P.util.deepClone(data.settings || {});
    }

    serialize() {
      return {
        id: this.id,
        type: this.type,
        x: Math.round(this.x * 100) / 100,
        y: Math.round(this.y * 100) / 100,
        width: this.width,
        height: this.height,
        angle: Math.round(this.angle * 100000) / 100000,
        locked: this.locked,
        movable: this.movable,
        rotatable: this.rotatable,
        settings: P.util.deepClone(this.settings)
      };
    }

    destroy(world) {
      if (!world || !Composite) {
        this.body = null;
        this.bodies = [];
        this.constraints = [];
        return;
      }
      for (const constraint of this.constraints) Composite.remove(world, constraint, true);
      for (const body of this.bodies) Composite.remove(world, body, true);
      this.body = null;
      this.bodies = [];
      this.constraints = [];
    }

    hitTest(point, padding = 13) {
      if (this.def.shape === "start" || !this.body) {
        return Math.abs(point.x - this.x) <= this.width / 2 + padding && Math.abs(point.y - this.y) <= this.height / 2 + padding;
      }
      if (this.def.shape === "circle") {
        return Math.hypot(point.x - this.body.position.x, point.y - this.body.position.y) <= this.width / 2 + padding;
      }
      if (this.body.vertices && Vertices.contains(this.body.vertices, point)) return true;
      const dx = point.x - this.body.position.x;
      const dy = point.y - this.body.position.y;
      const cosine = Math.cos(-this.body.angle);
      const sine = Math.sin(-this.body.angle);
      const localX = dx * cosine - dy * sine;
      const localY = dx * sine + dy * cosine;
      return Math.abs(localX) <= this.width / 2 + padding && Math.abs(localY) <= this.height / 2 + padding;
    }
  }

  class BallPart extends Part {}
  class RectPart extends Part {}

  class GoalPart extends Part {
    create(world) {
      return super.create(world, "edit");
    }
  }

  class StartPart extends Part {
    create() {
      this.body = null;
      this.bodies = [];
      return this;
    }
  }

  const constructors = {
    ball: BallPart,
    goal: GoalPart,
    start: StartPart
  };

  P.Part = Part;
  P.PartFactory = Object.freeze({
    create(data) {
      const Constructor = constructors[data.type] || RectPart;
      return new Constructor(data);
    },
    createMany(items = []) {
      return items.map((item) => this.create(P.util.deepClone(item)));
    }
  });
})(window);
