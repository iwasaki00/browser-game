import test from 'node:test';
import assert from 'node:assert/strict';
import { PathEngine, PATH_TOOLS } from '../src/paths.js';
import { SandEngine } from '../src/engine.js';
import { Reassembly } from '../src/reassembly.js';

const grain = (x, y, n = 0) => ({ x, y, color: [50 + n % 190, 100, 170, n % 2 ? 160 : 255] });
const run = (e, n) => { for (let i = 0; i < n; i++) { e.step(); if (i % 30 === 0) e.assertIntegrity(); } };
function particles(width, height) {
  const list = [];
  for (let y = Math.floor(height * 0.10); y < height * 0.16; y++)
    for (let x = Math.floor(width * 0.4); x < width * 0.6; x++) list.push(grain(x, y, list.length));
  return list;
}

for (const [width, height] of [[180, 300], [270, 450]]) {
  test(`${width}: horizontal wall supports sleeping sand; erasing only its centre reactivates it`, () => {
    const e = new PathEngine(width, height), row = Math.floor(height * 0.60);
    e.load(particles(width, height)); const count = e.count, colors = e.colors.slice();
    e.editWallSegment(0, row, width - 1, row); const originalWalls = e.walls.slice();
    e.releaseAll(); run(e, 500);
    assert.ok(e.y.every(y => y < row)); assert.ok(e.active.every(v => !v));
    const removed = e.editWallSegment(width / 2, row, width / 2, row, true);
    assert.ok(removed > 0); assert.ok(e.active.some(Boolean));
    assert.equal(e.walls[row * width + 5], 1); assert.equal(e.walls[row * width + width - 6], 1);
    for (let i = 0; i < e.walls.length; i++) if (e.walls[i]) assert.equal(originalWalls[i], 1);
    run(e, 500); assert.ok(e.y.some(y => y > row + 20));
    assert.equal(e.count, count); assert.deepEqual(e.colors, colors); e.assertIntegrity();
  });

  test(`${width}: diagonal wall carries grains to an end without gaps, overlap or loss`, () => {
    const e = new PathEngine(width, height), ax = Math.floor(width * 0.25), ay = Math.floor(height * 0.35), bx = Math.floor(width * 0.75), by = ay + bx - ax;
    const input = [];
    for (let y = 10; y < 20; y++) for (let x = ax + 8; x < ax + 18; x++) input.push(grain(x, y, input.length));
    e.load(input); const colors = e.colors.slice(); e.editWallSegment(ax, ay, bx, by);
    for (let x = ax; x <= bx; x++) assert.equal(e.walls[(ay + x - ax) * width + x], 1);
    e.releaseAll(); let travelled = false;
    for (let step = 0; step < 800; step++) {
      for (let id = 0; id < e.count; id++) if (e.x[id] > ax + 25 && e.y[id] < by) travelled = true;
      e.step(); e.assertIntegrity();
    }
    assert.ok(travelled); assert.ok(e.y.every(y => y > by + 10));
    assert.equal(e.count, input.length); assert.deepEqual(e.colors, colors);
  });

  test(`${width}: fast diagonal stroke and maximum momentum cannot jump or squeeze through a sealed diagonal`, () => {
    const e = new PathEngine(width, height, 2026, { acceleration: 0, damping: 1 });
    const startY = Math.floor(height * 0.22), x = Math.floor(width / 2);
    e.load([grain(x, startY + x - 12)]);
    e.editWallSegment(-10, startY - 10, width + 10, startY + width + 10);
    e.releaseAll(); e.vx[0] = -4; e.vy[0] = 4;
    for (let i = 0; i < 300; i++) {
      e.step(); e.assertIntegrity(); assert.ok(e.y[0] - e.x[0] < startY, 'crossed the diagonal barrier');
    }
    // A 2x2 solid corner must reject its diagonal even at a seam.
    const corner = new PathEngine(width, height); corner.load([grain(10, 10)]);
    corner.walls[10 * width + 11] = 1; corner.walls[11 * width + 10] = 1; corner.wallCount = 2;
    assert.equal(corner.isEmpty(11, 11), true);
    assert.equal(corner.move(0, 1, 1), false);
    corner.assertIntegrity();
  });

  test(`${width}: edits skip fixed/moving particles, preserve colors and positions; clear wakes supports`, () => {
    const e = new PathEngine(width, height); e.load([grain(30, 30), grain(31, 30, 1)]);
    e.brushSegment(31, 30, 31, 30, 0.1, 3, -2);
    const snapshot = ['x', 'y', 'vx', 'vy', 'fixed', 'active', 'colors'].map(key => e[key].slice());
    e.editWallSegment(0, 30, width - 1, 30);
    assert.equal(e.walls[30 * width + 30], 0); assert.equal(e.walls[30 * width + 31], 0);
    ['x', 'y', 'vx', 'vy', 'fixed', 'active', 'colors'].forEach((key, i) => assert.deepEqual(e[key], snapshot[i]));
    e.assertIntegrity(); const n = e.wallCount; assert.ok(n > 0); assert.equal(e.clearWalls(), n);
    assert.ok(e.walls.every(v => v === 0)); assert.equal(e.wallCount, 0); e.assertIntegrity();
    // Erasing a support wakes a free grain, but never releases a fixed grain.
    const supported = new PathEngine(width, height); supported.load([grain(50, 40), grain(60, 40)]);
    supported.editWallSegment(0, 80, width - 1, 80);
    supported.brushSegment(50, 40, 50, 40, 0.1); run(supported, 200);
    assert.equal(supported.active[0], 0); supported.clearWalls(); assert.equal(supported.active[0], 1);
    assert.equal(supported.fixed[1], 1); run(supported, 100); assert.ok(supported.y[0] > 80);
    assert.equal(supported.y[1], 40); assert.equal(supported.count, 2);
  });

  test(`${width}: reset and return retain walls except exact origin overlaps; cancel is non-destructive`, () => {
    const e = new PathEngine(width, height); e.load([grain(30, 20), grain(31, 20, 1)]);
    e.editWallSegment(0, height - 20, width - 1, height - 20); const floor = e.walls.slice();
    e.releaseAll(); run(e, height);
    e.editWallSegment(25, 20, 40, 20); const before = e.wallCount;
    assert.equal(e.walls[20 * width + 30], 1);
    const returning = new Reassembly(e); returning.start(); returning.advance(500);
    assert.equal(e.wallCount, before); returning.cancel(); assert.equal(e.wallCount, before);
    e.reset(); assert.equal(e.removedOnReset, 2); assert.equal(e.wallCount, before - 2);
    assert.equal(e.walls[20 * width + 30], 0); assert.equal(e.walls[20 * width + 31], 0);
    for (let i = 0; i < floor.length; i++) if (floor[i]) assert.equal(e.walls[i], 1);
    assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY); assert.equal(e.fixedCount, 2); e.assertIntegrity();
    const retained = e.wallCount; e.reset(); assert.equal(e.removedOnReset, 0); assert.equal(e.wallCount, retained);
    // The retained neighbours legitimately enclose these two original cells;
    // erase that little stroke before preparing the next return scenario.
    e.editWallSegment(25, 20, 40, 20, true);
    e.releaseAll(); run(e, height); e.editWallSegment(25, 20, 40, 20);
    returning.start(); returning.advance(1500);
    assert.equal(e.removedOnReset, 2); assert.equal(e.wallCount, retained); e.assertIntegrity();
  });
}

