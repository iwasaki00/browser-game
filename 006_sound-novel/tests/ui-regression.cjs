const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');

async function run(pw, executablePath) {
  const server = http.createServer(async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!['index.html', 'style.css', 'main.js', 'save.js', 'scenario.js'].includes(name)) {
      res.writeHead(404); res.end(); return;
    }
    try {
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(await fs.readFile(path.join(root, name)));
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const results = [];
  try {
    browser = await pw.chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let safeTop = 20, safeBottom = 0;
    const stylesheet = await fs.readFile(path.join(root, "style.css"), "utf8");
    await page.route("**/style.css", route => route.fulfill({contentType:"text/css", body:stylesheet.replace(/env\(safe-area-inset-top\)/g,safeTop+"px").replace(/env\(safe-area-inset-bottom\)/g,safeBottom+"px").replace(/env\(safe-area-inset-(left|right)\)/g,"0px")}));
    await page.goto(url);
    await page.clock.install();
    const key = 'ai-legacy-mvp-save';
    async function seed(id, endings = {}) {
      await page.evaluate(({key, id, endings}) => localStorage.setItem(key, JSON.stringify({currentId:id, endings, read:{}, truthUnlocked:false, volume:60})), {key,id,endings});
      await page.reload();
    }
    async function load(id) { await seed(id); await page.locator('#loadButton').click(); await page.locator('#messageArea').click(); }
    const read = () => page.evaluate(() => Object.keys(SaveStore.load().read).sort().join(','));

    for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[1280,800]]) {
      safeTop = width > 375 && width < 760 ? 44 : width < 760 ? 20 : 0;
      safeBottom = width > 375 && width < 760 ? 34 : 0;
      await page.setViewportSize({width,height});
      await seed('common_001', {A_NORMAL:true,B_NORMAL:true,C_NORMAL:true});
      const title = await page.locator('.title-inner').evaluate(el => ({client:el.clientHeight,scroll:el.scrollHeight}));
      assert(title.scroll <= title.client + 1, 'title fits with unlocked route: ' + width);
      for (const id of ['common_choice_001','route_a_choice_001']) {
        await load(id);
        const geometry = await page.evaluate(() => {
          const message = document.querySelector('#messageArea').getBoundingClientRect();
          const choices = document.querySelector('#choices').getBoundingClientRect();
          const menu = document.querySelector('#menuButton').getBoundingClientRect();
          return {message:message.toJSON(),choices:choices.toJSON(),menu:menu.toJSON(),height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollHeight};
        });
        assert(geometry.choices.bottom <= geometry.message.top, 'choices do not overlap');
        assert(geometry.choices.top >= geometry.menu.bottom, 'choices below menu');
        assert(geometry.message.bottom <= height && geometry.message.left >= 0 && geometry.message.right <= width);
        assert(geometry.scroll <= height, 'no page overflow');
        const count = await page.locator('.choice-button').count();
        for (let i=0;i<count;i++) {
          await load(id);
          const expected = await page.evaluate(({id,i})=>SCENARIO[id].choices[i].next, {id,i});
          await page.locator('.choice-button').nth(i).click();
          assert(await page.evaluate(id=>Boolean(SaveStore.load().read[id]),expected), 'choice reachable');
        }
      }
      await load('common_choice_001');
      await page.locator('#messageText').evaluate(el=>el.textContent='長文を最後まで読めることを確認。\n'.repeat(100)+'末尾');
      const scroll = await page.locator('#messageText').evaluate(el=>{el.scrollTop=el.scrollHeight; return {scroll:el.scrollHeight,client:el.clientHeight,top:el.scrollTop};});
      assert(scroll.scroll > scroll.client && scroll.top > 0, 'long text scrolls');
      await page.locator('.choice-button').evaluateAll(els=>els.forEach(el=>el.textContent='長い選択肢をスクロールして選択する。'.repeat(10)));
      await page.locator('.choice-button').last().click();
      results.push(width+'x'+height+': title, 2/3 choices, long text and long choices PASS');
    }

    await page.evaluate(key=>localStorage.removeItem(key),key); await page.reload();
    assert(await page.locator('#loadButton').isDisabled());
    for (const bad of ['{broken','null','[]','42','{}','{"currentId":"missing"}','{"currentId":"toString"}']) {
      await page.evaluate(({key,bad})=>localStorage.setItem(key,bad),{key,bad}); await page.reload();
      assert(await page.locator('#loadButton').isDisabled(),bad);
      await page.locator('#startButton').click();
      await page.locator('#messageArea').click();
      assert(await page.locator('#messageText').innerText());
    }
    await load('common_003'); await page.locator('#menuButton').click(); await page.locator('#saveButton').click();
    const saved = await page.evaluate(()=>SaveStore.load());
    assert.equal(saved.currentId,'common_003');
    assert.deepEqual(Object.keys(saved).sort(),['currentId','endings','read','truthUnlocked','volume'].sort());
    await page.locator('#backTitleButton').click(); assert(!(await page.locator('#loadButton').isDisabled()));
    await page.locator('#loadButton').click(); await page.locator('#messageArea').click();
    assert.equal(await page.locator('#messageText').innerText(),'久しぶりだね、お兄ちゃん');
    results.push('Absent/corrupt/valid saves, save/load roundtrip and unchanged schema PASS');

    for (const mode of ['auto','skip']) {
      await load('common_001'); await page.locator('#menuButton').click(); await page.locator('#'+mode+'Button').click();
      let before=await read(); await page.clock.runFor(3000); assert.equal(await read(),before);
      await page.locator('#backlogButton').click(); await page.clock.runFor(3000); assert.equal(await read(),before);
      await page.keyboard.press('Enter'); await page.keyboard.press('Space'); assert.equal(await read(),before);
      const selection=await page.locator('.backlog-text').first().evaluate(el=>getComputedStyle(el).userSelect);
      assert.equal(selection,'text');
      await page.locator('#closeBacklogButton').click(); await page.clock.runFor(mode==='skip'?120:1300); assert.notEqual(await read(),before);
      await page.locator('#menuButton').click(); await page.locator('#backTitleButton').click();
      assert.equal(await page.locator('.menu-grid button.active').count(),0);
      await page.locator('#startButton').click(); await page.locator('#messageArea').click(); before=await read(); await page.clock.runFor(3000); assert.equal(await read(),before);
    }
    await load('common_choice_001'); await page.locator('#menuButton').click(); await page.locator('#skipButton').click(); await page.locator('#closeMenuButton').click();
    let before=await read(); await page.clock.runFor(3000); assert.equal(await read(),before);
    await page.locator('.choice-button').first().click(); await page.clock.runFor(500); assert.notEqual(await read(),before);
    await page.locator('#menuButton').click(); await page.locator('#backTitleButton').click();
    const endingId=await page.evaluate(()=>Object.keys(SCENARIO).find(id=>SCENARIO[id].ending));
    await load('common_001'); await page.locator('#menuButton').click(); await page.locator('#autoButton').click(); await page.locator('#skipButton').click();
    await page.evaluate(id=>SaveStore.saveCurrent(id),endingId); await page.locator('#menuLoadButton').click();
    assert(await page.locator('#endingScreen').isVisible()); assert.equal(await page.locator('.menu-grid button.active').count(),0);
    before=await read(); await page.clock.runFor(3000); assert.equal(await read(),before);
    results.push('Auto/skip pause, backlog pause, resume, choices, title reset and ending stop PASS');

    await load('common_001'); await page.locator('#menuButton').click();
    await page.locator('#autoButton').focus(); await page.keyboard.press('Enter'); assert(await page.locator('#autoButton').evaluate(el=>el.classList.contains('active')));
    before=await read(); await page.keyboard.press('Space'); assert.equal(await read(),before);
    // Audio is disabled in production; enable only in this test to cover future range controls.
    assert(await page.locator('#volumeInput').isDisabled());
    await page.locator('#volumeInput').evaluate(el=>el.disabled=false); await page.locator('#volumeInput').focus();
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#volumeInput').inputValue(),'61');
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); assert.equal(await read(),before);
    await page.locator('#closeMenuButton').focus(); await page.keyboard.press('Enter');
    assert(await page.locator('#menuOverlay').isHidden()); assert.equal(await read(),before);
    await page.locator('#messageArea').evaluate(el=>{el.tabIndex=0;el.focus();});
    await page.keyboard.press('Enter'); assert.equal(await read(),'common_001,common_002');
    const zoom=await page.locator('meta[name="viewport"]').getAttribute('content'); assert(!/user-scalable=no|maximum-scale=1/.test(zoom));
    assert.equal(await page.locator('.app').evaluate(el=>getComputedStyle(el).touchAction),'manipulation');
    assert.equal(await page.locator('#messageArea').evaluate(el=>getComputedStyle(el).userSelect),'none');
    assert(await page.evaluate(()=>!SaveStore.isTruthUnlocked({A_NORMAL:true,B_NORMAL:true}) && SaveStore.isTruthUnlocked({A_NORMAL:true,B_NORMAL:true,C_NORMAL:true})));
    results.push('Native keyboard buttons/range, single progression, touch CSS, zoom and A/B/C unlock PASS');
    assert.deepEqual(errors,[]);
    return results;
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
}
module.exports = {run};
if (require.main === module) {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  run(pw,process.env.CHROMIUM_EXECUTABLE_PATH).then(results=>console.log(results.join('\n'))).catch(error=>{console.error(error);process.exitCode=1;});
}
