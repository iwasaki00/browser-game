/* Scoped browser checks. Run with Playwright installed: node tests/naval.spec.cjs.
   Firebase is simulated; this script never contacts the production database. */
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
let rooms = {}, version = 0, failNext = false, delay = 0;
const pages = [];
const server = http.createServer((req,res) => {
  const name = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
  const target = path.resolve(root,name);
  if (!target.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
  fs.readFile(target,(error,data) => {if(error){res.writeHead(404).end();return;} res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(data);});
});
function fakeFirebase() {
  const listeners = new Map();
  const snap = data => ({val:()=>data,exists:()=>data != null});
  window.deliver = (key,value) => (listeners.get(key)||[]).forEach(fn => fn(snap(value)));
  const db = {ref(key) {return {
    async get(){return snap((await rpc('get',key)).value);},
    async set(value){await rpc('set',key,value);},
    async update(value){await rpc('update',key,value);},
    async remove(){await rpc('set',key,null);},
    on(event,fn){listeners.set(key,[...(listeners.get(key)||[]),fn]); this.get().then(fn);return fn;},
    off(event,fn){listeners.set(key,(listeners.get(key)||[]).filter(item=>item!==fn));},
    async transaction(fn,unused,applyLocally){
      for(let retry=0;retry<8;retry++) {
        const current = await rpc('get',key); const next = fn(current.value);
        if(next===undefined)return {committed:false,snapshot:snap(current.value)};
        const result = await rpc('cas',key,next,current.version);
        if(result.ok)return {committed:true,snapshot:snap(result.value)};
      }
      throw Error('transaction retry limit');
    }
  };}};
  window.firebase={apps:[{}],app:()=>({}),database:()=>db};
}
async function notify(key){await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(([key,value])=>window.deliver?.(key,value),[key,clone(rooms[key])]).catch(()=>{})));}
async function makePage(browser,viewport){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<821,isMobile:viewport.width<821});
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>{console.error('PAGE ERROR',e);process.exitCode=1;});
  await page.exposeFunction('rpc',async(op,key,value,expectedVersion)=>{
    if(key==='.info/connected')return {value:true,version};
    if(op==='get')return {value:clone(rooms[key]??(key==='rooms/navalBattle'?{}:null)),version};
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    if(failNext){failNext=false;throw Error('simulated network failure');}
    if(op==='cas'&&expectedVersion!==version)return {ok:false};
    if(op==='update'){
      const room=rooms[key]||{};
      for(const [field,val]of Object.entries(value)){const parts=field.split('/');let target=room;for(const part of parts.slice(0,-1))target=target[part]??={};target[parts.at(-1)]=val;}
      rooms[key]=room;
    }else rooms[key]=clone(value);
    version++; await notify(key); return {ok:true,value:clone(rooms[key])};
  });
  await page.addInitScript(fakeFirebase);
  await page.goto(base);
  return page;
}
async function idle(page){await page.waitForFunction(()=>!onlineState.syncing);}
async function cpuStart(page){await page.evaluate(()=>{startCpuMode();randomPlaceFleet();startGame();});}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  global.base=`http://127.0.0.1:${server.address().port}/`;
  const options={headless:true,timeout:20000};if(process.env.CHROMIUM_PATH)options.executablePath=process.env.CHROMIUM_PATH;
  const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
  if(process.env.BROWSER_ENGINE==='webkit')options.executablePath=process.env.WEBKIT_PATH;
  const browser=await engine.launch(options);
  try {
    const page=await makePage(browser,{width:390,height:844});
    await page.evaluate(()=>{startCpuMode();startGame();});
    assert.equal(await page.evaluate(()=>gameState.phase),'setup','incomplete fleet cannot start');
    await page.evaluate(()=>{placePlayerShip(0,0);placePlayerShip(0,0);gameState.placementDirection='vertical';placePlayerShip(5,0);});
    assert.equal(await page.evaluate(()=>gameState.player.ships.length),2,'manual placement, overlap and direction');
    await cpuStart(page);
    const old=await page.evaluate(()=>{playerAttack(0,0);const callbackGeneration=gameGeneration;restartGame();randomPlaceFleet();startGame();playerAttack(1,1);cpuTurn(callbackGeneration);return {count:gameState.player.board.flat().filter(c=>c.attacked).length,delay:620};});
    assert.equal(old.count,0,'stale generation cannot attack a new cpuTurn');
    await page.waitForFunction(()=>gameState.phase==='playerTurn');
    assert.ok(await page.evaluate(()=>gameState.player.board.flat().some(c=>c.attacked)),'current CPU timer runs');
    await page.evaluate(()=>{playerAttack(2,2);restartGame();});
    await page.waitForTimeout(680);
    assert.equal(await page.evaluate(()=>gameState.player.board.flat().filter(c=>c.attacked).length),0,'restart cancels timer');
    await cpuStart(page);
    assert.equal(await page.evaluate(()=>{gameState.cpu.board[0][0].attacked=true;const before=gameState.player.cards.single;playerAttack(0,0);return before-gameState.player.cards.single;}),0,'attacked range consumes no card');
    assert.equal(await page.evaluate(()=>{const before=gameState.player.cards.single;playerAttack(1,0);playerAttack(2,0);return before-gameState.player.cards.single;}),1,'double attack consumes once');
    await page.evaluate(()=>{initFirebase();attachOnlineRoom('missing','host');});
    await page.waitForTimeout(680);
    assert.equal(await page.evaluate(()=>gameState.phase),'menu','mode switch/removed host returns to menu');
    console.log('PASS CPU timers, duplicate attacks, attacked targets and placement');
    for(const [width,height]of [[320,568],[375,667],[390,844],[430,932],[1280,900]]){
      await page.setViewportSize({width,height});await cpuStart(page);
      const metrics=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};const board=rect('enemyBoard');const cols=[...document.querySelectorAll('.enemy-panel .cols span')];const cells=[...document.querySelectorAll('#enemyBoard .cell')];return {width:innerWidth,scroll:document.documentElement.scrollWidth,command:rect('commandPanel'),cards:rect('cards'),own:rect('playerBoard'),log:rect('logPanel'),enemy:board,app:rect('app'),coordinateError:Math.max(...cols.map((el,i)=>{const a=el.getBoundingClientRect(),b=cells[i].getBoundingClientRect();return Math.abs((a.x+a.width/2)-(b.x+b.width/2));})),columns:getComputedStyle(document.getElementById('boards')).gridTemplateColumns};});
      assert.ok(metrics.scroll<=width,`no horizontal overflow ${width}: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.coordinateError<1,`coordinate alignment ${width}`);
      if(width<821){assert.ok(metrics.cards.bottom<=height,`cards visible ${width}`);assert.ok(metrics.app.bottom<=height+2,`one screen ${width}: ${JSON.stringify(metrics)}`);assert.ok(metrics.enemy.w>metrics.own.w,'enemy larger');}
      else assert.notEqual(metrics.columns,'none','desktop keeps grid');
      if(process.env.NAVAL_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NAVAL_SCREENSHOT_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.NAVAL_SCREENSHOT_DIR,`layout-${width}.png`),fullPage:true});
      }
      if(width===320){await page.locator('#enemyBoard .cell').last().click();assert.equal(await page.evaluate(()=>gameState.cpu.board[9][9].attacked),true,'last row accessible through internal scroll');}
      await page.evaluate(()=>{restartGame();});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'setup has no horizontal overflow');
      console.log('PASS layout',width,height,JSON.stringify(metrics));
    }
    const host=await makePage(browser,{width:390,height:844});const guest=await makePage(browser,{width:390,height:844});
    await host.evaluate(()=>createOnlineRoom());await idle(host);
    const roomId=await host.evaluate(()=>onlineState.roomId);const key=`rooms/navalBattle/${roomId}`;
    await guest.evaluate(id=>joinOnlineRoom(id),roomId);await idle(guest);await idle(host);
    await Promise.all([host.evaluate(()=>setPlayerReady()),guest.evaluate(()=>setPlayerReady())]);await idle(host);await idle(guest);
    assert.equal(rooms[key].status,'playing');assert.equal(rooms[key].currentTurn,'host');
    for(const [width,height]of [[320,568],[375,667],[390,844],[430,932]]) {
      await host.setViewportSize({width,height});
      const fit=await host.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.getElementById('onlinePanel').getBoundingClientRect().bottom}));
      assert.ok(fit.w<=width && fit.h<=height+2, 'online one screen '+width+': '+JSON.stringify(fit));
    }
    console.log('PASS online battle layout at all four sizes');
    delay=80;
    await host.evaluate(()=>{onlinePlayerAttack(0,0);onlinePlayerAttack(1,0);});await idle(host);delay=0;
    assert.equal(rooms[key].players.host.cards.single,98,'online double tap consumes once');assert.equal(rooms[key].players.host.attacks.length,1);
    failNext=true;await guest.evaluate(()=>onlinePlayerAttack(0,0));await idle(guest);
    assert.equal(await guest.evaluate(()=>gameState.player.cards.single),99,'failed attack rolls back card');
    assert.match(await guest.locator('#messageText').innerText(),/同期に失敗/);
    await guest.evaluate(()=>onlinePlayerAttack(0,0));await idle(guest);
    assert.equal(rooms[key].players.guest.cards.single,98,'retry succeeds once');
    await host.evaluate(()=>{onlineState.connected=false;onlinePlayerAttack(2,0);render();});
    assert.equal(rooms[key].players.host.attacks.length,1,'disconnected attack blocked');
    await host.evaluate(()=>{onlineState.connected=true;});
    delay=80;await Promise.all([host.evaluate(()=>prepareOnlineRematch()),guest.evaluate(()=>prepareOnlineRematch())]);await idle(host);await idle(guest);delay=0;
    assert.equal(rooms[key].status,'setup');assert.equal(rooms[key].players.host.ready,false);assert.equal(rooms[key].players.host.cards.single,99);
    const resetVersion=version;await host.evaluate(()=>prepareOnlineRematch());await idle(host);assert.equal(version,resetVersion,'repeat rematch does not reset placement');
    for(const type of ['missing','reject','success']){
      await host.evaluate(async type=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:type==='missing'?undefined:{writeText:()=>type==='reject'?Promise.reject(Error('denied')):Promise.resolve()}});await copyRoomId();},type);
      assert.match(await host.locator('#onlineMessage').innerText(),type==='success'?/コピーしました/:/手動コピー/);
    }
    await guest.evaluate(()=>leaveRoom(true));await host.waitForFunction(()=>!onlineState.roomData.guestId);
    assert.match(await host.locator('#onlineMessage').innerText(),/退出/);
    await guest.evaluate(id=>joinOnlineRoom(id),roomId);await idle(guest);await host.evaluate(()=>leaveRoom(true));await guest.waitForFunction(()=>gameState.phase==='menu');
    assert.match(await guest.locator('#modeMessage').innerText(),/ホストが退出/);
    // A pending old-room write must not render into a newly selected CPU game.
    await host.evaluate(()=>createOnlineRoom());await idle(host);
    const anotherRoom=await host.evaluate(()=>onlineState.roomId);
    await guest.evaluate(id=>joinOnlineRoom(id),anotherRoom);await idle(guest);
    await Promise.all([host.evaluate(()=>setPlayerReady()),guest.evaluate(()=>setPlayerReady())]);await idle(host);await idle(guest);
    delay=80;await host.evaluate(()=>{onlinePlayerAttack(0,0);leaveRoom(true);startCpuMode();});
    await host.waitForTimeout(220);delay=0;
    assert.equal(await host.evaluate(()=>gameState.mode),'cpu');assert.equal(await host.evaluate(()=>gameState.phase),'setup');
    console.log('PASS simulated room creation/join/ready/start, duplicate attack, failure rollback/retry, disconnect, simultaneous rematch, clipboard and departures');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
