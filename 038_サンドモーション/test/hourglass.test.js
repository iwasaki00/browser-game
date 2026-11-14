import test from 'node:test';
import assert from 'node:assert/strict';
import { hourglassGeometry, hourglassPlacement } from '../src/hourglass.js';
import { fixture, finishFlow } from './hourglass-fixtures.js';

for (const [width, height] of [[120, 200], [180, 300], [270, 450]]) {
  test(`${width}: walls, central neck, placement fit and 180-degree symmetry`, () => {
    const { walls, outline, neckWidth } = hourglassGeometry(width, height);
    assert.ok(Math.abs(neckWidth / width - 0.056) < 0.012);
    for (let i = 0; i < walls.length; i++) {
      assert.equal(walls[i], walls[walls.length - 1 - i]);
      if (outline[i]) assert.equal(walls[i], 1);
    }
    const row = Math.floor(height / 2);
    for (let x = 0; x < width; x++) assert.equal(walls[row * width + x], Math.abs(x - (width - 1) / 2) > neckWidth / 2 ? 1 : 0);
    for (const [iw, ih] of [[600, 440], [300, 1200], [1, 10000], [10000, 1], [100, 100]]) {
      const p = hourglassPlacement(iw, ih, width, height);
      assert.ok(p.y + p.height < height / 2);
      assert.ok(p.width * p.height <= width * height * 0.075);
      for (let y = p.y; y < p.y + p.height; y++) for (let x = p.x; x < p.x + p.width; x++) assert.equal(walls[y * width + x], 0);
    }
  });
}

for (const [width, height] of [[180, 300], [270, 450]]) {
  for (const [name, iw, ih] of [['opaque sample footprint', 600, 440], ['dense portrait', 600, 1000], ['dense tall image', 300, 1200]]) {
    test(`${width}: ${name} flows completely upright without wall penetration or ID/color loss`, () => {
      const e = fixture(width, height, iw, ih), count = e.count, colors = e.colors.slice();
      const before = e.grid.slice();
      for (let i = 0; i < 50; i++) e.step();
      assert.deepEqual(e.grid, before); assert.equal(e.flip(), false);
      e.releaseAll();
      const steps = finishFlow(e, 12000, n => { if (n % 100 === 0) e.assertIntegrity(); });
      assert.ok(steps < 12000); assert.equal(e.upperCount(), 0);
      assert.equal(e.count, count); assert.deepEqual(e.colors, colors); e.assertIntegrity();
      for (const y of e.y) assert.ok(y > height / 2 + height * 0.03, 'pile clears neck');
      // Complete-state flip must put every grain in the upper chamber, then drain again.
      e.flip(); assert.equal(e.upperCount(), count);
      assert.ok(finishFlow(e) < 12000); assert.equal(e.upperCount(), 0); e.assertIntegrity();
      e.reset(); assert.deepEqual(e.grid, before); assert.equal(e.fixedCount, count); assert.equal(e.started, false);
    });
  }
  test(`${width}: midstream/repeated flip preserves each ID, colors and count; clears momentum`, () => {
    const e = fixture(width, height), colors = e.colors.slice();
    e.releaseAll(); for (let i = 0; i < 200; i++) e.step();
    assert.ok(e.upperCount() > 0 && e.upperCount() < e.count);
    const x = e.x.slice(), y = e.y.slice(), grid = e.grid.slice();
    for (let turn = 0; turn < 6; turn++) {
      assert.equal(e.flip(), true); e.assertIntegrity();
      assert.ok(e.vx.every(v => v === 0) && e.vy.every(v => v === 0));
      for (let id = 0; id < e.count; id++) {
        assert.equal(e.x[id], turn % 2 ? x[id] : width - 1 - x[id]);
        assert.equal(e.y[id], turn % 2 ? y[id] : height - 1 - y[id]);
      }
      assert.deepEqual(e.colors, colors); assert.equal(e.fixedCount, 0);
    }
    assert.deepEqual(e.grid, grid); assert.deepEqual(e.gravity, { x: 0, y: 1 });
  });
  test(`${width}: left/right bias changes band pattern; baseline drains remaining grains`, () => {
    const straight = fixture(width, height), tilted = fixture(width, height);
    straight.releaseAll(); tilted.releaseAll(); finishFlow(straight);
    for (let i = 0; i < 400; i++) tilted.step();
    tilted.setGravity(-1, -1); assert.deepEqual(tilted.gravity, { x: -1, y: 1 });
    for (let i = 0; i < 180; i++) tilted.step();
    tilted.setGravity(1, 0); assert.deepEqual(tilted.gravity, { x: 1, y: 1 });
    for (let i = 0; i < 180; i++) tilted.step();
    tilted.setGravity(0, -1); finishFlow(tilted);
    assert.equal(tilted.upperCount(), 0); tilted.assertIntegrity();
    assert.deepEqual(tilted.colors, straight.colors); assert.notDeepEqual(tilted.grid, straight.grid);
  });
}

test('transparent pixels are omitted; alpha, originals and fixed state survive reset', () => {
  const e = fixture(180, 300, 600, 440, true), initial = e.grid.slice(), colors = e.colors.slice();
  assert.ok(e.count < fixture(180, 300).count); assert.ok(colors.includes(160));
  e.releaseAll(); finishFlow(e); e.flip(); e.reset();
  assert.deepEqual(e.grid, initial); assert.deepEqual(e.colors, colors);
  assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
  assert.ok(e.fixed.every(v => v === 1)); assert.ok(e.vx.every(v => v === 0));
});
