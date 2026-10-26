import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/space-encounters/',root);await mkdir(dir,{recursive:true});
const old=JSON.parse(await readFile(new URL('reports/first-voyage/homeward-01-flight.json',root),'utf8'));Object.assign(old,{id:'old-v1',createdAt:1});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const p=CanvasRenderingContext2D.prototype,original=p.setTransform;p.setTransform=function(...a){if(this.canvas.id==='gameCanvas'&&a[0]!==1)window.matrix=a;return original.apply(this,a);};});
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.runFor(100);
  const originalBoard=await page.locator('#spaceFrame').boundingBox();
  const panel=async()=>{await page.locator('#openMenuSettings').click();await page.locator('#openEncounterSettings').click();};
  const world=(x,y)=>page.evaluate(([x,y])=>{const b=document.querySelector('#gameCanvas').getBoundingClientRect(),[a,,,d,e,f]=matrix;return {x:b.left+(a*x+e)/devicePixelRatio,y:b.top+(d*y+f)/devicePixelRatio};},[x,y]);
  const rows=()=>page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return await new GalleryStore().list();});
  await page.evaluate(async record=>{const {GalleryStore}=await import('./js/gallery-store.js');const store=new GalleryStore();await store.save(record);await store.setFavorite(record.id,true);localStorage.setItem('orbit-maker.homeward.v1','{"version":1,"currentSector":"homeward-02","cleared":["homeward-01"],"openingSeen":true,"active":false}');localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-20":3},"live":{}}');},old);
  const progress=await page.evaluate(()=>[localStorage.getItem('orbit-maker.homeward.v1'),localStorage.getItem('orbit-maker.stage-progress.v1')]);
  for(const type of width===375?['meteor','comet','unknown','ufo','station']:['comet']){
   await panel();const box=await page.locator('#encounterPanel').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height);assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),originalBoard);
   await page.locator('#encounterSample').selectOption(type);await page.clock.runFor(1000);assert.equal(await page.locator('#previewStatus').textContent(),'ゴール到達予測');
   await panel();await page.locator('#encounterType').selectOption(type);if(type==='meteor')await page.locator('#encounterCount').fill('12');if(type==='comet')await page.locator('#encounterTailMode').selectOption('brake');await page.locator('#addEncounter').click();await page.clock.runFor(50);
   assert.equal(await page.locator('#encounterSelectionBar').isVisible(),true);
   const a=await world(65,65),b=await world(135,135);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
   await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');await page.clock.runFor(1200);
   assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');
   const record=(await rows())[0];assert.equal(record.encounters.length,2);const added=record.encounters.find(e=>e.id.startsWith('encounter-'));assert.ok(Math.hypot(added.x-135,added.y-135)<.01,JSON.stringify(added));
   if(type==='comet')assert.equal(added.tailMode,'brake');if(type==='meteor')assert.equal(added.count,12);if(type==='station')assert.match(await page.locator('#encounterLog').textContent(),/ステーション/);
   await page.locator('#resetButton').click();await page.locator('#deleteEncounter').click();assert.equal(await page.locator('#encounterSelectionBar').isVisible(),false);
   await panel();assert.match(await page.locator('#encounterReason').textContent(),/配置 1 \/ 6/);await page.locator('#closeEncounterSettings').click();
   if(width===375){await page.clock.runFor(500);await page.screenshot({path:fileURLToPath(new URL(`${type}-375x667.png`,dir))});}
  }
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  await panel();await page.screenshot({path:fileURLToPath(new URL(`panel-${width}x${height}.png`,dir))});await page.locator('#closeEncounterSettings').click();
  const before=await rows();await page.locator('#openMenuSettings').click();await page.locator('#openGallery').click();await page.locator('#galleryDefaultCamera').selectOption('cinematic');await page.locator('.gallery-record').first().click();
  await page.locator('#replayPosition').evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
  if(width===375)assert.match(await page.locator('#replayEncounterLog').textContent(),/ステーション/);
  await page.screenshot({path:fileURLToPath(new URL(`replay-${width}x${height}.png`,dir))});await page.locator('#closeGallery').click();assert.deepEqual(await rows(),before);
  await page.locator('#openMenuSettings').click();await page.locator('#openStages').click();await page.locator('#stageList>button').first().click();await page.locator('#openMenuSettings').click();assert.equal(await page.locator('#openEncounterSettings').isDisabled(),true);await page.locator('#closeMenuSettings').click();
  await page.reload();await page.clock.runFor(50);assert.deepEqual(await rows(),before);assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('orbit-maker.homeward.v1'),localStorage.getItem('orbit-maker.stage-progress.v1')]),progress);
  assert.deepEqual(errors,[]);results.push({width,height,board:originalBoard,types:width===375?5:1,addMoveDelete:true,preview:true,speed100:true,replay:true,classicRestriction:true,oldRecordsAndProgressUnchanged:true,errors,status:'PASS'});await context.close();
 }
 await writeFile(new URL('browser-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
