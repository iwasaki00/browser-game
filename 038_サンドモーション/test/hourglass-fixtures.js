import { HourglassEngine, hourglassPlacement } from '../src/hourglass.js';

export function fixture(width, height, imageWidth = 600, imageHeight = 440, transparent = false) {
  const engine = new HourglassEngine(width, height);
  const layout = hourglassPlacement(imageWidth, imageHeight, width, height);
  const particles = [], bands = [[226, 95, 92, 255], [240, 192, 99, 255], [87, 177, 163, 255], [99, 137, 208, 160]];
  for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) {
    if (transparent && x < layout.width / 3) continue;
    particles.push({ x: x + layout.x, y: y + layout.y, color: bands[Math.min(3, Math.floor(y / layout.height * 4))] });
  }
  engine.load(particles);
  return engine;
}

export function finishFlow(engine, limit = 12000, onStep = () => {}) {
  let steps = 0;
  for (; steps < limit && engine.upperCount(); steps++) { engine.step(); onStep(steps); }
  // Allow the last grains to reach the pile rather than stopping at the midline.
  for (let i = 0; i < engine.height * 2; i++) { engine.step(); onStep(steps + i); }
  return steps;
}
