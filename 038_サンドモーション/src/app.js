import { SandEngine } from './engine.js';
import { sampleImage, decodeImage, convertImage } from './image.js';
import { TiltController, isMobileDevice, isLandscapeDisplay } from './tilt.js';
import { canvasPoint } from './input.js';

const $ = id => document.getElementById(id);
const canvas = $('sand'), context = canvas.getContext('2d');
let engine, pixels, source = sampleImage(), sourceName = 'サンプル：山と砂丘';
let pointer = null, loadToken = 0;
let accumulator = 0, previousTime = 0, frames = 0, fpsStart = 0;
let physicsTime = 0, measuredSteps = 0;
const STEP = 1000 / 60, MAX_STEPS = 4;

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

function loadSource() {
  const light = $('quality').value === 'light';
  const next = new SandEngine(light ? 120 : 180, light ? 200 : 300);
  next.load(convertImage(source, next.width, next.height));
  // Keep the selected gravity across image/quality changes.
  if (engine) next.setGravity(engine.gravity.x, engine.gravity.y);
  // Gravity changes wake free grains; a freshly imported image stays fixed/asleep.
  next.active.fill(0);
  engine = next;
  canvas.width = engine.width; canvas.height = engine.height;
  pixels = context.createImageData(engine.width, engine.height);
  $('source-name').textContent = sourceName;
  $('grid-label').textContent = $('grid').textContent = `${engine.width} × ${engine.height}`;
  $('state-label').textContent = '触れると、ほどける。';
  accumulator = 0;
  pointer = null;
  updateStats(); fitCanvas(); draw();
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
  for (let id = 0; id < engine.count; id++) {
    const index = (engine.y[id] * engine.width + engine.x[id]) * 4, color = id * 4;
    pixels.data[index] = engine.colors[color];
    pixels.data[index + 1] = engine.colors[color + 1];
    pixels.data[index + 2] = engine.colors[color + 2];
    pixels.data[index + 3] = engine.colors[color + 3];
  }
  context.putImageData(pixels, 0, 0);
}

function updateStats() {
  $('total').textContent = engine.count.toLocaleString();
  $('counts').textContent = `${engine.fixedCount.toLocaleString()} / ${(engine.count - engine.fixedCount).toLocaleString()}`;
  $('gravity').textContent = `${engine.gravity.x}, ${engine.gravity.y}`;
}

function frame(time) {
  if (tilt.paused) {
    // Never accumulate time during rotation; keep drawing the preserved image.
    previousTime = 0; accumulator = 0;
    draw(); requestAnimationFrame(frame); return;
  }
  if (!previousTime) previousTime = time;
  accumulator += Math.min(time - previousTime, STEP * MAX_STEPS);
  previousTime = time;
  let steps = 0;
  while (accumulator >= STEP && steps < MAX_STEPS) {
    const start = performance.now(); engine.step();
    physicsTime += performance.now() - start; measuredSteps++;
    accumulator -= STEP; steps++;
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
  const factor = moving ? 12 / dt : 0;
  // Brush size is expressed in standard-grid cells, consistent across quality.
  engine.brushSegment(from.x, from.y, to.x, to.y,
    Number($('radius').value) * engine.width / 180,
    (to.x - from.x) * factor, (to.y - from.y) * factor);
  $('state-label').textContent = 'なぞって、砂を動かそう。';
}

canvas.addEventListener('pointerdown', event => {
  if (tilt.paused || pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); canvas.setPointerCapture(event.pointerId);
  const p = point(event); pointer = { ...p, id: event.pointerId };
  brush(p, p, false);
});
canvas.addEventListener('pointermove', event => {
  if (tilt.paused || !pointer || event.pointerId !== pointer.id) return;
  event.preventDefault();
  const p = point(event); brush(pointer, p, true); pointer = { ...p, id: event.pointerId };
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
  if (pointer?.id === event.pointerId) pointer = null;
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
$('collapse').addEventListener('click', () => {
  engine.releaseAll(); updateStats(); $('state-label').textContent = '景色が、砂に還る。';
});
$('reset').addEventListener('click', () => {
  engine.reset(); accumulator = 0; updateStats(); draw();
  $('state-label').textContent = '触れると、ほどける。';
});
const directionNames = { '0,1': '下', '0,-1': '上', '-1,0': '左', '1,0': '右',
  '-1,-1': '左上', '1,-1': '右上', '-1,1': '左下', '1,1': '右下' };
function applyGravity(x, y) {
  // Sensor events may arrive at 60 Hz. Only a direction change needs to wake
  // grains or rewrite the gravity controls/diagnostics.
  if (engine.gravity.x === x && engine.gravity.y === y) return;
  engine.setGravity(x, y);
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === `${x},${y}`)));
  $('gravity-label').textContent = `${directionNames[`${x},${y}`]}向きに流れる`; updateStats();
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
  onGravity: applyGravity,
  onState: state => {
    const paused = state.paused;
    $('tilt-start').textContent = state.starting ? 'センサーを確認中…' : '傾きで操作';
    $('tilt-start').disabled = state.starting || state.mode === 'tilt';
    $('tilt-start').setAttribute('aria-pressed', String(state.mode === 'tilt'));
    $('calibrate').disabled = state.mode !== 'tilt' || paused;
    $('input-mode').textContent = state.mode === 'tilt' ? '傾き' : '手動';
    $('tilt-status').textContent = state.reason;
    $('rotation-pause').hidden = !paused;
    $('rotation-title').textContent = state.pauseReason === 'landscape' ? 'iPhoneを縦に戻してください' : '傾きが安定するのを待っています…';
    $('stage').classList.toggle('paused', paused);
    for (const id of ['collapse', 'reset', 'sample', 'quality', 'image-file']) $(id).disabled = paused;
    // Cancel the old touch path. The next pointer uses the latest Canvas rect.
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null; previousTime = 0; accumulator = 0;
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
$('quality').addEventListener('change', () => {
  try { loadSource(); message('品質を変更し、画像を初期状態に戻しました。'); }
  catch (error) { message(error.message, true); }
});
$('radius').addEventListener('input', () => { $('radius-output').value = $('radius').value; });
$('info').addEventListener('click', () => {
  const open = $('diagnostics').hidden;
  $('diagnostics').hidden = !open; $('info').setAttribute('aria-expanded', String(open)); updateStats();
});
$('sample').addEventListener('click', () => {
  loadToken++; source = sampleImage(); sourceName = 'サンプル：山と砂丘'; loadSource();
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
    // Convert before assigning the new source to keep failed imports transactional.
    const particles = convertImage(image, engine.width, engine.height);
    if (!particles.length) throw new Error('不透明なピクセルがありません。別の画像を選択してください。');
    source = image; sourceName = file.name; loadSource();
    message('画像を読み込みました。触れて崩してみましょう。');
  } catch (error) { if (token === loadToken) message(error.message, true); }
  finally { event.target.value = ''; }
});
document.addEventListener('visibilitychange', () => { previousTime = 0; accumulator = 0; fpsStart = performance.now(); frames = 0; });
new ResizeObserver(fitCanvas).observe($('stage'));
loadSource(); fpsStart = performance.now(); requestAnimationFrame(frame);
