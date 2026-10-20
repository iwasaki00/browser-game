import './style.css';
import { TrialSession } from './core/trial';
import { assertConservation } from './core/world';
import { stages } from './challenge/stages';
import { type StageDefinition } from './challenge/stage';
import { createCamera, constrainCamera, screenToWorld, zoomAt, type Viewport } from './input/camera';
import { GestureController } from './input/gestures';
import { samples } from './samples';
import { drawWorld } from './render';
import { ComparisonView } from './comparison/view';
import { type Stroke } from './core/stroke';

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
const gameMode = element<HTMLSelectElement>('game-mode');
const stageSelect = element<HTMLSelectElement>('stage-select');
for (const sample of samples) select.add(new Option(sample.name, sample.id));
for (const [index, stage] of stages.entries()) stageSelect.add(new Option(`${String(index + 1).padStart(2, '0')} ${stage.title}`, stage.id));
let session = TrialSession.forStage(stages[0]);
const camera = createCamera();
function viewport(): Viewport {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height, worldWidth: session.runner.world.width, worldHeight: session.runner.world.height };
}
const gestures = new GestureController(session, camera, viewport);
gestures.mode = session.stage!.strokeMode;
let selected: number | null = null, error = '', dirty = true;
let comparisonView: ComparisonView | null = null;
const format = (n: number) => n.toLocaleString('ja-JP');
const phaseNames = { READY: '一筆を描けます', DRAWING: '描画中', PREVIEW: '変更予定を確認', SIMULATING: 'シミュレーション', RESULT: '計算完了' };
function updateChallenge(): void {
  const stage = session.stage, result = session.goalResult;
  element('challenge-panel').hidden = !stage;
  element('debug-samples').hidden = !!stage;
  element('challenge-result').hidden = !stage || session.phase !== 'RESULT';
  if (!stage || !result) return;
  element('stage-title').textContent = stage.title;
  element('stage-description').textContent = stage.description;
  const goal = stage.goalDefinition, targets = stage.towns.filter(t => goal.townIds.includes(t.id));
  const delivery = `給水: ${targets.map(t => `${t.name}に${format(t.requiredIntake ?? 0)}単位`).join('、')}をStep ${goal.deliveryDeadlineStep}までに取水`;
  const flood = `防災: Step 0〜${goal.floodObservationEndStep}の間、${targets.map(t => `${t.name}の水深を${format(t.floodThreshold)}単位未満`).join('、')}に保つ`;
  element('goal-description').textContent = goal.type === 'WATER_DELIVERY' ? delivery : goal.type === 'FLOOD_PREVENTION' ? flood : `${delivery} / ${flood}`;
  element('challenge-brush').textContent = `許可操作: ${stage.strokeMode === 'LOWER' ? '削る' : '盛る'}のみ / 長さ${stage.maxStrokeLength}セル / 半径${stage.brushRadius}セル / 高度変更${stage.heightDelta} / ${stage.maxSimulationSteps}ステップ`;
  element<HTMLButtonElement>('baseline-run').disabled = session.phase !== 'READY' || !!error;
  const townCards = result.towns.map(town => {
    const card = document.createElement('article'), title = document.createElement('h3');
    title.textContent = `⌂ ${town.name}`; card.append(title);
    const intake = document.createElement('p');
    intake.textContent = town.requiredIntake === undefined ? '給水条件なし' : `累積取水 ${format(town.currentIntake)} / 必要 ${format(town.requiredIntake)} 単位`;
    if (town.deliveryAtDeadline !== null && goal.deliveryDeadlineStep !== stage.maxSimulationSteps) intake.textContent += `（期限時点 ${format(town.deliveryAtDeadline)}）`;
    const flood = document.createElement('p');
    flood.textContent = `町の水深 ${format(town.currentDepth)} / 危険 ${format(town.floodThreshold)} 単位 · 観測最大 ${format(town.maximumDepth)}`;
    const history = document.createElement('p');
    history.textContent = town.currentDepth >= town.floodThreshold ? '現在: 浸水中' : '現在: 危険水深未満';
    if (town.firstFloodStep !== null) history.textContent += ` / 初回浸水 Step ${town.firstFloodStep}（履歴を保持）`;
    card.className = town.firstFloodStep !== null ? 'town-card flooded' : 'town-card';
    card.append(intake, flood, history); return card;
  });
  element('town-progress').replaceChildren(...townCards);
  const finished = session.phase === 'RESULT';
  element('result-title').textContent = result.status === 'SUCCESS' ? '成功！ 目標を達成しました' : '失敗 · 条件を見直して再挑戦';
  element('challenge-result').classList.toggle('success', result.status === 'SUCCESS');
  const conditions = result.conditions.map(condition => {
    const item = document.createElement('li'), town = stage.towns.find(t => t.id === condition.townId)!;
    item.textContent = `${condition.achieved ? '✓ 達成' : '× 未達成'}: ${town.name}の${condition.type === 'DELIVERY' ? '給水条件' : '浸水防止条件'}${condition.failedAtStep !== null ? `（失敗確定 Step ${condition.failedAtStep}）` : ''}`;
    return item;
  });
  element('goal-conditions').replaceChildren(...conditions);
  element('result-details').textContent = `${result.step}ステップ実行 · ${result.towns.map(t => `${t.name}: 取水${format(t.currentIntake)}単位 / 最大水深${format(t.maximumDepth)}単位`).join(' / ')}${result.firstFailureStep !== null ? ` · 初回失敗 Step ${result.firstFailureStep}` : ''}`;
  const last = stages.findIndex(s => s.id === stage.id) === stages.length - 1;
  element<HTMLButtonElement>('next-stage').hidden = !finished || result.status !== 'SUCCESS';
  element<HTMLButtonElement>('next-stage').disabled = last;
  element('next-stage').textContent = last ? '3ステージ目をクリア！' : '次のステージへ';
}
function update(): void {
  element('workspace').hidden = comparisonView?.active ?? false;
  if (comparisonView?.active) { element('challenge-panel').hidden = true; return; }
  const runner = session.runner, w = runner.world;
  for (const [id, value] of Object.entries({ 'step-count': w.step, total: assertConservation(w), initial: w.initialWater,
    supply: w.cumulativeSupply, intake: w.cumulativeIntake, outlet: w.cumulativeOutlet })) element(id).textContent = format(value);
  element<HTMLProgressElement>('progress').max = runner.maxSteps;
  element<HTMLProgressElement>('progress').value = w.step;
  element('step-limit').textContent = `/ ${runner.maxSteps} ステップ`;
  element('grid-size').textContent = `${w.width} × ${w.height} CELLS`;
  element('balance').textContent = error ? `検査エラー: ${error}` : '✓ 水量保存: OK（差分 0）';
  element('balance').classList.toggle('error', !!error);
  element('status').textContent = error || (w.step === runner.maxSteps ? `${runner.maxSteps}ステップ完了 · ${session.goalResult?.status === 'SUCCESS' ? '成功！' : session.stage ? '失敗 · 再挑戦できます' : 'RESETで再挑戦できます'}` : runner.playing ? '● 実行中' : 'Ⅱ 一時停止中');
  const runnable = session.phase === 'READY' || session.phase === 'SIMULATING';
  element<HTMLButtonElement>('play').disabled = !runnable || runner.playing || !!error;
  element<HTMLButtonElement>('step').disabled = !runnable || runner.playing || !!error;
  element<HTMLButtonElement>('pause').disabled = !runner.playing;
  element('phase').textContent = `${session.phase} · ${session.phase === 'RESULT' && session.stage ? session.goalResult?.status === 'SUCCESS' ? '成功！' : '失敗 · 再挑戦' : phaseNames[session.phase]}`;
  element('zoom').textContent = `${camera.zoom.toFixed(2)}×`;
  element<HTMLButtonElement>('zoom-out').disabled = camera.zoom <= 1;
  element<HTMLButtonElement>('zoom-in').disabled = camera.zoom >= 4;
  const remaining = Math.max(0, session.brush.maxLength - (session.preview?.stroke.effectiveLength ?? 0));
  element('length-left').textContent = `${remaining.toFixed(2)} / ${session.brush.maxLength}セル`;
  element<HTMLProgressElement>('length').max = session.brush.maxLength;
  element<HTMLProgressElement>('length').value = remaining;
  const mode = session.preview?.stroke.mode ?? gestures.mode;
  element('brush-info').textContent = `${mode === 'RAISE' ? '盛る / 高度＋' : '削る / 高度−'}${session.brush.heightDelta} / 半径${session.brush.radius}セル`;
  element('lower').textContent = `削る −${session.brush.heightDelta}`;
  element('raise').textContent = `盛る ＋${session.brush.heightDelta}`;
  element('edit-summary').textContent = session.phase === 'READY' ? '盤面をドラッグしてください。1試行につき1本だけ描けます。'
    : session.editable ? `変更予定 ${session.edits.length}セル · ${mode === 'RAISE' ? '盛る' : '削る'}${session.preview?.overflow.length ? ' · 超過部分は適用されません' : ''}`
    : `適用済み ${session.appliedCount}セル · 編集後の地形${session.appliedCount ? 'で計算' : '変更なし'}`;
  element('execution-reason').textContent = session.editable ? session.executionReason || '初期水量を保持し、編集後の地形でステップ0から実行します。' : '地形を描き直すにはRESETで再挑戦してください。';
  element<HTMLButtonElement>('execute').disabled = !!session.executionReason || !!error;
  element<HTMLButtonElement>('cancel-stroke').disabled = !['DRAWING', 'PREVIEW'].includes(session.phase);
  const canCompare = !!session.stage && !!comparisonStroke() && !error;
  element<HTMLButtonElement>('compare-open').disabled = !canCompare;
  element<HTMLButtonElement>('compare-result').disabled = !canCompare;
  element('compare-open').title = canCompare ? '両世界を同じ初期状態・ステップ0から同期実行します' : 'チャレンジで有効な一筆を確定してから比較できます';
  for (const [id, active] of [['lower', gestures.mode === 'LOWER'], ['raise', gestures.mode === 'RAISE'],
    ['draw', gestures.tool === 'DRAW'], ['pan', gestures.tool === 'PAN']] as const) element(id).setAttribute('aria-pressed', String(active));
  element<HTMLButtonElement>('lower').disabled = session.phase !== 'READY' || session.stage?.strokeMode === 'RAISE';
  element<HTMLButtonElement>('raise').disabled = session.phase !== 'READY' || session.stage?.strokeMode === 'LOWER';
  if (selected !== null) {
    const i = selected, edit = session.editable ? session.edits.find(item => item.index === i) : undefined;
    element('cell-info').textContent = `(${i % w.width}, ${Math.floor(i / w.width)}) 高さ ${w.heights[i]}${edit ? ` → ${edit.after}（予定）` : ''} / 水量 ${format(w.water[i])} / 水面 ${format(w.heights[i] * 256 + w.water[i])} / ${['通常', '水源', '取水', '排出口'][w.terrainType[i]]}${w.protected[i] ? ' / 地形保護' : ''}`;
  }
  canvas.dataset.tool = gestures.tool;
  updateChallenge();
  dirty = true;
}
function safely(action: () => void): void {
  try { action(); update(); }
  catch (cause) {
    gestures.cancel(); session.runner.pause(); comparisonView?.suspend(); error = cause instanceof Error ? cause.message : String(cause);
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
function replaceSession(next: TrialSession): void {
  comparisonView?.close();
  releasePointers(); session.runner.pause(); session = next; gestures.session = session;
  session.runner.setSpeed(Number(speed.value)); gestures.mode = session.stage?.strokeMode ?? 'RAISE'; gestures.tool = 'DRAW';
  Object.assign(camera, createCamera()); error = ''; selected = null;
  element('cell-info').textContent = '盤面の矢印キーでセルの高度と変更予定値を確認';
}
function selectStage(stage: StageDefinition): void {
  stageSelect.value = stage.id; replaceSession(TrialSession.forStage(stage));
}
function comparisonStroke(): Stroke | null {
  if (session.phase === 'PREVIEW' && !session.executionReason) return session.preview!.stroke;
  return session.phase === 'RESULT' ? session.record?.conditions.stroke ?? null : null;
}
function openComparison(): void {
  const stroke = comparisonStroke(), stage = session.stage;
  if (!stroke || !stage || !comparisonView) return;
  releasePointers(); session.runner.pause();
  comparisonView.open(stage, stroke, Number(speed.value), stages.findIndex(s => s.id === stage.id) < stages.length - 1);
}
element('compare-open').onclick = () => safely(openComparison);
element('compare-result').onclick = () => safely(openComparison);
gameMode.onchange = () => safely(() => {
  if (gameMode.value === 'challenge') selectStage(stages.find(s => s.id === stageSelect.value) ?? stages[0]);
  else replaceSession(new TrialSession(samples.find(s => s.id === select.value)!.create()));
});
stageSelect.onchange = () => safely(() => {
  if (gameMode.value === 'challenge') selectStage(stages.find(s => s.id === stageSelect.value)!);
});
element('baseline-run').onclick = () => safely(() => { if (session.phase === 'READY') session.play(); });
element('retry').onclick = () => safely(() => { releasePointers(); error = ''; session.reset(); });
element('next-stage').onclick = () => safely(() => {
  const index = stages.findIndex(s => s.id === session.stage?.id);
  if (session.phase === 'RESULT' && session.goalResult?.status === 'SUCCESS' && index >= 0 && index + 1 < stages.length) selectStage(stages[index + 1]);
});
select.onchange = () => safely(() => {
  if (session.stage) return;
  replaceSession(new TrialSession(samples.find(s => s.id === select.value)!.create()));
  element('description').textContent = samples.find(s => s.id === select.value)!.description;
});
element('description').textContent = samples[0].description;
element('lower').onclick = () => safely(() => { if (session.stage?.strokeMode !== 'RAISE') gestures.mode = 'LOWER'; });
element('raise').onclick = () => safely(() => { if (session.stage?.strokeMode !== 'LOWER') gestures.mode = 'RAISE'; });
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
const suspend = () => safely(() => { releasePointers(); session.runner.pause(); comparisonView?.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('blur', suspend);
new ResizeObserver(() => {
  if (!comparisonView?.active) safely(() => { releasePointers(); constrainCamera(camera, viewport()); });
}).observe(canvas);
comparisonView = new ComparisonView({
  onBack: () => safely(() => { comparisonView?.close(); dirty = true; }),
  onRetry: () => safely(() => { comparisonView?.close(); error = ''; session.reset(); }),
  onNext: () => safely(() => {
    const index = stages.findIndex(s => s.id === session.stage?.id);
    if (comparisonView?.canAdvanceStage && index >= 0 && index + 1 < stages.length) selectStage(stages[index + 1]);
  }),
});
let previous = performance.now();
function frame(now: number): void {
  const elapsed = now - previous; previous = now;
  if (comparisonView?.active) {
    comparisonView.advance(elapsed); comparisonView.draw(); requestAnimationFrame(frame); return;
  }
  if (session.runner.playing) safely(() => { session.advance(elapsed); });
  if (dirty) {
    const preview = ['DRAWING', 'PREVIEW'].includes(session.phase) ? session.preview : null;
    drawWorld(context!, session.runner.world, view.value, selected,
      { camera, viewport: viewport(), preview, edits: preview ? session.edits : [],
        towns: session.stage?.towns, townProgress: session.goalResult?.towns }); dirty = false;
  }
  requestAnimationFrame(frame);
}
update(); requestAnimationFrame(frame);
