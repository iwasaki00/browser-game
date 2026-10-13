const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

// Geometry doubles verify sizing and coordinates, not browser layout or physics.
function setup(width, height, dpr = 2) {
  const rect = { left: 10, top: 20, width, height };
  const transforms = [];
  const captures = new Set();
  const canvas = {
    width: 0, height: 0,
    getBoundingClientRect: () => rect,
    getContext: () => ({ setTransform: (...args) => transforms.push(args) }),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
    classList: { remove() {} }, addEventListener() {},
  };
  const element = { addEventListener() {}, classList: { add() {}, remove() {} } };
  const sandbox = {
    Matter: {
      Engine: { create: () => ({ world: {} }) }, World: { add() {}, remove() {} },
      Bodies: { rectangle: (...args) => ({ args }) },
      Body: { setPosition: (body, position) => { body.position = position; } },
      Composite: {}, Events: { on() {} }, Vector: {},
    },
    document: { getElementById: id => id === 'gameCanvas' ? canvas : element },
    window: { devicePixelRatio: dpr, addEventListener() {}, visualViewport: { addEventListener() {} } },
    ResizeObserver: class { constructor(callback) { sandbox.observer = callback; } observe(target) { sandbox.observed = target; } },
  };
  const startup = '  resizeCanvas();\n  resetGame();\n  render();\n  rafId = window.requestAnimationFrame(loop);';
  assert.ok(source.includes(startup));
  const instrumented = source.replace(startup,
    '  globalThis.api = { resizeCanvas, toWorldPoint,' +
    'setBodies(p, e = [], i = []) { player = p; enemies = e; items = i; },' +
    'startGesture(id) { pointerState.active = true; pointerState.id = id; },' +
    'state() { return { worldWidth, worldHeight, walls, pointerState }; } };');
  vm.runInNewContext(instrumented, sandbox);
  return { ...sandbox, rect, canvas, transforms, captures };
}

for (const [width, height] of [[298, 360], [353, 470], [368, 640], [408, 720], [1200, 700]]) {
  test('CSS and drawing coordinates agree at ' + width + 'x' + height, () => {
    const env = setup(width, height);
    env.api.resizeCanvas();
    assert.equal(env.api.state().worldWidth, width);
    assert.equal(env.api.state().worldHeight, height);
    assert.equal(env.canvas.width, width * 2);
    assert.equal(env.canvas.height, height * 2);
    const point = env.api.toWorldPoint({ clientX: 10 + width / 2, clientY: 20 + height / 2 });
    assert.equal(point.x, width / 2);
    assert.equal(point.y, height / 2);
    assert.equal(env.api.state().walls.length, 4);
  });
}

test('fractional CSS sizes use the exact backing-store transform', () => {
  const env = setup(297.25, 365.5, 1.5);
  env.api.resizeCanvas();
  const transform = env.transforms.at(-1);
  assert.equal(transform[0], env.canvas.width / env.rect.width);
  assert.equal(transform[3], env.canvas.height / env.rect.height);
  env.api.resizeCanvas();
  assert.equal(env.transforms.length, 1);
});

test('rotation contains all body types and releases the old drag', () => {
  const env = setup(800, 600);
  env.api.resizeCanvas();
  const bodies = [24, 30, 14].map(radius => ({ circleRadius: radius, position: { x: 760, y: 560 }, velocity: { x: 3, y: -2 } }));
  env.api.setBodies(bodies[0], [bodies[1]], [bodies[2]]);
  env.api.startGesture(7);
  env.captures.add(7);
  env.rect.width = 298;
  env.rect.height = 350;
  env.observer();
  for (const body of bodies) {
    assert.ok(body.position.x + body.circleRadius <= 298);
    assert.ok(body.position.y + body.circleRadius <= 350);
    assert.deepEqual(body.velocity, { x: 3, y: -2 });
  }
  assert.equal(env.api.state().pointerState.active, false);
  assert.equal(env.captures.size, 0);
  assert.equal(env.observed, env.canvas);
});

test('hidden canvas is ignored and oversized bodies are centered', () => {
  const env = setup(298, 350);
  env.api.resizeCanvas();
  env.rect.width = 0;
  env.api.resizeCanvas();
  assert.equal(env.api.state().worldWidth, 298);
  const body = { circleRadius: 200, position: { x: 999, y: -999 } };
  env.api.setBodies(body);
  env.rect.width = 100;
  env.rect.height = 80;
  env.api.resizeCanvas();
  assert.equal(body.position.x, 50);
  assert.equal(body.position.y, 40);
});
