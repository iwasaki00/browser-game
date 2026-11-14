import { HourglassEngine, hourglassPlacement } from './hourglass.js';
import { SandEngine } from './engine.js';
import { sampleImage, decodeImage, convertImage } from './image.js';
import { TiltController, isMobileDevice, isLandscapeDisplay } from './tilt.js';
import { canvasPoint } from './input.js';
import { QUALITIES, simulationTiming } from './quality.js';
import { Reassembly } from './reassembly.js';

const $ = id => document.getElementById(id);
const canvas = $('sand'), context = canvas.getContext('2d');
let engine, pixels, source = sampleImage(), sourceName = 'サンプル：山と砂丘';
let pointer = null, loadToken = 0;
let accumulator = 0, previousTime = 0, frames = 0, fpsStart = 0;
let physicsTime = 0, measuredSteps = 0;
let reassembly, modes, mode = 'free', quality = 'standard';
const sensorGravity = { x: 0, y: 1 };
const MAX_FRAME_MS = 1000 / 60 * 4;
let timing = simulationTiming(180);

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

function loadSource(nextSource = source, nextName = sourceName) {
  const nextQuality = $('quality').value || 'standard';
  const { width, height } = QUALITIES[nextQuality] || QUALITIES.standard;
  const free = new SandEngine(width, height), hourglass = new HourglassEngine(width, height);
  free.load(convertImage(nextSource, width, height));
  hourglass.load(convertImage(nextSource, width, height, hourglassPlacement(
    nextSource.naturalWidth || nextSource.width, nextSource.naturalHeight || nextSource.height, width, height)));
  if (!free.count || !hourglass.count) throw new Error('不透明なピクセルがありません。別の画像を選択してください。');
  if (modes) {
    free.setGravity(modes.free.engine.gravity.x, modes.free.engine.gravity.y);
    hourglass.setGravity(modes.hourglass.engine.gravity.x, 1);
  }
  free.active.fill(0); hourglass.active.fill(0);
  // Commit only after BOTH imports succeed; cancelled/failed loads keep both states.
  endPointer(); modes?.free.reassembly.cancel();
  modes = { free: { engine: free, reassembly: new Reassembly(free) },
    hourglass: { engine: hourglass, reassembly: new Reassembly(hourglass) } };
  source = nextSource; sourceName = nextName; quality = nextQuality;
  $('source-name').textContent = sourceName;
  activateMode(mode);
}

function activateMode(nextMode) {
  endPointer(); mode = nextMode;
  ({ engine, reassembly } = modes[mode]);
  timing = simulationTiming(engine.width);
  canvas.width = engine.width; canvas.height = engine.height;
  pixels = context.createImageData(engine.width, engine.height);
  $('grid-label').textContent = $('grid').textContent = engine.width + ' × ' + engine.height;
  $('state-label').textContent = mode === 'free' ? '触れると、ほどける。' : '砂を流して、色の積もり方を見てみよう。';
  accumulator = 0; previousTime = 0; frames = 0; fpsStart = performance.now();
  physicsTime = 0; measuredSteps = 0;
  if (tilt.mode === 'tilt') applyGravity(sensorGravity.x, sensorGravity.y);
  updateStats(); fitCanvas(); syncControls(); draw();
}

function fitCanvas() {
  if (!engine) return;
  const stage = $('stage');
  const scale = Math.min((stage.clientWidth - 24) / engine.width, (stage.clientHeight - 72) / engine.height);
  canvas.style.width = `${engine.width * scale}px`;
  canvas.style.height = `${engine.height * scale}px`;
  // Resize changes presentation only; the simulation grid is never rebuilt.
}

