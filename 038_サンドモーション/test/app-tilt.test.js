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
  let conversions = 0;
  class Canvas extends Element {
    constructor() {
      super(); this.width = 180; this.height = 300; this.capture = null;
      this.rect = { left: 10, top: 20, width: 180, height: 300 };
      this.context = {
        createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {}, drawImage() {},
        getImageData: (x, y, w, h) => { conversions++; return { data: new Uint8ClampedArray(w * h * 4).fill(255) }; },
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
    performance: { now: () => now }, ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => { frame = fn; } };
  const originals = new Map(Object.keys(replacements).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(replacements)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  const sensor = (roll = 0) => {
    now += 20;
    const event = new Event('deviceorientation');
    Object.assign(event, { beta: Math.asin(Math.cos(roll * Math.PI / 180)) * 180 / Math.PI, gamma: roll ? Math.sign(roll) * 90 : 0 });
    window.dispatchEvent(event);
  };
  const tick = (ms = 20) => { now += ms; frame(now); };
  const pointer = (type, x, y) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0 });
    get('sand').dispatchEvent(event);
  };
  try {
    await import('../src/app.js');
    const canvas = get('sand'), initial = canvas.rendered.slice();
    assert.equal(get('counts').textContent, '17,670 / 0');
    get('tilt-start').click(); await Promise.resolve(); sensor();
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
    assert.equal(get('reset').disabled, true);
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
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
