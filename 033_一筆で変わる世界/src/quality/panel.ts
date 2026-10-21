import './style.css';
import { QualityMetrics, stepAgreement } from './metrics';

export interface QualityState {
  scene: string; screen: string; step: number; operation: string; pointers: number; zoom: number;
  dpr: number; viewport: { width: number; height: number };
  canvases: readonly { name: string; width: number; height: number; cssWidth: number; cssHeight: number }[];
  steps: readonly [number, number] | null; balanced: boolean; problem: string | null;
}
const value = (number: number | null, unit = '') => number === null ? '未取得' : `${number.toFixed(2)}${unit}`;

/** Mounted only by the DEV + quality query branch; no extra RAF, storage or console logs. */
export class QualityPanel {
  readonly metrics: QualityMetrics;
  #lastPaint = -Infinity;
  readonly #root = document.createElement('aside');
  readonly #output = document.createElement('pre');
  readonly #report = document.createElement('textarea');
  readonly #os = document.createElement('input');
  readonly #browser = document.createElement('input');
  readonly #label = document.createElement('input');
  constructor(private readonly read: () => QualityState, comparisonVisible: () => boolean) {
    this.metrics = new QualityMetrics(undefined, comparisonVisible);
    this.#root.id = 'quality-panel'; this.#root.setAttribute('aria-label', '開発用品質診断');
    const title = document.createElement('strong'); title.textContent = 'QUALITY GATE · 開発用診断';
    const toggle = document.createElement('button'); toggle.id = 'quality-toggle'; toggle.textContent = '診断を停止';
    const reset = document.createElement('button'); reset.id = 'quality-reset'; reset.textContent = '計測をリセット';
    const exportButton = document.createElement('button'); exportButton.id = 'quality-export'; exportButton.textContent = '結果をテキスト表示';
    const values = document.createElement('details'), valuesTitle = document.createElement('summary');
    values.id = 'quality-details'; values.open = true; valuesTitle.textContent = '診断値（閉じても計測継続）'; values.append(valuesTitle, this.#output);
    const environment = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = '測定条件を記入'; environment.append(summary);
    for (const [input, text, id] of [[this.#os, 'OSとビルド（手動記入）', 'quality-os'], [this.#browser, 'ブラウザーと版（手動記入）', 'quality-browser'], [this.#label, '試行名・測定条件', 'quality-label']] as const) {
      const label = document.createElement('label'); label.textContent = text; input.id = id; label.append(input); environment.append(label);
    }
    this.#output.id = 'quality-values'; this.#report.id = 'quality-report'; this.#report.readOnly = true; this.#report.hidden = true;
    this.#report.setAttribute('aria-label', '品質診断結果JSON');
    toggle.onclick = () => {
      this.metrics.setEnabled(!this.enabled); toggle.textContent = this.enabled ? '診断を停止' : '診断を再開';
      this.#lastPaint = -Infinity; this.paint();
    };
    reset.onclick = () => { this.metrics.reset(); this.#lastPaint = -Infinity; this.paint(); };
    exportButton.onclick = () => {
      if (this.#report.hidden) { this.#report.value = JSON.stringify(this.report(), null, 2); this.#report.hidden = false; exportButton.textContent = '結果テキストを閉じる'; }
      else { this.#report.hidden = true; exportButton.textContent = '結果をテキスト表示'; }
    };
    this.#root.append(title, toggle, reset, exportButton, environment, values, this.#report); document.body.append(this.#root);
    this.metrics.setEnabled(true); this.paint();
  }
  get enabled(): boolean { return this.metrics.enabled; }
  frame(now: number): void { this.metrics.frame(now, document.hidden); }
  update(now: number): void { if (this.enabled && now - this.#lastPaint >= 500) { this.#lastPaint = now; this.paint(); } }
  report() {
    const state = this.read();
    return { version: '0.7.0', generatedAt: new Date().toISOString(), environment: { os: this.#os.value || null,
      browserVersion: this.#browser.value || null, userAgent: navigator.userAgent, label: this.#label.value || null },
      state: { ...state, stepAgreement: stepAgreement(state.steps) }, metrics: this.metrics.snapshot(),
      definitions: { fps: 'requestAnimationFrame cadence; not GPU completed frames', draw: 'Canvas submission CPU wall time; not GPU time',
        singleStep: 'SimulationRunner.step, includes goal/flow receipts', comparison: 'A+B atomic pair; PLAY time divided by committed pair count (batch mean)',
        maximumComparison: 'maximum batch mean, not worst individual step', recentWindow: 'last 240 observations', longFrame: 'RAF interval > 50ms; includes external/automation stalls' } };
  }
  private paint(): void {
    const s = this.read(), m = this.metrics.snapshot(), matched = stepAgreement(s.steps);
    this.#output.textContent = [this.enabled ? '● 計測中（リセット以降の累積）' : 'Ⅱ 計測停止・メソッド復元済み',
      `FPS（RAF）現在 ${value(m.recentRafFps)} / 平均 ${value(m.averageRafFps)}`,
      `フレーム間隔 p95 ${value(m.frameIntervals.recentP95Ms, 'ms')} / 最大 ${value(m.frameIntervals.maximumMs, 'ms')} / >50ms ${m.longFrames}回`,
      `描画CPU 平均 ${value(m.drawCpu.meanMs, 'ms')} / 最大 ${value(m.drawCpu.maximumMs, 'ms')}（${m.drawCpu.count}回）`,
      `フレーム処理CPU 平均 ${value(m.frameCpu.meanMs, 'ms')}`,
      `単独1ステップ ${value(m.logicalStepCpu.single.meanMs, 'ms')}（${m.logicalStepCpu.single.count}）`,
      `A+B同期1ステップ ${value(m.logicalStepCpu.comparison.meanMs, 'ms')}（${m.logicalStepCpu.comparison.count}）`,
      `結果集計1同期ステップ ${value(m.logicalStepCpu.summary.meanMs, 'ms')}（${m.logicalStepCpu.summary.count}）`,
      `${s.scene} / ${s.screen} / Step ${s.step}`, `操作 ${s.operation} / ポインター ${s.pointers} / ズーム ${s.zoom.toFixed(2)}×`,
      `Viewport ${s.viewport.width}×${s.viewport.height} / DPR ${s.dpr}`,
      ...s.canvases.map(c => `${c.name} Canvas ${c.width}×${c.height} / CSS ${c.cssWidth.toFixed(1)}×${c.cssHeight.toFixed(1)}`),
      `A/Bステップ ${s.steps?.join(' / ') ?? '比較していません'} / ${matched === null ? '対象外' : matched ? '✓ 一致' : '⚠ 不一致'}`,
      `水量収支 ${s.balanced ? '✓ 差分0' : '⚠ 異常'}${s.problem ? ` / ${s.problem}` : ''}`].join('\n');
  }
}
