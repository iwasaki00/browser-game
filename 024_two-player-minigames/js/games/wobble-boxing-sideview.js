(() => {
  "use strict";

  const CONFIG = Object.freeze({
    BODY_HP: 100,
    TIME_LIMIT: 32,
    START_DISTANCE_SCALE: 1.3,
    GROUND_Y: .86,
    BODY_REST_Y: .67,
    UPPER_ARM_LENGTH: .5,
    FOREARM_LENGTH: .52,
    SHOULDER_MIN_ANGLE: -1.08,
    SHOULDER_MAX_ANGLE: 1.22,
    ELBOW_MIN_ANGLE: -2.48,
    ELBOW_MAX_ANGLE: -.16,
    ARM1_GUARD_SHOULDER: .65,
    ARM1_GUARD_ELBOW: -1.55,
    ARM2_GUARD_SHOULDER: .8,
    ARM2_GUARD_ELBOW: -2.1,
    SHOULDER_TORQUE: 23,
    ELBOW_TORQUE: 37,
    SHOULDER_SPEED: 6.4,
    ELBOW_SPEED: 10,
    JOINT_FRICTION: .968,
    RETURN_FRICTION: .95,
    SHOULDER_RETURN: 2.2,
    ELBOW_RETURN: 2.6,
    GRAVITY: 1.85,
    GROUND_SPRING: 28,
    GROUND_DAMPING: .72,
    AUTO_BALANCE: 9.2,
    BALANCE_DAMPING: .91,
    ARM_REACTION: .13,
    BODY_FRICTION: .88,
    DISTANCE_RETURN: .42,
    SUPPORT_HALF_WIDTH: .17,
    UNSTABLE_ANGLE: .262,
    STAGGER_ANGLE: .524,
    FALL_ANGLE: .785,
    BALANCE_RECOVERY: 15,
    SHOULDER_BALANCE_COST: 10,
    ELBOW_BALANCE_COST: 6,
    DOUBLE_ARM_BALANCE_COST: 22,
    FALL_DURATION: 1450,
    RECOVERY_DURATION: 520,
    HEAD_RADIUS: .2,
    BODY_RADIUS: .29,
    GLOVE_RADIUS: .145,
    ARM_RADIUS: .06,
    MIN_HIT_SPEED: 66,
    HIT_COOLDOWN: 380,
    MAX_HIT_DAMAGE: 18,
    HEAD_DAMAGE_MULTIPLIER: 1.45,
    BLOCK_DAMAGE_MULTIPLIER: .08,
    KNOCKBACK: .00072,
    HIT_ROTATION: .009,
    CLASH_BOUNCE: .26,
    COLLISION_MARK_LIFETIME: 420
  });

  const LIMBS = ["arm1", "arm2"];
  const JOINT_NAMES = ["arm1Shoulder", "arm1Elbow", "arm2Shoulder", "arm2Elbow"];

  class WobbleBoxingGame {
    constructor(options) {
      Object.assign(this, options);
      this.context = this.canvas.getContext("2d", { alpha: false });
      this.sprite = new Image();
      this.sprite.decoding = "async";
      this.sprite.addEventListener("load", () => {
        this.sprite = this.removeLightBackdrop(this.sprite);
        this.render();
      }, { once: true });
      this.sprite.src = this.spriteUrl;
      this.active = false;
      this.animationId = 0;
      this.lastFrame = 0;
      this.hitStopUntil = 0;
      this.fps = 60;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.resize();
      this.reset();
      this.bindInput();
    }

    removeLightBackdrop(image) {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d");
      context.drawImage(image, 0, 0);
      try {
        const frame = context.getImageData(0, 0, surface.width, surface.height);
        for (let offset = 0; offset < frame.data.length; offset += 4) {
          const red = frame.data[offset];
          const green = frame.data[offset + 1];
          const blue = frame.data[offset + 2];
          const lightest = Math.max(red, green, blue);
          const darkest = Math.min(red, green, blue);
          if (darkest > 218 && lightest - darkest < 18) frame.data[offset + 3] = 0;
        }
        context.putImageData(frame, 0, 0);
      } catch (_) {
        return image;
      }
      return surface;
    }

    reset() {
      this.active = false;
      this.elapsed = 0;
      this.hitStopUntil = 0;
      this.shake = 0;
      this.impact = null;
      this.collisionMarks = [];
      this.blockedPunches = new Set();
      this.players = [this.makePlayer(0), this.makePlayer(1)];
      this.players.forEach((player) => { player.pose = this.calculatePose(player); });
      this.lastFrame = performance.now();
      this.jointButtons.flat().forEach((button) => button.classList.remove("active"));
      if (this.centerRivet) this.centerRivet.classList.remove("fight-active");
      this.updateHud();
      this.render();
    }

    makePlayer(index) {
      const halfDistance = this.idealDistance() * .5;
      const front = index === 0 ? .5 - halfDistance : .5 + halfDistance;
      return {
        index,
        facing: index === 0 ? 1 : -1,
        x: front,
        y: CONFIG.BODY_REST_Y,
        vx: 0,
        vy: 0,
        bodyAngle: 0,
        angularVelocity: 0,
        hp: CONFIG.BODY_HP,
        state: "NORMAL",
        stateUntil: 0,
        recoveringUntil: 0,
        balance: 100,
        stagger: 0,
        lastHitPower: 0,
        lastPunchType: "WEAK",
        lastBlock: false,
        feedback: "",
        feedbackUntil: 0,
        joints: {
          arm1Shoulder: this.makeJoint(CONFIG.ARM1_GUARD_SHOULDER),
          arm1Elbow: this.makeJoint(CONFIG.ARM1_GUARD_ELBOW),
          arm2Shoulder: this.makeJoint(CONFIG.ARM2_GUARD_SHOULDER),
          arm2Elbow: this.makeJoint(CONFIG.ARM2_GUARD_ELBOW)
        },
        armTiming: {
          arm1: this.makeArmTiming(),
          arm2: this.makeArmTiming()
        },
        pose: null
      };
    }

    makeJoint(angle) {
      return { angle, angularVelocity: 0, holding: false };
    }

    makeArmTiming() {
      return { inputStartedAt: 0, shoulderAt: 0, elbowAt: 0, peakSpeed: 0, responseMs: 0, fallingFrames: 0, responseLocked: false };
    }

    guardAngle(name) {
      if (name === "arm1Shoulder") return CONFIG.ARM1_GUARD_SHOULDER;
      if (name === "arm1Elbow") return CONFIG.ARM1_GUARD_ELBOW;
      if (name === "arm2Shoulder") return CONFIG.ARM2_GUARD_SHOULDER;
      return CONFIG.ARM2_GUARD_ELBOW;
    }

    jointLimits(name) {
      return name.includes("Shoulder")
        ? [CONFIG.SHOULDER_MIN_ANGLE, CONFIG.SHOULDER_MAX_ANGLE]
        : [CONFIG.ELBOW_MIN_ANGLE, CONFIG.ELBOW_MAX_ANGLE];
    }

    jointDriveDirection(name) {
      return name.includes("Shoulder") ? -1 : 1;
    }

    bindInput() {
      this.pointerHandlers = this.jointButtons.map((buttons, playerIndex) => buttons.map((button) => {
        const jointName = button.dataset.joint;
        const down = (event) => {
          if (!this.active || this.players[playerIndex].state === "FALL" || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault();
          event.stopPropagation();
          this.beginJointInput(this.players[playerIndex], jointName, performance.now());
          if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
          button.classList.add("active");
        };
        const release = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const joint = this.players[playerIndex].joints[jointName];
          if (!joint.holding) return;
          joint.holding = false;
          button.classList.remove("active");
        };
        button.addEventListener("pointerdown", down, { passive: false });
        button.addEventListener("pointerup", release, { passive: false });
        button.addEventListener("pointercancel", release, { passive: false });
        button.addEventListener("contextmenu", this.preventMenu);
        return { button, down, release };
      }));
      const keyMap = new Map([
        ["KeyQ", [0, "arm1Shoulder"]], ["KeyW", [0, "arm2Shoulder"]],
        ["KeyA", [0, "arm1Elbow"]], ["KeyS", [0, "arm2Elbow"]],
        ["KeyO", [1, "arm1Shoulder"]], ["KeyP", [1, "arm2Shoulder"]],
        ["KeyK", [1, "arm1Elbow"]], ["KeyL", [1, "arm2Elbow"]]
      ]);
      this.keyDownHandler = (event) => {
        const target = keyMap.get(event.code);
        if (!target || event.repeat || !this.active || this.players[target[0]].state === "FALL") return;
        event.preventDefault();
        this.beginJointInput(this.players[target[0]], target[1], performance.now());
      };
      this.keyUpHandler = (event) => {
        const target = keyMap.get(event.code);
        if (!target) return;
        event.preventDefault();
        this.players[target[0]].joints[target[1]].holding = false;
      };
      window.addEventListener("keydown", this.keyDownHandler);
      window.addEventListener("keyup", this.keyUpHandler);
    }

    beginJointInput(player, jointName, now) {
      const joint = player.joints[jointName];
      if (joint.holding) return;
      joint.holding = true;
      const limb = jointName.startsWith("arm1") ? "arm1" : "arm2";
      const timing = player.armTiming[limb];
      if (!timing.inputStartedAt || now - timing.inputStartedAt > 650) {
        timing.inputStartedAt = now;
        timing.peakSpeed = 0;
        timing.responseMs = 0;
        timing.fallingFrames = 0;
        timing.responseLocked = false;
      }
      if (jointName.includes("Shoulder")) timing.shoulderAt = now;
      else timing.elbowAt = now;
    }

    preventMenu(event) { event.preventDefault(); }

    start() {
      this.active = true;
      this.lastFrame = performance.now();
      if (this.centerRivet) this.centerRivet.classList.add("fight-active");
      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    stop() {
      this.active = false;
      if (this.centerRivet) this.centerRivet.classList.remove("fight-active");
      cancelAnimationFrame(this.animationId);
    }

    destroy() {
      this.stop();
      this.resizeObserver.disconnect();
      this.pointerHandlers.flat().forEach(({ button, down, release }) => {
        button.removeEventListener("pointerdown", down);
        button.removeEventListener("pointerup", release);
        button.removeEventListener("pointercancel", release);
        button.removeEventListener("contextmenu", this.preventMenu);
        button.classList.remove("active");
      });
      window.removeEventListener("keydown", this.keyDownHandler);
      window.removeEventListener("keyup", this.keyUpHandler);
    }

    frame(now) {
      if (!this.active) return;
      if (now < this.hitStopUntil) {
        this.render();
        this.animationId = requestAnimationFrame((time) => this.frame(time));
        return;
      }
      const rawDt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / rawDt) - this.fps) * .08;
      this.lastFrame = now;
      this.update(rawDt * (this.testMode ? (this.gameSpeed || 1) : 1), now);
      this.render();
      if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed += dt;
      const frameScale = dt * 60;
      this.blockedPunches.clear();
      for (const player of this.players) {
        const previousPose = player.pose || this.calculatePose(player);
        player.previousJointAngles = {};
        player.lastBlock = false;
        this.updateState(player, now);
        const arm1Active = player.joints.arm1Shoulder.holding || player.joints.arm1Elbow.holding;
        const arm2Active = player.joints.arm2Shoulder.holding || player.joints.arm2Elbow.holding;
        let balanceCost = 0;
        for (const name of JOINT_NAMES) {
          const joint = player.joints[name];
          player.previousJointAngles[name] = joint.angle;
          const shoulder = name.includes("Shoulder");
          const torque = shoulder ? CONFIG.SHOULDER_TORQUE : CONFIG.ELBOW_TORQUE;
          const speed = shoulder ? CONFIG.SHOULDER_SPEED : CONFIG.ELBOW_SPEED;
          const returnForce = shoulder ? CONFIG.SHOULDER_RETURN : CONFIG.ELBOW_RETURN;
          if (player.state !== "FALL" && joint.holding) {
            const acceleration = this.jointDriveDirection(name) * torque * dt;
            joint.angularVelocity += acceleration;
            const reaction = Math.abs(acceleration) * (shoulder ? .48 : .3);
            player.angularVelocity -= reaction * player.facing * CONFIG.ARM_REACTION;
            balanceCost += shoulder ? CONFIG.SHOULDER_BALANCE_COST : CONFIG.ELBOW_BALANCE_COST;
          } else {
            joint.angularVelocity += (this.guardAngle(name) - joint.angle) * returnForce * dt;
            joint.angularVelocity *= Math.pow(CONFIG.RETURN_FRICTION, frameScale);
          }
          joint.angularVelocity *= Math.pow(CONFIG.JOINT_FRICTION, frameScale);
          joint.angularVelocity = Math.max(-speed, Math.min(speed, joint.angularVelocity));
          joint.angle += joint.angularVelocity * dt;
          const [minimum, maximum] = this.jointLimits(name);
          if (joint.angle < minimum || joint.angle > maximum) {
            joint.angle = Math.max(minimum, Math.min(maximum, joint.angle));
            joint.angularVelocity *= -.18;
          }
        }
        if (arm1Active && arm2Active) {
          balanceCost += CONFIG.DOUBLE_ARM_BALANCE_COST;
          const chaos = player.joints.arm1Shoulder.angularVelocity - player.joints.arm2Shoulder.angularVelocity;
          player.angularVelocity += chaos * player.facing * dt * .018;
        }
        player.balance = Math.max(0, player.balance - balanceCost * dt);
        this.updateBody(player, dt, frameScale, now);
        player.pose = this.calculatePose(player);
        for (const limb of LIMBS) {
          const arm = player.pose.arms[limb];
          const old = previousPose.arms[limb];
          arm.vx = (arm.hand.x - old.hand.x) / dt;
          arm.vy = (arm.hand.y - old.hand.y) / dt;
          arm.speed = Math.hypot(arm.vx, arm.vy);
          arm.lastHitAt = old.lastHitAt || 0;
          const forwardSpeed = arm.vx * player.facing;
          const timing = player.armTiming[limb];
          if (timing.inputStartedAt && !timing.responseLocked) {
            const responseAge = now - timing.inputStartedAt;
            if (arm.speed >= timing.peakSpeed) {
              timing.peakSpeed = arm.speed;
              timing.responseMs = Math.round(responseAge);
              timing.fallingFrames = 0;
            } else if (timing.peakSpeed > CONFIG.MIN_HIT_SPEED && arm.speed < timing.peakSpeed * .92) {
              timing.fallingFrames += 1;
            }
            if (timing.fallingFrames >= 2 || responseAge >= 350) timing.responseLocked = true;
          }
          if (forwardSpeed > CONFIG.MIN_HIT_SPEED) {
            player.vx -= player.facing * forwardSpeed * CONFIG.ARM_REACTION * .0005;
            player.angularVelocity -= player.facing * forwardSpeed * CONFIG.ARM_REACTION * .000018;
            player.balance = Math.max(0, player.balance - forwardSpeed * .025 * dt);
          }
        }
        if (!arm1Active && !arm2Active && Math.abs(player.bodyAngle) < CONFIG.UNSTABLE_ANGLE) {
          player.balance = Math.min(100, player.balance + CONFIG.BALANCE_RECOVERY * dt);
        }
        if (now > player.feedbackUntil) player.feedback = "";
      }
      this.resolveArmClashes(now);
      this.resolveHits(now);
      this.separatePlayers(dt);
      this.shake *= Math.pow(.8, frameScale);
      if (this.impact) this.impact.life -= dt * 3.7;
      if (this.impact && this.impact.life <= 0) this.impact = null;
      this.collisionMarks = this.collisionMarks.filter((mark) => now - mark.at <= CONFIG.COLLISION_MARK_LIFETIME);
      if (!this.testMode && this.elapsed >= CONFIG.TIME_LIMIT) {
        if (Math.abs(this.players[0].hp - this.players[1].hp) < .5) return this.finish(0, "時間切れ・互角！");
        return this.finish(this.players[0].hp > this.players[1].hp ? 1 : 2, "時間切れ判定！");
      }
      this.updateHud();
    }

    updateState(player, now) {
      if (player.state === "FALL" && now >= player.stateUntil) {
        player.state = "STAGGER";
        player.recoveringUntil = now + CONFIG.RECOVERY_DURATION;
        player.bodyAngle = player.facing * .34;
        player.balance = Math.max(35, player.balance);
        player.angularVelocity = 0;
      }
    }

    updateBody(player, dt, frameScale, now) {
      const opponent = this.players[1 - player.index];
      const distanceError = Math.abs(opponent.x - player.x) - this.idealDistance();
      if (Math.abs(distanceError) > .035 && player.state !== "FALL") player.vx += player.facing * distanceError * CONFIG.DISTANCE_RETURN * dt;
      const support = this.supportGeometry(player);
      const centerOfMassX = player.x + Math.sin(player.bodyAngle) * .08;
      const outsideSupport = Math.max(0, Math.abs(centerOfMassX - support.centerX) - support.halfWidth);
      if (player.state === "FALL") {
        player.vy += CONFIG.GRAVITY * 2.6 * dt;
        const fallTarget = player.facing * 1.28;
        player.angularVelocity += (fallTarget - player.bodyAngle) * 2.8 * dt;
      } else {
        const balanceStrength = now < player.recoveringUntil ? CONFIG.AUTO_BALANCE * 1.8 : CONFIG.AUTO_BALANCE;
        player.angularVelocity += -player.bodyAngle * balanceStrength * dt;
        player.angularVelocity += Math.sign(player.bodyAngle || player.facing) * outsideSupport * 12 * dt;
        player.angularVelocity *= Math.pow(CONFIG.BALANCE_DAMPING, frameScale);
        player.balance = Math.max(0, player.balance - outsideSupport * 210 * dt);
        const angle = Math.abs(player.bodyAngle);
        if ((angle >= CONFIG.FALL_ANGLE && outsideSupport > .008) || player.balance <= 0) this.fall(player, now);
        else if (now < player.recoveringUntil || angle >= CONFIG.STAGGER_ANGLE || player.balance <= 20) player.state = "STAGGER";
        else if (angle >= CONFIG.UNSTABLE_ANGLE || player.balance < 70) player.state = "UNSTABLE";
        else player.state = "NORMAL";
      }
      const targetY = player.state === "FALL" ? CONFIG.GROUND_Y - .14 : CONFIG.BODY_REST_Y;
      player.vy += (targetY - player.y) * CONFIG.GROUND_SPRING * dt;
      player.vy *= Math.pow(CONFIG.GROUND_DAMPING, frameScale);
      player.vx *= Math.pow(CONFIG.BODY_FRICTION, frameScale);
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.bodyAngle += player.angularVelocity * dt;
      player.x = Math.max(.14, Math.min(.86, player.x));
      player.y = Math.max(.56, Math.min(CONFIG.GROUND_Y - .1, player.y));
      player.bodyAngle = Math.max(-1.42, Math.min(1.42, player.bodyAngle));
    }

    fall(player, now) {
      if (player.state === "FALL") return;
      player.state = "FALL";
      player.balance = 0;
      player.stateUntil = now + CONFIG.FALL_DURATION;
      player.feedback = "DOWN!";
      player.feedbackUntil = player.stateUntil;
      JOINT_NAMES.forEach((name) => { player.joints[name].holding = false; });
      this.jointButtons[player.index].forEach((button) => button.classList.remove("active"));
    }

    separatePlayers(dt) {
      const first = this.players[0];
      const second = this.players[1];
      const minimum = .2;
      if (second.x - first.x >= minimum) return;
      const correction = (minimum - (second.x - first.x)) * .5;
      first.x -= correction;
      second.x += correction;
      first.vx -= correction / Math.max(dt, .001) * .05;
      second.vx += correction / Math.max(dt, .001) * .05;
    }

    calculatePose(player) {
      const scale = this.characterScale();
      const center = { x: player.x * this.width, y: player.y * this.height };
      const up = this.rotateVector({ x: 0, y: -1 }, player.bodyAngle);
      const forward = this.rotateVector({ x: player.facing, y: 0 }, player.bodyAngle);
      const hip = this.offsetPoint(center, up, -scale * .27);
      const neck = this.offsetPoint(center, up, scale * .31);
      const head = this.offsetPoint(neck, up, scale * .25);
      const arms = {};
      for (const limb of LIMBS) {
        const depth = limb === "arm1" ? 1 : -1;
        let shoulder = this.offsetPoint(neck, up, -scale * .05);
        shoulder = this.offsetPoint(shoulder, forward, depth * scale * .035);
        const shoulderAngle = player.joints[`${limb}Shoulder`].angle;
        const upper = this.rotateVector({ x: player.facing * Math.cos(shoulderAngle), y: Math.sin(shoulderAngle) }, player.bodyAngle);
        const elbow = this.offsetPoint(shoulder, upper, scale * CONFIG.UPPER_ARM_LENGTH);
        const forearmAngle = shoulderAngle + player.joints[`${limb}Elbow`].angle;
        const lower = this.rotateVector({ x: player.facing * Math.cos(forearmAngle), y: Math.sin(forearmAngle) }, player.bodyAngle);
        const hand = this.offsetPoint(elbow, lower, scale * CONFIG.FOREARM_LENGTH);
        arms[limb] = { shoulder, elbow, hand, vx: 0, vy: 0, speed: 0, lastHitAt: 0 };
      }
      const support = this.supportGeometry(player);
      const kneeForward = player.facing * scale * (.08 + Math.sin(player.bodyAngle) * .08);
      const leftFoot = { x: (support.centerX - support.halfWidth) * this.width, y: CONFIG.GROUND_Y * this.height };
      const rightFoot = { x: (support.centerX + support.halfWidth) * this.width, y: CONFIG.GROUND_Y * this.height };
      return {
        center, hip, neck, head, arms,
        knees: [
          { x: (hip.x + leftFoot.x) * .5 - kneeForward, y: (hip.y + leftFoot.y) * .54 },
          { x: (hip.x + rightFoot.x) * .5 + kneeForward, y: (hip.y + rightFoot.y) * .54 }
        ],
        feet: [leftFoot, rightFoot],
        centerOfMass: { x: center.x + Math.sin(player.bodyAngle) * scale * .32, y: center.y },
        support
      };
    }

    supportGeometry(player) {
      const fallNarrowing = player.state === "FALL" ? .45 : player.state === "STAGGER" ? .78 : 1;
      return { centerX: player.x - Math.sin(player.bodyAngle) * .025, halfWidth: CONFIG.SUPPORT_HALF_WIDTH * this.characterScale() / this.width * fallNarrowing };
    }

    rotateVector(vector, angle) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return { x: vector.x * cosine - vector.y * sine, y: vector.x * sine + vector.y * cosine };
    }

    offsetPoint(point, vector, distance) {
      return { x: point.x + vector.x * distance, y: point.y + vector.y * distance };
    }

    resolveSelfCollision(player, previousPose, now) {
      const scale = this.characterScale();
      const arm1 = player.pose.arms.arm1;
      const arm2 = player.pose.arms.arm2;
      const collision = this.armCollision(arm1, arm2, scale, true);
      if (!collision) return false;
      JOINT_NAMES.forEach((name) => {
        player.joints[name].angle = player.previousJointAngles[name];
        player.joints[name].angularVelocity *= -CONFIG.CLASH_BOUNCE;
      });
      player.pose = previousPose;
      this.addCollisionMark(collision, now, "#ff75df");
      return true;
    }

    resolveArmClashes(now) {
      const scale = this.characterScale();
      for (const first of LIMBS) {
        for (const second of LIMBS) {
          const a = this.players[0].pose.arms[first];
          const b = this.players[1].pose.arms[second];
          const collision = this.armCollision(a, b, scale, false);
          if (!collision) continue;
          this.blockedPunches.add(`0:${first}`);
          this.blockedPunches.add(`1:${second}`);
          if (now - (a.lastClashAt || 0) < 110 || now - (b.lastClashAt || 0) < 110) continue;
          a.lastClashAt = now;
          b.lastClashAt = now;
          for (const [player, limb] of [[this.players[0], first], [this.players[1], second]]) {
            player.joints[`${limb}Shoulder`].angularVelocity *= -CONFIG.CLASH_BOUNCE;
            player.joints[`${limb}Elbow`].angularVelocity *= -CONFIG.CLASH_BOUNCE;
          }
          this.players.forEach((player) => {
            player.feedback = "BLOCK!";
            player.feedbackUntil = now + 240;
          });
          this.addCollisionMark(collision, now, "#9beaf1");
          this.impact = { ...collision, life: .5, color: "#9beaf1" };
          if (this.onBlockSound) this.onBlockSound();
        }
      }
    }

    armCollision(a, b, scale, selfCollision) {
      const glove = scale * CONFIG.GLOVE_RADIUS;
      const arm = scale * CONFIG.ARM_RADIUS;
      const checks = [
        [this.distance(a.hand, b.hand), glove * 1.7, a.hand, b.hand],
        [this.pointSegmentDistance(a.hand, b.shoulder, b.elbow), glove + arm, a.hand, b.elbow],
        [this.pointSegmentDistance(a.hand, b.elbow, b.hand), glove + arm, a.hand, b.hand],
        [this.pointSegmentDistance(b.hand, a.shoulder, a.elbow), glove + arm, b.hand, a.elbow],
        [this.pointSegmentDistance(b.hand, a.elbow, a.hand), glove + arm, b.hand, a.hand],
        [this.segmentSegmentDistance(a.elbow, a.hand, b.elbow, b.hand), arm * (selfCollision ? 1.4 : 2), a.elbow, b.elbow]
      ];
      const hit = checks.find(([distance, threshold]) => distance <= threshold);
      if (!hit) return null;
      return { x: (hit[2].x + hit[3].x) * .5, y: (hit[2].y + hit[3].y) * .5 };
    }

    resolveHits(now) {
      this.players.forEach((attacker, attackerIndex) => {
        if (attacker.state === "FALL") return;
        const target = this.players[1 - attackerIndex];
        for (const limb of LIMBS) {
          const arm = attacker.pose.arms[limb];
          if (arm.speed < CONFIG.MIN_HIT_SPEED || now - arm.lastHitAt < CONFIG.HIT_COOLDOWN) continue;
          if (this.blockedPunches.has(`${attackerIndex}:${limb}`)) continue;
          const forwardSpeed = arm.vx * attacker.facing;
          if (forwardSpeed < CONFIG.MIN_HIT_SPEED * .38) continue;
          const geometry = this.targetGeometry(target);
          const block = this.armGuardCollision(arm.hand, target);
          const headHit = this.distance(arm.hand, geometry.head) <= geometry.head.radius + geometry.fistRadius;
          const bodyHit = this.pointCapsuleDistance(arm.hand, geometry.body.start, geometry.body.end) <= geometry.body.radius + geometry.fistRadius;
          if (!block && !headHit && !bodyHit) continue;
          arm.lastHitAt = now;
          const punch = this.classifyPunch(attacker, limb, arm);
          attacker.lastPunchType = punch.type;
          attacker.lastHitPower = punch.damage;
          if (block) {
            const damage = punch.damage * CONFIG.BLOCK_DAMAGE_MULTIPLIER;
            target.hp = Math.max(0, target.hp - damage);
            target.lastBlock = true;
            target.feedback = "BLOCK!";
            target.feedbackUntil = now + 360;
            target.angularVelocity += attacker.facing * damage * .002;
            attacker.joints[`${limb}Shoulder`].angularVelocity *= -CONFIG.CLASH_BOUNCE;
            attacker.joints[`${limb}Elbow`].angularVelocity *= -CONFIG.CLASH_BOUNCE;
            this.impact = { x: arm.hand.x, y: arm.hand.y, life: .6, color: "#d9f4ff" };
            if (this.onBlockSound) this.onBlockSound();
            continue;
          }
          const damage = Math.min(CONFIG.MAX_HIT_DAMAGE, punch.damage * (headHit ? CONFIG.HEAD_DAMAGE_MULTIPLIER : 1));
          target.hp = Math.max(0, target.hp - damage);
          target.balance = Math.max(0, target.balance - damage * (headHit ? 2.1 : 1.35));
          target.vx += attacker.facing * damage * CONFIG.KNOCKBACK;
          target.angularVelocity += attacker.facing * damage * CONFIG.HIT_ROTATION * (headHit ? 1.35 : .65);
          if (damage > 12) target.state = "STAGGER";
          attacker.vx -= attacker.facing * damage * CONFIG.KNOCKBACK * .22;
          attacker.angularVelocity -= attacker.facing * damage * .004;
          attacker.balance = Math.max(0, attacker.balance - damage * .72);
          target.feedback = punch.type === "WEAK" ? (headHit ? "HEAD!" : "HIT!") : `${punch.type}!`;
          target.feedbackUntil = now + 500;
          this.shake = Math.min(1.4, this.shake + damage / 16);
          this.impact = { x: arm.hand.x, y: arm.hand.y, life: 1, color: headHit ? "#ffc857" : "#fff8df" };
          this.addCollisionMark(arm.hand, now, headHit ? "#ffc857" : "#fff");
          if (damage >= 10) this.hitStopUntil = Math.max(this.hitStopUntil || 0, now + Math.min(60, 30 + damage * 1.5));
          if (this.onPunchSound) this.onPunchSound(damage / CONFIG.MAX_HIT_DAMAGE, headHit);
          if (target.hp <= 0) return this.finish(attackerIndex + 1, headHit ? "ヘッドへ決定打！" : "ボディへ決定打！");
        }
      });
    }

    classifyPunch(player, limb, arm) {
      const shoulder = player.joints[`${limb}Shoulder`];
      const elbow = player.joints[`${limb}Elbow`];
      const shoulderDrive = Math.max(0, -shoulder.angularVelocity);
      const elbowDrive = Math.max(0, elbow.angularVelocity);
      const forwardSpeed = Math.max(0, arm.vx * player.facing);
      const timing = player.armTiming[limb];
      const now = performance.now();
      const shoulderRecent = timing.shoulderAt && now - timing.shoulderAt < 600;
      const elbowRecent = timing.elbowAt && now - timing.elbowAt < 600;
      let syncFactor = shoulderRecent ? .58 : .42;
      if (elbowRecent && !shoulderRecent) syncFactor = .66;
      if (shoulderRecent && elbowRecent) {
        const delay = timing.elbowAt - timing.shoulderAt;
        syncFactor = delay >= 35 && delay <= 280 ? 1.4 - Math.abs(delay - 150) / 600 : Math.abs(delay) <= 70 ? 1.08 : .82;
      }
      const angle = Math.abs(player.bodyAngle);
      let balanceFactor = angle < CONFIG.UNSTABLE_ANGLE ? 1 : angle < CONFIG.STAGGER_ANGLE ? .7 : .3;
      if (player.state === "STAGGER") balanceFactor *= .65;
      if (player.state === "FALL") balanceFactor = .1;
      balanceFactor *= .55 + player.balance / 220;
      const momentumFactor = 1 + Math.min(.22, Math.max(0, player.vx * player.facing) * 2.8);
      const speedFactor = Math.min(1, forwardSpeed / 330);
      const power = Math.min(1, speedFactor * syncFactor * balanceFactor * momentumFactor);
      const coordination = Math.min(1, syncFactor / 1.4);
      const bend = Math.abs(elbow.angle);
      let type = "WEAK";
      if (coordination > .48 && forwardSpeed > 120 && bend < .7) type = limb === "arm1" ? "JAB" : "STRAIGHT";
      else if (shoulderDrive > 1.1 && bend > .7 && Math.abs(arm.vy) > 42) type = "HOOK";
      return { type, damage: Math.max(.35, power * CONFIG.MAX_HIT_DAMAGE), power, balanceFactor, syncFactor, coordination };
    }

    armGuardCollision(point, player) {
      const scale = this.characterScale();
      const glove = scale * CONFIG.GLOVE_RADIUS;
      const armRadius = scale * CONFIG.ARM_RADIUS;
      return LIMBS.some((limb) => {
        const arm = player.pose.arms[limb];
        return this.distance(point, arm.hand) <= glove * 1.8
          || this.pointSegmentDistance(point, arm.shoulder, arm.elbow) <= glove + armRadius
          || this.pointSegmentDistance(point, arm.elbow, arm.hand) <= glove + armRadius;
      });
    }

    targetGeometry(player) {
      const scale = this.characterScale();
      const pose = player.pose || this.calculatePose(player);
      return {
        head: { x: pose.head.x, y: pose.head.y, radius: scale * CONFIG.HEAD_RADIUS },
        body: { start: pose.neck, end: pose.hip, radius: scale * CONFIG.BODY_RADIUS },
        fistRadius: scale * CONFIG.GLOVE_RADIUS
      };
    }

    addCollisionMark(point, now, color) {
      this.collisionMarks.push({ x: point.x, y: point.y, at: now, color });
    }

    pointCapsuleDistance(point, start, end) {
      return this.pointSegmentDistance(point, start, end);
    }

    pointSegmentDistance(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      return Math.hypot(point.x - (start.x + dx * amount), point.y - (start.y + dy * amount));
    }

    segmentSegmentDistance(a, b, c, d) {
      const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(denominator) > .0001) {
        const first = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
        const second = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
        if (first >= 0 && first <= 1 && second >= 0 && second <= 1) return 0;
      }
      return Math.min(
        this.pointSegmentDistance(a, c, d), this.pointSegmentDistance(b, c, d),
        this.pointSegmentDistance(c, a, b), this.pointSegmentDistance(d, a, b)
      );
    }

    distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    characterScale() {
      return Math.max(64, Math.min(this.width * .2, this.height * .25, 108));
    }

    idealDistance() {
      return this.characterScale() * CONFIG.START_DISTANCE_SCALE / this.width;
    }

    updateHud() {
      this.players.forEach((player, index) => {
        const ratio = Math.max(0, player.hp / CONFIG.BODY_HP);
        this.energyBars[index].style.transform = `scaleX(${ratio.toFixed(3)})`;
        this.energyBars[index].classList.toggle("tired", ratio < .3);
      });
      if (!(this.debug || this.testMode)) return;
      const degrees = (value) => (value * 180 / Math.PI).toFixed(1);
      const lines = [];
      if (this.testMode) lines.push(`TEST ∞  SPEED ${(this.gameSpeed || 1).toFixed(2)}x`);
      this.players.forEach((player, index) => {
        const pose = player.pose || this.calculatePose(player);
        const support = pose.support;
        lines.push(`P${index + 1} BODY ${degrees(player.bodyAngle)}°  X ${player.x.toFixed(3)} Y ${player.y.toFixed(3)}`);
        lines.push(`P${index + 1} BALANCE ${player.balance.toFixed(0)}  STATE ${player.state}`);
        lines.push(`P${index + 1} ① SHOULDER ${degrees(player.joints.arm1Shoulder.angle)}°  ELBOW ${degrees(player.joints.arm1Elbow.angle)}°`);
        lines.push(`P${index + 1} ② SHOULDER ${degrees(player.joints.arm2Shoulder.angle)}°  ELBOW ${degrees(player.joints.arm2Elbow.angle)}°`);
        lines.push(`P${index + 1} ① FIST ${pose.arms.arm1.speed.toFixed(0)}  RESPONSE ${player.armTiming.arm1.responseMs || "--"}ms`);
        lines.push(`P${index + 1} ② FIST ${pose.arms.arm2.speed.toFixed(0)}  RESPONSE ${player.armTiming.arm2.responseMs || "--"}ms`);
        lines.push(`P${index + 1} HIT POWER ${player.lastHitPower.toFixed(1)}  BLOCK ${player.lastBlock ? "YES" : "NO"}`);
      });
      if (this.debug) lines.push(`FPS ${Math.round(this.fps)}  ELAPSED ${this.elapsed.toFixed(1)}s`);
      this.debugPanel.textContent = lines.join("\n");
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.players) this.players.forEach((player) => { player.pose = this.calculatePose(player); });
      this.render();
    }

    render() {
      if (!this.context || !this.players) return;
      const ctx = this.context;
      ctx.save();
      ctx.translate((Math.random() - .5) * this.shake * 4, (Math.random() - .5) * this.shake * 3);
      this.drawArena(ctx);
      this.drawPlayer(ctx, this.players[1], "#ff5a51");
      this.drawPlayer(ctx, this.players[0], "#27d9e6");
      if (this.testMode) this.drawTestOverlay(ctx);
      if (this.impact) this.drawImpact(ctx, this.impact);
      this.drawFeedback(ctx);
      const remaining = this.testMode ? "∞" : Math.max(0, CONFIG.TIME_LIMIT - this.elapsed).toFixed(0);
      ctx.fillStyle = "rgba(255,248,223,.78)";
      ctx.font = `900 ${Math.max(12, Math.min(16, this.height * .032))}px ui-monospace,Consolas,monospace`;
      ctx.textAlign = "center";
      ctx.fillText(remaining, this.width * .5, this.height * .095);
      ctx.restore();
    }

    drawArena(ctx) {
      const w = this.width;
      const h = this.height;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#072d3b");
      sky.addColorStop(.52, "#0c1621");
      sky.addColorStop(1, "#22131a");
      ctx.fillStyle = sky;
      ctx.fillRect(-8, -8, w + 16, h + 16);
      ctx.fillStyle = "rgba(255,255,255,.035)";
      for (let row = 0; row < 4; row += 1) {
        const y = h * (.17 + row * .12);
        ctx.fillRect(0, y, w, 1);
      }
      const left = w * .06;
      const right = w * .94;
      const floor = h * CONFIG.GROUND_Y;
      ctx.lineCap = "round";
      [floor - h * .24, floor - h * .16, floor - h * .08].forEach((y, index) => {
        ctx.strokeStyle = index === 1 ? "rgba(255,90,81,.45)" : "rgba(238,244,239,.48)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      });
      ctx.fillStyle = "#d6a23f";
      ctx.fillRect(left - 6, floor - h * .29, 9, h * .31);
      ctx.fillRect(right - 3, floor - h * .29, 9, h * .31);
      ctx.fillStyle = "#d9c9a4";
      ctx.fillRect(left, floor, right - left, h * .045);
      ctx.fillStyle = "#72482c";
      ctx.fillRect(left, floor + h * .045, right - left, h * .035);
      ctx.strokeStyle = "rgba(255,255,255,.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * .5, floor - h * .29);
      ctx.lineTo(w * .5, floor);
      ctx.stroke();
    }

    drawPlayer(ctx, player, color) {
      const pose = player.pose;
      const scale = this.characterScale();
      this.drawArm(ctx, pose.arms.arm2, color, scale, .62);
      ctx.save();
      ctx.strokeStyle = "#16202a";
      ctx.lineWidth = scale * .14;
      ctx.lineCap = "round";
      for (let index = 0; index < 2; index += 1) {
        ctx.beginPath();
        ctx.moveTo(pose.hip.x, pose.hip.y);
        ctx.lineTo(pose.knees[index].x, pose.knees[index].y);
        ctx.lineTo(pose.feet[index].x, pose.feet[index].y);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = scale * .085;
      for (let index = 0; index < 2; index += 1) {
        ctx.beginPath();
        ctx.moveTo(pose.hip.x, pose.hip.y);
        ctx.lineTo(pose.knees[index].x, pose.knees[index].y);
        ctx.lineTo(pose.feet[index].x, pose.feet[index].y);
        ctx.stroke();
        ctx.fillStyle = "#ffc857";
        ctx.beginPath();
        ctx.arc(pose.knees[index].x, pose.knees[index].y, scale * .055, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.translate(pose.center.x, pose.center.y);
      ctx.rotate(player.bodyAngle);
      ctx.scale(player.facing, 1);
      if ((this.sprite.complete && this.sprite.naturalWidth) || this.sprite.width) {
        ctx.drawImage(this.sprite, -scale * .44, -scale * .81, scale * .88, scale * 1.12);
      } else {
        ctx.fillStyle = "#18232d";
        ctx.fillRect(-scale * .26, -scale * .36, scale * .52, scale * .72);
        ctx.beginPath();
        ctx.arc(0, -scale * .56, scale * .21, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = scale * .045;
      ctx.strokeRect(-scale * .25, -scale * .26, scale * .5, scale * .42);
      ctx.fillStyle = color;
      ctx.globalAlpha = .72;
      ctx.fillRect(-scale * .19, -scale * .12, scale * .38, scale * .07);
      ctx.restore();
      this.drawArm(ctx, pose.arms.arm1, color, scale, 1);
      this.drawArmLabel(ctx, pose.arms.arm1.elbow, "①", color, scale);
      this.drawArmLabel(ctx, pose.arms.arm2.elbow, "②", color, scale);
    }

    drawArmLabel(ctx, point, label, color, scale) {
      ctx.save();
      ctx.fillStyle = "rgba(4,15,24,.88)";
      ctx.beginPath();
      ctx.arc(point.x, point.y - scale * .15, scale * .105, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${Math.max(12, scale * .13)}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, point.x, point.y - scale * .15);
      ctx.restore();
    }

    drawArm(ctx, arm, color, scale, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (arm.speed > 150) {
        const length = Math.min(scale * .48, arm.speed * .055);
        const magnitude = Math.max(1, arm.speed);
        const backX = arm.hand.x - arm.vx / magnitude * length;
        const backY = arm.hand.y - arm.vy / magnitude * length;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.min(.7, (arm.speed - 120) / 350) * alpha;
        for (const spread of [-5, 5]) {
          ctx.beginPath();
          ctx.moveTo(arm.hand.x, arm.hand.y + spread);
          ctx.lineTo(backX, backY + spread);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,.48)";
      ctx.lineWidth = scale * .16;
      ctx.beginPath();
      ctx.moveTo(arm.shoulder.x + 3, arm.shoulder.y + 3);
      ctx.lineTo(arm.elbow.x + 3, arm.elbow.y + 3);
      ctx.lineTo(arm.hand.x + 3, arm.hand.y + 3);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = scale * .1;
      ctx.beginPath();
      ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
      ctx.lineTo(arm.elbow.x, arm.elbow.y);
      ctx.lineTo(arm.hand.x, arm.hand.y);
      ctx.stroke();
      for (const point of [arm.shoulder, arm.elbow]) {
        ctx.fillStyle = "#ffc857";
        ctx.beginPath();
        ctx.arc(point.x, point.y, scale * .06, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#17222c";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(arm.hand.x, arm.hand.y, scale * CONFIG.GLOVE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    drawTestOverlay(ctx) {
      const scale = this.characterScale();
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      this.players.forEach((player, index) => {
        const pose = player.pose;
        const geometry = this.targetGeometry(player);
        const color = index === 0 ? "#76f4ff" : "#ff8c86";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = .78;
        ctx.beginPath();
        ctx.arc(geometry.head.x, geometry.head.y, geometry.head.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(geometry.body.start.x, geometry.body.start.y);
        ctx.lineTo(geometry.body.end.x, geometry.body.end.y);
        ctx.lineWidth = geometry.body.radius * 2;
        ctx.globalAlpha = .12;
        ctx.stroke();
        ctx.globalAlpha = .78;
        ctx.lineWidth = 1.2;
        for (const limb of LIMBS) {
          const arm = pose.arms[limb];
          ctx.beginPath();
          ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
          ctx.lineTo(arm.elbow.x, arm.elbow.y);
          ctx.lineTo(arm.hand.x, arm.hand.y);
          ctx.stroke();
          [arm.shoulder, arm.elbow, arm.hand].forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, point === arm.hand ? scale * CONFIG.GLOVE_RADIUS : 3, 0, Math.PI * 2);
            ctx.stroke();
          });
        }
        const supportLeft = (pose.support.centerX - pose.support.halfWidth) * this.width;
        const supportRight = (pose.support.centerX + pose.support.halfWidth) * this.width;
        const ground = CONFIG.GROUND_Y * this.height;
        ctx.beginPath();
        ctx.moveTo(supportLeft, ground + 6);
        ctx.lineTo(supportRight, ground + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pose.centerOfMass.x, pose.centerOfMass.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      this.collisionMarks.forEach((mark) => {
        ctx.strokeStyle = mark.color;
        ctx.beginPath();
        ctx.moveTo(mark.x - 7, mark.y - 7);
        ctx.lineTo(mark.x + 7, mark.y + 7);
        ctx.moveTo(mark.x + 7, mark.y - 7);
        ctx.lineTo(mark.x - 7, mark.y + 7);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawImpact(ctx, impact) {
      ctx.save();
      ctx.translate(impact.x, impact.y);
      ctx.strokeStyle = impact.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = Math.max(0, impact.life);
      for (let index = 0; index < 9; index += 1) {
        const angle = index * Math.PI * 2 / 9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * (20 + impact.life * 16), Math.sin(angle) * (20 + impact.life * 16));
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFeedback(ctx) {
      ctx.save();
      ctx.font = `950 ${Math.max(13, Math.min(19, this.width * .043))}px ui-monospace,Consolas,monospace`;
      ctx.textAlign = "center";
      this.players.forEach((player) => {
        if (!player.feedback) return;
        ctx.fillStyle = player.feedback === "BLOCK!" ? "#9beaf1" : "#ffc857";
        ctx.fillText(player.feedback, player.pose.head.x, player.pose.head.y - this.characterScale() * .34);
      });
      ctx.restore();
    }

    finish(winner, reason) {
      if (!this.active) return;
      this.active = false;
      if (this.centerRivet) this.centerRivet.classList.remove("fight-active");
      cancelAnimationFrame(this.animationId);
      this.jointButtons.flat().forEach((button) => button.classList.remove("active"));
      this.render();
      this.onFinish(winner, reason);
    }
  }

  window.WOBBLE_BOXING_CONFIG = CONFIG;
  window.WobbleBoxingGame = WobbleBoxingGame;
})();
