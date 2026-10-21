export type Direction = 'L' | 'R';
export type ParcelColor = 'RED' | 'BLUE' | 'YELLOW';
export interface Point { x: number; y: number }
export interface StageEdge {
  from: string;
  to: string;
  direction?: Direction;
  /** Drawing-only bends; simulation and fingerprint ignore these coordinates. */
  via?: Point[];
}
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
  edges: StageEdge[];
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
  branchedStage('06', '2つ目の分岐', ['RED', 'BLUE', 'RED', 'BLUE'],
    [['a', 4, 260, 180], ['b', 2, 440, 340]],
    [['a', 'red', 'b'], ['b', 'red', 'blue']],
    [['red', 'RED', 120, 540], ['blue', 'BLUE', 520, 540]], 640),
  branchedStage('07', '通らない荷物', ['RED', 'BLUE', 'YELLOW', 'RED', 'BLUE', 'YELLOW'],
    [['a', 3, 320, 170], ['b', 2, 160, 340], ['c', 2, 480, 340]],
    [['a', 'b', 'c'], ['b', 'red', 'blue'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 90, 550], ['blue', 'BLUE', 320, 550], ['yellow', 'YELLOW', 550, 550]], 650),
  branchedStage('08', '使わない分岐', ['RED', 'BLUE', 'BLUE', 'RED', 'BLUE'],
    [['a', 3, 220, 160], ['b', 2, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'blue', 'c'], ['c', 'red', 'blue']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 530, 680]], 780),
  branchedStage('09', '違う周期', ['RED', 'BLUE', 'RED', 'YELLOW', 'BLUE'],
    [['a', 4, 320, 170], ['b', 2, 160, 340], ['c', 2, 480, 340]],
    [['a', 'b', 'c'], ['b', 'red', 'blue'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 90, 550], ['blue', 'BLUE', 320, 550], ['yellow', 'YELLOW', 550, 550]], 650),
  branchedStage('10', '連鎖する仕分け', ['BLUE', 'RED', 'RED', 'RED', 'YELLOW'],
    [['a', 4, 220, 160], ['b', 3, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'c', 'yellow'], ['c', 'red', 'blue']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 350, 680], ['yellow', 'YELLOW', 550, 680]], 780),
  branchedStage('11', '先の先を読む', ['RED', 'BLUE', 'RED', 'RED', 'RED', 'YELLOW', 'RED'],
    [['a', 4, 220, 160], ['b', 3, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'red', 'c'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 350, 680], ['yellow', 'YELLOW', 550, 680]], 780),
  branchedStage('12', '一見同じ道', ['BLUE', 'RED', 'BLUE', 'YELLOW', 'RED', 'BLUE', 'BLUE'],
    [['a', 3, 320, 160], ['b', 2, 150, 340], ['c', 3, 480, 340], ['d', 2, 230, 550]],
    [['a', 'b', 'c'], ['b', 'red', 'd'], ['c', 'blue', 'yellow'], ['d', 'blue', 'yellow']],
    [['red', 'RED', 90, 800], ['blue', 'BLUE', 320, 800], ['yellow', 'YELLOW', 550, 950]], 1050,
    { 'd.R': [{ x: 150, y: 900 }] }),
  branchedStage('13', '周期の連鎖', ['RED', 'YELLOW', 'BLUE', 'RED', 'YELLOW', 'YELLOW', 'RED'],
    [['a', 3, 160, 160], ['b', 3, 320, 330], ['c', 2, 320, 500], ['d', 2, 470, 670]],
    [['a', 'red', 'b'], ['b', 'c', 'yellow'], ['c', 'red', 'd'], ['d', 'blue', 'yellow']],
    [['red', 'RED', 90, 880], ['blue', 'BLUE', 350, 880], ['yellow', 'YELLOW', 550, 880]], 980,
    { 'b.R': [{ x: 580, y: 430 }, { x: 580, y: 760 }] }),
  branchedStage('14', '思わぬ近道', ['BLUE', 'RED', 'RED', 'YELLOW', 'BLUE', 'RED', 'RED'],
    [['a', 4, 320, 160], ['b', 3, 150, 340], ['c', 2, 480, 340], ['d', 2, 520, 550]],
    [['a', 'b', 'c'], ['b', 'red', 'blue'], ['c', 'blue', 'd'], ['d', 'red', 'yellow']],
    [['red', 'RED', 100, 950], ['blue', 'BLUE', 320, 800], ['yellow', 'YELLOW', 550, 800]], 1050,
    { 'd.L': [{ x: 440, y: 900 }] }),
  branchedStage('15', '配送マスター', ['BLUE', 'RED', 'YELLOW', 'RED', 'YELLOW', 'YELLOW', 'RED'],
    [['a', 3, 320, 160], ['b', 3, 150, 330], ['c', 2, 480, 330], ['d', 2, 320, 510], ['e', 2, 430, 690]],
    [['a', 'b', 'c'], ['b', 'red', 'd'], ['c', 'd', 'yellow'], ['d', 'red', 'e'], ['e', 'blue', 'yellow']],
    [['red', 'RED', 100, 880], ['blue', 'BLUE', 350, 880], ['yellow', 'YELLOW', 550, 880]], 980),
  branchedStage('16', '最短の設定', ['RED', 'RED', 'BLUE', 'RED', 'RED', 'YELLOW', 'RED', 'RED'],
    [['a', 3, 220, 160], ['b', 3, 370, 330], ['c', 2, 370, 500]],
    [['a', 'red', 'b'], ['b', 'red', 'c'], ['c', 'blue', 'yellow']],
    [['red', 'RED', 100, 680], ['blue', 'BLUE', 350, 680], ['yellow', 'YELLOW', 550, 680]], 780),
  branchedStage('17', '無駄のない分岐', ['RED', 'YELLOW', 'RED', 'BLUE', 'YELLOW', 'RED', 'RED', 'YELLOW', 'BLUE'],
    [['a', 3, 320, 160], ['b', 3, 150, 340], ['c', 2, 480, 340], ['d', 2, 230, 550]],
    [['a', 'b', 'c'], ['b', 'red', 'd'], ['c', 'blue', 'yellow'], ['d', 'red', 'blue']],
    [['red', 'RED', 90, 800], ['blue', 'BLUE', 320, 800], ['yellow', 'YELLOW', 550, 800]], 900),
  branchedStage('18', '完全自動化', ['BLUE', 'YELLOW', 'RED', 'BLUE', 'YELLOW', 'RED', 'BLUE', 'YELLOW', 'BLUE', 'BLUE', 'YELLOW'],
    [['a', 3, 320, 160], ['b', 3, 150, 340], ['c', 2, 480, 340], ['d', 2, 230, 550]],
    [['a', 'b', 'c'], ['b', 'red', 'd'], ['c', 'blue', 'yellow'], ['d', 'red', 'blue']],
    [['red', 'RED', 90, 800], ['blue', 'BLUE', 320, 800], ['yellow', 'YELLOW', 550, 800]], 900),
  branchedStage('19', '最後の調整', ['RED', 'BLUE', 'YELLOW', 'YELLOW', 'RED', 'BLUE', 'YELLOW', 'RED', 'YELLOW'],
    [['a', 3, 320, 160], ['b', 3, 150, 330], ['c', 3, 480, 330], ['d', 2, 320, 510], ['e', 2, 230, 690]],
    [['a', 'b', 'c'], ['b', 'd', 'red'], ['c', 'd', 'yellow'], ['d', 'e', 'blue'], ['e', 'red', 'yellow']],
    [['red', 'RED', 100, 880], ['blue', 'BLUE', 350, 880], ['yellow', 'YELLOW', 550, 880]], 980),
  branchedStage('20', 'グランドオープン', ['YELLOW', 'BLUE', 'RED', 'BLUE', 'BLUE', 'YELLOW', 'BLUE', 'BLUE', 'RED', 'BLUE', 'YELLOW'],
    [['a', 4, 320, 160], ['b', 3, 150, 330], ['c', 2, 480, 330], ['d', 2, 230, 530], ['e', 2, 480, 690]],
    [['a', 'b', 'c'], ['b', 'red', 'd'], ['c', 'd', 'e'], ['d', 'blue', 'yellow'], ['e', 'red', 'yellow']],
    [['red', 'RED', 100, 880], ['blue', 'BLUE', 350, 880], ['yellow', 'YELLOW', 550, 880]], 980,
    { 'e.L': [{ x: 410, y: 800 }, { x: 200, y: 800 }] }),
];

/** Compact branched-stage data; no additional routing rules. */
function branchedStage(
  id: string, title: string, sequence: ParcelColor[],
  switches: [string, number, number, number][],
  routes: [string, string, string][],
  exits: [string, ParcelColor, number, number][], height: number,
  bends: Record<string, Point[]> = {},
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
        { from, to: left, direction: 'L' as const, via: bends[`${from}.L`] },
        { from, to: right, direction: 'R' as const, via: bends[`${from}.R`] },
      ]),
    ],
    parcels: sequence.map((color, id) => ({ id, color })),
  };
}
