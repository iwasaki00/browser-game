import { describe, expect, it } from 'vitest';
import { createWorld, assertConservation, MAX_WATER, totalWater, type WorldDefinition } from '../src/core/world';
import { equalizePair, stepWorld, updateGroup } from '../src/core/simulation';
import { SimulationRunner } from '../src/core/runner';
import { samples } from '../src/samples';

const pair = (water: number[], heights = [0, 0]) => createWorld({ width: 2, height: 1, heights, water });
function run(definition: WorldDefinition, steps = 600) {
  const world = createWorld(definition);
  for (let i = 0; i < steps; i++) stepWorld(world);
  return world;
}
describe('隣接ペアの整数平衡化', () => {
  it('WF-01: 8と0は4と4になる', () => {
    const w = pair([8, 0]); expect(equalizePair(w, 0, 1)).toBe(4); expect([...w.water]).toEqual([4, 4]);
  });
  it('WF-02: 1と0は移動しない', () => {
    const w = pair([1, 0]); expect(equalizePair(w, 0, 1)).toBe(0); expect([...w.water]).toEqual([1, 0]);
  });
  it('WF-03: 地形ではなく水面差によって低地からも流れる', () => {
    const w = pair([0, 1024], [1, 0]); equalizePair(w, 0, 1); expect([...w.water]).toEqual([384, 640]);
    const downhill = pair([20, 0], [2, 0]); equalizePair(downhill, 0, 1); expect([...downhill.water]).toEqual([0, 20]);
  });
  it('WF-04: 水面より高い障壁を越えない', () => {
    const w = pair([200, 0], [0, 1]); equalizePair(w, 0, 1); expect([...w.water]).toEqual([200, 0]);
  });
  it('盤面の行末から次行の先頭へのペアを拒否する', () => {
    const w = createWorld({ width: 2, height: 2, heights: [0, 0, 0, 0] });
    expect(() => equalizePair(w, 1, 2)).toThrow('隣接');
  });
  it.each([-1, 2, .5, NaN])('範囲外・不正インデックス %s を拒否する', index => {
    expect(() => equalizePair(pair([0, 0]), 0, index)).toThrow();
  });
  it('負の水量を補正せず拒否する', () => {
    const w = pair([0, 0]); w.water[0] = -1;
    expect(() => equalizePair(w, 0, 1)).toThrow(); expect(() => stepWorld(w)).toThrow();
  });
});
describe('論理ステップと収支', () => {
  it('WF-05: 閉じた地形では600ステップ後も総水量を保存する', () => {
    const definition = samples[1].create();
    const w = run(definition); expect(totalWater(w.water)).toBe(totalWater(definition.water!));
  });
  it('WF-06: 同じ入力は全セル・累積値まで再現する', () => {
    const definition = samples[2].create(); expect(run(definition)).toEqual(run(definition));
  });
  it.each(samples.map(sample => [sample.name, sample] as const))('WF-07: %s を600ステップ実行して全水量が非負の安全な整数', (_, sample) => {
    const w = run(sample.create()); expect(w.step).toBe(600);
    expect([...w.water].every(n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_WATER)).toBe(true);
    expect(() => assertConservation(w)).not.toThrow(); expect(stepWorld(w)).toBe(false);
  });
  it('WF-08: 流動→供給→取水→排出の順序で正確に集計する', () => {
    const w = createWorld({ width: 4, height: 1, heights: [0, 0, 0, 0], water: [16, 0, 0, 0],
      sources: [{ index: 0, rate: 6 }], intakes: [{ index: 1, rate: 3 }], outlets: [{ index: 3, rate: Infinity }] });
    stepWorld(w);
    expect([...w.water]).toEqual([14, 1, 4, 0]);
    expect([w.cumulativeSupply, w.cumulativeIntake, w.cumulativeOutlet]).toEqual([6, 3, 0]);
    for (let i = 0; i < 30; i++) stepWorld(w);
    expect(w.cumulativeOutlet).toBeGreaterThan(0); expect(assertConservation(w)).toBe(16 + w.cumulativeSupply - w.cumulativeIntake - w.cumulativeOutlet);
  });
  it('WF-09: 対称な2×2盤面の方向偏りを記録する（対称性を強制しない）', () => {
    const w = createWorld({ width: 2, height: 2, heights: [0, 0, 0, 0], water: [8, 0, 0, 8] });
    // A→B→C→D: この対称入力は1ステップで完全平衡。
    stepWorld(w); expect([...w.water]).toEqual([4, 4, 4, 4]);
    const flat = samples[0].create(), results = [];
    for (const step of [1, 4, 20, 100, 600]) {
      const state = run(flat, step); let horizontalL1 = 0, verticalL1 = 0, maxDifference = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const v = state.water[y * 64 + x];
        const dx = Math.abs(v - state.water[y * 64 + 63 - x]);
        const dy = Math.abs(v - state.water[(63 - y) * 64 + x]);
        horizontalL1 += dx; verticalL1 += dy; maxDifference = Math.max(maxDifference, dx, dy);
      }
      results.push({ step, horizontalL1, verticalL1, maxDifference });
      expect(assertConservation(state)).toBe(262144);
    }
    console.info('WF-09 対称入力の鏡映差（水量単位）', JSON.stringify(results));
    expect(results.every(row => Number.isSafeInteger(row.maxDifference))).toBe(true);
    const odd = createWorld({ width: 5, height: 1, heights: [0, 0, 0, 0, 0], water: [0, 0, 8, 0, 0] });
    stepWorld(odd);
    console.info('WF-09 奇数幅の対称入力・Step 1:', [...odd.water]);
    expect([...odd.water]).toEqual([0, 2, 2, 2, 2]);
    expect(assertConservation(odd)).toBe(8);
  });
  it('WF-10: 5/20/60ステップ毎秒で同じ論理ステップの結果が一致する', () => {
    const definition = samples[2].create();
    const expected = run(definition, 120);
    for (const speed of [5, 20, 60]) {
      const runner = new SimulationRunner(definition); runner.setSpeed(speed); runner.play();
      while (runner.world.step < 120) runner.advance(1000 / speed);
      expect(runner.world).toEqual(expected);
    }
  });
  it('WF-11: 生成した世界と定義が可変配列や施設設定を共有しない', () => {
    const definition = samples[2].create(), a = createWorld(definition), b = createWorld(definition);
    for (const key of ['heights', 'water', 'protected', 'terrainType'] as const) { a[key][0] = 1; expect(b[key][0]).toBe(0); }
    a.sources[0].rate = 9; expect(b.sources[0].rate).toBe(4096); expect(definition.sources![0].rate).toBe(4096);
  });
  it('WF-12: 取り除いた水を重複計上しない', () => {
    const w = createWorld({ width: 1, height: 1, heights: [0], water: [8], intakes: [{ index: 0, rate: 5 }] });
    stepWorld(w); expect(w.cumulativeIntake).toBe(5); stepWorld(w); stepWorld(w);
    expect(w.cumulativeIntake).toBe(8); expect(w.water[0]).toBe(0);
  });
  it('有限排出は上限まで、無制限排出はすべて除去する', () => {
    for (const [rate, remaining] of [[3, 5], [Infinity, 0]]) {
      const w = createWorld({ width: 1, height: 1, heights: [0], water: [8], outlets: [{ index: 0, rate }] });
      stepWorld(w); expect(w.water[0]).toBe(remaining); expect(w.cumulativeOutlet).toBe(8 - remaining);
    }
  });
  it('グループ順はステップごとに回転する', () => {
    const def = { width: 3, height: 3, heights: new Uint8Array(9), water: [99, 0, 0, 0, 0, 0, 0, 0, 0] };
    const actual = createWorld(def), manual = createWorld(def);
    for (let step = 0; step < 8; step++) {
      for (let i = 0; i < 4; i++) updateGroup(manual, (step + i) % 4);
      stepWorld(actual); expect(actual.water).toEqual(manual.water);
    }
  });
  it.each([[1, 1], [1, 4], [4, 1], [3, 5]])('端を閉じた任意サイズ %s×%s', (width, height) => {
    const water = new Float64Array(width * height); water[0] = 100;
    const w = run({ width, height, heights: new Uint8Array(width * height), water }, 20);
    expect(totalWater(w.water)).toBe(100);
  });
});
describe('入力拒否・異常検知', () => {
  const valid: WorldDefinition = { width: 2, height: 1, heights: [0, 0] };
  it.each<Partial<WorldDefinition>>([
    { width: 0 }, { width: -1 }, { width: 1.5 }, { height: NaN },
    { heights: [0] }, { heights: [-1, 0] }, { heights: [256, 0] }, { heights: [1.2, 0] },
    { water: [-1, 0] }, { water: [Infinity, 0] }, { water: [MAX_WATER + 1, 0] },
    { water: [MAX_WATER, MAX_WATER] }, { protected: [0, 2] },
    { sources: [{ index: 2, rate: 1 }] }, { sources: [{ index: 0, rate: Infinity }] },
    { intakes: [{ index: 0, rate: -1 }] }, { outlets: [{ index: 0, rate: NaN }] },
    { sources: [{ index: 0, rate: 1 }], outlets: [{ index: 0, rate: 1 }] },
    { intakes: [{ index: 0, rate: 1 }, { index: 0, rate: 2 }] },
  ])('不正な定義を拒否する: %j', patch => expect(() => createWorld({ ...valid, ...patch })).toThrow());
  it('供給オーバーフローを明示し、失敗ステップをコミットしない', () => {
    const w = createWorld({ width: 1, height: 1, heights: [255], water: [MAX_WATER], sources: [{ index: 0, rate: 1 }] });
    expect(() => stepWorld(w)).toThrow(); expect(w.step).toBe(0); expect(w.water[0]).toBe(MAX_WATER); expect(w.cumulativeSupply).toBe(0);
  });
  it('総量の不整合を検知する', () => { const w = pair([8, 0]); w.water[1] = 1; expect(() => stepWorld(w)).toThrow('水量保存'); });
});
describe('実行制御', () => {
  it('リセット後に初期状態へ戻り、元定義の外部変更にも影響されない', () => {
    const def = samples[2].create(), r = new SimulationRunner(def), initial = createWorld(def);
    (def.heights as Uint8Array)[0] = 255; def.sources![0].rate = 1;
    r.play(); r.advance(200); r.reset(); expect(r.world).toEqual(initial); expect(r.playing).toBe(false);
  });
  it('停止中は進まず、大きい時間差でも1フレーム8ステップ以内', () => {
    const r = new SimulationRunner(samples[0].create()); expect(r.advance(1000)).toBe(0);
    r.setSpeed(60); r.play(); expect(r.advance(999999)).toBe(8);
    r.pause(); expect(r.advance(1000)).toBe(0); expect(r.world.step).toBe(8);
  });
  it('600で自動停止し、再生やSTEPでも上限を越えない', () => {
    const r = new SimulationRunner({ width: 1, height: 1, heights: [0] });
    r.setSpeed(60); r.play(); while (r.playing) r.advance(250);
    expect(r.world.step).toBe(600); r.play(); expect(r.playing).toBe(false); expect(r.step()).toBe(false);
  });
  it('不正な速度・時間差を拒否する', () => {
    const r = new SimulationRunner(samples[0].create()); expect(() => r.setSpeed(0)).toThrow();
    expect(() => r.advance(-1)).toThrow(); expect(() => r.advance(Infinity)).toThrow();
  });
});
