const iframe = document.getElementById('app'), output = document.getElementById('results'), status = document.getElementById('status');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (ok, why) => { if (!ok) throw new Error(why); };

document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true;
  const report = { version: '0.5.0', at: new Date().toISOString(), userAgent: navigator.userAgent,
    environment: 'Real browser iframe layouts; simulated 132px browser bars and 47/34px safe areas; no iPhone Safari UI', layouts: [], maximumSize: [] };
  try {
    const win = iframe.contentWindow, doc = iframe.contentDocument, get = id => doc.getElementById(id), canvas = get('sand');
    const visibleHit = id => {
      const el = get(id), r = el.getBoundingClientRect(), hit = doc.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      assert(r.width > 0 && r.height >= 38 && r.top >= -1 && r.bottom <= win.innerHeight + 1 && r.left >= -1 && r.right <= win.innerWidth + 1 && el.contains(hit), `${id}が表示・操作範囲外です。`);
      return { id, x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
    };
    for (const [width, fullHeight] of [[390, 844], [375, 667]]) for (const bars of [0, 132]) for (const font of [16, 32]) {
      const height = fullHeight - bars;
      iframe.style.width = width + 'px'; iframe.style.height = height + 'px';
      doc.documentElement.style.fontSize = font + 'px';
      get('app').style.paddingTop = `${47 + font / 2}px`; get('app').style.paddingBottom = `${34 + font / 2}px`;
      win.scrollTo(0, 0); await wait(200);
      for (const mode of ['free', 'hourglass']) {
        get('mode-' + mode).click(); await wait(100);
        const fixedImage = canvas.toDataURL(), count = get('total').textContent;
        const ids = ['settings-open', 'mode-free', 'mode-hourglass', 'collapse', mode === 'free' ? 'reassemble' : 'flip', 'reset', 'image-open', 'size-open', 'gravity-open', ...(mode === 'free' ? ['tools-open'] : [])];
        assert(get('tools-open').hidden === (mode === 'hourglass'), '砂時計の道具表示が不正です。');
        const row = { width, fullHeight, viewportHeight: height, simulatedBars: bars, safeTop: 47, safeBottom: 34, rootFontPx: font, mode, buttons: [] };
        if (font === 16) {
          for (const id of ids) row.buttons.push(visibleHit(id));
          assert(doc.documentElement.scrollHeight <= height + 1, '通常の文字サイズでページスクロールが必要です。');
        } else {
          for (const id of ids) { get(id).scrollIntoView({ block: 'center' }); row.buttons.push(visibleHit(id)); }
          row.scrollFallback = doc.documentElement.scrollHeight > height;
        }
        // Every modal keeps close outside the scrolling body.
        for (const name of ['settings', 'image', 'gravity', ...(mode === 'free' ? ['tools'] : [])]) {
          get(name + '-open').click(); await wait(50); visibleHit(name + '-close');
          const body = get(name + '-panel').querySelector('.panel-body'); body.scrollTop = body.scrollHeight;
          await wait(50); visibleHit(name + '-close'); get(name + '-close').click();
          assert(canvas.toDataURL() === fixedImage && get('total').textContent === count, 'パネル開閉で配置が変わりました。');
        }
        get('size-open').click(); await wait(50); visibleHit('size-close');
        get('photo-size').value = get('photo-size').min; get('photo-size').dispatchEvent(new win.Event('input'));
        await wait(100); get('size-close').click();
        assert(canvas.toDataURL() === fixedImage && get('total').textContent === count, 'プレビュー取消で配置が変わりました。');
        row.statePreserved = true; row.canvasCss = { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height };
        report.layouts.push(row); output.textContent = JSON.stringify(report, null, 2); win.scrollTo(0, 0);
      }
    }
    doc.documentElement.style.fontSize = '16px'; iframe.style.width = '390px'; iframe.style.height = '712px';
    get('app').style.paddingTop = '55px'; get('app').style.paddingBottom = '42px';
    get('mode-free').click(); win.scrollTo(0, 0); await wait(100);
    const image = doc.createElement('canvas'); image.width = 620; image.height = 960;
    const ctx = image.getContext('2d'); ctx.fillStyle = '#57b1a3'; ctx.fillRect(0, 0, 620, 960);
    const blob = await new Promise(resolve => image.toBlob(resolve));
    for (const quality of ['standard', 'high']) {
      status.textContent = `${quality}: 最大サイズの崩壊を測定中`;
      get('quality').value = quality; get('quality').dispatchEvent(new win.Event('change'));
      const transfer = new win.DataTransfer(), filename = `maximum-${quality}.png`;
      transfer.items.add(new win.File([blob], filename, { type: 'image/png' }));
      get('image-file').files = transfer.files; get('image-file').dispatchEvent(new win.Event('change'));
      const loading = performance.now();
      while (get('source-name').textContent !== filename) { assert(performance.now() - loading < 10000, '画像読み込み失敗'); await wait(20); }
      get('size-open').click(); get('photo-size').value = '80'; get('photo-size').dispatchEvent(new win.Event('input')); get('size-apply').click();
      const initial = canvas.toDataURL(), count = Number(get('total').textContent.replaceAll(',', ''));
      assert(count === (quality === 'standard' ? 37200 : 83520), '最大サイズの粒子数が異なります。');
      get('collapse').click(); const start = win.performance.now();
      const frames = await new Promise((resolve, reject) => {
        let n = 0;
        function sample(time) {
          if (document.hidden || doc.hidden) { reject(new Error('前面タブで再実行してください。')); return; }
          n++; if (time - start >= 3000) resolve({ frames: n, elapsedMs: time - start, fps: n * 1000 / (time - start) });
          else win.requestAnimationFrame(sample);
        }
        win.requestAnimationFrame(sample);
      });
      get('reset').click(); assert(canvas.toDataURL() === initial, '最大サイズのリセット不一致');
      report.maximumSize.push({ quality, count, ...frames, resetExact: true });
    }
    const response = await fetch('/__qa/paths-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    assert(response.ok, '保存するには npm run qa を使用してください。');
    status.textContent = '完了。docs/paths-v0.5.0/layout-browser-results.json に保存しました。'; output.textContent = JSON.stringify(report, null, 2);
  } catch (error) { status.textContent = `失敗: ${error.message}`; output.textContent += `\n${error.stack}`; }
  finally { event.target.disabled = false; }
});
