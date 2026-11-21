import { SandEngine } from './engine.js';
import { naturalTrace } from './trace.js';

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
    this.tracing = false; this.traceSerial = 0;
    this.traceWork?.touched.fill(0);
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

  traceSegment(ax, ay, bx, by, radius, elapsedMs = 50, strength = 'standard') {
    return naturalTrace(this, ax, ay, bx, by, radius, elapsedMs, strength);
  }

  endTrace() {
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
    super.assertIntegrity();
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
