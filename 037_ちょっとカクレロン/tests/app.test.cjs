const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Paint = require('../paint.js');
const Export = require('../export.js');

function setup(options = {}) {
  const elements = new Map();
  const draws = [];
  const captures = new Set();
  const encodings = [];
  const downloads = [];
  const urlBlobs = new Map();
  const navigator = options.navigator || {};
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
      const encoding = { type, width: target.width, height: target.height, operations: [...operations],
        complete: () => callback(options.failEncoding ? null : new Blob(['synthetic PNG for API control-flow testing'], { type })) };
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
    body: { append() {} },
    createElement(tag) {
      if (tag === 'a') return { click() {
        if (options.failDownload) throw new Error('Download blocked');
        downloads.push({ href: this.href, download: this.download });
      }, remove() {} };
      return offscreen();
    },
    querySelector(selector) { return element(selector.slice(1)); },
    querySelectorAll(selector) { return selector === '[data-mode]' ? modes : selector === '[data-brush]' ? brushes : buttons; }
  };
  let revoked = 0;
  class Image {
    complete = true;
    naturalWidth = options.imageWidth || 800;
    naturalHeight = options.imageHeight || 400;
    set src(value) {
      this.source = value;
      queueMicrotask(() => value === 'blob:bad' ? this.onerror?.() : this.onload?.());
    }
  }
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), {
    document, Image, KakureronPaint: Paint, KakureronExport: Export, navigator,
    Blob, File, isSecureContext: options.secureContext !== false,
    window: { devicePixelRatio: 2, addEventListener() {} },
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
  function pointer(type, id, x, y) {
    element('canvas').handlers[type]({ type, pointerId: id, clientX: x, clientY: y,
      pointerType: 'touch', button: 0, preventDefault() {} });
  }
  return { element, draws, load, pointer, offscreens, encodings, downloads, urlBlobs, navigator,
    resize: () => resize(), captures, revoked: () => revoked };
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
