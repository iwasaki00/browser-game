import type { Stage } from './stage';
import type { SimulationResult } from './simulation';
import { stageFingerprint } from './fingerprint';
import type { SolverSummary } from './solver';

export type Rating =
  | { status: 'RATED'; stars: 0 | 1 | 2 | 3; reason: string }
  | { status: 'PENDING' | 'INCONSISTENT'; stars: null; reason: string };

/** JSON may be missing or malformed; only well-shaped summaries reach scoring. */
export function isSolverSummary(value: unknown): value is SolverSummary {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.stageId === 'string' && typeof r.stageFingerprint === 'string' &&
    typeof r.totalConfigurations === 'string' && typeof r.checkedConfigurations === 'number' &&
    typeof r.solutionCount === 'number' && (r.minCost === null || typeof r.minCost === 'number') &&
    (r.maxCost === null || typeof r.maxCost === 'number') &&
    (r.optimalSolutionCount === null || typeof r.optimalSolutionCount === 'number') &&
    ['VALID', 'INVALID', 'INCOMPLETE'].includes(String(r.status)) &&
    !!r.costDistribution && typeof r.costDistribution === 'object' && !Array.isArray(r.costDistribution) &&
    Object.values(r.costDistribution).every(count => typeof count === 'number');
}

export function verifiedMinimum(stage: Stage, report?: SolverSummary): number | null {
  if (!report || report.stageId !== stage.id || report.stageFingerprint !== stageFingerprint(stage) || report.status !== 'VALID') return null;
  const slots = stage.nodes.filter(n => n.kind === 'switch').reduce((sum, n) => sum + (n.initialPattern?.length ?? 0), 0);
  const total = (1n << BigInt(slots)).toString();
  if (report.totalConfigurations !== total || !Number.isSafeInteger(report.checkedConfigurations) ||
      String(report.checkedConfigurations) !== total || report.solutionCount < 1 ||
      report.solutionCount > report.checkedConfigurations || !Number.isSafeInteger(report.solutionCount) ||
      report.minCost === null || !Number.isSafeInteger(report.minCost) || report.minCost < 0 ||
      report.maxCost === null || !Number.isSafeInteger(report.maxCost) || report.maxCost < report.minCost ||
      report.optimalSolutionCount === null || report.optimalSolutionCount < 1) return null;
  const entries = Object.entries(report.costDistribution);
  if (!entries.length || entries.some(([cost, count]) => !Number.isSafeInteger(Number(cost)) || Number(cost) < 0 || !Number.isSafeInteger(count) || count < 1) ||
      entries.reduce((sum, [, count]) => sum + count, 0) !== report.solutionCount ||
      Math.min(...entries.map(([cost]) => Number(cost))) !== report.minCost ||
      Math.max(...entries.map(([cost]) => Number(cost))) !== report.maxCost ||
      report.costDistribution[report.minCost] !== report.optimalSolutionCount) return null;
  return report.minCost;
}

export function rateDelivery(input: {
  stage: Stage;
  result: Pick<SimulationResult, 'clear'>;
  cost: number;
  rescueUsed: boolean;
  report?: SolverSummary;
}): Rating {
  if (!input.result.clear) return { status: 'RATED', stars: 0, reason: '誤配送があります。設定を見直して再挑戦しよう。' };
  const minimum = verifiedMinimum(input.stage, input.report);
  if (!Number.isSafeInteger(input.cost) || input.cost < 0 || (minimum !== null &&
      (input.cost < minimum || !input.report!.costDistribution[input.cost]))) {
    return { status: 'INCONSISTENT', stars: null, reason: 'コストと検証データが一致しないため、評価を確定できません。' };
  }
  if (minimum === null) return { status: 'PENDING', stars: null, reason: '配送成功。最適コストの検証データを確認できないため、評価は未確定です。' };
  if (input.rescueUsed) return { status: 'RATED', stars: 1, reason: 'RESCUEを使って配送成功。' };
  return input.cost === minimum
    ? { status: 'RATED', stars: 3, reason: '最適達成！ 最小の方向転換コストで届けました。' }
    : { status: 'RATED', stars: 2, reason: '配送成功！ 方向転換を減らす余地があります。' };
}
