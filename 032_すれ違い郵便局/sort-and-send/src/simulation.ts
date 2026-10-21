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
  /** Present only on the one overridden move, even when the direction is unchanged. */
  rescue?: true;
  originalDirection?: Direction;
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
  /** Ordinary results retain their previous shape. Confirmed RESCUE runs are marked. */
  rescueUsed?: true;
}

export interface SwitchEventId { tick: number; parcelId: number; switchId: string }
export interface RescuePreview extends SwitchEventId { direction: Direction; patternIndex: number }
export interface RescueReservation extends SwitchEventId { direction: Direction }
export interface SimulationState {
  tick: number;
  counters: Record<string, number>;
  parcels: ParcelResult[];
  events: DeliveryEvent[];
  rescue: { used: boolean; pending?: RescueReservation; applied?: RescuePreview & { actualDirection: Direction }; expired?: true };
}

function initialState(stage: Stage, patterns: Record<string, readonly Direction[]>): SimulationState {
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
  return { tick: 0, counters, parcels, events: [], rescue: { used: false } };
}

/** Deterministic tick engine. Live state is private; snapshots and previews are detached. */
export class DeliveryRun {
  private stage: Stage;
  private patterns: Record<string, readonly Direction[]>;
  private state: SimulationState;
  private revision = 0;
  private previews = new WeakMap<RescuePreview, number>();
  constructor(stage: Stage, patterns: Record<string, readonly Direction[]>) {
    this.state = initialState(stage, patterns);
    this.stage = structuredClone(stage);
    this.patterns = structuredClone(patterns);
  }
  get snapshot(): SimulationState { return structuredClone(this.state); }
  get tick() { return this.state.tick; }
  get done() { return this.state.parcels.every(p => !!p.destination); }
  get rescueUsed() { return this.state.rescue.used; }
  clone(): DeliveryRun {
    const copy = new DeliveryRun(this.stage, this.patterns);
    copy.state = structuredClone(this.state);
    return copy;
  }
  /** Copy-only lookahead bounded by parcel count plus nodes of this validated acyclic graph. */
  previewRescue(): RescuePreview | undefined {
    if (this.rescueUsed) return;
    const copy = this.clone();
    const limit = this.stage.parcels.length + this.stage.nodes.length;
    for (let i = 0; i < limit && !copy.done; i++) {
      const start = copy.state.events.length;
      copy.step();
      const event = copy.state.events.slice(start).find(e => e.type === 'move' && e.direction !== undefined);
      if (event) {
        const preview = { tick: event.tick, parcelId: event.parcel, switchId: event.from!, direction: event.direction!, patternIndex: event.patternIndex! };
        this.previews.set(preview, this.revision);
        return preview;
      }
    }
  }
  confirmRescue(preview: RescuePreview, direction: Direction): boolean {
    if (this.rescueUsed || (direction !== 'L' && direction !== 'R') || this.previews.get(preview) !== this.revision) return false;
    const current = this.previewRescue();
    if (!current || current.tick !== preview.tick || current.parcelId !== preview.parcelId || current.switchId !== preview.switchId ||
      current.direction !== preview.direction || current.patternIndex !== preview.patternIndex) return false;
    this.state.rescue = { used: true, pending: { tick: preview.tick, parcelId: preview.parcelId, switchId: preview.switchId, direction } };
    this.revision++;
    return true;
  }
  cancelRescue(preview: RescuePreview): void { this.previews.delete(preview); }
  /** One iteration reads tick-start positions; each active parcel moves exactly once. */
  step(): boolean {
    if (this.done) return false;
    const stage = this.stage, patterns = this.patterns;
    const { tick, parcels, counters, events } = this.state;
    const source = stage.nodes.find(n => n.kind === 'source')!;
    const pending = this.state.rescue.pending;
    if (pending && pending.tick < tick) { delete this.state.rescue.pending; this.state.rescue.expired = true; }
    for (const [departureTick, parcel] of parcels.entries()) {
      if (departureTick > tick || parcel.destination) continue;
      const from = parcel.path[parcel.path.length - 1];
      const node = stage.nodes.find(n => n.id === from)!;
      if (departureTick === tick) events.push({ tick, parcel: parcel.id, type: 'depart', to: source.id });
      const patternIndex = node.kind === 'switch' ? counters[node.id] : undefined;
      const originalDirection = patternIndex !== undefined ? patterns[node.id][patternIndex] : undefined;
      const reservation = this.state.rescue.pending;
      const rescued = originalDirection !== undefined && reservation?.tick === tick && reservation.parcelId === parcel.id && reservation.switchId === from;
      const direction = rescued ? reservation.direction : originalDirection;
      const edge = stage.edges.find(e => e.from === from && e.direction === direction);
      if (!edge) throw new Error(`Missing edge: ${from}`);
      const target = stage.nodes.find(n => n.id === edge.to);
      if (!target) throw new Error(`Missing node: ${edge.to}`);
      events.push({ tick, parcel: parcel.id, type: 'move', from, to: edge.to, direction, patternIndex,
        ...(rescued ? { rescue: true as const, originalDirection } : {}) });
      if (rescued) {
        this.state.rescue.applied = { tick, parcelId: parcel.id, switchId: from, direction: originalDirection!, patternIndex: patternIndex!, actualDirection: direction! };
        delete this.state.rescue.pending;
      }
      parcel.path.push(edge.to);
      if (node.kind === 'switch') counters[node.id] = (counters[node.id] + 1) % patterns[node.id].length;
      if (target.kind === 'exit') {
        parcel.destination = target.id;
        parcel.correct = target.accepts === parcel.color;
        events.push({ tick, parcel: parcel.id, type: 'deliver', to: target.id, correct: parcel.correct });
      }
    }
    if (this.state.rescue.pending && this.state.rescue.pending.tick <= tick) {
      delete this.state.rescue.pending; this.state.rescue.expired = true;
    }
    this.state.tick++;
    this.revision++;
    if (this.done && this.state.rescue.pending) { delete this.state.rescue.pending; this.state.rescue.expired = true; }
    return true;
  }
  finish(): SimulationResult {
    const limit = this.stage.parcels.length + this.stage.nodes.length;
    for (let i = 0; !this.done && i < limit; i++) this.step();
    if (!this.done) throw new Error('配送が有限のtick範囲で完了しませんでした。');
    const { parcels, events, tick } = this.snapshot;
    const correctCount = parcels.filter(p => p.correct).length;
    return { parcels, events, ticks: tick, correctCount, clear: correctCount === parcels.length,
      ...(this.rescueUsed ? { rescueUsed: true as const } : {}) };
  }
}

/** Existing batch API, also used by the ordinary-only Solver. */
export function simulate(stage: Stage, patterns: Record<string, readonly Direction[]>): SimulationResult {
  return new DeliveryRun(stage, patterns).finish();
}
