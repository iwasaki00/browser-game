import test from 'node:test';
import assert from 'node:assert/strict';
import { SandEngine } from '../src/engine.js';
import { imagePlacement, particlesFromRGBA } from '../src/image.js';

const particle = (x, y, color = [30, 90, 180, 255]) => ({ x, y, color });
function block(width = 20, height = 30) {
  const e = new SandEngine(width, height);
  const particles = [];
  for (let y = 2; y < 10; y++) for (let x = 4; x < 16; x++) particles.push(particle(x, y));
  e.load(particles); return e;
}
function run(e, count) { for (let i = 0; i < count; i++) e.step(); }

test('T01/T02: RGBA conversion preserves color, position, alpha and aspect ratio', () => {
  const rgba = new Uint8ClampedArray([12, 34, 56, 255, 80, 90, 100, 0, 20, 40, 60, 128]);
  const particles = particlesFromRGBA(rgba, 3, 1, 10, 20);
  assert.equal(particles.length, 2);
  assert.deepEqual([...particles[1].color], [20, 40, 60, 128]);
  assert.equal(particles[1].x, 12); assert.equal(particles[1].y, 20);
  const e = new SandEngine(30, 40); e.load(particles); run(e, 60);
  assert.deepEqual([...e.x], [10, 12]); assert.deepEqual([...e.y], [20, 20]);
  assert.equal(e.fixedCount, 2);
  for (const [w, h] of [[600, 440], [400, 2000], [2000, 100], [1, 1]]) {
    const p = imagePlacement(w, h, 180, 300);
    assert.ok(p.height <= 165 && p.width <= 155);
    assert.ok(p.x >= 0 && p.y + p.height < 300);
    assert.ok(Math.abs(p.width - w * p.height / h) <= Math.max(1, w / h));
  }
});

test('T03: tap releases only the circular neighborhood and never deletes particles', () => {
  const e = block(); e.brushSegment(10, 5, 10, 5, 2);
  assert.ok(e.fixedCount > 0 && e.fixedCount < e.count);
  for (let id = 0; id < e.count; id++) {
    const inside = (e.x[id] - 10) ** 2 + (e.y[id] - 5) ** 2 <= 4;
    assert.equal(e.fixed[id], inside ? 0 : 1);
  }
  assert.ok(e.assertIntegrity());
});

test('T04: fast swipe covers the full segment; stopped pointer adds no impulse', () => {
  const e = block(); e.brushSegment(4, 5, 15, 5, 1, 4, 0);
  for (let x = 4; x <= 15; x++) {
    const id = e.grid[5 * e.width + x] - 1;
    assert.equal(e.fixed[id], 0); assert.equal(e.vx[id], 4);
  }
  const before = [...e.vx]; e.brushSegment(10, 5, 10, 5, 1, 0, 0);
  assert.deepEqual([...e.vx], before);
  run(e, 80); assert.ok(e.assertIntegrity());
});

test('T05/T06: collapse falls, forms a pile, settles and conserves particles', () => {
  const e = block(); const count = e.count; e.releaseAll();
  assert.equal(e.fixedCount, 0); assert.ok(e.fixed.every(v => v === 0));
  run(e, 500); assert.ok(e.assertIntegrity());
  assert.equal(e.count, count); assert.equal(Math.max(...e.y), e.height - 1);
  assert.ok(Math.min(...e.y) > 10);
  assert.ok(e.active.every(v => v === 0));
  const position = [...e.x, ...e.y]; run(e, 60);
  assert.deepEqual([...e.x, ...e.y], position);
});

test('T07: grain above a fixed obstacle slides diagonally', () => {
  const e = new SandEngine(9, 9); e.load([particle(4, 3), particle(4, 4)]);
  e.brushSegment(4, 3, 4, 3, 0); e.step();
  assert.equal(e.y[0], 4); assert.ok(e.x[0] === 3 || e.x[0] === 5);
  assert.equal(e.x[1], 4); assert.equal(e.y[1], 4);
});

