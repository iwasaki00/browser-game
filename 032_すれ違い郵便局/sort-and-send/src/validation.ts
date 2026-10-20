import type { Stage } from './stage';

/** Structural checks only; does not search for a solution or depend on layout. */
export function validateStage(stage: Stage): string[] {
  const errors = new Set<string>();
  const nodes = new Map(stage.nodes.map(n => [n.id, n]));
  const validColor = (value: unknown) => ['RED', 'BLUE', 'YELLOW'].includes(String(value));
  if (nodes.size !== stage.nodes.length) errors.add('ノードIDが重複しています。');
  if (stage.nodes.filter(n => n.kind === 'source').length !== 1) errors.add('Sourceは1つ必要です。');
  if (!stage.nodes.some(n => n.kind === 'exit')) errors.add('出口がありません。');
  for (const edge of stage.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) errors.add('存在しないノードへの接続があります。');
  }
  for (const n of stage.nodes) {
    const outgoing = stage.edges.filter(e => e.from === n.id);
    if (n.kind === 'switch') {
      if (!n.initialPattern || n.initialPattern.length < 1 || n.initialPattern.length > 4 || n.initialPattern.some(d => d !== 'L' && d !== 'R')) {
        errors.add(`分岐${n.id.toUpperCase()}のパターンはL/Rの1〜4枠にしてください。`);
      }
      if (outgoing.length !== 2 || outgoing.filter(e => e.direction === 'L').length !== 1 || outgoing.filter(e => e.direction === 'R').length !== 1) {
        errors.add(`分岐${n.id.toUpperCase()}にはL/Rの接続が1本ずつ必要です。`);
      }
    } else if (n.kind === 'source') {
      if (outgoing.length !== 1 || outgoing[0]?.direction !== undefined) errors.add('Sourceには配送路が1本必要です。');
    } else if (n.kind === 'exit') {
      if (!validColor(n.accepts)) errors.add(`出口${n.id}の配送先が無効です。`);
      if (outgoing.length) errors.add('出口からの配送路は設定できません。');
    } else errors.add('ノードの種類が無効です。');
  }
  if (!stage.parcels.length) errors.add('配送する荷物がありません。');
  if (new Set(stage.parcels.map(p => p.id)).size !== stage.parcels.length) errors.add('荷物IDが重複しています。');
  for (const p of stage.parcels) {
    if (!Number.isInteger(p.id) || p.id < 0) errors.add('荷物IDは0以上の整数にしてください。');
    if (!validColor(p.color) || !stage.nodes.some(n => n.kind === 'exit' && n.accepts === p.color)) errors.add('荷物の配送先が無効です。');
  }
  // DFS covers disconnected components too, so hidden cycles are rejected.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) { errors.add('配送路が循環しています。'); return; }
    if (visited.has(id) || !nodes.has(id)) return;
    visiting.add(id);
    stage.edges.filter(e => e.from === id).forEach(e => visit(e.to));
    visiting.delete(id); visited.add(id);
  }
  nodes.forEach(n => visit(n.id));
  // Every branch must terminate at an exit, regardless of chosen pattern.
  function reachesExit(id: string, path: Set<string>): boolean {
    if (path.has(id)) return false;
    const n = nodes.get(id);
    if (!n) return false;
    if (n.kind === 'exit') return true;
    const outgoing = stage.edges.filter(e => e.from === id);
    return outgoing.length > 0 && outgoing.every(e => reachesExit(e.to, new Set([...path, id])));
  }
  if (stage.nodes.some(n => !reachesExit(n.id, new Set()))) errors.add('出口へ到達できない経路があります。');
  return [...errors];
}
