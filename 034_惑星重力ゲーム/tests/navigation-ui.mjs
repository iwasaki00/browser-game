import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/navigation-ux/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const url=`http://127.0.0.1:${server.address().port}`;
const instrument=()=>{
 const p=CanvasRenderingContext2D.prototype,t=p.setTransform,a=p.arc,translate=p.translate;
 p.setTransform=function(...v){if(this.canvas.id==='gameCanvas'&&v[0]!==1)window.worldMatrix=v;return t.apply(this,v);};
 p.arc=function(x,y,r,...v){if(this.canvas.id==='gameCanvas'&&r===38)window.standardPlanet={x,y};return a.call(this,x,y,r,...v);};
 p.translate=function(x,y){if(this.canvas.id==='gameCanvas')window.rocketPoint={x,y};return translate.call(this,x,y);};
};
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(instrument);await page.clock.install();await page.goto(url);await page.clock.runFor(100);
  const board=await page.locator('#spaceFrame').boundingBox();
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  const matrix=()=>page.evaluate(()=>worldMatrix);
  const world=(x,y)=>page.evaluate(([x,y])=>{const b=document.querySelector('#gameCanvas').getBoundingClientRect(),[a,,,d,e,f]=worldMatrix;return {x:b.left+(a*x+e)/devicePixelRatio,y:b.top+(d*y+f)/devicePixelRatio};},[x,y]);
  const drag=async(from,to)=>{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();await page.clock.runFor(20);};
  const before=await matrix();await drag(await world(196,282),await world(216,292));assert.deepEqual(await matrix(),before);
  assert.ok(await page.evaluate(()=>Math.hypot(standardPlanet.x-216,standardPlanet.y-292)<.001));assert.equal(await page.locator('#selectionBar').isVisible(),true);
  await page.locator('#resetButton').click();
  const b=await page.locator('#gameCanvas').boundingBox(),empty={x:b.x+35,y:b.y+130};
  const fixed=await matrix();await drag(empty,{x:empty.x+25,y:empty.y+20});assert.notDeepEqual(await matrix(),fixed);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
  await page.locator('#fitCamera').click();await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await page.clock.runFor(500);
  assert.equal(await page.locator('#cameraZoom').textContent(),'0.10×');
  await page.screenshot({path:fileURLToPath(new URL(`overview-${width}x${height}.png`,dir))});
  await page.locator('#launchButton').click();assert.equal(await page.locator('#flightRate').inputValue(),'1');assert.equal(await page.locator('#flightSpeed').isVisible(),true);
  const speedBox=await page.locator('#flightSpeed').boundingBox(),cameraBox=await page.locator('.camera-controls').boundingBox();assert.ok(speedBox.x+speedBox.width<=cameraBox.x);
  assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
  await page.locator('#flightRate').selectOption('10');await page.clock.runFor(500);
  await page.screenshot({path:fileURLToPath(new URL(`flight-${width}x${height}.png`,dir))});await page.locator('#resetButton').click();
  if(width===375){
   const cdp=await context.newCDPSession(page),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
   // A tap under the drag threshold must preserve FOLLOW; an empty drag releases it.
   await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('follow');await page.locator('#closeMenuSettings').click();
   const a={id:1,x:60,y:220},z={id:2,x:170,y:220};await touch('touchStart',[a]);await touch('touchMove',[{...a,x:63}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'follow');
   await touch('touchStart',[a]);await touch('touchMove',[{...a,x:95,y:240}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
   const pinchBefore=await page.locator('#cameraZoom').textContent();await touch('touchStart',[a]);await touch('touchStart',[a,z]);await touch('touchMove',[{...a,x:40,y:240},{...z,x:200,y:240}]);await touch('touchEnd',[]);assert.notEqual(await page.locator('#cameraZoom').textContent(),pinchBefore);
   await page.locator('#fitCamera').click();
   const rates=[];let reference;
   for(const rate of [1,2,5,10,50,100]){
    await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption(String(rate));
    if(rate===1){
     await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('follow');await page.locator('#closeMenuSettings').click();await page.clock.runFor(100);
     await touch('touchStart',[a]);await touch('touchMove',[{...a,x:95,y:240}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
     await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('follow');await page.locator('#closeMenuSettings').click();await page.clock.runFor(100);
     assert.ok(await page.evaluate(()=>{const [a,,,d,e,f]=worldMatrix,b=document.querySelector('#gameCanvas').getBoundingClientRect();return Math.hypot((rocketPoint.x*a+e)/devicePixelRatio-b.width/2,(rocketPoint.y*d+f)/devicePixelRatio-b.height/2)<1;}));
    }
    await page.clock.runFor(19000/rate+100);
    assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');assert.equal(await page.locator('#flightSpeed').isVisible(),false);assert.equal(await page.locator('#flightRate').inputValue(),'1');
    const record=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list())[0];});
    assert.equal(record.result,'clear');if(reference)assert.deepEqual(record.frames,reference.frames);else reference=record;
    rates.push({rate,time:record.duration,frames:record.frames.length,end:record.frames.at(-1)});await page.locator('#resetButton').click();
   }
   results.push({browserRates:rates});
   // Reuse the ordinary sling gesture; empty-space panning must not consume it.
   await page.locator('#openMenuSettings').click();await page.locator('[data-launch-mode="slingshot"]').click();await page.locator('#closeMenuSettings').click();await page.clock.runFor(20);
   const rocket=await world(250,4500),pull=await world(250-Math.cos(-65*Math.PI/180)*105,4500-Math.sin(-65*Math.PI/180)*105);
   await drag(rocket,pull);assert.equal(await page.locator('#flightSpeed').isVisible(),true);await page.locator('#resetButton').click();
   // Isolated fixture only: existing HOMEWARD and CLASSIC data survive UI operations/reload.
   const saved={version:1,currentSector:'homeward-02',cleared:['homeward-01'],openingSeen:true,eventsSeen:['homeward-01:arrival'],active:false,tutorial:{'homeward-01':{status:'completed',step:2}}};
   await page.evaluate(value=>{localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify(value));localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-20":3},"live":{}}');},saved);
   const storageBefore=await page.evaluate(()=>({homeward:localStorage.getItem('orbit-maker.homeward.v1'),classic:localStorage.getItem('orbit-maker.stage-progress.v1')}));
   await page.reload();await page.clock.runFor(100);assert.deepEqual(await page.evaluate(()=>({homeward:localStorage.getItem('orbit-maker.homeward.v1'),classic:localStorage.getItem('orbit-maker.stage-progress.v1')})),storageBefore);
   const restored=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list()).length;});assert.ok(restored>=6);
  }
  assert.deepEqual(errors,[]);results.push({width,height,board,errors,status:'PASS'});await context.close();
 }
 // Real PC clock, no virtual time: measure the actual per-frame scheduling budget.
 const context=await browser.newContext({viewport:{width:375,height:667}}),page=await context.newPage();await page.goto(url);
 await page.evaluate(async()=>{const {FlightClock}=await import('./js/flight-clock.js');const original=FlightClock.prototype.advance;window.costs=[];FlightClock.prototype.advance=function(...args){const n=original.apply(this,args);costs.push({wallSeconds:args[0],steps:n,cost:this.lastCost,effective:this.effective,pending:this.pending});return n;};});
 await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');
 await page.waitForFunction(()=>!document.querySelector('#result').hidden);
 const measured=await page.evaluate(()=>({frames:costs.length,overallEffective:costs.reduce((s,x)=>s+x.steps/120,0)/costs.reduce((s,x)=>s+x.wallSeconds,0),maxSteps:Math.max(...costs.map(x=>x.steps)),maxCostMs:Math.max(...costs.map(x=>x.cost)),meanCostMs:costs.reduce((s,x)=>s+x.cost,0)/costs.length,samples:costs}));
 assert.ok(measured.maxSteps<=240);results.push({performance:measured,environment:'PC Chrome headless, real clock; not iPhone'});await context.close();
 await writeFile(new URL('browser-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>r.performance?{performance:{...r.performance,samples:undefined}}:r)));
}finally{await browser.close();await new Promise(r=>server.close(r));}
