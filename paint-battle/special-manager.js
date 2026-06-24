export const SPECIALS = {
  storm: { name: "ペイントストーム" },
  megaRoller: { name: "メガローラー" },
  missile: { name: "インクミサイル" },
  laser: { name: "ペイントレーザー" },
  barrier: { name: "塗り返しバリア" },
  shark: { name: "ペイントサメ" },
  copyCat: { name: "コピーキャット" },
  blackHole: { name: "ペイントブラックホール" }
};

export class SpecialManager {
  constructor({ gridSize, paintCells, getPlayer, getGridColor, announce, shake }) {
    this.gridSize = gridSize;
    this.paintCells = paintCells;
    this.getPlayer = getPlayer;
    this.getGridColor = getGridColor;
    this.announce = announce;
    this.shake = shake;
    this.effects = [];
  }

  reset() {
    this.effects = [];
  }

  activate(actor, specialId, now = performance.now()) {
    const method = {
      storm: "activateStorm",
      megaRoller: "activateMegaRoller",
      missile: "activateMissile",
      laser: "activateLaser",
      barrier: "activateBarrier",
      shark: "activateShark",
      copyCat: "activateCopyCat",
      blackHole: "activateBlackHole"
    }[specialId];
    if (!method || !actor) return false;
    this.announce(actor.slot, SPECIALS[specialId].name);
    this.shake();
    this[method](actor, now);
    return true;
  }

  activateStorm(actor, now) {
    this.effects.push({ type: "storm", ownerSlot: actor.slot, startedAt: now, endsAt: now + 3000, nextTickAt: now, impacts: [] });
  }

  activateMegaRoller(actor, now) {
    this.effects.push({ type: "megaRoller", ownerSlot: actor.slot, startedAt: now, endsAt: now + 10000 });
    this.paintSquare(actor.x, actor.y, 3, actor.slot);
  }

  activateMissile(actor, now) {
    const target = this.getPlayer(actor.slot === 1 ? 2 : 1);
    const impacts = Array.from({ length: 5 }, (_, index) => ({
      x: this.clamp(target.x + (Math.random() - .5) * 7),
      y: this.clamp(target.y + (Math.random() - .5) * 7),
      at: now + 350 + index * 320,
      painted: false
    }));
    this.effects.push({ type: "missile", ownerSlot: actor.slot, startedAt: now, endsAt: now + 2100, impacts });
  }

  activateLaser(actor, now) {
    const cells = [];
    const perpendicular = { x: -actor.direction.y, y: actor.direction.x };
    for (let step = 0; step < this.gridSize * 1.5; step += .45) {
      for (const offset of [-.45, .45]) {
        const index = this.cellIndex(
          Math.floor(actor.x + actor.direction.x * step + perpendicular.x * offset),
          Math.floor(actor.y + actor.direction.y * step + perpendicular.y * offset)
        );
        if (index !== -1) cells.push(index);
      }
    }
    this.paintCells(cells, actor.slot);
    this.effects.push({ type: "laser", ownerSlot: actor.slot, x: actor.x, y: actor.y, direction: { ...actor.direction }, startedAt: now, endsAt: now + 550 });
  }

  activateBarrier(actor, now) {
    this.effects.push({ type: "barrier", ownerSlot: actor.slot, x: actor.x, y: actor.y, startedAt: now, endsAt: now + 5000 });
  }

  activateShark(actor, now) {
    const start = { x: actor.x, y: actor.y };
    const cells = [];
    const perpendicular = { x: -actor.direction.y, y: actor.direction.x };
    for (let step = 0; step <= 12; step += .4) {
      for (const offset of [-1, 0, 1]) {
        const index = this.cellIndex(
          Math.floor(start.x + actor.direction.x * step + perpendicular.x * offset),
          Math.floor(start.y + actor.direction.y * step + perpendicular.y * offset)
        );
        if (index !== -1) cells.push(index);
      }
    }
    actor.x = this.clamp(start.x + actor.direction.x * 12);
    actor.y = this.clamp(start.y + actor.direction.y * 12);
    this.paintCells(cells, actor.slot);
    this.effects.push({ type: "shark", ownerSlot: actor.slot, start, end: { x: actor.x, y: actor.y }, startedAt: now, endsAt: now + 500 });
  }

