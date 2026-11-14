const iframe = document.getElementById('app'), output = document.getElementById('results'), status = document.getElementById('status');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (ok, why) => { if (!ok) throw new Error(why); };
document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  const report = { version: '0.4.0', at: new Date().toISOString(), userAgent: navigator.userAgent,
    environment: 'Real app in 420x1100 iframe; synthetic file/manual button input; no physical sensors', measurements: [], images: {} };
  try {
    const win = iframe.contentWindow, doc = iframe.contentDocument, get = id => doc.getElementById(id), canvas = get('sand');
    if (get('diagnostics').hidden) get('info').click();
    get('mode-hourglass').click();
    const bands = ['#e25f5c', '#f0c063', '#57b1a3', '#6389d0'];
    async function loadFixture(width, height) {
      const image = document.createElement('canvas'); image.width = width; image.height = height;
      const ctx = image.getContext('2d');
      for (let i = 0; i < 4; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, i * height / 4, width, height / 4); }
      const blob = await new Promise(resolve => image.toBlob(resolve));
      const transfer = new win.DataTransfer(); transfer.items.add(new win.File([blob], 'hourglass-bands.png', { type: 'image/png' }));
      get('image-file').files = transfer.files; get('image-file').dispatchEvent(new win.Event('change'));
      const start = performance.now();
      while (get('source-name').textContent !== 'hourglass-bands.png') {
        assert(performance.now() - start < 10000, '画像読み込みが完了しません。'); await wait(20);
      }
    }
    // Visible grain RGBA multiset, excluding the wall palette. Pure tests
    // separately verify every ID, wall exclusion and the exact grid positions.
    function grains() {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, counts = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue;
        if (data[i + 3] === 255 && ((data[i] === 20 && data[i + 1] === 25 && data[i + 2] === 28) ||
          (data[i] === 129 && data[i + 1] === 157 && data[i + 2] === 149))) continue;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return JSON.stringify([...counts].sort());
    }
    for (const quality of ['standard', 'high']) for (const source of ['sample', 'dense-portrait', 'bands-straight', 'bands-tilted']) {
      status.textContent = `${quality} / ${source}: 流下中`;
      get('quality').value = quality; get('quality').dispatchEvent(new win.Event('change')); get('sample').click();
      if (source !== 'sample') await loadFixture(600, source === 'dense-portrait' ? 1000 : 440);
      get('hourglass-straight').click();
      const initial = canvas.toDataURL(), originalColors = grains(), count = Number(get('total').textContent.replaceAll(',', ''));
      assert(get('counts').textContent === `${get('total').textContent} / 0`, '初期状態が固定ではありません。');
      report.images[`${source}-initial-${quality}`] = initial;
      const start = win.performance.now(); get('collapse').click();
      let turnedLeft = false, turnedRight = false, restored = false;
      const row = await new Promise((resolve, reject) => {
        let frames = 0, previous = start, intervals = [];
        function sample(time) {
          try {
            assert(!document.hidden && !doc.hidden, '測定中にタブが非表示になりました。前面で再実行してください。');
            frames++; intervals.push(time - previous); previous = time;
            if (source === 'bands-tilted') {
              if (!turnedLeft && time - start >= 5000) { get('hourglass-left').click(); turnedLeft = true; }
              if (!turnedRight && time - start >= 8000) { get('hourglass-right').click(); turnedRight = true; }
              if (!restored && time - start >= 11000) { get('hourglass-straight').click(); restored = true; }
            }
            if (Number.parseInt(get('hourglass-remaining').textContent.replaceAll(',', '')) === 0 && get('hourglass-remaining').dataset.settled === 'true') {
              intervals.sort((a, b) => a - b);
              resolve({ quality, source, count, grid: `${canvas.width}x${canvas.height}`, flowMs: +(time - start).toFixed(1),
                fps: +(frames * 1000 / (time - start)).toFixed(1), p95FrameMs: +intervals[Math.floor(intervals.length * 0.95)].toFixed(1) });
            } else { assert(time - start < 180000, '3分以内に流れ切りませんでした。'); win.requestAnimationFrame(sample); }
          } catch (error) { reject(error); }
        }
        win.requestAnimationFrame(sample);
      });
      await wait(2500);
      row.rgbaMultisetExact = grains() === originalColors;
      row.countExact = Number(get('total').textContent.replaceAll(',', '')) === count;
      assert(row.rgbaMultisetExact && row.countExact, '色または粒子数が一致しません。');
      report.images[`${source}-complete-${quality}`] = canvas.toDataURL();
      const settled = canvas.toDataURL(); get('flip').click(); get('flip').click();
      row.doubleFlipExact = canvas.toDataURL() === settled;
      get('reset').click(); row.resetExact = canvas.toDataURL() === initial;
      assert(row.doubleFlipExact && row.resetExact, '反転またはリセットに不整合があります。');
      report.measurements.push(row); output.textContent = JSON.stringify(report.measurements, null, 2);
    }
    const response = await fetch('/__qa/hourglass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    assert(response.ok, '保存するには npm run qa を使用してください。');
    status.textContent = '検証完了。docs/hourglass-v0.4.0 に記録しました。';
  } catch (error) { status.textContent = `失敗: ${error.message}`; output.textContent += `\n${error.stack}`; }
  finally { event.target.disabled = false; }
});
