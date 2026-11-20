import { SandEngine } from './engine.js';

// Radii in standard-grid cells. Scale with the grid, not with pointer speed.
export const PATH_TOOLS = Object.freeze({ wallRadius: 2, eraseRadius: 5 });

export class PathEngine extends SandEngine {
  constructor(width = 180, height = 300, seed = 2026, parameters = {}) {
    super(width, height, seed, parameters);
    this.walls = new Uint8Array(width * height);
    this.wallCount = 0;
    this.removedOnReset = 0;
    this.tracing = false;
  }

  load(particles) {
    // SandEngine validates before modifying anything, including a failed reload.
    super.load(particles);
    this.clearWalls(); this.removedOnReset = 0;
  }

  isEmpty(x, y) {
    return super.isEmpty(x, y) && !this.walls[y * this.width + x];
  }

  reset() {
    this.tracing = false;
    this.removedOnReset = 0;
    for (let id = 0; this.wallCount && id < this.count; id++) {
      const cell = this.originY[id] * this.width + this.originX[id];
      if (!this.walls[cell]) continue;
      this.walls[cell] = 0; this.wallCount--; this.removedOnReset++;
    }
    super.reset();
  }

  beginTrace() {
    this.tracing = true;
    this.vx.fill(0); this.vy.fill(0);
  }

  step() {
    if (!this.tracing) super.step();
  }

  traceSegment(ax, ay, bx, by, radius, elapsedMs = 50) {
    if (!this.tracing || ![ax, ay, bx, by, radius, elapsedMs].every(Number.isFinite)) return 0;
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
    if (length < 0.1 || radius <= 0) return 0;
    const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const scale = this.width / 180;
    const scatter = scale * Math.min(2, Math.max(0, length / scale / Math.max(8, elapsedMs) - 0.2) * 2);
    let changed = 0;
    // A swept capsule, evaluated against each stable ID once per input segment.
    // The rim may temporarily contain several grains; no IDs or colors are lost.
    for (let id = 0; id < this.count; id++) {
      const x = this.x[id], y = this.y[id];
      const t = Math.max(0, Math.min(length, (x - ax) * ux + (y - ay) * uy));
      const cx = ax + t * ux, cy = ay + t * uy;
      if ((x - cx) ** 2 + (y - cy) ** 2 >= radius ** 2) continue;
      const side = ((x - cx) * nx + (y - cy) * ny) || (id % 2 ? 1 : -1);
      const sign = Math.sign(side);
      const rim = radius + 1 + ((Math.imul(id + 1, 2654435761) >>> 0) % 1024) / 1024 * radius * .6;
      const push = rim - Math.abs(side);
      const tx = Math.round(x + nx * sign * push + ux * scatter);
      const ty = Math.round(y + ny * sign * push + uy * scatter);
      let px = x, py = y;
      const steps = Math.max(Math.abs(tx - x), Math.abs(ty - y));
      // Cardinal substeps keep every grain in its original wall-connected region.
      for (let s = 1; s <= steps; s++) {
        const qx = Math.round(x + (tx - x) * s / steps), qy = Math.round(y + (ty - y) * s / steps);
        if (qx < 0 || qx >= this.width || qy < 0 || qy >= this.height) break;
        if (this.walls[py * this.width + qx] || this.walls[qy * this.width + qx]) break;
        px = qx; py = qy;
      }
      if (px === x && py === y) continue;
      this.x[id] = px; this.y[id] = py;
      if (this.fixed[id]) { this.fixed[id] = 0; this.fixedCount--; }
      this.active[id] = 1; changed++;
    }
    this.rebuildTraceGrid();
    return changed;
  }

  rebuildTraceGrid() {
    this.grid.fill(0);
    for (let id = 0; id < this.count; id++) this.grid[this.y[id] * this.width + this.x[id]] = id + 1;
  }

