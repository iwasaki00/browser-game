import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { PreviousTraceEngine } from './fixtures/trace-v0.6.2.mjs';
import { naturalFixture, naturalRaster, referenceStroke, referenceMetrics, referenceSheet } from '../test/natural-reference.js';
import { png } from './reference-raster.mjs';
const out = 'docs/natural-trace-v0.6.3'; fs.mkdirSync(out, { recursive: true });
const report = { version: '0.6.3', runtime: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
  environment: 'Node CPU/raster reference; no browser FPS or iPhone claim', browserFps: null, measurements: [] };
for (const [width, height] of [[180, 300], [270, 450]]) for (const previous of [true, false]) {
  const e = naturalFixture(previous ? PreviousTraceEngine : PathEngine, width, height), colors = e.colors.slice();
  const frames = [naturalRaster(e)], snapshots = [{ stroke: 0, ...referenceMetrics(e) }], times = [];
  let maxSingleStrokeDistance = 0; e.beginTrace();
  for (let i = 1; i <= 30; i++) {
    const x = e.x.slice(), y = e.y.slice(), start = performance.now(); referenceStroke(e, previous); times.push(performance.now() - start);
    for (let id = 0; id < e.count; id++) maxSingleStrokeDistance = Math.max(maxSingleStrokeDistance, Math.hypot(e.x[id] - x[id], e.y[id] - y[id]));
    e.assertIntegrity(); assert.deepEqual(e.colors, colors);
    const metrics = referenceMetrics(e); assert.equal(metrics.visible, e.count); assert.equal(metrics.occupied, e.count);
    if ([1,10,30].includes(i)) { frames.push(naturalRaster(e)); snapshots.push({ stroke: i, ...metrics }); }
  }
  const tag = previous ? 'before-v0.6.2' : 'after-v0.6.3';
  fs.writeFileSync(`${out}/${tag}-${width}.png`, png(width * 4, height, referenceSheet(width, height, frames)));
  times.sort((a,b) => a-b);
  report.measurements.push({ grid: `${width}x${height}`, version: previous ? '0.6.2' : '0.6.3', defaultRadius: (previous ? 12 : 3) * width / 180,
    cpuMedianMs: +times[15].toFixed(3), cpuP95Ms: +times[28].toFixed(3), maxSingleStrokeDistance: +maxSingleStrokeDistance.toFixed(2), snapshots });
}
fs.writeFileSync(`${out}/node-results.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
