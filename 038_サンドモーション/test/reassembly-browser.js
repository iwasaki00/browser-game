const iframe = document.getElementById('app'), output = document.getElementById('results'), status = document.getElementById('status');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, why) => { if (!condition) throw new Error(why); };
document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  const report = { version: '0.3.0', at: new Date().toISOString(), userAgent: navigator.userAgent,
    environment: 'Real browser app in 420x1000 iframe; manual gravity; no device sensors', measurements: [], images: {} };
  try {
    const doc = iframe.contentDocument, win = iframe.contentWindow, get = id => doc.getElementById(id), canvas = get('sand');
    if (get('diagnostics').hidden) get('info').click();
    get('return-duration').value = '1.5'; get('return-arc').value = '0.06';
    for (const quality of ['standard', 'high']) {
      status.textContent = `${quality}: 崩壊させています`;
      get('quality').value = quality; get('quality').dispatchEvent(new win.Event('change')); get('sample').click();
      const original = canvas.toDataURL('image/png'), count = get('total').textContent;
      get('collapse').click(); await wait(1800);
      assert(!document.hidden && !doc.hidden, '前面タブで再実行してください。');
      status.textContent = `${quality}: 復元中`;
      const start = win.performance.now(); get('reassemble').click();
      assert(canvas.dataset.reassembling === 'true', '復元が開始しませんでした。');
      const result = await new Promise((resolve, reject) => {
        let frames = 0, previous = start, intervals = [], saved = false;
        function sample(time) {
          if (document.hidden || doc.hidden) { reject(new Error('測定中にタブが非表示になりました。')); return; }
          frames++; intervals.push(time - previous); previous = time;
          if (!saved && time - start >= 700 && canvas.dataset.reassembling === 'true') {
            report.images[`mid-${quality}`] = canvas.toDataURL('image/png'); saved = true;
          }
          if (canvas.dataset.reassembling === 'false') {
            intervals.sort((a, b) => a - b);
            resolve({ quality, count: Number(count.replaceAll(',', '')), grid: `${canvas.width}x${canvas.height}`,
              configuredDurationMs: 1500, durationMs: +(time - start).toFixed(1), frames,
              fps: +(frames * 1000 / (time - start)).toFixed(1), p95FrameMs: +intervals[Math.floor(intervals.length * 0.95)].toFixed(1) });
          } else if (time - start > 10000) reject(new Error('復元が完了しません。'));
          else win.requestAnimationFrame(sample);
        }
        win.requestAnimationFrame(sample);
      });
      result.imageExact = canvas.toDataURL('image/png') === original;
      result.fixedCountExact = get('counts').textContent === `${count} / 0`;
      result.resetUsable = !get('reset').disabled;
      assert(result.imageExact && result.fixedCountExact && result.resetUsable, '復元結果が初期状態と不一致です。');
      report.images[`complete-${quality}`] = canvas.toDataURL('image/png');
      report.measurements.push(result); output.textContent = JSON.stringify(report.measurements, null, 2);
    }
    const response = await fetch('/__qa/reassembly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    assert(response.ok, '保存するには npm run qa のサーバーを使用してください。');
    status.textContent = '検証完了。docs/reassembly-v0.3.0 に記録しました。';
  } catch (error) { status.textContent = `失敗: ${error.message}`; output.textContent += `\n${error.stack}`; }
  finally { event.target.disabled = false; }
});
