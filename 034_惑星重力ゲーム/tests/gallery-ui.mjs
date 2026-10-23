import{chromium}from'../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import{createServer}from'node:http';import{readFile,mkdir,writeFile}from'node:fs/promises';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/gallery/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const u=new URL('.'+new URL(req.url,'http://localhost').pathname,root),f=u.pathname.endsWith('/')?new URL('index.html',u):u;
 if(!fileURLToPath(f).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',f.pathname.endsWith('.js')?'text/javascript':f.pathname.endsWith('.css')?'text/css':f.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/`;await page.goto(url);
 const legacy='{"design":{"stage-10":3},"live":{"stage-05":2}}';await page.evaluate(value=>localStorage.setItem('orbit-maker.stage-progress.v1',value),legacy);
 await page.locator('#launchButton').click();await page.locator('#result').waitFor({state:'visible'});await page.locator('#openGallery').click();
 await page.locator('.gallery-record').waitFor();assert.match(await page.locator('.gallery-record').textContent(),/FAIL/);
 await page.getByRole('button',{name:'☆ お気に入り',exact:true}).click();await page.getByRole('button',{name:'★ 解除',exact:true}).waitFor();
 await page.locator('.gallery-record').click();await page.locator('#replayPlay').click();
 const paused=await page.locator('#replayTime').textContent();await page.waitForTimeout(150);assert.equal(await page.locator('#replayTime').textContent(),paused);
 for(const speed of ['0.5','1','2','4'])await page.locator('#replaySpeed').selectOption(speed);
 await page.locator('#replayFull').click();assert.equal(await page.locator('#replayFull').getAttribute('aria-pressed'),'true');
 await page.locator('#replayRestart').click();await page.waitForFunction(()=>document.querySelector('#replayResult').textContent==='FAIL');
 await page.screenshot({path:fileURLToPath(new URL('replay-375.png',dir))});
 await page.setViewportSize({width:320,height:568});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const playBox=await page.locator('#replayPlay').boundingBox();assert.ok(playBox.y+playBox.height<=568);await page.setViewportSize({width:375,height:667});
 await page.locator('#replayBack').click();await page.getByRole('button',{name:'★ 解除',exact:true}).click();await page.getByRole('button',{name:'☆ お気に入り',exact:true}).waitFor();
 await page.getByRole('button',{name:'削除',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.gallery-record'));
 await page.locator('#closeGallery').click();await page.locator('#resetButton').click();await page.locator('#openStages').click();await page.locator('#stageList button').first().click();
 await page.locator('#angleInput').fill('-72');await page.locator('#speedInput').fill('126');await page.locator('#launchButton').click();await page.locator('#result.success').waitFor({timeout:10000});
 await page.locator('#openGallery').click();await page.locator('.gallery-record').waitFor();assert.match(await page.locator('.gallery-record').textContent(),/CLEAR/);
 await page.locator('.gallery-record').click();await page.locator('#replaySpeed').selectOption('4');await page.locator('#replayRestart').click();
 await page.waitForFunction(()=>document.querySelector('#replayResult').textContent==='CLEAR');await page.locator('#closeGallery').click();
 await page.locator('#resetButton').click();await page.locator('#openStages').click();await page.locator('#freePlay').click();await page.locator('#gameMode').selectOption('live');
 await page.locator('#launchButton').click();
 const point=async(x,y)=>page.locator('#gameCanvas').evaluate((el,{x,y})=>{const b=el.getBoundingClientRect(),f=document.querySelector('#spaceFrame').getBoundingClientRect(),s=Math.min(f.width/375,f.height/500);return{x:b.x+(f.width-375*s)/2+x*s,y:b.y+(f.height-500*s)/2+y*s};},{x,y});
 const a=await point(196,282),b=await point(216,292);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.waitForTimeout(150);await page.mouse.up();
 await page.locator('#result').waitFor({state:'visible'});await page.locator('#openGallery').click();await page.locator('.gallery-record').first().waitFor();
 const movement=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');const rows=await new GalleryStore().list(),r=rows.find(r=>r.gameMode==='live');return r&&r.frames.some(f=>f[3]!==r.frames[0][3]||f[4]!==r.frames[0][4]);});assert.ok(movement,'game integration did not record planet movement');
 await page.locator('#closeGallery').click();
 // Store policy tests use this disposable browser context, never the user's browser DB.
 const policy=await page.evaluate(async()=>{
  const {GalleryStore,AUTO_LIMIT,FAVORITE_LIMIT}=await import('./js/gallery-store.js'),store=new GalleryStore();
  const fixture=(await store.list())[0];for(const row of await store.list())await store.delete(row.id);
  const before=localStorage.getItem('orbit-maker.stage-progress.v1');
  for(let i=0;i<30;i++){const row={...fixture,id:`fav-${i}`,createdAt:i};await store.save(row);if(!await store.setFavorite(row.id,true))throw Error('Favorite add failed');}
  for(let i=0;i<25;i++)await store.save({...fixture,id:`auto-${i}`,createdAt:100+i});
  let rows=await store.list();const limits=rows.length===50&&rows.filter(r=>r.favorite).length===FAVORITE_LIMIT&&rows.filter(r=>!r.favorite).length===AUTO_LIMIT&&!rows.some(r=>r.id==='auto-0');
  const capped=await store.setFavorite('auto-24',true)===false;
  await store.setFavorite('fav-0',false);await store.setFavorite('auto-24',true);await store.delete('auto-23');
  rows=await new GalleryStore().list();
  return{limits,capped,restored:rows.some(r=>r.id==='auto-24'&&r.favorite),deleted:!rows.some(r=>r.id==='auto-23'),oldFavorites:rows.filter(r=>r.id.startsWith('fav-')&&r.favorite).length===29,nonInterference:before===localStorage.getItem('orbit-maker.stage-progress.v1')};
 });for(const [key,value]of Object.entries(policy))assert.ok(value,key);
 await page.reload();await page.locator('#openGallery').click();await page.locator('.gallery-record').first().waitFor();
 assert.match(await page.locator('#galleryCount').textContent(),/お気に入り 30\/30/);
 await page.getByRole('button',{name:'☆ お気に入り',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('#galleryMessage').textContent.includes('最大30件'));
 await page.screenshot({path:fileURLToPath(new URL('list-375.png',dir))});
 // No IndexedDB: save fails visibly while the core still launches/resets.
 const unavailable=await browser.newPage({viewport:{width:375,height:667}});
 await unavailable.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new Error('Unavailable');}}));
 await unavailable.goto(url);await unavailable.locator('#launchButton').click();await unavailable.locator('#result').waitFor({state:'visible'});
 await unavailable.waitForFunction(()=>document.querySelector('#galleryNotice').textContent.includes('ゲームは続けられます'));
 await unavailable.locator('#resetButton').click();assert.ok(await unavailable.locator('#launchButton').isEnabled());
 // Simulate quota rejection through the storage boundary, without changing physics.
 const quota=await browser.newPage();await quota.goto(url);await quota.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');GalleryStore.prototype.save=async()=>{throw new DOMException('full','QuotaExceededError');};});
 await quota.locator('#launchButton').click();await quota.locator('#result').waitFor({state:'visible'});await quota.waitForFunction(()=>document.querySelector('#galleryNotice').textContent.includes('保存容量'));
 assert.deepEqual(errors,[]);await writeFile(new URL('ui-result.json',dir),JSON.stringify({browser:'Windows Chrome; not iPhone Safari',viewport:['375x667','320x568'],policy,clearAndFail:true,replayControls:true,unavailableFallback:true,quotaNotice:true,errors},null,2));
 console.log('Gallery browser PASS: clear/fail, replay, favorites, delete, 20+30 limits, IndexedDB restore, save isolation, unavailable/quota fallback');
}finally{await browser.close();await new Promise(r=>server.close(r));}
