import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { SandEngine } from '../src/engine.js';
import { imagePlacement } from '../src/image.js';
import { Reassembly } from '../src/reassembly.js';
import { QUALITIES, simulationTiming } from '../src/quality.js';

const report = { version: '0.3.0', runtime: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
  description: 'Node interpolation CPU only; not browser FPS. Fixed 60Hz animation timestamps, no Canvas.', measurements: [] };
for (const quality of ['standard', 'high']) {
  const { width, height } = QUALITIES[quality], layout = imagePlacement(600, 440, width, height);
  const e = new SandEngine(width, height), particles = [];
  for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) particles.push({ x: x + layout.x, y: y + layout.y, color: [x % 256, y % 256, 160, 255] });
  e.load(particles); e.releaseAll();
  for (let i = 0; i < Math.round(1800 / simulationTiming(width).stepMs); i++) e.step();
  const a = new Reassembly(e); a.start(); const times = [];
  for (let i = 0; i < 90; i++) { const start = performance.now(); a.advance(i === 89 ? 20 : 1000 / 60); times.push(performance.now() - start); }
  times.sort((a, b) => a - b); e.assertIntegrity();
  report.measurements.push({ quality, grid: `${width}x${height}`, count: e.count,
    configuredDurationMs: a.durationMs, logicalElapsedMs: a.elapsedMs,
    averageCpuMsPerAdvance: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    p95CpuMs: +times[Math.floor(times.length * 0.95)].toFixed(3),
    exactPositions: e.x.every((x, id) => x === e.originX[id] && e.y[id] === e.originY[id]),
    fixedCount: e.fixedCount, browserFps: null });
}
const out = new URL('../docs/reassembly-v0.3.0/', import.meta.url); mkdirSync(out, { recursive: true });
writeFileSync(new URL('node-results.json', out), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
