import{chromium}from'../../019_bomber-lab/tests/node_modules/playwright/index.mjs';import{createServer}from'node:http';import{readFile,mkdir,writeFile}from'node:fs/promises';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/orbit-share/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const u=new URL('.'+new URL(req.url,'http://localhost').pathname,root),f=u.pathname.endsWith('/')?new URL('index.html',u):u;if(!fileURLToPath(f).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',f.pathname.endsWith('.js')?'text/javascript':f.pathname.endsWith('.css')?'text/css':f.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,isMobile:true,acceptDownloads:true});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);
 const before=await page.evaluate(async()=>{
  const {GalleryStore}=await import('./js/gallery-store.js'),{CHALLENGES}=await import('./js/challenges.js'),{createSimulation,stepSimulation}=await import('./js/physics.js'),{createFlightRecorder}=await import('./js/flight-record.js');
  const s=CHALLENGES[19];let state=createSimulation(s,s.solution);const rec=createFlightRecorder(s,state,{playType:'challenge',gameMode:'design',launchMode:'precision'});
  while(state.status==='flying'){state=stepSimulation(state,1/120);rec.capture(state);}const store=new GalleryStore();const record=rec.finish(state);await store.save(record);await store.setFavorite(record.id,true);
  localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-10":3},"live":{"stage-12":2}}');
  window.imageUrls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=create(blob);imageUrls.add(url);return url;};URL.revokeObjectURL=url=>{imageUrls.delete(url);revoke(url);};
  return{records:JSON.stringify(await store.list()),progress:localStorage.getItem('orbit-maker.stage-progress.v1')};
 });
 await page.locator('#openGallery').click();await page.locator('.gallery-record').click();await page.locator('#openArt').click();
 await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===360);assert.ok(await page.locator('#artSave').isDisabled());
 await page.locator('#artGenerate').click();await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===1080);
 assert.equal(await page.locator('#artPreview').evaluate(el=>el.naturalHeight),1080);
 const square=page.waitForEvent('download');await page.locator('#artSave').click();const png=await square;
 assert.match(png.suggestedFilename(),/^ORBIT_MAKER_stage-20_\d{8}T\d{6}Z\.png$/);await png.saveAs(fileURLToPath(new URL('square.png',dir)));
 await page.locator('#artShape').selectOption('portrait');await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===360&&document.querySelector('#artPreview').naturalHeight===640);
 await page.locator('#artGenerate').click();await page.waitForFunction(()=>document.querySelector('#artPreview').naturalHeight===1920);
 const portrait=page.waitForEvent('download');await page.locator('#artSave').click();await(await portrait).saveAs(fileURLToPath(new URL('portrait.png',dir)));
 // Sharing stubs verify user gesture and files without invoking any external share target.
 await page.evaluate(()=>{window.shareCalls=0;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{if(!(data.files[0] instanceof File)||data.files[0].type!=='image/png')throw Error('Invalid share');shareCalls++;}});});
 assert.equal(await page.evaluate(()=>shareCalls),0);await page.locator('#artShare').click();assert.equal(await page.evaluate(()=>shareCalls),1);
 await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));await page.locator('#artShare').click();assert.match(await page.locator('#artMessage').textContent(),/利用できません/);assert.ok((await page.locator('#artOpenImage').getAttribute('href')).startsWith('blob:'));
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError');}});});
 await page.locator('#artShare').click();await page.waitForFunction(()=>document.querySelector('#artMessage').textContent.includes('キャンセル'));
 await page.locator('#artText').uncheck();await page.locator('#artBackground').selectOption('simple');await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===360);
 await page.locator('#artGenerate').click();await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===1080);
 const simple=page.waitForEvent('download');await page.locator('#artSave').click();await(await simple).saveAs(fileURLToPath(new URL('simple-no-text.png',dir)));
 await page.screenshot({path:fileURLToPath(new URL('ui-375.png',dir))});
 // Main-thread fallback, text switches and allocation failure/retry.
 const switches=await page.evaluate(async()=>{
  const {drawOrbitArt}=await import('./js/orbit-art.js'),{GalleryStore}=await import('./js/gallery-store.js'),record=(await new GalleryStore().list())[0];
  const canvas=document.createElement('canvas');canvas.width=360;canvas.height=360;const ctx=canvas.getContext('2d');let labels=0;const original=ctx.fillText.bind(ctx);ctx.fillText=(...a)=>{labels++;return original(...a);};
  await drawOrbitArt(canvas,record,{text:false,background:'simple'});const noText=labels,pixel=Array.from(ctx.getImageData(0,0,1,1).data);
  await drawOrbitArt(canvas,record,{text:true,background:'space'});return{noText,withText:labels,pixel};
 });assert.equal(switches.noText,0);assert.equal(switches.withText,3);assert.deepEqual(switches.pixel,[6,13,28,255]);
 await page.evaluate(()=>{window.savedWorker=Worker;window.Worker=undefined;window.savedToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});
 await page.locator('#artGenerate').click();await page.waitForFunction(()=>document.querySelector('#artMessage').textContent.includes('作成できません'));
 assert.ok(await page.locator('#artGenerate').isEnabled());assert.ok(await page.locator('#artSave').isDisabled());
 await page.evaluate(()=>HTMLCanvasElement.prototype.toBlob=savedToBlob);
 await page.locator('#artGenerate').click();await page.waitForFunction(()=>document.querySelector('#artPreview').naturalWidth===1080);
 await page.locator('#artBack').click();assert.ok(await page.locator('#replayPlay').isVisible());
 await page.locator('#openArt').click();await page.locator('#closeGallery').click();
 await page.waitForFunction(()=>imageUrls.size===0);
 assert.equal(await page.evaluate(()=>imageUrls.size),0);
 const after=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return{records:JSON.stringify(await new GalleryStore().list()),progress:localStorage.getItem('orbit-maker.stage-progress.v1')};});assert.deepEqual(after,before);
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(base)||r.url.startsWith('blob:'))));
 await writeFile(new URL('result.json',dir),JSON.stringify({browser:'Windows Chrome 375x667; not iPhone Safari',square:[1080,1080],portrait:[1080,1920],nonDestructive:true,workerAndFallback:true,switches,shareStub:true,unsupportedFallback:true,failureRecovery:true,urlsReleased:true,externalUpload:false,errors},null,2));
 console.log('Orbit Share PASS: PNG sizes, downloads, switches, share stubs/fallback, non-destructive, failures/retry, URL cleanup, no upload');
}finally{await browser.close();await new Promise(r=>server.close(r));}
