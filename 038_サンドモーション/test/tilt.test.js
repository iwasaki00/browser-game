import test from 'node:test';
import assert from 'node:assert/strict';
import { TiltMapper, TiltController, TILT, orientationRoll, isLandscapeDisplay, isMobileDevice } from '../src/tilt.js';
import { canvasPoint } from '../src/input.js';
import { SandEngine } from '../src/engine.js';

// Physical upright roll: beta/gamma representation changes near beta=90.
function sample(degrees) {
  const angle = degrees * Math.PI / 180;
  return { beta: Math.asin(Math.cos(angle)) * 180 / Math.PI, gamma: degrees === 0 ? 0 : Math.sign(degrees) * 90 };
}
function rig({ permission, secure = true, supported = true, mobile = true, parameters = {} } = {}) {
  let time = 0, landscape = false, hidden = false;
  const listeners = new Set(), timers = new Set(), gravities = [], states = [];
  let permissions = 0;
  const orientation = permission === undefined ? {} : { requestPermission: () => { permissions++; return permission(); } };
  const env = { isSecureContext: secure, DeviceOrientationEvent: supported ? orientation : undefined,
    now: () => time, mobile: () => mobile, landscape: () => landscape, hidden: () => hidden,
    addEventListener: (type, fn) => { assert.equal(type, 'deviceorientation'); listeners.add(fn); },
    removeEventListener: (type, fn) => listeners.delete(fn),
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn) };
  const controller = new TiltController(env, { onGravity: (x, y) => gravities.push([x, y]),
    onState: c => states.push({ mode: c.mode, paused: c.paused }) }, parameters);
  return { controller, env, gravities, states, listeners, timers,
    get permissions() { return permissions; },
    advance: ms => { time += ms; for (const timer of timers) timer(); },
    emit: (roll, ms = 20) => { time += ms; for (const listener of listeners) listener(sample(roll)); },
    raw: value => { for (const listener of listeners) listener(value); },
    display: value => { landscape = value; controller.updateDisplay(); },
    hidden: value => { hidden = value; },
    hold: (roll, samples = 60) => { for (let i = 0; i < samples; i++) { time += 20; for (const listener of listeners) listener(sample(roll)); } }
  };
}

test('upright projection handles beta/gamma discontinuity; invalid/flat values rejected', () => {
  for (const roll of [-70, -30, -12, 0, 12, 30, 70]) assert.ok(Math.abs(orientationRoll(sample(roll)) - roll) < 0.00001);
  for (const event of [{ beta: null, gamma: 0 }, { beta: 90, gamma: null }, { beta: NaN, gamma: 0 },
    { beta: 181, gamma: 0 }, { beta: 0, gamma: 0 }]) assert.equal(orientationRoll(event), null);
  assert.ok(orientationRoll({ beta: 60, gamma: 20 }) > 0);
  assert.ok(orientationRoll({ beta: 60, gamma: -20 }) < 0);
});

test('baseline is down; light roll is diagonal, moderate roll is sideways, return is down', () => {
  const mapper = new TiltMapper(); let time = 0;
  const hold = degrees => { let result; for (let i = 0; i < 70; i++) result = mapper.update(degrees, time += 20); return result; };
  assert.deepEqual(hold(17), [0, 1]);
  assert.deepEqual(hold(32), [1, 1]); // 15 degrees from calibrated hold.
  assert.deepEqual(hold(52), [1, 0]);
  assert.deepEqual(hold(17), [0, 1]);
  assert.deepEqual(hold(2), [-1, 1]);
  assert.deepEqual(hold(-18), [-1, 0]);
  assert.deepEqual(hold(17), [0, 1]);
  mapper.calibrate(-18); assert.deepEqual(hold(-18), [0, 1]);
});

test('dead zone, smoothing and hysteresis avoid boundary chatter', () => {
  const m = new TiltMapper(); let t = 0;
  m.calibrate(0);
  for (let i = 0; i < 100; i++) assert.deepEqual(m.update(i % 2 ? 3 : -3, t += 20), [0, 1]);
  for (let i = 0; i < 100; i++) assert.deepEqual(m.update(i % 2 ? 9.5 : 8.5, t += 20), [0, 1]);
  let output;
  for (let i = 0; i < 60; i++) output = m.update(15, t += 20);
  assert.deepEqual(output, [1, 1]);
  for (let i = 0; i < 100; i++) assert.deepEqual(m.update(i % 2 ? 9.5 : 8.5, t += 20), [1, 1]);
  for (let i = 0; i < 60; i++) output = m.update(0, t += 20);
  assert.deepEqual(output, [0, 1]);
  assert.deepEqual(m.update(40, t += 1), [0, 1]); // One noisy sample is smoothed.
});

