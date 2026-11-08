const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Paint = require('../paint.js');
const Export = require('../export.js');
const Poses = require('../poses.js');
const Copy = require('../copy-brush.js');
const View = require('../editor-view.js');

function setup(options = {}) {
  const elements = new Map();
  const draws = [];
  const captures = new Set();
  const encodings = [];
  const downloads = [];
  const urlBlobs = new Map();
  const navigator = options.navigator || {};
  const windowHandlers = {};
  const documentHandlers = {};
  const frames = new Map();
  let frameId = 0, frameClock = 0;
  function nextFrame(delta = 100) {
    frameClock += delta;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(frameClock));
  }
  function requestFrame(callback) {
    const id = ++frameId; frames.set(id, callback);
    if (options.autoFrames) queueMicrotask(() => { if (frames.has(id)) { frames.delete(id); frameClock += 16; callback(frameClock); } });
    return id;
  }
  let resize;
  let lastTranslation;
  let lastRotation;
  const context = {
    setTransform() {}, clearRect() { draws.length = 0; }, save() {}, restore() {},
    beginPath() {}, rect() {}, clip() {},
    translate(x, y) { lastTranslation = [x, y]; }, rotate(angle) { lastRotation = angle; },
    drawImage(image, ...rect) { draws.push({ image, rect, position: lastTranslation, angle: lastRotation, alpha: this.globalAlpha }); }
  };
  const offscreens = [];
  function offscreen() {
    const operations = [];
    let pixels = new Uint8ClampedArray(Paint.WIDTH * Paint.HEIGHT * 4);
    const target = { width: 0, height: 0, operations };
    const ensurePixels = () => {
      if (pixels.length !== target.width * target.height * 4) pixels = new Uint8ClampedArray(target.width * target.height * 4);
    };
    const context = {
      globalCompositeOperation: 'source-over',
      clearRect() { ensurePixels(); pixels.fill(0); operations.push(['clear']); },
      drawImage(image, ...args) {
        if (image.source === `blob:${options.failPhotoDraw}`) { target.photoFailure=true; throw new Error('Injected photo draw failure'); }
        ensurePixels();
        if (image.source?.startsWith('blob:')) target.source = image.source;
        operations.push(['draw', this.globalCompositeOperation, image, ...args]);
        if (this.globalAlpha !== undefined) operations.push(['alpha', this.globalAlpha]);
        if (Poses.list.some(pose => pose.silhouette === image.source)) {
          // Synthetic mask: a central strip with transparent space on both sides.
          if (image.source !== options.emptyPose) for (let y = 0; y < target.height; y++) for (let x = 80; x < 304; x++) pixels[(y * target.width + x) * 4 + 3] = 255;
          target.maskPixels = new Uint8ClampedArray(pixels);
        } else if (image.maskPixels && this.globalCompositeOperation === 'source-over') {
          pixels.set(image.maskPixels.subarray(0, pixels.length));
          target.maskPixels = new Uint8ClampedArray(pixels);
        } else if (this.globalCompositeOperation === 'destination-out') pixels.fill(0);
        else if (this.globalCompositeOperation !== 'destination-in') { pixels[0]++; pixels[3] = 255; }
      },
      getImageData(x, y, width, height) {
        ensurePixels();
        target.reads = (target.reads || 0) + 1;
        if (width === 1 && height === 1) return { data: new Uint8ClampedArray([185, 140, 98, 255]) };
        return { data: new Uint8ClampedArray(pixels), width, height };
      },
      putImageData(image) { pixels = new Uint8ClampedArray(image.data); operations.push(['restore', pixels[0]]); },
      setTransform(...args) { operations.push(['transform', ...args]); },
      save() {}, restore() {}, rect(...args) { operations.push(['clipRect', ...args]); }, clip() {},
      translate(...args) { operations.push(['translate', ...args]); }, rotate(angle) { operations.push(['rotate', angle]); },
      strokeRect(...args) { operations.push(['strokeRect', this.strokeStyle, ...args]); },
      fillRect(...args) { operations.push(['fillRect', this.fillStyle, ...args]); },
      fillText(...args) { operations.push(['text', ...args]); },
      beginPath() {}, moveTo(x, y) { operations.push(['move', x, y]); },
      lineTo(x, y) { operations.push(['line', x, y]); },
      stroke() { operations.push(['stroke', this.lineWidth, this.strokeStyle]); },
      arc(x, y, radius) { operations.push(['arc', x, y, radius]); },
      fill() { operations.push(['fill', this.fillStyle]); }
    };
    target.getContext = () => context;
    target.toBlob = (callback, type) => {
      const sources = operations.filter(op => op[0] === 'draw').map(op => op[2].source || 'paint-layer').join('|');
      const encoding = { type, width: target.width, height: target.height, operations: [...operations],
        complete: () => callback(options.failEncoding ? null : new Blob([`synthetic PNG for API control-flow testing:${sources}`], { type })) };
      encodings.push(encoding);
      if (!options.deferEncoding) queueMicrotask(encoding.complete);
    };
    offscreens.push(target);
    return target;
  }
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      handlers: {}, disabled: true, hidden: true, value: '', textContent: '', files: [],
      clientWidth: 400, clientHeight: 400,
      classList: { add() {}, remove() {} }, dataset: {}, style: {},
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; }, focus() {},
      open: false, showModal() { this.open = true; }, close() { this.open = false; },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      click() { return this.handlers.click?.({}); },
      getContext() { return context; },
      getBoundingClientRect() { return { left: 0, top: 0 }; },
      hasPointerCapture(id) { return captures.has(id); },
      setPointerCapture(id) { captures.add(id); }, releasePointerCapture(id) { captures.delete(id); }
    });
    return elements.get(id);
  }
  const modes = ['place', 'pick', 'paint', 'erase', 'copy'].map(mode => { const button = element(`mode-${mode}`); button.dataset.mode = mode; return button; });
  const brushes = ['small', 'medium', 'large'].map(brush => { const button = element(`brush-${brush}`); button.dataset.brush = brush; return button; });
  const poses = Poses.list.map(pose => { const button = element(`pose-${pose.poseId}`); button.dataset.pose = pose.poseId; return button; });
  const opacities = Copy.OPACITIES.map(opacity => { const button = element(`opacity-${opacity}`); button.dataset.opacity = String(opacity); return button; });
  const zooms = View.ZOOM_LEVELS.map(zoom => { const button = element(`zoom-${zoom}`); button.dataset.zoom = String(zoom); return button; });
  const buttons = ['smaller', 'larger', 'rotate-left', 'rotate-right', 'reset', 'undo', 'redo', 'toggle-poses', 'select-copy-source', 'open-zoom'].map(element).concat(modes, brushes, poses, opacities);
  Object.assign(element('loupe').getContext(), { fillRect() {}, strokeRect() {} });
  const document = {
    documentElement: { dataset: {} }, hidden: false, addEventListener(type,handler) { documentHandlers[type]=handler; },
    body: { append() {} },
    createElement(tag) {
      if (tag === 'a') return { click() {
        if (options.failDownload) throw new Error('Download blocked');
        downloads.push({ href: this.href, download: this.download });
      }, remove() {} };
      return offscreen();
    },
    querySelector(selector) { return element(selector.slice(1)); },
    querySelectorAll(selector) { return selector === '[data-mode]' ? modes : selector === '[data-brush]' ? brushes : selector === '[data-pose]' ? poses : selector === '[data-opacity]' ? opacities : selector === '[data-zoom]' ? zooms : buttons; }
  };
  let revoked = 0;
  class Image {
    complete = true;
    naturalWidth = options.imageWidth || 800;
    naturalHeight = options.imageHeight || 400;
    set src(value) {
      this.source = value;
      queueMicrotask(() => value === 'blob:bad' || value === options.failPose ? this.onerror?.() : this.onload?.());
    }
  }
  if (options.initialFiles) element('image-input').files = options.initialFiles;
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), {
    document, Image, KakureronPaint: Paint, KakureronExport: Export, KakureronPoses: Poses, KakureronCopy: Copy, KakureronView: View, navigator,
    Blob, File, isSecureContext: options.secureContext !== false,
    window: { devicePixelRatio: 2, addEventListener(type,handler) { windowHandlers[type]=handler; }, matchMedia: () => ({matches:options.reducedMotion!==false}) },
    requestAnimationFrame: requestFrame, cancelAnimationFrame: id => frames.delete(id),
    URL: { createObjectURL: file => {
      const url = file.name ? `blob:${file.name}` : `blob:output-${urlBlobs.size + 1}`;
      urlBlobs.set(url, file);
      return url;
    }, revokeObjectURL() { revoked++; } },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  });
  async function load(name = 'photo') {
    element('image-input').files = [{ name }];
    await element('image-input').handlers.change();
  }
  function pointer(type, id, x, y, settings = {}) {
    element('canvas').handlers[type]({ type, pointerId: id, clientX: x, clientY: y,
      pointerType: 'touch', button: 0, preventDefault() {}, ...settings });
  }
  return { element, draws, load, pointer, offscreens, encodings, downloads, urlBlobs, navigator,
    resize: () => resize(), captures, revoked: () => revoked, frame:nextFrame, frames, windowHandlers, documentHandlers, document };
}

