import { loadStage, type StageDefinition } from './stage';
import { extendedStages } from './extended-stages';

/** High protected walls enclose visible channels; only the intended gates remain editable. */
function board(size: number) {
  const heights = new Array<number>(size * size).fill(40);
  const water = new Array<number>(size * size).fill(0);
  const editable = new Set<number>();
  const cell = (x: number, y: number) => y * size + x;
  const channel = (x1: number, y1: number, x2: number, y2: number, h = 0) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) heights[cell(x, y)] = h;
  };
  return { heights, water, editable, cell, channel, protectedCells: () => heights.map((_, i) => i).filter(i => !editable.has(i)) };
}
function first(): StageDefinition {
  // Objective: open the single ridge between reservoir and the town's intake.
  const n = 16, b = board(n);
  b.channel(2, 6, 5, 9); b.channel(6, 7, 12, 8);
  b.channel(7, 7, 7, 8, 8);
  for (const y of [7, 8]) b.editable.add(b.cell(7, y));
  b.water[b.cell(3, 7)] = 8192; b.water[b.cell(4, 8)] = 8192;
  b.heights[b.cell(12, 10)] = 10;
  return loadStage({ id: 'stage-01', title: 'はじめての一筆',
    description: '貯水池と取水地点の間にある細い尾根を削り、水路を開こう。黄色の◆が取水地点、白い家が町です。',
    terrain: { width: n, height: n, heights: b.heights }, initialWater: b.water,
    sources: [], intakes: [{ id: 'intake-01', index: b.cell(12, 7), rate: 256 }], outlets: [],
    protectedCells: b.protectedCells(), towns: [{ id: 'town-01', name: '若葉の町', centerCell: b.cell(12, 10),
      linkedIntakeId: 'intake-01', requiredIntake: 4096, floodThreshold: 512 }],
    strokeMode: 'LOWER', maxStrokeLength: 5, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 120,
    goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town-01'], deliveryDeadlineStep: 120 } });
}
function second(): StageDefinition {
  // Objective: connect two successive gates along a bent, protected channel before the deadline.
  const n = 24, b = board(n);
  b.channel(2, 5, 5, 8); b.channel(6, 6, 12, 7); b.channel(11, 7, 12, 14); b.channel(12, 13, 19, 14);
  b.channel(8, 6, 8, 7, 8); b.channel(11, 10, 12, 10, 8);
  for (const [x, y] of [[8, 6], [8, 7], [11, 10], [12, 10]]) b.editable.add(b.cell(x, y));
  // A tempting dead-end branch dissipates finite reservoir water if the lower ridge is left closed.
  b.channel(6, 8, 7, 11);
  b.water[b.cell(3, 6)] = 12288; b.water[b.cell(4, 7)] = 12288;
  b.heights[b.cell(19, 17)] = 10;
  return loadStage({ id: 'stage-02', title: '乾いた町',
    description: '曲がりくねった水路には二つの尾根があります。限られた一筆で両方を開き、遠くの乾いた町へ水を届けよう。',
    terrain: { width: n, height: n, heights: b.heights }, initialWater: b.water,
    sources: [], intakes: [{ id: 'intake-02', index: b.cell(19, 13), rate: 256 }], outlets: [],
    protectedCells: b.protectedCells(), towns: [{ id: 'town-02', name: '風待ちの町', centerCell: b.cell(19, 17),
      linkedIntakeId: 'intake-02', requiredIntake: 2048, floodThreshold: 512 }],
    strokeMode: 'LOWER', maxStrokeLength: 8, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 240,
    goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town-02'], deliveryDeadlineStep: 240 } });
}
function third(): StageDefinition {
  // Objective: seal the two-cell-wide approach with a raised bank; the town itself cannot be raised.
  const n = 16, b = board(n);
  b.channel(2, 6, 5, 9); b.channel(6, 7, 12, 8); b.channel(11, 6, 13, 9);
  for (const y of [7, 8]) b.editable.add(b.cell(8, y));
  b.water[b.cell(3, 7)] = 8192; b.water[b.cell(4, 8)] = 8192;
  return loadStage({ id: 'stage-03', title: '水害から守れ',
    description: '水が低い町へ流れ込みます。町の手前の細い水路を盛って堤防にし、観測期間中の浸水を防ごう。',
    terrain: { width: n, height: n, heights: b.heights }, initialWater: b.water,
    sources: [], intakes: [], outlets: [], protectedCells: b.protectedCells(),
    towns: [{ id: 'town-03', name: '川辺の町', centerCell: b.cell(12, 7), floodThreshold: 128 }],
    strokeMode: 'RAISE', maxStrokeLength: 5, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 160,
    goalDefinition: { type: 'FLOOD_PREVENTION', townIds: ['town-03'], floodObservationEndStep: 160 } });
}
export const stages: readonly StageDefinition[] = Object.freeze([first(), second(), third(), ...extendedStages]);