function draw() {
  pixels.data.fill(0);
  if (mode === 'hourglass') for (let cell = 0; cell < engine.grid.length; cell++) {
    if (!engine.container.walls[cell]) continue;
    const i = cell * 4, edge = engine.container.outline[cell];
    pixels.data[i] = edge ? 129 : 20; pixels.data[i + 1] = edge ? 157 : 25;
    pixels.data[i + 2] = edge ? 149 : 28; pixels.data[i + 3] = 255;
  }
  for (let id = 0; id < engine.count; id++) {
    const x = reassembly.active ? Math.round(reassembly.drawX[id]) : engine.x[id];
    const y = reassembly.active ? Math.round(reassembly.drawY[id]) : engine.y[id];
    const index = (y * engine.width + x) * 4, color = id * 4;
    pixels.data[index] = engine.colors[color];
    pixels.data[index + 1] = engine.colors[color + 1];
    pixels.data[index + 2] = engine.colors[color + 2];
    pixels.data[index + 3] = engine.colors[color + 3];
  }
  context.putImageData(pixels, 0, 0);
}

function updateStats() {
  $('total').textContent = engine.count.toLocaleString();
  $('hourglass-remaining').textContent = mode === 'hourglass' ? engine.upperCount().toLocaleString() + ' / 穴 ' + engine.container.neckWidth + 'セル' : '—';
  $('counts').textContent = `${engine.fixedCount.toLocaleString()} / ${(engine.count - engine.fixedCount).toLocaleString()}`;
  $('gravity').textContent = `${engine.gravity.x}, ${engine.gravity.y}`;
  $('reassembly-progress').textContent = reassembly?.active ? `${Math.round(reassembly.elapsedMs / reassembly.durationMs * 100)}%` : '待機';
}

function frame(time) {
  if (tilt.paused) {
    // Never accumulate time during rotation; keep drawing the preserved image.
    previousTime = 0; accumulator = 0;
    draw(); requestAnimationFrame(frame); return;
  }
  if (!previousTime) previousTime = time;
  const delta = Math.max(0, time - previousTime);
  previousTime = time;
  let steps = 0;
  if (reassembly.active) {
    accumulator = 0;
    if (reassembly.advance(delta)) {
      $('state-label').textContent = '元の景色に戻りました。触れて崩せます。';
      updateStats(); syncControls();
    }
  } else {
    accumulator += Math.min(delta, MAX_FRAME_MS);
    while (accumulator >= timing.stepMs && steps < timing.maxSteps) {
      const start = performance.now(); engine.step();
      physicsTime += performance.now() - start; measuredSteps++;
      accumulator -= timing.stepMs; steps++;
    }
  }
  draw(); frames++;
  if (time - fpsStart >= 750) {
    $('fps').textContent = (frames * 1000 / (time - fpsStart)).toFixed(0);
    $('physics-ms').textContent = `${(physicsTime / Math.max(1, measuredSteps)).toFixed(2)} ms`;
    frames = 0; fpsStart = time; physicsTime = 0; measuredSteps = 0;
    updateStats();
  }
  requestAnimationFrame(frame);
}

function point(event) {
  return canvasPoint(event, canvas, engine);
}

function brush(from, to, moving) {
  const dt = Math.max(8, to.time - from.time);
  const factor = moving ? 12 / dt / timing.motionScale : 0;
  // Brush size is expressed in standard-grid cells, consistent across quality.
  engine.brushSegment(from.x, from.y, to.x, to.y,
    Number($('radius').value) * engine.width / 180,
    (to.x - from.x) * factor, (to.y - from.y) * factor);
  $('state-label').textContent = 'なぞって、砂を動かそう。';
}