test('a photo selected before app initialization is consumed once initialization completes', async () => {
  const app=setup({initialFiles:[{name:'early-selection'}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.element('canvas').hidden,false);
  assert.equal(app.draws[0].image.source,'blob:early-selection');
  assert.equal(app.element('image-input').value,'');
  assert.equal(app.document.documentElement.dataset.appReady,'true');
});

test('photo draw failure preserves photo, transform, paint/history and pending confirmation', async () => {
  const options = {}, app = setup(options);
  await app.load('first');
  app.element('larger').click();
  app.element('mode-paint').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointerup',1,202,200);
  const oldPhoto=app.draws[0].image, dimensions=[oldPhoto.width,oldPhoto.height];
  app.element('toggle-poses').click();await app.element('pose-P04').click();
  assert.equal(app.element('change-confirm').open,true);
  const revoked=app.revoked();options.failPhotoDraw='failed';
  await app.load('failed');
  assert.match(app.element('status').textContent,/読み込めません/);
  assert.deepEqual([oldPhoto.width,oldPhoto.height],dimensions);
  assert.equal(app.element('change-confirm').open,true);
  assert.equal(app.element('size-value').textContent,'20%');
  assert.equal(app.revoked(),revoked+1);
  app.element('cancel-change').click();assert.equal(app.element('undo').disabled,false);
  await app.element('open-preview').click();
  const photoDraw=app.encodings.at(-1).operations.find(op=>op[0]==='draw');
  assert.equal(photoDraw[2],oldPhoto);
  assert.equal(app.offscreens.filter(c=>c.photoFailure).length,1);
  assert.ok(app.offscreens.filter(c=>c.photoFailure).every(c=>c.width===1&&c.height===1));
  const cached=app.element('preview-image').src,revokedBefore=app.revoked();
  await app.load('failed');
  assert.equal(app.element('preview-image').src,cached);
  assert.equal(app.element('preview-screen').hidden,false);
  assert.equal(app.revoked(),revokedBefore+1);
});

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
  app.element('confirm-change').click();
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
  assert.equal(app.element('undo').disabled, true); // cancelled drawing rolls back instead of committing
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

test('preview locks editing and shares its exact PNG with save; answer is a separate composition', async () => {
  const app = setup();
  await app.load();
  app.element('rotate-right').click();
  app.element('larger').click();
  app.element('mode-paint').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointerup', 1, 200, 200);
  const historyWasEnabled = !app.element('undo').disabled;
  const placement = Array.from(app.draws[1].position);
  await app.element('open-preview').click();
  assert.equal(app.element('editor-workspace').hidden, true);
  assert.equal(app.element('editor-controls').hidden, true);
  assert.equal(app.element('preview-image').hidden, false);
  assert.equal(app.encodings.length, 1);
  const question = app.encodings[0];
  assert.equal(question.type, 'image/png');
  assert.equal(question.width, 800);
  assert.equal(question.height, 400);
  assert.equal(question.operations.filter(op => op[0] === 'strokeRect').length, 0);
  const translation = question.operations.find(op => op[0] === 'translate');
  assert.deepEqual(translation.slice(1), [400, 200]);
  const rotation = question.operations.find(op => op[0] === 'rotate')[1];
  assert.ok(Math.abs(rotation - 5 * Math.PI / 180) < 1e-9);
  assert.ok(question.operations.some(op => op[0] === 'draw' && op[2] === app.offscreens[0]));
  assert.equal(app.offscreens.at(-1).width, 1);
  app.element('larger').click();
  app.element('reset').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointermove', 1, 250, 200);
  assert.equal(app.captures.size, 0);
  const questionURL = app.element('preview-image').src;
  app.element('save-question').click();
  assert.equal(app.downloads[0].href, questionURL);
  assert.match(app.downloads[0].download, /^kakureron_question_\d{8}_\d{6}\.png$/);
  await app.element('show-answer').click();
  assert.equal(app.encodings.length, 2);
  assert.equal(app.encodings[1].operations.filter(op => op[0] === 'strokeRect').length, 2);
  assert.ok(app.encodings[1].operations.some(op => op[0] === 'text' && op[1] === 'ここ！'));
  const answerURL = app.element('preview-image').src;
  assert.notEqual(questionURL, answerURL);
  app.element('save-answer').click();
  assert.equal(app.downloads[1].href, answerURL);
  assert.match(app.downloads[1].download, /^kakureron_answer_\d{8}_\d{6}\.png$/);
  assert.notEqual(app.downloads[0].download, app.downloads[1].download);
  await app.element('show-question').click();
  assert.equal(app.element('preview-image').src, questionURL);
  assert.equal(app.encodings.length, 2);
  app.element('back-to-edit').click();
  assert.equal(app.element('editor-controls').hidden, false);
  assert.equal(!app.element('undo').disabled, historyWasEnabled);
  assert.deepEqual(Array.from(app.draws[1].position), placement);
  assert.equal(app.element('size-value').textContent, '20%');
  assert.equal(app.element('angle-value').textContent, '5°');
  assert.equal(app.revoked(), 3); // selected photo and the two output URLs
});

test('sharing uses a prepared PNG File immediately, suppresses duplicate clicks and treats cancel normally', async () => {
  let shares = [];
  let rejectShare;
  const app = setup({ navigator: {
    canShare: ({ files }) => files.length === 1 && files[0].type === 'image/png',
    share(data) { shares.push(data); return new Promise((resolve, reject) => { rejectShare = reject; }); }
  } });
  await app.load();
  await app.element('open-preview').click();
  const encodedBeforeShare = app.encodings.length;
  const pending = app.element('share-question').click();
  assert.equal(shares.length, 1); // share called in the same activation, without awaiting encoding
  assert.ok(shares[0].files[0] instanceof File);
  assert.match(shares[0].files[0].name, /^kakureron_question_/);
  assert.equal(await shares[0].files[0].text(), await app.urlBlobs.get(app.element('preview-image').src).text());
  await app.element('share-question').click();
  assert.equal(shares.length, 1);
  rejectShare({ name: 'AbortError' });
  await pending;
  assert.equal(app.element('status').textContent, '');
  assert.equal(app.element('share-question').disabled, false);
  assert.equal(app.encodings.length, encodedBeforeShare);
});

test('unsupported sharing offers save; empty image and encode failure can recover', async () => {
  const options = { failEncoding: true };
  const app = setup(options);
  await app.element('open-preview').click();
  assert.match(app.element('status').textContent, /写真を選択/);
  assert.equal(app.encodings.length, 0);
  await app.load();
  await app.element('open-preview').click();
  assert.match(app.element('status').textContent, /画像を作成できません/);
  assert.equal(app.element('retry-preview').hidden, false);
  assert.equal(app.element('save-question').disabled, true);
  assert.equal(app.offscreens.at(-1).width, 1);
  options.failEncoding = false;
  await app.element('retry-preview').click();
  assert.equal(app.element('save-question').disabled, false);
  await app.element('share-question').click();
  assert.match(app.element('status').textContent, /画像を保存してから共有/);
  app.element('save-question').click();
  assert.equal(app.downloads.length, 1);
});

test('leaving a pending preview ignores stale results and image replacement produces fresh output', async () => {
  const app = setup({ deferEncoding: true });
  await app.load();
  const oldPreview = app.element('open-preview').click();
  await Promise.resolve();
  assert.equal(app.encodings.length, 1);
  await app.element('open-preview').click();
  assert.equal(app.encodings.length, 1);
  app.element('back-to-edit').click();
  app.encodings[0].complete();
  await oldPreview;
  assert.equal(app.element('preview-screen').hidden, true);
  assert.equal(app.element('preview-image').src, undefined);
  await app.load('replacement');
  const currentPreview = app.element('open-preview').click();
  await Promise.resolve();
  assert.equal(app.encodings.length, 2);
  app.encodings[1].complete();
  await currentPreview;
  const firstImage = app.encodings[1].operations.find(op => op[0] === 'draw')[2];
  assert.equal(firstImage.source, 'blob:replacement');
  assert.equal(app.element('preview-screen').hidden, false);
  assert.equal(app.element('save-question').disabled, false);
});

test('output dimensions cap at 2048 without upscaling and filenames use local clock fields', async () => {
  assert.deepEqual(Export.outputSize(6000, 4000), { width: 2048, height: 1365 });
  assert.deepEqual(Export.outputSize(4000, 6000), { width: 1365, height: 2048 });
  assert.deepEqual(Export.outputSize(480, 200), { width: 480, height: 200 });
  assert.throws(() => Export.outputSize(0, 0));
  assert.equal(Export.fileName('question', new Date(2026, 10, 3, 15, 30, 0)), 'kakureron_question_20261103_153000.png');
  const app = setup({ imageWidth: 6000, imageHeight: 4000 });
  await app.load();
  await app.element('open-preview').click();
  assert.equal(app.encodings[0].width, 2048);
  assert.equal(app.encodings[0].height, 1365);
});

test('share support requires secure context, File sharing and successful canShare', () => {
  const file = new File(['png'], 'question.png', { type: 'image/png' });
  const supported = { share() {}, canShare: () => true };
  assert.equal(Export.canShareFile(supported, true, file), true);
  assert.equal(Export.canShareFile(supported, false, file), false);
  assert.equal(Export.canShareFile({}, true, file), false);
  assert.equal(Export.canShareFile({ share() {}, canShare: () => false }, true, file), false);
  assert.equal(Export.canShareFile({ share() {}, canShare() { throw Error(); } }, true, file), false);
});

test('answer bounds include rotated rendering and remain within photo', () => {
  const rect = { x: 0, y: 0, width: 800, height: 400 };
  const bounds = Export.answerBounds({ x: 0.5, y: 0.5, size: 0.2, angle: Math.PI / 2 }, rect);
  assert.ok(bounds.width >= 240);
  assert.ok(bounds.height >= 160);
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - 400) < 1e-8);
  const edge = Export.answerBounds({ x: 1, y: 0, size: 0.6, angle: 0.7 }, rect);
  assert.ok(edge.x >= 0 && edge.y >= 0 && edge.x + edge.width <= 800 && edge.y + edge.height <= 400);
});

