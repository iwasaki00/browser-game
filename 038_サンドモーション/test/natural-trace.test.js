import test from 'node:test';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { TRACE, traceRadius, traceShade } from '../src/trace.js';
import { Reassembly } from '../src/reassembly.js';
import { SandEngine } from '../src/engine.js';

function fixture(w, h, sparse = false) {
  const e = new PathEngine(w, h), particles = [];
  for (let y = Math.round(h * .1); y < h * .8; y++) for (let x = Math.round(w * .1); x < w * .9; x++) {
    if (sparse && (x + y) % 3) continue;
    particles.push({ x, y, color: [30 + particles.length % 200, x % 250, y % 250, 255] });
  }
  e.load(particles); return e;
}
function invariant(e, colors, count = e.count) {
  e.assertIntegrity(); assert.equal(e.count, count); assert.deepEqual(e.colors, colors);
  assert.equal(e.grid.filter(Boolean).length, count);
  const rgba = new Uint8Array(e.width * e.height * 4);
  for (let id = 0; id < count; id++) {
    assert.equal(e.grid[e.y[id] * e.width + e.x[id]], id + 1);
    rgba.set(e.colors.subarray(id * 4, id * 4 + 4), (e.y[id] * e.width + e.x[id]) * 4);
  }
  let visible = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) visible++;
  assert.equal(visible, count);
}
const moved = e => e.x.reduce((sum, x, id) => sum + Number(x !== e.originX[id] || e.y[id] !== e.originY[id]), 0);
for (const [w, h] of [[180, 300], [270, 450]]) {
  const scale = w / 180;
  function stroke(e, ax = .3, ay = .45, bx = .7, by = .45, ms = 800, width = 'small', force = 'standard') {
    return e.traceSegment(w * ax, h * ay, w * bx, h * by, traceRadius(w, width), ms, force);
  }
  test(`${w} T01: slow central trace changes the pattern locally without an erased stripe`, () => {
    const e = fixture(w, h), colors = e.colors.slice(), count = e.count; e.beginTrace(); stroke(e);
    assert.ok(moved(e) > 0); invariant(e, colors, count);
    assert.ok(e.lastTraceStats.work <= TRACE.maxWork);
    for (let id = 0; id < count; id++) {
      const outside = Math.abs(e.originY[id] - h * .45) > traceRadius(w) + scale || e.originX[id] < w * .3 - traceRadius(w) - scale || e.originX[id] > w * .7 + traceRadius(w) + scale;
      if (outside) { assert.equal(e.x[id], e.originX[id]); assert.equal(e.y[id], e.originY[id]); }
      assert.ok(traceShade(e, id) >= .98 && traceShade(e, id) <= 1.02);
      if (outside) assert.equal(traceShade(e, id), 1);
      assert.ok(Math.abs(e.x[id] - e.originX[id]) + Math.abs(e.y[id] - e.originY[id]) <= e.lastTraceStats.budget);
    }
  });
  test(`${w} T02: fast swipe remains bounded; releasing and stationary input never move grains`, () => {
    const e = fixture(w, h, true), colors = e.colors.slice(); e.beginTrace(); stroke(e, .2, .45, .8, .45, 8);
    assert.ok(moved(e) > 0); assert.ok(e.lastTraceStats.work <= TRACE.maxWork); invariant(e, colors);
    const x = e.x.slice(), y = e.y.slice();
    for (let i = 0; i < 600; i++) e.step();
    assert.equal(e.traceSegment(20, 30, 20, 30, traceRadius(w)), 0);
    assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
  });
  for (const [name, repeats] of [['T03', 10], ['T04', 30]]) test(`${w} ${name}: repeated strokes gradually mix IDs and preserve each visible grain`, () => {
    const e = fixture(w, h), colors = e.colors.slice(), count = e.count; e.beginTrace();
    stroke(e); const first = e.x.slice(), firstY = e.y.slice();
    for (let i = 1; i < repeats; i++) { stroke(e); invariant(e, colors, count); }
    assert.ok(e.x.some((x, id) => x !== first[id]) || e.y.some((y, id) => y !== firstY[id]));
  });
  test(`${w} T05: horizontal/vertical/diagonal fast traces cover the entire path`, () => {
    for (const [ax, ay, bx, by] of [[.2,.4,.8,.4],[.5,.2,.5,.7],[.2,.2,.8,.7]]) {
      const e = fixture(w, h), colors = e.colors.slice(); e.beginTrace(); stroke(e, ax, ay, bx, by, 8);
      for (let t = .1; t < .9; t += .1) {
        const cx = w * (ax + (bx - ax) * t), cy = h * (ay + (by - ay) * t);
        assert.ok(e.x.some((x, id) => !e.fixed[id] && Math.hypot(x - cx, e.y[id] - cy) <= traceRadius(w) * 2));
      }
      invariant(e, colors);
    }
  });
  test(`${w} T06: repeated full-area sweeps keep particles/occupancy/visible pixels equal`, () => {
    const e = fixture(w, h), colors = e.colors.slice(); e.beginTrace();
    for (let i = 0; i < 24; i++) {
      const t = (i % 8 + 1) / 10;
      stroke(e, .15, t, .85, 1 - t, 25); invariant(e, colors);
      stroke(e, t, .1, 1 - t, .85, 25); invariant(e, colors);
    }
  });
  test(`${w} T07: fully occupied region cannot create holes; only neighboring contact cycles occur`, () => {
    const e = new PathEngine(w, h), particles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) particles.push({ x, y, color: [x % 255, y % 255, 140, 255] });
    e.load(particles); const colors = e.colors.slice(); e.beginTrace(); stroke(e);
    assert.ok(moved(e) > 0); assert.ok(e.lastTraceStats.cycles > 0); invariant(e, colors);
    const caged = new PathEngine(w, h), cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    caged.load([{ x: cx, y: cy, color: [120, 150, 180, 255] }]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) {
      caged.walls[(cy + dy) * w + cx + dx] = 1; caged.wallCount++;
    }
    caged.beginTrace(); assert.equal(caged.traceSegment(cx - 2, cy, cx + 2, cy, traceRadius(w), 20), 0);
    assert.equal(caged.x[0], cx); assert.equal(caged.y[0], cy); invariant(caged, new Uint8ClampedArray([120,150,180,255]));
  });
  test(`${w} T08: wall contacts never cross, edit or hide grains`, () => {
    const e = fixture(w, h, true), colors = e.colors.slice();
    const wallX = Math.floor(w * .5);
    // Empty the column via a fresh transactional load so wall never replaces sand.
    const particles = [];
    for (let id = 0; id < e.count; id++) if (Math.abs(e.x[id] - wallX) > 4 * scale)
      particles.push({ x: e.x[id], y: e.y[id], color: [...e.colors.subarray(id * 4, id * 4 + 4)] });
    e.load(particles); e.editWallSegment(wallX, 0, wallX, h - 1);
    const walls = e.walls.slice(), left = Array.from(e.x, x => x < wallX), retained = e.colors.slice(); e.beginTrace();
    for (let i = 0; i < 10; i++) stroke(e, .48, .2, .52, .7, 20, 'large', 'strong');
    assert.deepEqual(e.walls, walls); for (let id = 0; id < e.count; id++) assert.equal(e.x[id] < wallX, left[id]);
    invariant(e, retained); assert.ok(colors.length > retained.length);
  });
  test(`${w} T09: strokes along/outside canvas edges preserve bounds and visibility`, () => {
    const e = fixture(w, h, true), colors = e.colors.slice(); e.beginTrace();
    for (const path of [[-.1,0,1.1,0],[0,-.1,0,1.1],[1,0,1,1],[0,1,1,1]]) stroke(e, ...path, 10, 'large', 'strong');
    invariant(e, colors);
  });
  test(`${w} T10: width scales consistently; force changes response without regeneration`, () => {
    assert.equal(traceRadius(w) / scale, 3); assert.equal(traceRadius(w, 'large') / scale, 8);
    const weak = fixture(w, h), strong = fixture(w, h); weak.beginTrace(); strong.beginTrace();
    stroke(weak, .3,.45,.7,.45,800,'small','weak'); stroke(strong,.3,.45,.7,.45,800,'small','strong');
    assert.ok(moved(strong) > moved(weak)); invariant(weak, weak.colors.slice()); invariant(strong, weak.colors);
  });
  test(`${w} T11: return/reset restore ID positions, colors, counts and all fixed flags`, () => {
    const e = fixture(w, h), colors = e.colors.slice(); e.beginTrace();
    for (let i = 0; i < 30; i++) stroke(e);
    const ret = new Reassembly(e); assert.ok(ret.start()); ret.advance(1500);
    assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY); assert.equal(e.fixedCount, e.count); invariant(e, colors);
    e.beginTrace(); stroke(e); e.reset(); invariant(e, colors); assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
  });
  test(`${w} T12: leaving tool preserves layout; original gravity resumes identically to SandEngine`, () => {
    const e = fixture(w, h, true); e.releaseAll(); e.active.fill(0); e.beginTrace(); stroke(e);
    for(let id=0;id<e.count;id++)if(e.traceWork.touched[id])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const x=e.x[id]+dx,y=e.y[id]+dy;
      if(x<0||x>=w||y<0||y>=h)continue;
      const neighbor=e.grid[y*w+x]-1;if(neighbor>=0)assert.equal(e.active[neighbor],1);
    }
    const colors = e.colors.slice(), x = e.x.slice(), y = e.y.slice(); e.endTrace();
    assert.deepEqual(e.x, x); assert.deepEqual(e.y, y);
    const control = new SandEngine(w, h); control.load(Array.from(e.x, (px, id) => ({ x: px, y: e.y[id], color: [...e.colors.subarray(id * 4, id * 4 + 4)] })));
    control.fixed.set(e.fixed); control.fixedCount = e.fixedCount; control.active.set(e.active);
    e.setGravity(0,1); control.setGravity(0,1);
    for (let i = 0; i < 60; i++) { e.step(); control.step(); }
    assert.deepEqual(e.x, control.x); assert.deepEqual(e.y, control.y); invariant(e, colors);
  });
}
