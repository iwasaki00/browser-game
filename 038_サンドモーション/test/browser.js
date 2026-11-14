import { sampleImage, convertImage, decodeImage } from '../src/image.js';
const output = document.getElementById('results');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (condition, message) => { if (!condition) throw new Error(message); };

document.getElementById('run').addEventListener('click', async event => {
  event.target.disabled = true; output.textContent = `${navigator.userAgent}\n`;
  let passed = 0, failed = 0;
  const test = async (name, fn) => {
    try { await fn(); output.textContent += `PASS ${name}\n`; passed++; }
    catch (error) { output.textContent += `FAIL ${name}: ${error.message}\n`; failed++; }
  };
  await test('T01/T02 サンプル生成・色・画像配置', () => {
    const particles = convertImage(sampleImage(), 180, 300);
    check(particles.length === 17670, `粒子数: ${particles.length}`);
    check(new Set(particles.map(p => `${p.color[0]},${p.color[1]},${p.color[2]}`)).size > 30, '色数が不足');
    check(Math.max(...particles.map(p => p.y)) < 190, '画像が下側の余白に侵入');
  });
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    await test(`${type} のデコードと変換`, async () => {
      const source = sampleImage();
      const blob = await new Promise(resolve => source.toBlob(resolve, type));
      check(blob?.type === type, 'このブラウザは指定形式の生成に未対応');
      const image = await decodeImage(new File([blob], 'fixture.' + type.split('/')[1], { type }));
      check(image.naturalWidth === 600 && image.naturalHeight === 440, 'サイズが不一致');
      check(convertImage(image, 180, 300).length === 17670, '変換後の粒子数が不一致');
    });
  }
  await test('完全透過画像には粒子を生成しない', () => {
    const c = document.createElement('canvas'); c.width = c.height = 10;
    check(convertImage(c, 180, 300).length === 0, '透明な砂が生成された');
  });
  await test('破損画像のエラー', async () => {
    let rejected = false;
    try { await decodeImage(new File(['invalid'], 'broken.png', { type: 'image/png' })); }
    catch (error) { rejected = /読み込めません/.test(error.message); }
    check(rejected, '破損画像を拒否しなかった');
  });
  const iframe = document.getElementById('app');
  const doc = iframe.contentDocument;
  const get = id => doc.getElementById(id);
  const total = () => Number(get('total').textContent.replaceAll(',', ''));
  await test('T01/T14 初期描画と診断パネル', async () => {
    get('sample').click(); if (get('diagnostics').hidden) get('info').click(); await delay(100);
    check(total() === 17670, `初期化不良: ${get('total').textContent}`);
    check(!get('diagnostics').hidden, '診断パネルが開かない');
    check(get('counts').textContent === '17,670 / 0', '固定状態が不一致');
    check(get('sand').getContext('2d').getImageData(90, 50, 1, 1).data[3] > 0, 'Canvasが空');
  });
  await test('T03 合成PointerEventによる部分崩壊', async () => {
    const c = get('sand'), rect = c.getBoundingClientRect();
    // Synthetic events have no native pointer capture; invoke the pointer handler
    // with a temporary capture stub. Physical input/capture needs manual testing.
    const capture = c.setPointerCapture;
    c.setPointerCapture = () => {};
    try {
      c.dispatchEvent(new iframe.contentWindow.PointerEvent('pointerdown', { pointerId: 1, clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height * 0.3, bubbles: true }));
      c.dispatchEvent(new iframe.contentWindow.PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    } finally { c.setPointerCapture = capture; }
    await delay(850);
    const fixed = Number(get('counts').textContent.split(' / ')[0].replaceAll(',', ''));
    check(fixed > 0 && fixed < total(), '部分崩壊していない');
  });
  await test('T05 一斉崩壊、T11 リセット', async () => {
    get('collapse').click();
    check(get('counts').textContent === '0 / 17,670', '全解除に失敗');
    await delay(1500); check(total() === 17670, '粒子数が変化');
    get('reset').click(); check(get('counts').textContent === '17,670 / 0', 'リセット失敗');
  });
  await test('T08 重力操作のUI反映', () => {
    for (const button of doc.querySelectorAll('[data-g]')) {
      button.click();
      check(button.getAttribute('aria-pressed') === 'true', '選択表示の不一致');
      check(get('gravity').textContent === button.dataset.g.replace(',', ', '), '重力値の不一致');
    }
    doc.querySelector('[data-g="0,1"]').click();
  });
  await test('リサイズしても粒子を初期化しない', async () => {
    get('collapse').click(); const before = total();
    iframe.style.width = '375px'; await delay(200);
    check(total() === before && get('counts').textContent.startsWith('0 /'), 'リサイズで状態消失');
    check(doc.documentElement.scrollWidth <= 375, 'モバイル幅で横スクロール');
    iframe.style.width = '100%'; get('reset').click();
  });
  await test('T12 品質切替と画像再生成', () => {
    get('quality').value = 'light'; get('quality').dispatchEvent(new iframe.contentWindow.Event('change'));
    check(total() === 7828 && get('sand').width === 120, '軽量化失敗');
    get('quality').value = 'high'; get('quality').dispatchEvent(new iframe.contentWindow.Event('change'));
    check(total() === 39440 && get('sand').width === 270 && get('sand').height === 450, '高精細化失敗');
    get('quality').value = 'standard'; get('quality').dispatchEvent(new iframe.contentWindow.Event('change'));
    check(total() === 17670 && get('sand').width === 180, '標準への復帰失敗');
  });
  output.textContent += `\n${passed} passed / ${failed} failed\n`;
  output.className = failed ? 'fail' : 'pass'; event.target.disabled = false;
});
