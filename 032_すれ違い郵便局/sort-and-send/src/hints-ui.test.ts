import { expect, it, vi } from 'vitest';
import { HintPanel } from './hints-ui';
import { stageHints, type HintMode } from './hints';
import { stages } from './stage';
import { DeliveryRun, simulate } from './simulation';
import { createProgressStore, memoryStorage } from './progress';
import { isSolverSummary, rateDelivery } from './scoring';
import ratings from './generated/stage-ratings.json';

// Minimal event adapter to test wiring/text output; this does not emulate browser layout.
class Element extends EventTarget {
  textContent = ''; disabled = false; hidden = false; open = false; attributes = new Map<string, string>();
  set innerHTML(_: string) { throw new Error('Hint prose must use textContent'); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}
function fixture() {
  const nodes = new Map<string, Element>(); const el = (id: string) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id)!; };
  let mode: HintMode = 'DESIGN'; const panel = new HintPanel({ getElementById: el } as unknown as Document, () => mode); panel.setStage(stages[0]);
  return { panel, el, setMode(next: HintMode) { mode = next; panel.sync(); } };
}
it('opens from DESIGN, reveals in order and revisits unlocked prose after closing', () => {
  const { el } = fixture(); el('hint').click(); expect(el('hint-dialog').open).toBe(true); expect(el('hint-body').textContent).toBe(stageHints[0].hint1);
  expect(el('hint-level-2').disabled).toBe(true); expect(el('hint-level-3').disabled).toBe(true);
  el('hint-level-3').dispatchEvent(new Event('click')); expect(el('hint-body').textContent).toBe(stageHints[0].hint1);
  el('hint-next').click(); expect(el('hint-body').textContent).toBe(stageHints[0].hint2);
  el('hint-next').click(); expect(el('hint-body').textContent).toBe(stageHints[0].hint3); expect(el('hint-next').hidden).toBe(true);
  el('hint-level-1').click(); expect(el('hint-body').textContent).toBe(stageHints[0].hint1);
  el('hint-close').click(); expect(el('hint-dialog').open).toBe(false); el('hint').click(); expect(el('hint-level-3').disabled).toBe(false);
});
it.each(['RUN', 'PAUSED', 'RESULT'] as const)('closes and rejects operations in %s, including forced events', mode => {
  const { panel, el, setMode } = fixture(); el('hint').click(); setMode(mode);
  expect(el('hint-dialog').open).toBe(false); expect(el('hint').disabled).toBe(true);
  el('hint').dispatchEvent(new Event('click')); el('hint-next').dispatchEvent(new Event('click')); expect(el('hint-dialog').open).toBe(false); panel.sync();
});
it('closes on stage selection and resets disclosure', () => {
  const { panel, el } = fixture(); el('hint').click(); el('hint-next').click(); panel.setStage(stages[1]);
  expect(el('hint-dialog').open).toBe(false); el('hint').click(); expect(el('hint-stage').textContent).toBe(stages[1].name);
  expect(el('hint-body').textContent).toBe(stageHints[1].hint1); expect(el('hint-level-2').disabled).toBe(true);
  panel.setStage(stages[0]); el('hint').click(); expect(el('hint-level-2').disabled).toBe(true);
});
it('uses inert text for markup-like prose and closes with Escape/cancel', () => {
  const text = stageHints[0].hint1;
  try {
    stageHints[0].hint1 = '<img src=x onerror=alert(1)>'; const { el } = fixture(); el('hint').click(); expect(el('hint-body').textContent).toBe(stageHints[0].hint1);
    el('hint-dialog').dispatchEvent(new Event('cancel', { cancelable: true })); expect(el('hint-dialog').open).toBe(false);
  } finally { stageHints[0].hint1 = text; }
});
it('does not alter patterns, delivery, RESCUE rights, stars or saved progress', () => {
  const patterns = { a: ['L', 'R'] as const }; const run = new DeliveryRun(stages[0], patterns); const preview = run.previewRescue()!; const before = run.snapshot;
  const storage = memoryStorage(); const save = vi.spyOn(storage, 'setItem'); const progress = createProgressStore(stages.map(s => s.id), storage); const saved = progress.data;
  const { el } = fixture(); el('hint').click(); el('hint-next').click(); el('hint-next').click(); el('hint-close').click();
  expect(patterns.a).toEqual(['L', 'R']); expect(run.snapshot).toEqual(before); expect(progress.data).toEqual(saved); expect(save).not.toHaveBeenCalled();
  expect(run.confirmRescue(preview, 'L')).toBe(true);
  const summaries: unknown[] = ratings; const report = summaries.filter(isSolverSummary).find(r => r.stageId === '01');
  expect(rateDelivery({ stage: stages[0], result: simulate(stages[0], patterns), cost: 2, rescueUsed: false, report }).stars).toBe(3);
  expect(rateDelivery({ stage: stages[0], result: run.finish(), cost: 2, rescueUsed: true, report }).stars).toBe(1);
});
it('disables mismatched-stage hints safely', () => {
  const { panel, el } = fixture(); const stage = structuredClone(stages[0]); stage.parcels[0].color = 'BLUE'; panel.setStage(stage);
  expect(el('hint').disabled).toBe(true); el('hint').dispatchEvent(new Event('click')); expect(el('hint-dialog').open).toBe(false);
});
