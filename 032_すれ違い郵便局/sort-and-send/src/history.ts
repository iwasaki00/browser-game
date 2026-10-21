import type { SimulationResult } from './simulation';
import type { Stage } from './stage';

/** Read existing paths/events only; no delivery or counter calculation. */
export function parcelHistory(stage: Stage, result: SimulationResult, parcelId: number) {
  const parcel = result.parcels.find(p => p.id === parcelId);
  if (!parcel) throw new Error('荷物が見つかりません。');
  return {
    ...parcel,
    expectedExits: stage.nodes.filter(n => n.kind === 'exit' && n.accepts === parcel.color).map(n => n.id),
    switches: result.events.filter(e => e.parcel === parcelId && e.type === 'move' && e.direction !== undefined)
      .map(e => ({ id: e.from!, direction: e.direction!, patternIndex: e.patternIndex!, tick: e.tick,
        ...(e.rescue ? { rescue: true as const, originalDirection: e.originalDirection } : {}) })),
    rescueUsed: result.rescueUsed === true,
  };
}