  activateCopyCat(actor, now) {
    this.effects.push({
      type: "copyCat",
      ownerSlot: actor.slot,
      x: this.clamp(actor.x + 1),
      y: this.clamp(actor.y + 1),
      direction: { ...actor.direction },
      startedAt: now,
      endsAt: now + 8000,
      nextTickAt: now
    });
  }

  activateBlackHole(actor, now) {
    const x = this.clamp(actor.x + actor.direction.x * 8);
    const y = this.clamp(actor.y + actor.direction.y * 8);
    this.effects.push({ type: "blackHole", ownerSlot: actor.slot, x, y, startedAt: now, endsAt: now + 4000, nextTickAt: now });
  }

  update(now) {
    this.effects.forEach((effect) => {
      if (effect.type === "storm") this.updateStorm(effect, now);
      if (effect.type === "missile") this.updateMissiles(effect, now);
      if (effect.type === "copyCat") this.updateCopyCat(effect, now);
      if (effect.type === "blackHole") this.updateBlackHole(effect, now);
    });
    this.effects = this.effects.filter((effect) => now < effect.endsAt);
  }

  updateStorm(effect, now) {
    while (now >= effect.nextTickAt && effect.nextTickAt < effect.endsAt) {
      const x = Math.random() * this.gridSize;
      const y = Math.random() * this.gridSize;
      this.paintSquare(x, y, 2, effect.ownerSlot);
      effect.impacts.push({ x, y, at: effect.nextTickAt });
      effect.nextTickAt += 200;
    }
    effect.impacts = effect.impacts.filter((impact) => now - impact.at < 500);
  }

  updateMissiles(effect, now) {
    effect.impacts.forEach((impact) => {
      if (!impact.painted && now >= impact.at) {
        impact.painted = true;
        this.paintSquare(impact.x, impact.y, 2, effect.ownerSlot);
      }
    });
  }

  updateCopyCat(effect, now) {
    if (now < effect.nextTickAt) return;
    const direction = this.findPaintDirection(effect.x, effect.y, effect.ownerSlot);
    effect.direction = direction;
    effect.x = this.clamp(effect.x + direction.x * 1.5);
    effect.y = this.clamp(effect.y + direction.y * 1.5);
    this.paintSquare(effect.x, effect.y, 1, effect.ownerSlot);
    effect.nextTickAt = now + 250;
  }

  updateBlackHole(effect, now) {
    if (now < effect.nextTickAt) return;
    const elapsedRatio = Math.min(1, (now - effect.startedAt) / (effect.endsAt - effect.startedAt));
    const radius = Math.max(1, Math.ceil(6 * elapsedRatio));
    const cells = [];
    for (let y = Math.floor(effect.y - radius); y <= effect.y + radius; y += 1) {
      for (let x = Math.floor(effect.x - radius); x <= effect.x + radius; x += 1) {
        if (Math.hypot(x - effect.x, y - effect.y) <= radius && Math.random() < .38) {
          const index = this.cellIndex(x, y);
          if (index !== -1) cells.push(index);
        }
      }
    }
    this.paintCells(cells, effect.ownerSlot);
    effect.nextTickAt = now + 200;
  }

  resolvePaintColor(index, requestedColor, now) {
    const x = index % this.gridSize;
    const y = Math.floor(index / this.gridSize);
    const barrier = this.effects.find((effect) =>
      effect.type === "barrier" && now < effect.endsAt && effect.ownerSlot !== requestedColor && Math.hypot(x - effect.x, y - effect.y) <= 4
    );
    return barrier ? barrier.ownerSlot : requestedColor;
  }

