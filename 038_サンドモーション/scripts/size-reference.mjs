// Numerical size/identity/flow evidence. This does not measure browser FPS.
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { sizePlacement } from '../src/size.js';
import { SandEngine } from '../src/engine.js';
import { HourglassEngine } from '../src/hourglass.js';
import { particlesFromRGBA } from '../src/image.js';
import { Reassembly } from '../src/reassembly.js';
import { simulationTiming } from '../src/quality.js';
import { finishFlow } from '../test/hourglass-fixtures.js';

const report = { version: '0.4.1', at: new Date().toISOString(), runtime: process.version,
  cpu: os.cpus()[0]?.model, platform: `${os.platform()} ${os.arch()}`,
  browserVerified: false, iphoneVerified: false, browserFps: null,
  portraitComparison: [], measurements: [] };
for (const [width, height] of [[180, 300], [270, 450]]) {
  const source = { width: 600, height: 1000 };
  const scale = Math.min(width * 0.86 / source.width, height * 0.55 / source.height);
  const old = { width: Math.round(source.width * scale), height: Math.round(source.height * scale) };
  const current = sizePlacement(source, 'free', width, height);
  report.portraitComparison.push({ grid: `${width}x${height}`, source: '600x1000 opaque portrait',
    previous: old, current, heightRatio: +(current.height / old.height).toFixed(4),
    note: 'Grid dimensions; also CSS px when canvas displays at its native grid dimensions. Not iPhone measurements.' });
  for (const [mode, iw, ih, size] of [['free', 620, 960, 80], ['hourglass', 750, 540, 100],
    ['hourglass', 600, 1000, 100], ['hourglass', 680, 1340, 100], ['hourglass', 1000, 1000, 100]]) {
    const layout = sizePlacement({ width: iw, height: ih }, mode, width, height, size);
    const rgba = new Uint8ClampedArray(layout.width * layout.height * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba.set([80, 140, 180, 255], i);
    const e = mode === 'hourglass' ? new HourglassEngine(width, height) : new SandEngine(width, height);
    e.load(particlesFromRGBA(rgba, layout.width, layout.height, layout.x, layout.y));
    const initial = e.grid.slice(), colors = e.colors.slice(), count = e.count;
    const row = { mode, grid: `${width}x${height}`, source: `${iw}x${ih} opaque`, size, layout, count, browserFps: null };
    e.releaseAll(); const start = performance.now();
    if (mode === 'hourglass') {
      const steps = finishFlow(e); e.assertIntegrity(); assert.equal(e.upperCount(), 0);
      row.flowSteps = steps; row.simulatedMidlineSeconds = +(steps * simulationTiming(width).stepMs / 1000).toFixed(2);
      row.remainingUpper = e.upperCount(); e.flip(); assert.equal(e.upperCount(), count);
      assert.ok(finishFlow(e) < 12000); assert.equal(e.upperCount(), 0); e.assertIntegrity(); row.flipDrained = true;
    } else {
      for (let i = 0; i < 120; i++) e.step(); e.assertIntegrity();
      const returning = new Reassembly(e); returning.start(); returning.advance(1500);
      assert.deepEqual(e.grid, initial); row.reassemblyExact = true;
    }
    row.physicsAndChecksCpuMs = +(performance.now() - start).toFixed(2);
    assert.equal(e.count, count); assert.deepEqual(e.colors, colors); e.reset(); assert.deepEqual(e.grid, initial);
    row.colorAndCountExact = true; row.resetExact = true; row.fixedCountAfterReset = e.fixedCount;
    report.measurements.push(row);
  }
}
const out = new URL('../docs/size-v0.4.1/', import.meta.url); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL('node-results.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
