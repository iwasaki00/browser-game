// Reproducible Node physics evidence, not browser rendering or FPS.
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PathEngine, PATH_TOOLS } from '../src/paths.js';
import { Reassembly } from '../src/reassembly.js';

const report = { version: '0.5.0', at: new Date().toISOString(), runtime: process.version,
  cpu: os.cpus()[0]?.model, platform: `${os.platform()} ${os.arch()}`, tools: PATH_TOOLS,
  browserVerified: false, iphoneVerified: false, browserFps: null, measurements: [] };
const run = (e, n) => { for (let i = 0; i < n; i++) { e.step(); if (i % 20 === 0) e.assertIntegrity(); } };
for (const [quality, width, height] of [['standard', 180, 300], ['high', 270, 450]]) {
  const e = new PathEngine(width, height), input = [];
  for (let y = Math.floor(height * .1); y < height * .16; y++) for (let x = Math.floor(width * .4); x < width * .6; x++)
    input.push({ x, y, color: [80 + input.length % 100, 140, 180, input.length % 2 ? 160 : 255] });
  e.load(input); const colors = e.colors.slice(), y = Math.floor(height * .6), count = e.count;
  e.editWallSegment(0, y, width - 1, y); const initialWallCount = e.wallCount;
  const start = performance.now(); e.releaseAll(); run(e, 500);
  const below = () => e.y.reduce((n, py) => n + Number(py > y + 10), 0);
  const heldBelow = below(); assert.equal(heldBelow, 0); assert.ok(e.active.every(v => !v));
  const erasedWallCells = e.editWallSegment(width / 2, y, width / 2, y, true);
  const awakeAfterErase = e.active.reduce((a, b) => a + b, 0); assert.ok(awakeAfterErase > 0);
  run(e, 500); const droppedBelow = below(); assert.ok(droppedBelow > 0);
  const originalRow = Math.floor(height * .1); e.editWallSegment(width * .4, originalRow, width * .6, originalRow);
  const beforeReturn = e.wallCount, returning = new Reassembly(e); returning.start(); returning.advance(500);
  assert.equal(e.wallCount, beforeReturn); returning.advance(1000); e.assertIntegrity();
  const removedOverlaps = e.removedOnReset; assert.ok(removedOverlaps > 0);
  assert.equal(e.wallCount, beforeReturn - removedOverlaps); assert.equal(e.count, count); assert.deepEqual(e.colors, colors);
  assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
  const row = { quality, grid: `${width}x${height}`, particles: count, initialWallCount, heldBelow,
    erasedWallCells, awakeAfterErase, droppedBelow, removedOverlaps, retainedWallsAfterReturn: e.wallCount,
    colorsAndCountExact: true, returnExact: true, physicsAndChecksCpuMs: +(performance.now() - start).toFixed(2), browserFps: null };
  const slope = new PathEngine(width, height), ax = Math.floor(width * .25), ay = Math.floor(height * .35), bx = Math.floor(width * .75), by = ay + bx - ax;
  slope.load(Array.from({ length: 100 }, (_, i) => ({ x: ax + 8 + i % 10, y: 10 + Math.floor(i / 10), color: [160, 140, 80, 255] })));
  slope.editWallSegment(ax, ay, bx, by); slope.releaseAll(); run(slope, 800);
  assert.ok(slope.y.every(py => py > by + 10)); slope.assertIntegrity();
  row.slopeParticles = slope.count; row.slopeBelowEnd = slope.y.reduce((n, py) => n + Number(py > by + 10), 0);
  report.measurements.push(row);
}
const out = new URL('../docs/paths-v0.5.0/', import.meta.url); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL('node-results.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