test('common compositor preserves normalized geometry and paint across editor and PNG sizes', () => {
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(['image', ...args]), save() {}, restore() {},
    beginPath() {}, rect: (...args) => calls.push(['clip', ...args]), clip() {},
    translate: (...args) => calls.push(['translate', ...args]), rotate: angle => calls.push(['rotate', angle]) };
  const scene = { background: {}, characterImage: {}, paintLayer: {}, character: { x: 0.73, y: 0.28, size: 0.31, angle: -0.62 } };
  const unchanged = JSON.stringify(scene.character);
  for (const rect of [{ x: 0, y: 88, width: 350, height: 210 }, { x: 0, y: 0, width: 2000, height: 1200 }]) {
    calls.length = 0;
    Export.drawScene(ctx, scene, rect);
    const translate = calls.find(call => call[0] === 'translate');
    assert.ok(Math.abs((translate[1] - rect.x) / rect.width - 0.73) < 1e-10);
    assert.ok(Math.abs((translate[2] - rect.y) / rect.height - 0.28) < 1e-10);
    assert.equal(calls.find(call => call[0] === 'rotate')[1], -0.62);
    const images = calls.filter(call => call[0] === 'image');
    assert.equal(images.length, 3);
    assert.equal(images[2][1], scene.paintLayer);
    assert.ok(Math.abs(images[2][4] / rect.width - 0.31) < 1e-10);
    assert.deepEqual(calls.find(call => call[0] === 'clip').slice(1), [rect.x, rect.y, rect.width, rect.height]);
  }
  assert.equal(JSON.stringify(scene.character), unchanged);
});

