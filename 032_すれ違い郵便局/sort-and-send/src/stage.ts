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
  name: string;
  nodes: StageNode[];
  edges: { from: string; to: string; direction?: Direction }[];
  parcels: { id: number; color: ParcelColor }[];
}

export const stage01: Stage = {
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
];
