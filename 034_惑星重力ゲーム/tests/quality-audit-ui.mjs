// Isolated Chrome context only. Never opens a user profile or hosted website.
import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),repo=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),dir=new URL('reports/quality-audit/',root);
await mkdir(dir,{recursive:true});
const prefix='/browser-game/',project=prefix+encodeURIComponent('034_惑星重力ゲーム')+'/';
const server=createServer(async(req,res)=>{
 try{
  const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!requested.startsWith(prefix))throw Error('prefix');
  const file=path.resolve(repo,requested.slice(prefix.length)+(requested.endsWith('/')?'index.html':''));
  if(!file.startsWith(repo+path.sep))throw Error('path');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage(),errors=[],failedResponses=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
const base=`http://127.0.0.1:${server.address().port}`,url=base+project;
const result={version:'v0.9.0-A',browser:'Windows Chrome (mobile viewport / CDP touch), not iPhone Safari',screens:[],performance:{},continuous:[],errors,failedResponses};
const assertReachable=async selector=>{
 const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
 const check=await el.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{box:b.toJSON(),hit:hit===el||el.contains(hit),width:innerWidth,height:innerHeight};});
 assert.ok(check.box.x>=0&&check.box.right<=check.width+1&&check.box.y>=0&&check.box.bottom<=check.height+1&&check.hit,`${selector} unreachable ${JSON.stringify(check)}`);
};
const memory=async cdp=>{await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');return{usedBytes:heap.usedSize,totalBytes:heap.totalSize};};
const phase=async(name,milliseconds)=>{await page.evaluate(name=>{audit.phase=name;},name);await page.waitForTimeout(milliseconds);};
try{
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#angleOutput').value==='−55°');
 // Seed only this disposable browser context; never modify user data.
 const legacy={design:Object.fromEntries(Array.from({length:19},(_,i)=>[`stage-${String(i+1).padStart(2,'0')}`,3])),live:{'stage-10':2}};
 await page.evaluate(value=>localStorage.setItem('orbit-maker.stage-progress.v1',JSON.stringify(value)),legacy);await page.reload();
 for(const [width,height]of[[375,667],[390,844],[320,568]]){
  await page.setViewportSize({width,height});
  for(const selector of ['#gameMode','[data-launch-mode="precision"]','[data-launch-mode="slingshot"]','#angleInput','#speedInput','#launchButton','#resetButton'])await assertReachable(selector);
  for(const panel of ['displayPanel','planetPanel']){
   await page.locator('#'+panel).evaluate(el=>el.open=true);
   for(const control of await page.locator(`#${panel} button, #${panel} select`).all())await assertReachable('#'+await control.getAttribute('id'));
   await page.locator('#'+panel).evaluate(el=>el.open=false);
  }
  await page.locator('.controls-body').evaluate(el=>el.scrollTop=0);
  const metrics=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],board:document.querySelector('#spaceFrame').getBoundingClientRect().toJSON(),canvasTouch:getComputedStyle(document.querySelector('#gameCanvas')).touchAction,userSelect:getComputedStyle(document.body).userSelect,zoom:document.querySelector('meta[name=viewport]').content}));
  assert.ok(metrics.document[0]<=width&&metrics.document[1]<=height);assert.ok(metrics.board.height>=260);assert.equal(metrics.canvasTouch,'none');assert.equal(metrics.userSelect,'none');
  await page.screenshot({path:fileURLToPath(new URL(`screen-${width}x${height}.png`,dir))});result.screens.push({...metrics,controlsReachable:true,status:'PASS (Chrome only)'});
 }
 console.log('Audit: three viewport layouts and hit targets PASS');
 await page.setViewportSize({width:375,height:667});
 await page.locator('#gameMode').selectOption('live');
 const cdp=await context.newCDPSession(page);
 await page.evaluate(()=>{window.liveArcs=[];window.liveFrames=[];window.liveSampling=true;let last=performance.now();requestAnimationFrame(function frame(t){liveFrames.push(t-last);last=t;if(liveSampling)requestAnimationFrame(frame);});const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){if(this.canvas.id==='gameCanvas'&&r===38){liveArcs.push({x,y});if(liveArcs.length>200)liveArcs.shift();}return arc.call(this,x,y,r,...rest);};});
 const point=async(x,y)=>page.locator('#gameCanvas').evaluate((el,{x,y})=>{const b=el.getBoundingClientRect(),f=document.querySelector('#spaceFrame').getBoundingClientRect(),s=Math.min(f.width/375,f.height/500);return{x:b.x+(f.width-375*s)/2+x*s,y:b.y+(f.height-500*s)/2+y*s};},{x,y});
 const touch=async(type,x,y)=>{const p=await point(x,y);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{...p,id:1}]});};
 await page.locator('#angleInput').fill('-72');await page.locator('#speedInput').fill('126');
 await page.locator('#launchButton').click();await touch('touchStart',196,282);await touch('touchMove',226,292);await page.waitForTimeout(500);await touch('touchEnd',226,292);
 assert.ok(await page.evaluate(()=>liveArcs.some(p=>p.x>198)));assert.ok(await page.evaluate(()=>scrollY===0&&getSelection().toString()===''));
 await page.locator('#resetButton').click();result.touchLiveGravity=true;
 result.liveFrameIntervalsMs=await page.evaluate(()=>{liveSampling=false;const sorted=liveFrames.slice().sort((a,b)=>a-b);return{samples:sorted.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};});
 // Instrument the live presentation boundary without changing game state.
 await page.evaluate(async()=>{
  const {PreviewController}=await import('./js/preview.js'),{EncounterObserver}=await import('./js/space-experience.js');
  window.audit={phase:'idle',cpu:{},frames:{},urls:new Set()};
  for(const [proto,label]of[[PreviewController.prototype,'previewMs'],[EncounterObserver.prototype,'encounterMs']]){const original=proto.update;proto.update=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const key=audit.phase+'/'+label;(audit.cpu[key]??=[]).push(performance.now()-start);}};}
  let last=performance.now();requestAnimationFrame(function frame(t){(audit.frames[audit.phase]??=[]).push(t-last);last=t;requestAnimationFrame(frame);});
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const u=create(blob);audit.urls.add(u);return u;};URL.revokeObjectURL=u=>{audit.urls.delete(u);revoke(u);};
 });
 await page.locator('#gameMode').selectOption('design');await page.locator('#planetPanel').evaluate(el=>el.open=true);await page.locator('#addPlanet').click();await page.locator('#addPlanet').click();await page.locator('#planetPanel').evaluate(el=>el.open=false);
 await page.evaluate(()=>{audit.phase='three-planets-preview';});
 for(const value of ['-56','-55','-54','-53','-54','-55']){await page.locator('#angleInput').fill(value);await page.waitForTimeout(100);}
 await phase('three-planets-preview',300);
 await page.locator('#displayPanel').evaluate(el=>el.open=true);await page.locator('#previewToggle').click();assert.equal(await page.locator('#previewToggle').getAttribute('aria-pressed'),'false');await page.locator('#previewToggle').click();await page.locator('#displayPanel').evaluate(el=>el.open=false);
 await page.locator('#openStages').click();await page.locator('#stageList button').nth(19).click();
 await phase('three-special-glows-preview',800);
 const heapBefore=await memory(cdp);const begin=performance.now();
 let expectedRecords=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return(await new GalleryStore().list()).length;});
 await page.evaluate(()=>{audit.phase='continuous-standard';});
 for(let i=0;i<12;i++){
  if(i===6){await page.locator('#displayPanel').evaluate(el=>el.open=true);await page.locator('#effectQuality').selectOption('light');await page.locator('#displayPanel').evaluate(el=>el.open=false);await page.evaluate(()=>{audit.phase='continuous-light';});}
  await page.locator('#angleInput').fill('-66');await page.locator('#speedInput').fill('212');const start=performance.now();
  await page.locator('#launchButton').click();await page.locator('#result.success').waitFor({state:'visible'});
  assert.equal(await page.locator('#clearStars').textContent(),'★★★');
  await page.waitForFunction(async expected=>{const {GalleryStore}=await import('./js/gallery-store.js');return(await new GalleryStore().list()).length>expected;},expectedRecords);
  const count=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return(await new GalleryStore().list()).length;});expectedRecords=count;
  result.continuous.push({flight:i+1,quality:i<6?'standard':'light',wallMs:performance.now()-start,records:count});
  await page.locator('#resetButton').click();assert.ok(await page.locator('#launchButton').isEnabled());
 }
 result.continuousSeconds=(performance.now()-begin)/1000;result.heapBefore=heapBefore;result.heapAfter=await memory(cdp);
 console.log('Audit: live touch and 12 consecutive clears / quality switch PASS');
 // Max-length synthetic replay fixture: performance only, not a claimed physics solution.
 await page.evaluate(async()=>{
  const {GalleryStore}=await import('./js/gallery-store.js'),store=new GalleryStore(),record=(await store.list())[0];
  const fixture={...record,id:'audit-max-length',stageName:'監査用・最大長12秒3惑星',createdAt:Date.now()+1000,duration:12,result:'fail',reason:'timeout',frames:Array.from({length:1441},(_,i)=>[i/120,180+110*Math.cos(i/120),250+160*Math.sin(i/120),...record.planets.flatMap(p=>[p.x,p.y])])};
  await store.save(fixture);if(!await store.setFavorite(fixture.id,true))throw Error('Favorite failed');
 });
 await page.locator('#openGallery').click();await page.locator('.gallery-record').first().click();await page.locator('#replaySpeed').selectOption('4');await page.locator('#replayRestart').click();await phase('gallery-replay-1441',1000);
 await page.locator('#replayPlay').click();const paused=await page.locator('#replayTime').textContent();await page.waitForTimeout(120);assert.equal(await page.locator('#replayTime').textContent(),paused);
 result.png=await page.evaluate(async()=>{
  const {GalleryStore}=await import('./js/gallery-store.js'),{renderArtBlob}=await import('./js/orbit-share-ui.js');const store=new GalleryStore(),record=(await store.list()).find(r=>r.id==='audit-max-length'),before=JSON.stringify(record),rows=[];
  for(const shape of ['square','portrait']){audit.phase='png-'+shape;const start=performance.now(),blob=await renderArtBlob(record,{shape});const buffer=await blob.arrayBuffer(),view=new DataView(buffer);rows.push({shape,ms:performance.now()-start,bytes:blob.size,type:blob.type,width:view.getUint32(16),height:view.getUint32(20),worker:typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'});}
  const WorkerSaved=window.Worker;window.Worker=undefined;
  try{audit.phase='png-fallback';const start=performance.now(),blob=await renderArtBlob(record,{shape:'square'});rows.push({shape:'square-fallback',ms:performance.now()-start,bytes:blob.size,type:blob.type});}finally{window.Worker=WorkerSaved;}
  if(JSON.stringify((await store.list()).find(r=>r.id===record.id))!==before)throw Error('Record mutated');return rows;
 });
 assert.deepEqual(result.png.slice(0,2).map(r=>[r.width,r.height]),[[1080,1080],[1080,1920]]);
 await page.locator('#openArt').click();await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===360);await page.locator('#closeGallery').click();
 await page.waitForFunction(()=>audit.urls.size===0);result.blobUrlsReleased=true;
 result.performance=await page.evaluate(()=>{const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b);return{samples:sorted.length,median:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.floor(sorted.length*.95)]??null,max:sorted.at(-1)??null};};return{cpu:Object.fromEntries(Object.entries(audit.cpu).map(([k,v])=>[k,stats(v)])),frameIntervalsMs:Object.fromEntries(Object.entries(audit.frames).map(([k,v])=>[k,stats(v)]))};});
 result.heapAfterArt=await memory(cdp);
 const savedBefore=await page.evaluate(async()=>({progress:localStorage.getItem('orbit-maker.stage-progress.v1'),settings:localStorage.getItem('orbit-maker.experience.v1'),records:JSON.stringify(await new(await import('./js/gallery-store.js')).GalleryStore().list())}));
 await page.reload();
 const savedAfter=await page.evaluate(async()=>({progress:localStorage.getItem('orbit-maker.stage-progress.v1'),settings:localStorage.getItem('orbit-maker.experience.v1'),records:JSON.stringify(await new(await import('./js/gallery-store.js')).GalleryStore().list())}));
 assert.deepEqual(savedAfter,savedBefore);const loaded=JSON.parse(savedAfter.progress);for(const[id,stars]of Object.entries(legacy.design))assert.equal(loaded.design[id],stars);assert.equal(loaded.live['stage-10'],2);assert.equal(loaded.design['stage-20'],3);
 result.restored=true;result.oldStarsPreserved=true;result.favoritePreserved=true;
 result.network={sameOriginGetAndLocalBlobOnly:true,requests:requests.length,externalUploads:0,unexpected:requests.filter(r=>r.method!=='GET'||(!r.url.startsWith(base+prefix)&&!r.url.startsWith('blob:'+base+'/')))};
 assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(result.network.unexpected,[]);
 await writeFile(new URL('browser-audit.json',dir),JSON.stringify(result,null,2));
 console.log('Audit browser PASS: layouts, touch, prediction, 12 clears, PNG/replay timings, restore, favorite, Pages subpath, no external requests');
}catch(error){result.failure=String(error);await writeFile(new URL('browser-audit-failure.json',dir),JSON.stringify(result,null,2));await page.screenshot({path:fileURLToPath(new URL('failure.png',dir))});throw error;
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