test('share and save exceptions keep a usable preview and allow retry', async () => {
  const options = { failDownload: true, navigator: { canShare: () => true, share: async () => { throw { name: 'NotAllowedError' }; } } };
  const app = setup(options);
  await app.load();
  await app.element('open-preview').click();
  await app.element('share-question').click();
  assert.match(app.element('status').textContent, /共有できませんでした/);
  assert.equal(app.element('share-question').disabled, false);
  app.element('save-question').click();
  assert.match(app.element('status').textContent, /保存を開始できません/);
  assert.equal(app.element('open-generated-image').hidden, false);
  options.failDownload = false;
  app.element('save-question').click();
  assert.equal(app.downloads.length, 1);
  assert.equal(app.element('preview-image').hidden, false);
});

test('pose assets have independent silhouettes and STAND remains byte compatible', () => {
  const crypto = require('node:crypto');
  const stand = fs.readFileSync(Poses.get('P01').silhouette, 'utf8').replace(/\r\n?/g, '\n').trim();
  assert.equal(crypto.createHash('sha256').update(stand).digest('hex'), '15f001cd50b0fbc5461af5ace0a81c1214b165413274270288a95ca930d2b3c4');
  assert.equal(Poses.list.length, 4);
  const assets = Poses.list.map(pose => fs.readFileSync(pose.silhouette, 'utf8'));
  assert.equal(new Set(assets).size, 4);
  Poses.list.forEach((pose, index) => {
    assert.ok(assets[index].includes(`viewBox="0 0 ${pose.referenceWidth} ${pose.referenceHeight}"`));
    assert.ok(!/transform=|https?:\/\/(?!www\.w3\.org)/.test(assets[index]));
  });
});

for (const pose of Poses.list) {
  test(`${pose.poseId} ${pose.english}: placement, pinch, rotation, three brushes, eraser, PNG and answer`, async () => {
    const app = setup();
    await app.load();
    app.element('toggle-poses').click();
    assert.equal(app.element('pose-options').hidden, false);
    await app.element(`pose-${pose.poseId}`).click();
    assert.equal(app.element('change-confirm').open, false);
    assert.equal(app.element(`pose-${pose.poseId}`)['aria-pressed'], 'true');
    assert.equal(app.draws[1].image.source, pose.silhouette);
    assert.ok(Math.abs(app.draws[1].rect[3] / app.draws[1].rect[2] - pose.ratio) < 1e-9);
    assert.equal(app.offscreens[0].height, Poses.rasterSize(pose).height);
    // The alpha-mask's transparent margin must not start a drag.
    app.pointer('pointerdown', 1, 165, 200);
    assert.equal(app.captures.size, 0);
    app.pointer('pointerdown', 1, 200, 200);
    app.pointer('pointermove', 1, 230, 210);
    assert.ok(Math.abs(app.draws[1].position[0] - 230) < 1e-8);
    assert.ok(Math.abs(app.draws[1].position[1] - 210) < 1e-8);
    app.pointer('pointerdown', 2, 270, 210);
    app.pointer('pointermove', 2, 230, 290);
    assert.equal(app.element('size-value').textContent, '36%');
    assert.equal(app.element('angle-value').textContent, '90°');
    app.pointer('pointerup', 2, 230, 290);
    app.pointer('pointerup', 1, 230, 210);
    app.element('larger').click();
    app.element('rotate-right').click();
    assert.equal(app.element('size-value').textContent, '38%');
    assert.equal(app.element('angle-value').textContent, '95°');
    const center = Array.from(app.draws[1].position);
    app.element('mode-pick').click();
    app.pointer('pointerdown', 1, ...center);
    app.pointer('pointerup', 1, ...center);
    assert.equal(app.element('color-value').textContent, '#B98C62');
    app.element('mode-paint').click();
    for (const brush of ['small', 'medium', 'large']) {
      app.element(`brush-${brush}`).click();
      app.pointer('pointerdown', 1, ...center);
      app.pointer('pointerup', 1, ...center);
    }
    const stamp = app.offscreens[2];
    for (const width of Object.values(Paint.BRUSHES)) assert.ok(stamp.operations.some(op => op[0] === 'arc' && op[3] === width / 2));
    assert.ok(stamp.operations.some(op => op[0] === 'fill' && op[1] === '#B98C62'));
    assert.ok(stamp.operations.some(op => op[0] === 'draw' && op[1] === 'destination-in'));
    app.element('mode-erase').click();
    app.pointer('pointerdown', 1, ...center);
    app.pointer('pointerup', 1, ...center);
    app.element('undo').click();
    app.element('redo').click();
    app.element('undo').click(); // retain colored paint for PNG
    await app.element('open-preview').click();
    const question = app.encodings.at(-1);
    assert.ok(question.operations.some(op => op[0] === 'draw' && op[2].source === pose.silhouette));
    assert.ok(question.operations.some(op => op[0] === 'rotate' && Math.abs(op[1] - 95 * Math.PI / 180) < 1e-9));
    assert.equal(question.operations.filter(op => op[0] === 'strokeRect').length, 0);
    await app.element('show-answer').click();
    assert.equal(app.encodings.at(-1).operations.filter(op => op[0] === 'strokeRect').length, 2);
    app.element('save-answer').click();
    assert.match(app.downloads[0].download, /kakureron_answer_/);
    app.element('back-to-edit').click();
    assert.equal(app.draws[1].image.source, pose.silhouette);
  });
}

