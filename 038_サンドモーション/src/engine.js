// Pure grid simulation. Particle IDs are array indices; grid stores ID + 1.
export const PHYSICS = Object.freeze({ acceleration: 0.28, damping: 0.84,
  collisionDamping: 0.25, maxSpeed: 4, slopeProbability: 1 });

export class SandEngine {
  constructor(width = 180, height = 300, seed = 2026, parameters = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0 || 1;
    this.initialSeed = this.seed;
    this.parameters = { ...PHYSICS, ...parameters };
    this.grid = new Int32Array(width * height);
    this.gravity = { x: 0, y: 1 };
    this.count = 0;
    this.fixedCount = 0;
    this.tick = 0;
  }

  random() {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  load(particles) {
    // Validate transactionally so a bad input never destroys the current image.
    const grid = new Int32Array(this.grid.length);
    particles.forEach((p, id) => {
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y) ||
          p.x < 0 || p.y < 0 || p.x >= this.width || p.y >= this.height ||
          grid[p.y * this.width + p.x]) throw new Error('粒子の位置が重複、または領域外です。');
      grid[p.y * this.width + p.x] = id + 1;
    });
    this.grid = grid;
    this.count = particles.length;
    this.x = new Int16Array(this.count);
    this.y = new Int16Array(this.count);
    this.originX = new Int16Array(this.count);
    this.originY = new Int16Array(this.count);
    this.colors = new Uint8ClampedArray(this.count * 4);
    this.fixed = new Uint8Array(this.count);
    this.active = new Uint8Array(this.count);
    this.vx = new Float32Array(this.count);
    this.vy = new Float32Array(this.count);
    particles.forEach((p, id) => {
      this.originX[id] = this.x[id] = p.x;
      this.originY[id] = this.y[id] = p.y;
      this.colors.set(p.color, id * 4);
    });
    this.reset();
  }

  reset() {
    this.grid.fill(0);
    for (let id = 0; id < this.count; id++) {
      this.x[id] = this.originX[id]; this.y[id] = this.originY[id];
      this.grid[this.y[id] * this.width + this.x[id]] = id + 1;
    }
    this.fixed?.fill(1); this.active?.fill(0);
    this.vx?.fill(0); this.vy?.fill(0);
    this.fixedCount = this.count;
    this.seed = this.initialSeed;
    this.tick = 0;
  }

  releaseAll() {
    this.fixed.fill(0); this.active.fill(1); this.fixedCount = 0;
  }

  setGravity(x, y) {
    if (![x, y].every(n => Number.isInteger(n) && Math.abs(n) <= 1) || (!x && !y))
      throw new Error('重力は8方向のいずれかを指定してください。');
    this.gravity = { x, y };
    this.active?.fill(1);
  }

  isEmpty(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height &&
      this.grid[y * this.width + x] === 0;
  }

  wakeAround(x, y) {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
      const id = this.grid[ny * this.width + nx] - 1;
      if (id >= 0 && !this.fixed[id]) this.active[id] = 1;
    }
  }

  move(id, dx, dy) {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return false;
    const x = this.x[id], y = this.y[id], nx = x + dx, ny = y + dy;
    if (!this.isEmpty(nx, ny)) return false;
    // No diagonal squeeze between two occupied corners.
    if (dx && dy && !this.isEmpty(x + dx, y) && !this.isEmpty(x, y + dy)) return false;
    this.grid[y * this.width + x] = 0;
    this.grid[ny * this.width + nx] = id + 1;
    this.x[id] = nx; this.y[id] = ny;
    this.wakeAround(x, y); this.wakeAround(nx, ny);
    return true;
  }

  brushSegment(ax, ay, bx, by, radius, impulseX = 0, impulseY = 0) {
    // Capsule distance covers the entire segment, including very fast swipes.
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx) + radius));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by) + radius));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2)) : 0;
      if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 > radius * radius) continue;
      const id = this.grid[y * this.width + x] - 1;
      if (id < 0) continue;
      if (this.fixed[id]) { this.fixed[id] = 0; this.fixedCount--; }
      this.active[id] = 1;
      const max = this.parameters.maxSpeed;
      this.vx[id] = Math.max(-max, Math.min(max, this.vx[id] + impulseX));
      this.vy[id] = Math.max(-max, Math.min(max, this.vy[id] + impulseY));
    }
  }

  step() {
    const { x: gx, y: gy } = this.gravity;
    const p = this.parameters;
    // Visit IDs exactly once; reverse and rotate order to avoid a preferred side.
    const reverse = this.tick++ % 2;
    const offset = Math.floor(this.random() * this.count);
    for (let k = 0; k < this.count; k++) {
      const id = (offset + (reverse ? this.count - 1 - k : k)) % this.count;
      if (this.fixed[id] || !this.active[id]) continue;
      let vx = (this.vx[id] + gx * p.acceleration) * p.damping;
      let vy = (this.vy[id] + gy * p.acceleration) * p.damping;
      let moved = false;
      // Momentum is swept through adjacent cells; it can never jump a wall.
      const speed = Math.max(Math.abs(vx), Math.abs(vy));
      const steps = Math.min(p.maxSpeed, Math.floor(speed));
      let previousX = 0, previousY = 0;
      for (let s = 1; s <= steps; s++) {
        const nextX = Math.round(vx / speed * s), nextY = Math.round(vy / speed * s);
        if (!this.move(id, nextX - previousX, nextY - previousY)) {
          vx *= p.collisionDamping; vy *= p.collisionDamping; break;
        }
        previousX = nextX; previousY = nextY; moved = true;
      }
      let fell = this.move(id, gx, gy);
      if (!fell && this.random() < p.slopeProbability) {
        const side = gx ? Math.sign(vy) : Math.sign(vx);
        const sign = side || (this.random() < 0.5 ? -1 : 1);
        // Cardinal gravity: two down-slope neighbors. Diagonal: the two axes.
        const diagonalFirstX = gx && gy && this.random() < 0.5;
        for (let candidate = 0; candidate < 2; candidate++) {
          const direction = candidate ? -sign : sign;
          const dx = gx && gy ? (Boolean(candidate) === diagonalFirstX ? gx : 0) : gx + (gy ? direction : 0);
          const dy = gx && gy ? (dx ? 0 : gy) : gy + (gx ? direction : 0);
          if (!this.move(id, dx, dy)) continue;
          vx += (dx - gx) * 0.15; vy += (dy - gy) * 0.15;
          fell = true; break;
        }
      }
      if (!fell) { vx *= p.collisionDamping; vy *= p.collisionDamping; }
      this.vx[id] = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, vx));
      this.vy[id] = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, vy));
      if (!moved && !fell && Math.abs(vx) + Math.abs(vy) < 0.2) this.active[id] = 0;
    }
  }

  assertIntegrity() {
    const seen = new Uint8Array(this.count);
    let occupied = 0;
    for (let cell = 0; cell < this.grid.length; cell++) {
      const id = this.grid[cell] - 1;
      if (id < 0) continue;
      if (id >= this.count || seen[id] || this.y[id] * this.width + this.x[id] !== cell)
        throw new Error('グリッドと粒子の不整合');
      seen[id] = 1; occupied++;
    }
    if (occupied !== this.count) throw new Error('粒子数の不整合');
    return true;
  }
}