canvas.addEventListener('pointerdown', event => {
  if (mode !== 'free' || tilt.paused || reassembly.active || pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); canvas.setPointerCapture(event.pointerId);
  const p = point(event); pointer = { ...p, id: event.pointerId };
  brush(p, p, false);
});
canvas.addEventListener('pointermove', event => {
  if (mode !== 'free' || tilt.paused || reassembly.active || !pointer || event.pointerId !== pointer.id) return;
  event.preventDefault();
  const p = point(event); brush(pointer, p, true); pointer = { ...p, id: event.pointerId };
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
  if (pointer?.id === event.pointerId) pointer = null;
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
$('collapse').addEventListener('click', () => {
  if (tilt.paused || reassembly.active) return;
  engine.releaseAll(); updateStats(); syncControls(); $('state-label').textContent = '景色が、砂に還る。';
});
$('reset').addEventListener('click', () => {
  reassembly.cancel(); endPointer(); previousTime = 0;
  engine.reset(); accumulator = 0; updateStats(); draw();
  syncControls();
  $('state-label').textContent = '触れると、ほどける。';
});
$('reassemble').addEventListener('click', () => {
  if (mode !== 'free' || tilt.paused || reassembly.active) return;
  if (!reassembly.start({ durationMs: Number($('return-duration').value) * 1000,
    arcStrength: Number($('return-arc').value) })) { message('画像は元の状態です。砂を崩してから戻せます。'); return; }
  endPointer(); accumulator = 0; previousTime = performance.now();
  frames = 0; fpsStart = previousTime; physicsTime = 0; measuredSteps = 0;
  $('state-label').textContent = 'ひと粒ずつ、元の景色へ。';
  syncControls(); updateStats();
});
function endPointer() {
  if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
  pointer = null;
}
function syncControls() {
  const paused = tilt.paused, returning = reassembly?.active === true, hourglass = mode === 'hourglass';
  $('mode-free').setAttribute('aria-pressed', String(!hourglass));
  $('mode-hourglass').setAttribute('aria-pressed', String(hourglass));
  $('free-gravity').hidden = hourglass; $('hourglass-gravity').hidden = !hourglass;
  $('reassemble').hidden = hourglass; $('return-settings').hidden = hourglass;
  $('flip').hidden = !hourglass; $('flip').disabled = paused || !engine?.started;
  $('collapse').textContent = hourglass ? '砂を流す' : '一斉崩壊';
  canvas.setAttribute('aria-label', hourglass ? '砂時計の砂。砂を流すボタンで開始します。' : '砂の操作領域。タップで部分崩壊、ドラッグで砂を押します。');
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === engine.gravity.x + ',' + engine.gravity.y)));
  for (const [id, x] of [['left', -1], ['straight', 0], ['right', 1]]) $('hourglass-' + id).setAttribute('aria-pressed', String(hourglass && engine.gravity.x === x));
  $('gravity-label').textContent = hourglass ? ['左寄せ', 'まっすぐ', '右寄せ'][engine.gravity.x + 1] : directionNames[engine.gravity.x + ',' + engine.gravity.y] + '向きに流れる';
  for (const id of ['sample', 'quality', 'image-file']) $(id).disabled = paused;
  $('collapse').disabled = paused || returning;
  $('reassemble').disabled = paused || returning;
  $('reset').disabled = false;
  $('return-duration').disabled = returning; $('return-arc').disabled = returning;
  canvas.setAttribute('data-reassembling', String(returning));
}
const directionNames = { '0,1': '下', '0,-1': '上', '-1,0': '左', '1,0': '右',
  '-1,-1': '左上', '1,-1': '右上', '-1,1': '左下', '1,1': '右下' };