test('painted pose change requires confirmation, cancel is lossless, confirm clears history and preserves transform', async () => {
  const app = setup();
  await app.load();
  app.element('larger').click();
  app.element('rotate-left').click();
  app.element('mode-paint').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointerup', 1, 200, 200);
  const previousOperations = app.offscreens[0].operations.length;
  await app.element('pose-P04').click();
  assert.equal(app.element('change-confirm').open, true);
  assert.equal(app.element('confirm-message').textContent, 'ポーズを変更すると、現在の塗装が消去されます。変更しますか？');
  assert.equal(app.draws[1].image.source, Poses.get('P01').silhouette);
  assert.equal(app.offscreens[0].operations.length, previousOperations);
  app.pointer('pointerdown', 1, 200, 200);
  assert.equal(app.captures.size, 0);
  await app.element('open-preview').click();
  assert.equal(app.encodings.length, 0);
  app.element('cancel-change').click();
  assert.equal(app.element('change-confirm').open, false);
  assert.equal(app.offscreens[0].operations.length, previousOperations);
  assert.equal(app.element('undo').disabled, false);
  assert.equal(app.element('pose-P01')['aria-pressed'], 'true');
  await app.element('pose-P01').click(); // same pose: no discard and no dialog
  assert.equal(app.element('change-confirm').open, false);
  await app.element('pose-P04').click();
  app.element('confirm-change').click();
  assert.equal(app.element('pose-P04')['aria-pressed'], 'true');
  assert.equal(app.offscreens[0].height, 192);
  assert.equal(app.element('undo').disabled, true);
  assert.equal(app.element('redo').disabled, true);
  assert.equal(app.element('size-value').textContent, '20%');
  assert.equal(app.element('angle-value').textContent, '-5°');
  assert.deepEqual(Array.from(app.draws[1].position), [200, 200]);
});

test('pose asset or mask failure preserves existing paint and pose, and retry succeeds', async () => {
  const options = { failPose: Poses.get('P02').silhouette };
  const app = setup(options);
  await app.load();
  app.element('mode-paint').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointerup', 1, 200, 200);
  const previous = app.offscreens[0].operations.length;
  await app.element('pose-P02').click();
  assert.match(app.element('status').textContent, /読み込めません/);
  assert.equal(app.offscreens[0].operations.length, previous);
  assert.equal(app.element('undo').disabled, false);
  options.failPose = null;
  options.emptyPose = Poses.get('P02').silhouette;
  await app.element('pose-P02').click();
  assert.equal(app.offscreens[0].operations.length, previous);
  assert.equal(app.element('pose-P01')['aria-pressed'], 'true');
  options.emptyPose = null;
  await app.element('pose-P02').click();
  assert.equal(app.element('change-confirm').open, true);
  app.element('confirm-change').click();
  assert.equal(app.element('pose-P02')['aria-pressed'], 'true');
});

test('pose change replaces cached PNG/File; reset and image replacement return to STAND', async () => {
  const shared = [];
  const app = setup({ navigator: { canShare: () => true, share: async data => shared.push(data.files[0]) } });
  await app.load();
  await app.element('open-preview').click();
  const firstURL = app.element('preview-image').src;
  app.element('back-to-edit').click();
  await app.element('pose-P04').click();
  await app.element('open-preview').click();
  assert.notEqual(app.element('preview-image').src, firstURL);
  await app.element('share-question').click();
  assert.match(await shared[0].text(), /assets\/poses\/lie\.svg/);
  assert.doesNotMatch(await shared[0].text(), /assets\/kakureron\.svg/);
  app.element('back-to-edit').click();
  app.element('mode-paint').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointerup', 1, 200, 200);
  app.element('reset').click();
  assert.equal(app.element('change-confirm').open, true);
  app.element('cancel-change').click();
  assert.equal(app.element('pose-P04')['aria-pressed'], 'true');
  app.element('reset').click();
  app.element('confirm-change').click();
  assert.equal(app.element('pose-P01')['aria-pressed'], 'true');
  assert.equal(app.element('size-value').textContent, '18%');
  assert.equal(app.element('angle-value').textContent, '0°');
  assert.equal(app.element('undo').disabled, true);
  await app.element('pose-P03').click();
  await app.load('replacement');
  assert.equal(app.element('pose-P01')['aria-pressed'], 'true');
  assert.equal(app.draws[0].image.source, 'blob:replacement');
});

test('all pose aspect ratios preserve inverse coordinates and rotated alpha bounds at multiple scales', () => {
  const rect = { x: 0, y: 0, width: 1000, height: 1000 };
  for (const pose of Poses.list) for (const size of [0.05, 0.18, 0.32]) for (const angle of [0, Math.PI / 2, -0.7]) {
    const character = { x: 0.5, y: 0.5, size, angle, poseId: pose.poseId };
    const raster = Poses.rasterSize(pose);
    const local = { x: 214, y: raster.height * 0.33 };
    const dx = (local.x / raster.width - 0.5) * size * rect.width;
    const dy = (local.y / raster.height - 0.5) * size * rect.width * pose.ratio;
    const screen = { x: 500 + dx * Math.cos(angle) - dy * Math.sin(angle), y: 500 + dx * Math.sin(angle) + dy * Math.cos(angle) };
    const actual = Paint.screenToLocal(screen, character, rect);
    assert.ok(Math.abs(actual.x - local.x) < 1e-8);
    assert.ok(Math.abs(actual.y - local.y) < 1e-8);
    const alpha = { x: 0.1, y: 0.05, width: 0.8, height: 0.85 };
    const answer = Export.answerBounds(character, rect, pose, alpha);
    for (const [u, v] of [[0.1, 0.05], [0.9, 0.05], [0.1, 0.9], [0.9, 0.9]]) {
      const x = (u - 0.5) * size * rect.width, y = (v - 0.5) * size * rect.width * pose.ratio;
      const px = 500 + x * Math.cos(angle) - y * Math.sin(angle), py = 500 + x * Math.sin(angle) + y * Math.cos(angle);
      assert.ok(px >= answer.x && px <= answer.x + answer.width);
      assert.ok(py >= answer.y && py <= answer.y + answer.height);
    }
  }
});

