import { SandEngine } from './engine.js';

// Geometry uses cell centres and is exactly invariant under a 180° turn.
export function hourglassGeometry(width, height) {
  const walls = new Uint8Array(width * height), outline = new Uint8Array(walls.length);
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const neckHalf = width / 36, cap = Math.ceil(height * 0.04);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const half = Math.min(width * 0.42, neckHalf + Math.abs(y - cy) * 0.65);
    walls[y * width + x] = y < cap || y >= height - cap || Math.abs(x - cx) > half ? 1 : 0;
  }
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (walls[i] && (!walls[i - 1] || !walls[i + 1] || !walls[i - width] || !walls[i + width])) outline[i] = 1;
  }
  return { walls, outline, neckWidth: Math.floor(neckHalf) * 2, cap };
}

export function hourglassPlacement(imageWidth, imageHeight, width, height) {
  // Bound the solid image area, not just chamber area: the receiving pile needs
  // clearance below the neck even when all pixels are opaque and fall centrally.
  let scale = Math.min(width * 0.48 / imageWidth, height * 0.30 / imageHeight,
    Math.sqrt(width * height * 0.075 / (imageWidth * imageHeight)));
  const { walls } = hourglassGeometry(width, height), y = Math.ceil(height * 0.08);
  for (;;) {
    const w = Math.max(1, Math.floor(imageWidth * scale)), h = Math.max(1, Math.floor(imageHeight * scale));
    const x = Math.floor((width - w) / 2);
    let fits = true;
    for (let row = y; row < y + h; row++) if (walls[row * width + x] || walls[row * width + x + w - 1]) fits = false;
    if (fits) return { x, y, width: w, height: h };
    scale *= 0.98;
  }
}

export class HourglassEngine extends SandEngine {
  constructor(width, height, seed = 2026) {
    super(width, height, seed);
    this.container = hourglassGeometry(width, height);
    this.started = false;
  }
  load(particles) {
    if (particles.some(p => this.container.walls[p.y * this.width + p.x])) throw new Error('画像が容器の壁に重なっています。');
    super.load(particles);
  }
  isEmpty(x, y) {
    return super.isEmpty(x, y) && !this.container.walls[y * this.width + x];
  }
  setGravity(x) { super.setGravity(Math.sign(x), 1); }
  reset() { super.reset(); this.started = false; }
  releaseAll() { super.releaseAll(); this.started = true; }
  flip() {
    if (!this.started) return false;
    this.grid.fill(0);
    for (let id = 0; id < this.count; id++) {
      this.x[id] = this.width - 1 - this.x[id];
      this.y[id] = this.height - 1 - this.y[id];
      this.grid[this.y[id] * this.width + this.x[id]] = id + 1;
    }
    this.vx.fill(0); this.vy.fill(0); this.active.fill(1);
    return true;
  }
  upperCount() {
    let count = 0;
    for (let id = 0; id < this.count; id++) if (this.y[id] < this.height / 2) count++;
    return count;
  }
  assertIntegrity() {
    super.assertIntegrity();
    for (let id = 0; id < this.count; id++) if (this.container.walls[this.y[id] * this.width + this.x[id]]) throw new Error('粒子が壁に侵入しました。');
    return true;
  }
}