test('T08: all eight gravity directions move grains toward the selected wall', () => {
  for (const [gx, gy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const e = new SandEngine(20, 20); e.load([particle(10, 10)]);
    e.releaseAll(); e.setGravity(gx, gy); run(e, 100);
    if (gx) assert.equal(e.x[0], gx > 0 ? 19 : 0);
    if (gy) assert.equal(e.y[0], gy > 0 ? 19 : 0);
    assert.ok(e.assertIntegrity());
    e.setGravity(-gx, -gy); run(e, 100);
    if (gx) assert.equal(e.x[0], gx > 0 ? 0 : 19);
    if (gy) assert.equal(e.y[0], gy > 0 ? 0 : 19);
  }
});

test('T09: high impulse cannot cross a fixed wall or two occupied corners', () => {
  const e = new SandEngine(20, 20);
  e.load([particle(8, 10), ...Array.from({ length: 20 }, (_, y) => particle(10, y))]);
  e.brushSegment(8, 10, 8, 10, 0, 100, 0); run(e, 100);
  assert.ok(e.x[0] < 10); assert.ok(e.assertIntegrity());
  for (let id = 1; id < e.count; id++) assert.equal(e.x[id], 10);
  const corner = new SandEngine(6, 6);
  corner.load([particle(2, 2), particle(3, 2), particle(2, 3)]);
  assert.equal(corner.move(0, 1, 1), false);
});

test('one particle is updated once per step, including momentum substeps', () => {
  const e = new SandEngine(20, 100); e.load([particle(10, 5)]); e.releaseAll();
  e.step(); assert.equal(e.y[0], 6);
  e.vy[0] = 100; e.step(); assert.ok(e.y[0] <= 11);
});

test('T10/T13: 36,000 steps (10 simulated minutes), swipes and gravity changes preserve identity', () => {
  const e = block(24, 36); e.releaseAll();
  const colors = [...e.colors], count = e.count;
  const directions = [[0, 1], [-1, 0], [0, -1], [1, 0], [1, 1], [-1, -1]];
  for (let i = 0; i < 36000; i++) {
    if (i % 300 === 0) e.setGravity(...directions[(i / 300) % directions.length]);
    if (i % 60 === 0) e.brushSegment(0, 18, 23, 18, 4, 4, -4);
    e.step();
    if (i % 100 === 0) assert.ok(e.assertIntegrity());
  }
  assert.equal(e.count, count); assert.deepEqual([...e.colors], colors);
});

test('T11: reset restores positions, colors, fixed flags, velocity, activity and count', () => {
  const e = block(); const initial = [...e.x, ...e.y, ...e.colors];
  const count = e.count; e.releaseAll(); run(e, 100); e.reset();
  assert.equal(e.count, count); assert.equal(e.fixedCount, count);
  assert.deepEqual([...e.x, ...e.y, ...e.colors], initial);
  assert.ok(e.fixed.every(v => v === 1));
  assert.ok(e.vx.every(v => v === 0) && e.vy.every(v => v === 0) && e.active.every(v => v === 0));
  assert.ok(e.assertIntegrity());
});

test('T12: reload replaces all state; invalid position input leaves current state intact', () => {
  const e = block(); e.releaseAll(); run(e, 50);
  e.load([particle(1, 1, [255, 0, 30, 255])]);
  assert.equal(e.count, 1); assert.equal(e.fixedCount, 1);
  assert.deepEqual([...e.colors], [255, 0, 30, 255]);
  assert.throws(() => e.load([particle(-1, 0)]));
  assert.throws(() => e.load([particle(1, 1), particle(1, 1)]));
  assert.equal(e.count, 1); assert.ok(e.assertIntegrity());
});

test('fixed seed and identical inputs produce identical results', () => {
  const a = block(), b = block(); a.releaseAll(); b.releaseAll();
  run(a, 150); run(b, 150);
  assert.deepEqual(a.grid, b.grid); assert.deepEqual(a.vx, b.vx);
  a.reset(); a.releaseAll(); run(a, 150); assert.deepEqual(a.grid, b.grid);
});

test('sleeping grain wakes when its neighboring support moves', () => {
  const e = new SandEngine(9, 9); e.load([particle(4, 7), particle(4, 8), particle(3, 8), particle(5, 8)]);
  e.releaseAll(); run(e, 30); assert.equal(e.active[0], 0);
  assert.equal(e.move(2, -1, 0), true);
  assert.equal(e.move(1, -1, 0), true); // Remove support using adjacent moves, without deletion.
  assert.equal(e.active[0], 1); e.step(); assert.equal(e.y[0], 8);
});
