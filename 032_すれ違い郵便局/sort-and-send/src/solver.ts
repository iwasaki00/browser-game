import type { Direction, Stage } from './stage';
import { simulate } from './simulation';
import { validateStage } from './validation';
import { deliveryCost } from './cost';
import { compareIds, stageFingerprint } from './fingerprint';

export interface Solution {
  patterns: Record<string, Direction[]>;
  cost: number;
}
export interface SolverSummary {
  stageId: string;
  totalConfigurations: string;
  checkedConfigurations: number;
  solutionCount: number;
  minCost: number | null;
  maxCost: number | null;
  optimalSolutionCount: number | null;
  costDistribution: Record<string, number>;
  status: 'VALID' | 'INVALID' | 'INCOMPLETE';
  stageFingerprint: string;
}
export interface SolverReport extends SolverSummary {
  solutions: Solution[];
  validationErrors: string[];
}
export interface SolverOptions {
  maxConfigurations?: number;
  maxStoredSolutions?: number;
  signal?: { readonly aborted: boolean };
}
export class StageInputError extends Error {
  constructor(public readonly validationErrors: string[]) {
    super(validationErrors.join('\n')); this.name = 'StageInputError';
  }
}

/** Exhaustive L-first binary enumeration. Yields periodically to allow external cancellation. */
export async function solveStage(input: Stage, options: SolverOptions = {}): Promise<SolverReport> {
  const stage = structuredClone(input);
  const errors = validateStage(stage);
  if (!stage.id) errors.push('ステージIDがありません。');
  if (errors.length) throw new StageInputError(errors);
  const maxConfigurations = options.maxConfigurations ?? 1_000_000;
  const maxStoredSolutions = options.maxStoredSolutions ?? 100;
  for (const value of [maxConfigurations, maxStoredSolutions]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('探索・保存上限は0以上の安全な整数にしてください。');
  }
  const branches = stage.nodes.filter(n => n.kind === 'switch').sort((a, b) => compareIds(a.id, b.id));
  const slots = branches.flatMap(n => n.initialPattern!.map((_, index) => ({ id: n.id, index })));
  const total = 1n << BigInt(slots.length);
  const report: SolverReport = {
    stageId: stage.id, totalConfigurations: total.toString(), checkedConfigurations: 0,
    solutionCount: 0, minCost: null, maxCost: null, optimalSolutionCount: null,
    costDistribution: {}, status: 'INCOMPLETE', stageFingerprint: stageFingerprint(stage),
    solutions: [], validationErrors: [],
  };
  let min = Infinity, max = -Infinity, optimalCount = 0;
  for (let candidate = 0n; candidate < total; candidate++) {
    if (options.signal?.aborted || report.checkedConfigurations >= maxConfigurations) return report;
    const patterns: Record<string, Direction[]> = Object.fromEntries(branches.map(n => [n.id, Array<Direction>(n.initialPattern!.length).fill('L')]));
    slots.forEach((slot, i) => {
      if ((candidate >> BigInt(slots.length - 1 - i)) & 1n) patterns[slot.id][slot.index] = 'R';
    });
    const result = simulate(stage, patterns);
    report.checkedConfigurations++;
    if (result.clear) {
      const cost = deliveryCost(patterns, result);
      report.solutionCount++;
      report.costDistribution[cost] = (report.costDistribution[cost] ?? 0) + 1;
      if (cost < min) { min = cost; optimalCount = 1; }
      else if (cost === min) optimalCount++;
      max = Math.max(max, cost);
      if (report.solutions.length < maxStoredSolutions) report.solutions.push({ patterns, cost });
    }
    if (report.checkedConfigurations % 64 === 0 && BigInt(report.checkedConfigurations) < total) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
  report.status = report.solutionCount ? 'VALID' : 'INVALID';
  report.minCost = report.solutionCount ? min : null;
  report.maxCost = report.solutionCount ? max : null;
  report.optimalSolutionCount = optimalCount;
  return report;
}
