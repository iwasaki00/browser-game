import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/open-voyage/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{if(req.url==='/setup'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated test setup</title>');return;}const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/setup`);
  const oldFavorite=await page.evaluate(async()=>{
   const {GalleryStore}=await import('./js/gallery-store.js'),{HOMEWARD_SECTORS}=await import('./js/homeward-data.js');const old=await fetch('./reports/first-voyage/homeward-01-flight.json').then(r=>r.json());old.id='legacy-present';const store=new GalleryStore();await store.save(old);await store.setFavorite(old.id,true);
   localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify({version:1,openingSeen:true,active:true,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),eventsSeen:['homeward-09:enter'],journal:{'homeward-01':{clearFlightId:old.id},'homeward-02':{clearFlightId:'already-deleted'}},oldExtension:{keep:true}}));localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-20":3},"live":{}}');return JSON.stringify((await store.list())[0]);
  });
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.runFor(100);if(await page.locator('#tutorialSkip').isVisible())await page.locator('#tutorialSkip').click();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')));
  const archive=()=>page.evaluate(async()=>{const {HomewardArchive}=await import('./js/homeward-archive.js');return new HomewardArchive().list();});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')).journal['homeward-01'].importantFlightId==='legacy-present');
  assert.equal((await state()).journal['homeward-02'].importantFlightId,undefined);
  await page.clock.runFor(100);const board=await page.locator('#spaceFrame').boundingBox();
  await page.locator('#openDestinations').click();const panel=await page.locator('#homewardDialog').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=height);assert.equal(await page.locator('[data-destination]').count(),4);assert.equal(await page.locator('[data-sector="homeward-09"]').isEnabled(),true);
  await page.screenshot({path:fileURLToPath(new URL(`map-${width}x${height}.png`,dir))});await page.locator('[data-destination="rescue"]').click();assert.equal(await page.locator('[data-destination="rescue"]').getAttribute('aria-pressed'),'true');await page.locator('#closeHomeward').click();
  assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);await page.screenshot({path:fileURLToPath(new URL(`space-${width}x${height}.png`,dir))});
  if(width===320){
   const points=await page.evaluate(async()=>{const {Camera}=await import('./js/camera.js'),{createOpenVoyage}=await import('./js/open-voyage.js');const b=document.querySelector('#gameCanvas').getBoundingClientRect(),c=new Camera();c.resize(b.width,b.height);c.fit(createOpenVoyage({selected:'rescue'}));return [{x:1100,y:3400},{x:1300,y:3400},{x:2300,y:4000}].map(p=>{const q=c.toScreen(p);return {x:q.x+b.left,y:q.y+b.top};});});
   await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:5});await page.mouse.up();assert.equal(await page.locator('#selectionBar').isVisible(),true);
   await page.mouse.move(points[2].x,points[2].y);await page.mouse.down();await page.mouse.move(points[2].x+35,points[2].y-20,{steps:5});await page.mouse.up();assert.equal(await page.locator('#cameraModeBadge').textContent(),'FIXED');await page.locator('#fitCamera').click();
   await page.locator('#launchButton').click();await page.clock.runFor(50);await page.locator('#resetButton').click();await page.clock.runFor(50);
   await page.waitForFunction(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list()).some(r=>r.stageId==='homeward-09'&&r.reason==='reset');});
   const moved=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list()).find(r=>r.stageId==='homeward-09'&&r.reason==='reset').planets[0];});assert.ok(Math.abs(moved.x-1300)<.1);assert.equal((await state()).voyage.checkpoint,'origin');
   results.push({planetDrag:'PASS, x1100→1300',oneFingerPan:'FIXED then OVERVIEW',reset:'last checkpoint preserved'});
  }
  if(width===375){
   const baseline=await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1'));
   for(const [target,angle,speed]of [['rescue',-65,220],['planet',-19,220],['station',-77,220],['gate',-132,220]]){
    if(target!=='rescue'){await page.locator('#openDestinations').click();await page.locator(`[data-destination="${target}"]`).click();assert.match(await page.locator('#voyageCourse').textContent(),/参考航路/);await page.locator('#closeHomeward').click();}
    await page.locator('#angleInput').fill(String(angle));await page.locator('#speedInput').fill(String(speed));await page.clock.runFor(1400);assert.equal(await page.locator('#previewStatus').textContent(),'ゴール到達予測');
    await page.locator('#launchButton').click();
    if(target==='planet'){for(const cameraMode of ['follow','cinematic']){await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption(cameraMode);await page.locator('#closeMenuSettings').click();await page.clock.runFor(50);assert.equal(await page.locator('#cameraModeBadge').textContent(),cameraMode.toUpperCase());}}
    if(target==='rescue'){
     await page.clock.runFor(200);await page.locator('#openDestinations').click();assert.equal(await page.locator('[data-sector="homeward-08"]').isDisabled(),true);
     await page.locator('[data-destination="gate"]').click();assert.match(await page.locator('#voyageCheckpoint').textContent(),/帰還ゲート/);await page.locator('[data-destination="rescue"]').click();await page.locator('#closeHomeward').click();
    }
    await page.locator('#flightRate').selectOption('100');await page.clock.runFor(1600);assert.equal(await page.locator('#resultLabel').textContent(),target==='gate'?'CLEAR':'寄港しました');
    await page.waitForFunction(id=>Boolean(JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')).voyage?.records?.[id]),target);assert.equal((await state()).voyage.checkpoint,target);
    if(target==='rescue'){
     assert.ok((await state()).voyage.rewards.includes('route-charts'));await page.reload();await page.clock.runFor(100);assert.equal((await state()).voyage.checkpoint,'rescue');assert.equal((await state()).voyage.selected,'rescue');
     await page.locator('#resetButton').click();await page.locator('#launchButton').click();assert.equal(await page.locator('#homeward-map').isVisible(),true);await page.locator('#closeHomeward').click();
    }
   }
   const completed=await state();assert.equal(completed.cleared.length,9);assert.equal(completed.voyage.visited.length,4);assert.ok(completed.voyage.rewards.includes('navigation-tech'));assert.deepEqual(completed.oldExtension,{keep:true});
   const protectedRows=await archive();assert.equal(protectedRows.length,6);const snapshot=JSON.stringify(protectedRows),serializedArchiveBytes=new TextEncoder().encode(snapshot).byteLength;
   // Evict the ordinary automatic rows in this disposable test profile only.
   await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');const store=new GalleryStore(),sample=(await store.list())[0];for(let i=0;i<25;i++)await store.save({...sample,id:'eviction-'+i,createdAt:Date.now()+i+100000});});
   const ordinary=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return new GalleryStore().list();});assert.equal(ordinary.filter(r=>!r.favorite).length,20);assert.equal(JSON.stringify(ordinary.find(r=>r.id==='legacy-present')),oldFavorite);assert.ok(!ordinary.some(r=>r.id===completed.voyage.records.rescue));assert.equal(JSON.stringify(await archive()),snapshot);
   await page.locator('#nextStage').click();await page.locator('summary').filter({hasText:'航海日誌・航行の再生'}).click();await page.locator('#homewardJournal').getByRole('button',{name:'救難信号の寄港記録をCINEMATIC再生（専用保護）'}).click();await page.clock.runFor(8000);assert.equal(await page.locator('#replayCamera').inputValue(),'cinematic');assert.equal(await page.locator('#replayResult').textContent(),'CLEAR');await page.screenshot({path:fileURLToPath(new URL('protected-replay-375x667.png',dir))});await page.locator('#closeGallery').click();
   // Actual browser IndexedDB first-write protection: a later flight cannot replace it.
   const savedId=await page.evaluate(async()=>{const {HomewardArchive}=await import('./js/homeward-archive.js');const store=new HomewardArchive(),rows=await store.list(),row=rows.find(r=>r.key==='dock:homeward-09:rescue:first');return await store.saveFirst(row.key,{...row.record,id:'must-not-replace'});});assert.equal(savedId,completed.voyage.records.rescue);assert.equal(JSON.stringify(await archive()),snapshot);
   // Quota failure injection affects only the archive API, never user data.
   await page.evaluate(async()=>{const {HomewardArchive}=await import('./js/homeward-archive.js');HomewardArchive.prototype.saveFirst=()=>Promise.reject(new DOMException('test quota','QuotaExceededError'));});
   await page.locator('#openDestinations').click();await page.locator('[data-destination="rescue"]').click();await page.locator('#closeHomeward').click();await page.locator('#angleInput').fill('129');await page.locator('#speedInput').fill('220');await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');await page.clock.runFor(1800);assert.equal(await page.locator('#resultLabel').textContent(),'寄港しました');await page.waitForFunction(()=>document.querySelector('#homewardArchiveNotice').textContent.includes('保存できません'));assert.equal(JSON.stringify(await archive()),snapshot);
   assert.equal(await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1')),baseline);
   await writeFile(new URL('browser-save.json',dir),JSON.stringify(await state(),null,2));results.push({fullFlow:'PASS',route:'D',migration:'existing record copied; deleted record not fabricated',automaticLimit:20,protectedSlots:protectedRows.length,serializedArchiveBytes,archiveAfterEviction:'unchanged',quotaFailure:'notified; gameplay continued; protected data unchanged',classic:'unchanged'});
  }
  assert.deepEqual(errors,[]);const scroll=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}));assert.ok(scroll.height<=height+1);assert.ok(scroll.width<=width);results.push({width,height,board,panel,scroll,status:'PASS',device:'PC Chrome viewport emulation; iPhone UNVERIFIED',errors});await context.close();
 }
 await writeFile(new URL('ui-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
