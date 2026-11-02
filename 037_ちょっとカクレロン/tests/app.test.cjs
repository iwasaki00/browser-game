const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const elements = new Map();
  const draws = [];
  const captures = new Set();
  let resize;
  let lastTranslation;
  let lastRotation;
  const context = {
    setTransform() {}, clearRect() { draws.length = 0; }, save() {}, restore() {},
    beginPath() {}, rect() {}, clip() {},
    translate(x, y) { lastTranslation = [x, y]; }, rotate(angle) { lastRotation = angle; },
    drawImage(image, ...rect) { draws.push({ image, rect, position: lastTranslation, angle: lastRotation }); }
  };
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      handlers: {}, disabled: true, hidden: true, value: '', textContent: '', files: [],
      clientWidth: 400, clientHeight: 400,
      classList: { add() {}, remove() {} },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      click() { return this.handlers.click?.({}); },
      getContext() { return context; },
      getBoundingClientRect() { return { left: 0, top: 0 }; },
      hasPointerCapture(id) { return captures.has(id); },
      setPointerCapture(id) { captures.add(id); }, releasePointerCapture(id) { captures.delete(id); }
    });
    return elements.get(id);
  }
  const buttons = ['smaller', 'larger', 'rotate-left', 'rotate-right', 'reset'].map(element);
  const document = {
    documentElement: { dataset: {} }, hidden: false, addEventListener() {},
    querySelector(selector) { return element(selector.slice(1)); }, querySelectorAll() { return buttons; }
  };
  let revoked = 0;
  class Image {
    complete = true;
    naturalWidth = 800;
    naturalHeight = 400;
    set src(value) {
      this.source = value;
      queueMicrotask(() => value === 'blob:bad' ? this.onerror?.() : this.onload?.());
    }
  }
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), {
    document, Image, window: { devicePixelRatio: 2, addEventListener() {} },
    URL: { createObjectURL: file => `blob:${file.name}`, revokeObjectURL() { revoked++; } },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  });
  async function load(name = 'photo') {
    element('image-input').files = [{ name }];
    await element('image-input').handlers.change();
  }
  function pointer(type, id, x, y) {
    element('canvas').handlers[type]({ pointerId: id, clientX: x, clientY: y,
      pointerType: 'touch', button: 0, preventDefault() {} });
  }
  return { element, draws, load, pointer, resize: () => resize(), captures, revoked: () => revoked };
}

test('image FIT, size limits, rotation, reset, replacement and decode failure', async () => {
  const app = setup();
  await app.load();
  assert.equal(app.element('canvas').hidden, false);
  assert.deepEqual(Array.from(app.draws[0].rect), [0, 100, 400, 200]);
  assert.deepEqual(Array.from(app.draws[1].position), [200, 200]);
  assert.equal(app.draws[1].rect[2], 72);
  app.element('larger').click();
  assert.equal(app.element('size-value').textContent, '20%');
  app.element('rotate-right').click();
  assert.equal(app.element('angle-value').textContent, '5°');
  for (let i = 0; i < 50; i++) app.element('larger').click();
  assert.equal(app.element('size-value').textContent, '60%');
  assert.equal(app.element('larger').disabled, true);
  for (let i = 0; i < 50; i++) app.element('smaller').click();
  assert.equal(app.element('size-value').textContent, '5%');
  assert.equal(app.element('smaller').disabled, true);
  app.element('reset').click();
  assert.equal(app.element('size-value').textContent, '18%');
  assert.equal(app.element('angle-value').textContent, '0°');
  app.element('rotate-left').click();
  await app.load('second');
  assert.equal(app.element('angle-value').textContent, '0°');
  assert.equal(app.draws[0].image.source, 'blob:second');
  await app.load('bad');
  assert.match(app.element('status').textContent, /読み込めません/);
  assert.equal(app.draws[0].image.source, 'blob:second');
  assert.equal(app.revoked(), 3);
});

test('one finger drag, two finger pinch/rotation, transition, cancellation and resize', async () => {
  const app = setup();
  await app.load();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointermove', 1, 240, 220);
  assert.deepEqual(Array.from(app.draws[1].position), [240, 220]);
  app.pointer('pointerdown', 2, 280, 220);
  app.pointer('pointermove', 2, 240, 300);
  assert.equal(app.element('size-value').textContent, '36%');
  assert.equal(app.element('angle-value').textContent, '90°');
  app.pointer('pointerup', 2, 240, 300);
  const before = Array.from(app.draws[1].position);
  app.pointer('pointermove', 1, 250, 230);
  assert.deepEqual(Array.from(app.draws[1].position), [before[0] + 10, before[1] + 10]);
  app.pointer('pointercancel', 1, 250, 230);
  assert.equal(app.captures.size, 0);
  const position = Array.from(app.draws[1].position);
  app.pointer('pointermove', 1, 300, 300);
  assert.deepEqual(Array.from(app.draws[1].position), position);
  app.element('stage').clientWidth = 200;
  app.element('stage').clientHeight = 200;
  app.resize();
  assert.deepEqual(Array.from(app.draws[1].position), position.map(value => value / 2));
  assert.equal(app.element('size-value').textContent, '36%');
});

test('portrait and square backgrounds retain aspect ratio', async () => {
  const app = setup();
  await app.load();
  const image = app.draws[0].image;
  image.naturalWidth = 300;
  image.naturalHeight = 900;
  app.resize();
  assert.ok(Math.abs(app.draws[0].rect[2] / app.draws[0].rect[3] - 1 / 3) < 1e-9);
  assert.equal(app.draws[0].rect[3], 400);
  image.naturalHeight = 300;
  app.resize();
  assert.deepEqual(Array.from(app.draws[0].rect), [0, 0, 400, 400]);
});
