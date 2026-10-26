import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/flight-replay/',root);await mkdir(dir,{recursive:true});
const old=JSON.parse(await readFile(new URL('reports/first-voyage/homeward-01-flight.json',root),'utf8'));delete old.launch;
Object.assign(old,{id:'legacy-v1',stageName:'旧記録 HOMEWARD01',createdAt:1});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const url=`http://127.0.0.1:${server.address().port}`;
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(url);await page.clock.runFor(100);
  await page.evaluate(async record=>{
   const {GalleryStore}=await import('./js/gallery-store.js');const store=new GalleryStore();await store.save(record);await store.setFavorite(record.id,true);
   localStorage.setItem('orbit-maker.homeward.v1','{"version":1,"currentSector":"homeward-02","cleared":["homeward-01"],"openingSeen":true,"eventsSeen":[],"active":false}');
   localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-20":3},"live":{}}');
   const {FlightReplay}=await import('./js/flight-replay.js'),original=FlightReplay.prototype.updateCamera;
   FlightReplay.prototype.updateCamera=function(...args){window.activeReplay=this;return original.apply(this,args);};
  },old);
  // Generate a fresh failed flight through the existing game, not the replay.
  await page.locator('#launchButton').click();await page.clock.runFor(1600);assert.equal(await page.locator('#result').isVisible(),true);
  const before=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return {records:await new GalleryStore().list(),homeward:localStorage.getItem('orbit-maker.homeward.v1'),classic:localStorage.getItem('orbit-maker.stage-progress.v1')};});assert.equal(before.records.length,2);
  await page.locator('#openMenuSettings').click();await page.locator('#openGallery').click();await page.locator('#galleryDefaultCamera').selectOption('cinematic');await page.locator('.gallery-record').filter({hasText:'旧記録 HOMEWARD01'}).click();
  assert.equal(await page.locator('#replayCamera').inputValue(),'cinematic');assert.equal(await page.locator('#replayPhase').textContent(),'出航準備');
  await page.locator('#replayPlay').click();const paused=await page.locator('#replayTime').textContent();await page.clock.runFor(200);assert.equal(await page.locator('#replayTime').textContent(),paused);
  await page.locator('#replayCamera').selectOption('cinematic');await page.locator('#replayRestart').click();await page.clock.runFor(250);
  assert.equal(await page.locator('#replayPhase').textContent(),'出航準備');assert.equal(await page.evaluate(()=>activeReplay.time),0);
  await page.screenshot({path:fileURLToPath(new URL(`departure-${width}x${height}.png`,dir))});
  await page.locator('#replayPlay').click();const pose=await page.evaluate(()=>({time:activeReplay.time,center:activeReplay.camera.center,zoom:activeReplay.camera.zoom}));await page.clock.runFor(500);assert.deepEqual(await page.evaluate(()=>({time:activeReplay.time,center:activeReplay.camera.center,zoom:activeReplay.camera.zoom})),pose);
  await page.locator('#replayPlay').click();await page.clock.runFor(900);assert.ok(await page.evaluate(()=>activeReplay.time>0));
  const seek=async value=>page.locator('#replayPosition').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await seek(5);assert.equal(await page.locator('#replayPlay').textContent(),'再生');assert.equal(await page.evaluate(()=>activeReplay.time),5);
  for(const mode of ['normal','follow','overview','cinematic']){await page.locator('#replayCamera').selectOption(mode);assert.equal(await page.evaluate(()=>activeReplay.time),5);assert.equal(await page.evaluate(()=>activeReplay.playing),false);}
  await page.locator('#replayPlay').click();await page.clock.runFor(400);await page.locator('#replayPlay').click();
  await page.screenshot({path:fileURLToPath(new URL(`cinematic-${width}x${height}.png`,dir))});
  const board=await page.locator('.replay-board').boundingBox();assert.ok(board.height>=200);assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  for(const id of ['replayPlay','replayRestart','replaySpeed','replayFull','replayCamera','replayPosition'])assert.ok(await page.locator('#'+id).evaluate(el=>{const b=el.getBoundingClientRect();return b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight;}),id);
  if(width===375){
   const cdp=await context.newCDPSession(page),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
   const a={id:1,x:board.x+70,y:board.y+board.height*.6},b={id:2,x:board.x+180,y:board.y+board.height*.6};
   await touch('touchStart',[a]);await touch('touchMove',[{...a,x:a.x+3}]);await touch('touchEnd',[]);assert.equal(await page.locator('#replayCamera').inputValue(),'cinematic');
   await touch('touchStart',[a]);await touch('touchMove',[{...a,x:a.x+30,y:a.y+15}]);await touch('touchEnd',[]);assert.equal(await page.locator('#replayCamera').inputValue(),'manual');
   await page.locator('#replayCamera').selectOption('cinematic');await touch('touchStart',[a]);await touch('touchStart',[a,b]);await touch('touchMove',[{...a,x:a.x-15},{...b,x:b.x+15}]);await touch('touchEnd',[]);assert.equal(await page.locator('#replayCamera').inputValue(),'manual');
   await page.locator('#replayCamera').selectOption('cinematic');await page.locator('#replayZoomOut').click();assert.equal(await page.locator('#replayCamera').inputValue(),'manual');
   await page.locator('#replayOverview').click();assert.equal(await page.locator('#replayCamera').inputValue(),'overview');
   await page.locator('#replayCamera').selectOption('cinematic');
   for(const speed of [.5,1,2,4]){
    await seek(5);await page.locator('#replaySpeed').selectOption(String(speed));await page.locator('#replayPlay').click();
    const start=await page.evaluate(()=>({time:activeReplay.time,now:performance.now()}));await page.clock.runFor(500);
    const end=await page.evaluate(()=>({time:activeReplay.time,now:performance.now()}));await page.locator('#replayPlay').click();
    assert.ok(Math.abs((end.time-start.time)/speed-(end.now-start.now)/1000)<.08,`${speed}: ${JSON.stringify({start,end})}`);
   }
   await page.locator('#replayFull').click();assert.equal(await page.locator('#replayFull').getAttribute('aria-pressed'),'true');
  }
  await page.locator('#replaySpeed').selectOption('4');await seek(old.duration-.1);await page.locator('#replayPlay').click();await page.clock.runFor(1200);
  assert.equal(await page.locator('#replayResult').textContent(),'CLEAR');assert.equal(await page.evaluate(()=>activeReplay.phase),'ended');
  await page.locator('#replayBack').click();await page.locator('.gallery-record').filter({hasNotText:'旧記録 HOMEWARD01'}).click();await page.locator('#replayCamera').selectOption('cinematic');await page.locator('#replayRestart').click();await page.clock.runFor(3000);assert.equal(await page.locator('#replayResult').textContent(),'FAIL');
  if(width===375){
   const time=await page.evaluate(()=>activeReplay.time);await page.locator('#openArt').click();
   await page.waitForFunction(()=>document.querySelector('#artPreview').src.startsWith('blob:'));
   await page.locator('#artBack').click();assert.equal(await page.evaluate(()=>activeReplay.time),time);assert.equal(await page.locator('#galleryPlayer').isVisible(),true);
  }
  await page.locator('#closeGallery').click();await page.reload();await page.clock.runFor(50);
  const after=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return {records:await new GalleryStore().list(),homeward:localStorage.getItem('orbit-maker.homeward.v1'),classic:localStorage.getItem('orbit-maker.stage-progress.v1')};});assert.deepEqual(after,before);
  assert.deepEqual(errors,[]);results.push({width,height,board,oldAndNewReplay:true,pauseResume:true,seek:true,modeSwitch:true,clearAndFail:true,indexedDbAndProgressUnchanged:true,errors,status:'PASS'});await context.close();
 }
 await writeFile(new URL('browser-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
