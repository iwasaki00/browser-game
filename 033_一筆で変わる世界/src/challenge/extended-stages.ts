import { loadStage, type StageDefinition } from './stage';

function board() {
  const n = 24, heights = new Array<number>(n * n).fill(40), water = new Array<number>(n * n).fill(0), editable = new Set<number>();
  const cell = (x: number, y: number) => y * n + x;
  const channel = (x1: number, y1: number, x2: number, y2: number, height = 0) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) heights[cell(x, y)] = height;
  };
  const reservoir = (y: number) => {
    channel(2, y - 1, 5, y + 2);
    for (const [x, row] of [[3, y], [4, y], [3, y + 1], [4, y + 1]]) water[cell(x, row)] = 8192;
  };
  return { n, heights, water, cell, channel, reservoir, editable,
    protectedCells: () => heights.map((_, i) => i).filter(i => !editable.has(i)) };
}
function fork(): StageDefinition {
  const b = board(); b.reservoir(10);
  b.channel(6, 10, 18, 11); b.channel(6, 12, 7, 18); b.channel(9, 10, 9, 11, 8);
  for (const y of [10, 11]) b.editable.add(b.cell(9, y));
  b.heights[b.cell(18, 8)] = 10;
  return loadStage({ id: 'stage-04', title: '川の分かれ道',
    description: '分岐の先で、水は南の排出口へ逃げていきます。東の尾根を削ってもう一つの流れを開き、木立の町へ水を分けよう。',
    terrain: { width: b.n, height: b.n, heights: b.heights }, initialWater: b.water,
    sources: [], intakes: [{ id: 'intake-04', index: b.cell(18, 10), rate: 256 }],
    outlets: [{ id: 'outlet-04', index: b.cell(6, 18), rate: 64 }], protectedCells: b.protectedCells(),
    towns: [{ id: 'town-04', name: '木立の町', centerCell: b.cell(18, 8), linkedIntakeId: 'intake-04', requiredIntake: 2048, floodThreshold: 512 }],
    strokeMode: 'LOWER', maxStrokeLength: 5, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 240,
    goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town-04'], deliveryDeadlineStep: 240 } });
}
function wishes(): StageDefinition {
  const b = board(); b.reservoir(9);
  b.channel(6, 9, 11, 10); b.channel(10, 5, 11, 16);
  b.channel(12, 5, 18, 6); b.channel(12, 15, 18, 16);
  for (const y of [7, 12]) {
    b.channel(10, y, 11, y, 8);
    for (const x of [10, 11]) b.editable.add(b.cell(x, y));
  }
  b.heights[b.cell(18, 3)] = 10; b.heights[b.cell(18, 18)] = 10;
  return loadStage({ id: 'stage-05', title: '二つの願い',
    description: '北と南、どちらの町も水を待っています。縦の水路にある二つの尾根を一筆でつなぎ、両方の取水施設へ水を届けよう。',
    terrain: { width: b.n, height: b.n, heights: b.heights }, initialWater: b.water, sources: [], outlets: [],
    intakes: [{ id: 'intake-05-north', index: b.cell(18, 5), rate: 256 }, { id: 'intake-05-south', index: b.cell(18, 15), rate: 256 }],
    protectedCells: b.protectedCells(),
    towns: [{ id: 'town-05-north', name: '朝日の町', centerCell: b.cell(18, 3), linkedIntakeId: 'intake-05-north', requiredIntake: 1024, floodThreshold: 512 },
      { id: 'town-05-south', name: '夕日の町', centerCell: b.cell(18, 18), linkedIntakeId: 'intake-05-south', requiredIntake: 1024, floodThreshold: 512 }],
    strokeMode: 'LOWER', maxStrokeLength: 9, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 300,
    goalDefinition: { type: 'WATER_DELIVERY', townIds: ['town-05-north', 'town-05-south'], deliveryDeadlineStep: 300 } });
}
function lastStroke(): StageDefinition {
  const b = board(); b.reservoir(10);
  b.channel(6, 10, 20, 11); b.channel(18, 9, 20, 12);
  b.channel(8, 5, 9, 9); b.channel(10, 5, 17, 6);
  // An upstream dam is tempting, but also cuts off the north delivery branch.
  for (const y of [10, 11]) for (const x of [7, 12]) b.editable.add(b.cell(x, y));
  b.heights[b.cell(17, 3)] = 10;
  return loadStage({ id: 'stage-06', title: '最後の一筆',
    description: '東へ流すと川守の町が浸水します。でも水をせき止めるだけでは北の町が乾いたまま。分岐より下流に堤を作り、北への給水路を残そう。川守の町の取水施設は分岐より上流にあります。',
    terrain: { width: b.n, height: b.n, heights: b.heights }, initialWater: b.water, sources: [], outlets: [],
    intakes: [{ id: 'intake-06-north', index: b.cell(17, 5), rate: 256 }, { id: 'intake-06-east', index: b.cell(6, 11), rate: 8 }],
    protectedCells: b.protectedCells(),
    towns: [{ id: 'town-06-north', name: '丘上の町', centerCell: b.cell(17, 3), linkedIntakeId: 'intake-06-north', requiredIntake: 2048, floodThreshold: 512 },
      { id: 'town-06-east', name: '川守の町', centerCell: b.cell(19, 10), linkedIntakeId: 'intake-06-east', requiredIntake: 128, floodThreshold: 128 }],
    strokeMode: 'RAISE', maxStrokeLength: 5, brushRadius: 1, heightDelta: 8, maxSimulationSteps: 300,
    goalDefinition: { type: 'COMBINED', townIds: ['town-06-north', 'town-06-east'], deliveryDeadlineStep: 300, floodObservationEndStep: 300 } });
}
export const extendedStages: readonly StageDefinition[] = Object.freeze([fork(), wishes(), lastStroke()]);
