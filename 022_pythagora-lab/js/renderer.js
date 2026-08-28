(function defineRenderer(global) {
  "use strict";
  const P = global.PythagoraLab;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.cssWidth = 760;
      this.cssHeight = 440;
      this.dpr = 1;
      this.fieldWidth = 760;
      this.fieldHeight = 440;
      this.camera = { x: 380, y: 220, zoom: 1 };
      this.baseScale = 1;
      this.scale = 1;
      this.options = { grid: true, debug: false };
      this.goalPulse = 0;
    }

    setStage(stage) {
      this.fieldWidth = stage.fieldWidth;
      this.fieldHeight = stage.fieldHeight;
      this.camera.x = stage.fieldWidth / 2;
      this.camera.y = stage.fieldHeight / 2;
      this.camera.zoom = 1;
      this.updateScale();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
      this.dpr = Math.min(global.devicePixelRatio || 1, P.CONFIG.dprCap);
      const pixelWidth = Math.max(1, Math.round(rect.width * this.dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * this.dpr));
      if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
      if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
      this.updateScale();
      return true;
    }

    updateScale() {
      this.baseScale = Math.min(this.cssWidth / this.fieldWidth, this.cssHeight / this.fieldHeight);
      this.scale = Math.max(0.0001, this.baseScale * this.camera.zoom);
    }

    setOptions(options = {}) {
      Object.assign(this.options, options);
    }

    screenToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return {
        x: (x - this.cssWidth / 2) / this.scale + this.camera.x,
        y: (y - this.cssHeight / 2) / this.scale + this.camera.y
      };
    }

    worldToScreen(x, y) {
      return {
        x: (x - this.camera.x) * this.scale + this.cssWidth / 2,
        y: (y - this.camera.y) * this.scale + this.cssHeight / 2
      };
    }

    setCamera(next) {
      this.camera.zoom = P.util.clamp(next.zoom ?? this.camera.zoom, P.CONFIG.camera.minZoom, P.CONFIG.camera.maxZoom);
      this.camera.x = P.util.clamp(next.x ?? this.camera.x, -this.fieldWidth * 0.1, this.fieldWidth * 1.1);
      this.camera.y = P.util.clamp(next.y ?? this.camera.y, -this.fieldHeight * 0.1, this.fieldHeight * 1.1);
      this.updateScale();
    }

    draw(state, now = performance.now()) {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
      this.drawScreenBackground(ctx);

      ctx.save();
      ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-this.camera.x, -this.camera.y);
      this.drawBoard(ctx, state, now);
      ctx.restore();
    }

    drawScreenBackground(ctx) {
      ctx.fillStyle = "#c9def0";
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      for (let x = -40; x < this.cssWidth + 40; x += 72) {
        ctx.beginPath();
        ctx.arc(x, 42 + (x % 144 ? 22 : 0), 24, 0, Math.PI * 2);
        ctx.arc(x + 26, 42 + (x % 144 ? 22 : 0), 17, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawBoard(ctx, state, now) {
      ctx.fillStyle = "#f7f1e4";
      ctx.fillRect(0, 0, this.fieldWidth, this.fieldHeight);

      if (this.options.grid) this.drawGrid(ctx);

      ctx.strokeStyle = "rgba(47,44,38,0.32)";
      ctx.lineWidth = 2 / this.scale;
      ctx.strokeRect(0, 0, this.fieldWidth, this.fieldHeight);

      for (const part of state.parts) this.drawPart(ctx, part, state, now);
      if (state.selectedPart && state.mode === "edit") this.drawSelection(ctx, state.selectedPart, now);
      this.drawEffects(ctx, state.effects || [], now);
      if (this.options.debug) this.drawDebugBodies(ctx, state.parts);
    }

    drawGrid(ctx) {
      const small = P.CONFIG.snapSize;
      const major = small * 5;
      ctx.save();
      for (let x = 0; x <= this.fieldWidth; x += small) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.fieldHeight);
        ctx.lineWidth = (x % major === 0 ? 1.1 : 0.5) / this.scale;
        ctx.strokeStyle = x % major === 0 ? "rgba(63,84,96,0.16)" : "rgba(63,84,96,0.07)";
        ctx.stroke();
      }
      for (let y = 0; y <= this.fieldHeight; y += small) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.fieldWidth, y);
        ctx.lineWidth = (y % major === 0 ? 1.1 : 0.5) / this.scale;
        ctx.strokeStyle = y % major === 0 ? "rgba(63,84,96,0.16)" : "rgba(63,84,96,0.07)";
        ctx.stroke();
      }
      ctx.restore();
    }

    drawPart(ctx, part, state, now) {
      const position = part.body?.position || { x: part.x, y: part.y };
      const angle = part.body?.angle ?? part.angle;
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(angle);
      switch (part.type) {
        case "ball": this.drawBall(ctx, part); break;
        case "floor": this.drawPlank(ctx, part, "#9d7651", true); break;
        case "ramp": this.drawPlank(ctx, part, "#2678b9", false); break;
        case "wall": this.drawPlank(ctx, part, "#4f9d69", false); break;
        case "goal": this.drawGoal(ctx, part, state.goalState, now); break;
        case "start": this.drawStart(ctx, part, state.mode, now); break;
        case "domino": this.drawDomino(ctx, part); break;
        case "box": this.drawBox(ctx, part); break;
        case "seesaw": this.drawSeesaw(ctx, part); break;
        case "spring": this.drawSpring(ctx, part, now); break;
        case "pendulum": this.drawPendulum(ctx, part); break;
        case "switch": this.drawSwitch(ctx, part); break;
        default: this.drawBox(ctx, part);
      }
      ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
      const r = Math.min(Math.abs(radius), width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    drawBall(ctx, part) {
      const radius = part.width / 2;
      ctx.fillStyle = part.def.color;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.ellipse(-radius * 0.28, -radius * 0.34, radius * 0.25, radius * 0.15, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(47,44,38,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.55, -0.6, 0.8);
      ctx.stroke();
    }

    drawPlank(ctx, part, color, floor) {
      const x = -part.width / 2;
      const y = -part.height / 2;
      this.roundRect(ctx, x, y, part.width, part.height, Math.min(8, part.height / 3));
      ctx.fillStyle = color;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = floor ? "rgba(65,43,27,0.22)" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = 2;
      for (let line = x - part.height; line < part.width / 2 + part.height; line += 28) {
        ctx.beginPath();
        ctx.moveTo(line, y);
        ctx.lineTo(line + part.height, -y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#f6efe2";
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 1.3;
      const screw = Math.min(part.width / 2 - 10, 16);
      for (const sx of [-part.width / 2 + screw, part.width / 2 - screw]) {
        ctx.beginPath();
        ctx.arc(sx, 0, Math.min(3.5, part.height * 0.18), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    drawGoal(ctx, part, goalState, now) {
      const width = part.width;
      const height = part.height;
      const pulse = goalState === "candidate" || goalState === "latched" ? 0.5 + Math.sin(now / 90) * 0.18 : 0;
      if (pulse) {
        ctx.fillStyle = `rgba(239,91,69,${Math.max(0.08, pulse * 0.22)})`;
        ctx.beginPath();
        ctx.ellipse(0, 4, width * (0.72 + pulse * 0.1), height * (0.72 + pulse * 0.1), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#2f2c26";
      ctx.fillStyle = "#ef5b45";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-width / 2, -height / 2 + 12);
      ctx.lineTo(-width / 2 + 10, height / 2);
      ctx.lineTo(width / 2 - 10, height / 2);
      ctx.lineTo(width / 2, -height / 2 + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.ellipse(0, -height / 2 + 12, width / 2, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2f2c26";
      ctx.font = "900 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", 0, 16);
    }

    drawStart(ctx, part, mode, now) {
      const bounce = mode === "running" ? Math.sin(now / 120) * 2 : 0;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-16, 24);
      ctx.lineTo(-16, -25);
      ctx.stroke();
      ctx.fillStyle = "#4f9d69";
      ctx.beginPath();
      ctx.moveTo(-14, -25 + bounce);
      ctx.lineTo(23, -13 + bounce);
      ctx.lineTo(-14, 0 + bounce);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "900 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("START", 1, -12 + bounce);
    }

    drawDomino(ctx, part) {
      this.roundRect(ctx, -part.width / 2, -part.height / 2, part.width, part.height, 5);
      ctx.fillStyle = part.def.color;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2f2c26";
      ctx.beginPath();
      ctx.arc(0, -part.height * 0.22, 2.2, 0, Math.PI * 2);
      ctx.arc(0, part.height * 0.22, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-part.width * 0.32, 0);
      ctx.lineTo(part.width * 0.32, 0);
      ctx.stroke();
    }

    drawBox(ctx, part) {
      const halfW = part.width / 2;
      const halfH = part.height / 2;
      this.roundRect(ctx, -halfW, -halfH, part.width, part.height, 5);
      ctx.fillStyle = part.def.color;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-halfW + 8, -halfH + 8);
      ctx.lineTo(halfW - 8, halfH - 8);
      ctx.moveTo(halfW - 8, -halfH + 8);
      ctx.lineTo(-halfW + 8, halfH - 8);
      ctx.stroke();
    }

    drawSeesaw(ctx, part) {
      this.drawPlank(ctx, part, part.def.color, false);
      ctx.save();
      ctx.rotate(-part.angle - (part.body?.angle ?? part.angle));
      ctx.fillStyle = "#f2c14e";
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(-21, 39);
      ctx.lineTo(21, 39);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawSpring(ctx, part, now) {
      const active = part.runtime?.springUntil > now;
      const compression = active ? Math.sin(now / 35) * 4 : 0;
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      ctx.fillStyle = "#e94c73";
      this.roundRect(ctx, -part.width / 2, part.height * 0.12, part.width, part.height * 0.45, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      const left = -part.width / 2 + 7;
      const right = part.width / 2 - 7;
      const top = -part.height / 2 + compression;
      const bottom = part.height * 0.15;
      ctx.moveTo(left, bottom);
      for (let index = 0; index <= 6; index += 1) {
        const x = left + (right - left) * index / 6;
        const y = index % 2 === 0 ? bottom : top;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left - 2, top);
      ctx.lineTo(right + 2, top);
      ctx.stroke();
    }

    drawPendulum(ctx, part) {
      const anchor = part.runtime?.anchor || { x: part.x, y: part.y - (part.settings.length || 92) };
      const position = part.body?.position || { x: part.x, y: part.y };
      ctx.save();
      ctx.rotate(-(part.body?.angle ?? part.angle));
      ctx.translate(-position.x, -position.y);
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(position.x, position.y);
      ctx.stroke();
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.translate(position.x, position.y);
      ctx.fillStyle = part.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, part.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawSwitch(ctx, part) {
      const on = Boolean(part.runtime?.on);
      ctx.fillStyle = "#736b60";
      ctx.strokeStyle = "#2f2c26";
      ctx.lineWidth = 3;
      this.roundRect(ctx, -part.width / 2, -part.height / 2 + 5, part.width, part.height - 2, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = on ? "#f2c14e" : "#ef5b45";
      this.roundRect(ctx, -part.width * 0.32, -part.height / 2 - (on ? 0 : 7), part.width * 0.64, 13, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "900 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(on ? "ON" : "PUSH", 0, -part.height / 2 + (on ? 10 : 3));
    }

    drawSelection(ctx, part, now) {
      const position = part.body?.position || { x: part.x, y: part.y };
      const angle = part.body?.angle ?? part.angle;
      const pulse = 2 + Math.sin(now / 180) * 1.4;
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(angle);
      ctx.setLineDash([8 / this.scale, 5 / this.scale]);
      ctx.strokeStyle = "#ef5b45";
      ctx.lineWidth = 3 / this.scale;
      ctx.strokeRect(-part.width / 2 - pulse, -part.height / 2 - pulse, part.width + pulse * 2, part.height + pulse * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ef5b45";
      ctx.lineWidth = 2 / this.scale;
      for (const [x, y] of [[-part.width / 2, -part.height / 2], [part.width / 2, -part.height / 2], [-part.width / 2, part.height / 2], [part.width / 2, part.height / 2]]) {
        ctx.beginPath();
        ctx.arc(x, y, 5 / this.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    drawEffects(ctx, effects, now) {
      for (const effect of effects) {
        const age = now - effect.startedAt;
        if (age < 0 || age > effect.duration) continue;
        const progress = age / effect.duration;
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color || "#ef5b45";
        ctx.lineWidth = 3 / this.scale;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 8 + progress * 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawDebugBodies(ctx, parts) {
      ctx.save();
      ctx.font = `${10 / this.scale}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      for (const part of parts) {
        for (const body of part.bodies || []) {
          ctx.strokeStyle = body.isSensor ? "#ff3b7d" : "#25d9ff";
          ctx.lineWidth = 1 / this.scale;
          ctx.beginPath();
          body.vertices.forEach((vertex, index) => index ? ctx.lineTo(vertex.x, vertex.y) : ctx.moveTo(vertex.x, vertex.y));
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "#102027";
          ctx.fillText(`#${body.id} ${part.type}`, body.position.x + 4, body.position.y - 4);
        }
      }
      ctx.restore();
    }
  }

  P.Renderer = Renderer;
})(window);
