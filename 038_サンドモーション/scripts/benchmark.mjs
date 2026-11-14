import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { SandEngine } from '../src/engine.js';
console.log(JSON.stringify({ runtime: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
  note: 'Node.js physics only; excludes Canvas/rendering. Not iPhone FPS.' }));
for (const [width, height] of [[120, 200], [180, 300], [270, 450]]) {
  const e = new SandEngine(width, height);
  const particles = [];
  const w = Math.round(width * 0.86), h = Math.round(w * 440 / 600);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    particles.push({ x: x + Math.floor((width - w) / 2), y: y + Math.floor(height * 0.08), color: [200, 150, 90, 255] });
  e.load(particles); e.releaseAll();
  for (let i = 0; i < 30; i++) e.step();
  const times = [];
  for (let i = 0; i < 1200; i++) {
    if (i % 150 === 0) e.setGravity(...[[0, 1], [1, 0], [0, -1], [-1, 0]][(i / 150) % 4]);
    const start = performance.now(); e.step(); times.push(performance.now() - start);
  }
  e.assertIntegrity(); times.sort((a, b) => a - b);
  console.log(JSON.stringify({ grid: `${width}x${height}`, particles: e.count, steps: times.length,
    meanMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(3), maxMs: +times.at(-1).toFixed(3) }));
}