  endTrace() {
    if (!this.tracing) return;
    const size = this.grid.length, queue = new Int32Array(size), parent = new Int32Array(size);
    const seen = new Uint32Array(size); let stamp = 0;
    // Move a vacancy back along a cardinal path, then insert the extra rim grain.
    // Existing fixed grains are released only if this local packing displaces them.
    for (let id = 0; id < this.count; id++) {
      const start = this.y[id] * this.width + this.x[id];
      if (this.grid[start] === id + 1) continue;
      let head = 0, tail = 1, empty = -1;
      queue[0] = start; seen[start] = ++stamp; parent[start] = -1;
      while (head < tail && empty < 0) {
        const cell = queue[head++], x = cell % this.width;
        for (let direction = 0; direction < 4; direction++) {
          const next = direction === 0 ? (x ? cell - 1 : -1) : direction === 1 ?
            (x + 1 < this.width ? cell + 1 : -1) : direction === 2 ? cell - this.width : cell + this.width;
          if (next < 0 || next >= size || this.walls[next] || seen[next] === stamp) continue;
          seen[next] = stamp; parent[next] = cell;
          if (!this.grid[next]) { empty = next; break; }
          queue[tail++] = next;
        }
      }
      if (empty < 0) throw new Error('なぞり砂を収める空きセルがありません。');
      while (parent[empty] !== -1) {
        const from = parent[empty], moved = this.grid[from] - 1;
        this.grid[empty] = moved + 1;
        this.x[moved] = empty % this.width; this.y[moved] = Math.floor(empty / this.width);
        if (this.fixed[moved]) { this.fixed[moved] = 0; this.fixedCount--; }
        this.active[moved] = 1; empty = from;
      }
      this.grid[start] = id + 1;
    }
    this.tracing = false; this.vx.fill(0); this.vy.fill(0);
  }

  editWallSegment(ax, ay, bx, by, erase = false) {
    if (![ax, ay, bx, by].every(Number.isFinite)) return 0;
    const radius = (erase ? PATH_TOOLS.eraseRadius : PATH_TOOLS.wallRadius) * this.width / 180;
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
    const minX = Math.max(0, Math.ceil(Math.min(ax, bx) - radius));
    const maxX = Math.min(this.width - 1, Math.floor(Math.max(ax, bx) + radius));
    const minY = Math.max(0, Math.ceil(Math.min(ay, by) - radius));
    const maxY = Math.min(this.height - 1, Math.floor(Math.max(ay, by) + radius));
    let changed = 0;
    // One swept capsule covers every cell along a fast/diagonal pointer path.
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2)) : 0;
      if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 > radius * radius) continue;
      const cell = y * this.width + x;
      if (erase) {
        if (!this.walls[cell]) continue;
        this.walls[cell] = 0; this.wallCount--; changed++;
        this.wakeAround(x, y);
      } else {
        if (this.walls[cell] || this.grid[cell]) continue;
        this.walls[cell] = 1; this.wallCount++; changed++;
      }
    }
    return changed;
  }

  clearWalls() {
    const removed = this.wallCount;
    if (!removed) return 0;
    for (let cell = 0; cell < this.walls.length; cell++) {
      if (!this.walls[cell]) continue;
      this.walls[cell] = 0;
      this.wakeAround(cell % this.width, Math.floor(cell / this.width));
    }
    this.wallCount = 0;
    return removed;
  }

  assertIntegrity() {
    if (!this.tracing) super.assertIntegrity();
    else for (let id = 0; id < this.count; id++) {
      const cell = this.y[id] * this.width + this.x[id];
      if (this.x[id] < 0 || this.x[id] >= this.width || this.y[id] < 0 || this.y[id] >= this.height ||
          this.walls[cell] || !this.grid[cell]) throw new Error('なぞり砂の不整合');
    }
    let walls = 0;
    for (let cell = 0; cell < this.walls.length; cell++) {
      if (!this.walls[cell]) continue;
      if (this.grid[cell]) throw new Error('壁と砂粒が重なっています。');
      walls++;
    }
    if (walls !== this.wallCount) throw new Error('壁セル数が一致しません。');
    return true;
  }
}
