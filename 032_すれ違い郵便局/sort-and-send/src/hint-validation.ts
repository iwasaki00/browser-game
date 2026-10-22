import { stageFingerprint } from './fingerprint';
import { hintText, type StageHints } from './hints';
import type { Stage } from './stage';
import type { SolverReport } from './solver';
import { verifiedMinimum } from './scoring';
import { simulate } from './simulation';

/** Structural assertions plus explicit prose facts; natural language still requires human review. */
export function validateHints(stages: readonly Stage[], hints: readonly StageHints[], reports: readonly SolverReport[]): string[] {
  const errors: string[] = [];
  const texts = new Set<string>();
  const idCounts = new Map<string, number>();
  for (const hint of hints) idCounts.set(hint.stageId, (idCounts.get(hint.stageId) ?? 0) + 1);
  for (const stage of stages) if (idCounts.get(stage.id) !== 1) errors.push(`Stage ${stage.id}: ヒントは1組必要です。`);
  for (const hint of hints) {
    const prefix = `Stage ${hint.stageId}`;
    const fail = (message: string) => errors.push(`${prefix}: ${message}`);
    const stage = stages.find(s => s.id === hint.stageId);
    if (!stage) { fail('不明なステージIDです。'); continue; }
    if (hint.stageFingerprint !== stageFingerprint(stage)) fail('ステージ識別子が一致しません。');
    const branch = (id: string) => stage.nodes.find(n => n.id === id && n.kind === 'switch');
    const parcels = [...stage.parcels].sort((a, b) => a.id - b.id);
    const parcelExists = (number: number) => Number.isInteger(number) && number >= 1 && number <= parcels.length;
    for (const level of [1, 2, 3] as const) {
      const text = hintText(hint, level);
      if (typeof text !== 'string' || !text.trim()) { fail(`H${level}が空です。`); continue; }
      if (texts.has(text.trim())) fail(`H${level}の本文が重複しています。`);
      texts.add(text.trim());
      if (/[<>]/u.test(text)) fail(`H${level}にHTML記号があります。`);
      if (/[LR]{2,}/u.test(text)) fail(`H${level}に完全パターンらしい記述があります。要レビュー。`);
      for (const id of text.match(/(?<![A-Za-z])[A-E](?![A-Za-z])/gu) ?? []) if (!branch(id.toLowerCase())) fail(`H${level}: 分岐${id}が存在しません。`);
      for (const match of text.matchAll(/(\d+)(?:番目|個目|個)/gu)) if (!parcelExists(Number(match[1]))) fail(`H${level}: 荷物番号・個数${match[1]}が範囲外です。`);
    }
    for (const id of hint.focusSwitchIds) if (!branch(id)) fail(`注目分岐${id}が存在しません。`);
    for (const number of hint.checks.parcelNumbers) if (!parcelExists(number)) fail(`荷物番号${number}が範囲外です。`);
    for (const route of hint.checks.routes) {
      if (!stage.edges.some(e => e.from === route.from && e.to === route.to && e.direction === route.direction)) fail(`経路${route.from}.${route.direction}→${route.to}がグラフと一致しません。`);
    }
    for (const slot of hint.checks.slots) {
      if (!branch(slot.switchId) || !Number.isInteger(slot.slot) || slot.slot < 1 || slot.slot > (branch(slot.switchId)?.initialPattern?.length ?? 0) || !['L', 'R'].includes(slot.direction)) fail('枠の指定が不正です。');
    }
    for (const visit of hint.checks.requiredVisits) if (!branch(visit.switchId) || !parcelExists(visit.parcelNumber)) fail('必須通過分岐・荷物番号が不正です。');
    const report = reports.find(r => r.stageId === stage.id);
    if (!report || verifiedMinimum(stage, report) === null || report.solutions.length !== report.solutionCount) { fail('検証済みの通常成功解が全件必要です。'); continue; }
    const solutions = report.solutions.map(s => ({ patterns: s.patterns, result: simulate(stage, s.patterns) }));
    if (solutions.some(s => !s.result.clear || s.result.rescueUsed)) fail('通常成功解の証明に不整合があります。');
    if (!solutions.some(s => s.result.clear && hint.checks.slots.every(slot => s.patterns[slot.switchId]?.[slot.slot - 1] === slot.direction))) fail('方向・枠指定が検証済み成功解と矛盾します。');
    for (const visit of hint.checks.requiredVisits) {
      const parcel = parcels[visit.parcelNumber - 1];
      if (parcel && solutions.some(s => !s.result.parcels.find(p => p.id === parcel.id)?.path.includes(visit.switchId))) fail(`荷物${visit.parcelNumber}の必須分岐${visit.switchId}が成功経路と一致しません。`);
    }
  }
  return errors;
}
