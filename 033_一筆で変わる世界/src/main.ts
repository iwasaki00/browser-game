import './style.css';
import { assertConservation } from './core/world';
import { stages } from './challenge/stages';
import { type StageDefinition } from './challenge/stage';
import { createCamera, constrainCamera, screenToWorld, zoomAt, type Viewport } from './input/camera';
import { GestureController } from './input/gestures';
import { samples } from './samples';
import { drawWorld } from './render';
import { ComparisonView } from './comparison/view';
import { type Stroke } from './core/stroke';
import { MAP_THEME, defaultDisplaySettings, flowAnimationPhase } from './living-map';
import { ProgressStore } from './game/save';
import { PlayableGame, type GameMode, type GameScreen } from './game/playable';
import { bindVisibilityPause } from './input/visibility';
import type { QualityPanel, QualityState } from './quality/panel';

for (const [name, value] of Object.entries(MAP_THEME)) document.documentElement.style.setProperty(`--${name}`, value);

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
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const progress = new ProgressStore(stages.map(stage => stage.id), () => window.localStorage, motionPreference.matches);
const game = new PlayableGame(progress);
let session = game.session;
stageSelect.value = session.stage!.id;
const camera = createCamera();
function viewport(): Viewport {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height, worldWidth: session.runner.world.width, worldHeight: session.runner.world.height };
}
const gestures = new GestureController(session, camera, viewport);
gestures.mode = session.stage!.strokeMode;
let selected: number | null = null, error = '', dirty = true;
let comparisonView: ComparisonView | null = null;
let quality: QualityPanel | null = null;
const displaySettings = defaultDisplaySettings(motionPreference.matches);
const flowToggle = element<HTMLInputElement>('flow-visible'), motionToggle = element<HTMLInputElement>('reduce-motion');
flowToggle.checked = progress.data.settings.showFlow;
motionToggle.checked = progress.data.settings.reducedMotion;
view.value = progress.data.settings.view;
element<HTMLSelectElement>('comparison-view').value = view.value;
function updateDisplaySettings(): void {
  displaySettings.showFlow = flowToggle.checked;
  motionToggle.checked = motionToggle.checked || motionPreference.matches;
  displaySettings.reducedMotion = motionToggle.checked;
  motionToggle.title = motionPreference.matches ? 'OSのアニメーション軽減設定を反映しています' : '水の流線と結果の演出を静止します';
  document.documentElement.dataset.reducedMotion = String(displaySettings.reducedMotion);
  progress.setSettings({ ...progress.data.settings, showFlow: flowToggle.checked, reducedMotion: motionToggle.checked,
    view: view.value as 'combined' | 'height' | 'water' });
  element<HTMLInputElement>('settings-flow').checked = flowToggle.checked;
  element<HTMLInputElement>('settings-motion').checked = motionToggle.checked;
  element<HTMLInputElement>('settings-guide').checked = progress.data.settings.showGuide;
  element<HTMLSelectElement>('settings-view').value = view.value;
  element<HTMLSelectElement>('comparison-view').value = view.value;
  comparisonView?.setDisplaySettings(displaySettings); dirty = true;
  updateShell();
}
flowToggle.onchange = updateDisplaySettings; motionToggle.onchange = updateDisplaySettings;
motionPreference.addEventListener('change', event => { motionToggle.checked = event.matches; updateDisplaySettings(); });
const format = (n: number) => n.toLocaleString('ja-JP');
const phaseNames = { READY: '一筆を描けます', DRAWING: '描画中', PREVIEW: '変更予定を確認', SIMULATING: 'シミュレーション', RESULT: '計算完了' };
function updateShell(): void {
  for (const [id, screen] of [['stage-menu', 'STAGES'], ['settings-menu', 'SETTINGS'], ['help-menu', 'HELP']] as const) element(id).hidden = game.screen !== screen;
  element('menu-return').hidden = game.screen === 'GAME';
  gameMode.value = game.mode;
  if (session.stage) stageSelect.value = session.stage.id;
  element('save-warning').textContent = progress.warning; element('save-warning').hidden = !progress.warning;
  element('progress-message').textContent = game.notice; element('progress-message').hidden = !game.notice;
  element('mode-note').textContent = game.mode === 'free' ? 'フリー実験 · 正解はありません。1試行1ストロークで地形と水を観察しよう。進捗には影響しません。'
    : game.mode === 'debug' ? '開発検証モード · 数値と水量収支を確認する場所です。チャレンジ進捗には影響しません。' : '';
  element('mode-note').hidden = game.mode === 'challenge' || game.screen !== 'GAME';
  element('conditions-title').textContent = game.mode === 'free' ? '水の観察' : game.mode === 'debug' ? '開発用の実験条件' : '実行・表示';
  element('metrics-title').textContent = game.mode === 'free' ? '水のようす' : game.mode === 'debug' ? '検証モニター' : '水量モニター';
  for (const [index, stage] of stages.entries()) {
    const option = stageSelect.options[index]; option.disabled = !progress.canSelect(stage.id);
    option.textContent = `${String(index + 1).padStart(2, '0')} ${progress.isCleared(stage.id) ? '✓ ' : progress.canSelect(stage.id) ? '' : '🔒 '}${stage.title}`;
  }
  const current = session.stage?.id;
  element('stage-progress').textContent = progress.data.clearedStageIds.length === stages.length ? '✓ 全6ステージをクリア！ 好きな地図に再挑戦できます。'
    : `クリア ${progress.data.clearedStageIds.length} / ${stages.length} · 次の挑戦: ${stages.find(s => s.id === progress.data.highestUnlockedStage)!.title}`;
  if (game.screen === 'STAGES') {
    const cards = stages.map((stage, index) => {
      const button = document.createElement('button'); button.className = 'stage-card'; button.disabled = !progress.canSelect(stage.id);
      button.textContent = `${String(index + 1).padStart(2, '0')} ${stage.title}\n${progress.isCleared(stage.id) ? '✓ クリア済み · 再挑戦' : progress.canSelect(stage.id) ? '○ 挑戦できます' : '🔒 前のステージをクリアすると解放'}${current === stage.id ? ' · 現在' : ''}`;
      button.onclick = () => safely(() => selectStage(stage)); return button;
    });
    element('stage-list').replaceChildren(...cards);
  }
  const guide = element('context-guide');
  guide.hidden = !progress.data.settings.showGuide || session.stage?.id !== 'stage-01' || game.screen !== 'GAME';
  guide.textContent = comparisonView?.active ? '⑤ BEFORE / AFTERで、一筆が変えた未来を見比べよう。'
    : ({ READY: '① 地図の細い尾根に一筆を描こう。実線の長さには限りがあります。', DRAWING: '① 残り長さを見ながら一筆。指を離すとプレビューになります。',
      PREVIEW: '② 半透明の変更予定を確認。「この一筆で実行 →」で水を流そう。', SIMULATING: '③ 水の流れを観察しよう。PAUSEとSTEPで少しずつ確認できます。',
      RESULT: '④ 取水量と結果を確認。「この一筆で世界A/Bを比較」で変化を見よう。' })[session.phase];
}
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
  element('next-stage').textContent = last ? '6ステージをクリア！' : '次のステージへ';
  const summary = game.summary;
  element('result-comparison').textContent = summary ? `世界A ${summary.worldAResult.goal.status === 'SUCCESS' ? '成功' : '未達成'} → 世界B ${summary.worldBResult.goal.status === 'SUCCESS' ? '成功' : '未達成'} / 取水量の差 ${summary.intakeDifference.total.delta > 0 ? '+' : ''}${format(summary.intakeDifference.total.delta)}単位 / 最大浸水深の差 ${format(summary.floodDifference.maximumDepth.delta)}単位（B−A）`
    : game.summaryError ? `比較集計を停止しました: ${game.summaryError}` : session.record?.conditions.stroke ? 'Before / Afterの差分を集計しています…' : '一筆なしで観測した結果です。描き直すと世界A/Bを比較できます。';
}
function update(): void {
  game.observeCompletion(); updateShell();
  element('workspace').hidden = game.screen !== 'GAME' || (comparisonView?.active ?? false);
  element('comparison-panel').hidden = game.screen !== 'GAME' || !comparisonView?.active;
  if (game.screen !== 'GAME') return;
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
  element('compare-open').hidden = !session.stage;
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
function adoptSession(): void {
  comparisonView?.close();
  releasePointers(); session.runner.pause(); session = game.session; gestures.session = session;
  session.runner.setSpeed(Number(speed.value)); gestures.mode = session.stage?.strokeMode ?? 'RAISE'; gestures.tool = 'DRAW';
  Object.assign(camera, createCamera()); error = ''; selected = null;
  element('cell-info').textContent = '盤面の矢印キーでセルの高度と変更予定値を確認';
}
function selectStage(stage: StageDefinition): void {
  game.selectStage(stage.id); stageSelect.value = stage.id; adoptSession();
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
  element('workspace').hidden = true; element('challenge-panel').hidden = true;
  element('comparison-panel').scrollIntoView({ block: 'start' });
}
element('compare-open').onclick = () => safely(openComparison);
element('compare-result').onclick = () => safely(openComparison);
gameMode.onchange = () => safely(() => {
  game.setMode(gameMode.value as GameMode); adoptSession();
});
stageSelect.onchange = () => safely(() => {
  if (gameMode.value === 'challenge') selectStage(stages.find(s => s.id === stageSelect.value)!);
});
element('baseline-run').onclick = () => safely(() => { if (session.phase === 'READY') session.play(); });
element('retry').onclick = () => safely(() => { releasePointers(); error = ''; game.retry(); });
element('next-stage').onclick = () => safely(() => {
  const index = stages.findIndex(s => s.id === session.stage?.id);
  if (session.phase === 'RESULT' && session.goalResult?.status === 'SUCCESS' && index >= 0 && index + 1 < stages.length) selectStage(stages[index + 1]);
});
select.onchange = () => safely(() => {
  if (session.stage) return;
  game.selectSample(select.value); adoptSession();
  element('description').textContent = samples.find(s => s.id === select.value)!.description;
});
element('description').textContent = samples[0].description;
function openMenu(screen: GameScreen): void {
  releasePointers(); comparisonView?.suspend(); game.openScreen(screen);
}
for (const [id, mode] of [['menu-challenge', 'challenge'], ['menu-free', 'free']] as const) {
  element(id).onclick = () => safely(() => { game.setMode(mode); adoptSession(); });
}
for (const [id, screen] of [['menu-stages', 'STAGES'], ['menu-settings', 'SETTINGS'], ['menu-help', 'HELP'], ['menu-return', 'GAME']] as const) {
  element(id).onclick = () => safely(() => openMenu(screen));
}
element<HTMLInputElement>('settings-flow').onchange = () => { flowToggle.checked = element<HTMLInputElement>('settings-flow').checked; updateDisplaySettings(); };
element<HTMLInputElement>('settings-motion').onchange = () => { motionToggle.checked = element<HTMLInputElement>('settings-motion').checked; updateDisplaySettings(); };
element<HTMLInputElement>('settings-guide').onchange = () => {
  progress.setSettings({ ...progress.data.settings, showGuide: element<HTMLInputElement>('settings-guide').checked }); updateShell();
};
element<HTMLSelectElement>('settings-view').onchange = () => { view.value = element<HTMLSelectElement>('settings-view').value; updateDisplaySettings(); };
const resetDialog = element<HTMLDialogElement>('reset-save-dialog');
element('reset-save').onclick = () => { if (!resetDialog.open) resetDialog.showModal(); };
element('reset-save-cancel').onclick = () => resetDialog.close();
element('reset-save-confirm').onclick = () => safely(() => {
  if (!resetDialog.open) return;
  progress.reset(true); resetDialog.close(); game.selectStage(stages[0].id); adoptSession();
  flowToggle.checked = progress.data.settings.showFlow; motionToggle.checked = progress.data.settings.reducedMotion; view.value = progress.data.settings.view;
  game.notice = '進捗と設定を初期化しました。Stage 01から新しく始められます。'; updateDisplaySettings();
});
element('lower').onclick = () => safely(() => { if (session.stage?.strokeMode !== 'RAISE') gestures.mode = 'LOWER'; });
element('raise').onclick = () => safely(() => { if (session.stage?.strokeMode !== 'LOWER') gestures.mode = 'RAISE'; });
element('draw').onclick = () => safely(() => { releasePointers(); gestures.tool = 'DRAW'; });
element('pan').onclick = () => safely(() => { releasePointers(); gestures.tool = 'PAN'; });
element('cancel-stroke').onclick = () => safely(() => { releasePointers(); session.cancel(); });
element('execute').onclick = () => safely(() => { releasePointers(); session.execute(); });
element('play').onclick = () => safely(() => session.play());
element('pause').onclick = () => safely(() => session.runner.pause());
element('step').onclick = () => safely(() => game.step());
element('reset').onclick = () => safely(() => { releasePointers(); error = ''; game.retry(); });
speed.onchange = () => safely(() => session.runner.setSpeed(Number(speed.value)));
view.onchange = updateDisplaySettings;
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
const suspend = () => safely(() => { releasePointers(); session.runner.pause(); comparisonView?.suspend(); quality?.metrics.suspendFrameClock(); });
bindVisibilityPause(document, suspend);
window.addEventListener('blur', suspend);
new ResizeObserver(() => {
  if (!comparisonView?.active) safely(() => { releasePointers(); constrainCamera(camera, viewport()); });
}).observe(canvas);
comparisonView = new ComparisonView({
  onBack: () => safely(() => { comparisonView?.close(); dirty = true; }),
  onRetry: () => safely(() => { comparisonView?.close(); error = ''; game.retry(); }),
  onNext: () => safely(() => {
    const index = stages.findIndex(s => s.id === session.stage?.id);
    if (comparisonView?.canAdvanceStage && index >= 0 && index + 1 < stages.length) selectStage(stages[index + 1]);
  }),
  onComplete: result => { game.acceptComparison(result); updateShell(); },
  onViewChange: value => { view.value = value; updateDisplaySettings(); },
});
updateDisplaySettings();
let previous = performance.now(), lastPaint = 0;
function frame(now: number): void {
  if (!quality?.enabled) { runFrame(now); return; }
  quality.frame(now);
  try { quality.metrics.measure('frame', () => runFrame(now)); }
  finally { quality.update(now); }
}
function runFrame(now: number): void {
  const elapsed = now - previous; previous = now;
  if (game.screen !== 'GAME') { requestAnimationFrame(frame); return; }
  if (comparisonView?.active) {
    comparisonView.advance(elapsed);
    if (quality?.enabled) quality.metrics.measure('draw', () => comparisonView!.draw(now), painted => painted);
    else comparisonView.draw(now);
    requestAnimationFrame(frame); return;
  }
  if (session.runner.playing) safely(() => { game.advance(elapsed); });
  if (game.advanceSummary()) safely(() => {});
  const animate = displaySettings.showFlow && !displaySettings.reducedMotion && session.runner.playing && view.value !== 'height';
  if (dirty || (animate && now - lastPaint >= 50)) {
    const preview = ['DRAWING', 'PREVIEW'].includes(session.phase) ? session.preview : null;
    const draw = () => drawWorld(context!, session.runner.world, view.value, selected,
      { camera, viewport: viewport(), preview, edits: preview ? session.edits : [],
        towns: session.stage?.towns, townProgress: session.goalResult?.towns, flows: session.runner.lastFlows,
        showFlow: displaySettings.showFlow, animationPhase: flowAnimationPhase(now, displaySettings.reducedMotion, session.runner.playing) });
    if (quality?.enabled) quality.metrics.measure('draw', draw); else draw();
    dirty = false; lastPaint = now;
  }
  requestAnimationFrame(frame);
}
update(); requestAnimationFrame(frame);

// Vite removes this entire import path from production. Normal development also opts out.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('quality') === '1') {
  const readQualityState = (): QualityState => {
    const comparison = comparisonView?.diagnosticState(), world = session.runner.world;
    let balanced = comparison?.balanced ?? true, problem = comparison?.problem ?? (error || null);
    if (!comparison) try { assertConservation(world); } catch (cause) { balanced = false; problem = String(cause); }
    const canvases = comparison ? ['comparison-a', 'comparison-b'] : ['map'];
    return { scene: comparison?.stageId ?? session.stage?.id ?? `${game.mode}:${game.sampleId}`, screen: game.screen,
      step: comparison?.steps[0] ?? world.step,
      operation: comparison ? '比較 / PAN' : `${game.mode} / ${gestures.tool} / ${gestures.mode} / ${session.phase}`,
      pointers: comparison?.pointers ?? gestures.pointers.size, zoom: comparison?.zoom ?? camera.zoom,
      dpr: window.devicePixelRatio, viewport: { width: window.innerWidth, height: window.innerHeight },
      canvases: canvases.map(id => { const canvas = element<HTMLCanvasElement>(id), rect = canvas.getBoundingClientRect();
        return { name: id, width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height }; }),
      steps: comparison?.steps ?? null, balanced, problem };
  };
  void import('./quality/panel').then(({ QualityPanel }) => { quality = new QualityPanel(readQualityState, () => comparisonView?.active ?? false); });
}