  isMegaRoller(slot, now) {
    return this.effects.some((effect) => effect.type === "megaRoller" && effect.ownerSlot === slot && now < effect.endsAt);
  }

  getSpeedMultiplier(slot, now) {
    return this.isMegaRoller(slot, now) ? 1.2 : 1;
  }

  paintSquare(centerX, centerY, radius, ownerSlot) {
    const cells = [];
    for (let y = Math.floor(centerY) - radius; y <= Math.floor(centerY) + radius; y += 1) {
      for (let x = Math.floor(centerX) - radius; x <= Math.floor(centerX) + radius; x += 1) {
        const index = this.cellIndex(x, y);
        if (index !== -1) cells.push(index);
      }
    }
    this.paintCells(cells, ownerSlot);
  }

  findPaintDirection(x, y, ownerSlot) {
    const candidates = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    return candidates.reduce((best, direction) => {
      let score = Math.random() * 2;
      for (let step = 1; step <= 5; step += 1) {
        const index = this.cellIndex(Math.floor(x + direction.x * step), Math.floor(y + direction.y * step));
        if (index === -1) { score -= 8; break; }
        if (this.getGridColor?.(index) !== ownerSlot) score += 2;
      }
      return score > best.score ? { ...direction, score } : best;
    }, { x: 1, y: 0, score: -Infinity });
  }

  draw(context, cell, now, colors) {
    this.effects.forEach((effect) => {
      const color = effect.ownerSlot === 1 ? colors.blue : colors.orange;
      context.save();
      if (effect.type === "barrier") {
        context.beginPath();
        context.arc(effect.x * cell, effect.y * cell, 4 * cell, 0, Math.PI * 2);
        context.fillStyle = `${color}25`;
        context.strokeStyle = `${color}cc`;
        context.lineWidth = cell * .18;
        context.fill(); context.stroke();
      }
      if (effect.type === "blackHole") {
        const rotation = (now - effect.startedAt) / 180;
        context.translate(effect.x * cell, effect.y * cell);
        context.rotate(rotation);
        context.beginPath();
        context.arc(0, 0, 5.5 * cell, 0, Math.PI * 1.55);
        context.strokeStyle = `${color}bb`;
        context.lineWidth = cell * .8;
        context.stroke();
        context.beginPath();
        context.arc(0, 0, 2.8 * cell, Math.PI, Math.PI * 2.55);
        context.strokeStyle = "rgba(10,12,25,.75)";
        context.stroke();
      }
      if (effect.type === "copyCat") {
        context.beginPath();
        context.arc(effect.x * cell, effect.y * cell, cell * .7, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = "#fff";
        context.setLineDash([cell * .25, cell * .18]);
        context.stroke();
      }
      if (effect.type === "laser") {
        context.beginPath();
        context.moveTo(effect.x * cell, effect.y * cell);
        context.lineTo((effect.x + effect.direction.x * this.gridSize * 1.5) * cell, (effect.y + effect.direction.y * this.gridSize * 1.5) * cell);
        context.strokeStyle = "rgba(255,255,255,.85)";
        context.lineWidth = cell * 1.5;
        context.stroke();
      }
      const impacts = effect.impacts || [];
      impacts.filter((impact) => impact.painted || effect.type === "storm").forEach((impact) => {
        const age = now - impact.at;
        context.beginPath();
        context.arc(impact.x * cell, impact.y * cell, Math.max(cell, 3 * cell * (1 - age / 600)), 0, Math.PI * 2);
        context.fillStyle = `${color}66`;
        context.fill();
      });
      context.restore();
    });
  }

  cellIndex(x, y) {
    return x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize ? y * this.gridSize + x : -1;
  }

  clamp(value) {
    return Math.max(.5, Math.min(this.gridSize - .5, value));
  }
}
