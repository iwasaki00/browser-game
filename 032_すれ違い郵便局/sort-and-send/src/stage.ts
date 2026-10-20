export type Direction = 'L' | 'R';
export type ParcelColor = 'RED' | 'BLUE' | 'YELLOW';
export interface StageNode {
  id: string;
  kind: 'source' | 'switch' | 'exit';
  label: string;
  layout: { x: number; y: number };
  accepts?: ParcelColor;
  initialPattern?: Direction[];
}
export interface Stage {
  id: string;
  name: string;
  board?: { width: number; height: number };
  nodes: StageNode[];
  edges: { from: string; to: string; direction?: Direction }[];
  parcels: { id: number; color: ParcelColor }[];
}

export const stage01: Stage = {
  id: '01',
  name: 'STAGE 01「はじめての分岐」',
  nodes: [
    { id: 'source', kind: 'source', label: 'SOURCE', layout: { x: 320, y: 72 } },
    { id: 'a', kind: 'switch', label: 'SWITCH A', layout: { x: 320, y: 225 }, initialPattern: ['L', 'L'] },
    { id: 'red', kind: 'exit', label: 'RED EXIT', layout: { x: 130, y: 400 }, accepts: 'RED' },
    { id: 'blue', kind: 'exit', label: 'BLUE EXIT', layout: { x: 510, y: 400 }, accepts: 'BLUE' },
  ],
  edges: [
    { from: 'source', to: 'a' },
    { from: 'a', to: 'red', direction: 'L' },
    { from: 'a', to: 'blue', direction: 'R' },
  ],
  parcels: ['RED', 'BLUE', 'RED'].map((color, id) => ({ id, color: color as ParcelColor })),
};

function singleSwitchStage(number: number, title: string, sequence: ParcelColor[], length: number): Stage {
  const stage = structuredClone(stage01);
  stage.id = String(number).padStart(2, '0');
  stage.name = `STAGE 0${number}「${title}」`;
  stage.nodes.find(n => n.id === 'a')!.initialPattern = Array<Direction>(length).fill('L');
  stage.parcels = sequence.map((color, id) => ({ id, color }));
  return stage;
}

export const stages: Stage[] = [
  stage01,
  singleSwitchStage(2, '同じ色が続く', ['RED', 'RED', 'BLUE', 'RED', 'RED', 'BLUE'], 3),
  singleSwitchStage(3, 'くり返す道', ['RED', 'BLUE', 'BLUE', 'RED', 'BLUE', 'BLUE', 'RED', 'BLUE', 'BLUE'], 3),
  singleSwitchStage(4, '4つの荷物', ['RED', 'BLUE', 'BLUE', 'RED', 'RED', 'BLUE', 'BLUE', 'RED'], 4),
  {
    id: '05',
    name: 'STAGE 05「小さな郵便局」',
    nodes: [
      { id: 'source', kind: 'source', label: 'SOURCE', layout: { x: 290, y: 55 } },
      { id: 'a', kind: 'switch', label: 'SWITCH A', layout: { x: 290, y: 170 }, initialPattern: ['L', 'L', 'L'] },
      { id: 'b', kind: 'switch', label: 'SWITCH B', layout: { x: 435, y: 295 }, initialPattern: ['L', 'L'] },
      { id: 'red', kind: 'exit', label: 'RED EXIT', layout: { x: 105, y: 405 }, accepts: 'RED' },
      { id: 'blue', kind: 'exit', label: 'BLUE EXIT', layout: { x: 330, y: 440 }, accepts: 'BLUE' },
      { id: 'yellow', kind: 'exit', label: 'YELLOW EXIT', layout: { x: 555, y: 440 }, accepts: 'YELLOW' },
    ],
    edges: [
      { from: 'source', to: 'a' },
      { from: 'a', to: 'red', direction: 'L' },
      { from: 'a', to: 'b', direction: 'R' },
      { from: 'b', to: 'blue', direction: 'L' },
      { from: 'b', to: 'yellow', direction: 'R' },
    ],
    parcels: (['RED', 'BLUE', 'YELLOW', 'RED', 'BLUE', 'YELLOW'] as ParcelColor[]).map((color, id) => ({ id, color })),
  },
  chapterTwoStage('06', '2つ目の分岐', ['RED', 'BLUE', 'RED', 'BLUE'],
    [['a', 4, 260, 180], ['b', 2, 440, 340]],
    [['a', 'red', 'b'], ['b', 'red', 'blue']],
    [['red', 'RED', 120, 540], ['blue', 'BLUE', 520, 540]], 640),
  chapterTwoStage('07', '通らない荷物', ['RED', 'BLUE', 'YELLOW', 'RED', 'BLUE', 'YELLOW'],
    [['a', 3, 320, 170], ['b', 2, 160, 340], ['c', 2, 480, 340]],
    [['a', 'b', 'c'], ['b', 'red', 'blue'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 90, 550], ['blue', 'BLUE', 320, 550], ['yellow', 'YELLOW', 550, 550]], 650),
  chapterTwoStage('08', '使わない分岐', ['RED', 'BLUE', 'BLUE', 'RED', 'BLUE'],
    [['a', 3, 220, 160], ['b', 2, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'blue', 'c'], ['c', 'red', 'blue']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 530, 680]], 780),
  chapterTwoStage('09', '違う周期', ['RED', 'BLUE', 'RED', 'YELLOW', 'BLUE'],
    [['a', 4, 320, 170], ['b', 2, 160, 340], ['c', 2, 480, 340]],
    [['a', 'b', 'c'], ['b', 'red', 'blue'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 90, 550], ['blue', 'BLUE', 320, 550], ['yellow', 'YELLOW', 550, 550]], 650),
  chapterTwoStage('10', '連鎖する仕分け', ['BLUE', 'RED', 'RED', 'RED', 'YELLOW'],
    [['a', 4, 220, 160], ['b', 3, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'c', 'yellow'], ['c', 'red', 'blue']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 350, 680], ['yellow', 'YELLOW', 550, 680]], 780),
];

/** Small data builder for Chapter 02; no additional routing rules. */
function chapterTwoStage(
  id: string, title: string, sequence: ParcelColor[],
  switches: [string, number, number, number][],
  routes: [string, string, string][],
  exits: [string, ParcelColor, number, number][], height: number,
): Stage {
  return {
    id, name: `STAGE ${id}「${title}」`, board: { width: 640, height },
    nodes: [
      { id: 'source', kind: 'source', label: 'SOURCE', layout: { x: switches[0][2], y: 55 } },
      ...switches.map(([id, length, x, y]): StageNode => ({ id, kind: 'switch', label: `SWITCH ${id.toUpperCase()}`, layout: { x, y }, initialPattern: Array<Direction>(length).fill('L') })),
      ...exits.map(([id, accepts, x, y]): StageNode => ({ id, kind: 'exit', label: `${accepts} EXIT`, layout: { x, y }, accepts })),
    ],
    edges: [
      { from: 'source', to: 'a' },
      ...routes.flatMap(([from, left, right]) => [
        { from, to: left, direction: 'L' as const }, { from, to: right, direction: 'R' as const },
      ]),
    ],
    parcels: sequence.map((color, id) => ({ id, color })),
  };
}
