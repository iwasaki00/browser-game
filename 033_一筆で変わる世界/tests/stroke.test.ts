import { describe, expect, it } from 'vitest';
import { createWorld, assertConservation, type WorldDefinition } from '../src/core/world';
import { applyStroke, buildStroke, DEFAULT_BRUSH, strokeEdits, type Point, type StrokeMode } from '../src/core/stroke';
import { TrialSession } from '../src/core/trial';
import { createCamera, constrainCamera, screenToWorld, worldToScreen, zoomAt } from '../src/input/camera';
import { GestureController } from '../src/input/gestures';
import { samples } from '../src/samples';

const definition = (height = 50): WorldDefinition => ({ width: 8, height: 8, heights: new Uint8Array(64).fill(height), water: new Float64Array(64).fill(4) });
const stroke = (points: Point[], mode: StrokeMode = 'RAISE', extra = {}) => buildStroke(points, 8, 8, { ...DEFAULT_BRUSH, mode, ...extra });
function preview(session: TrialSession, mode: StrokeMode = 'RAISE') {
  session.begin({ x: 2.5, y: 2.5 }, mode); session.append({ x: 5.5, y: 2.5 }); session.finish();
}
describe('一筆の幾何計算と離散セル適用', () => {
  it('ST-01: ユークリッド距離の線分和を計算する', () => {
    const { stroke: s } = stroke([{ x: .5, y: .5 }, { x: 3.5, y: 4.5 }, { x: 6.5, y: 4.5 }]);
    expect(s.effectiveLength).toBe(8);
  });
  it('ST-02: 超過線分を上限位置で切り、超過部分をシミュレーション用モデルから除く', () => {
    const result = buildStroke([{ x: 1, y: 2 }, { x: 25, y: 2 }], 32, 32, { ...DEFAULT_BRUSH, mode: 'RAISE' });
    expect(result.stroke.effectiveLength).toBe(12);
    expect(result.stroke.points.at(-1)).toEqual({ x: 13, y: 2 });
    expect(result.overflow).toEqual([{ from: { x: 13, y: 2 }, to: { x: 25, y: 2 } }]);
    const w = createWorld({ width: 32, height: 32, heights: new Uint8Array(1024) });
    applyStroke(w, result.stroke); expect(w.heights[2 * 32 + 23]).toBe(0);
  });
  it('ST-03: 同じセルを往復・自己交差で通過しても1回だけ変更', () => {
    const w = createWorld(definition());
    const { stroke: s } = stroke([{ x: 2.5, y: 2.5 }, { x: 5.5, y: 2.5 }, { x: 2.5, y: 2.5 }, { x: 5.5, y: 5.5 }]);
    const edits = applyStroke(w, s);
    expect(edits.length).toBe(new Set(edits.map(e => e.index)).size);
    expect(edits.every(e => w.heights[e.index] === 62)).toBe(true);
  });
  it('ST-04: LOWERで高度が12減少し、水量は変えない', () => {
    const w = createWorld(definition()), water = w.water.slice();
    applyStroke(w, stroke([{ x: 3.5, y: 3.5 }], 'LOWER').stroke);
    expect(w.heights[27]).toBe(38); expect(w.water).toEqual(water);
  });
  it('ST-05: RAISEで高度が12増加する', () => {
    const w = createWorld(definition()); applyStroke(w, stroke([{ x: 3.5, y: 3.5 }]).stroke); expect(w.heights[27]).toBe(62);
  });
  it('ST-06: 高度は0〜255に制限され、変化しないセルは対象数に含めない', () => {
    for (const [height, mode, expected] of [[5, 'LOWER', 0], [250, 'RAISE', 255]] as const) {
      const w = createWorld(definition(height)); const s = stroke([{ x: 3.5, y: 3.5 }], mode).stroke;
      applyStroke(w, s); expect(w.heights[27]).toBe(expected); expect(strokeEdits(w, s)).toEqual([]);
    }
  });
  it('ST-07: protectedと施設は個別に除外され、ストローク長は消費する', () => {
    const d = definition(), protectedCells = new Uint8Array(64); protectedCells[25] = 1; d.protected = protectedCells;
    d.sources = [{ index: 26, rate: 1 }]; d.intakes = [{ index: 27, rate: 1 }]; d.outlets = [{ index: 28, rate: Infinity }];
    const w = createWorld(d), s = stroke([{ x: .5, y: 3.5 }, { x: 7.5, y: 3.5 }]).stroke;
    expect(s.effectiveLength).toBe(7); applyStroke(w, s);
    for (const i of [25, 26, 27, 28]) expect(w.heights[i]).toBe(50);
    expect(w.heights[24]).toBe(62); expect(w.heights[29]).toBe(62);
  });
  it('ST-08: 範囲外は長さに含めず、盤面端の有効セルだけ変更する', () => {
    const w = createWorld(definition()), s = stroke([{ x: -10, y: .5 }, { x: 10, y: .5 }]).stroke;
    expect(s.effectiveLength).toBe(8);
    expect(s.segments.every(segment => segment.from.x >= 0 && segment.to.x <= 8)).toBe(true);
    expect(applyStroke(w, s).every(e => e.index >= 0 && e.index < 64)).toBe(true);
  });
  it('盤面を離れて再入場しても無関係なセルを直線でつながない', () => {
    const s = stroke([{ x: .5, y: .5 }, { x: -1, y: .5 }, { x: -1, y: 6.5 }, { x: .5, y: 6.5 }], 'RAISE', { radius: .1 }).stroke;
    expect(s.effectiveLength).toBe(1);
    const w = createWorld(definition()); applyStroke(w, s);
    expect(w.heights[0]).toBe(62); expect(w.heights[48]).toBe(62); expect(w.heights[24]).toBe(50);
  });
  it('ST-10: プレビューと実際の変更セルおよび高度が一致する', () => {
    const w = createWorld(definition()), before = w.heights.slice(), s = stroke([{ x: .5, y: .5 }, { x: 6.5, y: 6.5 }]).stroke;
    const expected = strokeEdits(w, s); expect(w.heights).toEqual(before);
    expect(applyStroke(w, s)).toEqual(expected);
    expect([...w.heights].flatMap((h, i) => h !== before[i] ? [i] : [])).toEqual(expected.map(e => e.index));
  });
  it('同じ線を疎・密なイベント列から生成しても変更セルが一致する（切り詰めと円形境界を含む）', () => {
    const w = createWorld(definition());
    const sparse = stroke([{ x: .5, y: .5 }, { x: 7.5, y: 7.5 }], 'RAISE', { maxLength: 5.25 }).stroke;
    const points = Array.from({ length: 129 }, (_, i) => ({ x: .5 + i * 7 / 128, y: .5 + i * 7 / 128 }));
    const dense = stroke(points, 'RAISE', { maxLength: 5.25 }).stroke;
    expect(strokeEdits(w, dense)).toEqual(strokeEdits(w, sparse));
    expect(dense.effectiveLength).toBeCloseTo(sparse.effectiveLength, 10);
  });
  it('セル中心との距離が半径と等しければ対象、わずかに外なら対象外', () => {
    const w = createWorld(definition());
    const s = stroke([{ x: 1.5, y: 2.5 }, { x: 5.5, y: 2.5 }], 'RAISE', { radius: 1 }).stroke;
    const indices = strokeEdits(w, s).map(e => e.index);
    expect(indices).toContain(1 * 8 + 3); expect(indices).not.toContain(0 * 8 + 3);
  });
  it('空・全範囲外ストロークは編集対象がない', () => {
    const w = createWorld(definition());
    expect(strokeEdits(w, stroke([]).stroke)).toEqual([]);
    expect(strokeEdits(w, stroke([{ x: -10, y: -10 }, { x: -1, y: -1 }]).stroke)).toEqual([]);
  });
  it('不正座標・ブラシ設定を明示的に拒否する', () => {
    expect(() => stroke([{ x: NaN, y: 0 }])).toThrow();
    for (const extra of [{ maxLength: -1 }, { radius: NaN }, { heightDelta: .5 }]) expect(() => stroke([], 'RAISE', extra)).toThrow();
  });
});
describe('試行の状態遷移と初期状態', () => {
  it('ST-09: 描画中・プレビュー中のキャンセルは元地形を維持', () => {
    const s = new TrialSession(definition()), initial = s.runner.world.heights.slice();
    s.begin({ x: 2.5, y: 2.5 }, 'RAISE'); s.append({ x: 5.5, y: 2.5 });
    expect(s.phase).toBe('DRAWING'); expect(s.runner.world.heights).toEqual(initial);
    s.cancel(); expect(s.phase).toBe('READY'); expect(s.preview).toBeNull(); expect(s.runner.world.heights).toEqual(initial);
    preview(s); s.cancel(); expect(s.runner.world.heights).toEqual(initial);
  });
  it('ST-12: RESETで初期地形・初期水量・全集計が復元される', () => {
    const d = samples[2].create(), s = new TrialSession(d), initial = createWorld(d);
    preview(s); s.execute(); s.advance(200); s.reset();
    expect(s.runner.world).toEqual(initial); expect(s.phase).toBe('READY'); expect(s.preview).toBeNull(); expect(s.appliedCount).toBe(0);
  });
  it('ST-13: 実行は初期水量と施設を保持し、論理ステップ0で再生成する', () => {
    const d = samples[2].create(), s = new TrialSession(d), initial = createWorld(d);
    preview(s);
    // Inject a past run into the presentation world to verify execution never carries it over.
    s.runner.world.water[0] = 999; s.runner.world.step = 99; s.runner.world.cumulativeSupply = 999;
    expect(s.execute()).toBe(true);
    expect(s.runner.world.step).toBe(0); expect(s.runner.world.water).toEqual(initial.water);
    expect(s.runner.world.sources).toEqual(initial.sources); expect(s.runner.world.cumulativeSupply).toBe(0);
    expect(s.runner.world.cumulativeIntake).toBe(0); expect(s.runner.world.cumulativeOutlet).toBe(0);
  });
  it('ST-14: 編集後も施設を含む600ステップの水量保存が成立', () => {
    const s = new TrialSession(samples[2].create());
    s.begin({ x: 25, y: 32 }, 'RAISE'); s.append({ x: 37, y: 32 }); s.finish(); s.execute();
    while (s.runner.playing) { s.advance(200); expect(() => assertConservation(s.runner.world)).not.toThrow(); }
    expect(s.phase).toBe('RESULT'); expect(s.runner.world.step).toBe(600); expect(s.appliedCount).toBeGreaterThan(0);
  });
  it('ST-15: 同じ初期状態と一筆から全セルが再現する', () => {
    const a = new TrialSession(definition()), b = new TrialSession(definition());
    for (const s of [a, b]) { preview(s, 'LOWER'); s.execute(); for (let i = 0; i < 100; i++) s.advance(50); }
    expect(a.runner.world).toEqual(b.runner.world);
  });
  it('1試行1本。PREVIEW・実行後は別のストロークを開始できない', () => {
    const s = new TrialSession(definition()); preview(s);
    expect(s.begin({ x: 0, y: 0 }, 'LOWER')).toBe(false);
    const original = s.preview; s.play(); s.step(); expect(s.phase).toBe('PREVIEW');
    expect(s.preview).toBe(original); s.execute(); expect(s.begin({ x: 0, y: 0 }, 'LOWER')).toBe(false);
    const heights = s.runner.world.heights.slice(); s.cancel(); expect(s.runner.world.heights).toEqual(heights);
    s.runner.pause(); expect(s.phase).toBe('SIMULATING'); s.reset(); expect(s.begin({ x: 1, y: 1 }, 'RAISE')).toBe(true);
  });
  it('無変更・空ストロークは実行せず、理由を返す', () => {
    const s = new TrialSession(definition(0)); expect(s.execute()).toBe(false); preview(s, 'LOWER');
    expect(s.executionReason).toContain('変更対象がありません'); expect(s.execute()).toBe(false); expect(s.phase).toBe('PREVIEW');
  });
  it('初期定義は外部の変更と独立し、RESETは速度を維持する', () => {
    const d = definition(), s = new TrialSession(d); (d.heights as Uint8Array)[0] = 255;
    s.runner.setSpeed(60); preview(s); s.execute(); s.reset(); expect(s.runner.world.heights[0]).toBe(50); expect(s.runner.speed).toBe(60);
  });
});
describe('カメラ・Pointer Events用ジェスチャー', () => {
  const viewport = { width: 640, height: 640, worldWidth: 64, worldHeight: 64 };
  it('ST-11: ズーム・移動・CSS解像度が異なっても座標変換が往復一致する', () => {
    for (const width of [320, 640]) {
      const v = { ...viewport, width, height: width }, c = { zoom: 2.5, offsetX: -123, offsetY: -94 }, p = { x: 31.25, y: 22.75 };
      const result = screenToWorld(worldToScreen(p, c, v), c, v);
      expect(result.x).toBeCloseTo(p.x); expect(result.y).toBeCloseTo(p.y);
    }
  });
  it('ポインターを基準にズームし、1〜4倍とカメラ境界を守る', () => {
    const c = createCamera(), anchor = { x: 240, y: 260 }, before = screenToWorld(anchor, c, viewport);
    zoomAt(c, 3, anchor, viewport); expect(screenToWorld(anchor, c, viewport)).toEqual(before);
    zoomAt(c, 99, anchor, viewport); expect(c.zoom).toBe(4);
    c.offsetX = -999999; c.offsetY = 999999; constrainCamera(c, viewport);
    expect(c.offsetX).toBe(-1920); expect(c.offsetY).toBe(0);
    zoomAt(c, .1, anchor, viewport); expect(c).toEqual(createCamera());
  });
  it('ST-16: 2本目の指で描画をキャンセルし、残った1本指でも描画を再開しない', () => {
    const s = new TrialSession(definition()), c = createCamera();
    const g = new GestureController(s, c, () => ({ ...viewport, worldWidth: 8, worldHeight: 8 }));
    const initial = s.runner.world.heights.slice();
    g.down(1, { x: 100, y: 100 }); g.move(1, { x: 300, y: 100 }); expect(s.phase).toBe('DRAWING');
    g.down(2, { x: 400, y: 300 }); expect(s.phase).toBe('READY'); expect(s.preview).toBeNull();
    g.move(2, { x: 500, y: 400 }); expect(c.zoom).toBeGreaterThan(1);
    g.up(2); g.move(1, { x: 320, y: 120 }); g.up(1); expect(s.phase).toBe('READY'); expect(s.runner.world.heights).toEqual(initial);
  });
  it('pointercancel相当・入力喪失後にポインター状態が残らず再描画できる', () => {
    const s = new TrialSession(definition()), g = new GestureController(s, createCamera(), () => viewport);
    g.down(1, { x: 100, y: 100 }); g.cancel(); g.up(1); expect(g.pointers.size).toBe(0); expect(s.phase).toBe('READY');
    g.down(2, { x: 100, y: 100 }); g.up(2, { x: 150, y: 100 }); expect(s.phase).toBe('PREVIEW');
  });
  it('移動モードでは地形を変更せずパンする', () => {
    const s = new TrialSession(definition()), c = { zoom: 2, offsetX: -50, offsetY: -50 };
    const g = new GestureController(s, c, () => viewport); g.tool = 'PAN';
    g.down(1, { x: 100, y: 100 }); g.move(1, { x: 80, y: 80 }); g.up(1);
    expect(s.phase).toBe('READY'); expect(s.preview).toBeNull(); expect(c.offsetX).toBe(-70);
  });
  it('異なるカメラと取得間隔でも同じ地形上の線から同じ変更セルを得る', () => {
    const v = { ...viewport, worldWidth: 8, worldHeight: 8 };
    const expected = new TrialSession(definition()); preview(expected);
    const s = new TrialSession(definition()), c = { zoom: 2.5, offsetX: -150, offsetY: -100 };
    const g = new GestureController(s, c, () => v);
    g.down(1, worldToScreen({ x: 2.5, y: 2.5 }, c, v));
    for (let i = 1; i <= 128; i++) g.move(1, worldToScreen({ x: 2.5 + 3 * i / 128, y: 2.5 }, c, v));
    g.up(1); expect(s.edits).toEqual(expected.edits);
  });
  it('Canvas外のpointerupでも終了し、不正座標・未登録ポインターは無視する', () => {
    const s = new TrialSession(definition()), g = new GestureController(s, createCamera(), () => viewport);
    g.down(1, { x: NaN, y: 0 }); g.move(9, { x: 0, y: 0 }); expect(g.pointers.size).toBe(0);
    g.down(1, { x: 100, y: 100 }); g.up(1, { x: 900, y: 100 });
    expect(s.phase).toBe('PREVIEW'); expect(g.pointers.size).toBe(0);
  });
});
