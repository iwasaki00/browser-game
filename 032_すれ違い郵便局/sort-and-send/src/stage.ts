export type Direction = 'L' | 'R';
export type ParcelColor = 'RED' | 'BLUE';
export interface StageNode {
  id: string;
  kind: 'source' | 'switch' | 'exit';
  label: string;
  x: number;
  y: number;
  accepts?: ParcelColor;
  initialPattern?: Direction[];
}
export interface Stage {
  name: string;
  nodes: StageNode[];
  edges: { from: string; to: string; direction?: Direction }[];
  parcels: ParcelColor[];
}

export const stage01: Stage = {
  name: 'STAGE 01「はじめての分岐」',
  nodes: [
    { id: 'source', kind: 'source', label: 'SOURCE', x: 320, y: 72 },
    { id: 'a', kind: 'switch', label: 'SWITCH A', x: 320, y: 225, initialPattern: ['L', 'L'] },
    { id: 'red', kind: 'exit', label: 'RED EXIT', x: 130, y: 400, accepts: 'RED' },
    { id: 'blue', kind: 'exit', label: 'BLUE EXIT', x: 510, y: 400, accepts: 'BLUE' },
  ],
  edges: [
    { from: 'source', to: 'a' },
    { from: 'a', to: 'red', direction: 'L' },
    { from: 'a', to: 'blue', direction: 'R' },
  ],
  parcels: ['RED', 'BLUE', 'RED'],
};