test('starts only on explicit request, requests permission synchronously, calibrates first value', async () => {
  const r = rig({ permission: () => Promise.resolve('granted') });
  assert.equal(r.permissions, 0); assert.equal(r.listeners.size, 0); assert.equal(r.controller.mode, 'manual');
  const promise = r.controller.start(); assert.equal(r.permissions, 1);
  await promise; assert.equal(r.controller.mode, 'manual');
  r.emit(18); assert.equal(r.controller.mode, 'tilt'); assert.deepEqual(r.gravities.at(-1), [0, 1]);
  r.hold(53); assert.deepEqual(r.gravities.at(-1), [1, 0]);
  assert.equal(r.controller.calibrate(), true); assert.deepEqual(r.gravities.at(-1), [0, 1]);
  r.hold(53); assert.deepEqual(r.gravities.at(-1), [0, 1]);
});

test('insecure and unsupported environments explain failure and keep manual input', async () => {
  for (const [options, reason] of [[{ secure: false }, /HTTPS/], [{ supported: false }, /対応/]]) {
    const r = rig(options); await r.controller.start();
    assert.equal(r.controller.mode, 'manual'); assert.match(r.controller.reason, reason);
    assert.equal(r.listeners.size, 0); assert.equal(r.gravities.length, 0);
  }
});

test('permission denied or error preserves manual gravity and cleans listeners', async () => {
  for (const permission of [() => Promise.resolve('denied'), () => Promise.reject(new Error('blocked')),
    () => { throw new Error('synchronous failure'); }]) {
    const r = rig({ permission }); await r.controller.start();
    assert.equal(r.controller.mode, 'manual'); assert.equal(r.controller.starting, false);
    assert.match(r.controller.reason, /手動/); assert.equal(r.listeners.size, 0); assert.equal(r.timers.size, 0);
    assert.equal(r.gravities.length, 0);
  }
});

test('first-sample wait lasts beyond 5 seconds; null and flat samples never become baseline', async () => {
  const r = rig(); await r.controller.start(); r.raw({ beta: null, gamma: null });
  r.raw({ beta: 0, gamma: 0 });
  r.advance(6000); assert.equal(r.controller.mode, 'manual'); assert.equal(r.controller.starting, true);
  assert.match(r.controller.reason, /端末を傾けてください/);
  assert.equal(r.listeners.size, 1); assert.equal(r.controller.mapper.baseline, null);
  assert.deepEqual(r.gravities, []); // The app's previous manual gravity is untouched.
  const event = new Event('deviceorientation'); Object.assign(event, { beta: 0, gamma: -35 });
  assert.equal(event.isTrusted, false); r.raw(event);
  assert.equal(r.controller.mode, 'tilt'); assert.deepEqual(r.gravities.at(-1), [0, 1]);
  const next = new Event('deviceorientation'); Object.assign(next, { beta: 0, gamma: 35 });
  for (let i = 0; i < 50; i++) { r.advance(20); r.raw(next); }
  assert.notDeepEqual(r.gravities.at(-1), [0, 1]);
});

test('manual arrow cancellation during first-sample wait removes the listener', async () => {
  const r = rig(); await r.controller.start(); r.advance(10000); r.controller.manual();
  assert.equal(r.listeners.size, 0); assert.equal(r.timers.size, 0);
  assert.equal(r.controller.starting, false); r.emit(35); assert.equal(r.controller.mode, 'manual');
});

test('active tilt: repeated unchanged samples for 6 seconds still allow reversing', async () => {
  const r = rig(); await r.controller.start(); r.emit(0); r.hold(35);
  assert.deepEqual(r.gravities.at(-1), [1, 0]);
  for (let i = 0; i < 60; i++) { r.emit(35, 100); r.advance(0); }
  r.hold(-35); assert.equal(r.controller.mode, 'tilt'); assert.deepEqual(r.gravities.at(-1), [-1, 0]);
});

test('active tilt: a 6-second event gap still triggers the separate stream-loss fallback', async () => {
  const r = rig(); await r.controller.start(); r.emit(0); r.hold(35);
  r.advance(6000); assert.equal(r.controller.mode, 'manual'); assert.equal(r.listeners.size, 0);
  assert.match(r.controller.reason, /受信できません/);
  const previous = r.gravities.at(-1); r.hold(-35); assert.deepEqual(r.gravities.at(-1), previous);
});

test('manual return removes sensor handlers and ignores late permission resolution', async () => {
  let allow;
  const r = rig({ permission: () => new Promise(resolve => { allow = resolve; }) });
  const pending = r.controller.start(); r.controller.manual(); allow('granted'); await pending;
  assert.equal(r.listeners.size, 0); assert.equal(r.controller.mode, 'manual');
  const s = rig(); await s.controller.start(); s.emit(0); s.controller.manual();
  s.hold(40); assert.equal(s.controller.mode, 'manual'); assert.deepEqual(s.gravities, [[0, 1]]);
  assert.equal(s.timers.size, 0);
});

