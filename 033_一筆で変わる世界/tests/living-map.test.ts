import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAP_THEME, terrainTiles, waterOpacity, flowGlyphs, markerKind, townAppearance, metricRelevant, canvasSize, flowAnimationPhase, defaultDisplaySettings } from '../src/living-map';
import { drawWorld, type RenderOptions } from '../src/render';
import { createWorld, TerrainType } from '../src/core/world';
import { snapshotWorld } from '../src/core/world-view';
import { stepWorld, type FlowTransfer } from '../src/core/simulation';
import { SimulationRunner } from '../src/core/runner';
import { buildStroke, applyStroke, strokeEdits } from '../src/core/stroke';
import { createCamera, zoomAt, worldToScreen, screenToWorld, constrainCamera } from '../src/input/camera';
import { stages } from '../src/challenge/stages';
import { ComparisonController } from '../src/comparison/controller';
import { ComparisonView } from '../src/comparison/view';
import { challengeSolutions } from './fixtures/challenge-solutions';
import { canvasDouble, comparisonDom } from './fixtures/canvas-double';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const solution = (index: number) => { const s = stages[index]; return buildStroke(challengeSolutions[s.id], s.terrain.width, s.terrain.height,
  { mode: s.strokeMode, maxLength: s.maxStrokeLength, radius: s.brushRadius, heightDelta: s.heightDelta }).stroke; };
const options = (width = 2, height = 1): RenderOptions => ({ camera: createCamera(), viewport: { width: 400, height: 200, worldWidth: width, worldHeight: height }, preview: null, edits: [] });

