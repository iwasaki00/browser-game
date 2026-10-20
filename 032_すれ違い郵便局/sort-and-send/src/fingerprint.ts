import type { Stage } from './stage';

export const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Exact canonical serialization is a collision-free data identifier, not a security hash. */
export function stageFingerprint(stage: Stage): string {
  return 'delivery-v1/cost-v1:' + JSON.stringify({
    nodes: [...stage.nodes].sort((a, b) => compareIds(a.id, b.id)).map(n => ({
      id: n.id, kind: n.kind,
      accepts: n.kind === 'exit' ? n.accepts : null,
      length: n.kind === 'switch' ? n.initialPattern?.length : null,
    })),
    edges: [...stage.edges].map(e => ({ from: e.from, to: e.to, direction: e.direction ?? null }))
      .sort((a, b) => compareIds(JSON.stringify(a), JSON.stringify(b))),
    parcels: [...stage.parcels].sort((a, b) => a.id - b.id).map(p => ({ id: p.id, color: p.color })),
  });
}
