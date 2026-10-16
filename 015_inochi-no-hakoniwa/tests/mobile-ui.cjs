// Focused UI/coordinate checks. Run with Node and an installed Playwright package.
// Set PLAYWRIGHT_MODULE to its absolute path if it is outside node_modules.
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const original = execFileSync('git', ['show', 'HEAD:015_inochi-no-hakoniwa/script.js'], { cwd: root, encoding: 'utf8' });
const segment = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end)).replace(/\r\n/g, '\n');
assert.equal(segment(source, 'function randomGenes', 'function canvasPoint'), segment(original, 'function randomGenes', 'function canvasPoint'));
assert.equal(segment(source, 'const LIMITS', 'let settings'), segment(original, 'const LIMITS', 'let settings'));
assert.equal(segment(source, 'function loop', 'ui.setupForm.addEventListener'), segment(original, 'function loop', 'ui.setupForm.addEventListener'));
const server = http.createServer((req, res) => {
  const name = req.url === '/' ? 'index.html' : req.url.slice(1);
  if (!['index.html', 'style.css', 'script.js'].includes(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root, name)));
});
const sizes = [[320,568], [375,667], [390,844], [430,932], [1280,800], [320,300], [844,390]];
const snapshot = page => page.evaluate(() => JSON.stringify({ grass, herbs, predators, deaths, effects, elapsed, paused, world: [world.width, world.height] }));
async function layout(page, setup) {
  return page.evaluate(setup => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const inside = r => r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
    const selectors = setup ? ['.setup-panel', '.start-button'] : ['.topbar', '.stats', '.controls', '#world'];
    return { overflow: document.documentElement.scrollWidth > innerWidth,
      fits: selectors.every(s => inside(rect(s))),
      canvas: { width: rect('#world').width, height: rect('#world').height },
      scrolls: document.querySelector('.setup-scroll').scrollHeight > document.querySelector('.setup-scroll').clientHeight };
  }, setup);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'hakoniwa-ui-'));
  try {
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch({ headless: true });
      try {
        for (const [width, height] of sizes) {
          const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: width < 1000, isMobile: width < 1000 });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.goto(url);
          assert.equal(await page.locator('.back-link').count(), 0);
          assert.deepEqual(await page.locator('#setup-grass, #setup-herbs, #setup-predators').evaluateAll(nodes => nodes.map(n => n.value)), ['150','25','6']);
          const setupLayout = await layout(page, true);
          assert.equal(setupLayout.overflow, false);
          assert.equal(setupLayout.fits, true, `${name} ${width}x${height}: setup fits`);
          await page.locator('#setup-predators').fill('2');
          await page.locator('#setup-herbs').fill('5');
          await page.locator('#setup-grass').fill('20');
          if (width === 430) {
            await page.locator('#setup-width').fill('900');
            await page.locator('#setup-height').fill('1200');
          }
          await page.screenshot({ path: path.join(artifacts, `${name}-${width}x${height}-setup.png`) });
          // Stop animation scheduling so UI actions can be checked without random simulation steps.
          await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
          await page.waitForTimeout(80);
          await page.locator('.start-button').click();
          assert.equal(await page.locator('#setup').evaluate(n => n.classList.contains('is-hidden')), true);
          await page.locator('#pause').click();
          assert.equal(await page.evaluate(() => paused), true);
          const mainLayout = await layout(page, false);
          assert.equal(mainLayout.overflow, false);
          if (height >= 480) assert.equal(mainLayout.fits, true, `${name} ${width}x${height}: main fits`);
          await page.evaluate(() => render());
          await page.screenshot({ path: path.join(artifacts, `${name}-${width}x${height}-world.png`) });
          await page.locator('#show-details').click();
          assert.equal(await page.locator('#details').evaluate(n => n.open), true);
          assert.equal(await page.locator('#generation').isVisible(), true);
          assert.equal(await page.locator('#herb-avg').isVisible(), true);
          assert.equal(await page.locator('#pred-avg').isVisible(), true);
          await page.locator('#details button').click();
          const beforeAdd = await page.evaluate(() => [grass.length, herbs.length, predators.length]);
          await page.locator('#add-grass').click();
          await page.locator('#add-herb').click();
          await page.locator('#add-predator').click();
          assert.deepEqual(await page.evaluate(() => [grass.length, herbs.length, predators.length]), beforeAdd.map((n,i) => n + [20,5,2][i]));
          for (const speed of [0.2,0.5,1,2,5]) {
            await page.locator(`[data-speed="${speed}"]`).click();
            assert.equal(await page.evaluate(() => speedMultiplier), speed);
            assert.equal(await page.locator('.speed.is-active').count(), 1);
          }
          await page.locator('#pause').click();
          assert.equal(await page.evaluate(() => paused), false);
          const advance = await page.evaluate(() => { const before = elapsed; loop(lastFrame + 20); return elapsed - before; });
          assert.ok(Math.abs(advance - 0.1) < 1e-6, 'x5 advances simulation time by five times the frame duration');
          await page.locator('#pause').click();
          const stopped = await page.evaluate(() => { const before = elapsed; loop(lastFrame + 20); return elapsed - before; });
          assert.equal(stopped, 0, 'paused simulation time must not advance');
          const beforeCancel = await snapshot(page);
          page.once('dialog', dialog => dialog.dismiss());
          await page.locator('#reset').click();
          assert.equal(await snapshot(page), beforeCancel);
          page.once('dialog', dialog => dialog.accept());
          await page.locator('#reset').click();
          assert.deepEqual(await page.evaluate(() => [grass.length, herbs.length, predators.length, elapsed, paused]), [20,5,2,0,false]);
          await page.locator('#pause').click();
          const beforeResize = await snapshot(page);
          await page.setViewportSize({ width: 260, height: 500 });
          await page.waitForTimeout(80);
          assert.equal(await snapshot(page), beforeResize, 'resize must preserve simulation state');
          assert.ok((await layout(page, false)).canvas.width < 280);
          assert.ok((await layout(page, false)).canvas.height < 280);
          await page.evaluate(() => {
            grass = [{ x: world.width / 2, y: world.height / 2, seed: 0.5 }, { x: world.width / 2, y: world.height / 2, seed: 0.6 }];
            herbs = []; predators = []; updateStats(); render();
          });
          const coords = await page.evaluate(() => {
            const r = canvas.getBoundingClientRect();
            const m = ctx.getTransform();
            const p = canvasPoint({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
            return { point: [p.x, p.y], expected: [world.width / 2, world.height / 2], transform: [m.a, m.d], expectedTransform: [canvas.width / world.width, canvas.height / world.height], x: r.left + r.width / 2, y: r.top + r.height / 2 };
          });
          assert.ok(coords.point.every((n, i) => Math.abs(n - coords.expected[i]) < 1e-6));
          assert.ok(coords.transform.every((n, i) => Math.abs(n - coords.expectedTransform[i]) < 1e-6));
          if (width < 1000) await page.touchscreen.tap(coords.x, coords.y);
          else await page.mouse.click(coords.x, coords.y);
          assert.equal(await page.evaluate(() => grass.length), 1, 'one tap removes exactly one organism');
          await page.evaluate(() => {
            const opts = { pointerId: 77, isPrimary: true, button: 0, clientX: 50, clientY: 50 };
            canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
            canvas.dispatchEvent(new PointerEvent('pointercancel', opts));
            canvas.dispatchEvent(new PointerEvent('pointerup', opts));
          });
          assert.equal(await page.evaluate(() => grass.length), 1);
          await page.evaluate(({ x, y }) => {
            const opts = { pointerId: 77, isPrimary: true, button: 0, clientX: x, clientY: y };
            canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
            canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 78, isPrimary: false }));
            canvas.dispatchEvent(new PointerEvent('pointerup', opts));
          }, coords);
          assert.equal(await page.evaluate(() => grass.length), 1, 'multiple pointers cancel removal');
          assert.equal(await page.locator('canvas').evaluate(n => getComputedStyle(n).getPropertyValue('user-select') || getComputedStyle(n).getPropertyValue('-webkit-user-select')), 'none');
          assert.equal(await page.locator('#setup-width').evaluate(n => getComputedStyle(n).getPropertyValue('user-select') || getComputedStyle(n).getPropertyValue('-webkit-user-select')), 'text');
          assert.deepEqual(errors, []);
          console.log(`PASS ${name} ${width}x${height} setupScroll=${setupLayout.scrolls} canvas=${mainLayout.canvas.width}x${mainLayout.canvas.height}`);
          await context.close();
        }
      } finally { await browser.close(); }
    }
    console.log('PASS simulation functions, constants, and speed/time loop unchanged');
    console.log(`Screenshots: ${artifacts}`);
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
