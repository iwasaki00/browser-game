// Run with: node tests/mobile-ui.cjs
// Set PLAYWRIGHT_CORE_PATH when playwright-core is not installed locally.
const { chromium, webkit } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const baseline = process.env.BASELINE_SCRIPT ? fs.readFileSync(process.env.BASELINE_SCRIPT, 'utf8') : execFileSync('git', ['show', 'HEAD:014_strongest-creature/script.js'], {cwd: root, encoding:'utf8'});
const vm = require('node:vm');
// Functions responsible for randomness, genes, combat, appearance and averages must be unchanged.
for (const name of ['randomInt','clamp','randomName','createCreature','power','getStrongest','geneColor','monsterStyle','monsterMarkup','applyMonster','battle','shuffle','runTournament','mutate','breed','createNextPopulation','statMarkup','getAverages','playMatch','visualizeTournament','advanceOneGeneration']) {
  const extract = source => {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    return source.slice(start, source.indexOf('\n}', start) + 2);
  };
  assert.equal(extract(current), extract(baseline), `${name} remains unchanged`);
}
for (const name of ['POPULATION_SIZE','PARENT_COUNT','MUTATION_RATE','MAX_TURNS','AUTO_INTERVAL_MS','ANIMATION_STEP_MS']) {
  const re = new RegExp(`const ${name} = [^;]+;`);
  assert.equal(current.match(re)[0], baseline.match(re)[0]);
}
new vm.Script(current);

(async () => {
for (const engine of [chromium, webkit]) {
  if (process.env.TEST_ENGINE && engine.name() !== process.env.TEST_ENGINE) continue;
  const browser = await engine.launch({headless:true});
  const context = await browser.newContext();
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  // Shorten animation sleeps only in tests; keep interval cadence unchanged.
  await page.addInitScript(() => {
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms, ...args) => timeout(callback, ms <= 520 ? 2 : ms, ...args);
  });
  await page.goto('file:///' + root.replaceAll('\\','/') + '/index.html');
  for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[1280,800]]) {
    await page.setViewportSize({width,height});
    for (const tab of ['pack','champion','average','log']) {
      await page.locator('#tab-'+tab).click();
      assert(await page.locator('#detail-'+tab).isVisible());
      const layout = await page.evaluate(() => ({width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight, viewport:innerHeight, footer:document.querySelector('footer').getBoundingClientRect().bottom, buttons:[...document.querySelectorAll('main button')].map(b=>({w:b.offsetWidth,h:b.offsetHeight})), panel:document.querySelector('[role=tabpanel]:not([hidden])').getBoundingClientRect().height}));
      assert(layout.width <= width, `no horizontal overflow ${width}/${tab}`);
      assert(layout.height <= height, `one screen ${width}/${tab}: ${JSON.stringify(layout)}`);
      assert(layout.buttons.every(b=>b.w>=44 && b.h>=44));
      assert(layout.panel > 40);
      await page.locator('#detail-'+tab).evaluate(el => {el.scrollTop=el.scrollHeight;});
    }
    await page.locator('#reset').click();
    const box = await page.locator('dialog').boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x+box.width <= width && box.y+box.height <= height);
    await page.locator('button[value=cancel]').click();
  }
  await page.setViewportSize({width:320,height:568});
  await page.locator('#next-generation').click();
  assert(await page.locator('#next-ten').isDisabled());
  assert(await page.locator('#auto-evolve').isDisabled());
  await page.waitForFunction(()=>!isRunning);
  assert.equal(await page.locator('#generation').textContent(),'2');
  await page.locator('#next-ten').click();
  await page.waitForFunction(()=>!isRunning);
  assert.equal(await page.locator('#generation').textContent(),'12');
  const snapshot = () => page.evaluate(()=>JSON.stringify({generation,population,history,latestLogs}));
  const before = await snapshot();
  await page.locator('#reset').click();
  await page.locator('button[value=cancel]').click();
  assert.equal(await snapshot(), before);
  await page.locator('#reset').click();
  await page.keyboard.press('Escape');
  assert.equal(await snapshot(), before);
  await page.locator('#tab-log').click();
  await page.locator('#auto-evolve').click();
  assert.equal(await page.locator('#auto-evolve').getAttribute('aria-pressed'),'true');
  await page.locator('#auto-evolve').click();
  assert.match(await page.locator('#progress').textContent(), /停止待ち/);
  assert(await page.locator('#auto-evolve').isDisabled());
  assert(await page.locator('#reset').isDisabled());
  assert(await page.locator('#detail-log').isVisible());
  await page.waitForFunction(()=>!isRunning);
  assert.match(await page.locator('#progress').textContent(),/停止しました/);
  assert.equal(await page.evaluate(()=>autoTimer), null);
  const stopped = await snapshot();
  await page.waitForTimeout(1800);
  assert.equal(await snapshot(),stopped);
  assert.equal(await page.locator('#tab-log').getAttribute('aria-selected'),'true');
  assert.match(await page.locator('#battle-log').textContent(),/第12世代/);
  // Restart and let the unchanged 1700ms interval advance another generation.
  await page.locator('#auto-evolve').click();
  await page.waitForFunction(()=>generation>=15);
  await page.locator('#auto-evolve').click();
  await page.waitForFunction(()=>!isRunning);
  await page.locator('#reset').click();
  await page.locator('button[value=reset]').click();
  await page.waitForFunction(()=>generation===1);
  assert.equal(await page.evaluate(()=>history.length),0);
  assert.equal(await page.locator('.pack-slot').count(),64);
  assert.equal(await page.locator('#best-stats .stat-row').count(),5);
  assert.equal(await page.locator('#average-stats .stat-row').count(),5);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#next-generation')).touchAction),'manipulation');
  assert.equal(await page.evaluate(()=>{const style=getComputedStyle(document.querySelector('.battle-log')); return style.userSelect || style.webkitUserSelect;}),'text');
  if (process.env.SCREENSHOT_DIR) {
    await page.locator('#tab-pack').click();
    await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, engine.name()+'-320.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('#tab-champion').click();
    await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, engine.name()+'-390.png')});
  }
  assert.equal(errors.length,0,errors.join('\n'));
  // Deterministic before/after comparison across ten generations.
  async function simulate(source) {
    const p = await context.newPage();
    await p.route('**/script.js', route=>route.fulfill({contentType:'text/javascript',body:source}));
    await p.addInitScript(()=>{let seed=123456; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296); const timeout=window.setTimeout.bind(window); window.setTimeout=(fn,ms)=>timeout(fn,0);});
    await p.goto('file:///' + root.replaceAll('\\','/') + '/index.html');
    await p.evaluate(()=>advance(10,false));
    const result = await p.evaluate(()=>JSON.stringify({generation,population,history,lastChampion,averages:getAverages()}));
    await p.close();
    return result;
  }
  assert.equal(await simulate(current), await simulate(baseline), 'identical seeded evolution results');
  console.log(`${engine.name()}: five viewports, all tabs, controls, reset, auto stop/restart, seeded 10-generation comparison passed`);
  await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1);});
