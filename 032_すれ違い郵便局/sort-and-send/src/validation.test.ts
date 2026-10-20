import { describe, expect, it } from 'vitest';
import { stage01, stages, type Stage } from './stage';
import { validateStage } from './validation';
import { simulate } from './simulation';

describe('stage structure validation', () => {
  it('accepts all five built-in stages', () => stages.forEach(s => expect(validateStage(s)).toEqual([])));
  const cases: [string, (s: Stage) => void, string][] = [
    ['duplicate nodes', s => { s.nodes.push(structuredClone(s.nodes[0])); }, 'ノードIDが重複'],
    ['missing target', s => { s.edges[0].to = 'missing'; }, '存在しないノード'],
    ['missing origin', s => { s.edges[0].from = 'missing'; }, '存在しないノード'],
    ['cycle', s => { s.edges[1].to = 'a'; }, '循環'],
    ['zero pattern slots', s => { s.nodes[1].initialPattern = []; }, '1〜4枠'],
    ['five pattern slots', s => { s.nodes[1].initialPattern = ['L', 'L', 'L', 'L', 'L']; }, '1〜4枠'],
    ['invalid destination', s => { s.nodes[2].accepts = 'GREEN' as never; }, '配送先が無効'],
    ['missing color destination', s => { s.parcels[0].color = 'YELLOW'; }, '配送先が無効'],
    ['dead end', s => { s.edges = s.edges.filter(e => e.from !== 'a'); }, '出口へ到達できない'],
    ['missing source', s => { s.nodes = s.nodes.filter(n => n.kind !== 'source'); }, 'Sourceは1つ'],
    ['two sources', s => { s.nodes.push({ ...structuredClone(s.nodes[0]), id: 'source2' }); }, 'Sourceは1つ'],
    ['missing exits', s => { s.nodes = s.nodes.filter(n => n.kind !== 'exit'); }, '出口がありません'],
    ['missing R connection', s => { s.edges[2].direction = 'L'; }, 'L/Rの接続'],
    ['duplicate parcel IDs', s => { s.parcels[1].id = 0; }, '荷物IDが重複'],
  ];
  it.each(cases)('rejects %s before simulation', (_, mutate, message) => {
    const stage = structuredClone(stage01); mutate(stage);
    expect(validateStage(stage).join('\n')).toContain(message);
    expect(() => simulate(stage, { a: ['L', 'R'] })).toThrow(message);
  });
  it('does not use Canvas coordinates for validation or delivery', () => {
    const stage = structuredClone(stages[4]);
    const pattern = { a: ['L', 'R', 'R'] as const, b: ['L', 'R'] as const };
    stage.nodes.forEach(n => { n.layout = { x: -9999, y: 9999 }; });
    expect(simulate(stage, pattern)).toEqual(simulate(stages[4], pattern));
  });
});
