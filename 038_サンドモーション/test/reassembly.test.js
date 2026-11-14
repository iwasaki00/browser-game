import test from 'node:test';
import assert from 'node:assert/strict';
import { SandEngine } from '../src/engine.js';
import { Reassembly } from '../src/reassembly.js';

function fixture() {
  const e = new SandEngine(30, 50);
  const particles = [];
  for (let y = 3; y < 12; y++) for (let x = 4; x < 26; x++) particles.push({ x, y, color: [x * 8, y * 18, 120, 255] });
  e.load(particles); return e;
}
const fields = ['grid', 'x', 'y', 'originX', 'originY', 'colors', 'fixed', 'active', 'vx', 'vy'];
const snapshot = e => fields.map(name => e[name].slice());
function same(e, expected) { for (let i = 0; i < fields.length; i++) assert.deepEqual(e[fields[i]], expected[i], fields[i]); assert.ok(e.assertIntegrity()); }

for (const type of ['partial', 'all', 'mixed']) test(`${type}: exact original state after reassembly, then touch can release it again`, () => {
  const e = fixture(), initial = snapshot(e), count = e.count;
  if (type === 'partial') e.brushSegment(12, 10, 16, 10, 3);
  else e.releaseAll();
  for (let i = 0; i < 40; i++) {
    if (type === 'mixed' && i % 5 === 0) e.brushSegment(5, 35, 25, 45, 8, 4, -3);
    e.step();
  }
  const interrupted = snapshot(e), a = new Reassembly(e);
  assert.equal(a.start(), true); a.advance(750);
  same(e, interrupted); // Drawing coordinates never mutate physical occupancy.
  assert.equal(a.active, true); a.advance(750);
  assert.equal(a.active, false); same(e, initial);
  assert.equal(e.count, count); assert.equal(e.fixedCount, count);
  e.brushSegment(12, 10, 12, 10, 2); assert.ok(e.fixedCount < count);
});

test('untouched images do not animate; fixed grains at home remain motionless', () => {
  const e = fixture(), a = new Reassembly(e);
  assert.equal(a.start(), false);
  e.brushSegment(12, 10, 16, 10, 3); for (let i = 0; i < 20; i++) e.step();
  assert.equal(a.start(), true);
  for (let frame = 0; frame < 80; frame++) {
    a.advance(16);
    for (let id = 0; id < e.count; id++) if (e.fixed[id]) {
      assert.equal(a.drawX[id], e.originX[id]); assert.equal(a.drawY[id], e.originY[id]);
    }
  }
});

test('per-ID delays, configurable arcs, ease-out, no per-frame buffer allocation', () => {
  const e = fixture(); e.releaseAll(); for (let i = 0; i < 30; i++) e.step();
  const a = new Reassembly(e); a.start({ durationMs: 2000, arcStrength: 0.1 });
  const buffers = [a.startX, a.startY, a.drawX, a.drawY, a.delay, a.bend];
  assert.ok(new Set(a.delay).size > 20);
  a.advance(80);
  const straight = new Reassembly(e); straight.start({ durationMs: 2000, arcStrength: 0 }); straight.advance(80);
  assert.notDeepEqual(a.drawX, straight.drawX); // Arc strength really changes the path.
  assert.ok(a.drawY.some((v, id) => v !== a.startY[id]));
  assert.ok(a.drawY.some((v, id) => v === a.startY[id] && e.y[id] !== e.originY[id]));
  a.advance(1500);
  [a.startX, a.startY, a.drawX, a.drawY, a.delay, a.bend].forEach((buffer, i) => assert.equal(buffer, buffers[i]));
  assert.equal(a.active, true); a.advance(420); assert.equal(a.active, false);
  const id = 0;
  e.releaseAll(); for (let i = 0; i < 20; i++) e.step();
  a.start({ durationMs: 1500, arcStrength: 0, staggerFraction: 0 });
  a.advance(1100); const first = a.drawY[id]; a.advance(100); const second = a.drawY[id];
  a.advance(100); const third = a.drawY[id];
  assert.ok(Math.abs(third - second) < Math.abs(second - first));
});

test('double start is ignored; cancel/reset cannot be followed by an old completion', () => {
  const e = fixture(), initial = snapshot(e); e.releaseAll(); for (let i = 0; i < 30; i++) e.step();
  const a = new Reassembly(e); a.start(); a.advance(400);
  assert.equal(a.start(), false); assert.equal(a.elapsedMs, 400);
  a.cancel(); e.reset(); e.brushSegment(12, 10, 12, 10, 2);
  const afterResetAndTouch = snapshot(e);
  assert.equal(a.advance(10000), false); same(e, afterResetAndTouch);
  e.reset(); same(e, initial);
});

test('pause is progress-preserving; cancel before replacing engine cannot affect the new image', () => {
  const e = fixture(); e.releaseAll(); for (let i = 0; i < 30; i++) e.step();
  const a = new Reassembly(e); a.start(); a.advance(400);
  const positions = a.drawY.slice(); // App deliberately omits advance while paused.
  assert.equal(a.elapsedMs, 400); assert.deepEqual(a.drawY, positions);
  a.advance(100); assert.equal(a.elapsedMs, 500);
  a.cancel(); const next = fixture(); next.load([{ x: 2, y: 2, color: [255, 5, 5, 255] }]);
  const before = snapshot(next), replacement = new Reassembly(next);
  a.advance(5000); same(next, before); assert.equal(replacement.active, false);
});