test('Escape cancels pose change and preserves redo-only paint history', async () => {
  const app = setup();
  await app.load();
  app.element('mode-paint').click();
  app.pointer('pointerdown', 1, 200, 200);
  app.pointer('pointerup', 1, 200, 200);
  app.element('undo').click();
  assert.equal(app.element('redo').disabled, false);
  await app.element('pose-P03').click();
  assert.equal(app.element('change-confirm').open, true);
  app.element('change-confirm').handlers.cancel({ preventDefault() {} });
  assert.equal(app.element('change-confirm').open, false);
  assert.equal(app.element('pose-P01')['aria-pressed'], 'true');
  assert.equal(app.element('redo').disabled, false);
  app.element('redo').click();
  assert.equal(app.element('undo').disabled, false);
});

test('copy source requires explicit selection, uses original image coordinates and never changes the eyedropper color', async () => {
  const app = setup({ imageWidth:6000,imageHeight:4000 });
  await app.load();
  app.element('mode-copy').click();
  assert.equal(app.element('copy-controls').hidden,false);
  assert.equal(app.element('brush-controls').hidden,false);
  const layer=app.offscreens[0],before=layer.operations.length;
  app.pointer('pointerdown',1,200,200);
  app.pointer('pointerup',1,200,200);
  assert.equal(layer.operations.length,before);
  assert.equal(app.element('copy-source-state').textContent,'未指定');
  assert.match(app.element('status').textContent,/写真からコピー/);
  app.element('select-copy-source').click();
  app.pointer('pointerdown',1,200,200);
  assert.equal(app.element('loupe').hidden,false);
  assert.equal(app.element('copy-source-state').textContent,'未指定');
  app.pointer('pointerup',1,200,200);
  assert.equal(app.element('copy-source-state').textContent,'指定済み (3000, 2000)');
  assert.equal(app.element('color-value').textContent,''); // DOM default is #FFFFFF; sampling has not changed it
  assert.equal(layer.operations.length,before);
  assert.equal(app.element('copy-marker').hidden,false);
  assert.equal(app.element('copy-marker').style.left,'200px');
  app.pointer('pointerdown',1,100,200);app.pointer('pointerup',1,100,200);
  assert.equal(app.element('copy-source-state').textContent,'指定済み (3000, 2000)');
  app.element('stage').clientWidth=200;app.element('stage').clientHeight=200;app.resize();
  assert.equal(app.element('copy-marker').style.left,'100px');
});

async function selectCopySource(app,x=200,y=200){
  app.element('mode-copy').click();app.element('select-copy-source').click();
  app.pointer('pointerdown',1,x,y);app.pointer('pointerup',1,x,y);
}

test('copy opacity, bounded working canvases, single snapshot, cancellation and mixed history', async()=>{
  const app=setup();await app.load();await selectCopySource(app);
  app.element('opacity-0.7').click();
  app.pointer('pointerdown',1,200,200);
  const count=app.offscreens.length,reads=app.offscreens[0].reads;
  for(let i=0;i<10;i++)app.pointer('pointermove',1,200+i/2,200);
  assert.equal(app.offscreens.length,count);
  assert.equal(app.offscreens[0].reads,reads);
  assert.ok(app.offscreens[0].operations.some(op=>op[0]==='alpha'&&op[1]===0.7));
  app.pointer('pointercancel',1,205,200);
  assert.equal(app.element('undo').disabled,true);
  assert.equal(app.element('copy-source-state').textContent,'指定済み (400, 200)');
  app.pointer('pointerdown',1,200,200);app.pointer('pointerup',1,200,200);
  assert.equal(app.element('undo').disabled,false);
  app.element('mode-paint').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointerup',1,200,200);
  app.element('mode-erase').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointerup',1,200,200);
  for(let i=0;i<3;i++)app.element('undo').click();
  assert.equal(app.element('undo').disabled,true);
  for(let i=0;i<3;i++)app.element('redo').click();
  assert.equal(app.element('redo').disabled,true);
});

for(const pose of Poses.list)test(`${pose.poseId}: transformed copy, PNG, marker exclusion and pose confirmation`,async()=>{
  const shared=[];
  const app=setup({navigator:{canShare:()=>true,share:async data=>shared.push(data.files[0])}});
  await app.load();await app.element(`pose-${pose.poseId}`).click();
  for(let i=0;i<9;i++)app.element('rotate-right').click();
  app.element('larger').click();
  await selectCopySource(app,100,200);
  const sourceState=app.element('copy-source-state').textContent;
  app.element('opacity-0.4').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointermove',1,204,200);app.pointer('pointerup',1,204,200);
  assert.ok(app.offscreens[0].operations.some(op=>op[0]==='alpha'&&op[1]===0.4));
  assert.equal(app.element('copy-source-state').textContent,sourceState);
  const paintLayer=app.offscreens[0];
  app.element('mode-place').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointermove',1,220,210);app.pointer('pointerup',1,220,210);
  app.element('mode-copy').click();
  await app.element('open-preview').click();
  assert.equal(app.element('copy-marker').hidden,true);
  assert.ok(app.encodings.at(-1).operations.some(op=>op[0]==='draw'&&op[2]===paintLayer));
  assert.ok(app.encodings.at(-1).operations.some(op=>op[0]==='draw'&&op[2].source===pose.silhouette));
  assert.equal(app.encodings.at(-1).operations.filter(op=>op[0]==='strokeRect').length,0);
  await app.element('share-question').click();assert.equal(shared.length,1);
  await app.element('show-answer').click();
  assert.equal(app.encodings.at(-1).operations.filter(op=>op[0]==='strokeRect').length,2);
  app.element('back-to-edit').click();
  assert.equal(app.element('copy-marker').hidden,false);
  const next=pose.poseId==='P01'?'P02':'P01';
  await app.element(`pose-${next}`).click();assert.equal(app.element('change-confirm').open,true);
  app.element('cancel-change').click();assert.equal(app.element('undo').disabled,false);
  await app.element(`pose-${next}`).click();app.element('confirm-change').click();
  assert.equal(app.element('undo').disabled,true);
  assert.equal(app.element('copy-source-state').textContent,sourceState);
  await app.load('new-background');assert.equal(app.element('copy-source-state').textContent,'未指定');
});

