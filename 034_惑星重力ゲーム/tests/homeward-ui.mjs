import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/homeward/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.runFor(50);
  const board=await page.locator('#spaceFrame').boundingBox();
  const classic={design:{'stage-01':3,'stage-19':3},live:{'stage-10':2}};
  await page.evaluate(async progress=>{
   localStorage.setItem('orbit-maker.stage-progress.v1',JSON.stringify(progress));
   const {GalleryStore}=await import('./js/gallery-store.js'),{getStage}=await import('./js/stages.js'),{createSimulation}=await import('./js/physics.js'),{createFlightRecorder}=await import('./js/flight-record.js');
   const s=getStage(),state=createSimulation(s),record=createFlightRecorder(s,state,{playType:'free',gameMode:'design',launchMode:'precision'},1).finish(state,'reset');record.id='legacy-favorite';await new GalleryStore().save(record);await new GalleryStore().setFavorite(record.id,true);
  },classic);
  // Keep an edited FREE SPACE configuration before entering the story.
  await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await page.locator('#angleInput').fill('-64');await page.locator('#speedInput').fill('210');
  await page.locator('#openMenuSettings').click();await page.locator('#openHomeward').click();assert.equal(await page.locator('#homeward-intro').isVisible(),true);
  await page.screenshot({path:fileURLToPath(new URL(`opening-${width}x${height}.png`,dir))});
  const panel=await page.locator('#homewardDialog').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=height);assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
  await page.locator('#homewardStart').click();assert.equal(await page.locator('#homeward-event').isVisible(),true);await page.locator('#homewardContinue').click();await page.clock.runFor(600);
  assert.equal(await page.locator('#angleInput').inputValue(),'-65');assert.equal(await page.locator('#speedInput').inputValue(),'220');assert.match(await page.locator('#homewardProgress').textContent(),/64,000/);
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  for(const selector of ['#resetButton','#launchButton','#openMenuSettings'])assert.ok(await page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect(),t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&(el===t||el.contains(t));}));
  await page.screenshot({path:fileURLToPath(new URL(`sector01-${width}x${height}.png`,dir))});
  const map=async()=>{await page.locator('#openMenuSettings').click();await page.locator('#openHomeward').click();};
  await map();assert.equal(await page.locator('[data-sector="homeward-02"]').isDisabled(),true);assert.equal(await page.locator('[data-sector="homeward-03"]').isDisabled(),true);
  await page.screenshot({path:fileURLToPath(new URL(`map-${width}x${height}.png`,dir))});await page.locator('#closeHomeward').click();
  if(width===375){
   await page.locator('#launchButton').click();await page.clock.runFor(19000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');assert.equal(await page.locator('#nextStage').textContent(),'次のセクターへ');
   await page.locator('#openMenuSettings').click();await page.locator('#chooseFreeSpace').click();assert.match(await page.locator('.mission strong').textContent(),/LONG VOYAGE/);assert.equal(await page.locator('#angleInput').inputValue(),'-64');assert.equal(await page.locator('#speedInput').inputValue(),'210');
   await map();await page.locator('[data-sector="homeward-01"]').click();
   await page.reload();await page.clock.runFor(100);assert.equal(await page.locator('#homeward-map').isVisible(),true);assert.match(await page.locator('#homewardDistance').textContent(),/62,800/);assert.equal(await page.locator('[data-sector="homeward-02"]').isDisabled(),false);assert.match(await page.locator('[data-sector="homeward-01"]').textContent(),/現在地/);
   await page.locator('[data-sector="homeward-02"]').click();await page.locator('#homewardContinue').click();await page.locator('#launchButton').click();await page.clock.runFor(19000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');
   await page.locator('#nextStage').click();await page.locator('#homewardContinue').click();await page.locator('#launchButton').click();await page.clock.runFor(19000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');assert.equal(await page.locator('#nextStage').textContent(),'宇宙マップへ');await page.locator('#nextStage').click();
   assert.match(await page.locator('#homewardDistance').textContent(),/58,600.*8.4%/);assert.equal(await page.locator('#homewardFoundationEnd').isVisible(),true);assert.equal(await page.locator('#homewardMeter').getAttribute('max'),'100');
   await page.screenshot({path:fileURLToPath(new URL('map-three-cleared-375x667.png',dir))});
   await page.locator('[data-sector="homeward-01"]').click();await page.locator('#angleInput').fill('-60');await map();await page.locator('#closeHomeward').click();assert.equal(await page.locator('#angleInput').inputValue(),'-60');await page.locator('#resetButton').click();assert.match(await page.locator('#homewardProgress').textContent(),/8.4%/);assert.equal(await page.locator('#angleInput').inputValue(),'-65');
   await page.locator('#openMenuSettings').click();await page.locator('#chooseFreeSpace').click();assert.match(await page.locator('.mission strong').textContent(),/最初のスイングバイ/);assert.equal(await page.locator('#homewardProgress').isVisible(),false);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1'))),classic);
   const rows=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return new GalleryStore().list();});assert.equal(rows.find(r=>r.id==='legacy-favorite').favorite,true);assert.equal(rows.filter(r=>r.playType==='homeward'&&r.result==='clear').length,3);
   await writeFile(new URL('browser-homeward-flights.json',dir),JSON.stringify(rows.filter(r=>r.playType==='homeward')));
   await page.locator('#openMenuSettings').click();await page.locator('#openGallery').click();await page.locator('.gallery-record').filter({hasText:'HOMEWARD 03'}).click();await page.clock.runFor(19000);assert.equal(await page.locator('#replayResult').textContent(),'CLEAR');await page.locator('#closeGallery').click();
   await page.reload();await page.clock.runFor(100);assert.equal(await page.locator('#homewardDialog').evaluate(e=>e.open),false);assert.equal(await page.locator('#homewardProgress').isVisible(),false);
   await page.locator('#openMenuSettings').click();await page.locator('#chooseClassic').click();assert.equal(await page.locator('#stageList>button').count(),20);await page.locator('#stageList>button').first().click();await page.locator('#angleInput').fill('-72');await page.locator('#speedInput').fill('126');await page.locator('#launchButton').click();await page.clock.runFor(4000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');assert.match(await page.locator('#clearStars').textContent(),/★★★/);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1'))),classic);
   const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')));assert.equal(save.cleared.length,3);assert.equal(save.active,false);results.push({fullFlow:'PASS',sectors:3,reload:'PASS',classic:'Stage01 clear, 20 stages available',freeSpace:'edited launch conditions restored',legacyFavorite:'preserved',galleryReplay:'CLEAR',saved:save});
  }
  assert.deepEqual(errors,[]);results.push({width,height,board,panel,errors,status:'PASS'});await context.close();
 }
 await writeFile(new URL('ui-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
