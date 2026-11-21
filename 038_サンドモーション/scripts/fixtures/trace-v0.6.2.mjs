// Archived v0.6.2 trace method, used only for reproducible comparisons.
import { PathEngine } from '../../src/paths.js';
export class PreviousTraceEngine extends PathEngine {
  traceSegment(ax, ay, bx, by, radius, elapsedMs = 50) {
    if (!this.tracing || ![ax, ay, bx, by, radius, elapsedMs].every(Number.isFinite)) return 0;
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
    if (length < 0.1 || radius <= 0) return 0;
    const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const scale = this.width / 180;
    const scatter = scale * Math.min(2, Math.max(0, length / scale / Math.max(8, elapsedMs) - 0.2) * 2);
    // Bounded straight push lanes. No empty destination means no movement.
    const reach = Math.ceil(Math.max(this.width, this.height) * .5);
    this.tracePath ??= new Int32Array(Math.max(this.width, this.height) * 2 + 2);
    const inside = (x, y) => {
      const t = Math.max(0, Math.min(length, (x - ax) * ux + (y - ay) * uy));
      return (x - ax - t * ux) ** 2 + (y - ay - t * uy) ** 2 < radius ** 2;
    };
    let changed = 0;
    for (let id = 0; id < this.count; id++) {
      const x = this.x[id], y = this.y[id];
      if (!inside(x, y)) continue;
      const side = (x - ax) * nx + (y - ay) * ny;
      const sign = Math.sign(side) || (id % 2 ? 1 : -1);
      let rx = nx * sign + ux * scatter / (radius + 1);
      let ry = ny * sign + uy * scatter / (radius + 1);
      const norm = Math.hypot(rx, ry); rx /= norm; ry /= norm;
      let px = x, py = y, used = 0, found = false, blocked = false;
      for (let distance = 1; distance <= reach && !blocked && !found; distance++) {
        const qx = Math.round(x + rx * distance), qy = Math.round(y + ry * distance);
        // Cardinal substeps also test the corner cell on diagonal lanes.
        for (let axis = 0; axis < 2; axis++) {
          const tx = axis === 0 ? qx : px, ty = axis === 1 ? qy : py;
          if (tx === px && ty === py) continue;
          if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height || this.walls[ty * this.width + tx]) { blocked = true; break; }
          px = tx; py = ty;
          if (inside(px, py)) continue;
          const cell = py * this.width + px;
          this.tracePath[used++] = cell;
          if (!this.grid[cell]) { found = true; break; }
        }
      }
      if (!found) continue;
      // Commit only a complete lane ending in a vacancy. Push the rim outwards,
      // then insert this grain. Every grain remains in its own visible cell.
      for (let i = used - 1; i > 0; i--) {
        const cell = this.tracePath[i], moved = this.grid[this.tracePath[i - 1]] - 1;
        this.grid[cell] = moved + 1;
        this.x[moved] = cell % this.width; this.y[moved] = Math.floor(cell / this.width);
        if (this.fixed[moved]) { this.fixed[moved] = 0; this.fixedCount--; }
        this.active[moved] = 1; this.vx[moved] = 0; this.vy[moved] = 0;
      }
      const target = this.tracePath[0];
      this.grid[y * this.width + x] = 0; this.grid[target] = id + 1;
      this.x[id] = target % this.width; this.y[id] = Math.floor(target / this.width);
      if (this.fixed[id]) { this.fixed[id] = 0; this.fixedCount--; }
      this.active[id] = 1; changed++;
    }
    return changed;
  }

}
