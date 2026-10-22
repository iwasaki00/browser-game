import { describe, expect, it } from 'vitest';
import { stages, type Stage } from './stage';
import { stageHints, HintSession, hintForStage, hintText, type StageHints } from './hints';
import { validateHints } from './hint-validation';
import type { SolverReport } from './solver';
import reportsData from '../reports/stage-validation.json';
const reports = reportsData as unknown as SolverReport[];
const validate = (data: StageHints[] = structuredClone(stageHints), definitions: Stage[] = stages, proofs = reports) => validateHints(definitions, data, proofs);

describe('static hint data', () => {
  it('contains 20 unique sets and 60 distinct nonempty plain texts', () => {
    expect(stageHints).toHaveLength(20); expect(stageHints.map(h => h.stageId)).toEqual(stages.map(s => s.id));
    const texts = stageHints.flatMap(h => [h.hint1, h.hint2, h.hint3]);
    expect(texts).toHaveLength(60); expect(new Set(texts).size).toBe(60);
    expect(texts.every(text => text.trim().length > 0 && !/[<>]/.test(text))).toBe(true);
    expect(validate()).toEqual([]);
  });
  it.each(stages.map(s => [s.id, s] as const))('Stage %s matches its fingerprint and graph/solution assertions', (_, stage) => {
    const hint = hintForStage(stage)!; expect(hint).toBeDefined();
    expect(validateHints([stage], [hint], reports)).toEqual([]); expect(hintText(hint, 1)).toBe(hint.hint1);
  });
  it('detects missing, duplicate and unknown IDs', () => {
    expect(validate(stageHints.slice(1))).toContain('Stage 01: ヒントは1組必要です。');
    expect(validate([...stageHints, stageHints[0]])).toContain('Stage 01: ヒントは1組必要です。');
    const data = structuredClone(stageHints); data[0].stageId = '99'; expect(validate(data)).toContain('Stage 99: 不明なステージIDです。');
  });
  it('rejects blank, repeated, HTML and complete-pattern-like prose', () => {
    const data = structuredClone(stageHints); data[0].hint1 = ' '; data[0].hint2 = data[1].hint1; data[0].hint3 = '<img src=x> LRR';
    const errors = validate(data).join('\n');
    expect(errors).toContain('H1が空'); expect(errors).toContain('本文が重複'); expect(errors).toContain('HTML'); expect(errors).toContain('完全パターン');
  });
  it('detects nonexistent branches in focus metadata and prose', () => {
    const data = structuredClone(stageHints); data[0].focusSwitchIds = ['missing']; data[0].hint1 = '分岐Eを確認しましょう。';
    const errors = validate(data).join('\n'); expect(errors).toContain('注目分岐missing'); expect(errors).toContain('分岐Eが存在しません');
  });
  it('detects out-of-range parcel references in prose and metadata', () => {
    const data = structuredClone(stageHints); data[0].checks.parcelNumbers = [0, 99]; data[0].hint1 = '99個目を確認しましょう。';
    const errors = validate(data).join('\n'); expect(errors).toContain('荷物番号0'); expect(errors).toContain('荷物番号99'); expect(errors).toContain('H1: 荷物番号・個数99');
  });
  it('detects routes absent from the graph', () => {
    const data = structuredClone(stageHints); data[0].checks.routes[0].to = 'blue'; expect(validate(data).join('\n')).toContain('経路a.L→blue');
  });
  it('detects directions contradicting verified successful settings', () => {
    const data = structuredClone(stageHints); data[0].checks.slots[0].direction = 'R'; expect(validate(data).join('\n')).toContain('方向・枠指定が検証済み成功解と矛盾');
  });
  it('detects invalid slots and impossible mandatory visits', () => {
    const data = structuredClone(stageHints); data[0].checks.slots[0].slot = 99; data[4].checks.requiredVisits.push({ parcelNumber: 1, switchId: 'b' });
    const errors = validate(data).join('\n'); expect(errors).toContain('枠の指定が不正'); expect(errors).toContain('荷物1の必須分岐b');
  });
  it('rejects stale fingerprints after stage changes instead of rebinding', () => {
    const definitions = structuredClone(stages); definitions[0].parcels[0].color = 'BLUE';
    expect(validate(undefined, definitions).join('\n')).toContain('ステージ識別子が一致しません'); expect(hintForStage(definitions[0])).toBeUndefined();
  });
  it('does not trust incomplete successful-setting proofs', () => {
    const proofs = structuredClone(reports); proofs[0].solutions = []; expect(validate(undefined, stages, proofs).join('\n')).toContain('通常成功解が全件必要');
  });
  it('uses the explicitly approved Stage 17 H3 correction', () => {
    expect(hintForStage(stages[16])?.hint3).toBe('荷物をBから直接届ける場合とD経由で届ける場合を比べ、BとDの方向転換コストを確認しましょう。');
  });
});
describe('hint disclosure state', () => {
  it('opens H1, unlocks H2/H3 sequentially and revisits previously unlocked hints', () => {
    const session = new HintSession(stageHints[0]); expect(session.open('DESIGN')).toBe(true);
    expect(session.snapshot).toEqual({ opened: true, unlocked: 1, selected: 1 });
    expect(session.view(2, 'DESIGN')).toBe(false); expect(session.view(3, 'DESIGN')).toBe(false);
    expect(session.revealNext('DESIGN')).toBe(true); expect(session.snapshot.selected).toBe(2);
    expect(session.view(3, 'DESIGN')).toBe(false); expect(session.revealNext('DESIGN')).toBe(true);
    expect(session.revealNext('DESIGN')).toBe(false); expect(session.view(1, 'DESIGN')).toBe(true);
    session.close(); expect(session.open('DESIGN')).toBe(true); expect(session.snapshot).toEqual({ opened: true, unlocked: 3, selected: 1 });
  });
  it.each(['RUN', 'PAUSED', 'RESULT'] as const)('rejects hint operations in %s', mode => {
    const session = new HintSession(stageHints[0]); expect(session.open(mode)).toBe(false);
    session.open('DESIGN'); expect(session.view(1, mode)).toBe(false); expect(session.revealNext(mode)).toBe(false); expect(session.snapshot.unlocked).toBe(1);
  });
  it('rejects missing data, closed disclosure and invalid levels', () => {
    expect(new HintSession(undefined).open('DESIGN')).toBe(false); const session = new HintSession(stageHints[0]);
    expect(session.revealNext('DESIGN')).toBe(false); session.open('DESIGN'); expect(session.view(0 as 1, 'DESIGN')).toBe(false); expect(session.view(4 as 1, 'DESIGN')).toBe(false);
  });
});
