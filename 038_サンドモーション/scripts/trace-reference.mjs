// Node simulation evidence only. No image/video export or browser FPS claim.
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { Reassembly } from '../src/reassembly.js';

const report = { version: '0.6.0', at: new Date().toISOString(), runtime: process.version,
  platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
  browserVerified: false, iphoneVerified: false, browserFps: null, measurements: [] };
for (const [width, height] of [[180, 300], [270, 450]]) {
  const e = new PathEngine(width, height), particles = [];
  for (let y = Math.round(height * .1); y < height * .8; y++)
    for (let x = Math.round(width * .1); x < width * .9; x++)
      particles.push({ x, y, color: [particles.length % 251, x % 255, y % 255, 255] });
  e.load(particles); const colors = e.colors.slice(), count = e.count;
  e.beginTrace(); let start = performance.now();
  e.traceSegment(width * .3, height * .45, width * .7, height * .45, 12 * width / 180, 800);
  const strokeCpuMs = performance.now() - start;
  const occupancy = new Uint16Array(width * height);
  for (let id = 0; id < count; id++) occupancy[e.y[id] * width + e.x[id]]++;
  let emptyCentreCells = 0;
  for (let x = Math.ceil(width * .32); x < width * .68; x++)
    if (!occupancy[Math.round(height * .45) * width + x]) emptyCentreCells++;
  const x = e.x.slice(), y = e.y.slice(); e.setGravity(-1, 1);
  for (let i = 0; i < 400; i++) e.step();
  assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
  start = performance.now(); e.endTrace(); const packingCpuMs = performance.now() - start;
  e.assertIntegrity(); assert.equal(e.count, count); assert.deepEqual(e.colors, colors);
  const ret = new Reassembly(e); assert.ok(ret.start()); ret.advance(1500);
  e.assertIntegrity(); assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
  report.measurements.push({ grid: `${width}x${height}`, particles: count, emptyCentreCells,
    temporaryExtraLayers: count - occupancy.filter(Boolean).length,
    maxGrainsPerRimCell: occupancy.reduce((max, n) => Math.max(max, n), 0),
    strokeCpuMs: +strokeCpuMs.toFixed(2), packingCpuMs: +packingCpuMs.toFixed(2),
    gravityLeavesGrooveUnchanged: true, exactReturn: true, colorsAndCountPreserved: true });
}
fs.mkdirSync('docs/trace-v0.6.0', { recursive: true });
fs.writeFileSync('docs/trace-v0.6.0/node-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
