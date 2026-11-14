import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITIES, simulationTiming } from '../src/quality.js';
import { SandEngine } from '../src/engine.js';
import { imagePlacement, particlesFromRGBA } from '../src/image.js';

function fixture(quality) {
  const { width, height } = QUALITIES[quality], layout = imagePlacement(600, 440, width, height);
  const rgba = new Uint8ClampedArray(layout.width * layout.height * 4).fill(255);
  const e = new SandEngine(width, height);
  e.load(particlesFromRGBA(rgba, layout.width, layout.height, layout.x, layout.y));
  return e;
}

test('three real grids sample the image at their own resolution, preserving aspect and transparency', () => {
  for (const [quality, expected] of [['light', 7828], ['standard', 17670], ['high', 39440]]) {
    const e = fixture(quality); assert.equal(e.count, expected);
    assert.equal(e.grid.length, QUALITIES[quality].width * QUALITIES[quality].height);
    assert.equal(e.fixedCount, e.count); assert.ok(e.assertIntegrity());
  }
  const transparent = particlesFromRGBA(new Uint8ClampedArray([0, 0, 0, 0, 50, 70, 90, 128]), 2, 1);
  assert.equal(transparent.length, 1); assert.deepEqual([...transparent[0].color], [50, 70, 90, 128]);
});

test('CSS dimensions and brush diameter stay equal between standard and high', () => {
  const cssSizes = [], brushSizes = [];
  for (const quality of ['standard', 'high']) {
    const { width, height } = QUALITIES[quality];
    const scale = Math.min(336 / width, 528 / height);
    cssSizes.push([width * scale, height * scale]);
    brushSizes.push(12 * width / 180 * scale);
  }
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(cssSizes[0][i] - cssSizes[1][i]) < 0.0001);
  assert.ok(Math.abs(brushSizes[0] - brushSizes[1]) < 0.0001);
});

test('normalized fall and finger impulse are comparable at 60/90 physics steps per second', () => {
  const displacement = [];
  for (const quality of ['standard', 'high']) {
    const { width, height } = QUALITIES[quality], timing = simulationTiming(width);
    const e = new SandEngine(width, height);
    e.load([{ x: width / 2, y: height / 10, color: [100, 130, 160, 255] }]); e.releaseAll();
    e.vx[0] = 3; // app divides grid-space swipe velocity by motionScale.
    const x = e.x[0], y = e.y[0];
    for (let i = 0; i < 1000 / timing.stepMs; i++) e.step();
    displacement.push({ fall: (e.y[0] - y) / height, push: (e.x[0] - x) / width });
  }
  assert.ok(Math.abs(displacement[0].fall - displacement[1].fall) < 0.025, JSON.stringify(displacement));
  // Same impulse has the same visible speed; friction dissipates over more
  // high-resolution steps, so compare the first 100ms rather than total travel.
  const first100ms = [];
  for (const quality of ['standard', 'high']) {
    const { width, height } = QUALITIES[quality], timing = simulationTiming(width);
    const e = new SandEngine(width, height); e.load([{ x: width / 2, y: height / 10, color: [0, 0, 0, 255] }]); e.releaseAll();
    const x = e.x[0];
    for (let i = 0; i < Math.round(100 / timing.stepMs); i++) { e.vx[0] = 3; e.step(); }
    first100ms.push((e.x[0] - x) / width);
  }
  assert.ok(Math.abs(first100ms[0] - first100ms[1]) < 0.01, JSON.stringify(first100ms));
  assert.equal(simulationTiming(180).maxSteps, 4); assert.equal(simulationTiming(270).maxSteps, 6);
});

test('high resolution collapse, swipe, gravity changes and reset conserve all 39,440 particles', () => {
  const e = fixture('high'), color = e.colors.slice(), x = e.x.slice(), y = e.y.slice();
  e.releaseAll();
  for (let i = 0; i < 450; i++) {
    if (i % 90 === 0) {
      e.setGravity(...[[0, 1], [1, 0], [0, -1], [-1, 0], [0, 1]][i / 90]);
      e.brushSegment(30, 250, 240, 350, 18, 4, -2);
    }
    e.step(); if (i % 30 === 0) assert.ok(e.assertIntegrity());
  }
  assert.equal(e.count, 39440); assert.equal(e.fixedCount, 0); e.reset();
  assert.deepEqual(e.x, x); assert.deepEqual(e.y, y); assert.deepEqual(e.colors, color);
  assert.equal(e.fixedCount, 39440); assert.ok(e.assertIntegrity());
});