describe('Living Map rendering', () => {
  it('LM-01: 通常と高度表示は同じ編集後高度と境界を持ち、色の強調だけを変える', () => {
    const world = createWorld({ width: 2, height: 2, heights: [0, 8, 8, 16] });
    const edits = [{ index: 3, before: 16, after: 12 }];
    const normal = terrainTiles(world, 'combined', edits), height = terrainTiles(world, 'height', edits);
    expect(normal.map(t => t.height)).toEqual([0, 8, 8, 12]);
    expect(height.map(({ color: _, ...tile }) => tile)).toEqual(normal.map(({ color: _, ...tile }) => tile));
    expect(height[0].color).not.toBe(normal[0].color); expect([...world.heights]).toEqual([0, 8, 8, 16]);
  });
  it('LM-02 / LM-15: 実レンダラーを全モードで実行しても水・地形・施設集計を書き換えない', () => {
    const world = createWorld({ width: 2, height: 1, heights: [0, 4], water: [512, 0], sources: [{ index: 0, rate: 5 }], intakes: [{ index: 1, rate: 3 }] });
    stepWorld(world); const before = snapshotWorld(world), { context } = canvasDouble();
    for (const mode of ['combined', 'height', 'water']) drawWorld(context, before, mode, 1, options());
    expect(snapshotWorld(world)).toEqual(before); expect(Object.isFrozen(before.water)).toBe(true);
  });
  it('LM-03: 水量0には水の塗りを生成せず、浅い水も検出できる', () => {
    const world = createWorld({ width: 2, height: 1, heights: [0, 0], water: [0, 1] });
    const { context, calls } = canvasDouble(); drawWorld(context, world, 'combined', null, options());
    const water = calls.filter(c => c.op === 'fillRect' && c.fill === MAP_THEME.water);
    expect(water.map(c => c.args)).toEqual([[1, 0, 1, 1]]); expect(waterOpacity(0)).toBe(0); expect(waterOpacity(1)).toBeGreaterThan(0);
  });
  it('LM-04: 実際のペア移動記録を順に再生すると水量配列が一致する', () => {
    const world = createWorld({ width: 3, height: 2, heights: [0, 0, 0, 0, 0, 0], water: [0, 128, 0, 0, 0, 0] });
    const reconstructed = [...world.water]; let flows: readonly FlowTransfer[] = [];
    stepWorld(world, receipt => { flows = receipt.flows!; });
    expect(flows.length).toBeGreaterThan(0);
    for (const flow of flows) { expect(flow.amount).toBeGreaterThan(0); reconstructed[flow.from] -= flow.amount; reconstructed[flow.to] += flow.amount; }
    expect(reconstructed).toEqual([...world.water]);
    for (const glyph of flowGlyphs(world, flows, true)) expect(flows).toContainEqual({ from: glyph.from, to: glyph.to, amount: glyph.amount });
    expect(Object.isFrozen(flows)).toBe(true); expect(Object.isFrozen(flows[0])).toBe(true);
  });
  it('LM-05: 水面に勾配があっても記録なし・流量0・OFFでは矢印を作らない', () => {
    const world = createWorld({ width: 2, height: 1, heights: [10, 0], water: [100, 0] });
    expect(flowGlyphs(world, [], true)).toEqual([]);
    expect(flowGlyphs(world, [{ from: 0, to: 1, amount: 0 }], true)).toEqual([]);
    expect(flowGlyphs(world, [{ from: 0, to: 1, amount: 50 }], false)).toEqual([]);
  });
  it('LM-06: 施設形状・保護模様と町の5状態を区別する', () => {
    expect(new Set([markerKind(TerrainType.Source, true), markerKind(TerrainType.Intake, true), markerKind(TerrainType.Outlet, true), markerKind(TerrainType.Normal, true), 'TOWN_HOUSE']).size).toBe(5);
    const town = { id: 't', name: '町', currentIntake: 0, requiredIntake: 8, currentDepth: 0, floodThreshold: 100, maximumDepth: 0, deliveryAtDeadline: null, firstFloodStep: null };
    expect(townAppearance(0, 100)).toBe('NORMAL'); expect(townAppearance(0, 100, town)).toBe('SHORTAGE');
    expect(townAppearance(0, 100, { ...town, currentIntake: 8 })).toBe('DELIVERED');
    expect(townAppearance(75, 100, town)).toBe('DANGER'); expect(townAppearance(100, 100, town)).toBe('FLOODED');
    expect(townAppearance(0, 100, { ...town, firstFloodStep: 3 })).toBe('FLOODED');
    const world = createWorld({ width: 4, height: 1, heights: [0, 0, 0, 0], protected: [0, 0, 0, 1],
      sources: [{ index: 0, rate: 1 }], intakes: [{ index: 1, rate: 1 }], outlets: [{ index: 2, rate: 1 }] });
    const { context, calls } = canvasDouble();
    drawWorld(context, world, 'combined', null, { ...options(4, 1), towns: [{ id: 't', name: '町', centerCell: 3, floodThreshold: 100 }], townProgress: [town] });
    expect(calls.some(c => c.op === 'arc' && c.args[2] === .43)).toBe(true);
    expect(calls.filter(c => c.op === 'quadraticCurveTo')).toHaveLength(2);
    expect(calls.some(c => c.op === 'rect' && c.args[0] === 2.07)).toBe(true);
    expect(calls.some(c => c.op === 'fillText' && c.args[0] === '↓')).toBe(true);
    expect(calls.some(c => c.op === 'fillText' && String(c.args[0]).includes('給水不足'))).toBe(true);
  });
  it('LM-07: レンダラーのハイライトは実際の変更セル集合と完全に一致', () => {
    const world = createWorld({ width: 4, height: 4, heights: new Array(16).fill(8), protected: [1, ...new Array(15).fill(0)] });
    const preview = buildStroke([{ x: 0, y: 0 }, { x: 4, y: 4 }], 4, 4, { mode: 'LOWER', maxLength: 2, radius: 1, heightDelta: 4 });
    const edits = strokeEdits(world, preview.stroke), { context, calls } = canvasDouble();
    drawWorld(context, world, 'combined', null, { ...options(4, 4), preview, edits });
    const highlighted = calls.filter(c => c.op === 'fillRect' && c.fill === MAP_THEME.lower && c.alpha === .3).map(c => Number(c.args[1]) * 4 + Number(c.args[0]));
    expect(highlighted).toEqual(edits.map(e => e.index)); expect(applyStroke(world, preview.stroke).map(e => e.index)).toEqual(highlighted);
    expect(highlighted).not.toContain(0); expect(preview.overflow.length).toBeGreaterThan(0);
    expect(calls.some(c => c.op === 'setLineDash' && (c.args[0] as number[]).length > 0)).toBe(true);
    expect(calls.some(c => c.op === 'fillText' && String(c.args[0]).includes('削る −4 · 残り 0.00セル'))).toBe(true);
  });
  it('LM-08 / LM-13: 高DPI・ズーム・リサイズ後もCSS座標の逆変換と描画位置が一致', () => {
    const camera = createCamera(); let viewport = { width: 640, height: 640, worldWidth: 64, worldHeight: 64 };
    zoomAt(camera, 2, { x: 320, y: 320 }, viewport);
    camera.offsetX *= 390 / 640; camera.offsetY *= 390 / 640;
    viewport = { ...viewport, width: 390, height: 390 }; constrainCamera(camera, viewport);
    const cell = { x: 22.5, y: 30.5 }, screen = worldToScreen(cell, camera, viewport);
    expect(screenToWorld(screen, camera, viewport)).toEqual(cell);
    for (const dpr of [1, 2, 4]) {
      const world = createWorld({ width: 64, height: 64, heights: new Array(4096).fill(0) }), { context, calls } = canvasDouble();
      drawWorld(context, world, 'height', null, { camera, viewport, preview: null, edits: [], devicePixelRatio: dpr });
      expect(calls.filter(c => c.op === 'translate').at(-1)?.args).toEqual([camera.offsetX, camera.offsetY]);
      expect(context.canvas.width).toBe(canvasSize(390, 390, dpr).width);
      expect(context.canvas.width / 390).toBeLessThanOrEqual(2);
    }
    expect(canvasSize(4000, 4000, 4).width).toBe(1600);
  });
  it('LM-11: 改善は指標と目標で区別し、目標外の値は参考に留める', () => {
    expect(metricRelevant('WATER_DELIVERY', 'intake')).toBe(true); expect(metricRelevant('WATER_DELIVERY', 'flood')).toBe(false);
    expect(metricRelevant('FLOOD_PREVENTION', 'flood')).toBe(true); expect(metricRelevant('FLOOD_PREVENTION', 'intake')).toBe(false);
    expect(metricRelevant('COMBINED', 'intake') && metricRelevant('COMBINED', 'flood')).toBe(true);
  });
  it('流量取得の有無で計算が変わらず、ランナーのRESETで過去流量も消える', () => {
    const def = { width: 2, height: 1, heights: [0, 0], water: [8, 0] };
    const plain = createWorld(def), observed = new SimulationRunner(def); stepWorld(plain); observed.step();
    expect(snapshotWorld(observed.world)).toEqual(snapshotWorld(plain)); expect(observed.lastFlows).toEqual([{ from: 0, to: 1, amount: 4 }]);
    observed.reset(); expect(observed.lastFlows).toEqual([]);
  });
});