test('copy edit forces a newly encoded preview and lost capture rolls back incomplete drawing',async()=>{
  const app=setup();await app.load();
  await app.element('open-preview').click();const old=app.element('preview-image').src;
  app.element('back-to-edit').click();await selectCopySource(app);
  app.pointer('pointerdown',1,200,200);app.pointer('pointerup',1,200,200);
  await app.element('open-preview').click();assert.notEqual(app.element('preview-image').src,old);
  assert.equal(app.encodings.length,2);
  app.element('back-to-edit').click();
  app.element('undo').click();assert.equal(app.element('redo').disabled,false);
  app.pointer('pointerdown',1,200,200);app.pointer('lostpointercapture',1,200,200);
  assert.equal(app.element('redo').disabled,false);
  assert.equal(app.element('undo').disabled,true);
});

function inputRange(app,id,value){
  const input=app.element(id);input.value=String(value);input.handlers.input({target:input});
}
function atLocal(app,pose,local){
  const drawing=app.draws[1],raster=Poses.rasterSize(pose);
  const x=(local.x/raster.width-0.5)*drawing.rect[2],y=(local.y/raster.height-0.5)*drawing.rect[3];
  return {x:drawing.position[0]+x*Math.cos(drawing.angle)-y*Math.sin(drawing.angle),
    y:drawing.position[1]+x*Math.sin(drawing.angle)+y*Math.cos(drawing.angle)};
}

test('PC mouse, sliders and buttons share normalized size and angle values',async()=>{
  const app=setup();await app.load();
  app.pointer('pointerdown',1,200,200,{pointerType:'mouse'});
  app.pointer('pointermove',1,240,220,{pointerType:'mouse'});
  app.pointer('pointerup',1,240,220,{pointerType:'mouse'});
  assert.deepEqual(Array.from(app.draws[1].position),[240,220]);
  inputRange(app,'size-slider',31);assert.equal(app.element('size-value').textContent,'31%');
  assert.equal(app.draws[1].rect[2],124);
  inputRange(app,'angle-slider',-135);assert.equal(app.element('angle-value').textContent,'-135°');
  app.element('larger').click();assert.equal(app.element('size-slider').value,'33');
  app.element('rotate-right').click();assert.equal(app.element('angle-slider').value,'-130');
  inputRange(app,'size-slider',999);assert.equal(app.element('size-value').textContent,'60%');
  inputRange(app,'size-slider',-5);assert.equal(app.element('size-value').textContent,'5%');
  inputRange(app,'angle-slider',999);assert.equal(app.element('angle-value').textContent,'180°');
});

test('mode-specific panels and compact pose chooser open/close without affecting paint',async()=>{
  const app=setup();await app.load();
  for(const mode of ['place','pick','paint','erase','copy']){
    app.element(`mode-${mode}`).click();
    assert.equal(app.element('placement-controls').hidden,mode!=='place');
    assert.equal(app.element('color-controls').hidden,mode!=='paint'&&mode!=='pick');
    assert.equal(app.element('brush-controls').hidden,!['paint','erase','copy'].includes(mode));
    assert.equal(app.element('copy-controls').hidden,mode!=='copy');
    assert.equal(app.element('reset').hidden,mode!=='place');
  }
  app.element('toggle-poses').click();assert.equal(app.element('pose-options').hidden,false);
  await app.element('pose-P02').click();assert.equal(app.element('pose-options').hidden,true);
  app.element('toggle-poses').click();await app.element('pose-P02').click();
  assert.equal(app.element('pose-options').hidden,true);
});

for(const pose of Poses.list)test(`${pose.poseId}: direct zoom paint/copy/erase shares local width, history and final PNG`,async()=>{
  const app=setup();await app.load();await app.element(`pose-${pose.poseId}`).click();
  inputRange(app,'size-slider',23);inputRange(app,'angle-slider',45);
  app.element('mode-paint').click();
  const raster=Poses.rasterSize(pose),local={x:220,y:raster.height*0.4};
  let point=atLocal(app,pose,local);
  app.pointer('pointerdown',1,point.x,point.y);app.pointer('pointerup',1,point.x,point.y);
  const layer=app.offscreens[0],stamp=app.offscreens[2],canvasCount=app.offscreens.length;
  app.element('open-zoom').click();
  assert.equal(app.element('app').dataset.zoom,'true');assert.equal(app.element('zoom-4')['aria-pressed'],'true');
  assert.equal(app.offscreens.length,canvasCount);
  for(const scale of [2,4,8]){
    app.element(`zoom-${scale}`).click();point=atLocal(app,pose,local);
    assert.ok(point.x>=0&&point.x<=400&&point.y>=0&&point.y<=400);
    app.pointer('pointerdown',1,point.x,point.y);app.pointer('pointerup',1,point.x,point.y);
    const arc=stamp.operations.filter(op=>op[0]==='arc').at(-1);
    assert.ok(Math.abs(arc[1]-local.x)<1e-8&&Math.abs(arc[2]-local.y)<1e-8);
    assert.equal(arc[3],Paint.BRUSHES.medium/2);
  }
  for(let i=0;i<4;i++)app.element('undo').click();assert.equal(app.element('undo').disabled,true);
  for(let i=0;i<4;i++)app.element('redo').click();assert.equal(app.element('redo').disabled,true);
  await selectCopySource(app,100,200);
  point=atLocal(app,pose,local);
  app.pointer('pointerdown',1,point.x,point.y);app.pointer('pointerup',1,point.x,point.y);
  app.element('mode-erase').click();
  app.pointer('pointerdown',1,point.x,point.y);app.pointer('pointerup',1,point.x,point.y);
  assert.ok(layer.operations.some(op=>op[0]==='draw'&&op[1]==='destination-out'));
  app.element('undo').click(); // retain copied paint
  app.element('close-zoom').click();
  assert.equal(app.element('app').dataset.zoom,'false');
  assert.equal(app.element('size-value').textContent,'23%');assert.equal(app.element('angle-value').textContent,'45°');
  await app.element('open-preview').click();
  const encoded=app.encodings.at(-1),paintDraw=encoded.operations.find(op=>op[0]==='draw'&&op[2]===layer);
  assert.equal(encoded.width,800);assert.equal(encoded.height,400);
  assert.ok(Math.abs(paintDraw[5]-184)<1e-8);
  assert.equal(encoded.operations.filter(op=>op[0]==='strokeRect').length,0);
  app.element('back-to-edit').click();assert.equal(app.element('undo').disabled,false);
});

