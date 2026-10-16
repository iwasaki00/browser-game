const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_PATH||'C:/_wk/github/tool-lab/node_modules/playwright-core');
let runningBrowser,runningServer;
(async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return}try{const b=fs.readFileSync(p);res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)}catch{res.writeHead(404).end()}});
  runningServer=server;await new Promise(r=>server.listen(0,'127.0.0.1',r));server.unref();
  const browser=process.env.TEST_BROWSER==='webkit'?await pw.webkit.launch({headless:true,executablePath:process.env.WEBKIT_EXECUTABLE||'C:/Users/shish/AppData/Local/ms-playwright/webkit-2287/Playwright.exe'}):await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'C:/Users/shish/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
  runningBrowser=browser;
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();let errors=[],firebaseRequests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/firebase-service.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'firebase-mock.js'),'utf8')}));
  await page.route(/firebaseio|firebasedatabase|googleapis|gstatic/,r=>{firebaseRequests.push(r.request().url());return r.abort()});
  await page.addInitScript(()=>{window.__geo={count:0,clears:[],callbacks:[],errors:[]};Object.defineProperty(navigator,'geolocation',{value:{watchPosition(ok,bad){__geo.count++;__geo.callbacks.push(ok);__geo.errors.push(bad);return __geo.count},clearWatch(id){__geo.clears.push(id)}}});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('blocked')}}})});
  const url=`http://127.0.0.1:${server.address().port}`;
  try{
    await page.goto(url);await page.waitForSelector('#home.active');
    // Layout of all screens at the four requested phone sizes. Visible controls must stay within width.
    for(const [width,height]of [[320,568],[375,667],[390,844],[430,932]]){
      await page.setViewportSize({width,height});
      for(const id of ['home','profile','safety','lobby','role','game','result']){
        await page.evaluate(id=>document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id)),id);
        const overflow=await page.evaluate(()=>{const s=document.querySelector('.screen.active');return {page:document.documentElement.scrollWidth>innerWidth,screen:s.scrollWidth>s.clientWidth+1}});
        assert.deepEqual(overflow,{page:false,screen:false},`${width} ${id}`);
      }
    }
    await page.goto(url);await page.click('[data-go=create]');await page.fill('#name','テスト');assert.equal(await page.locator('#name').evaluate(x=>getComputedStyle(x).userSelect),'text');assert.equal(await page.locator('#toSafety').evaluate(x=>getComputedStyle(x).touchAction),'manipulation');await page.click('#toSafety');await page.check('#agree');
    await page.evaluate(()=>{document.querySelector('#gpsStart').click();document.querySelector('#gpsStart').click()});await page.waitForSelector('#lobby.active');
    assert.equal(await page.evaluate(()=>__geo.count),1);
    await page.click('#copyRoom');assert.equal(await page.locator('#copyFallback').isVisible(),true);assert.match(await page.inputValue('#manualRoomId'),/^\d{6}$/);
    for(const [code,text]of [[1,'権限拒否'],[2,'取得失敗'],[3,'タイムアウト']]){await page.evaluate(code=>__geo.errors.at(-1)({code}),code);assert.ok((await page.textContent('#gpsFeedback')).includes(text))}
    await page.evaluate(()=>__geo.callbacks.at(-1)({coords:{latitude:35,longitude:139,accuracy:100,speed:0},timestamp:Date.now()}));assert.ok((await page.textContent('#gpsFeedback')).includes('精度不足'));
    const id=await page.textContent('#roomCode');
    await page.evaluate(()=>__firebase.setFail(true));await page.click('#ready');await page.waitForFunction(()=>!document.querySelector('#ready').disabled);assert.ok((await page.textContent('#toast')).includes('failure'));await page.evaluate(()=>__firebase.setFail(false));
    await page.evaluate(id=>{__firebase.put(`${id}/players/bot_test`,{displayName:'CPU',role:'',isReady:true,isOnline:true});__firebase.setDelay(250);document.querySelector('#ready').click();document.querySelector('#ready').click()},id);
    await page.waitForFunction(()=>document.querySelector('#ready').textContent==='準備を取り消す');
    await page.evaluate(()=>{__firebase.setDelay(0);document.querySelector('#start').click();document.querySelector('#start').click()});await page.waitForSelector('#role.active');
    await page.click('#roleOk');await page.waitForSelector('#game.active',{timeout:20000});
    assert.equal(await page.evaluate(()=>__geo.count),1);
    const panBefore=await page.locator('.leaflet-map-pane').getAttribute('style');await page.mouse.move(190,420);await page.mouse.down();await page.mouse.move(220,460,{steps:8});await page.mouse.up();assert.notEqual(await page.locator('.leaflet-map-pane').getAttribute('style'),panBefore);
    await page.evaluate(()=>__geo.callbacks.at(-1)({coords:{latitude:35,longitude:139,accuracy:5,speed:0},timestamp:Date.now()}));
    await page.waitForFunction(id=>__firebase.db[id]?.players.test_user.position,id,{timeout:7000});
    await page.evaluate(()=>__firebase.connect(false));assert.ok((await page.textContent('#connectionStatus')).includes('切断'));
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>__geo.clears.length),1);
    await page.evaluate(()=>{__firebase.connect(true);window.dispatchEvent(new Event('pageshow'))});await page.waitForFunction(()=>__geo.count===2);
    await page.evaluate(id=>{__firebase.put(`${id}/players/bot_test`,{displayName:'CPU',role:'criminal',position:{lat:35.01,lng:139,accuracy:5,timestamp:Date.now()}});__firebase.put(`${id}/game`,{...__firebase.db[id].game,phase:'playing',headStartEndsAt:Date.now()-91000});__firebase.setDelay(1200)},id);
    await page.waitForFunction(id=>Object.keys(__firebase.db[id].witnessReports||{}).length===1,id,{timeout:7000});
    await page.waitForTimeout(1600);assert.equal(await page.evaluate(id=>Object.keys(__firebase.db[id].witnessReports||{}).length,id),1);
    await page.evaluate(id=>{__firebase.setDelay(0);__firebase.put(`${id}/game`,{...__firebase.db[id].game,phase:'finished',winnerRole:'criminal'})},id);await page.waitForSelector('#result.active');
    assert.equal(await page.evaluate(()=>__geo.clears.length),2);await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__geo.count),2);
    const before=await page.evaluate(()=>__firebase.writes.filter(w=>w.p.endsWith('/position')).length);await page.waitForTimeout(5200);assert.equal(await page.evaluate(()=>__firebase.writes.filter(w=>w.p.endsWith('/position')).length),before);
    await page.click('#rematch');await page.waitForSelector('#lobby.active');assert.equal(await page.evaluate(()=>__geo.count),3);
    await page.click('#leave');await page.waitForSelector('#home.active');assert.equal(await page.evaluate(()=>__firebase.listeners),0);
    await page.click('#localDebugStart');await page.waitForSelector('#lobby.active');await page.click('[data-debug=close]');
    await page.click('#start');await page.waitForSelector('#role.active');await page.click('#roleOk');await page.waitForSelector('#game.active');
    await page.evaluate(()=>document.querySelector('[data-debug=accuracy-100]').click());assert.ok((await page.textContent('#gpsStatus')).includes('精度不足'));
    await page.evaluate(()=>document.querySelector('[data-debug=gps-old]').click());assert.ok((await page.textContent('#gpsStatus')).includes('更新停止'));
    await page.evaluate(()=>document.querySelector('[data-debug=criminal-out]').click());
    await page.screenshot({path:path.join(__dirname,'phone-430.png'),fullPage:true});
    await page.waitForTimeout(1100);await page.evaluate(()=>document.querySelector('[data-debug=criminal-5]').click());await page.waitForSelector('#result.active',{timeout:10000});assert.ok((await page.textContent('#winner')).includes('刑事'));await page.evaluate(()=>document.querySelector('[data-debug=phase-playing]').click());await page.waitForSelector('#role.active');await page.click('#roleOk');await page.waitForSelector('#game.active');page.once('dialog',d=>d.accept());await page.evaluate(()=>document.querySelector('[data-debug=criminal-win]').click());await page.waitForSelector('#result.active');
    await page.click('#rematch');await page.waitForSelector('#lobby.active');await page.click('#leave');await page.waitForSelector('#home.active');
    const writesAfter=await page.evaluate(()=>__firebase.writes.length);await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>__firebase.writes.length),writesAfter);
    assert.equal(await page.locator('#debugPanel').isVisible(),false);
    await page.click('[data-go=join]');await page.fill('#name','再参加');await page.fill('#roomId',id);await page.click('#toSafety');await page.check('#agree');await page.click('#gpsStart');await page.waitForSelector('#lobby.active');assert.equal(await page.textContent('#roomCode'),id);await page.click('#leave');await page.waitForSelector('#home.active');
    assert.deepEqual(errors,[]);assert.deepEqual(firebaseRequests,[]);
    console.log('PASS 4 viewport sizes x 7 screens, entry/ready/start double clicks, GPS errors/poor quality, copy fallback, normal send/stop, offline, pagehide/pageshow including finished, slow atomic witness, real local capture, rematch/leave, local debug separation');
  }catch(e){console.error("UI failure",await page.evaluate(()=>({screen:document.querySelector(".screen.active")?.id,toast:document.querySelector("#toast").textContent,errors:window.__geo})),errors);throw e}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(async e=>{console.error(e);try{await runningBrowser?.close()}finally{runningServer?.closeAllConnections();runningServer?.close();process.exitCode=1}});

