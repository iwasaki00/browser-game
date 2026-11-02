const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Paint = require('../paint.js');

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
  const offscreens = [];
  function offscreen() {
    const operations = [];
    let pixels = new Uint8ClampedArray(Paint.WIDTH * Paint.HEIGHT * 4);
    const target = { width: 0, height: 0, operations };
    const context = {
      globalCompositeOperation: 'source-over',
      clearRect() { pixels.fill(0); operations.push(['clear']); },
      drawImage(image, ...args) {
        if (image.source?.startsWith('blob:')) target.source = image.source;
        operations.push(['draw', this.globalCompositeOperation, image, ...args]);
        if (image.source === 'assets/kakureron.svg') {
          // Synthetic mask: a central strip with transparent space on both sides.
          for (let y = 0; y < Paint.HEIGHT; y++) for (let x = 80; x < 304; x++) pixels[(y * Paint.WIDTH + x) * 4 + 3] = 255;
        } else pixels[0]++;
      },
      getImageData(x, y, width, height) {
        if (width === 1 && height === 1) return { data: new Uint8ClampedArray([185, 140, 98, 255]) };
        return { data: new Uint8ClampedArray(pixels), width, height };
      },
      putImageData(image) { pixels = new Uint8ClampedArray(image.data); operations.push(['restore', pixels[0]]); },
      beginPath() {}, moveTo(x, y) { operations.push(['move', x, y]); },
      lineTo(x, y) { operations.push(['line', x, y]); },
      stroke() { operations.push(['stroke', this.lineWidth, this.strokeStyle]); },
      arc(x, y, radius) { operations.push(['arc', x, y, radius]); },
      fill() { operations.push(['fill', this.fillStyle]); }
    };
    target.getContext = () => context;
    offscreens.push(target);
    return target;
  }
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      handlers: {}, disabled: true, hidden: true, value: '', textContent: '', files: [],
      clientWidth: 400, clientHeight: 400,
      classList: { add() {}, remove() {} }, dataset: {}, style: {},
      setAttribute(name, value) { this[name] = value; },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      click() { return this.handlers.click?.({}); },
      getContext() { return context; },
      getBoundingClientRect() { return { left: 0, top: 0 }; },
      hasPointerCapture(id) { return captures.has(id); },
      setPointerCapture(id) { captures.add(id); }, releasePointerCapture(id) { captures.delete(id); }
    });
    return elements.get(id);
  }
  const modes = ['place', 'pick', 'paint', 'erase'].map(mode => { const button = element(`mode-${mode}`); button.dataset.mode = mode; return button; });
  const brushes = ['small', 'medium', 'large'].map(brush => { const button = element(`brush-${brush}`); button.dataset.brush = brush; return button; });
  const buttons = ['smaller', 'larger', 'rotate-left', 'rotate-right', 'reset', 'undo', 'redo'].map(element).concat(modes, brushes);
  Object.assign(element('loupe').getContext(), { fillRect() {}, strokeRect() {} });
  const document = {
    documentElement: { dataset: {} }, hidden: false, addEventListener() {},
    createElement: offscreen,
    querySelector(selector) { return element(selector.slice(1)); },
    querySelectorAll(selector) { return selector === '[data-mode]' ? modes : selector === '[data-brush]' ? brushes : buttons; }
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
    document, Image, KakureronPaint: Paint, window: { devicePixelRatio: 2, addEventListener() {} },
    URL: { createObjectURL: file => `blob:${file.name}`, revokeObjectURL() { revoked++; } },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  });
  async function load(name = 'photo') {
    element('image-input').files = [{ name }];
    await element('image-input').handlers.change();
  }
  function pointer(type, id, x, y) {
    element('canvas').handlers[type]({ type, pointerId: id, clientX: x, clientY: y,
      pointerType: 'touch', button: 0, preventDefault() {} });
  }
  return { element, draws, load, pointer, offscreens, resize: () => resize(), captures, revoked: () => revoked };
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
  image.width = 300;
  image.height = 900;
  app.resize();
  assert.ok(Math.abs(app.draws[0].rect[2] / app.draws[0].rect[3] - 1 / 3) < 1e-9);
  assert.equal(app.draws[0].rect[3], 400);
  image.height = 300;
  app.resize();
  assert.deepEqual(Array.from(app.draws[0].rect), [0, 0, 400, 400]);
});

test('eyedropper samples original photo beneath character, loupe and mode isolation', async () => {
  const app = setup();
  await app.load();
  app.element('mode-pick').click();
  app.pointer('pointerdown', 1, 200, 200);
  assert.equal(app.element('color-value').textContent, '#B98C62');
  assert.equal(app.element('loupe').hidden, false);
  assert.equal(app.element('mode-pick')['aria-pressed'], 'true');
  assert.equal(app.element('placement-controls').hidden, true);
  app.pointer('pointermove', 1, 240, 220);
  assert.deepEqual(Array.from(app.draws[1].position), [200, 200]);
  app.pointer('pointerup', 1, 240, 220);
  assert.equal(app.element('loupe').hidden, true);
  assert.equal(app.captures.size, 0);
  app.element('mode-paint').click();
  assert.equal(app.element('brush-controls').hidden, false);
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointermove', 1, 202, 201);
  assert.deepEqual(Array.from(app.draws[1].position), [200, 200]);
  app.element('mode-place').click();
  assert.equal(app.element('undo').disabled, false);
  assert.equal(app.captures.size, 0);
});

