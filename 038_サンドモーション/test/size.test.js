import test from 'node:test';
import assert from 'node:assert/strict';
import { sizePlacement, SIZES } from '../src/size.js';
import { imagePlacement, particlesFromRGBA } from '../src/image.js';
import { HourglassEngine } from '../src/hourglass.js';
import { finishFlow } from './hourglass-fixtures.js';

test('portrait default grows from 55% to 70%; maximum 80% retains landing space', () => {
  for (const [width, height] of [[180, 300], [270, 450]]) {
    const source = { width: 600, height: 1000 }, p = sizePlacement(source, 'free', width, height);
    const oldHeight = Math.round(height * 0.55);
    assert.equal(p.height, height * 0.70); assert.ok(p.height / oldHeight > 1.26);
    const max = sizePlacement(source, 'free', width, height, SIZES.free.max);
    assert.equal(max.height, height * 0.80);
    assert.ok(height - max.height - max.y >= height * 0.12 - 1);
  }
});

test('landscape, square, portrait and extreme ratios fit without cropping or stretching', () => {
  for (const [iw, ih] of [[600, 440], [1000, 300], [1000, 1000], [600, 1000], [1, 10000], [10000, 1]]) {
    for (const mode of ['free', 'hourglass']) for (const size of [SIZES[mode].min, SIZES[mode].initial, SIZES[mode].max]) {
      const p = sizePlacement({ width: iw, height: ih }, mode, 180, 300, size);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 180 && p.y + p.height <= 300);
      // Quantization is at most one grid cell; no independent axis scaling.
      assert.ok(Math.abs(p.width - p.height * iw / ih) <= Math.max(1, iw / ih));
    }
  }
  assert.deepEqual(imagePlacement(600, 1000, 180, 300, 2), imagePlacement(600, 1000, 180, 300, 0.8));
});

test('resampling retains alpha; maximum dense free image is real additional grains', () => {
  const alpha = particlesFromRGBA(new Uint8ClampedArray([50, 90, 100, 128, 20, 40, 60, 0]), 2, 1);
  assert.equal(alpha.length, 1); assert.equal(alpha[0].color[3], 128);
  for (const [width, height, expected] of [[180, 300, 37200], [270, 450, 83520]]) {
    const p = sizePlacement({ width: 620, height: 960 }, 'free', width, height, 80);
    const grains = particlesFromRGBA(new Uint8ClampedArray(p.width * p.height * 4).fill(255), p.width, p.height, p.x, p.y);
    assert.equal(grains.length, expected);
  }
});

for (const [width, height] of [[180, 300], [270, 450]]) {
  test(`${width}: maximum opaque hourglass sizes drain upright and after flipping`, () => {
    for (const [iw, ih] of [[750, 540], [600, 1000], [680, 1340], [1000, 1000]]) {
      const p = sizePlacement({ width: iw, height: ih }, 'hourglass', width, height, 100);
      const grains = particlesFromRGBA(new Uint8ClampedArray(p.width * p.height * 4).fill(255), p.width, p.height, p.x, p.y);
      const e = new HourglassEngine(width, height); e.load(grains);
      const count = e.count, colors = e.colors.slice(), initial = e.grid.slice();
      e.releaseAll(); assert.ok(finishFlow(e) < 12000);
      assert.equal(e.upperCount(), 0); e.assertIntegrity();
      e.flip(); assert.equal(e.upperCount(), count);
      assert.ok(finishFlow(e) < 12000); assert.equal(e.upperCount(), 0); e.assertIntegrity();
      assert.equal(e.count, count); assert.deepEqual(e.colors, colors);
      e.reset(); assert.deepEqual(e.grid, initial); assert.equal(e.fixedCount, count);
    }
  });
}
