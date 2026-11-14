const iframe = document.getElementById('app'), output = document.getElementById('results'), status = document.getElementById('status');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, why) => { if (!value) throw new Error(why); };

document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  const report = { version: '0.2.1', at: new Date().toISOString(), userAgent: navigator.userAgent,
    environment: 'Desktop browser, real app iframe; synthetic swipe, no phone emulator or physical sensor',
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, measurements: [], images: {} };
  try {
    const doc = iframe.contentDocument, win = iframe.contentWindow, get = id => doc.getElementById(id), canvas = get('sand');
    const copy = () => { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; };
    const occupied = () => { const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) n++; return n; };
    const stats = () => ({ grid: get('grid').textContent, count: Number(get('total').textContent.replaceAll(',', '')),
      fixedFree: get('counts').textContent, diagnosticFps: get('fps').textContent, physicsMs: get('physics-ms').textContent });
    const measure = () => new Promise((resolve, reject) => {
      const start = win.performance.now(); let frames = 0, previous = start, gaps = [];
      function sample(time) {
        if (doc.hidden || document.hidden) { reject(new Error('測定中にタブが非表示になりました。前面で再実行してください。')); return; }
        gaps.push(time - previous); previous = time; frames++;
        if (time - start >= 2000) {
          gaps.sort((a, b) => a - b);
          resolve({ frames, elapsedMs: +(time - start).toFixed(1), fps: +(frames * 1000 / (time - start)).toFixed(1),
            p95FrameMs: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1) });
        } else win.requestAnimationFrame(sample);
      }
      win.requestAnimationFrame(sample);
    });
    if (get('diagnostics').hidden) get('info').click();
    const initials = [];
    for (const quality of ['standard', 'high']) {
      status.textContent = `${quality}: 初期画像を記録しています`;
      get('quality').value = quality; get('quality').dispatchEvent(new win.Event('change')); get('sample').click();
      await wait(100);
      const initial = copy(), uri = initial.toDataURL('image/png'); initials.push(initial); report.images[`initial-${quality}`] = uri;
      const initialStats = stats(), rect = canvas.getBoundingClientRect();
      const row = { quality, ...initialStats, cssCanvas: { width: +rect.width.toFixed(2), height: +rect.height.toFixed(2) },
        brushCssRadius: +(12 * canvas.width / 180 * rect.width / canvas.width).toFixed(2) };
      assert(occupied() === row.count, '初期占有数が不一致');
      status.textContent = `${quality}: 一斉崩壊のFPSを計測しています`;
      get('collapse').click(); row.collapse = await measure(); Object.assign(row.collapse, stats());
      assert(occupied() === row.count, '崩壊後に粒子が増減'); report.images[`collapse-${quality}`] = canvas.toDataURL('image/png');
      status.textContent = `${quality}: 自由砂へのスワイプを比較しています`;
      // Same displayed path and duration. It spans the settled/free sand region.
      const capture = canvas.setPointerCapture; canvas.setPointerCapture = () => {};
      const send = (type, x) => canvas.dispatchEvent(new win.PointerEvent(type, { pointerId: 1, pointerType: 'touch',
        clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * 0.8, bubbles: true, cancelable: true }));
      const swipeMeasure = measure();
      try {
        send('pointerdown', 0.15);
        for (let i = 1; i <= 12; i++) { await wait(16); send('pointermove', 0.15 + 0.7 * i / 12); }
        send('pointerup', 0.85);
      } finally { canvas.setPointerCapture = capture; }
      row.swipe = await swipeMeasure; Object.assign(row.swipe, stats());
      assert(occupied() === row.count, 'スワイプ後に粒子が増減'); report.images[`swipe-${quality}`] = canvas.toDataURL('image/png');
      get('reset').click(); row.resetExact = canvas.toDataURL('image/png') === uri;
      assert(row.resetExact && occupied() === row.count, 'リセット結果の不一致');
      report.measurements.push(row); output.textContent = JSON.stringify(report.measurements, null, 2);
    }
    const comparison = document.getElementById('comparison'), c = comparison.getContext('2d');
    c.fillStyle = '#14191c'; c.fillRect(0, 0, comparison.width, comparison.height);
    c.imageSmoothingEnabled = false;
    for (let i = 0; i < initials.length; i++) {
      c.fillStyle = '#e9bb85'; c.font = '15px sans-serif'; c.fillText(`${i ? '高精細 270×450' : '標準 180×300'}`, 15 + 300 * i, 28);
      c.fillStyle = '#e9e9df'; c.font = '12px sans-serif'; c.fillText(`${report.measurements[i].count.toLocaleString()} particles`, 15 + 300 * i, 49);
      c.drawImage(initials[i], 15 + i * 300, 70, 270, 450);
    }
    report.images['initial-comparison'] = comparison.toDataURL('image/png'); report.success = true;
    const response = await fetch('/__qa/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    assert(response.ok, '結果の保存には npm run qa を使用してください。');
    status.textContent = '比較完了。画像・FPS・リセット結果を docs/quality-v0.2.1 に保存しました。';
  } catch (error) { status.textContent = `失敗: ${error.message}`; output.textContent += `\n${error.stack}`; }
  finally { event.target.disabled = false; }
});
