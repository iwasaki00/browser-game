import { HintSession, hintForStage, hintText, hintTitles, type HintLevel, type HintMode } from './hints';
import type { Stage } from './stage';

/** Text-only modal; disclosure does not call game operations or storage. */
export class HintPanel {
  private session = new HintSession(undefined);
  private stageName = '';
  private dialog: HTMLDialogElement;
  private button: HTMLButtonElement;
  constructor(private root: Document, private mode: () => HintMode) {
    this.dialog = this.element<HTMLDialogElement>('hint-dialog');
    this.button = this.element<HTMLButtonElement>('hint');
    this.button.addEventListener('click', () => {
      if (!this.session.open(this.mode())) return;
      this.render(); if (!this.dialog.open) this.dialog.showModal();
    });
    for (const level of [1, 2, 3] as const) this.element(`hint-level-${level}`).addEventListener('click', () => {
      if (this.session.view(level, this.mode())) this.render();
    });
    this.element('hint-next').addEventListener('click', () => { if (this.session.revealNext(this.mode())) this.render(); });
    this.element('hint-close').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => this.session.close());
  }
  private element<T extends HTMLElement>(id: string): T { return this.root.getElementById(id) as T; }
  setStage(stage: Stage) {
    this.close(); this.stageName = stage.name;
    this.session = new HintSession(hintForStage(stage));
    this.sync();
  }
  sync() {
    if (this.mode() !== 'DESIGN') this.close();
    this.button.disabled = this.mode() !== 'DESIGN' || !this.session.hints;
    this.element('hint-status').textContent = !this.session.hints ? 'このステージのヒントを確認できません。' :
      this.mode() === 'DESIGN' ? '発想 → 注目点 → 手掛かり。星評価への減点はありません。' : 'ヒントは分岐設定中（DESIGN）に利用できます。';
  }
  private close() { this.session.close(); if (this.dialog.open) this.dialog.close(); }
  private render() {
    const { unlocked, selected } = this.session.snapshot;
    const hints = this.session.hints;
    if (!hints) return;
    this.element('hint-stage').textContent = this.stageName;
    this.element('hint-heading').textContent = `ヒント${selected} / ${hintTitles[selected - 1]}`;
    this.element('hint-body').textContent = hintText(hints, selected);
    for (const level of [1, 2, 3] as HintLevel[]) {
      const button = this.element<HTMLButtonElement>(`hint-level-${level}`);
      button.disabled = level > unlocked;
      button.setAttribute('aria-pressed', String(level === selected));
      button.setAttribute('aria-label', `ヒント${level} ${hintTitles[level - 1]}${level > unlocked ? '（未開放）' : ''}`);
    }
    const next = this.element<HTMLButtonElement>('hint-next');
    next.hidden = unlocked === 3;
    next.textContent = `ヒント${unlocked + 1}を開放する`;
  }
}
