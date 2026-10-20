import type { Direction, ParcelColor, Stage } from './stage';
import { validateStage } from './validation';

export interface DeliveryEvent {
  tick: number;
  parcel: number;
  type: 'depart' | 'move' | 'deliver';
  from?: string;
  to: string;
  direction?: Direction;
  patternIndex?: number;
  correct?: boolean;
}
export interface ParcelResult {
  id: number;
  color: ParcelColor;
  path: string[];
  destination: string;
  correct: boolean;
}
export interface SimulationResult {
  parcels: ParcelResult[];
  events: DeliveryEvent[];
  ticks: number;
  correctCount: number;
  clear: boolean;
}

/** One iteration reads tick-start positions; each active parcel moves exactly once. */
export function simulate(stage: Stage, patterns: Record<string, readonly Direction[]>): SimulationResult {
  const errors = validateStage(stage);
  if (errors.length) throw new Error(errors.join('\n'));
  const source = stage.nodes.find(n => n.kind === 'source');
  if (!source) throw new Error('Source is missing');
  const counters: Record<string, number> = {};
  for (const node of stage.nodes.filter(n => n.kind === 'switch')) {
    const pattern = patterns[node.id];
    if (!pattern?.length || pattern.length !== node.initialPattern?.length || pattern.some(d => d !== 'L' && d !== 'R')) {
      throw new Error(`Invalid pattern: ${node.id}`);
    }
    counters[node.id] = 0;
  }
  const parcels: ParcelResult[] = [...stage.parcels].sort((a, b) => a.id - b.id).map(({ color, id }) => ({
    id, color, path: [source.id], destination: '', correct: false,
  }));
  const events: DeliveryEvent[] = [];
  let tick = 0;
  while (parcels.some(p => !p.destination)) {
    for (const [departureTick, parcel] of parcels.entries()) {
      if (departureTick > tick || parcel.destination) continue;
      const from = parcel.path[parcel.path.length - 1];
      const node = stage.nodes.find(n => n.id === from)!;
      if (departureTick === tick) events.push({ tick, parcel: parcel.id, type: 'depart', to: source.id });
      const patternIndex = node.kind === 'switch' ? counters[node.id] : undefined;
      const direction = patternIndex !== undefined ? patterns[node.id][patternIndex] : undefined;
      const edge = stage.edges.find(e => e.from === from && e.direction === direction);
      if (!edge) throw new Error(`Missing edge: ${from}`);
      const target = stage.nodes.find(n => n.id === edge.to);
      if (!target) throw new Error(`Missing node: ${edge.to}`);
      events.push({ tick, parcel: parcel.id, type: 'move', from, to: edge.to, direction, patternIndex });
      parcel.path.push(edge.to);
      if (node.kind === 'switch') counters[node.id] = (counters[node.id] + 1) % patterns[node.id].length;
      if (target.kind === 'exit') {
        parcel.destination = target.id;
        parcel.correct = target.accepts === parcel.color;
        events.push({ tick, parcel: parcel.id, type: 'deliver', to: target.id, correct: parcel.correct });
      }
    }
    tick++;
  }
  const correctCount = parcels.filter(p => p.correct).length;
  return { parcels, events, ticks: tick, correctCount, clear: correctCount === parcels.length };
}