function applyGravity(x, y) {
  if (mode === 'hourglass') { x = Math.sign(x); y = 1; }
  // Sensor events may arrive at 60 Hz. Only a direction change needs to wake
  // grains or rewrite the gravity controls/diagnostics.
  if (engine.gravity.x === x && engine.gravity.y === y) return;
  engine.setGravity(x, y);
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === `${x},${y}`)));
  syncControls(); updateStats();
}
const environment = {
  get isSecureContext() { return window.isSecureContext; },
  get DeviceOrientationEvent() { return window.DeviceOrientationEvent; },
  now: () => performance.now(), hidden: () => document.hidden,
  mobile: () => isMobileDevice(navigator),
  landscape: () => isLandscapeDisplay({ type: screen.orientation?.type, angle: screen.orientation?.angle,
    legacyAngle: window.orientation, width: window.innerWidth, height: window.innerHeight }),
  addEventListener: (...args) => window.addEventListener(...args),
  removeEventListener: (...args) => window.removeEventListener(...args),
  setInterval: (...args) => window.setInterval(...args), clearInterval: id => window.clearInterval(id)
};
const tilt = new TiltController(environment, {
  onGravity: (x, y) => { sensorGravity.x = x; sensorGravity.y = y; applyGravity(x, y); },
  onState: state => {
    const paused = state.paused;
    $('tilt-start').textContent = state.starting ? (state.listening ? '受信待ち…' : 'センサーを確認中…') : '傾きで操作';
    $('tilt-start').disabled = state.starting || state.mode === 'tilt';
    $('tilt-start').setAttribute('aria-pressed', String(state.mode === 'tilt'));
    $('calibrate').disabled = state.mode !== 'tilt' || paused;
    $('input-mode').textContent = state.mode === 'tilt' ? '傾き' : '手動';
    $('tilt-status').textContent = state.reason;
    $('rotation-pause').hidden = !paused;
    $('rotation-title').textContent = state.pauseReason === 'landscape' ? 'iPhoneを縦に戻してください' : '傾きが安定するのを待っています…';
    $('stage').classList.toggle('paused', paused);
    syncControls();
    // Cancel the old touch path. The next pointer uses the latest Canvas rect.
    endPointer(); previousTime = 0; accumulator = 0;
    frames = 0; fpsStart = performance.now();
  }
});
$('tilt-start').addEventListener('click', () => { void tilt.start(); });
$('calibrate').addEventListener('click', () => {
  if (!tilt.calibrate()) $('tilt-status').textContent = '新しい傾きの値を待ってから、もう一度基準を合わせてください。';
});
for (const name of ['resize', 'orientationchange']) window.addEventListener(name, () => { tilt.updateDisplay(); fitCanvas(); });
screen.orientation?.addEventListener('change', () => { tilt.updateDisplay(); fitCanvas(); });
document.querySelectorAll('[data-g]').forEach(button => button.addEventListener('click', () => {
  tilt.manual();
  const [x, y] = button.dataset.g.split(',').map(Number); applyGravity(x, y);
}));
for (const name of ['free', 'hourglass']) $('mode-' + name).addEventListener('click', () => activateMode(name));
for (const [name, x] of [['left', -1], ['straight', 0], ['right', 1]]) $('hourglass-' + name).addEventListener('click', () => {
  if (mode !== 'hourglass') return;
  tilt.manual(); applyGravity(x, 1);
});
$('flip').addEventListener('click', () => {
  if (mode !== 'hourglass' || tilt.paused || !engine.flip()) return;
  endPointer(); accumulator = 0; previousTime = 0;
  updateStats(); draw(); syncControls();
  $('state-label').textContent = 'ひっくり返しました。もう一度、下へ。';
});
$('quality').addEventListener('change', () => {
  try { loadSource(); message('品質を変更し、両モードを初期状態に戻しました。'); }
  catch (error) { $('quality').value = quality; message(error.message, true); }
});
$('radius').addEventListener('input', () => { $('radius-output').value = $('radius').value; });
for (const id of ['return-duration', 'return-arc']) $(id).addEventListener('input', () => {
  $(`${id}-output`).value = id === 'return-duration' ? `${Number($(id).value).toFixed(1)}秒` : Number($(id).value).toFixed(2);
});
$('info').addEventListener('click', () => {
  const open = $('diagnostics').hidden;
  $('diagnostics').hidden = !open; $('info').setAttribute('aria-expanded', String(open)); updateStats();
});
$('sample').addEventListener('click', () => {
  loadToken++; loadSource(sampleImage(), 'サンプル：山と砂丘');
  message('サンプル画像に戻しました。');
});
$('image-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const token = ++loadToken;
  message('画像を読み込んでいます…');
  try {
    const image = await decodeImage(file);
    if (token !== loadToken) return;
    if (tilt.paused) { message('回転による一時停止中のため画像を変更しませんでした。縦に戻して選び直してください。'); return; }
    loadSource(image, file.name);

    message('画像を読み込み、両モードを初期状態に戻しました。');
  } catch (error) { if (token === loadToken) message(error.message, true); }
  finally { event.target.value = ''; }
});
document.addEventListener('visibilitychange', () => { previousTime = 0; accumulator = 0; fpsStart = performance.now(); frames = 0; });
new ResizeObserver(fitCanvas).observe($('stage'));
loadSource(); fpsStart = performance.now(); requestAnimationFrame(frame);
