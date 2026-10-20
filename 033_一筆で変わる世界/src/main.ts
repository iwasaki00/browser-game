import './style.css';
import { TrialSession } from './core/trial';
import { assertConservation, MAX_STEPS } from './core/world';
import { DEFAULT_BRUSH } from './core/stroke';
import { createCamera, constrainCamera, screenToWorld, zoomAt, type Viewport } from './input/camera';
import { GestureController } from './input/gestures';
import { samples } from './samples';
import { drawWorld } from './render';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`要素がありません: ${id}`);
  return value as T;
}
const canvas = element<HTMLCanvasElement>('map');
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2Dを利用できません');
const select = element<HTMLSelectElement>('sample');
const view = element<HTMLSelectElement>('view');
const speed = element<HTMLSelectElement>('speed');
for (const sample of samples) select.add(new Option(sample.name, sample.id));
let session = new TrialSession(samples[0].create());
const camera = createCamera();
function viewport(): Viewport {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height, worldWidth: session.runner.world.width, worldHeight: session.runner.world.height };
}
const gestures = new GestureController(session, camera, viewport);
let selected: number | null = null, error = '', dirty = true;
const format = (n: number) => n.toLocaleString('ja-JP');
const phaseNames = { READY: '一筆を描けます', DRAWING: '描画中', PREVIEW: '変更予定を確認', SIMULATING: 'シミュレーション', RESULT: '計算完了' };
function update(): void {
  const runner = session.runner, w = runner.world;
  for (const [id, value] of Object.entries({ 'step-count': w.step, total: assertConservation(w), initial: w.initialWater,
    supply: w.cumulativeSupply, intake: w.cumulativeIntake, outlet: w.cumulativeOutlet })) element(id).textContent = format(value);
  element<HTMLProgressElement>('progress').value = w.step;
  element('balance').textContent = error ? `検査エラー: ${error}` : '✓ 水量保存: OK（差分 0）';
  element('balance').classList.toggle('error', !!error);
  element('status').textContent = error || (w.step === MAX_STEPS ? '600ステップ完了 · RESETで再挑戦できます' : runner.playing ? '● 実行中' : 'Ⅱ 一時停止中');
  const runnable = session.phase === 'READY' || session.phase === 'SIMULATING';
  element<HTMLButtonElement>('play').disabled = !runnable || runner.playing || !!error;
  element<HTMLButtonElement>('step').disabled = !runnable || runner.playing || !!error;
  element<HTMLButtonElement>('pause').disabled = !runner.playing;
  element('phase').textContent = `${session.phase} · ${phaseNames[session.phase]}`;
  element('zoom').textContent = `${camera.zoom.toFixed(2)}×`;
  element<HTMLButtonElement>('zoom-out').disabled = camera.zoom <= 1;
  element<HTMLButtonElement>('zoom-in').disabled = camera.zoom >= 4;
  const remaining = Math.max(0, DEFAULT_BRUSH.maxLength - (session.preview?.stroke.effectiveLength ?? 0));
  element('length-left').textContent = `${remaining.toFixed(2)} / 12セル`;
  element<HTMLProgressElement>('length').value = remaining;
  const mode = session.preview?.stroke.mode ?? gestures.mode;
  element('brush-info').textContent = `${mode === 'RAISE' ? '盛る / 高度＋12' : '削る / 高度−12'} / 半径2セル`;
  element('edit-summary').textContent = session.phase === 'READY' ? '盤面をドラッグしてください。1試行につき1本だけ描けます。'
    : session.editable ? `変更予定 ${session.edits.length}セル · ${mode === 'RAISE' ? '盛る' : '削る'}${session.preview?.overflow.length ? ' · 超過部分は適用されません' : ''}`
    : `適用済み ${session.appliedCount}セル · 編集後の地形${session.appliedCount ? 'で計算' : '変更なし'}`;
  element('execution-reason').textContent = session.editable ? session.executionReason || '初期水量を保持し、編集後の地形でステップ0から実行します。' : '地形を描き直すにはRESETで再挑戦してください。';
  element<HTMLButtonElement>('execute').disabled = !!session.executionReason || !!error;
  element<HTMLButtonElement>('cancel-stroke').disabled = !['DRAWING', 'PREVIEW'].includes(session.phase);
  for (const [id, active] of [['lower', gestures.mode === 'LOWER'], ['raise', gestures.mode === 'RAISE'],
    ['draw', gestures.tool === 'DRAW'], ['pan', gestures.tool === 'PAN']] as const) element(id).setAttribute('aria-pressed', String(active));
  element<HTMLButtonElement>('lower').disabled = session.phase !== 'READY';
  element<HTMLButtonElement>('raise').disabled = session.phase !== 'READY';
  if (selected !== null) {
    const i = selected, edit = session.editable ? session.edits.find(item => item.index === i) : undefined;
    element('cell-info').textContent = `(${i % w.width}, ${Math.floor(i / w.width)}) 高さ ${w.heights[i]}${edit ? ` → ${edit.after}（予定）` : ''} / 水量 ${format(w.water[i])} / ${['通常', '水源', '取水', '排出口'][w.terrainType[i]]}${w.protected[i] ? ' / 地形保護' : ''}`;
  }
  canvas.dataset.tool = gestures.tool;
  dirty = true;
}
function safely(action: () => void): void {
  try { action(); update(); }
  catch (cause) {
    gestures.cancel(); session.runner.pause(); error = cause instanceof Error ? cause.message : String(cause);
    element('balance').textContent = `検査エラー: ${error}`; element('balance').classList.add('error');
    element('status').textContent = '異常を検出したため停止しました。RESETで再挑戦してください。';
    for (const id of ['play', 'step', 'pause', 'execute']) element<HTMLButtonElement>(id).disabled = true;
    dirty = true;
  }
}
function releasePointers(): void {
  const ids = [...gestures.pointers.keys()]; gestures.cancel();
  for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
select.onchange = () => safely(() => {
  releasePointers(); session.runner.pause(); session = new TrialSession(samples.find(s => s.id === select.value)!.create());
  gestures.session = session; session.runner.setSpeed(Number(speed.value));
  Object.assign(camera, createCamera()); error = ''; selected = null;
  element('cell-info').textContent = '盤面の矢印キーでセルの高度と変更予定値を確認';
  element('description').textContent = samples.find(s => s.id === select.value)!.description;
});
element('description').textContent = samples[0].description;
element('lower').onclick = () => safely(() => { gestures.mode = 'LOWER'; });
element('raise').onclick = () => safely(() => { gestures.mode = 'RAISE'; });
element('draw').onclick = () => safely(() => { releasePointers(); gestures.tool = 'DRAW'; });
element('pan').onclick = () => safely(() => { releasePointers(); gestures.tool = 'PAN'; });
element('cancel-stroke').onclick = () => safely(() => { releasePointers(); session.cancel(); });
element('execute').onclick = () => safely(() => { releasePointers(); session.execute(); });
element('play').onclick = () => safely(() => session.play());
element('pause').onclick = () => safely(() => session.runner.pause());
element('step').onclick = () => safely(() => session.step());
element('reset').onclick = () => safely(() => { releasePointers(); error = ''; session.reset(); });
speed.onchange = () => safely(() => session.runner.setSpeed(Number(speed.value)));
view.onchange = () => { dirty = true; };
function zoom(factor: number): void {
  releasePointers(); const v = viewport(); zoomAt(camera, camera.zoom * factor, { x: v.width / 2, y: v.height / 2 }, v);
}
element('zoom-in').onclick = () => safely(() => zoom(1.25));
element('zoom-out').onclick = () => safely(() => zoom(1 / 1.25));
element('camera-reset').onclick = () => safely(() => { releasePointers(); Object.assign(camera, createCamera()); });
const eventPoint = (event: PointerEvent | WheelEvent) => {
  const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  safely(() => {
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    const point = eventPoint(event), world = screenToWorld(point, camera, viewport()), w = session.runner.world;
    if (world.x >= 0 && world.x < w.width && world.y >= 0 && world.y < w.height) selected = Math.floor(world.y) * w.width + Math.floor(world.x);
    gestures.down(event.pointerId, point);
  });
});
canvas.addEventListener('pointermove', event => {
  if (!gestures.pointers.has(event.pointerId)) return;
  event.preventDefault();
  safely(() => {
    const events = event.getCoalescedEvents?.() ?? [];
    for (const sample of events.length ? events : [event]) gestures.move(event.pointerId, eventPoint(sample));
  });
});
canvas.addEventListener('pointerup', event => {
  safely(() => { gestures.up(event.pointerId, eventPoint(event)); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
});
canvas.addEventListener('pointercancel', () => safely(releasePointers));
canvas.addEventListener('lostpointercapture', event => {
  if (gestures.pointers.has(event.pointerId)) safely(releasePointers);
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  safely(() => { releasePointers(); zoomAt(camera, camera.zoom * Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .002), eventPoint(event), viewport()); });
}, { passive: false });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') safely(() => { releasePointers(); session.cancel(); });
});
canvas.addEventListener('keydown', event => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const w = session.runner.world, i = selected ?? 0, x = i % w.width, y = Math.floor(i / w.width);
  selected = Math.max(0, Math.min(w.height - 1, y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0))) * w.width
    + Math.max(0, Math.min(w.width - 1, x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
  safely(() => {});
});
const suspend = () => safely(() => { releasePointers(); session.runner.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('blur', suspend);
new ResizeObserver(() => safely(() => { releasePointers(); constrainCamera(camera, viewport()); })).observe(canvas);
let previous = performance.now();
function frame(now: number): void {
  const elapsed = now - previous; previous = now;
  if (session.runner.playing) safely(() => { session.advance(elapsed); });
  if (dirty) {
    const preview = ['DRAWING', 'PREVIEW'].includes(session.phase) ? session.preview : null;
    drawWorld(context!, session.runner.world, view.value, selected,
      { camera, viewport: viewport(), preview, edits: preview ? session.edits : [] }); dirty = false;
  }
  requestAnimationFrame(frame);
}
update(); requestAnimationFrame(frame);
