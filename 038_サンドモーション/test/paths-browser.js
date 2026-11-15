const iframe = document.getElementById('app'), status = document.getElementById('status'), output = document.getElementById('results');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (ok, why) => { if (!ok) throw new Error(why); };
document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  const report = { version: '0.5.0', at: new Date().toISOString(), userAgent: navigator.userAgent,
    environment: 'Real app/Canvas, synthetic PointerEvents; Pointer Capture adapter; no native device input', measurements: [] };
  const win = iframe.contentWindow, doc = iframe.contentDocument, get = id => doc.getElementById(id), canvas = get('sand');
  const capture = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'].map(name => canvas[name]);
  let captured = null;
  canvas.setPointerCapture = id => { captured = id; }; canvas.hasPointerCapture = id => captured === id; canvas.releasePointerCapture = () => { captured = null; };
  const choose = name => { get('tools-open').click(); get('tool-' + name).click(); };
  const stroke = (ax, ay, bx, by) => {
    const r = canvas.getBoundingClientRect();
    for (const [type, x, y] of [['pointerdown', ax, ay], ['pointermove', bx, by], ['pointerup', bx, by]])
      canvas.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 42, pointerType: 'touch', button: 0,
        clientX: r.left + x / canvas.width * r.width, clientY: r.top + y / canvas.height * r.height }));
  };
  const walls = () => Number(get('wall-count').textContent.replaceAll(',', ''));
  function rasterState(below = canvas.height) {
    const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, histogram = new Map();
    let lower = 0, count = 0, paintedWalls = 0;
    for (let cell = 0; cell < canvas.width * canvas.height; cell++) {
      const i = cell * 4; if (!rgba[i + 3]) continue;
      if (rgba[i] === 178 && rgba[i + 1] === 191 && rgba[i + 2] === 184 && rgba[i + 3] === 255) { paintedWalls++; continue; }
      const key = Array.from(rgba.subarray(i, i + 4)).join(','); histogram.set(key, (histogram.get(key) || 0) + 1); count++;
      if (Math.floor(cell / canvas.width) > below) lower++;
    }
    return { count, lower, paintedWalls, histogram: JSON.stringify([...histogram].sort()) };
  }
  try {
    get('mode-free').click();
    const fixture = doc.createElement('canvas'); fixture.width = 600; fixture.height = 440;
    const ctx = fixture.getContext('2d'), colors = ['#e25f5c', '#f0c063', '#57b1a3', '#6389d0'];
    for (let i = 0; i < 4; i++) { ctx.fillStyle = colors[i]; ctx.fillRect(0, i * 110, 600, 110); }
    const blob = await new Promise(resolve => fixture.toBlob(resolve));
    for (const quality of ['standard', 'high']) {
      status.textContent = `${quality}: 水平壁と中央消去を検証中`;
      get('quality').value = quality; get('quality').dispatchEvent(new win.Event('change'));
      const transfer = new win.DataTransfer(), filename = `paths-${quality}.png`;
      transfer.items.add(new win.File([blob], filename, { type: 'image/png' })); get('image-file').files = transfer.files;
      get('image-file').dispatchEvent(new win.Event('change'));
      const loading = performance.now(); while (get('source-name').textContent !== filename) { assert(performance.now() - loading < 10000, '読み込み失敗'); await wait(20); }
      const w = canvas.width, h = canvas.height, y = Math.floor(h * .72), original = rasterState();
      choose('draw'); stroke(0, y, w - 1, y);
      const wallCells = walls(); assert(wallCells > 0 && rasterState().paintedWalls === wallCells, '壁の描画数が一致しません。');
      assert(rasterState().histogram === original.histogram, '壁を描いて砂の色・個数が変わりました。');
      get('collapse').click(); await wait(6000);
      assert(!document.hidden && !doc.hidden, '前面タブで再実行してください。');
      const supported = rasterState(y + 6); assert(supported.lower === 0, '水平壁を通り抜けました。');
      choose('erase'); stroke(w / 2, y, w / 2, y); await wait(4000);
      const opened = rasterState(y + 6); assert(opened.lower > 0, '中央を消しても砂が落ちません。');
      assert(opened.histogram === original.histogram && opened.count === original.count, '中央消去で色・個数が変わりました。');
      const remainingWalls = walls(); get('reset').click(); assert(walls() === remainingWalls, 'リセットで無関係な壁が消えました。');
      const freeImage = canvas.toDataURL(); get('mode-hourglass').click(); assert(get('tools-open').hidden, '砂時計に道具が表示されています。');
      get('mode-free').click(); assert(canvas.toDataURL() === freeImage, 'モード往復で配置が変わりました。');
      get('tools-open').click(); get('walls-clear').click(); get('tools-close').click(); assert(walls() === 0, '全消去に失敗しました。');
      choose('draw'); stroke(w * .25, h * .5, w * .75, h * .5 + w * .5); get('collapse').click(); await wait(6000);
      const sloped = rasterState(h * .5 + w * .5 + 5); assert(sloped.lower > 0, '斜面の端から砂が落ちません。');
      assert(sloped.histogram === original.histogram, '斜面で色・個数が変わりました。');
      report.measurements.push({ quality, grid: `${w}x${h}`, particles: original.count, wallCells, supportedBelowWall: supported.lower,
        lowerAfterCentreErase: opened.lower, lowerAfterSlope: sloped.lower, colorsAndCountExact: true, resetAndModePersistence: true });
      output.textContent = JSON.stringify(report, null, 2);
    }
    const response = await fetch('/__qa/paths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    assert(response.ok, '保存するには npm run qa を使用してください。'); status.textContent = '完了。docs/paths-v0.5.0/browser-results.json に記録しました。';
  } catch (error) { status.textContent = `失敗: ${error.message}`; output.textContent += `\n${error.stack}`; }
  finally {
    ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'].forEach((name, i) => { canvas[name] = capture[i]; });
    event.target.disabled = false;
  }
});
