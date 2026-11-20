import test from 'node:test';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { Reassembly } from '../src/reassembly.js';

function dense(w, h) {
  const e = new PathEngine(w, h), particles = [];
  for (let y = Math.round(h * .1); y < h * .8; y++)
    for (let x = Math.round(w * .1); x < w * .9; x++)
      particles.push({ x, y, color: [particles.length % 251, x % 255, y % 255, 255] });
  e.load(particles); return e;
}
for (const [w, h] of [[180, 300], [270, 450]]) {
  test(`${w}: entering trace cancels existing momentum and freezes running right/left/up gravity without reimport`, () => {
    for (const gravity of [[1, 0], [-1, 0], [0, -1]]) {
      const e = dense(w, h), colors = e.colors.slice();
      e.setGravity(...gravity); e.releaseAll();
      for (let i = 0; i < 8; i++) e.step();
      assert.ok(e.vx.some(Boolean) || e.vy.some(Boolean));
      const x = e.x.slice(), y = e.y.slice(), tick = e.tick, seed = e.seed;
      e.beginTrace();
      assert.ok(e.vx.every(v => v === 0)); assert.ok(e.vy.every(v => v === 0));
      for (let i = 0; i < 400; i++) e.step();
      assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
      assert.equal(e.tick, tick); assert.equal(e.seed, seed); assert.deepEqual(e.colors, colors);
      e.endTrace(); assert.deepEqual(e.gravity, { x: gravity[0], y: gravity[1] });
      for (let i = 0; i < 8; i++) e.step();
      assert.ok(e.x.some((px, id) => px !== x[id]) || e.y.some((py, id) => py !== y[id]));
      e.assertIntegrity();
    }
  });
  test(`${w}: dense opaque centre has a continuous persistent groove, stationary input does nothing`, () => {
    const e = dense(w, h), colors = e.colors.slice(), count = e.count, untouched = 0;
    const home = [e.x[untouched], e.y[untouched]], r = 10 * w / 180;
    e.beginTrace();
    assert.equal(e.traceSegment(w / 2, h / 2, w / 2, h / 2, r), 0);
    e.traceSegment(w * .3, h * .45, w * .7, h * .45, r, 800);
    for (let x = Math.ceil(w * .32); x < w * .68; x++)
      assert.equal(e.grid[Math.round(h * .45) * w + x], 0);
    const x = e.x.slice(), y = e.y.slice();
    for (const g of [[1, 0], [-1, 1], [0, -1]]) {
      e.setGravity(...g); for (let k = 0; k < 350; k++) e.step();
    }
    assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
    assert.deepEqual([e.x[untouched], e.y[untouched]], home); assert.equal(e.fixed[untouched], 1);
    assert.equal(e.traceSegment(60, 90, 60, 90, r), 0);
    assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
    assert.equal(e.count, count); assert.deepEqual(e.colors, colors); e.assertIntegrity();
  });

  test(`${w}: repeated crossing strokes preserve IDs/colors; return and reset restore exact origins`, () => {
    const e = dense(w, h), colors = e.colors.slice(), count = e.count;
    e.beginTrace();
    for (let i = 0; i < 16; i++) {
      e.traceSegment(w * .3, h * .3, w * .7, h * .65, 12 * w / 180, 16);
      e.traceSegment(w * .7, h * .3, w * .3, h * .65, 12 * w / 180, 120);
      e.assertIntegrity();
    }
    assert.equal(e.count, count); assert.deepEqual(e.colors, colors);
    const ret = new Reassembly(e); assert.equal(ret.start(), true); ret.advance(1500);
    assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
    assert.equal(e.fixedCount, count); e.assertIntegrity();
    e.beginTrace(); e.traceSegment(w * .3, h / 2, w * .7, h / 2, 10, 50);
    e.reset(); assert.equal(e.tracing, false); e.assertIntegrity();
    assert.deepEqual(e.colors, colors); assert.equal(e.fixedCount, count);
  });

  test(`${w}: leaving trace packs all rim grains without crossing a sealed wall, then gravity resumes`, () => {
    const e = dense(w, h), colors = e.colors.slice(), count = e.count;
    // Add a full-height wall only after reserving an empty column.
    const mid = Math.floor(w / 2), particles = [];
    for (let id = 0; id < count; id++) if (Math.abs(e.x[id] - mid) > 3)
      particles.push({ x: e.x[id], y: e.y[id], color: [...e.colors.slice(id * 4, id * 4 + 4)] });
    e.load(particles); e.editWallSegment(mid, 0, mid, h - 1);
    const wallColors = e.colors.slice(), wallCount = e.count;
    const walls = e.walls.slice(), sides = Array.from(e.x, x => x < mid);
    e.beginTrace();
    for (let i = 0; i < 5; i++) e.traceSegment(w * .25, h * .45, w * .75, h * .45, 12 * w / 180, 16);
    for (let id = 0; id < e.count; id++) assert.equal(e.x[id] < mid, sides[id]);
    e.endTrace(); e.assertIntegrity();
    for (let id = 0; id < e.count; id++) assert.equal(e.x[id] < mid, sides[id]);
    assert.deepEqual(e.walls, walls); assert.equal(e.grid.filter(Boolean).length, e.count);
    assert.ok(e.fixedCount < e.count); assert.ok(e.vx.every(v => v === 0));
    const before = e.y.slice(); e.setGravity(0, 1);
    for (let k = 0; k < 60; k++) e.step();
    assert.notDeepEqual(e.y, before); e.assertIntegrity();
    assert.equal(colors.length, count * 4);
    assert.deepEqual(e.colors, wallColors); assert.equal(e.count, wallCount);
  });

  test(`${w}: one fast diagonal sweep has no unintended gaps`, () => {
    const e = dense(w, h); e.beginTrace();
    const ax = w * .3, ay = h * .3, bx = w * .7, by = h * .65;
    e.traceSegment(ax, ay, bx, by, 10 * w / 180, 8);
    for (let t = .05; t < .95; t += .01)
      assert.equal(e.grid[Math.round(ay + (by - ay) * t) * w + Math.round(ax + (bx - ax) * t)], 0);
    e.endTrace(); e.assertIntegrity();
  });
}

test('fast strokes scatter forward more than slow strokes; invalid input preserves state', () => {
  const slow = dense(180, 300), fast = dense(180, 300);
  for (const e of [slow, fast]) e.beginTrace();
  slow.traceSegment(60, 100, 100, 100, 10, 1000);
  fast.traceSegment(60, 100, 100, 100, 10, 8);
  assert.ok(fast.x.reduce((sum, x) => sum + x, 0) > slow.x.reduce((sum, x) => sum + x, 0));
  const x = fast.x.slice(); assert.equal(fast.traceSegment(NaN, 0, 4, 5, 10), 0);
  assert.deepEqual(fast.x, x); fast.endTrace(); fast.assertIntegrity();
});
