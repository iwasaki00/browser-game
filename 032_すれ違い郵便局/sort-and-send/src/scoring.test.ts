import { beforeAll, expect, it } from 'vitest';
import { stage01 } from './stage';
import { solveStage, type SolverSummary } from './solver';
import { isSolverSummary, rateDelivery, verifiedMinimum } from './scoring';

let report: SolverSummary;
beforeAll(async () => { report = await solveStage(stage01); });
it('rejects malformed JSON summaries before scoring', () => {
  expect(isSolverSummary(report)).toBe(true);
  for (const value of [null, {}, { ...report, costDistribution: null }, { ...report, status: 'fake' }, { ...report, costDistribution: { 2: 'one' } }]) {
    expect(isSolverSummary(value)).toBe(false);
  }
});
const rate = (cost: number, extra = {}) => rateDelivery({ stage: stage01, result: { clear: true }, cost, rescueUsed: false, report, ...extra });
it('failed delivery earns zero even if report is missing', () => {
  expect(rate(0, { result: { clear: false }, report: undefined })).toMatchObject({ status: 'RATED', stars: 0 });
});
it('success with RESCUE earns one', () => expect(rate(2, { rescueUsed: true })).toMatchObject({ status: 'RATED', stars: 1 }));
it('nonoptimal success earns two', async () => {
  const stage = structuredClone(stage01); stage.parcels = [{ id: 0, color: 'RED' }];
  const multipleCosts = await solveStage(stage);
  expect(rateDelivery({ stage, result: { clear: true }, cost: 2, rescueUsed: false, report: multipleCosts })).toMatchObject({ status: 'RATED', stars: 2 });
});
it('optimal success earns three', () => expect(rate(2)).toMatchObject({ status: 'RATED', stars: 3 }));
it('missing report remains pending', () => expect(rate(2, { report: undefined })).toMatchObject({ status: 'PENDING', stars: null }));
it('RESCUE success earns one without depending on an ordinary optimum', () => expect(rate(2, { report: undefined, rescueUsed: true })).toMatchObject({ status: 'RATED', stars: 1 }));
it('stale fingerprint remains pending', () => expect(rate(2, { report: { ...report, stageFingerprint: 'old' } })).toMatchObject({ status: 'PENDING', stars: null }));
it.each(['INVALID', 'INCOMPLETE'])('%s reports cannot award optimal stars', status => {
  expect(rate(2, { report: { ...report, status } })).toMatchObject({ status: 'PENDING', stars: null });
});
it('cost below verified minimum is inconsistent', () => expect(rate(0)).toMatchObject({ status: 'INCONSISTENT', stars: null }));
it('successful cost absent from the complete distribution is inconsistent', () => expect(rate(4)).toMatchObject({ status: 'INCONSISTENT', stars: null }));
it('RESCUE success can have a cost below the ordinary minimum', () => expect(rate(0, { rescueUsed: true })).toMatchObject({ status: 'RATED', stars: 1 }));
it('invalid numeric cost is inconsistent', () => expect(rate(NaN)).toMatchObject({ status: 'INCONSISTENT', stars: null }));
it('unchecked, malformed or wrong-stage reports are not trusted', () => {
  for (const invalid of [
    { ...report, checkedConfigurations: 2 }, { ...report, stageId: 'other' },
    { ...report, costDistribution: { 2: 9 } }, { ...report, minCost: -1 },
    { ...report, totalConfigurations: '999' }, { ...report, optimalSolutionCount: 2 },
  ]) expect(verifiedMinimum(stage01, invalid)).toBeNull();
});
