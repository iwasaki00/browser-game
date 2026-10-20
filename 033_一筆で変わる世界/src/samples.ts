import { type WorldDefinition } from './core/world';

export interface Sample { id: string; name: string; description: string; create: () => WorldDefinition }
function base(): WorldDefinition {
  return { width: 64, height: 64, heights: new Uint8Array(4096), water: new Float64Array(4096) };
}
export const samples: Sample[] = [
  { id: 'flat', name: '01 平坦な地形', description: '平らな閉鎖盤面。中央の水が四方向へ広がります。供給・除去はありません。', create: () => {
    const d = base();
    for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) (d.water as Float64Array)[y * 64 + x] = 4096;
    return d;
  } },
  { id: 'valley', name: '02 高低差のある地形', description: '段丘から谷底へ。地形の高さと水面差によって流れる向きが変わります。', create: () => {
    const d = base();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      (d.heights as Uint8Array)[y * 64 + x] = Math.floor(Math.abs(x - 32) / 4) + Math.floor((63 - y) / 8);
      if (y >= 6 && y < 14 && x >= 26 && x < 38) (d.water as Float64Array)[y * 64 + x] = 8192;
    }
    return d;
  } },
  { id: 'facilities', name: '03 水源・取水・排出口', description: '中央の水源から供給。左の取水地点と右の排出口で除去し、収支を追跡します。外周は閉じています。', create: () => {
    const d = base();
    d.sources = [{ index: 32 * 64 + 32, rate: 4096 }];
    d.intakes = [{ index: 32 * 64 + 23, rate: 384 }];
    d.outlets = [{ index: 32 * 64 + 41, rate: Infinity }];
    const protectedCells = new Uint8Array(4096);
    for (const e of [...d.sources, ...d.intakes, ...d.outlets]) protectedCells[e.index] = 1;
    d.protected = protectedCells;
    return d;
  } },
];
