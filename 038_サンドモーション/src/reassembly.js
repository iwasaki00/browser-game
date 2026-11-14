export const REASSEMBLY = Object.freeze({ durationMs: 1500, arcStrength: 0.06, staggerFraction: 0.2 });

export class Reassembly {
  constructor(engine) {
    this.engine = engine;
    this.active = false; this.elapsedMs = 0;
    // Stable particle IDs index both original coordinates and these draw buffers.
    const count = engine.count;
    this.startX = new Float32Array(count); this.startY = new Float32Array(count);
    this.drawX = new Float32Array(count); this.drawY = new Float32Array(count);
    this.delay = new Float32Array(count); this.bend = new Float32Array(count);
  }

  start(parameters = {}) {
    if (this.active || !this.engine.count) return false;
    const e = this.engine;
    let changed = false;
    for (let id = 0; id < e.count; id++) {
      if (!e.fixed[id] || e.x[id] !== e.originX[id] || e.y[id] !== e.originY[id]) { changed = true; break; }
    }
    if (!changed) return false;
    const p = { ...REASSEMBLY, ...parameters };
    this.durationMs = Number.isFinite(p.durationMs) ? Math.max(100, p.durationMs) : REASSEMBLY.durationMs;
    this.arcStrength = Number.isFinite(p.arcStrength) ? Math.max(0, Math.min(0.2, p.arcStrength)) : REASSEMBLY.arcStrength;
    this.staggerFraction = Number.isFinite(p.staggerFraction) ? Math.max(0, Math.min(0.4, p.staggerFraction)) : REASSEMBLY.staggerFraction;
    this.flightMs = this.durationMs * (1 - this.staggerFraction);
    this.startX.set(e.x); this.startY.set(e.y);
    this.drawX.set(e.x); this.drawY.set(e.y);
    for (let id = 0; id < e.count; id++) {
      // Deterministic per-ID staggering; don't consume the physics RNG or make
      // a new random object/path each frame. Fixed grains at home have zero arc.
      const hash = Math.imul(id + 1, 2654435761) >>> 0;
      this.delay[id] = hash / 4294967296 * this.durationMs * this.staggerFraction;
      this.bend[id] = (hash & 1 ? 1 : -1) * this.arcStrength;
    }
    this.elapsedMs = 0; this.active = true;
    return true;
  }

  advance(deltaMs) {
    if (!this.active) return false;
    this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + (Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0));
    const e = this.engine;
    if (this.elapsedMs >= this.durationMs) {
      // Never commit interpolated/rounded coordinates into the collision grid.
      // The existing reset establishes exact colors, occupancy, flags and count.
      e.reset(); this.drawX.set(e.x); this.drawY.set(e.y); this.active = false;
      return true;
    }
    for (let id = 0; id < e.count; id++) {
      const t = Math.max(0, Math.min(1, (this.elapsedMs - this.delay[id]) / this.flightMs));
      const ease = 1 - (1 - t) ** 3;
      const dx = e.originX[id] - this.startX[id], dy = e.originY[id] - this.startY[id];
      const arc = Math.sin(Math.PI * ease) * this.bend[id];
      this.drawX[id] = Math.max(0, Math.min(e.width - 1, this.startX[id] + dx * ease - dy * arc));
      this.drawY[id] = Math.max(0, Math.min(e.height - 1, this.startY[id] + dy * ease + dx * arc));
    }
    return false;
  }

  cancel() { this.active = false; this.elapsedMs = 0; }
}
