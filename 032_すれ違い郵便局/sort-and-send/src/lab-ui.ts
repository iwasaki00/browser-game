import { labUnlock, type LabStore } from './lab';
import type { Progress } from './progress';
import type { Stage } from './stage';

export class LabPanel {
  private selected: string | undefined;
  private dialog: HTMLDialogElement;
  constructor(private root: Document, private stages: readonly Stage[], private lab: LabStore,
    private progress: () => Progress, private activeRun: () => boolean, private apply: (key: string) => boolean) {
    this.dialog = this.element<HTMLDialogElement>('lab-dialog');
    this.element('lab').addEventListener('click', () => {
      if (this.activeRun() || this.root.querySelector('dialog[open]')) return;
      this.selected = undefined; this.render(); this.dialog.showModal();
    });
    this.element('lab-close').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.element('lab-back').addEventListener('click', () => { this.selected = undefined; this.render(); });
  }
  private element<T extends HTMLElement>(id: string): T { return this.root.getElementById(id) as T; }
  private text(tag: string, value: string, className = '') {
    const element = this.root.createElement(tag); element.textContent = value; element.className = className; return element;
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  sync() {
    const gate = labUnlock(this.stages, this.progress());
    this.element<HTMLButtonElement>('lab').disabled = this.activeRun();
    this.element('lab-unlock').textContent = gate.unlocked ? '研究室 解放済み / RESCUEなしの成功設定を収集できます。' : `解放条件：全${gate.total}ステージで星1以上。達成 ${gate.achieved} / ${gate.total}。未達成のステージがあります。`;
    if (this.activeRun()) this.close();
    if (this.dialog.open) this.render();
  }
  private render() {
    const gate = labUnlock(this.stages, this.progress());
    this.element('lab-message').textContent = '';
    this.element('lab-description').textContent = gate.unlocked ? '新しい成功設定を見つけよう。発見した設定だけを閲覧・再挑戦できます。' : `研究室はロック中です。全${gate.total}ステージで星1以上が必要です。達成 ${gate.achieved} / ${gate.total}。未達成のステージがあります。`;
    const list = this.element('lab-list'), detail = this.element('lab-records');
    list.replaceChildren(); detail.replaceChildren();
    this.element('lab-detail').hidden = !gate.unlocked || !this.selected;
    list.hidden = !gate.unlocked || !!this.selected;
    if (!gate.unlocked) { this.selected = undefined; this.element('lab-storage').textContent = ''; return; }
    const view = this.lab.view();
    this.element('lab-storage').textContent = view.status === 'unknown-schema' ? '未対応の保存形式を保護しています。発見を保存できません。' :
      view.status === 'corrupt' ? '研究室データを読み取れず、元のデータを保護しています。発見を保存できません。' :
      view.status === 'unavailable' ? '研究室の保存が利用できません。通常プレイは続けられます。' :
      `発見記録は自動保存されます。旧記録 ${view.archived}件を保護・不正な記録 ${view.invalid}件を集計から除外。`;
    if (this.selected) {
      const stage = this.stages.find(s => s.id === this.selected);
      if (!stage) { this.selected = undefined; this.render(); return; }
      this.element('lab-stage-title').textContent = stage.name;
      const records = view.records.filter(r => r.stageId === stage.id);
      if (!records.length) detail.append(this.text('p', '発見はまだありません。通常プレイでRESCUEを使わずにCLEARを目指しましょう。'));
      records.forEach((record, index) => {
        const card = this.text('article', '', 'discovery-card');
        card.append(this.text('h5', `発見 ${String(index + 1).padStart(2, '0')} / 方向転換コスト ${record.cost}`));
        const configuration = this.text('dl', '', 'discovery-patterns');
        for (const [id, pattern] of Object.entries(record.configuration)) {
          const row = this.text('div', ''); row.append(this.text('dt', `分岐 ${id.toUpperCase()}`), this.text('dd', pattern.join(' '))); configuration.append(row);
        }
        const retry = this.root.createElement('button'); retry.type = 'button'; retry.textContent = 'この設定で再挑戦';
        retry.addEventListener('click', () => {
          if (this.activeRun() || !labUnlock(this.stages, this.progress()).unlocked || !this.apply(record.discoveryKey)) {
            this.render(); this.element('lab-message').textContent = '記録またはステージが変更されたため適用できません。一覧を確認してください。'; return;
          }
          this.close();
        });
        card.append(configuration, retry); detail.append(card);
      });
    } else for (const stage of this.stages) {
      const summary = view.stages.find(s => s.stageId === stage.id)!;
      const button = this.root.createElement('button'); button.type = 'button'; button.className = 'lab-stage';
      const status = summary.complete ? 'コンプリート' : summary.limitReached ? '保存上限達成' : summary.count ? '収集中' : '未発見';
      button.append(this.text('strong', stage.name), this.text('span', `発見 ${summary.count} / 全成功解 ${summary.total ?? '未確認'} · 収集 ${summary.count} / ${summary.limit} · ${status}`));
      button.addEventListener('click', () => { this.selected = stage.id; this.render(); }); list.append(button);
    }
  }
}
