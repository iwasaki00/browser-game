(function () {
  "use strict";

  const { Engine, Bodies, Body, Composite, Constraint, Events, Query } = Matter;
  const DEG = Math.PI / 180;
  const FIXED_STEP = 1000 / 60;
  const SELF_COLLISION_GROUP = -17;
  const COLLISION = Object.freeze({ ground: 0x0001, core: 0x0002, limb: 0x0004, hand: 0x0008 });
  const FOOT_ANKLE_X = 2;
  const FOOT_SUPPORT_X = -18.27;
  const DEMO_FORWARD_SEQUENCE = Object.freeze([
    Object.freeze({ name: "Q + O", keys: Object.freeze(["q", "o"]), duration: 220 }),
    Object.freeze({ name: "Q", keys: Object.freeze(["q"]), duration: 160 }),
    Object.freeze({ name: "W + P", keys: Object.freeze(["w", "p"]), duration: 220 }),
    Object.freeze({ name: "W", keys: Object.freeze(["w"]), duration: 160 })
  ]);

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
    neckKp: 0.45,
    neckKd: 0.12,
    neckMaxTorque: 0.30,
    shoulderKp: 1.50,
    shoulderKd: 0.18,
    shoulderMaxTorque: 1.20,
    elbowKp: 0.70,
    elbowKd: 0.12,
    elbowMaxTorque: 0.65,
    jointLimitStrength: 20.00,
    balanceKp: 0.0020,
    balanceKd: 0.020,
    balanceMaxForce: 0.10
  });

  const LIMITS = Object.freeze({
    hip: [-60 * DEG, 60 * DEG],
    knee: [-6 * DEG, 92 * DEG],
    ankle: [-30 * DEG, 30 * DEG],
    neck: [-25 * DEG, 25 * DEG],
    shoulder: [-85 * DEG, 85 * DEG],
    leftElbow: [25 * DEG, 125 * DEG],
    rightElbow: [-125 * DEG, -25 * DEG]
  });

  const NEUTRAL = Object.freeze({
    leftHip: 2 * DEG,
    rightHip: -2 * DEG,
    leftKnee: 8 * DEG,
    rightKnee: 8 * DEG
  });
  const ARM_MASS = Object.freeze({ light: 0.65, normal: 1, heavy: 1.45 });
  const HAND_FRICTION = Object.freeze({ low: 0.35, normal: 0.70, high: 1.05 });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  function limb(x, y, width, height, options = {}) {
    return Bodies.rectangle(x, y, width, height, {
      density: 0.0023,
      friction: 0.8,
      frictionStatic: 1.4,
      restitution: 0,
      chamfer: { radius: Math.min(width, height) * 0.2 },
      collisionFilter: { group: SELF_COLLISION_GROUP, category: COLLISION.limb, mask: COLLISION.ground },
      ...options
    });
  }

  function limbFromJoint(x, y, width, height, angle, options = {}) {
    const half = height / 2;
    const body = limb(x - Math.sin(angle) * half, y + Math.cos(angle) * half, width, height, options);
    Body.setAngle(body, angle);
    return body;
  }

  function pin(bodyA, pointA, bodyB, pointB, length = 0, label = "joint") {
    return Constraint.create({
      label,
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
      this.balanceScale = 1;
      this.ankleScale = 1;
      this.dynamicFootFriction = false;
      this.armSwingScale = 1;
      this.armMassMode = "normal";
      this.armAmplitude = 35;
      this.handFrictionMode = "normal";
      this.smoothedStride = 0;
      this.armControlFactor = 1;
      this.balancePostureFactor = 1;
      this.posture = "STABLE";
      this.handContact = { left: false, right: false };
      this.recoveryForceFrames = 0;
      this.recoveryDirection = 1;
      this.fallForceFrames = 0;
      this.fallDirection = 1;
      this.footContact = { left: false, right: false };
      this.control = this.emptyControlState();
      this.reset();
      Events.on(this.engine, "beforeUpdate", () => this.applyControls());
    }

    emptyControlState() {
      return {
        torso: { current: 0, target: 0, torque: 0 },
        neck: { current: 0, target: 0, torque: 0 },
        rightHip: { current: 0, target: NEUTRAL.rightHip, torque: 0 },
        leftHip: { current: 0, target: NEUTRAL.leftHip, torque: 0 },
        rightKnee: { current: 0, target: NEUTRAL.rightKnee, torque: 0 },
        leftKnee: { current: 0, target: NEUTRAL.leftKnee, torque: 0 },
        rightShoulder: { current: -10 * DEG, target: -10 * DEG, torque: 0 },
        leftShoulder: { current: 10 * DEG, target: 10 * DEG, torque: 0 },
        rightElbow: { current: -85 * DEG, target: -85 * DEG, torque: 0 },
        leftElbow: { current: 85 * DEG, target: 85 * DEG, torque: 0 }
      };
    }

    reset() {
      Composite.clear(this.engine.world, false, true);
      Engine.clear(this.engine);
      this.accumulator = 0;
      this.smoothedStride = 0;
      this.recoveryForceFrames = 0;
      this.fallForceFrames = 0;
      Object.keys(this.inputState).forEach(key => { this.inputState[key] = false; });
      this.engine.gravity.y = this.params.gravity;
      this.startX = 300;
      this.ground = Bodies.rectangle(10000, 516, 60000, 54, {
        isStatic: true,
        label: "ground",
        friction: this.params.groundFriction,
        frictionStatic: 2,
        restitution: 0,
        collisionFilter: { category: COLLISION.ground, mask: 0xffffffff }
      });
      Composite.add(this.engine.world, this.ground);
      this.createRunner();
      this.control = this.emptyControlState();
    }

    createRunner() {
      const x = this.startX;
      const torso = limb(x, 278, 44, 100, {
        label: "torso",
        density: 0.0036,
        collisionFilter: { group: 0, category: COLLISION.core, mask: COLLISION.ground | COLLISION.hand }
      });
      const head = Bodies.circle(x, 207, 25, {
        label: "head",
        density: 0.0017,
        friction: 0.7,
        restitution: 0,
        collisionFilter: { group: SELF_COLLISION_GROUP, category: COLLISION.limb, mask: COLLISION.ground }
      });
      const leftThigh = limb(x - 15, 366, 24, 76, { label: "left thigh" });
      const rightThigh = limb(x + 15, 366, 24, 76, { label: "right thigh" });
      const leftShin = limb(x - 15, 442, 20, 76, { label: "left shin" });
      const rightShin = limb(x + 15, 442, 20, 76, { label: "right shin" });
      // Keep the ankle close to each foot's physical center. The old -18 px
      // forward-biased anchor generated a continuous contact moment at idle.
      const leftFoot = limb(x - 17, 479, 52, 18, { label: "left foot", friction: this.params.footFriction, frictionStatic: 2 });
      const rightFoot = limb(x + 13, 479, 52, 18, { label: "right foot", friction: this.params.footFriction, frictionStatic: 2 });
      const leftUpperAngle = 10 * DEG;
      const leftForearmAngle = 95 * DEG;
      const leftUpperArm = limbFromJoint(x - 20, 248, 14, 54, leftUpperAngle, { label: "left upper arm", density: 0.00125, friction: 0.65 });
      const leftElbowX = x - 20 - Math.sin(leftUpperAngle) * 54;
      const leftElbowY = 248 + Math.cos(leftUpperAngle) * 54;
      const leftForearm = limbFromJoint(leftElbowX, leftElbowY, 12, 44, leftForearmAngle, { label: "left forearm", density: 0.0010, friction: 0.7 });
      const leftHandX = leftElbowX - Math.sin(leftForearmAngle) * 44;
      const leftHandY = leftElbowY + Math.cos(leftForearmAngle) * 44;
      const leftHand = Bodies.circle(leftHandX, leftHandY, 8, {
        label: "left hand", density: 0.00055, friction: HAND_FRICTION[this.handFrictionMode],
        frictionStatic: 1, restitution: 0,
        collisionFilter: { group: 0, category: COLLISION.hand, mask: COLLISION.ground | COLLISION.core }
      });
      const rightUpperAngle = -10 * DEG;
      const rightForearmAngle = -95 * DEG;
      const rightUpperArm = limbFromJoint(x + 20, 248, 14, 54, rightUpperAngle, { label: "right upper arm", density: 0.00125, friction: 0.65 });
      const rightElbowX = x + 20 - Math.sin(rightUpperAngle) * 54;
      const rightElbowY = 248 + Math.cos(rightUpperAngle) * 54;
      const rightForearm = limbFromJoint(rightElbowX, rightElbowY, 12, 44, rightForearmAngle, { label: "right forearm", density: 0.0010, friction: 0.7 });
      const rightHandX = rightElbowX - Math.sin(rightForearmAngle) * 44;
      const rightHandY = rightElbowY + Math.cos(rightForearmAngle) * 44;
      const rightHand = Bodies.circle(rightHandX, rightHandY, 8, {
        label: "right hand", density: 0.00055, friction: HAND_FRICTION[this.handFrictionMode],
        frictionStatic: 1, restitution: 0,
        collisionFilter: { group: 0, category: COLLISION.hand, mask: COLLISION.ground | COLLISION.core }
      });

      this.bodies = {
        torso, head,
        leftUpperArm, leftForearm, leftHand, rightUpperArm, rightForearm, rightHand,
        leftThigh, rightThigh, leftShin, rightShin, leftFoot, rightFoot
      };
      this.armBaseDensities = new Map([
        [leftUpperArm, 0.00125], [leftForearm, 0.0010],
        [rightUpperArm, 0.00125], [rightForearm, 0.0010],
        [leftHand, 0.00055], [rightHand, 0.00055]
      ]);
      this.neckConstraint = pin(torso, { x: 0, y: -49 }, head, { x: 0, y: 21 }, 1);
      this.neckConstraint.stiffness = 1;
      this.neckConstraint.damping = 0.5;
      this.constraints = [
        this.neckConstraint,
        pin(torso, { x: -20, y: -30 }, leftUpperArm, { x: 0, y: -27 }, 1, "left shoulder"),
        pin(leftUpperArm, { x: 0, y: 27 }, leftForearm, { x: 0, y: -22 }, 1, "left elbow"),
        pin(leftForearm, { x: 0, y: 22 }, leftHand, { x: 0, y: 0 }, 1, "left wrist"),
        pin(torso, { x: 20, y: -30 }, rightUpperArm, { x: 0, y: -27 }, 1, "right shoulder"),
        pin(rightUpperArm, { x: 0, y: 27 }, rightForearm, { x: 0, y: -22 }, 1, "right elbow"),
        pin(rightForearm, { x: 0, y: 22 }, rightHand, { x: 0, y: 0 }, 1, "right wrist"),
        pin(torso, { x: -15, y: 48 }, leftThigh, { x: 0, y: -37 }, 1),
        pin(torso, { x: 15, y: 48 }, rightThigh, { x: 0, y: -37 }, 1),
        pin(leftThigh, { x: 0, y: 37 }, leftShin, { x: 0, y: -37 }, 1),
        pin(rightThigh, { x: 0, y: 37 }, rightShin, { x: 0, y: -37 }, 1),
        pin(leftShin, { x: 0, y: 37 }, leftFoot, { x: FOOT_ANKLE_X, y: 0 }, 1),
        pin(rightShin, { x: 0, y: 37 }, rightFoot, { x: FOOT_ANKLE_X, y: 0 }, 1)
      ];

      Composite.add(this.engine.world, [...Object.values(this.bodies), ...this.constraints]);
      Object.values(this.bodies).forEach(body => {
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
        body.force.x = 0;
        body.force.y = 0;
        body.torque = 0;
      });
      this.setArmMass(this.armMassMode);
      this.setHandFriction(this.handFrictionMode);
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
      this.setBalanceScale(1);
      this.setAnkleScale(1);
      this.setDynamicFootFriction(false);
      this.setArmSwingScale(1);
      this.setArmMass("normal");
      this.setArmAmplitude(35);
      this.setHandFriction("normal");
    }

    setBalanceScale(scale) {
      this.balanceScale = clamp(Number(scale), 0.25, 1);
    }

    setAnkleScale(scale) {
      this.ankleScale = clamp(Number(scale), 0, 1);
    }

    setDynamicFootFriction(active) {
      this.dynamicFootFriction = Boolean(active);
    }

    setArmSwingScale(scale) {
      this.armSwingScale = clamp(Number(scale), 0, 1);
    }

    setArmMass(mode) {
      if (!(mode in ARM_MASS)) return;
      this.armMassMode = mode;
      const multiplier = ARM_MASS[mode];
      if (!this.armBaseDensities) return;
      this.armBaseDensities.forEach((density, body) => Body.setDensity(body, density * multiplier));
    }

    setArmAmplitude(degrees) {
      this.armAmplitude = clamp(Number(degrees), 20, 42);
    }

    setHandFriction(mode) {
      if (!(mode in HAND_FRICTION)) return;
      this.handFrictionMode = mode;
      if (!this.bodies?.leftHand) return;
      [this.bodies.leftHand, this.bodies.rightHand].forEach(hand => {
        hand.friction = HAND_FRICTION[mode];
        hand.frictionStatic = HAND_FRICTION[mode] * 1.4;
      });
    }

    applyRecoveryImpulse(direction = 1) {
      this.recoveryDirection = direction < 0 ? -1 : 1;
      this.recoveryForceFrames = 8;
    }

    applyFallTest(direction = 1) {
      this.fallDirection = direction < 0 ? -1 : 1;
      this.fallForceFrames = 36;
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
      if (this.recoveryForceFrames > 0) {
        Body.applyForce(b.torso, { x: b.torso.position.x, y: b.torso.position.y - 34 }, { x: 0.080 * this.recoveryDirection, y: -0.004 });
        this.recoveryForceFrames -= 1;
      }
      if (this.fallForceFrames > 0) {
        // Deliberately physical: a sustained shoulder-height shove creates
        // translation and rotation without setting position, angle or velocity.
        Body.applyForce(b.torso, { x: b.torso.position.x, y: b.torso.position.y - 42 }, { x: 0.135 * this.fallDirection, y: 0 });
        this.fallForceFrames -= 1;
      }
      this.footContact.left = Query.collides(b.leftFoot, [this.ground]).length > 0;
      this.footContact.right = Query.collides(b.rightFoot, [this.ground]).length > 0;
      this.handContact.left = Query.collides(b.leftHand, [this.ground]).length > 0;
      this.handContact.right = Query.collides(b.rightHand, [this.ground]).length > 0;
      if (this.dynamicFootFriction) {
        b.leftFoot.friction = p.footFriction * (this.footContact.left ? 1.18 : 0.72);
        b.rightFoot.friction = p.footFriction * (this.footContact.right ? 1.18 : 0.72);
      } else {
        b.leftFoot.friction = p.footFriction;
        b.rightFoot.friction = p.footFriction;
      }

      // Balance reacts around the heel-side center of pressure, which is
      // intentionally distinct from the mechanical ankle joint.
      const supportPointX = foot => foot.position.x + Math.cos(foot.angle) * FOOT_SUPPORT_X;
      const supportX = (supportPointX(b.leftFoot) + supportPointX(b.rightFoot)) / 2;
      const supportVelocity = (b.leftFoot.velocity.x + b.rightFoot.velocity.x) / 2;
      const torsoTilt = Math.abs(normalizeAngle(b.torso.angle));
      const down = b.torso.position.y > 400 || b.head.position.y > 430;
      const angularSpeed = Math.abs(b.torso.angularVelocity);
      this.posture = down ? "DOWN"
        : torsoTilt > 50 * DEG || (torsoTilt > 30 * DEG && angularSpeed > 0.08) ? "FALLING"
          : torsoTilt > 10 * DEG ? "LEANING" : "STABLE";
      const tiltBalanceFactor = clamp(1 - Math.max(0, torsoTilt - 8 * DEG) / (35 * DEG), 0.12, 1);
      const heightBalanceFactor = clamp(1 - Math.max(0, b.torso.position.y - 320) / 50, 0.12, 1);
      this.balancePostureFactor = down ? 0.08 : Math.min(tiltBalanceFactor, heightBalanceFactor);
      const effectiveBalance = this.balanceScale * this.balancePostureFactor;
      const balanceForce = clamp(
        -p.balanceKp * (b.torso.position.x - supportX) - p.balanceKd * (b.torso.velocity.x - supportVelocity),
        -p.balanceMaxForce,
        p.balanceMaxForce
      ) * effectiveBalance;
      Body.applyForce(b.torso, b.torso.position, { x: balanceForce, y: 0 });
      Body.applyForce(b.leftFoot, b.leftFoot.position, { x: -balanceForce / 2, y: 0 });
      Body.applyForce(b.rightFoot, b.rightFoot.position, { x: -balanceForce / 2, y: 0 });

      this.control.torso = this.absolutePD(b.torso, 0, p.torsoKp * effectiveBalance, p.torsoKd * effectiveBalance, p.torsoMaxTorque * effectiveBalance);
      this.control.neck = this.jointPD(b.torso, b.head, 0, p.neckKp, p.neckKd, p.neckMaxTorque);
      this.control.rightHip = this.jointPD(b.torso, b.rightThigh, target.rightHip, p.hipKp, p.hipKd, p.hipMaxTorque);
      this.control.leftHip = this.jointPD(b.torso, b.leftThigh, target.leftHip, p.hipKp, p.hipKd, p.hipMaxTorque);
      this.control.rightKnee = this.jointPD(b.rightThigh, b.rightShin, target.rightKnee, p.kneeKp, p.kneeKd, p.kneeMaxTorque);
      this.control.leftKnee = this.jointPD(b.leftThigh, b.leftShin, target.leftKnee, p.kneeKp, p.kneeKd, p.kneeMaxTorque);

      const neutralHipDifference = NEUTRAL.rightHip - NEUTRAL.leftHip;
      const rawStride = clamp((this.control.rightHip.current - this.control.leftHip.current - neutralHipDifference) / (70 * DEG), -1, 1);
      this.smoothedStride += (rawStride - this.smoothedStride) * 0.16;
      const stride = this.smoothedStride;
      const phaseMagnitude = Math.abs(stride);
      const frontAmplitude = this.armAmplitude * DEG;
      const rearAmplitude = this.armAmplitude * 0.72 * DEG;
      // Fade the idle pose quickly once a leg command establishes a phase so
      // the opposite arm visibly crosses before the next Q/W transition.
      const idleShoulder = 10 * DEG * Math.max(0, 1 - phaseMagnitude * 2.5);
      const leftElbowMagnitude = (85 + 15 * stride) * DEG;
      const rightElbowMagnitude = (85 - 15 * stride) * DEG;
      const armTarget = {
        leftShoulder: clamp(-frontAmplitude * Math.max(0, -stride) + rearAmplitude * Math.max(0, stride) + idleShoulder, ...LIMITS.shoulder),
        rightShoulder: clamp(-frontAmplitude * Math.max(0, stride) + rearAmplitude * Math.max(0, -stride) - idleShoulder, ...LIMITS.shoulder),
        leftElbow: clamp(leftElbowMagnitude, ...LIMITS.leftElbow),
        rightElbow: clamp(-rightElbowMagnitude, ...LIMITS.rightElbow)
      };
      const postureArmFactor = this.posture === "STABLE" ? 1
        : this.posture === "LEANING" ? 0.85
          : this.posture === "FALLING" ? 0.30 : 0.08;
      this.armControlFactor = this.armSwingScale * postureArmFactor;
      const armFactor = this.armControlFactor;
      this.control.leftShoulder = this.jointPD(b.torso, b.leftUpperArm, armTarget.leftShoulder, p.shoulderKp * armFactor, p.shoulderKd * armFactor, p.shoulderMaxTorque * armFactor);
      this.control.rightShoulder = this.jointPD(b.torso, b.rightUpperArm, armTarget.rightShoulder, p.shoulderKp * armFactor, p.shoulderKd * armFactor, p.shoulderMaxTorque * armFactor);
      this.control.leftElbow = this.jointPD(b.leftUpperArm, b.leftForearm, armTarget.leftElbow, p.elbowKp * armFactor, p.elbowKd * armFactor, p.elbowMaxTorque * armFactor);
      this.control.rightElbow = this.jointPD(b.rightUpperArm, b.rightForearm, armTarget.rightElbow, p.elbowKp * armFactor, p.elbowKd * armFactor, p.elbowMaxTorque * armFactor);

      this.absolutePD(b.rightFoot, 0, p.ankleKp * this.ankleScale, p.ankleKd * this.ankleScale, p.ankleMaxTorque * this.ankleScale);
      this.absolutePD(b.leftFoot, 0, p.ankleKp * this.ankleScale, p.ankleKd * this.ankleScale, p.ankleMaxTorque * this.ankleScale);

      this.softLimit(b.torso, b.rightThigh, LIMITS.hip, p.hipMaxTorque);
      this.softLimit(b.torso, b.leftThigh, LIMITS.hip, p.hipMaxTorque);
      this.softLimit(b.rightThigh, b.rightShin, LIMITS.knee, p.kneeMaxTorque);
      this.softLimit(b.leftThigh, b.leftShin, LIMITS.knee, p.kneeMaxTorque);
      this.softLimit(b.rightShin, b.rightFoot, LIMITS.ankle, p.ankleMaxTorque);
      this.softLimit(b.leftShin, b.leftFoot, LIMITS.ankle, p.ankleMaxTorque);
      this.softLimit(b.torso, b.head, LIMITS.neck, p.neckMaxTorque);
      const armLimitTorque = 0.04 + 0.35 * armFactor;
      this.softLimit(b.torso, b.leftUpperArm, LIMITS.shoulder, armLimitTorque);
      this.softLimit(b.torso, b.rightUpperArm, LIMITS.shoulder, armLimitTorque);
      this.softLimit(b.leftUpperArm, b.leftForearm, LIMITS.leftElbow, armLimitTorque);
      this.softLimit(b.rightUpperArm, b.rightForearm, LIMITS.rightElbow, armLimitTorque);
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
      const worldPoint = (body, point) => ({
        x: body.position.x + point.x * Math.cos(body.angle) - point.y * Math.sin(body.angle),
        y: body.position.y + point.x * Math.sin(body.angle) + point.y * Math.cos(body.angle)
      });
      const neckTorsoAnchor = worldPoint(this.neckConstraint.bodyA, this.neckConstraint.pointA);
      const neckHeadAnchor = worldPoint(this.neckConstraint.bodyB, this.neckConstraint.pointB);
      const neckDistance = Math.hypot(neckHeadAnchor.x - neckTorsoAnchor.x, neckHeadAnchor.y - neckTorsoAnchor.y);
      const touchesGround = body => Query.collides(body, [this.ground]).length > 0;
      return {
        inputState: { ...this.inputState },
        torsoAngularVelocity: torso.angularVelocity,
        position: { ...torso.position },
        velocity: { ...torso.velocity },
        headPosition: { ...this.bodies.head.position },
        neck: {
          connected: neckDistance < 20,
          distance: neckDistance,
          torsoAnchor: neckTorsoAnchor,
          headAnchor: neckHeadAnchor
        },
        feet: {
          left: { contact: this.footContact.left, friction: this.bodies.leftFoot.friction },
          right: { contact: this.footContact.right, friction: this.bodies.rightFoot.friction }
        },
        hands: {
          left: { contact: this.handContact.left, friction: this.bodies.leftHand.friction },
          right: { contact: this.handContact.right, friction: this.bodies.rightHand.friction }
        },
        groundContacts: {
          leftHand: this.handContact.left,
          rightHand: this.handContact.right,
          leftKnee: touchesGround(this.bodies.leftShin),
          rightKnee: touchesGround(this.bodies.rightShin),
          head: touchesGround(this.bodies.head),
          torso: touchesGround(this.bodies.torso)
        },
        posture: this.posture,
        experiments: {
          balanceScale: this.balanceScale,
          ankleScale: this.ankleScale,
          dynamicFootFriction: this.dynamicFootFriction,
          armSwingScale: this.armSwingScale,
          armMass: this.armMassMode,
          armAmplitude: this.armAmplitude,
          armControlFactor: this.armControlFactor,
          handFriction: this.handFrictionMode,
          balancePostureFactor: this.balancePostureFactor,
          smoothedStride: this.smoothedStride,
          recoveryActive: this.recoveryForceFrames > 0,
          fallTestActive: this.fallForceFrames > 0
        },
        control: JSON.parse(JSON.stringify(this.control))
      };
    }

    get distance() {
      const meters = (this.bodies.torso.position.x - this.startX) / 72;
      return Math.abs(meters) < 0.15 ? 0 : meters;
    }
  }

  window.QWOPPhysics = { RunnerPhysics, DEFAULTS, LIMITS, NEUTRAL, ARM_MASS, HAND_FRICTION, DEMO_FORWARD_SEQUENCE, FOOT_ANKLE_X, FOOT_SUPPORT_X, SCALE: 72, DEG };
})();