test('paint and eraser stamps are masked, history is per stroke, undo/redo and reset', async () => {
  const app = setup();
  await app.load();
  const [layer, mask, stamp] = app.offscreens;
  app.element('mode-paint').click();
  app.element('brush-large').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointermove', 1, 205, 201);
  app.pointer('pointerup', 1, 205, 201);
  assert.ok(stamp.operations.some(op => op[0] === 'arc' && op[3] === Paint.BRUSHES.large / 2));
  assert.ok(stamp.operations.some(op => op[0] === 'draw' && op[1] === 'destination-in' && op[2] === mask));
  assert.ok(layer.operations.some(op => op[0] === 'draw' && op[1] === 'source-over' && op[2] === stamp));
  app.element('undo').click();
  assert.equal(app.element('undo').disabled, true); // all moves are one history entry
  assert.equal(app.element('redo').disabled, false);
  assert.equal(layer.operations.at(-1)[1], 0);
  app.element('redo').click();
  assert.ok(layer.operations.at(-1)[1] > 0);
  app.element('mode-erase').click();
  app.pointer('pointerdown', 2, 200, 200);
  app.pointer('pointerup', 2, 200, 200);
  assert.ok(layer.operations.some(op => op[0] === 'draw' && op[1] === 'destination-out'));
  app.element('undo').click();
  assert.equal(app.element('redo').disabled, false);
  app.element('mode-paint').click();
  app.pointer('pointerdown', 3, 200, 200);
  app.pointer('pointerup', 3, 200, 200);
  assert.equal(app.element('redo').disabled, true);
  app.element('reset').click();
  assert.equal(app.element('undo').disabled, true);
  assert.equal(app.element('redo').disabled, true);
  assert.equal(layer.operations.at(-1)[0], 'clear');
  assert.equal(app.draws[0].image.source, 'blob:photo');
});

test('outside entry and reentry do not join stray lines, cancellation and replacement clear state', async () => {
  const app = setup();
  await app.load();
  app.element('mode-paint').click();
  const [layer, , stamp] = app.offscreens;
  const before = layer.operations.length;
  app.pointer('pointerdown', 1, 10, 200);
  app.pointer('pointermove', 1, 20, 200);
  assert.equal(layer.operations.length, before);
  app.pointer('pointermove', 1, 200, 200);
  app.pointer('pointermove', 1, 10, 200);
  app.pointer('pointermove', 1, 200, 200);
  assert.equal(stamp.operations.filter(op => op[0] === 'line').length, 0);
  app.pointer('pointercancel', 1, 200, 200);
  assert.equal(app.captures.size, 0);
  assert.equal(app.element('undo').disabled, false);
  await app.load('second');
  assert.equal(app.element('undo').disabled, true);
  assert.equal(app.element('redo').disabled, true);
  assert.equal(app.element('mode-place')['aria-pressed'], 'true');
});

test('history is bounded to 25 strokes', async () => {
  const app = setup();
  await app.load();
  app.element('mode-paint').click();
  for (let i = 0; i < 30; i++) {
    app.pointer('pointerdown', 1, 200, 200);
    app.pointer('pointerup', 1, 200, 200);
  }
  for (let i = 0; i < 24; i++) app.element('undo').click();
  assert.equal(app.element('undo').disabled, false);
  app.element('undo').click();
  assert.equal(app.element('undo').disabled, true);
});

test('inverse coordinates match translation, rotation and scale; background excludes letterbox', () => {
  const fit = { x: 12, y: 80, width: 320, height: 160 };
  for (const size of [0.05, 0.18, 0.6]) for (const angle of [0, Math.PI / 2, -1.2]) {
    const character = { x: 0.62, y: 0.3, size, angle };
    const local = { x: 220, y: 100 };
    const x = (local.x - Paint.WIDTH / 2) * size * fit.width / Paint.WIDTH;
    const y = (local.y - Paint.HEIGHT / 2) * size * fit.width / Paint.WIDTH;
    const point = { x: fit.x + character.x * fit.width + x * Math.cos(angle) - y * Math.sin(angle),
      y: fit.y + character.y * fit.height + x * Math.sin(angle) + y * Math.cos(angle) };
    const actual = Paint.screenToLocal(point, character, fit);
    assert.ok(Math.abs(actual.x - local.x) < 1e-8);
    assert.ok(Math.abs(actual.y - local.y) < 1e-8);
  }
  assert.equal(Paint.backgroundPoint({ x: 20, y: 20 }, fit, 2048, 1024), null);
  assert.deepEqual(Paint.backgroundPoint({ x: 172, y: 160 }, fit, 2048, 1024), { x: 1024, y: 512 });
});
