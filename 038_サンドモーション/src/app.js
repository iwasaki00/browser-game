import { SandEngine } from './engine.js';
import { sampleImage, decodeImage, convertImage } from './image.js';

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
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * engine.width,
    y: (event.clientY - rect.top) / rect.height * engine.height, time: event.timeStamp };
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
  if (pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); canvas.setPointerCapture(event.pointerId);
  const p = point(event); pointer = { ...p, id: event.pointerId };
  brush(p, p, false);
});
canvas.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
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
document.querySelectorAll('[data-g]').forEach(button => button.addEventListener('click', () => {
  const [x, y] = button.dataset.g.split(',').map(Number); engine.setGravity(x, y);
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  $('gravity-label').textContent = `${directionNames[button.dataset.g]}向きに流れる`; updateStats();
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
