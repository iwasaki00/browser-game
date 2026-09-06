(() => {
  "use strict";

  const CONFIG = Object.freeze({
    SHOULDER_SPEED: 2.9,
    ELBOW_SPEED: 3.7,
    SHOULDER_TORQUE: 10.5,
    ELBOW_TORQUE: 13,
    JOINT_FRICTION: .955,
    JOINT_EDGE_BOUNCE: .18,
    SHOULDER_MIN_ANGLE: -1.55,
    SHOULDER_MAX_ANGLE: 1.55,
    ELBOW_MIN_ANGLE: -1.9,
    ELBOW_MAX_ANGLE: 1.9,
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
      this.elapsed = 0;
      this.shake = 0;
      this.impact = null;
      this.lastClashAt = 0;
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
        leftShoulder: { angle: -.48, angularVelocity: 0, direction: 1, holding: false },
        rightShoulder: { angle: .48, angularVelocity: 0, direction: -1, holding: false },
        leftElbow: { angle: .8, angularVelocity: 0, direction: -1, holding: false },
        rightElbow: { angle: -.8, angularVelocity: 0, direction: 1, holding: false }
      };
      return {
        index,
        baseX: .5,
        baseY: index === 0 ? .32 : .68,
        x: .5,
        y: index === 0 ? .32 : .68,
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
          joint.direction *= -1;
          button.classList.remove("active");
          this.updateButtonDirections();
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
        joint.direction *= -1;
        this.updateButtonDirections();
      };
      window.addEventListener("keydown", this.keyDownHandler);
      window.addEventListener("keyup", this.keyUpHandler);
    }

    preventMenu(event) { event.preventDefault(); }

    updateButtonDirections() {
      this.jointButtons.forEach((buttons, playerIndex) => buttons.forEach((button) => {
        const joint = this.players[playerIndex].joints[button.dataset.joint];
        const indicator = button.querySelector(".joint-direction");
        if (indicator) indicator.textContent = joint.direction > 0 ? "\u21bb" : "\u21ba";
      }));
    }

    start() {
      this.active = true;
      this.lastFrame = performance.now();
      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    stop() {
      this.active = false;
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
      const dt = Math.min(.033, Math.max(.001, (now - this.lastFrame) / 1000));
      this.fps += ((1 / dt) - this.fps) * .08;
      this.lastFrame = now;
      this.update(dt, now);
      this.render();
      if (this.active) this.animationId = requestAnimationFrame((time) => this.frame(time));
    }

    update(dt, now) {
      this.elapsed += dt;
      const frameScale = dt * 60;
      this.players.forEach((player) => {
        const previousArms = player.arms || this.calculateArms(player);
        const wobble = (1 - player.hp / CONFIG.BODY_HP) * .7;
        JOINT_NAMES.forEach((name) => {
          const joint = player.joints[name];
          const shoulder = name.includes("Shoulder");
          const speed = shoulder ? CONFIG.SHOULDER_SPEED : CONFIG.ELBOW_SPEED;
          const torque = shoulder ? CONFIG.SHOULDER_TORQUE : CONFIG.ELBOW_TORQUE;
          const minimum = name.includes("Shoulder") ? CONFIG.SHOULDER_MIN_ANGLE : CONFIG.ELBOW_MIN_ANGLE;
          const maximum = name.includes("Shoulder") ? CONFIG.SHOULDER_MAX_ANGLE : CONFIG.ELBOW_MAX_ANGLE;
          if (joint.holding) joint.angularVelocity += joint.direction * torque * dt;
          joint.angularVelocity += Math.sin(now * .009 + player.index * 2 + name.length) * wobble * dt;
          joint.angularVelocity *= Math.pow(CONFIG.JOINT_FRICTION, frameScale);
          joint.angularVelocity = Math.max(-speed, Math.min(speed, joint.angularVelocity));
          joint.angle += joint.angularVelocity * dt;
          if (joint.angle <= minimum || joint.angle >= maximum) {
            joint.angle = Math.max(minimum, Math.min(maximum, joint.angle));
            joint.angularVelocity *= -CONFIG.JOINT_EDGE_BOUNCE;
          }
        });
        player.vx += (player.baseX - player.x) * CONFIG.BODY_RETURN * dt;
        player.vy += (player.baseY - player.y) * CONFIG.BODY_RETURN * dt;
        player.vx *= Math.pow(CONFIG.BODY_FRICTION, frameScale);
        player.vy *= Math.pow(CONFIG.BODY_FRICTION, frameScale);
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.x = Math.max(.34, Math.min(.66, player.x));
        player.y = player.index === 0 ? Math.max(.22, Math.min(.44, player.y)) : Math.max(.56, Math.min(.78, player.y));
        player.angularVelocity += -player.bodyAngle * 5.2 * dt;
        player.angularVelocity *= Math.pow(.86, frameScale);
        player.bodyAngle += player.angularVelocity * dt;
        const nextArms = this.calculateArms(player);
        for (const side of ["left", "right"]) {
          nextArms[side].vx = (nextArms[side].hand.x - previousArms[side].hand.x) / dt;
          nextArms[side].vy = (nextArms[side].hand.y - previousArms[side].hand.y) / dt;
          nextArms[side].speed = Math.hypot(nextArms[side].vx, nextArms[side].vy);
          nextArms[side].lastHitAt = previousArms[side].lastHitAt || 0;
        }
        player.arms = nextArms;
        if (now > player.feedbackUntil) player.feedback = "";
      });
      this.resolveHits(now);
      this.resolveArmClash(now);
      this.shake *= Math.pow(.79, frameScale);
      if (this.impact) this.impact.life -= dt * 3.6;
      if (this.impact && this.impact.life <= 0) this.impact = null;
      if (this.elapsed >= CONFIG.TIME_LIMIT) {
        if (Math.abs(this.players[0].hp - this.players[1].hp) < .5) return this.finish(0, "\u6642\u9593\u5207\u308c\u30fb\u4e92\u89d2\uff01");
        const winner = this.players[0].hp > this.players[1].hp ? 1 : 2;
        return this.finish(winner, "\u6642\u9593\u5207\u308c\u5224\u5b9a\uff01");
      }
      this.updateHud();
    }

    calculateArms(player) {
      const scale = Math.max(78, Math.min(this.width * .3, this.height * .22, 132));
      const center = { x: player.x * this.width, y: player.y * this.height };
      const rotation = player.facing + player.bodyAngle;
      const forward = { x: Math.sin(rotation), y: Math.cos(rotation) };
      const right = { x: Math.cos(rotation), y: -Math.sin(rotation) };
      const result = {};
      for (const side of ["left", "right"]) {
        const sign = side === "left" ? -1 : 1;
        const shoulder = {
          x: center.x + right.x * sign * scale * .42 + forward.x * scale * .02,
          y: center.y + right.y * sign * scale * .42 + forward.y * scale * .02
        };
        const shoulderAngle = rotation + player.joints[`${side}Shoulder`].angle;
        const elbow = {
          x: shoulder.x + Math.sin(shoulderAngle) * scale * .76,
          y: shoulder.y + Math.cos(shoulderAngle) * scale * .76
        };
        const forearmAngle = shoulderAngle + player.joints[`${side}Elbow`].angle;
        const hand = {
          x: elbow.x + Math.sin(forearmAngle) * scale * .7,
          y: elbow.y + Math.cos(forearmAngle) * scale * .7
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
          const forward = { x: Math.sin(attacker.facing + attacker.bodyAngle), y: Math.cos(attacker.facing + attacker.bodyAngle) };
          const directionScore = (arm.vx * forward.x + arm.vy * forward.y) / Math.max(1, arm.speed);
          if (directionScore < .18) continue;
          const targetGeometry = this.targetGeometry(target);
          const guarded = this.isGuarded(arm.hand, target);
          const headHit = this.distance(arm.hand, targetGeometry.head) <= targetGeometry.head.radius + targetGeometry.fistRadius;
          const bodyHit = this.distance(arm.hand, targetGeometry.body) <= targetGeometry.body.radius + targetGeometry.fistRadius;
          if (!guarded && !headHit && !bodyHit) continue;
          arm.lastHitAt = now;
          if (guarded) {
            attacker.lastHitPower = arm.speed;
            target.feedback = "GUARD!";
            target.feedbackUntil = now + 380;
            target.angularVelocity += (side === "left" ? -1 : 1) * .16;
            if (this.onBlockSound) this.onBlockSound();
            this.impact = { x: arm.hand.x, y: arm.hand.y, life: .65, color: "#d9f4ff" };
            continue;
          }
          const multiplier = headHit ? CONFIG.HEAD_DAMAGE_MULTIPLIER : 1;
          const damage = Math.min(CONFIG.MAX_HIT_DAMAGE, Math.max(1, (arm.speed - CONFIG.MIN_HIT_SPEED) * .1)) * multiplier * (.58 + Math.max(0, directionScore) * .42);
          target.hp = Math.max(0, target.hp - damage);
          target.damage = Math.min(1, target.damage + damage / 35);
          attacker.lastHitPower = damage;
          const force = (headHit ? CONFIG.HEAD_KNOCKBACK : CONFIG.BODY_KNOCKBACK) * damage;
          target.vx += arm.vx / arm.speed * force;
          target.vy += arm.vy / arm.speed * force;
          attacker.vx -= arm.vx / arm.speed * force * .28;
          attacker.vy -= arm.vy / arm.speed * force * .28;
          if (headHit) target.angularVelocity += (side === "left" ? -1 : 1) * damage * .018;
          target.feedback = headHit ? "HEAD!" : "HIT!";
          target.feedbackUntil = now + 520;
          this.shake = Math.min(1.4, this.shake + damage / 16);
          this.impact = { x: arm.hand.x, y: arm.hand.y, life: 1, color: headHit ? "#ffc857" : "#fff8df" };
          if (this.onPunchSound) this.onPunchSound(damage / CONFIG.MAX_HIT_DAMAGE, headHit);
          if (target.hp <= 0) return this.finish(attackerIndex + 1, headHit ? "\u30d8\u30c3\u30c9\u3078\u6c7a\u5b9a\u6253\uff01" : "\u30dc\u30c7\u30a3\u306b\u6c7a\u5b9a\u6253\uff01");
        }
      });
    }

    resolveArmClash(now) {
      if (now - this.lastClashAt < 230) return;
      for (const first of ["left", "right"]) {
        for (const second of ["left", "right"]) {
          const a = this.players[0].arms[first];
          const b = this.players[1].arms[second];
          if (this.distance(a.hand, b.hand) > 22 || a.speed + b.speed < CONFIG.MIN_HIT_SPEED) continue;
          this.lastClashAt = now;
          this.players[0].angularVelocity += (Math.random() - .5) * .18;
          this.players[1].angularVelocity += (Math.random() - .5) * .18;
          this.impact = { x: (a.hand.x + b.hand.x) / 2, y: (a.hand.y + b.hand.y) / 2, life: .55, color: "#9beaf1" };
          if (this.onBlockSound) this.onBlockSound();
          return;
        }
      }
    }

    targetGeometry(player) {
      const scale = Math.max(78, Math.min(this.width * .3, this.height * .22, 132));
      const rotation = player.facing + player.bodyAngle;
      return {
        body: { x: player.x * this.width, y: player.y * this.height, radius: scale * .38 },
        head: { x: player.x * this.width + Math.sin(rotation) * scale * .23, y: player.y * this.height + Math.cos(rotation) * scale * .23, radius: scale * .22 },
        fistRadius: Math.max(9, scale * .12)
      };
    }

    isGuarded(point, player) {
      const threshold = Math.max(12, Math.min(this.width * .025, 21));
      return ["left", "right"].some((side) => {
        const arm = player.arms[side];
        return this.pointSegmentDistance(point, arm.shoulder, arm.elbow) < threshold || this.pointSegmentDistance(point, arm.elbow, arm.hand) < threshold;
      });
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
      if (this.debug) {
        const lines = [];
        this.players.forEach((player, index) => {
          const prefix = `P${index + 1}`;
          lines.push(`${prefix} LS ${player.joints.leftShoulder.angle.toFixed(2)}  LE ${player.joints.leftElbow.angle.toFixed(2)}`);
          lines.push(`${prefix} RS ${player.joints.rightShoulder.angle.toFixed(2)}  RE ${player.joints.rightElbow.angle.toFixed(2)}`);
          lines.push(`${prefix} fist ${Math.max(player.arms.left.speed, player.arms.right.speed).toFixed(1)}  hit ${player.lastHitPower.toFixed(1)}`);
        });
        lines.push(`elapsed ${this.elapsed.toFixed(1)}s`, `FPS ${Math.round(this.fps)}`);
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
      this.drawPlayer(ctx, this.players[0], "#27d9e6");
      this.drawPlayer(ctx, this.players[1], "#ff5a51");
      if (this.impact) this.drawImpact(ctx, this.impact);
      this.drawFeedback(ctx);
      const remaining = Math.max(0, CONFIG.TIME_LIMIT - this.elapsed).toFixed(0);
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
      ctx.fillStyle = "rgba(7,16,24,.42)";
      ctx.fillRect((w - ringWidth) / 2, h * .06, ringWidth, h * .88);
      ctx.strokeStyle = "rgba(255,200,87,.48)";
      ctx.lineWidth = 3;
      ctx.strokeRect((w - ringWidth) / 2, h * .06, ringWidth, h * .88);
      ctx.setLineDash([7, 9]);
      ctx.strokeStyle = "rgba(255,255,255,.24)";
      ctx.beginPath();
      ctx.moveTo((w - ringWidth) / 2, h / 2);
      ctx.lineTo((w + ringWidth) / 2, h / 2);
      ctx.stroke();
      ctx.restore();
    }

    drawPlayer(ctx, player, color) {
      const scale = Math.max(78, Math.min(this.width * .3, this.height * .22, 132));
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,.42)";
      ctx.lineWidth = scale * .22;
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
      ctx.lineWidth = scale * .15;
      for (const side of ["left", "right"]) {
        const arm = player.arms[side];
        ctx.beginPath();
        ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
        ctx.lineTo(arm.elbow.x, arm.elbow.y);
        ctx.lineTo(arm.hand.x, arm.hand.y);
        ctx.stroke();
        ctx.fillStyle = "#ffc857";
        for (const joint of [arm.shoulder, arm.elbow]) {
          ctx.beginPath();
          ctx.arc(joint.x, joint.y, scale * .09, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(arm.hand.x, arm.hand.y, scale * .14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff8df";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = scale * .15;
      }
      ctx.translate(player.x * this.width, player.y * this.height);
      ctx.rotate(player.facing + player.bodyAngle);
      ctx.fillStyle = color;
      ctx.globalAlpha = .22;
      ctx.beginPath();
      ctx.arc(0, 0, scale * .57, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if ((this.sprite.complete && this.sprite.naturalWidth) || this.sprite.width) ctx.drawImage(this.sprite, -scale * .55, -scale * .55, scale * 1.1, scale * 1.1);
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
        ctx.fillStyle = player.feedback === "GUARD!" ? "#9beaf1" : "#ffc857";
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
