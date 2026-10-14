const fs=require('fs'); const path=require('path'); const http=require('http'); const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root=path.resolve(__dirname,'..'); const out=process.env.TEST_OUTPUT_DIR || path.join(require('os').tmpdir(),'frontier-below-mobile-results'); fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(root+'/script.js','utf8');
const instrument=source.replace('  requestAnimationFrame(frame);\n})();',`  window.__game = { get state() { return state; }, update, updatePlayer, updateMining, updateCamera, draw, renderHotbar, renderRecipes, resizeCanvas, setPointerFromEvent, clearInputs, getBlock, setBlock, saveGame };
  draw();
  requestAnimationFrame(frame);
})();`);
const server=http.createServer((req,res)=>{ const file=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1); if(!['index.html','script.js','style.css'].includes(file)){res.writeHead(404).end();return;} res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'); res.end(file==='script.js'?instrument:fs.readFileSync(root+'/'+file)); });
const results=[]; const pass=(name)=>{results.push(name); console.log('PASS '+name)};
(async()=>{ await new Promise(r=>server.listen(0,'127.0.0.1',r)); const url='http://127.0.0.1:'+server.address().port;
for(const [engine,type] of [['Chromium',chromium]]){
 const browser=await type.launch({headless:true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})});
 try {
 const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for(const [w,h] of [[320,568],[375,667],[390,844],[430,932],[844,390]]){
  await page.setViewportSize({width:w,height:h}); await page.goto(url);
  if (await page.locator('#startButton').isVisible()) await page.locator('#startButton').click();
  const layout=await page.evaluate(()=>{
   const selectors=['.health-panel','.world-status','#pauseButton','.message','.rotate-tip','#leftButton','#rightButton','#jumpButton','#mineButton','#placeButton','#attackButton','#craftButton','#hotbar'];
   const rects=selectors.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {s,x:r.x,y:r.y,w:r.width,h:r.height};}).filter(r=>r.w&&r.h);
   const problems=[]; for(const r of rects){if(r.x<-.5||r.y<-.5||r.x+r.w>innerWidth+.5||r.y+r.h>innerHeight+.5)problems.push('outside '+r.s);if(r.s.endsWith('Button')&&(r.w<44||r.h<44))problems.push('small '+r.s);}
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)problems.push('overlap '+a.s+' '+b.s);}
   return {rects,problems,canvas:{w:gameCanvas.clientWidth,h:gameCanvas.clientHeight},touch:getComputedStyle(gameCanvas).touchAction};
  });
  assert.deepEqual(layout.problems,[],engine+' '+w+'x'+h+JSON.stringify(layout)); assert.equal(layout.touch,'none');
  await page.locator('#craftButton').click();
  await page.locator('.recipe-button').last().scrollIntoViewIfNeeded(); await page.locator('#closeCraftButton').scrollIntoViewIfNeeded(); await page.locator('#closeCraftButton').click();
  await page.locator('#pauseButton').click(); await page.locator('#resetButton').scrollIntoViewIfNeeded(); await page.locator('#resumeButton').click();
  if(w===320||w===844) await page.screenshot({path:out+'/'+engine+'-'+w+'x'+h+'.png'});
  await page.evaluate(()=>localStorage.clear());
  pass(engine+' '+w+'x'+h+' layout, 44px controls, craft/pause scroll');
 }
 assert.deepEqual(errors,[]); pass(engine+' no runtime errors');
 // Simulate notch/home-indicator inset values in CSS (not a hardware Safari test).
 for(const [w,h,insets] of [[320,568,{top:20,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:44,right:44}]]) {
  await page.setViewportSize({width:w,height:h});await page.goto(url);if(await page.locator('#startButton').isVisible())await page.locator('#startButton').click();
  const css=fs.readFileSync(root+'/style.css','utf8').replace(/env\(safe-area-inset-(top|bottom|left|right)\)/g,(_,side)=>insets[side]+'px');await page.addStyleTag({content:css});
  const safe=await page.evaluate(({insets})=>{
   const selectors=['.hud','.message','.move-controls','.action-controls','#hotbar'];
   const rects=selectors.map(s=>document.querySelector(s).getBoundingClientRect());
   return rects.every(r=>r.left>=insets.left&&r.right<=innerWidth-insets.right&&r.top>=insets.top&&r.bottom<=innerHeight-insets.bottom)&&rects[2].bottom<rects[4].top&&rects[3].bottom<rects[4].top;
  },{insets});assert(safe);pass('Chromium '+w+'x'+h+' simulated Safe Area');
 }
 await context.close();
 // Freeze simulation for deterministic input and persistence checks, with test hooks served only by this server.
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
 await ctx.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 const p=await ctx.newPage(); await p.goto(url); await p.locator('#startButton').click();
 assert(await p.evaluate(()=>!!window.__game));
 const ev=async(code)=>p.evaluate(code);
 await ev(()=>{const s=__game.state; s.input.jumpQueued=false;});
 await p.keyboard.down('a'); await p.keyboard.down('ArrowLeft'); await p.keyboard.up('a'); assert(await ev(()=>__game.state.input.left)); await p.keyboard.up('ArrowLeft'); assert(!await ev(()=>__game.state.input.left));
 await p.keyboard.press('Space'); assert(await ev(()=>__game.state.input.jumpQueued));
 await ev(()=>{const s=__game.state;s.player.grounded=true;s.player.vy=0;__game.updatePlayer(.01);}); assert(await ev(()=>__game.state.player.vy<0));
 pass(engine+' PC movement aliases and jump');
 // Coordinate scaling: use actual rendered box, camera, and CSS scaling.
 await ev(()=>{const s=__game.state;gameCanvas.style.width='422px';gameCanvas.style.height='195px';__game.setPointerFromEvent({clientX:120,clientY:60});const expectedX=Math.floor((240+s.camera.x)/24), expectedY=Math.floor((120+s.camera.y)/24);if(s.pointer.tileX!==expectedX||s.pointer.tileY!==expectedY)throw Error('coordinate mismatch');gameCanvas.style.width='';gameCanvas.style.height='';}); pass(engine+' CSS-to-world coordinate mapping');
 await ev(()=>{const s=__game.state;const x=Math.floor(s.player.x/24)+2,y=Math.floor(s.player.y/24);s.pointer.tileX=x;s.pointer.tileY=y;__game.setBlock(x,y,0);s.selected='dirt';s.inventory.dirt=12;});
 await p.keyboard.press('e'); assert.equal(await ev(()=>__game.state.inventory.dirt),11); await ev(()=>{const s=__game.state;if(__game.getBlock(s.pointer.tileX,s.pointer.tileY)!==2)throw Error('place failed');s.mine.held=true;__game.updateMining(.6);s.mine.held=false;}); assert.equal(await ev(()=>__game.state.inventory.dirt),12); pass(engine+' keyboard placement and mining');
 await ev(()=>{const s=__game.state; s.player.attackCooldown=0; s.pointer.tileX=Math.floor(s.player.x/24)+1; s.slimes=[{x:s.player.x+24,y:s.player.y,w:22,h:18,hp:4,vx:0,vy:0}];}); await p.keyboard.press('f'); assert.equal(await ev(()=>__game.state.slimes[0].hp),3); pass(engine+' PC attack');
 await ev(()=>{__game.state.inventory.wood=10;}); await p.locator('#craftButton').click(); await p.locator('[data-recipe="bench"]').click(); assert.equal(await ev(()=>__game.state.inventory.wood),5); assert.equal(await ev(()=>__game.state.inventory.bench),1); await p.locator('#closeCraftButton').click(); pass(engine+' craft materials/effect preserved');
 await p.locator('#pauseButton').click(); await p.locator('#saveButton').click();
 const saved=await ev(()=>localStorage.getItem('frontierBelow:v1')); assert(saved); await p.reload();
 assert.equal(await ev(()=>JSON.stringify(Array.from(__game.state.map))),JSON.stringify(JSON.parse(saved).map)); assert.equal(await ev(()=>__game.state.inventory.bench),1);
 assert.deepEqual(Object.keys(JSON.parse(saved)).sort(),['map','surface','openedChests','player','spawn','hp','inventory','tools','selected','timeOfDay','introSeen'].sort()); pass(engine+' save/reload and existing schema');
 await p.locator('#pauseButton').click(); p.once('dialog',d=>d.dismiss()); await p.locator('#resetButton').click(); assert.equal(await ev(()=>localStorage.getItem('frontierBelow:v1')),saved); assert.equal(await ev(()=>__game.state.inventory.bench),1); pass(engine+' reset cancel leaves world/save unchanged');
 p.once('dialog',d=>d.accept()); await p.locator('#resetButton').click(); assert.equal(await ev(()=>localStorage.getItem('frontierBelow:v1')),null); assert(await p.locator('#startModal').evaluate(e=>e.classList.contains('show'))); assert.equal(await ev(()=>__game.state.inventory.bench),0); await p.locator('#startButton').click(); pass(engine+' confirmed reset uses new world');
 await p.keyboard.down('d'); await ev(()=>window.dispatchEvent(new Event('blur'))); assert(await ev(()=>__game.state.paused&&!__game.state.input.right)); await p.keyboard.up('d'); await p.locator('#resumeButton').click(); assert(!await ev(()=>__game.state.paused)); pass(engine+' blur clears input, pauses and resumes');
 await p.keyboard.down('a');await ev(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert(await ev(()=>__game.state.paused&&!__game.state.input.left));await p.keyboard.up('a');await ev(()=>{delete document.hidden;});await p.locator('#resumeButton').click();pass('Chromium visibilitychange input clear and resume');
 if(engine==='Chromium'){
  const cdp=await ctx.newCDPSession(p);
  const point=async(selector,id)=>{const b=await p.locator(selector).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id};};
  const left=await point('#leftButton',1), mine=await point('#mineButton',2), left2={...left,x:left.x+5,id:3};
  let active=[];
  const touch=async(type,points)=>{ const sendPoints=type==='touchEnd'&&points.length?active.filter(a=>!points.some(b=>a.id===b.id)):points; await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:sendPoints});active=type==='touchCancel'?[]:points; };
  await touch('touchStart',[left]);await touch('touchStart',[left,mine]);assert(await ev(()=>__game.state.input.left&&__game.state.mine.held));pass('Chromium real multitouch: movement + mining');
  await touch('touchStart',[left,mine,left2]);await touch('touchEnd',[mine,left2]);assert(await ev(()=>__game.state.input.left&&__game.state.mine.held));await touch('touchEnd',[mine]);assert(await ev(()=>!__game.state.input.left&&__game.state.mine.held));await touch('touchEnd',[]);assert(await ev(()=>!__game.state.mine.held));pass('Chromium duplicate fingers release independently');
  await touch('touchStart',[left,mine]);await touch('touchCancel',[]);assert(await ev(()=>!__game.state.input.left&&!__game.state.mine.held));pass('Chromium pointercancel clears controls');
  // Inject lost-capture events with IDs obtained from real touch pointers.
  await ev(()=>{window.__ids={};for(const id of ['leftButton','mineButton','gameCanvas'])document.getElementById(id).addEventListener('pointerdown',e=>__ids[id]=e.pointerId);});
  await touch('touchStart',[left,mine]);await touch('touchMove',[{...left,x:left.x+20},{...mine,x:mine.x+20}]);await ev(()=>{for(const id of ['leftButton','mineButton'])document.getElementById(id).dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:__ids[id]}));});await touch('touchMove',[{...left,x:left.x+25},{...mine,x:mine.x+25}]);assert(await ev(()=>!__game.state.input.left&&!__game.state.mine.held));await touch('touchEnd',[]);pass('Chromium injected lostpointercapture clears controls');
  const aim={x:400,y:180,id:4},other={x:440,y:180,id:5};
  await touch('touchStart',[aim]);await p.waitForTimeout(400);assert(await ev(()=>__game.state.longPressMining));await touch('touchStart',[aim,other]);await touch('touchEnd',[aim]);assert(await ev(()=>__game.state.longPressMining));await touch('touchEnd',[]);assert(!await ev(()=>__game.state.longPressMining));pass('Chromium canvas pointer ownership and release');
  await touch('touchStart',[aim]);await touch('touchEnd',[]);await p.waitForTimeout(400);assert(!await ev(()=>__game.state.longPressMining));pass('Chromium released canvas timer cannot start mining');
  await touch('touchStart',[aim]);await p.waitForTimeout(400);await touch('touchCancel',[]);assert(!await ev(()=>__game.state.longPressMining));pass('Chromium canvas cancel stops mining');
  await touch('touchStart',[aim]);await touch('touchMove',[{...aim,x:420}]);await p.waitForTimeout(400);await ev(()=>gameCanvas.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:__ids.gameCanvas})));await touch('touchMove',[{...aim,x:430}]);assert(!await ev(()=>__game.state.longPressMining));await touch('touchEnd',[]);pass('Chromium injected canvas lost capture stops mining');
  await touch('touchStart',[left,mine]);await ev(()=>window.dispatchEvent(new Event('blur')));await touch('touchEnd',[]);assert(await ev(()=>__game.state.paused&&!__game.state.input.left&&!__game.state.mine.held));await p.locator('#resumeButton').click();pass('Chromium background clears simultaneous touch holds');
  const jump=await point('#jumpButton',7);await touch('touchStart',[jump]);assert(await ev(()=>__game.state.input.jumpQueued));await touch('touchEnd',[]);pass('Chromium touch jump');
  await touch('touchStart',[left,mine]);await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>!__game.state.input.left&&!__game.state.mine.held);assert(await ev(()=>!__game.state.input.left&&!__game.state.mine.held));await touch('touchEnd',[]);await p.setViewportSize({width:844,height:390});pass('Chromium orientation resize clears held input');
  await p.locator('#craftButton').click();const card=await p.locator('.craft-card').boundingBox();await touch('touchStart',[{x:card.x+card.width/2,y:card.y+card.height-30,id:8}]);await touch('touchMove',[{x:card.x+card.width/2,y:card.y+70,id:8}]);await touch('touchEnd',[]);assert(await p.locator('.craft-card').evaluate(e=>e.scrollTop>0));await p.locator('#closeCraftButton').scrollIntoViewIfNeeded();await p.locator('#closeCraftButton').click();pass('Chromium native craft menu vertical swipe');
  // Native hotbar touch scroll remains active.
  const hb=await p.locator('#hotbar').boundingBox();await touch('touchStart',[{x:hb.x+hb.width-30,y:hb.y+30,id:9}]);await touch('touchMove',[{x:hb.x+100,y:hb.y+30,id:9}]);await touch('touchEnd',[]);assert(await p.locator('#hotbar').evaluate(e=>e.scrollLeft>0));pass('Chromium native hotbar swipe');
 }
 await ctx.close();
 } finally { await browser.close(); }
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());