describe('Living Map comparison presentation', () => {
  it('LM-09: 実比較画面のズーム・パン用カメラをA/B共通で描画しリサイズでも維持', () => {
    const ui = comparisonDom(), view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
    view.open(stages[0], solution(0), 20, true); ui.click('comparison-pause'); ui.click('comparison-zoom-in'); view.draw();
    expect(ui.get('comparison-zoom').textContent).toBe('1.25×');
    const translate = (index: number) => ui.paints[index].calls.filter(c => c.op === 'translate').at(-1)?.args as number[];
    expect(translate(0)).toEqual(translate(1)); const old = translate(0);
    ui.resize(200); view.draw(); expect(translate(0)).toEqual(translate(1));
    expect(translate(0)[0]).toBeCloseTo(old[0] * 2 / 3); expect(ui.get('comparison-zoom').textContent).toBe('1.25×');
  });
  it('LM-10: 実BEFORE/AFTERボタンは現在の同期スナップショットとカメラを維持', () => {
    const ui = comparisonDom(), observe = vi.spyOn(ComparisonController.prototype, 'getStateAt');
    const view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
    view.open(stages[0], solution(0), 20, true); ui.click('comparison-pause'); ui.click('comparison-step'); ui.click('comparison-zoom-in');
    view.draw(); const before = observe.mock.results.at(-1)!.value;
    ui.get('comparison-layout').value = 'switch'; ui.get('comparison-layout').onchange();
    ui.click('comparison-before'); view.draw(); ui.click('comparison-after'); view.draw();
    expect(observe.mock.results.at(-1)!.value).toBe(before); expect(before.step).toBe(1);
    expect(ui.get('comparison-zoom').textContent).toBe('1.25×');
  });
  it('LM-12: 流線アニメーションON/OFF・軽減変更で実比較結果が変わらない', () => {
    expect(defaultDisplaySettings(true).reducedMotion).toBe(true);
    const ui = comparisonDom(), observe = vi.spyOn(ComparisonController.prototype, 'getFinalResult');
    const view = new ComparisonView({ onBack() {}, onRetry() {}, onNext() {} });
    view.open(stages[0], solution(0), 60, true);
    for (let frame = 0; frame < 30; frame++) { view.setDisplaySettings({ showFlow: true, reducedMotion: frame % 2 === 0 }); view.advance(200); view.draw(frame * 200); }
    const result = observe.mock.results.map(r => r.value).find(Boolean)!;
    const reference = new ComparisonController(stages[0], solution(0)); while (reference.stepNumber < reference.maxSteps) reference.step();
    expect(result).toEqual(reference.getFinalResult()); expect(ui.get('comparison-outcome-summary').textContent).toContain('✓ 成功');
    expect(flowAnimationPhase(800, true, true)).toBe(0); expect(flowAnimationPhase(800, false, true)).toBe(.5); expect(flowAnimationPhase(800, false, false)).toBe(0);
  });
  it.each([0, 1, 2])('LM-14: Stage %iの既存成功ストローク・給水と浸水結果を維持', index => {
    const controller = new ComparisonController(stages[index], solution(index));
    while (controller.stepNumber < controller.maxSteps) controller.step();
    const result = controller.getFinalResult()!;
    expect(result.worldAResult.goal.status).toBe('FAILURE'); expect(result.worldBResult.goal.status).toBe('SUCCESS');
    expect(result.worldAResult.balance.difference).toBe(0); expect(result.worldBResult.balance.difference).toBe(0);
    expect(result.intakeDifference.total.delta).toBe([9868, 6117, 0][index]);
    expect(result.floodDifference.maximumDepth.delta).toBe([0, 0, -424][index]);
  });
});
