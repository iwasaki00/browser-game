import './style.css';
import { QualityMetrics, stepAgreement } from './metrics';
import { bindRafEnvironment, readRafContext } from './environment';
import { RafDisplayDeadline } from './deadline';
import type { RafActivity } from './raf';
import { RafLifecycleProbe } from './lifecycle';

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
  readonly #lifecycle: RafLifecycleProbe;
  #lastPaint = -Infinity;
  readonly #freshness = new RafDisplayDeadline(() => this.paint());
  readonly #root = document.createElement('aside');
  readonly #output = document.createElement('pre');
  readonly #report = document.createElement('textarea');
  readonly #os = document.createElement('input');
  readonly #browser = document.createElement('input');
  readonly #label = document.createElement('input');
  constructor(private readonly read: () => QualityState, comparisonVisible: () => boolean, private readonly activity: () => RafActivity, gameFrame: FrameRequestCallback) {
    this.metrics = new QualityMetrics(undefined, comparisonVisible);
    this.#lifecycle = new RafLifecycleProbe(window, () => ({ context: readRafContext(document), activity: this.activity() }), undefined, callback => callback === gameFrame);
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
      this.metrics.setEnabled(!this.enabled, performance.now()); toggle.textContent = this.enabled ? '診断を停止' : '診断を再開';
      if (this.enabled) { this.#lifecycle.start(); this.observe('diagnostic-on'); } else this.#lifecycle.stop();
      this.#lastPaint = -Infinity; this.refresh();
    };
    reset.onclick = () => { this.metrics.reset(); this.observe('measurement-reset'); this.#lifecycle.note('MEASUREMENT_RESET'); this.#lastPaint = -Infinity; this.refresh(); };
    exportButton.onclick = () => {
      if (this.#report.hidden) { this.#report.value = JSON.stringify(this.report(), null, 2); this.#report.hidden = false; exportButton.textContent = '結果テキストを閉じる'; }
      else { this.#report.hidden = true; exportButton.textContent = '結果をテキスト表示'; }
    };
    this.#root.append(title, toggle, reset, exportButton, environment, values, this.#report); document.body.append(this.#root);
    bindRafEnvironment(document, window, () => this.enabled, (now, context, reason) => {
      this.metrics.observeContext(now, context, reason, this.activity()); this.#lifecycle.note(reason); this.refresh();
    });
    for (const event of ['click', 'change', 'pointerup', 'pointercancel']) document.addEventListener(event, e => {
      if (this.enabled) { this.observe(`ui-${event}`); this.#lifecycle.note(`UI_${event}:${(e.target as HTMLElement)?.id || 'canvas/document'}`); }
    });
    this.metrics.setEnabled(true); this.#lifecycle.start(); this.observe('diagnostic-on'); this.refresh();
  }
  get enabled(): boolean { return this.metrics.enabled; }
  private observe(reason: string): void { this.metrics.observeContext(performance.now(), readRafContext(document), reason, this.activity()); }
  frame(now: number): void { this.metrics.frame(now, readRafContext(document), this.activity()); }
  update(now: number): void {
    if (!this.enabled) return;
    this.observe('frame-completed');
    if (now - this.#lastPaint >= 500) { this.#lastPaint = now; this.refresh(); }
  }
  private refresh(): void {
    this.paint();
    // One UI-only watchdog invalidates old FPS even if RAF stops. Never advances a world or loops by itself.
    this.#freshness.refresh(this.enabled);
  }
  report() {
    const state = this.read(), capturedAtPerformanceMs = performance.now();
    return { version: '0.7.2', generatedAt: new Date().toISOString(), environment: { os: this.#os.value || null,
      browserVersion: this.#browser.value || null, userAgent: navigator.userAgent, label: this.#label.value || null, performanceTimeOriginMs: performance.timeOrigin },
      state: { ...state, ...readRafContext(document), activity: this.activity(), capturedAtPerformanceMs, stepAgreement: stepAgreement(state.steps) },
      metrics: this.metrics.snapshot(capturedAtPerformanceMs), lifecycle: this.#lifecycle.snapshot(),
      definitions: { fps: 'requestAnimationFrame cadence; not GPU completed frames', draw: 'Canvas submission CPU wall time; not GPU time',
        singleStep: 'SimulationRunner.step, includes goal/flow receipts', comparison: 'A+B atomic pair; PLAY time divided by committed pair count (batch mean)',
        maximumComparison: 'maximum batch mean, not worst individual step', recentWindow: 'last 240 observations per condition; mean/median/p95/max/count share the same window',
        raf: 'A=visible+focused; B=not visible; C=visible+unfocused; D=first 1000ms after B/C. Cross-condition intervals and first resume gaps are separate, never A.',
        freshness: 'Current FPS only for current foreground segment with RAF age <1000ms; one UI-only watchdog invalidates stale display',
        longFrame: 'thresholds strictly >100/>500/>900ms; longest abnormal run = sum of consecutive >100ms intervals, not a CPU Long Task',
        activity: 'Formal trial statistics are per segment/activity, never the mixed condition aggregates. Segment window is last up to 240 intervals; p99 nearest rank.',
        lifecycle: 'DEV forwarding wrappers observe requests/cancels/errors without creating, deduplicating or restarting a RAF loop' } };
  }
  private paint(): void {
    const s = this.read(), m = this.metrics.snapshot(performance.now()), matched = stepAgreement(s.steps);
    const labels = { FOREGROUND: 'A 前面+フォーカス', HIDDEN: 'B 非表示', UNFOCUSED: 'C 別へフォーカス', RESUMING: 'D 復帰直後' };
    this.#output.textContent = [this.enabled ? '● 計測中（リセット以降の累積）' : 'Ⅱ 計測停止・メソッド復元済み',
      `visibility=${m.raf.context?.visibilityState ?? '未取得'} / hasFocus=${m.raf.context?.hasFocus ?? '未取得'} / ${m.raf.condition ?? '停止'}`,
      `前面FPS ${m.recentRafFps === null ? '未取得・停止/復帰中/更新待ち' : value(m.recentRafFps)} / 最終RAFから ${value(m.raf.ageMs, 'ms')}`,
      'FPSは最終観測時の値です。更新停止中の現在FPSを保証しません。',
      '以下の条件集計は参考値（再生/停止混在）。正式値はJSONの区間別segments。',
      ...Object.entries(m.raf.conditions).map(([key, stats]) => {
        const w = stats.window;
        return `${labels[key as keyof typeof labels]}: 直近${w.count}件 平均${value(w.meanMs)} / 中央${value(w.medianMs)} / p95 ${value(w.p95Ms)} / 最大${value(w.maximumMs)}ms / >100ms ${w.over100Ms}回\n  全${stats.count}件 / >100ms ${stats.over100Ms}回`;
      }),
      `条件境界 ${m.raf.boundaryIntervals.count}件 / 復帰最初の間隔 ${m.raf.firstResumeGaps.count}件（非表示等を含み通常値から除外）`,
      `計測区間 ${this.activity().playback} / ${this.activity().phase}（再生・停止の数値はJSONのsegmentsで分離）`,
      `ゲームRAF: 世代${this.#lifecycle.snapshot().generation} / 最大待機${this.#lifecycle.snapshot().peakGamePendingObserved} / 例外${this.#lifecycle.snapshot().exceptionsObserved}（全RAF待機最大${this.#lifecycle.snapshot().peakPendingObserved}）`,
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