test('zoom two-finger, middle-button, Space and pan tool move only the viewport',async()=>{
  const app=setup();await app.load();app.element('mode-paint').click();app.element('open-zoom').click();
  app.pointer('pointerdown',1,200,200);app.pointer('pointerdown',2,240,200);
  app.pointer('pointermove',2,280,240);
  assert.ok(Math.abs(app.draws[1].position[0]-220)<1e-8);
  assert.ok(Math.abs(app.draws[1].position[1]-220)<1e-8);
  app.pointer('pointerup',2,280,240);app.pointer('pointermove',1,210,210);app.pointer('pointerup',1,210,210);
  assert.equal(app.element('undo').disabled,true); // initial first-finger dab was rolled back
  app.pointer('pointerdown',1,200,200,{pointerType:'mouse',button:1});
  app.pointer('pointermove',1,220,210,{pointerType:'mouse',button:1});
  app.pointer('pointerup',1,220,210,{pointerType:'mouse',button:1});
  app.element('canvas').handlers.keydown({code:'Space',preventDefault(){}});
  app.pointer('pointerdown',1,200,200,{pointerType:'mouse'});app.pointer('pointermove',1,210,200,{pointerType:'mouse'});app.pointer('pointerup',1,210,200,{pointerType:'mouse'});
  app.windowHandlers.keyup({code:'Space'});
  app.element('pan-zoom').click();assert.equal(app.element('pan-zoom')['aria-pressed'],'true');
  app.pointer('pointerdown',1,200,200);app.pointer('pointermove',1,210,210);app.pointer('pointerup',1,210,210);
  app.element('center-zoom').click();assert.deepEqual(Array.from(app.draws[1].position),[200,200]);
  app.element('close-zoom').click();assert.deepEqual(Array.from(app.draws[1].position),[200,200]);
  assert.equal(app.element('size-value').textContent,'18%');assert.equal(app.element('angle-value').textContent,'0°');
  assert.equal(app.element('undo').disabled,true);
});

test('zoom multiplier preserves focus and view resize does not alter the character',async()=>{
  const app=setup();await app.load();app.element('open-zoom').click(); // place mode pans, never moves the character
  app.pointer('pointerdown',1,200,200);app.pointer('pointermove',1,250,220);app.pointer('pointerup',1,250,220);
  const before=Array.from(app.draws[1].position);
  app.element('zoom-8').click();
  assert.ok(Math.abs(app.draws[1].position[0]-(200+(before[0]-200)*2))<1e-8);
  app.element('stage').clientWidth=200;app.element('stage').clientHeight=200;app.resize();
  app.element('close-zoom').click();assert.deepEqual(Array.from(app.draws[1].position),[100,100]);
});

test('pose animation blocks drawing and export, then leaves the exact final SVG and mask',async()=>{
  const app=setup({reducedMotion:false});await app.load();
  const pending=app.element('pose-P02').click();for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(app.frames.size,1);assert.equal(app.element('editor-controls')['aria-busy'],'true');
  app.frame(0);app.frame(150);
  assert.ok(app.draws.some(draw=>draw.image.source===Poses.get('P01').silhouette&&draw.alpha>0&&draw.alpha<1));
  assert.ok(app.draws.some(draw=>draw.image.source===Poses.get('P02').silhouette&&draw.alpha>0&&draw.alpha<1));
  const drawCount=app.offscreens[0].operations.length;
  app.pointer('pointerdown',1,200,200);assert.equal(app.captures.size,0);
  await app.element('pose-P03').click();await app.element('open-preview').click();
  assert.equal(app.encodings.length,0);assert.equal(app.offscreens[0].operations.length,drawCount);
  app.frame(300);await pending;
  assert.equal(app.element('editor-controls')['aria-busy'],'false');assert.equal(app.frames.size,0);
  assert.equal(app.draws[1].image.source,Poses.get('P02').silhouette);
  assert.equal(app.draws[1].alpha,1);assert.equal(app.offscreens[0].height,357);
  await app.element('open-preview').click();
  assert.ok(app.encodings.at(-1).operations.some(op=>op[0]==='draw'&&op[2].source===Poses.get('P02').silhouette));
  assert.ok(!app.encodings.at(-1).operations.some(op=>op[0]==='draw'&&op[2].source===Poses.get('P01').silhouette));
});

test('all 12 pose transitions complete and reduced-motion skips intermediate frames',async()=>{
  const app=setup({reducedMotion:false,autoFrames:true});await app.load();
  for(const from of Poses.list)for(const to of Poses.list.filter(pose=>pose!==from)){
    await app.element(`pose-${from.poseId}`).click();await app.element(`pose-${to.poseId}`).click();
    assert.equal(app.draws[1].image.source,to.silhouette);assert.equal(app.frames.size,0);
    assert.equal(app.offscreens[0].height,Poses.rasterSize(to).height);
  }
  const reduced=setup();await reduced.load();await reduced.element('pose-P04').click();
  assert.equal(reduced.frames.size,0);assert.equal(reduced.draws[1].image.source,Poses.get('P04').silhouette);
});

test('hiding or replacing the image finishes a committed pose animation without stale frames',async()=>{
  const app=setup({reducedMotion:false});await app.load();
  const pending=app.element('pose-P04').click();for(let i=0;i<8;i++)await Promise.resolve();
  app.document.hidden=true;app.documentHandlers.visibilitychange();await pending;
  assert.equal(app.frames.size,0);assert.equal(app.element('pose-P04')['aria-pressed'],'true');
  app.document.hidden=false;
  const second=app.element('pose-P03').click();for(let i=0;i<8;i++)await Promise.resolve();
  await app.load('new-photo');await second;
  assert.equal(app.frames.size,0);assert.equal(app.draws[1].image.source,Poses.get('P01').silhouette);
});
