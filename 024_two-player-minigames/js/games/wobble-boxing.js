(() => {
  "use strict";

  const CONFIG = Object.freeze({
    UPPER_ARM_LENGTH: .6,
    FOREARM_LENGTH: .58,
    SHOULDER_SPEED: 2.7,
    ELBOW_SPEED: 3.5,
    SHOULDER_TORQUE: 9.2,
    ELBOW_TORQUE: 12,
    SHOULDER_RETURN_SPEED: 4.8,
    ELBOW_RETURN_SPEED: 6.2,
    JOINT_FRICTION: .965,
    RETURN_FRICTION: .91,
    JOINT_EDGE_BOUNCE: .18,
    LEFT_SHOULDER_MIN_ANGLE: -.35,
    LEFT_SHOULDER_MAX_ANGLE: 1.134,
    RIGHT_SHOULDER_MIN_ANGLE: -1.134,
    RIGHT_SHOULDER_MAX_ANGLE: .35,
    LEFT_ELBOW_MIN_ANGLE: -2.53,
    LEFT_ELBOW_MAX_ANGLE: -.35,
    RIGHT_ELBOW_MIN_ANGLE: .35,
    RIGHT_ELBOW_MAX_ANGLE: 2.53,
    GUARD_SHOULDER_ANGLE: 1.05,
    GUARD_ELBOW_ANGLE: 2.35,
    PLAYER_START_OFFSET: .05,
    MAX_PUNCH_LUNGE: .082,
    BODY_ROTATION_FACTOR: .18,
    BODY_MAX_ROTATION: .22,
    BODY_ROTATION_RETURN: 7,
    BODY_ANGULAR_FRICTION: .92,
    PUNCH_BODY_SHIFT: .0045,
    GLOVE_RADIUS: .16,
    GLOVE_SCALE: .82,
    ARM_RADIUS: .07,
    SELF_COLLISION_ENABLED: true,
    COLLISION_MARK_LIFETIME: .38,
    FIGHT_LOGO_ACTIVE_OPACITY: .15,
    CENTER_LINE_OPACITY: .16,
    ARM_COLLISION_BOUNCE: .28,
    ARM_COLLISION_COOLDOWN: 110,
    BLOCK_DAMAGE_MULTIPLIER: .1,
    JAB_THRESHOLD: .78,
    STRAIGHT_THRESHOLD: 1.35,
    HOOK_THRESHOLD: .58,
    BODY_HP: 100,
    HEAD_DAMAGE_MULTIPLIER: 1.5,
    MIN_HIT_SPEED: 62,
    MAX_HIT_DAMAGE: 18,
    BODY_KNOCKBACK: .0045,
    HEAD_KNOCKBACK: .0065,
    HIT_COOLDOWN: 390,
    BODY_RETURN: 3.2,
    BODY_FRICTION: .88,
    TIME_LIMIT: 32
  });

  const JOINT_NAMES = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"];

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
        const pixels = frame.data;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const lightest = Math.max(red, green, blue);
          const darkest = Math.min(red, green, blue);
          if (darkest > 218 && lightest - darkest < 24) pixels[offset + 3] = 0;
        }
        context.putImageData(frame, 0, 0);
      } catch (_) {
        return image;
      }
      return surface;
    }

    reset() {
      this.active = false;
      if (this.centerRivet) this.centerRivet.classList.remove("fight-active");
      this.elapsed = 0;
      this.shake = 0;
      this.impact = null;
      this.lastClashAt = 0;
      this.armCollisionCooldowns = new Map();
      this.collisionMarks = [];
      this.blockedPunches = new Set();
      this.players = [this.makePlayer(0), this.makePlayer(1)];
      this.lastFrame = performance.now();
      this.players.forEach((player) => { player.arms = this.calculateArms(player); });
      this.jointButtons.flat().forEach((button) => button.classList.remove("active"));
      this.updateButtonDirections();
      this.updateHud();
      this.render();
    }

    makePlayer(index) {
      const joints = {
        leftShoulder: { angle: CONFIG.GUARD_SHOULDER_ANGLE, angularVelocity: 0, holding: false },
        rightShoulder: { angle: -CONFIG.GUARD_SHOULDER_ANGLE, angularVelocity: 0, holding: false },
        leftElbow: { angle: -CONFIG.GUARD_ELBOW_ANGLE, angularVelocity: 0, holding: false },
        rightElbow: { angle: CONFIG.GUARD_ELBOW_ANGLE, angularVelocity: 0, holding: false }
      };
      return {
        index,
        baseX: .5,
        baseY: index === 0 ? .32 - CONFIG.PLAYER_START_OFFSET : .68 + CONFIG.PLAYER_START_OFFSET,
        x: .5,
        y: index === 0 ? .32 - CONFIG.PLAYER_START_OFFSET : .68 + CONFIG.PLAYER_START_OFFSET,
        vx: 0,
        vy: 0,
        facing: index === 0 ? 0 : Math.PI,
        bodyAngle: 0,
        angularVelocity: 0,
        hp: CONFIG.BODY_HP,
        damage: 0,
        joints,
        arms: null,
        lastHitPower: 0,
        lastPunchType: "WEAK",
        lastBlock: false,
        armCollision: false,
        selfCollision: false,
        feedback: "",
        feedbackUntil: 0
      };
    }

    bindInput() {
      this.pointerHandlers = this.jointButtons.map((buttons, playerIndex) => buttons.map((button) => {
        const jointName = button.dataset.joint;
        const down = (event) => {
          if (!this.active || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.preventDefault();
          event.stopPropagation();
          const joint = this.players[playerIndex].joints[jointName];
          joint.holding = true;
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
        ["KeyQ", [0, "leftShoulder"]], ["KeyW", [0, "rightShoulder"]], ["KeyA", [0, "leftElbow"]], ["KeyS", [0, "rightElbow"]],
        ["KeyO", [1, "leftShoulder"]], ["KeyP", [1, "rightShoulder"]], ["KeyK", [1, "leftElbow"]], ["KeyL", [1, "rightElbow"]]
      ]);
      this.keyDownHandler = (event) => {
        const target = keyMap.get(event.code);
        if (!target || event.repeat || !this.active) return;
        event.preventDefault();
        this.players[target[0]].joints[target[1]].holding = true;
      };
      this.keyUpHandler = (event) => {
        const target = keyMap.get(event.code);
        if (!target) return;
        const joint = this.players[target[0]].joints[target[1]];
        if (!joint.holding) return;
        event.preventDefault();
        joint.holding = false;
      };
      window.addEventListener("keydown", this.keyDownHandler);
      window.addEventListener("keyup", this.keyUpHandler);
    }

    preventMenu(event) { event.preventDefault(); }

    updateButtonDirections() {
      this.jointButtons.forEach((buttons) => buttons.forEach((button) => {
        const indicator = button.querySelector(".joint-direction");
        if (indicator) indicator.textContent = "";
      }));
    }

    guardAngle(name) {
      if (name === "leftShoulder") return CONFIG.GUARD_SHOULDER_ANGLE;
      if (name === "rightShoulder") return -CONFIG.GUARD_SHOULDER_ANGLE;
      if (name === "leftElbow") return -CONFIG.GUARD_ELBOW_ANGLE;
      return CONFIG.GUARD_ELBOW_ANGLE;
    }

    jointDriveDirection(name) {
      return name === "rightShoulder" || name === "leftElbow" ? 1 : -1;
    }

    jointLimits(name) {
      return {
        leftShoulder: [CONFIG.LEFT_SHOULDER_MIN_ANGLE, CONFIG.LEFT_SHOULDER_MAX_ANGLE],
        rightShoulder: [CONFIG.RIGHT_SHOULDER_MIN_ANGLE, CONFIG.RIGHT_SHOULDER_MAX_ANGLE],
        leftElbow: [CONFIG.LEFT_ELBOW_MIN_ANGLE, CONFIG.LEFT_ELBOW_MAX_ANGLE],
        rightElbow: [CONFIG.RIGHT_ELBOW_MIN_ANGLE, CONFIG.RIGHT_ELBOW_MAX_ANGLE]
      }[name];
    }

    start() {
      this.active = true;
      if (this.centerRivet) this.centerRivet.classList.add("fight-active");
      this.lastFrame = performance.now();
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
      const rawDt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / rawDt) - this.fps) * .08;
      this.lastFrame = now;
      const speed = this.testMode ? (this.gameSpeed || 1) : 1;
      this.update(rawDt * speed, now);
      this.render();
      if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed += dt;
      const frameScale = dt * 60;
      if (!this.blockedPunches) this.blockedPunches = new Set();
      this.blockedPunches.clear();
      this.players.forEach((player) => {
        const previousArms = player.arms || this.calculateArms(player);
        player.previousJointAngles = {};
        player.armCollision = false;
        player.selfCollision = false;
        player.lastBlock = false;
        const wobble = (1 - player.hp / CONFIG.BODY_HP) * .7;
        JOINT_NAMES.forEach((name) => {
          const joint = player.joints[name];
          player.previousJointAngles[name] = joint.angle;
          const shoulder = name.includes("Shoulder");
          const speed = shoulder ? CONFIG.SHOULDER_SPEED : CONFIG.ELBOW_SPEED;
          const torque = shoulder ? CONFIG.SHOULDER_TORQUE : CONFIG.ELBOW_TORQUE;
          const returnSpeed = shoulder ? CONFIG.SHOULDER_RETURN_SPEED : CONFIG.ELBOW_RETURN_SPEED;
          const [minimum, maximum] = this.jointLimits(name);
          if (joint.holding) joint.angularVelocity += this.jointDriveDirection(name) * torque * dt;
          else {
            joint.angularVelocity += (this.guardAngle(name) - joint.angle) * returnSpeed * dt;
            joint.angularVelocity *= Math.pow(CONFIG.RETURN_FRICTION, frameScale);
          }
          joint.angularVelocity += Math.sin(now * .009 + player.index * 2 + name.length) * wobble * dt;
          joint.angularVelocity *= Math.pow(CONFIG.JOINT_FRICTION, frameScale);
          joint.angularVelocity = Math.max(-speed, Math.min(speed, joint.angularVelocity));
          joint.angle += joint.angularVelocity * dt;
          if (joint.angle <= minimum || joint.angle >= maximum) {
            joint.angle = Math.max(minimum, Math.min(maximum, joint.angle));
            joint.angularVelocity *= -CONFIG.JOINT_EDGE_BOUNCE;
          }
        });
        const lunge = Math.max(this.armExtensionProgress(player, "left"), this.armExtensionProgress(player, "right")) * CONFIG.MAX_PUNCH_LUNGE;
        const facingForward = { x: Math.sin(player.facing), y: Math.cos(player.facing) };
        const targetX = player.baseX + facingForward.x * lunge;
        const targetY = player.baseY + facingForward.y * lunge;
        player.vx += (targetX - player.x) * CONFIG.BODY_RETURN * dt;
        player.vy += (targetY - player.y) * CONFIG.BODY_RETURN * dt;
        player.vx *= Math.pow(CONFIG.BODY_FRICTION, frameScale);
        player.vy *= Math.pow(CONFIG.BODY_FRICTION, frameScale);
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.x = Math.max(.34, Math.min(.66, player.x));
        player.y = player.index === 0 ? Math.max(.22, Math.min(.44, player.y)) : Math.max(.56, Math.min(.78, player.y));
        const leftDrive = Math.max(0, CONFIG.GUARD_SHOULDER_ANGLE - player.joints.leftShoulder.angle);
        const rightDrive = Math.max(0, player.joints.rightShoulder.angle + CONFIG.GUARD_SHOULDER_ANGLE);
        const bodyTarget = Math.max(-CONFIG.BODY_MAX_ROTATION, Math.min(CONFIG.BODY_MAX_ROTATION, (leftDrive - rightDrive) * CONFIG.BODY_ROTATION_FACTOR));
        player.angularVelocity += (bodyTarget - player.bodyAngle) * CONFIG.BODY_ROTATION_RETURN * dt;
        player.angularVelocity *= Math.pow(CONFIG.BODY_ANGULAR_FRICTION, frameScale);
        player.bodyAngle += player.angularVelocity * dt;
        player.bodyAngle = Math.max(-CONFIG.BODY_MAX_ROTATION, Math.min(CONFIG.BODY_MAX_ROTATION, player.bodyAngle));
        const nextArms = this.calculateArms(player);
        const forward = { x: Math.sin(player.facing + player.bodyAngle), y: Math.cos(player.facing + player.bodyAngle) };
        for (const side of ["left", "right"]) {
          nextArms[side].vx = (nextArms[side].hand.x - previousArms[side].hand.x) / dt;
          nextArms[side].vy = (nextArms[side].hand.y - previousArms[side].hand.y) / dt;
          nextArms[side].speed = Math.hypot(nextArms[side].vx, nextArms[side].vy);
          nextArms[side].lastHitAt = previousArms[side].lastHitAt || 0;
          const forwardSpeed = nextArms[side].vx * forward.x + nextArms[side].vy * forward.y;
          if (forwardSpeed > CONFIG.MIN_HIT_SPEED) {
            const shift = Math.min(.45, forwardSpeed * CONFIG.PUNCH_BODY_SHIFT) * dt;
            player.vx += forward.x * shift;
            player.vy += forward.y * shift;
          }
        }
        player.arms = nextArms;
        if (CONFIG.SELF_COLLISION_ENABLED) this.resolveSelfCollision(player, previousArms, now);
        if (now > player.feedbackUntil) player.feedback = "";
      });
      this.resolveArmClash(now);
      this.resolveHits(now);
      this.shake *= Math.pow(.79, frameScale);
      if (this.impact) this.impact.life -= dt * 3.6;
      if (this.impact && this.impact.life <= 0) this.impact = null;
      this.collisionMarks = (this.collisionMarks || []).filter((mark) => now - mark.at <= CONFIG.COLLISION_MARK_LIFETIME * 1000);
      if (!this.testMode && this.elapsed >= CONFIG.TIME_LIMIT) {
        if (Math.abs(this.players[0].hp - this.players[1].hp) < .5) return this.finish(0, "\u6642\u9593\u5207\u308c\u30fb\u4e92\u89d2\uff01");
        const winner = this.players[0].hp > this.players[1].hp ? 1 : 2;
        return this.finish(winner, "\u6642\u9593\u5207\u308c\u5224\u5b9a\uff01");
      }
      this.updateHud();
    }

    armExtensionProgress(player, side) {
      const shoulderName = `${side}Shoulder`;
      const elbowName = `${side}Elbow`;
      const shoulderTravel = Math.max(0, (player.joints[shoulderName].angle - this.guardAngle(shoulderName)) * this.jointDriveDirection(shoulderName));
      const elbowTravel = Math.max(0, (player.joints[elbowName].angle - this.guardAngle(elbowName)) * this.jointDriveDirection(elbowName));
      return Math.min(1, shoulderTravel / 1.05 * .45 + elbowTravel / 2 * .55);
    }

    calculateArms(player) {
      const scale = this.characterScale();
      const center = { x: player.x * this.width, y: player.y * this.height };
      const rotation = player.facing + player.bodyAngle;
      const forward = { x: Math.sin(rotation), y: Math.cos(rotation) };
      const right = { x: Math.cos(rotation), y: -Math.sin(rotation) };
      const result = {};
      for (const side of ["left", "right"]) {
        const sign = side === "left" ? 1 : -1;
        const shoulder = {
          x: center.x + right.x * sign * scale * .32 + forward.x * scale * .02,
          y: center.y + right.y * sign * scale * .32 + forward.y * scale * .02
        };
        const shoulderAngle = rotation + player.joints[`${side}Shoulder`].angle;
        const elbow = {
          x: shoulder.x + Math.sin(shoulderAngle) * scale * CONFIG.UPPER_ARM_LENGTH,
          y: shoulder.y + Math.cos(shoulderAngle) * scale * CONFIG.UPPER_ARM_LENGTH
        };
        const forearmAngle = shoulderAngle + player.joints[`${side}Elbow`].angle;
        const hand = {
          x: elbow.x + Math.sin(forearmAngle) * scale * CONFIG.FOREARM_LENGTH,
          y: elbow.y + Math.cos(forearmAngle) * scale * CONFIG.FOREARM_LENGTH
        };
        result[side] = { shoulder, elbow, hand, vx: 0, vy: 0, speed: 0, lastHitAt: 0 };
      }
      return result;
    }

    resolveHits(now) {
      this.players.forEach((attacker, attackerIndex) => {
        const target = this.players[1 - attackerIndex];
        for (const side of ["left", "right"]) {
          const arm = attacker.arms[side];
          if (arm.speed < CONFIG.MIN_HIT_SPEED || now - arm.lastHitAt < CONFIG.HIT_COOLDOWN) continue;
          if (this.blockedPunches && this.blockedPunches.has(`${attackerIndex}:${side}`)) continue;
          const forward = { x: Math.sin(attacker.facing + attacker.bodyAngle), y: Math.cos(attacker.facing + attacker.bodyAngle) };
          const directionScore = (arm.vx * forward.x + arm.vy * forward.y) / Math.max(1, arm.speed);
          if (directionScore < .18) continue;
          const targetGeometry = this.targetGeometry(target);
          const guarded = this.isGuarded(arm.hand, target);
          const headHit = this.distance(arm.hand, targetGeometry.head) <= targetGeometry.head.radius + targetGeometry.fistRadius;
          const bodyHit = this.distance(arm.hand, targetGeometry.body) <= targetGeometry.body.radius + targetGeometry.fistRadius;
          if (!guarded && !headHit && !bodyHit) continue;
          arm.lastHitAt = now;
          const punch = this.classifyPunch(attacker, side, arm, directionScore);
          attacker.lastPunchType = punch.type;
          if (guarded) {
            const chipDamage = punch.damage * CONFIG.BLOCK_DAMAGE_MULTIPLIER;
            target.hp = Math.max(0, target.hp - chipDamage);
            attacker.lastHitPower = chipDamage;
            target.lastBlock = true;
            target.feedback = "BLOCK!";
            target.feedbackUntil = now + 380;
            target.angularVelocity += (side === "left" ? -1 : 1) * .16;
            attacker.joints[`${side}Shoulder`].angularVelocity *= -CONFIG.ARM_COLLISION_BOUNCE;
            attacker.joints[`${side}Elbow`].angularVelocity *= -CONFIG.ARM_COLLISION_BOUNCE;
            if (this.onBlockSound) this.onBlockSound();
            this.impact = { x: arm.hand.x, y: arm.hand.y, life: .65, color: "#d9f4ff" };
            continue;
          }
          const multiplier = headHit ? CONFIG.HEAD_DAMAGE_MULTIPLIER : 1;
          const damage = Math.min(CONFIG.MAX_HIT_DAMAGE, punch.damage * multiplier);
          target.hp = Math.max(0, target.hp - damage);
          target.damage = Math.min(1, target.damage + damage / 35);
          attacker.lastHitPower = damage;
          const force = (headHit ? CONFIG.HEAD_KNOCKBACK : CONFIG.BODY_KNOCKBACK) * damage;
          target.vx += arm.vx / arm.speed * force;
          target.vy += arm.vy / arm.speed * force;
          attacker.vx -= arm.vx / arm.speed * force * .28;
          attacker.vy -= arm.vy / arm.speed * force * .28;
          target.angularVelocity += (side === "left" ? -1 : 1) * damage * (headHit ? .018 : .007);
          target.feedback = punch.type === "WEAK" ? (headHit ? "HEAD!" : "HIT!") : `${punch.type}!`;
          target.feedbackUntil = now + 520;
          this.shake = Math.min(1.4, this.shake + damage / 16);
          this.impact = { x: arm.hand.x, y: arm.hand.y, life: 1, color: headHit ? "#ffc857" : "#fff8df" };
          if (this.onPunchSound) this.onPunchSound(damage / CONFIG.MAX_HIT_DAMAGE, headHit);
          if (target.hp <= 0) return this.finish(attackerIndex + 1, headHit ? "\u30d8\u30c3\u30c9\u3078\u6c7a\u5b9a\u6253\uff01" : "\u30dc\u30c7\u30a3\u306b\u6c7a\u5b9a\u6253\uff01");
        }
      });
    }

    resolveArmClash(now) {
      if (!this.blockedPunches) this.blockedPunches = new Set();
      if (!this.armCollisionCooldowns) this.armCollisionCooldowns = new Map();
      const scale = this.characterScale();
      for (const first of ["left", "right"]) {
        for (const second of ["left", "right"]) {
          const a = this.players[0].arms[first];
          const b = this.players[1].arms[second];
          const collision = this.armCollision(a, b, scale);
          if (!collision) continue;
          this.blockedPunches.add(`0:${first}`);
          this.blockedPunches.add(`1:${second}`);
          this.players[0].armCollision = true;
          this.players[1].armCollision = true;
          const key = `${first}:${second}`;
          const previousCollision = this.armCollisionCooldowns.get(key) || 0;
          if (now - previousCollision < CONFIG.ARM_COLLISION_COOLDOWN) continue;
          this.armCollisionCooldowns.set(key, now);
          this.lastClashAt = now;
          this.addCollisionMark(collision, now, "#9beaf1");
          this.bounceArm(this.players[0], first, -1);
          this.bounceArm(this.players[1], second, 1);
          this.players[0].feedback = "BLOCK!";
          this.players[1].feedback = "BLOCK!";
          this.players[0].feedbackUntil = now + 260;
          this.players[1].feedbackUntil = now + 260;
          this.impact = { x: collision.x, y: collision.y, life: .55, color: "#9beaf1" };
          if (this.onBlockSound) this.onBlockSound();
        }
      }
      this.players.forEach((player) => {
        if (!player.armCollision) return;
        const oldArms = player.arms;
        player.arms = this.calculateArms(player);
        for (const side of ["left", "right"]) {
          player.arms[side].vx = oldArms[side].vx * -CONFIG.ARM_COLLISION_BOUNCE;
          player.arms[side].vy = oldArms[side].vy * -CONFIG.ARM_COLLISION_BOUNCE;
          player.arms[side].speed = Math.hypot(player.arms[side].vx, player.arms[side].vy);
          player.arms[side].lastHitAt = oldArms[side].lastHitAt;
        }
      });
    }

    resolveSelfCollision(player, previousArms, now) {
      const scale = this.characterScale();
      const left = player.arms.left;
      const right = player.arms.right;
      const glove = scale * CONFIG.GLOVE_RADIUS * CONFIG.GLOVE_SCALE;
      const arm = scale * CONFIG.ARM_RADIUS;
      const checks = [
        [this.distance(left.hand, right.hand), glove * 2, left.hand, right.hand],
        [this.pointSegmentDistance(left.hand, right.shoulder, right.elbow), glove + arm, left.hand, right.elbow],
        [this.pointSegmentDistance(left.hand, right.elbow, right.hand), glove + arm, left.hand, right.hand],
        [this.pointSegmentDistance(right.hand, left.shoulder, left.elbow), glove + arm, right.hand, left.elbow],
        [this.pointSegmentDistance(right.hand, left.elbow, left.hand), glove + arm, right.hand, left.hand],
        [this.segmentSegmentDistance(left.elbow, left.hand, right.elbow, right.hand), arm * 2, left.elbow, right.elbow]
      ];
      const hit = checks.find(([distance, threshold]) => distance <= threshold);
      if (!hit) return false;
      JOINT_NAMES.forEach((name) => {
        const previous = player.previousJointAngles && player.previousJointAngles[name];
        if (Number.isFinite(previous)) player.joints[name].angle = previous;
        player.joints[name].angularVelocity *= -CONFIG.ARM_COLLISION_BOUNCE;
      });
      player.selfCollision = true;
      player.armCollision = true;
      player.arms = previousArms;
      this.addCollisionMark({ x: (hit[2].x + hit[3].x) / 2, y: (hit[2].y + hit[3].y) / 2 }, now, "#ff75df");
      return true;
    }

    addCollisionMark(point, now, color) {
      if (!this.collisionMarks) this.collisionMarks = [];
      this.collisionMarks.push({ x: point.x, y: point.y, at: now, color });
    }

    bounceArm(player, side, bodyDirection) {
      for (const name of [`${side}Shoulder`, `${side}Elbow`]) {
        const joint = player.joints[name];
        const previous = player.previousJointAngles && player.previousJointAngles[name];
        if (Number.isFinite(previous)) joint.angle = joint.angle * .35 + previous * .65;
        joint.angularVelocity *= -CONFIG.ARM_COLLISION_BOUNCE;
      }
      player.angularVelocity += bodyDirection * .035;
    }

    armCollision(a, b, scale) {
      const glove = scale * CONFIG.GLOVE_RADIUS * CONFIG.GLOVE_SCALE;
      const arm = scale * CONFIG.ARM_RADIUS;
      const checks = [
        [this.distance(a.hand, b.hand), glove * 2, a.hand, b.hand],
        [this.pointSegmentDistance(a.hand, b.shoulder, b.elbow), glove + arm, a.hand, b.elbow],
        [this.pointSegmentDistance(a.hand, b.elbow, b.hand), glove + arm, a.hand, b.hand],
        [this.pointSegmentDistance(b.hand, a.shoulder, a.elbow), glove + arm, b.hand, a.elbow],
        [this.pointSegmentDistance(b.hand, a.elbow, a.hand), glove + arm, b.hand, a.hand],
        [this.segmentSegmentDistance(a.elbow, a.hand, b.elbow, b.hand), arm * 2, a.elbow, b.elbow],
        [this.segmentSegmentDistance(a.elbow, a.hand, b.shoulder, b.elbow), arm * 2, a.elbow, b.elbow],
        [this.segmentSegmentDistance(a.shoulder, a.elbow, b.elbow, b.hand), arm * 2, a.elbow, b.elbow]
      ];
      const hit = checks.find(([distance, threshold]) => distance <= threshold);
      if (!hit) return null;
      return { x: (hit[2].x + hit[3].x) / 2, y: (hit[2].y + hit[3].y) / 2 };
    }

    segmentSegmentDistance(a, b, c, d) {
      const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(denominator) > .0001) {
        const first = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
        const second = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
        if (first >= 0 && first <= 1 && second >= 0 && second <= 1) return 0;
      }
      return Math.min(
        this.pointSegmentDistance(a, c, d),
        this.pointSegmentDistance(b, c, d),
        this.pointSegmentDistance(c, a, b),
        this.pointSegmentDistance(d, a, b)
      );
    }

    classifyPunch(player, side, arm, directionScore) {
      const shoulder = player.joints[`${side}Shoulder`];
      const elbow = player.joints[`${side}Elbow`];
      const shoulderDrive = Math.max(0, shoulder.angularVelocity * this.jointDriveDirection(`${side}Shoulder`));
      const elbowDrive = Math.max(0, elbow.angularVelocity * this.jointDriveDirection(`${side}Elbow`));
      const rotation = player.facing + player.bodyAngle;
      const lateral = Math.abs(arm.vx * Math.cos(rotation) - arm.vy * Math.sin(rotation)) / Math.max(1, arm.speed);
      let type = "WEAK";
      if (lateral >= CONFIG.HOOK_THRESHOLD && shoulderDrive >= CONFIG.JAB_THRESHOLD && Math.abs(elbow.angle) > .55) type = "HOOK";
      else if (shoulderDrive + elbowDrive >= CONFIG.STRAIGHT_THRESHOLD && directionScore > .55) type = "STRAIGHT";
      else if (elbowDrive >= CONFIG.JAB_THRESHOLD && directionScore > .45) type = "JAB";
      const speedScore = Math.min(1, Math.max(0, (arm.speed - CONFIG.MIN_HIT_SPEED) / 190));
      const coordination = Math.min(1, shoulderDrive / 2.2) * .3 + Math.min(1, elbowDrive / 2.8) * .3;
      const punchBonus = type === "WEAK" ? .22 : type === "HOOK" ? .48 : .4;
      const power = Math.min(1, speedScore * .45 + coordination + Math.max(0, directionScore) * .15 + punchBonus);
      return { type, damage: Math.max(.35, power * CONFIG.MAX_HIT_DAMAGE) };
    }

    targetGeometry(player) {
      const scale = this.characterScale();
      const rotation = player.facing + player.bodyAngle;
      return {
        body: { x: player.x * this.width, y: player.y * this.height, radius: scale * .38 },
        head: { x: player.x * this.width + Math.sin(rotation) * scale * .23, y: player.y * this.height + Math.cos(rotation) * scale * .23, radius: scale * .22 },
        fistRadius: Math.max(8, scale * CONFIG.GLOVE_RADIUS * CONFIG.GLOVE_SCALE)
      };
    }

    isGuarded(point, player) {
      const scale = this.characterScale();
      const gloveRadius = CONFIG.GLOVE_RADIUS * CONFIG.GLOVE_SCALE;
      const armThreshold = scale * (CONFIG.ARM_RADIUS + gloveRadius);
      const gloveThreshold = scale * gloveRadius * 2;
      return ["left", "right"].some((side) => {
        const arm = player.arms[side];
        return this.distance(point, arm.hand) <= gloveThreshold
          || this.pointSegmentDistance(point, arm.shoulder, arm.elbow) <= armThreshold
          || this.pointSegmentDistance(point, arm.elbow, arm.hand) <= armThreshold;
      });
    }

    characterScale() {
      return Math.max(78, Math.min(this.width * .3, this.height * .22, 132));
    }

    pointSegmentDistance(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
    }

    distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    finish(winner, reason) {
      if (!this.active) return;
      this.active = false;
      if (this.centerRivet) this.centerRivet.classList.remove("fight-active");
      cancelAnimationFrame(this.animationId);
      this.jointButtons.flat().forEach((button) => button.classList.remove("active"));
      this.render();
      this.onFinish(winner, reason);
    }

    updateHud() {
      this.players.forEach((player, index) => {
        const ratio = Math.max(0, player.hp / CONFIG.BODY_HP);
        this.energyBars[index].style.transform = `scaleX(${ratio.toFixed(3)})`;
        this.energyBars[index].classList.toggle("tired", ratio < .3);
      });
      if (this.debug || this.testMode) {
        const lines = [];
        if (this.testMode) {
          lines.push(`TEST MODE  TIME ∞  SPEED ${(this.gameSpeed || 1).toFixed(2)}x`);
          lines.push(`DIST ${(CONFIG.PLAYER_START_OFFSET * 200).toFixed(0)}%  GLOVE ${(CONFIG.GLOVE_SCALE * 100).toFixed(0)}%  LUNGE ${(CONFIG.MAX_PUNCH_LUNGE * 100).toFixed(1)}%`);
        }
        this.players.forEach((player, index) => {
          const prefix = `P${index + 1}`;
          if (this.testMode && !this.debug) {
            const degrees = (value) => (value * 180 / Math.PI).toFixed(1);
            lines.push(`${prefix} 左肩 ${degrees(player.joints.leftShoulder.angle)}°  右肩 ${degrees(player.joints.rightShoulder.angle)}°`);
            lines.push(`${prefix} 左肘 ${degrees(player.joints.leftElbow.angle)}°  右肘 ${degrees(player.joints.rightElbow.angle)}°`);
            return;
          }
          lines.push(`${prefix} LS ${player.joints.leftShoulder.angle.toFixed(2)}  LE ${player.joints.leftElbow.angle.toFixed(2)}`);
          lines.push(`${prefix} RS ${player.joints.rightShoulder.angle.toFixed(2)}  RE ${player.joints.rightElbow.angle.toFixed(2)}`);
          lines.push(`${prefix} L ${player.arms.left.hand.x.toFixed(0)},${player.arms.left.hand.y.toFixed(0)} ${player.arms.left.speed.toFixed(0)}px/s`);
          lines.push(`${prefix} R ${player.arms.right.hand.x.toFixed(0)},${player.arms.right.hand.y.toFixed(0)} ${player.arms.right.speed.toFixed(0)}px/s`);
          lines.push(`${prefix} body ${player.bodyAngle.toFixed(2)}  ${player.lastPunchType}  power ${player.lastHitPower.toFixed(1)}`);
          lines.push(`${prefix} block ${player.lastBlock ? "YES" : "NO"}  arm clash ${player.armCollision ? "YES" : "NO"}`);
        });
        if (this.debug) lines.push(`elapsed ${this.elapsed.toFixed(1)}s`, `FPS ${Math.round(this.fps)}`);
        this.debugPanel.textContent = lines.join("\n");
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.players) this.players.forEach((player) => { player.arms = this.calculateArms(player); });
      this.render();
    }

    render() {
      if (!this.context || !this.players) return;
      const ctx = this.context;
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.translate((Math.random() - .5) * this.shake * 4, (Math.random() - .5) * this.shake * 4);
      const floor = ctx.createLinearGradient(0, 0, 0, h);
      floor.addColorStop(0, "#0a4556");
      floor.addColorStop(.48, "#101923");
      floor.addColorStop(.52, "#101923");
      floor.addColorStop(1, "#551e2b");
      ctx.fillStyle = floor;
      ctx.fillRect(-8, -8, w + 16, h + 16);
      this.drawRing(ctx, w, h);
      const drawOrder = [
        { player: this.players[0], color: "#27d9e6" },
        { player: this.players[1], color: "#ff5a51" }
      ].sort((a, b) => Math.max(a.player.arms.left.speed, a.player.arms.right.speed) - Math.max(b.player.arms.left.speed, b.player.arms.right.speed));
      drawOrder.forEach(({ player, color }) => this.drawPlayer(ctx, player, color));
      if (this.testMode) this.drawTestOverlay(ctx);
      if (this.impact) this.drawImpact(ctx, this.impact);
      this.drawFeedback(ctx);
      const remaining = this.testMode ? "∞" : Math.max(0, CONFIG.TIME_LIMIT - this.elapsed).toFixed(0);
      ctx.fillStyle = "rgba(255,248,223,.72)";
      ctx.font = `900 ${Math.max(11, Math.min(15, h * .028))}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(w * .11, h * .055);
      ctx.rotate(Math.PI);
      ctx.fillText(remaining, 0, 0);
      ctx.restore();
      ctx.fillText(remaining, w * .89, h * .945);
      ctx.restore();
    }

    drawRing(ctx, w, h) {
      ctx.save();
      const ringWidth = Math.min(w * .84, 520);
      const x = (w - ringWidth) / 2;
      const y = h * .055;
      const ringHeight = h * .89;
      ctx.fillStyle = "rgba(225,231,221,.075)";
      ctx.fillRect(x, y, ringWidth, ringHeight);
      ["rgba(255,248,223,.62)", "rgba(255,90,81,.52)", "rgba(39,217,230,.52)"].forEach((color, index) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = index === 0 ? 3 : 2;
        const inset = index * 6;
        ctx.strokeRect(x + inset, y + inset, ringWidth - inset * 2, ringHeight - inset * 2);
      });
      const postRadius = Math.max(5, Math.min(8, w * .018));
      [[x, y, "#27d9e6"], [x + ringWidth, y, "#27d9e6"], [x, y + ringHeight, "#ff5a51"], [x + ringWidth, y + ringHeight, "#ff5a51"]].forEach(([px, py, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, postRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff8df";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.setLineDash([7, 9]);
      ctx.strokeStyle = `rgba(255,255,255,${CONFIG.CENTER_LINE_OPACITY})`;
      ctx.beginPath();
      ctx.moveTo(x + 12, h / 2);
      ctx.lineTo(x + ringWidth - 12, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = this.active ? CONFIG.FIGHT_LOGO_ACTIVE_OPACITY : 1;
      ctx.fillStyle = "rgba(5,17,27,.62)";
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(27, ringWidth * .075), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,200,87,.72)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffc857";
      ctx.font = `950 ${Math.max(9, Math.min(12, w * .028))}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FIGHT", w / 2, h / 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawPlayer(ctx, player, color) {
      const scale = this.characterScale();
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,.42)";
      ctx.lineWidth = scale * .19;
      ctx.lineCap = "round";
      for (const side of ["left", "right"]) {
        const arm = player.arms[side];
        ctx.beginPath();
        ctx.moveTo(arm.shoulder.x + 3, arm.shoulder.y + 3);
        ctx.lineTo(arm.elbow.x + 3, arm.elbow.y + 3);
        ctx.lineTo(arm.hand.x + 3, arm.hand.y + 3);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = scale * .135;
      for (const side of ["left", "right"]) {
        const arm = player.arms[side];
        ctx.beginPath();
        ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
        ctx.lineTo(arm.elbow.x, arm.elbow.y);
        ctx.lineTo(arm.hand.x, arm.hand.y);
        ctx.stroke();
        ctx.fillStyle = "#d6a44c";
        ctx.beginPath();
        ctx.arc(arm.shoulder.x, arm.shoulder.y, scale * .055, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffc857";
        ctx.beginPath();
        ctx.arc(arm.elbow.x, arm.elbow.y, scale * .075, 0, Math.PI * 2);
        ctx.fill();
        this.drawGlove(ctx, arm, color, scale);
        ctx.strokeStyle = color;
        ctx.lineWidth = scale * .135;
      }
      ctx.translate(player.x * this.width, player.y * this.height);
      ctx.rotate(player.facing + player.bodyAngle);
      ctx.fillStyle = color;
      ctx.globalAlpha = .11;
      ctx.beginPath();
      ctx.ellipse(0, scale * .02, scale * .44, scale * .48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if ((this.sprite.complete && this.sprite.naturalWidth) || this.sprite.width) ctx.drawImage(this.sprite, -scale * .47, -scale * .47, scale * .94, scale * .94);
      else {
        ctx.fillStyle = "#6a4b2d";
        ctx.beginPath();
        ctx.arc(0, 0, scale * .4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.debug) {
        const geometry = this.targetGeometry(player);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#b9ffbf";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(geometry.head.x, geometry.head.y, geometry.head.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.restore();
    }

    drawGlove(ctx, arm, color, scale) {
      const gloveScale = CONFIG.GLOVE_SCALE;
      const angle = Math.atan2(arm.hand.y - arm.elbow.y, arm.hand.x - arm.elbow.x);
      ctx.save();
      ctx.translate(arm.hand.x, arm.hand.y);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(0,0,0,.34)";
      ctx.beginPath();
      ctx.ellipse(3, 3, scale * .18 * gloveScale, scale * .135 * gloveScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, scale * .18 * gloveScale, scale * .135 * gloveScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-scale * .03 * gloveScale, scale * .12 * gloveScale, scale * .075 * gloveScale, scale * .065 * gloveScale, -.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, scale * .18 * gloveScale, scale * .135 * gloveScale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-scale * .12 * gloveScale, 0);
      ctx.lineTo(scale * .11 * gloveScale, 0);
      ctx.stroke();
      ctx.restore();
    }

    drawTestOverlay(ctx) {
      const scale = this.characterScale();
      const glove = scale * CONFIG.GLOVE_RADIUS * CONFIG.GLOVE_SCALE;
      ctx.save();
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 5]);
      this.players.forEach((player, index) => {
        const color = index === 0 ? "#76f4ff" : "#ff8c86";
        const geometry = this.targetGeometry(player);
        const center = { x: player.x * this.width, y: player.y * this.height };
        ctx.strokeStyle = color;
        ctx.globalAlpha = .72;
        ctx.beginPath();
        ctx.arc(center.x, center.y, scale * (CONFIG.UPPER_ARM_LENGTH + CONFIG.FOREARM_LENGTH), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - scale * .58);
        ctx.lineTo(center.x, center.y + scale * .58);
        ctx.stroke();
        for (const side of ["left", "right"]) {
          const arm = player.arms[side];
          ctx.beginPath();
          ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
          ctx.lineTo(arm.elbow.x, arm.elbow.y);
          ctx.lineTo(arm.hand.x, arm.hand.y);
          ctx.stroke();
          for (const point of [arm.shoulder, arm.elbow, arm.hand]) {
            ctx.fillStyle = point === arm.hand ? "#fff" : color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, point === arm.hand ? 3.5 : 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(arm.hand.x, arm.hand.y, glove, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(geometry.head.x, geometry.head.y, geometry.head.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(geometry.body.x, geometry.body.y, geometry.body.radius, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      (this.collisionMarks || []).forEach((mark) => {
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
      for (let index = 0; index < 10; index += 1) {
        const angle = index * Math.PI * 2 / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
        ctx.lineTo(Math.cos(angle) * (22 + impact.life * 18), Math.sin(angle) * (22 + impact.life * 18));
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFeedback(ctx) {
      ctx.save();
      ctx.font = `950 ${Math.max(13, Math.min(19, this.width * .043))}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.players.forEach((player, index) => {
        if (!player.feedback) return;
        ctx.fillStyle = player.feedback === "BLOCK!" ? "#9beaf1" : "#ffc857";
        const x = player.x * this.width;
        const y = player.y * this.height + (index === 0 ? -58 : 58);
        ctx.save();
        ctx.translate(x, y);
        if (index === 0) ctx.rotate(Math.PI);
        ctx.fillText(player.feedback, 0, 0);
        ctx.restore();
      });
      ctx.restore();
    }
  }

  window.WOBBLE_BOXING_CONFIG = CONFIG;
  window.WobbleBoxingGame = WobbleBoxingGame;
})();
