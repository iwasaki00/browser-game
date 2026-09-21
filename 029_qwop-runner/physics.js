(function () {
  "use strict";

  const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
  const DEG = Math.PI / 180;
  const FIXED_STEP = 1000 / 60;
  const SELF_COLLISION_GROUP = -17;

  const DEFAULTS = Object.freeze({
    gravity: 0.72,
    groundFriction: 1.05,
    footFriction: 1.35,
    torsoKp: 0.15,
    torsoKd: 0.08,
    torsoMaxTorque: 0.20,
    hipKp: 4.00,
    hipKd: 0.30,
    kneeKp: 6.00,
    kneeKd: 0.40,
    hipMaxTorque: 4.00,
    kneeMaxTorque: 6.00,
    ankleKp: 4.00,
    ankleKd: 0.30,
    ankleMaxTorque: 4.00,
    jointLimitStrength: 20.00,
    balanceKp: 0.0020,
    balanceKd: 0.020,
    balanceMaxForce: 0.10
  });

  const LIMITS = Object.freeze({
    hip: [-60 * DEG, 60 * DEG],
    knee: [-6 * DEG, 92 * DEG],
    ankle: [-30 * DEG, 30 * DEG]
  });

  const NEUTRAL = Object.freeze({
    leftHip: 2 * DEG,
    rightHip: -2 * DEG,
    leftKnee: 8 * DEG,
    rightKnee: 8 * DEG
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  function limb(x, y, width, height, options = {}) {
    return Bodies.rectangle(x, y, width, height, {
      density: 0.0023,
      friction: 0.8,
      frictionStatic: 1.4,
      restitution: 0,
      chamfer: { radius: Math.min(width, height) * 0.2 },
      collisionFilter: { group: SELF_COLLISION_GROUP },
      ...options
    });
  }

  function pin(bodyA, pointA, bodyB, pointB, length = 0) {
    return Constraint.create({
      bodyA,
      pointA,
      bodyB,
      pointB,
      length,
      stiffness: 0.985,
      damping: 0.32
    });
  }

  class RunnerPhysics {
    constructor() {
      this.params = { ...DEFAULTS };
      this.inputState = { q: false, w: false, o: false, p: false };
      this.engine = Engine.create({
        enableSleeping: false,
        positionIterations: 14,
        velocityIterations: 12,
        constraintIterations: 6
      });
      this.engine.gravity.scale = 0.001;
      this.accumulator = 0;
      this.control = this.emptyControlState();
      this.reset();
      Events.on(this.engine, "beforeUpdate", () => this.applyControls());
    }

    emptyControlState() {
      return {
        torso: { current: 0, target: 0, torque: 0 },
        rightHip: { current: 0, target: NEUTRAL.rightHip, torque: 0 },
        leftHip: { current: 0, target: NEUTRAL.leftHip, torque: 0 },
        rightKnee: { current: 0, target: NEUTRAL.rightKnee, torque: 0 },
        leftKnee: { current: 0, target: NEUTRAL.leftKnee, torque: 0 }
      };
    }

    reset() {
      Composite.clear(this.engine.world, false, true);
      Engine.clear(this.engine);
      this.accumulator = 0;
      Object.keys(this.inputState).forEach(key => { this.inputState[key] = false; });
      this.engine.gravity.y = this.params.gravity;
      this.startX = 300;
      this.ground = Bodies.rectangle(10000, 516, 20500, 54, {
        isStatic: true,
        label: "ground",
        friction: this.params.groundFriction,
        frictionStatic: 2,
        restitution: 0
      });
      Composite.add(this.engine.world, this.ground);
      this.createRunner();
      this.control = this.emptyControlState();
    }

    createRunner() {
      const x = this.startX;
      const torso = limb(x, 278, 44, 100, { label: "torso", density: 0.0036 });
      const head = Bodies.circle(x, 203, 25, {
        label: "head",
        density: 0.0017,
        friction: 0.7,
        restitution: 0,
        collisionFilter: { group: SELF_COLLISION_GROUP }
      });
      const leftThigh = limb(x - 15, 366, 24, 76, { label: "left thigh" });
      const rightThigh = limb(x + 15, 366, 24, 76, { label: "right thigh" });
      const leftShin = limb(x - 15, 442, 20, 76, { label: "left shin" });
      const rightShin = limb(x + 15, 442, 20, 76, { label: "right shin" });
      const leftFoot = limb(x + 3, 479, 52, 18, { label: "left foot", friction: this.params.footFriction, frictionStatic: 2 });
      const rightFoot = limb(x + 33, 479, 52, 18, { label: "right foot", friction: this.params.footFriction, frictionStatic: 2 });

      this.bodies = { torso, head, leftThigh, rightThigh, leftShin, rightShin, leftFoot, rightFoot };
      this.constraints = [
        pin(torso, { x: 0, y: -49 }, head, { x: 0, y: 25 }, 1),
        pin(torso, { x: -15, y: 48 }, leftThigh, { x: 0, y: -37 }, 1),
        pin(torso, { x: 15, y: 48 }, rightThigh, { x: 0, y: -37 }, 1),
        pin(leftThigh, { x: 0, y: 37 }, leftShin, { x: 0, y: -37 }, 1),
        pin(rightThigh, { x: 0, y: 37 }, rightShin, { x: 0, y: -37 }, 1),
        pin(leftShin, { x: 0, y: 37 }, leftFoot, { x: -18, y: 0 }, 1),
        pin(rightShin, { x: 0, y: 37 }, rightFoot, { x: -18, y: 0 }, 1)
      ];

      Composite.add(this.engine.world, [...Object.values(this.bodies), ...this.constraints]);
      Object.values(this.bodies).forEach(body => {
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
        body.force.x = 0;
        body.force.y = 0;
        body.torque = 0;
      });
    }

    setInput(key, active) {
      if (key in this.inputState) this.inputState[key] = Boolean(active);
    }

    setParameter(name, value) {
      if (!(name in this.params)) return;
      this.params[name] = Number(value);
      this.engine.gravity.y = this.params.gravity;
      this.ground.friction = this.params.groundFriction;
      this.bodies.leftFoot.friction = this.params.footFriction;
      this.bodies.rightFoot.friction = this.params.footFriction;
    }

    resetParameters() {
      Object.assign(this.params, DEFAULTS);
      Object.keys(this.params).forEach(name => this.setParameter(name, this.params[name]));
    }

    jointPD(parent, child, target, kp, kd, maxTorque) {
      const current = normalizeAngle(child.angle - parent.angle);
      const velocity = child.angularVelocity - parent.angularVelocity;
      const error = normalizeAngle(target - current);
      const torque = clamp(kp * error - kd * velocity, -maxTorque, maxTorque);
      parent.torque -= torque;
      child.torque += torque;
      return { current, target, torque };
    }

    absolutePD(body, target, kp, kd, maxTorque) {
      const current = normalizeAngle(body.angle);
      const error = normalizeAngle(target - current);
      const torque = clamp(kp * error - kd * body.angularVelocity, -maxTorque, maxTorque);
      body.torque += torque;
      return { current, target, torque };
    }

    softLimit(parent, child, limits, maxTorque) {
      const current = normalizeAngle(child.angle - parent.angle);
      let error = 0;
      if (current < limits[0]) error = limits[0] - current;
      if (current > limits[1]) error = limits[1] - current;
      if (!error) return 0;
      const relativeVelocity = child.angularVelocity - parent.angularVelocity;
      const torque = clamp(this.params.jointLimitStrength * error - 0.025 * relativeVelocity, -maxTorque, maxTorque);
      parent.torque -= torque;
      child.torque += torque;
      return torque;
    }

    targets() {
      const k = this.inputState;
      return {
        rightHip: clamp(NEUTRAL.rightHip + (k.q ? -38 * DEG : 0) + (k.w ? 38 * DEG : 0), ...LIMITS.hip),
        leftHip: clamp(NEUTRAL.leftHip + (k.q ? 38 * DEG : 0) + (k.w ? -38 * DEG : 0), ...LIMITS.hip),
        rightKnee: clamp(NEUTRAL.rightKnee + (k.o ? 62 * DEG : 0) + (k.p ? -5 * DEG : 0), ...LIMITS.knee),
        leftKnee: clamp(NEUTRAL.leftKnee + (k.o ? -5 * DEG : 0) + (k.p ? 62 * DEG : 0), ...LIMITS.knee)
      };
    }

    applyControls() {
      const b = this.bodies;
      const p = this.params;
      const target = this.targets();

      const ankleX = foot => foot.position.x - Math.cos(foot.angle) * 18;
      const supportX = (ankleX(b.leftFoot) + ankleX(b.rightFoot)) / 2;
      const supportVelocity = (b.leftFoot.velocity.x + b.rightFoot.velocity.x) / 2;
      const balanceForce = clamp(
        -p.balanceKp * (b.torso.position.x - supportX) - p.balanceKd * (b.torso.velocity.x - supportVelocity),
        -p.balanceMaxForce,
        p.balanceMaxForce
      );
      Body.applyForce(b.torso, b.torso.position, { x: balanceForce, y: 0 });
      Body.applyForce(b.leftFoot, b.leftFoot.position, { x: -balanceForce / 2, y: 0 });
      Body.applyForce(b.rightFoot, b.rightFoot.position, { x: -balanceForce / 2, y: 0 });

      this.control.torso = this.absolutePD(b.torso, 0, p.torsoKp, p.torsoKd, p.torsoMaxTorque);
      this.control.rightHip = this.jointPD(b.torso, b.rightThigh, target.rightHip, p.hipKp, p.hipKd, p.hipMaxTorque);
      this.control.leftHip = this.jointPD(b.torso, b.leftThigh, target.leftHip, p.hipKp, p.hipKd, p.hipMaxTorque);
      this.control.rightKnee = this.jointPD(b.rightThigh, b.rightShin, target.rightKnee, p.kneeKp, p.kneeKd, p.kneeMaxTorque);
      this.control.leftKnee = this.jointPD(b.leftThigh, b.leftShin, target.leftKnee, p.kneeKp, p.kneeKd, p.kneeMaxTorque);

      this.absolutePD(b.rightFoot, 0, p.ankleKp, p.ankleKd, p.ankleMaxTorque);
      this.absolutePD(b.leftFoot, 0, p.ankleKp, p.ankleKd, p.ankleMaxTorque);

      this.softLimit(b.torso, b.rightThigh, LIMITS.hip, p.hipMaxTorque);
      this.softLimit(b.torso, b.leftThigh, LIMITS.hip, p.hipMaxTorque);
      this.softLimit(b.rightThigh, b.rightShin, LIMITS.knee, p.kneeMaxTorque);
      this.softLimit(b.leftThigh, b.leftShin, LIMITS.knee, p.kneeMaxTorque);
      this.softLimit(b.rightShin, b.rightFoot, LIMITS.ankle, p.ankleMaxTorque);
      this.softLimit(b.leftShin, b.leftFoot, LIMITS.ankle, p.ankleMaxTorque);
    }

    step(deltaMs) {
      this.accumulator += Math.min(deltaMs, 100);
      let iterations = 0;
      while (this.accumulator >= FIXED_STEP && iterations < 6) {
        Engine.update(this.engine, FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        iterations += 1;
      }
    }

    diagnostics() {
      const torso = this.bodies.torso;
      return {
        inputState: { ...this.inputState },
        torsoAngularVelocity: torso.angularVelocity,
        position: { ...torso.position },
        velocity: { ...torso.velocity },
        control: JSON.parse(JSON.stringify(this.control))
      };
    }

    get distance() {
      const meters = (this.bodies.torso.position.x - this.startX) / 72;
      return Math.abs(meters) < 0.15 ? 0 : meters;
    }
  }

  window.QWOPPhysics = { RunnerPhysics, DEFAULTS, LIMITS, NEUTRAL, SCALE: 72, DEG };
})();
