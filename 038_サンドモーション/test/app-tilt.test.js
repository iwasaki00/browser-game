import test from 'node:test';
import assert from 'node:assert/strict';

test('app integration: rotation freezes rendering state and touch; portrait resumes without rebuilding the grid', async () => {
  // Minimal browser adapter executes the real app event/frame handlers in Node.
  // Canvas rasterization, native permission UI and physical touch need device QA.
  class Element extends EventTarget {
    constructor() {
      super(); this.textContent = ''; this.value = ''; this.hidden = false; this.disabled = false;
      this.dataset = {}; this.attributes = {}; this.style = {}; this.clientWidth = 360; this.clientHeight = 600;
      this.classes = new Set(); this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  }
  let conversions = 0, failConversionAt = 0, decodeFailure = false, imageWidth = 100, imageHeight = 100;
  class Canvas extends Element {
    constructor() {
      super(); this.width = 180; this.height = 300; this.capture = null;
      this.rect = { left: 10, top: 20, width: 180, height: 300 };
      this.context = {
        createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {}, drawImage() {},
        getImageData: (x, y, w, h) => {
          conversions++;
          if (conversions === failConversionAt) throw new Error('fixture raster failure');
          return { data: new Uint8ClampedArray(w * h * 4).fill(255) };
        },
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: image => { this.rendered = image.data.slice(); }
      };
    }
    getContext() { return this.context; }
    getBoundingClientRect() { return this.rect; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, id === 'sand' ? new Canvas() : new Element()); return elements.get(id); };
  get('quality').value = 'standard'; get('radius').value = '12'; get('diagnostics').hidden = true;
  get('return-duration').value = '1.5'; get('return-arc').value = '0.06';
  const arrows = ['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1'].map(value => {
    const button = new Element(); button.dataset.g = value; return button;
  });
  const document = new EventTarget();
  Object.assign(document, { hidden: false, getElementById: get, createElement: () => new Canvas(), querySelectorAll: () => arrows });
  const orientation = new EventTarget(); orientation.type = 'portrait-primary'; orientation.angle = 0;
  let now = 0, frame;
  const window = new EventTarget();
  Object.assign(window, { isSecureContext: true, DeviceOrientationEvent: { requestPermission: () => Promise.resolve('granted') },
    innerWidth: 375, innerHeight: 800, setInterval: () => 1, clearInterval() {} });
  const replacements = { document, window, screen: { orientation }, navigator: { userAgent: 'iPhone' },
    performance: { now: () => now }, ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => { frame = fn; },
    Image: class { constructor() { this.naturalWidth = imageWidth; this.naturalHeight = imageHeight; } async decode() { if (decodeFailure) throw new Error(); } } };
  const originals = new Map(Object.keys(replacements).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(replacements)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  const sensor = (roll = 0) => {
    now += 20;
    const event = new Event('deviceorientation');
    Object.assign(event, { beta: Math.asin(Math.cos(roll * Math.PI / 180)) * 180 / Math.PI, gamma: roll ? Math.sign(roll) * 90 : 0 });
    window.dispatchEvent(event);
  };
  const tick = (ms = 20) => { now += ms; frame(now); };
  const pointer = (type, x, y, kind = 'touch') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType: kind, button: 0 });
    get('sand').dispatchEvent(event);
  };
  try {
    await import('../src/app.js');
    const canvas = get('sand'), initial = canvas.rendered.slice();
    assert.equal(get('counts').textContent, '17,670 / 0');
    arrows.find(b => b.dataset.g === '-1,0').click();
    get('tilt-start').click(); await Promise.resolve(); tick(6000);
    assert.equal(get('gravity').textContent, '-1, 0'); assert.equal(get('input-mode').textContent, '手動');
    assert.match(get('tilt-status').textContent, /端末を傾けてください/);
    sensor();
    for (let i = 0; i < 50; i++) { sensor(35); tick(); }
    assert.equal(get('input-mode').textContent, '傾き');
    assert.deepEqual(canvas.rendered, initial); // Tilt does not collapse the photo.
    pointer('pointerdown', 100, 150); pointer('pointerup', 100, 150);
    get('info').click();
    const fixedBeforeRotation = get('counts').textContent;
    assert.notEqual(fixedBeforeRotation, '17,670 / 0');
    for (let i = 0; i < 10; i++) tick();
    orientation.type = 'landscape-primary'; orientation.angle = 90;
    orientation.dispatchEvent(new Event('change'));
    const frozen = canvas.rendered.slice(), conversionCount = conversions;
    assert.equal(get('rotation-pause').hidden, false); assert.match(get('rotation-title').textContent, /縦に戻し/);
    assert.equal(get('reset').disabled, false); // v0.3.0 reset is always available.
    pointer('pointerdown', 100, 100); pointer('pointermove', 150, 130); pointer('pointerup', 150, 130);
    for (let i = 0; i < 100; i++) { sensor(-35); tick(); }
    get('info').click();
    assert.deepEqual(canvas.rendered, frozen); assert.equal(get('counts').textContent, fixedBeforeRotation);
    orientation.type = 'portrait-primary'; orientation.angle = 0;
    canvas.rect = { left: 100, top: 50, width: 90, height: 150 };
    orientation.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) { sensor(0); tick(); }
    assert.equal(get('rotation-pause').hidden, false); assert.deepEqual(canvas.rendered, frozen);
    for (let i = 0; i < 25; i++) sensor(0);
    assert.equal(get('rotation-pause').hidden, true); assert.equal(conversions, conversionCount);
    assert.deepEqual(canvas.rendered, frozen); // No frame advances until resumed RAF.
    assert.equal(get('counts').textContent, fixedBeforeRotation);
    // Tap a different fixed patch using the post-rotation CSS rect.
    pointer('pointerdown', 125, 115); pointer('pointerup', 125, 115); get('info').click();
    assert.notEqual(get('counts').textContent, fixedBeforeRotation);
    assert.equal(get('total').textContent, '17,670');
    tick(); tick(); assert.notDeepEqual(canvas.rendered, frozen);
    orientation.type = 'landscape-primary'; orientation.dispatchEvent(new Event('change'));
    arrows.find(b => b.dataset.g === '-1,0').click();
    assert.equal(get('input-mode').textContent, '手動'); assert.equal(get('rotation-pause').hidden, true);
    assert.equal(get('gravity').textContent, '-1, 0');
    sensor(40); assert.equal(get('gravity').textContent, '-1, 0');
    arrows.find(b => b.dataset.g === '0,1').click(); get('reset').click();
    const cssSize = { ...canvas.style }, previousConversions = conversions;
    get('quality').value = 'high'; get('quality').dispatchEvent(new Event('change'));
    assert.equal(canvas.width, 270); assert.equal(canvas.height, 450);
    assert.equal(get('counts').textContent, '39,440 / 0');
    assert.equal(conversions, previousConversions + 2); assert.deepEqual(canvas.style, cssSize);
    const highInitial = canvas.rendered.slice();
    get('collapse').click(); for (let i = 0; i < 60; i++) tick();
    assert.equal(get('counts').textContent, '0 / 39,440');
    assert.notDeepEqual(canvas.rendered, highInitial);
    get('reset').click(); assert.deepEqual(canvas.rendered, highInitial);
    assert.equal(get('total').textContent, '39,440');

    get('reassemble').click(); assert.equal(canvas.attributes['data-reassembling'], 'false');
    for (const quality of ['standard', 'high']) {
      get('quality').value = quality; get('quality').dispatchEvent(new Event('change'));
      const original = canvas.rendered.slice(), count = get('total').textContent;
      get('collapse').click(); for (let i = 0; i < 20; i++) tick();
      get('reassemble').click(); tick(300);
      assert.equal(canvas.attributes['data-reassembling'], 'true'); assert.equal(get('collapse').disabled, true);
      const moving = canvas.rendered.slice(); assert.notDeepEqual(moving, original);
      // Forced duplicate events must be ignored even without the disabled UI.
      get('reassemble').dispatchEvent(new Event('click')); get('collapse').dispatchEvent(new Event('click'));
      pointer('pointerdown', 125, 115); pointer('pointerup', 125, 115);
      tick(1200); assert.equal(canvas.attributes['data-reassembling'], 'false');
      assert.deepEqual(canvas.rendered, original); assert.equal(get('total').textContent, count);
      assert.equal(get('counts').textContent, `${count} / 0`);
      // Reset halfway through, then touch: a stale animation must not reset again.
      get('collapse').click(); tick(200); get('reassemble').click(); tick(300); get('reset').click();
      assert.deepEqual(canvas.rendered, original);
      pointer('pointerdown', 125, 115); pointer('pointerup', 125, 115); tick(2000); get('info').click();
      assert.notEqual(get('counts').textContent, `${count} / 0`);
    }
    get('reset').click(); get('collapse').click(); tick(200); get('reassemble').click(); tick(300);
    get('quality').value = 'standard'; get('quality').dispatchEvent(new Event('change'));
    const standardAgain = canvas.rendered.slice(); tick(2000);
    assert.equal(canvas.attributes['data-reassembling'], 'false'); assert.deepEqual(canvas.rendered, standardAgain);
    assert.equal(get('counts').textContent, '17,670 / 0');
    get('collapse').click(); tick(200); get('reassemble').click(); tick(300); get('sample').click();
    const sampleAgain = canvas.rendered.slice(); tick(2000); assert.deepEqual(canvas.rendered, sampleAgain);
    // Actual async image-file handler must cancel and replace the old return.
    get('collapse').click(); tick(200); get('reassemble').click(); tick(300);
    get('image-file').files = [new File(['fixture'], 'new-picture.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(canvas.attributes['data-reassembling'], 'false');
    assert.equal(get('source-name').textContent, 'new-picture.png'); assert.equal(get('total').textContent, '24,025');
    const newImage = canvas.rendered.slice(); tick(2000); assert.deepEqual(canvas.rendered, newImage);
    // A tilt-mode landscape freezes the same interpolated frame, not just physics.
    orientation.type = 'portrait-primary'; orientation.angle = 0; orientation.dispatchEvent(new Event('change'));
    get('sample').click(); get('tilt-start').click(); await Promise.resolve(); sensor(0);
    get('collapse').click(); for (let i = 0; i < 20; i++) tick(); get('reassemble').click(); tick(350);
    assert.equal(canvas.attributes['data-reassembling'], 'true');
    get('info').click(); assert.equal(get('reassembly-progress').textContent, '23%');
    orientation.type = 'landscape-primary'; orientation.angle = 90; orientation.dispatchEvent(new Event('change'));
    const pausedReturn = canvas.rendered.slice();
    for (let i = 0; i < 10; i++) { sensor(0); tick(100); }
    assert.deepEqual(canvas.rendered, pausedReturn); assert.equal(get('reset').disabled, false);
    orientation.type = 'portrait-primary'; orientation.angle = 0; orientation.dispatchEvent(new Event('change'));
    for (let i = 0; i < 30; i++) sensor(0);
    assert.equal(get('rotation-pause').hidden, true);
    tick(20); assert.deepEqual(canvas.rendered, pausedReturn); // First resumed frame has zero dt.
    tick(100); get('info').click(); assert.equal(get('reassembly-progress').textContent, '30%'); assert.notDeepEqual(canvas.rendered, pausedReturn);
    tick(1050); assert.equal(canvas.attributes['data-reassembling'], 'false');
    assert.deepEqual(canvas.rendered, sampleAgain); assert.equal(get('counts').textContent, '17,670 / 0');
    get('collapse').click(); tick(200); get('reassemble').click(); tick(300);
    orientation.type = 'landscape-primary'; orientation.angle = 90; orientation.dispatchEvent(new Event('change'));
    get('reset').click(); assert.equal(canvas.attributes['data-reassembling'], 'false');
    assert.deepEqual(canvas.rendered, sampleAgain); assert.equal(get('counts').textContent, '17,670 / 0');
    // v0.4.0: hidden modes, including a return animation, never advance.
    arrows.find(b => b.dataset.g === '0,1').click();
    orientation.type = 'portrait-primary'; orientation.angle = 0;
    get('quality').value = 'standard'; get('quality').dispatchEvent(new Event('change'));
    get('sample').click();
    const freeInitial = canvas.rendered.slice();
    get('collapse').click(); for (let i = 0; i < 20; i++) tick();
    get('reassemble').click(); tick(300); get('info').click();
    const freeReturning = canvas.rendered.slice(), progress = get('reassembly-progress').textContent;
    get('mode-hourglass').click();
    assert.equal(get('counts').textContent, '3,996 / 0');
    assert.equal(get('reassemble').hidden, true); assert.equal(get('flip').disabled, true);
    const hourglassInitial = canvas.rendered.slice();
    pointer('pointerdown', 125, 115); pointer('pointerup', 125, 115); tick(1000);
    assert.deepEqual(canvas.rendered, hourglassInitial);
    get('tilt-start').click(); await Promise.resolve(); tick(6000);
    get('hourglass-left').click(); assert.equal(get('input-mode').textContent, '手動');
    assert.equal(get('gravity').textContent, '-1, 1');
    get('hourglass-straight').click(); get('collapse').click();
    assert.equal(get('flip').disabled, false);
    for (let i = 0; i < 30; i++) tick();
    const hourglassFlowing = canvas.rendered.slice();
    assert.notDeepEqual(hourglassFlowing, hourglassInitial);
    // A failed image must also preserve the hidden, partially completed return.
    decodeFailure = true;
    get('image-file').files = [new File(['bad'], 'hidden-return-failure.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve));
    decodeFailure = false; assert.deepEqual(canvas.rendered, hourglassFlowing);
    get('mode-free').click();
    assert.deepEqual(canvas.rendered, freeReturning); assert.equal(get('reassembly-progress').textContent, progress);
    tick(); tick(1200); assert.deepEqual(canvas.rendered, freeInitial);
    get('mode-hourglass').click(); assert.deepEqual(canvas.rendered, hourglassFlowing);
    get('flip').click(); assert.notDeepEqual(canvas.rendered, hourglassFlowing);
    get('flip').click(); assert.deepEqual(canvas.rendered, hourglassFlowing);
    assert.equal(get('total').textContent, '3,996');

    // Cancel, decode failure, or failure converting the SECOND mode commits nothing.
    get('image-file').files = []; get('image-file').dispatchEvent(new Event('change'));
    assert.deepEqual(canvas.rendered, hourglassFlowing);
    decodeFailure = true;
    get('image-file').files = [new File(['bad'], 'broken.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(canvas.rendered, hourglassFlowing); decodeFailure = false;
    failConversionAt = conversions + 2;
    get('quality').value = 'high'; get('quality').dispatchEvent(new Event('change'));
    assert.equal(get('quality').value, 'standard'); assert.deepEqual(canvas.rendered, hourglassFlowing);
    get('mode-free').click(); assert.deepEqual(canvas.rendered, freeInitial);
    get('mode-hourglass').click(); assert.deepEqual(canvas.rendered, hourglassFlowing);

    // The same rotation guard freezes hourglass physics and rejects flip/flow.
    get('tilt-start').click(); await Promise.resolve(); sensor(0);
    for (let i = 0; i < 30; i++) sensor(35);
    assert.equal(get('gravity').textContent, '1, 1');
    orientation.type = 'landscape-primary'; orientation.angle = 90; orientation.dispatchEvent(new Event('change'));
    const beforeRotateConversions = conversions;
    for (let i = 0; i < 10; i++) { sensor(0); tick(100); }
    get('flip').dispatchEvent(new Event('click')); get('collapse').dispatchEvent(new Event('click'));
    assert.deepEqual(canvas.rendered, hourglassFlowing);
    orientation.type = 'portrait-primary'; orientation.angle = 0; orientation.dispatchEvent(new Event('change'));
    for (let i = 0; i < 30; i++) sensor(0);
    assert.equal(get('rotation-pause').hidden, true); assert.equal(conversions, beforeRotateConversions);
    tick(); assert.deepEqual(canvas.rendered, hourglassFlowing);
    tick(60); assert.notDeepEqual(canvas.rendered, hourglassFlowing);
    get('hourglass-straight').click(); get('reset').click();
    assert.deepEqual(canvas.rendered, hourglassInitial); assert.equal(get('flip').disabled, true);
    get('mode-free').click(); assert.deepEqual(canvas.rendered, freeInitial);

    // Quality/source success replaces BOTH modes, including the hidden one.
    get('collapse').click(); tick(100); get('mode-hourglass').click(); get('collapse').click(); tick(100);
    get('quality').value = 'high'; get('quality').dispatchEvent(new Event('change'));
    assert.equal(get('counts').textContent, '8,991 / 0'); assert.equal(get('flip').disabled, true);
    get('mode-free').click(); assert.equal(get('counts').textContent, '39,440 / 0');
    assert.deepEqual(canvas.rendered, highInitial);
    get('image-file').files = [new File(['fixture'], 'both-modes.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('source-name').textContent, 'both-modes.png');
    get('mode-hourglass').click(); assert.equal(get('counts').textContent, '9,025 / 0');
    get('sample').click(); assert.equal(get('counts').textContent, '8,991 / 0');
    get('mode-free').click(); assert.equal(get('counts').textContent, '39,440 / 0');
    // v0.4.1 panels pause the actual state; close/cancel never regenerate it.
    get('quality').value = 'standard'; get('quality').dispatchEvent(new Event('change')); get('sample').click();
    const panelInitial = canvas.rendered.slice();
    const beforeSettings = conversions;
    get('settings-open').click(); assert.equal(get('settings-panel').hidden, false); assert.equal(get('app').inert, true);
    tick(2000); get('settings-close').click(); assert.equal(get('app').inert, false);
    assert.equal(conversions, beforeSettings); assert.deepEqual(canvas.rendered, panelInitial);
    get('gravity-open').click(); arrows.find(b => b.dataset.g === '-1,0').click();
    assert.equal(get('gravity-open').textContent, '重力 ←');
    get('gravity-close').click(); arrows.find(b => b.dataset.g === '0,1').click();

    imageWidth = 600; imageHeight = 1000;
    get('image-file').files = [new File(['portrait'], 'portrait.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('total').textContent, '26,460'); // 126x210, up from v0.4.0's 99x165.
    const portraitInitial = canvas.rendered.slice();
    get('collapse').click(); for (let i = 0; i < 20; i++) tick();
    get('reassemble').click(); tick(350); get('info').click();
    const returningPortrait = canvas.rendered.slice(), returningProgress = get('reassembly-progress').textContent;
    get('size-open').click(); assert.equal(get('photo-size').value, 70);
    get('photo-size').value = '80'; get('photo-size').dispatchEvent(new Event('input'));
    assert.equal(get('size-warning').hidden, false);
    const preview80 = canvas.rendered.slice(); assert.notDeepEqual(preview80, returningPortrait);
    tick(6000); get('info').click();
    assert.equal(get('total').textContent, '26,460'); assert.equal(get('reassembly-progress').textContent, returningProgress);
    get('size-close').click(); assert.deepEqual(canvas.rendered, returningPortrait);
    get('size-open').click(); assert.equal(get('photo-size').value, 70);
    get('size-apply').click(); assert.deepEqual(canvas.rendered, returningPortrait);
    assert.equal(canvas.attributes['data-reassembling'], 'true');

    // Applying hourglass size doesn't replace or advance the hidden free return.
    get('mode-hourglass').click(); assert.equal(get('total').textContent, '4,018');
    get('size-open').click(); assert.equal(get('photo-size').value, 100);
    get('photo-size').value = '60'; get('photo-size').dispatchEvent(new Event('input'));
    assert.equal(get('size-warning').hidden, true); get('size-apply').click();
    assert.equal(get('counts').textContent, '1,421 / 0');
    get('collapse').click(); for (let i = 0; i < 20; i++) tick();
    const smallHourglass = canvas.rendered.slice();
    get('mode-free').click(); assert.deepEqual(canvas.rendered, returningPortrait);
    assert.equal(get('reassembly-progress').textContent, returningProgress);
    tick(); tick(1200); assert.deepEqual(canvas.rendered, portraitInitial);
    get('collapse').click(); for (let i = 0; i < 20; i++) tick();
    get('size-open').click(); get('photo-size').value = '80'; get('photo-size').dispatchEvent(new Event('input'));
    const beforeApply = conversions;
    get('size-apply').click(); assert.equal(conversions, beforeApply + 1);
    assert.equal(get('counts').textContent, '34,560 / 0');
    const largePortrait = canvas.rendered.slice();
    get('mode-hourglass').click(); assert.deepEqual(canvas.rendered, smallHourglass);
    get('size-open').click(); assert.equal(get('photo-size').value, 60); get('size-close').click();
    get('mode-free').click(); assert.deepEqual(canvas.rendered, largePortrait);
    get('collapse').click(); tick(); tick(60);
    const movingLarge = canvas.rendered.slice();
    get('size-open').click(); assert.equal(get('photo-size').value, 80);
    const unchangedConversions = conversions; get('size-apply').click();
    assert.equal(conversions, unchangedConversions); assert.deepEqual(canvas.rendered, movingLarge);
    assert.equal(get('counts').textContent, '0 / 34,560');

    // Failed apply preserves the real grid and retained size.
    get('size-open').click(); get('photo-size').value = '75'; get('photo-size').dispatchEvent(new Event('input'));
    failConversionAt = conversions + 1; get('size-apply').click();
    assert.equal(get('size-panel').hidden, false); assert.equal(get('total').textContent, '34,560');
    get('size-close').click(); assert.deepEqual(canvas.rendered, movingLarge);
    get('size-open').click(); assert.equal(get('photo-size').value, 80); get('size-close').click();

    // Resizing the presentation does not convert a source or reset/advance grains.
    const beforeViewport = conversions;
    for (const [w, h] of [[390, 712], [375, 535], [390, 844], [375, 667]]) {
      get('stage').clientWidth = w - 24; get('stage').clientHeight = h - 210;
      window.innerWidth = w; window.innerHeight = h; window.dispatchEvent(new Event('resize'));
      assert.deepEqual(canvas.rendered, movingLarge); assert.equal(conversions, beforeViewport);
      assert.equal(canvas.width, 180); assert.equal(canvas.height, 300);
    }
    get('reset').click(); assert.deepEqual(canvas.rendered, largePortrait);
    get('collapse').click(); tick(); tick(100); get('reassemble').click(); tick(1500);
    assert.deepEqual(canvas.rendered, largePortrait);
    get('quality').value = 'high'; get('quality').dispatchEvent(new Event('change'));
    assert.equal(get('counts').textContent, '77,760 / 0');
    get('mode-hourglass').click(); assert.equal(get('counts').textContent, '3,212 / 0');
    get('size-open').click(); assert.equal(get('photo-size').value, 60); get('size-close').click();
    get('mode-free').click(); get('size-open').click(); assert.equal(get('photo-size').value, 80); get('size-close').click();
    // Width-bound photos can change the retained percentage without resetting
    // an identical raster. Escape is cancellation, too.
    get('sample').click(); get('collapse').click(); tick(); tick(60);
    const widthBound = canvas.rendered.slice();
    get('size-open').click(); get('photo-size').value = '70'; get('photo-size').dispatchEvent(new Event('input'));
    const widthBoundConversions = conversions; assert.equal(get('size-warning').hidden, true);
    get('size-apply').click(); assert.equal(conversions, widthBoundConversions);
    assert.deepEqual(canvas.rendered, widthBound); assert.equal(get('counts').textContent, '0 / 39,440');
    get('size-open').click(); assert.equal(get('photo-size').value, 70);
    get('photo-size').value = '30'; get('photo-size').dispatchEvent(new Event('input'));
    const escape = new Event('keydown', { cancelable: true }); Object.assign(escape, { key: 'Escape' });
    document.dispatchEvent(escape); assert.equal(get('size-panel').hidden, true);
    assert.deepEqual(canvas.rendered, widthBound);
    // v0.5.0: execute real tool/pointer/reset/return handlers at both qualities.
    const selectTool = name => { get('tools-open').click(); get('tool-' + name).click(); };
    const stroke = (ax, ay, bx, by, kind = 'touch') => {
      const r = canvas.rect, px = x => r.left + x / canvas.width * r.width, py = y => r.top + y / canvas.height * r.height;
      pointer('pointerdown', px(ax), py(ay), kind); pointer('pointermove', px(bx), py(by), kind); pointer('pointerup', px(bx), py(by), kind);
    };
    const renderedMask = () => {
      const out = new Uint8Array(canvas.width * canvas.height), data = canvas.rendered;
      for (let i = 0; i < out.length; i++) out[i] = data[i * 4] === 178 && data[i * 4 + 1] === 191 && data[i * 4 + 2] === 184 ? 1 : 0;
      return out;
    };
    const renderedSand = () => {
      const out = new Uint8Array(canvas.width * canvas.height), data = canvas.rendered;
      for (let i = 0; i < out.length; i++) out[i] = data[i * 4] === 255 && data[i * 4 + 1] === 255 && data[i * 4 + 2] === 255 ? 1 : 0;
      return out;
    };
    const wallCount = () => Number(get('wall-count').textContent.replaceAll(',', ''));
    for (const quality of ['standard', 'high']) {
      get('quality').value = quality; get('quality').dispatchEvent(new Event('change')); get('sample').click();
      canvas.rect = { left: 12, top: 25, width: 180, height: 300 };
      const w = canvas.width, h = canvas.height, count = get('total').textContent, originalSand = renderedSand();
      assert.equal(get('tools-open').hidden, false); assert.equal(get('tool-sand').attributes['aria-pressed'], 'true');
      selectTool('draw'); assert.equal(get('tools-panel').hidden, true); assert.equal(get('tools-open').textContent, '壁を描く');
      stroke(w * .1, h * .72, w * .9, h * .72, quality === 'high' ? 'mouse' : 'touch');
      assert.ok(wallCount() > 0); assert.equal(get('counts').textContent, `${count} / 0`);
      assert.deepEqual(renderedSand(), originalSand);
      const firstWalls = renderedMask(), firstCount = wallCount();
      assert.equal(firstWalls.reduce((a, b) => a + b, 0), firstCount);
      // Drawing inside the intact opaque photo must neither make walls nor brush sand.
      stroke(w * .3, h * .2, w * .7, h * .2); assert.equal(wallCount(), firstCount);
      assert.deepEqual(renderedSand(), originalSand);
      selectTool('erase'); stroke(w / 2, h * .72, w / 2, h * .72);
      assert.ok(wallCount() < firstCount && wallCount() > 0); assert.deepEqual(renderedSand(), originalSand);
      const cutWalls = renderedMask(), cutCount = wallCount();
      get('reset').click(); assert.deepEqual(renderedMask(), cutWalls); assert.equal(wallCount(), cutCount);

      get('image-open').click(); assert.equal(get('image-walls-warning').hidden, false); get('image-close').click();
      get('settings-open').click(); assert.equal(get('quality-walls-warning').hidden, false); get('settings-close').click();
      selectTool('sand'); stroke(w / 2, h * .2, w / 2, h * .2);
      assert.notEqual(get('counts').textContent, `${count} / 0`);
      get('reassemble').click(); assert.equal(canvas.attributes['data-reassembling'], 'true');
      assert.equal(get('tools-open').disabled, true);
      const duringReturn = wallCount();
      get('tool-erase').dispatchEvent(new Event('click')); get('walls-clear').dispatchEvent(new Event('click'));
      stroke(0, h * .72, w - 1, h * .72); assert.equal(wallCount(), duringReturn);
      get('reset').click(); assert.deepEqual(renderedMask(), cutWalls);

      // Build a wall in vacated original cells; only those exact overlaps vanish.
      get('collapse').click(); for (let i = 0; i < 130; i++) tick();
      selectTool('draw'); stroke(w * .4, Math.floor(h * .08), w * .6, Math.floor(h * .08));
      const beforeReturn = renderedMask(), beforeReturnCount = wallCount(), expected = beforeReturn.slice();
      for (let i = 0; i < expected.length; i++) if (originalSand[i]) expected[i] = 0;
      assert.ok(expected.reduce((a, b) => a + b, 0) < beforeReturnCount);
      get('reassemble').click(); tick(500); assert.equal(wallCount(), beforeReturnCount);
      stroke(0, h * .72, w - 1, h * .72); assert.equal(wallCount(), beforeReturnCount);
      tick(1000); assert.deepEqual(renderedMask(), expected); assert.deepEqual(renderedSand(), originalSand);
      assert.equal(get('message').textContent, '画像と重なる壁を取り除きました');
      tick(3600); assert.equal(get('message').hidden, true);
      const retained = renderedMask(), retainedCount = wallCount(), freeImage = canvas.rendered.slice();
      get('mode-hourglass').click(); assert.equal(get('tools-open').hidden, true);
      get('tools-open').dispatchEvent(new Event('click')); assert.equal(get('tools-panel').hidden, true);
      get('size-open').click(); get('photo-size').value = '75'; get('photo-size').dispatchEvent(new Event('input')); get('size-apply').click();
      get('mode-free').click(); assert.equal(get('tools-open').hidden, false);
      assert.deepEqual(canvas.rendered, freeImage); assert.equal(wallCount(), retainedCount);
      get('size-open').click(); get('photo-size').value = '30'; get('photo-size').dispatchEvent(new Event('input'));
      assert.match(get('size-warning').textContent, /壁も初期化/); get('size-close').click();
      assert.deepEqual(renderedMask(), retained);
      get('size-open').click(); get('size-apply').click(); assert.deepEqual(renderedMask(), retained);
      get('image-file').files = []; get('image-file').dispatchEvent(new Event('change')); assert.deepEqual(renderedMask(), retained);
      decodeFailure = true; get('image-file').files = [new File(['bad'], 'paths-broken.png', { type: 'image/png' })];
      get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve)); decodeFailure = false;
      assert.deepEqual(renderedMask(), retained); assert.equal(wallCount(), retainedCount);
      // Keep the next quality's initial tool assertion independent of this iteration.
      selectTool('sand');
    }
    const beforeFailedQuality = renderedMask(); failConversionAt = conversions + 2;
    get('quality').value = 'standard'; get('quality').dispatchEvent(new Event('change'));
    assert.equal(get('quality').value, 'high'); assert.deepEqual(renderedMask(), beforeFailedQuality);
    get('tools-open').click(); get('walls-clear').click(); assert.equal(wallCount(), 0);
    assert.equal(get('walls-clear').disabled, true); get('tools-close').click();
    selectTool('draw'); stroke(0, canvas.height * .85, canvas.width - 1, canvas.height * .85);
    assert.ok(wallCount() > 0);
    get('quality').value = 'standard'; get('quality').dispatchEvent(new Event('change')); assert.equal(wallCount(), 0);
    stroke(0, 240, 179, 240); assert.ok(wallCount() > 0); get('sample').click(); assert.equal(wallCount(), 0);
    stroke(0, 240, 179, 240); assert.ok(wallCount() > 0);
    imageWidth = 600; imageHeight = 1000;
    get('image-file').files = [new File(['ok'], 'paths-new.png', { type: 'image/png' })];
    get('image-file').dispatchEvent(new Event('change')); await new Promise(resolve => setImmediate(resolve)); assert.equal(wallCount(), 0);
    stroke(0, 280, 179, 280); const sizeWalls = renderedMask(); assert.ok(wallCount() > 0);
    get('size-open').click(); get('photo-size').value = '80'; get('photo-size').dispatchEvent(new Event('input'));
    assert.equal(get('size-warning').hidden, false); failConversionAt = conversions + 1;
    get('size-apply').click(); get('size-close').click(); assert.deepEqual(renderedMask(), sizeWalls);
    get('size-open').click(); get('photo-size').value = '80'; get('photo-size').dispatchEvent(new Event('input')); get('size-apply').click();
    assert.equal(wallCount(), 0); assert.equal(get('counts').textContent, '34,560 / 0');
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