test('physical tilt alone never pauses; mobile landscape pauses until stable portrait samples', async () => {
  const r = rig(); await r.controller.start(); r.emit(0); r.hold(45);
  assert.equal(r.controller.paused, false);
  r.display(true); assert.equal(r.controller.pauseReason, 'landscape');
  const changes = r.gravities.length, baseline = r.controller.mapper.baseline;
  r.hold(-30); assert.equal(r.gravities.length, changes);
  r.display(false); assert.equal(r.controller.pauseReason, 'settling');
  for (let i = 0; i < 30; i++) r.emit(i % 2 ? 20 : -20);
  assert.equal(r.controller.paused, true);
  r.hold(0, 10); assert.equal(r.controller.paused, true);
  r.hold(0, 20); assert.equal(r.controller.paused, false);
  assert.equal(r.controller.mapper.baseline, baseline);
  assert.deepEqual(r.gravities.at(-1), [0, 1]);
});

test('sample gaps cannot count as stable input; landscape manual switch resumes immediately', async () => {
  const r = rig(); await r.controller.start(); r.emit(0); r.display(true); r.display(false);
  r.emit(0); r.advance(1000); r.emit(0);
  assert.equal(r.controller.paused, true);
  r.display(true); r.controller.manual(); assert.equal(r.controller.paused, false);
});

test('PC and manual mode do not pause on landscape; starting in landscape waits safely', async () => {
  const pc = rig({ mobile: false }); await pc.controller.start(); pc.emit(0); pc.display(true);
  assert.equal(pc.controller.paused, false);
  const mobile = rig(); mobile.display(true); assert.equal(mobile.controller.paused, false);
  await mobile.controller.start(); mobile.emit(0); assert.equal(mobile.controller.paused, true);
  assert.equal(mobile.gravities.length, 0);
});

test('screen display orientation is independent of sensor values or keyboard viewport', () => {
  assert.equal(isLandscapeDisplay({ type: 'portrait-primary', width: 800, height: 300 }), false);
  assert.equal(isLandscapeDisplay({ type: 'landscape-primary', width: 300, height: 800 }), true);
  assert.equal(isLandscapeDisplay({ legacyAngle: -90, width: 300, height: 800 }), true);
  assert.equal(isLandscapeDisplay({ legacyAngle: 0, width: 800, height: 300 }), false);
  assert.equal(isLandscapeDisplay({ width: 800, height: 300 }), true);
  assert.equal(isMobileDevice({ userAgent: 'iPhone' }), true);
  assert.equal(isMobileDevice({ userAgent: 'Windows', maxTouchPoints: 10 }), false);
});

test('rotation retains engine arrays and baseline, sensor input never releases fixed grains', async () => {
  const e = new SandEngine(20, 30);
  e.load(Array.from({ length: 30 }, (_, id) => ({ x: id % 10 + 5, y: Math.floor(id / 10) + 3, color: [id, 80, 120, 255] })));
  const r = rig();
  r.controller.onGravity = (x, y) => { if (x !== e.gravity.x || y !== e.gravity.y) e.setGravity(x, y); };
  await r.controller.start(); r.emit(0); r.hold(35);
  for (let i = 0; i < 30; i++) e.step();
  assert.equal(e.fixedCount, e.count); assert.deepEqual(e.x, e.originX); assert.deepEqual(e.y, e.originY);
  e.brushSegment(6, 4, 9, 4, 1); for (let i = 0; i < 10; i++) e.step();
  const names = ['grid', 'x', 'y', 'originX', 'originY', 'colors', 'fixed', 'active', 'vx', 'vy'];
  const refs = names.map(name => e[name]); const snapshot = refs.map(array => array.slice());
  const count = e.count, fixed = e.fixedCount, seed = e.seed, tick = e.tick;
  const baseline = r.controller.mapper.baseline;
  r.display(true); r.hold(-40); r.display(false); r.hold(0, 8);
  for (let i = 0; i < names.length; i++) { assert.equal(e[names[i]], refs[i]); assert.deepEqual(e[names[i]], snapshot[i]); }
  assert.equal(e.count, count); assert.equal(e.fixedCount, fixed); assert.equal(e.seed, seed); assert.equal(e.tick, tick);
  r.hold(0, 30); assert.equal(r.controller.paused, false);
  for (const name of ['x', 'y', 'colors', 'fixed']) assert.deepEqual(e[name], snapshot[names.indexOf(name)]);
  assert.equal(r.controller.mapper.baseline, baseline); assert.ok(e.assertIntegrity());
});

test('pointer coordinates use the new rectangle after display rotation', () => {
  let rect = { left: 20, top: 30, width: 180, height: 300 };
  const canvas = { getBoundingClientRect: () => rect }, e = { width: 180, height: 300 };
  assert.deepEqual(canvasPoint({ clientX: 110, clientY: 180, timeStamp: 1 }, canvas, e), { x: 90, y: 150, time: 1 });
  rect = { left: 120, top: 50, width: 90, height: 150 };
  assert.deepEqual(canvasPoint({ clientX: 165, clientY: 125, timeStamp: 2 }, canvas, e), { x: 90, y: 150, time: 2 });
});