test('wall-free PathEngine is bit-for-bit equivalent to the original free simulation', () => {
  const a = new PathEngine(180, 300), b = new SandEngine(180, 300), input = particles(180, 300);
  a.load(input); b.load(input); a.releaseAll(); b.releaseAll();
  const dirs = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]];
  for (let i = 0; i < 480; i++) {
    if (i % 60 === 0) for (const e of [a, b]) {
      e.setGravity(...dirs[i / 60]); e.brushSegment(30, 50, 120, 100, 12, 4, -2);
    }
    a.step(); b.step();
  }
  for (const key of ['x', 'y', 'grid', 'colors', 'fixed', 'active', 'vx', 'vy']) assert.deepEqual(a[key], b[key]);
  assert.equal(a.seed, b.seed); assert.equal(a.tick, b.tick);
});

test('wall thickness and eraser gap scale consistently with grid resolution', () => {
  const measures = [];
  for (const [w, h] of [[180, 300], [270, 450]]) {
    const e = new PathEngine(w, h); e.load([]); const y = Math.floor(h / 2), x = Math.floor(w / 2);
    e.editWallSegment(0, y, w - 1, y);
    let thickness = 0; for (let row = 0; row < h; row++) thickness += e.walls[row * w + x];
    e.editWallSegment(x, y, x, y, true);
    let gap = 0; for (let col = 0; col < w; col++) if (!e.walls[y * w + col]) gap++;
    measures.push({ thickness: thickness / w, gap: gap / w });
  }
  assert.ok(Math.abs(measures[0].thickness - measures[1].thickness) < 0.003);
  assert.ok(Math.abs(measures[0].gap - measures[1].gap) < 0.006);
  assert.equal(PATH_TOOLS.wallRadius, 2);
});

test('failed reload and invalid strokes preserve walls; successful image reload clears them', () => {
  const e = new PathEngine(); e.load([grain(20, 20)]); e.editWallSegment(10, 80, 100, 100);
  const mask = e.walls.slice(), grid = e.grid.slice(), count = e.wallCount;
  assert.throws(() => e.load([grain(10, 10), grain(10, 10)]));
  assert.equal(e.editWallSegment(NaN, 0, 1, 1), 0);
  assert.deepEqual(e.walls, mask); assert.deepEqual(e.grid, grid); assert.equal(e.wallCount, count);
  e.load([grain(40, 40)]); assert.equal(e.wallCount, 0); assert.equal(e.removedOnReset, 0); e.assertIntegrity();
});
