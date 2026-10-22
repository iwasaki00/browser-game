import { expect, it, vi } from 'vitest';
import { LabPanel } from './lab-ui';
import { createLabStore } from './lab';
import { prepareLabRetry } from './lab-integration';
import { createProgressStore, memoryStorage } from './progress';
import { stages, type Direction } from './stage';
import { isSolverSummary } from './scoring';
import { stageFingerprint } from './fingerprint';
import { simulate } from './simulation';
import ratings from './generated/stage-ratings.json';
const summaries: unknown[] = ratings; const reports = summaries.filter(isSolverSummary);
class Element extends EventTarget {
  ownText = ''; children: Element[] = []; className = ''; type = ''; hidden = false; disabled = false; open = false;
  get textContent(): string { return this.ownText + this.children.map(c => c.textContent).join(''); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  set innerHTML(_: string) { throw Error('Use text output for records'); }
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren() { this.children = []; this.ownText = ''; }
  showModal() { this.open = true; } close() { this.open = false; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
function fixture(unlock = false) {
  const nodes = new Map<string, Element>(); const el = (id: string) => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id)!; };
  const storage = memoryStorage(); const progress = createProgressStore(stages.map(s => s.id), storage);
  if (unlock) for (const stage of stages) progress.recordResult(stage.id, true, 1);
  const lab = createLabStore(stages, reports, storage); let active = false;
  const apply = vi.fn((key: string) => !!prepareLabRetry(lab, progress, stages, key));
  const root = { getElementById: el, createElement: () => new Element(), querySelector: () => [...nodes.values()].find(n => n.open) ?? null } as unknown as Document;
  const panel = new LabPanel(root, stages, lab, () => progress.data, () => active, apply); panel.sync();
  return { el, progress, lab, storage, panel, apply, active(value: boolean) { active = value; panel.sync(); },
    collect() { const patterns = { a: ['L', 'R'] as Direction[] }; return lab.collect({ stageId: '01', stageFingerprint: stageFingerprint(stages[0]), configuration: patterns, result: simulate(stages[0], patterns), progress: progress.data }); } };
}
it('shows 0/20 and 19/20 locked progress without discovery content or retry operations', () => {
  const f = fixture(); expect(f.el('lab-unlock').textContent).toContain('0 / 20'); f.el('lab').click();
  expect(f.el('lab-dialog').open).toBe(true); expect(f.el('lab-list').children).toEqual([]); expect(f.el('lab-detail').hidden).toBe(true);
  for (const stage of stages.slice(0, 19)) f.progress.recordResult(stage.id, true, 1);
  f.panel.sync(); expect(f.el('lab-description').textContent).toContain('19 / 20'); expect(f.el('lab-records').children).toEqual([]);
});
it('renders all 20 totals without revealing any undiscovered configuration', () => {
  const f = fixture(true); f.el('lab').click(); expect(f.el('lab-list').children).toHaveLength(20);
  expect(f.el('lab-list').children[0].textContent).toContain('発見 0 / 全成功解 1');
  expect(f.el('lab-list').children[7].textContent).toContain('全成功解 8');
  f.el('lab-list').children[0].click(); expect(f.el('lab-records').textContent).toContain('発見はまだありません'); expect(f.apply).not.toHaveBeenCalled();
});
it('shows only collected patterns/costs, prepares DESIGN retry and does not add discoveries', () => {
  const f = fixture(true); f.collect(); f.el('lab').click(); expect(f.el('lab-list').children[0].textContent).toContain('コンプリート');
  f.el('lab-list').children[0].click(); const card = f.el('lab-records').children[0];
  expect(card.textContent).toContain('方向転換コスト 2'); expect(card.textContent).toContain('L R');
  card.children.at(-1)!.click(); expect(f.apply).toHaveBeenCalledTimes(1); expect(f.el('lab-dialog').open).toBe(false); expect(f.lab.view().records).toHaveLength(1);
});
it('rejects retry after external record deletion', () => {
  const f = fixture(true); f.collect(); f.el('lab').click(); f.el('lab-list').children[0].click(); const button = f.el('lab-records').children[0].children.at(-1)!;
  f.lab.reset(true); button.click(); expect(f.el('lab-dialog').open).toBe(true); expect(f.el('lab-message').textContent).toContain('適用できません');
});
it('blocks access during RUN/PAUSED and while another modal is open', () => {
  const f = fixture(true); f.active(true); f.el('lab').click(); expect(f.el('lab-dialog').open).toBe(false);
  f.el('lab').dispatchEvent(new Event('click')); expect(f.el('lab-dialog').open).toBe(false);
  f.active(false); f.el('hint-dialog').open = true; f.el('lab').click(); expect(f.el('lab-dialog').open).toBe(false);
  f.el('hint-dialog').open = false; f.el('lab').click(); f.active(true); expect(f.el('lab-dialog').open).toBe(false);
});
it('hides previous discovery content if progress is reset and closes via Escape', () => {
  const f = fixture(true); f.collect(); f.el('lab').click(); f.el('lab-list').children[0].click();
  f.progress.reset(true); f.panel.sync(); expect(f.el('lab-records').children).toEqual([]); expect(f.el('lab-list').hidden).toBe(true);
  f.el('lab-dialog').dispatchEvent(new Event('cancel', { cancelable: true })); expect(f.el('lab-dialog').open).toBe(false);
});
