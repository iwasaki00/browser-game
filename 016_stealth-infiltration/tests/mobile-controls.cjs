// Run with Playwright installed: node tests/mobile-controls.cjs
// Or set PLAYWRIGHT_MODULE to an existing Playwright installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const sizes = [[320,568], [375,667], [390,844], [430,932], [844,390]];
const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const before = execFileSync('git', ['show', 'HEAD:016_stealth-infiltration/main.js'], {cwd:root, encoding:'utf8'});
function functionSource(s, name) {
  const from = s.indexOf(`function ${name}(`);
  const to = s.indexOf('\nfunction ', from + 1);
  return s.slice(from, to < 0 ? undefined : to).trim();
}
for (const name of ['createGuard','tileAt','setTile','isBlockingTile','blocksVision','canMoveTo','canGuardMoveTo','isTileWalkable','updateGuards','updateGuardPatrol','updateGuardSuspicious','updateGuardChase','updateGuardSearch','moveGuardToward','findNextPathPoint','tileKey','rotateGuardLook','updateCameras','updateLasers','interact','openAllSecurityDoors','nearbyTiles','clearStage','canSee','rayBlocked','guardVisionColor']) {
  assert.ok(before.includes(`function ${name}(`), name);
  assert.equal(functionSource(source,name), functionSource(before,name), `${name} unchanged`);
}
assert.equal(source.slice(0,source.indexOf('const canvas =')),before.slice(0,before.indexOf('const canvas =')), 'stages, placements, sprites and constants unchanged');
assert.equal(functionSource(source,'updatePlayer').replace('syncCrouchButton();','crouchButton.classList.toggle("is-active", player.crouch);'),functionSource(before,'updatePlayer').replace('syncCrouchButton();','crouchButton.classList.toggle("is-active", player.crouch);'),'movement, crouching and interaction decisions unchanged');
const server = http.createServer((req,res) => {
  const filename = new URL(req.url,'http://localhost').pathname;
  const file = path.join(root, filename === '/' ? 'index.html' : filename);
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8'); res.end(fs.readFileSync(file)); }
  catch {res.statusCode=404;res.end();}
});
(async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [engineName,engine] of Object.entries({chromium,webkit})) {
    const browser = await engine.launch({headless:true});
    try {
      const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{ window.requestAnimationFrame = cb => { window.__frame = cb; return 1; }; });
      await page.goto(url); await page.bringToFront();
      assert.equal(await page.locator('#debugButton').isVisible(),false);
      assert.equal(await page.locator('.panel a').count(),0);
      assert.ok(await page.evaluate(()=> {
        const viewport=document.querySelector('meta[name="viewport"]').content;
        return !/maximum-scale|minimum-scale|user-scalable/.test(viewport)
          && getComputedStyle(document.body).touchAction==='auto'
          && getComputedStyle(document.querySelector('.panel')).touchAction.includes('pinch-zoom')
          && getComputedStyle(stick).touchAction==='none'
          && (getComputedStyle(document.body).userSelect || getComputedStyle(document.body).webkitUserSelect)==='none';
      }), 'zoom and selection policy');
      for (const [width,height] of sizes) {
        await page.setViewportSize({width,height});
        const result=await page.evaluate(() => {
          startStage(0); player.hasKey=player.hasData=true; player.crouch=true; syncCrouchButton(); updateHud();
          if(crouchButton.scrollWidth>crouchButton.clientWidth)throw Error("crouch label overflow");
          const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const hud=rect('#hud'),stickRect=rect('#stick'),actions=rect('.actions');
          const rows=[...document.querySelectorAll('#hud span, #hud meter')].map(el=>({right:el.getBoundingClientRect().right,left:el.getBoundingClientRect().left}));
          const panels=[];
          for(const kind of [GameState.TITLE,GameState.STAGE_CLEAR,GameState.GAME_OVER,GameState.ALL_CLEAR]) {
            showOverlay(kind,'敵の視界を避け、端末やカードキーを使って重要データを回収し、脱出口へ向かえ。','RESTART');
            const p=document.querySelector('.panel');p.scrollTop=p.scrollHeight;
            panels.push({panel:rect('.panel'),button:rect('#startButton'),overflow:p.scrollWidth>p.clientWidth});
          }
          showOverlay(GameState.TITLE, '長い説明。'.repeat(250), 'START');
          const p=document.querySelector('.panel');p.scrollTop=p.scrollHeight;
          const scrollable=p.scrollHeight>p.clientHeight && p.getBoundingClientRect().bottom<=innerHeight && startButton.getBoundingClientRect().bottom<=p.getBoundingClientRect().bottom;
          return {hud,stickRect,actions,rows,panels,scrollable,docWidth:document.documentElement.scrollWidth,canvas:rect('canvas'),width:innerWidth,height:innerHeight};
        });
        assert.equal(result.docWidth,width,`${engineName} ${width}: horizontal overflow`);
        assert.ok(Math.abs(result.canvas.height-height)<0.1);
        assert.ok(result.stickRect.right < result.actions.x,`${engineName} ${width}: controls overlap`);
        for(const r of [result.hud,result.stickRect,result.actions]) assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height);
        for(const r of result.rows) assert.ok(r.left>=result.hud.x&&r.right<=result.hud.right,`${engineName} ${width}: HUD overflow`);
        for(const {panel,button,overflow} of result.panels) assert.ok(panel.y>=0&&panel.bottom<=height&&button.bottom<=panel.bottom&&button.right<=panel.right&&!overflow,`${engineName} ${width}: overlay overflow`);
        assert.ok(result.scrollable,`${engineName} ${width}: long overlay must scroll`);
        console.log(`${engineName} layout ${width}x${height}: PASS`);
      }
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{startStage(0);resumeInput();});
      // Real browser capture: release outside the stick/button must neutralize input.
      for(const selector of ['#stick','#actionButton']) {
        const r=await page.locator(selector).boundingBox();
        await page.mouse.move(r.x+r.width*.75,r.y+r.height/2);await page.mouse.down();
        assert.ok(await page.evaluate(s=>s==='#stick'?input.x>0:input.action,selector));
        await page.mouse.move(200,150);await page.mouse.up();
        assert.ok(await page.evaluate(()=>input.x===0&&input.y===0&&!input.action));
      }
      if (engineName === 'chromium') {
        await page.evaluate(()=>startStage(0));
        const cdp=await context.newCDPSession(page);
        const sr=await page.locator('#stick').boundingBox(), ar=await page.locator('#actionButton').boundingBox(), cr=await page.locator('#crouchButton').boundingBox();
        const a={id:1,x:sr.x+sr.width*.8,y:sr.y+sr.height/2}, b={id:2,x:sr.x+sr.width*.2,y:a.y}, c={id:3,x:ar.x+ar.width/2,y:ar.y+ar.height/2}, d={id:4,x:cr.x+cr.width/2,y:cr.y+cr.height/2};
        const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
        await touch('touchStart',[a]);const original=await page.evaluate(()=>input.x);assert.ok(original>0);
        await touch('touchStart',[a,b]);await touch('touchEnd',[b]);assert.equal(await page.evaluate(()=>input.x),original);
        await touch('touchStart',[a,c]);assert.ok(await page.evaluate(()=>input.action&&input.x>0));
        await touch('touchStart',[a,c,d]);await touch('touchEnd',[d]);assert.ok(await page.evaluate(()=>input.crouch&&input.action&&input.x>0),'native crouch during stick and action');
        await touch('touchEnd',[c]);assert.ok(await page.evaluate(()=>!input.action&&input.x>0));
        await touch('touchMove',[{...a,x:200,y:180}]);await touch('touchEnd',[]);assert.ok(await page.evaluate(()=>input.x===0&&input.y===0&&!input.action));
        await cdp.detach();console.log('chromium native multitouch and capture: PASS');
      }
      const inputResult=await page.evaluate(()=>{
        startStage(0); resumeInput();
        const checks=[];const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
        // Synthetic IDs isolate ordering/cancel edge cases. Real capture is tested separately.
        for(const el of [stick,actionButton]) {el.setPointerCapture=()=>{};el.hasPointerCapture=()=>true;el.releasePointerCapture=()=>{};}
        const fire=(el,type,id,x=0,y=0)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,button:0,bubbles:true,cancelable:true}));
        const r=stick.getBoundingClientRect();const x=r.left+r.width*.8,y=r.top+r.height/2;
        fire(stick,'pointerdown',1,x,y);const ix=input.x;
        fire(stick,'pointerdown',2,r.left,y);fire(stick,'pointermove',2,r.left,y);fire(stick,'pointerup',2);
        check(input.x===ix&&ix>0,'second finger cannot steal or stop stick');
        fire(actionButton,'pointerdown',3);fire(actionButton,'pointerdown',4);fire(actionButton,'pointerup',4);
        check(input.action&&input.x===ix,'action and stick independent');
        crouchButton.click();check(input.crouch&&player.crouch&&crouchButton.getAttribute('aria-pressed')==='true','crouch during move and action');
        const saved=interact;let calls=0;interact=()=>calls++;
        updatePlayer(0);updatePlayer(0);check(calls===1,'held action executes once');
        fire(actionButton,'pointerup',3);check(!input.action&&!actionButton.classList.contains('is-active')&&input.x===ix,'action release preserves stick');
        fire(stick,'pointercancel',1);check(!input.x&&!input.y&&stickKnob.style.transform==='translate(0px, 0px)','stick cancel neutral');
        fire(actionButton,'pointerdown',5);fire(actionButton,'pointerup',5);updatePlayer(0);check(calls===2&&!input.actionPressed,'quick tap executes once');
        for(const type of ['pointercancel','lostpointercapture']) {
          fire(stick,'pointerdown',6,x,y);fire(stick,type,6);check(input.x===0,'stick '+type);
          fire(actionButton,'pointerdown',7);fire(actionButton,type,7);updatePlayer(0);check(!input.action&&!input.actionPressed&&calls===2,'action '+type);
        }
        stick.setPointerCapture=()=>{throw Error('cancelled');};actionButton.setPointerCapture=stick.setPointerCapture;
        fire(stick,'pointerdown',8,x,y);fire(actionButton,'pointerdown',9);check(!input.x&&!input.action&&!input.actionPressed,'capture failure neutral');
        keys.add('KeyD');keys.add('Space');input.crouch=true;
        window.dispatchEvent(new Event('blur'));const snapshot=JSON.stringify({player,guards,cameras,messageTimer});update(10);
        check(snapshot===JSON.stringify({player,guards,cameras,messageTimer}),'blur pauses game and alert');
        check(keys.size===0&&!input.actionPressed&&!input.crouch&&!player.crouch,'blur clears input and posture');
        window.dispatchEvent(new Event('focus'));check(appActive&&lastTime===0,'focus resets clock');
        const px=player.x;window.__frame(100000);check(player.x===px&&!input.x,'resume first frame no jump');
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
        const snapshot2=JSON.stringify({player,guards,messageTimer});update(10);check(!appActive&&snapshot2===JSON.stringify({player,guards,messageTimer}),'hidden pauses');
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));check(appActive&&lastTime===0,'visible resets clock');delete document.hidden;
        keys.add('KeyD');const initialX=player.x;updatePlayer(.1);keys.clear();check(player.x>initialX,'keyboard movement');
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));updatePlayer(0);window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',repeat:true}));updatePlayer(0);check(calls===3,'Space repeat does not duplicate interaction');
        window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
        interact=saved;
        for(let i=0;i<2;i++){window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}));}debugButton.click();check(!debug,'normal startup cannot enable debug');
        for(const [s,label] of [[GuardState.PATROL,'通常巡回'],[GuardState.SUSPICIOUS,'警戒中'],[GuardState.SEARCH,'探索中'],[GuardState.CHASE,'発見・追跡中']]){guards[0].state=s;guards[0].spotted=false;updateHud();check(guardLabel.textContent===label,'guard HUD '+s);}
        return checks;
      });
      console.log(`${engineName} input: ${inputResult.length} checks PASS`);
      // Targeted integration: same interaction radius, items, locked door and exits.
      await page.evaluate(()=>{
        startStage(1);resumeInput();
        const moveTo=ch=>{for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)if(map[y][x]===ch){player.x=x*TILE+16;player.y=y*TILE+16;return [x,y];}};
        const check=(v,m)=>{if(!v)throw Error(m);};
        moveTo('d');interact();check(!player.hasKey,'locked door before key');
        moveTo('k');interact();check(player.hasKey,'key collected');moveTo('d');interact();check(!map.some(row=>row.includes('d')),'door opens');
        moveTo('a');interact();check(player.hasData,'data collected');updateHud();check(itemLabel.textContent.includes('取得済'),'item HUD');
        moveTo('t');interact();check(systemsOff&&!map.some(row=>row.includes('s')),'terminal works');
        moveTo('g');interact();check(state===GameState.STAGE_CLEAR,'stage clear');
      });
      await page.locator('#startButton').click();assert.equal(await page.evaluate(()=>stageIndex),2);
      await page.evaluate(()=>{
        player.hasData=false;
        for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)if(map[y][x]==='g'){player.x=x*TILE+16;player.y=y*TILE+16;}
        interact();if(state!==GameState.PLAYING)throw Error('exit must require data');
        player.hasData=true;interact();if(state!==GameState.ALL_CLEAR)throw Error('final exit');
      });
      await page.locator('#startButton').click();assert.equal(await page.evaluate(()=>stageIndex),0);
      await page.evaluate(()=>showOverlay(GameState.GAME_OVER,'再挑戦','RETRY'));
      await page.locator('#startButton').click();assert.equal(await page.evaluate(()=>state),'playing');
      await page.goto(url+'/?debug=1');assert.equal(await page.locator('#debugButton').isVisible(),true);
      await page.locator('#debugButton').click();assert.equal(await page.evaluate(()=>debug),true);
      await page.evaluate(()=>{debug=false;for(let i=0;i<2;i++){window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}));}});assert.equal(await page.evaluate(()=>debug),true);
      assert.deepEqual(errors,[]);
      console.log(`${engineName} progression, retry, debug: PASS`);
      await context.close();
    } finally { await browser.close(); }
  }
  console.log('Restricted gameplay source comparison: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
