import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/lost-sectors/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   if(!localStorage.getItem('orbit-maker.homeward.v1'))localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify({version:1,currentSector:'homeward-03',cleared:['homeward-01','homeward-02','homeward-03'],openingSeen:true,active:true,eventsSeen:['homeward-03:enter']}));
   const p=CanvasRenderingContext2D.prototype,original=p.setTransform;p.setTransform=function(...a){if(this.canvas.id==='gameCanvas'&&a[0]!==1)window.matrix=a;return original.apply(this,a);};
  });
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.runFor(100);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')));
  const board=await page.locator('#spaceFrame').boundingBox(),panel=await page.locator('#homewardDialog').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=height);
  assert.equal(await page.locator('#homewardSectorList button').count(),8);assert.equal(await page.locator('[data-sector="homeward-04"]').isEnabled(),true);assert.equal(await page.locator('[data-sector="homeward-08"]').isDisabled(),true);
  await page.screenshot({path:fileURLToPath(new URL(`map-${width}x${height}.png`,dir))});
  await page.evaluate(async()=>{localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-20":3},"live":{}}');const {GalleryStore}=await import('./js/gallery-store.js');const old=await fetch('./reports/first-voyage/homeward-01-flight.json').then(r=>r.json());old.id='old-homeward-favorite';await new GalleryStore().save(old);await new GalleryStore().setFavorite(old.id,true);});
  const classic=await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1'));
  await page.locator('[data-sector="homeward-04"]').click();await page.locator('#homewardContinue').click();await page.clock.runFor(100);await page.locator('#tutorialSkip').click();
  assert.equal(await page.locator('#speedInput').inputValue(),'170','04 initial thrust');
  assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);assert.ok(await page.locator('#launchButton').isEnabled());
  await page.screenshot({path:fileURLToPath(new URL(`sector04-${width}x${height}.png`,dir))});
  if(width===375){
   for(const [number,angle,speed]of [['04',0,220],['05',0,200],['06',-13,170],['07',2,170],['08',0,200]]){
    if(number!=='04'){
     if(number==='07'){
      assert.equal(await page.locator('#homewardContinue').isDisabled(),true);
      await page.locator('#closeHomeward').click();await page.locator('#launchButton').click();assert.equal(await page.locator('#homeward-event').isVisible(),true);assert.equal(await page.locator('#homewardContinue').isDisabled(),true);
      await page.locator('#homewardEventChoices [data-choice="pursue"]').click();assert.match(await page.locator('#homewardEventChoices').textContent(),/600/);await page.locator('#homewardEventChoices [data-choice="avoid"]').click();
     }
     await page.locator('#homewardContinue').click();await page.clock.runFor(50);if(await page.locator('#tutorialSkip').isVisible())await page.locator('#tutorialSkip').click();
     if(number==='05'){await page.locator('#openMenuSettings').click();await page.locator('[data-launch-mode="precision"]').click();await page.locator('#closeMenuSettings').click();}
    }
    assert.equal(await page.locator('#speedInput').inputValue(),'170',`${number} initial thrust`);
    assert.equal(await page.locator('#angleInput').inputValue(),({'04':'0','05':'-5','06':'0','07':'0','08':'1'})[number],`${number} initial angle`);
    const fly=async()=>{await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');await page.clock.runFor(1200);};
    await fly();assert.equal(await page.locator('#resultLabel').textContent(),'MISSION FAILED');assert.equal((await state()).cleared.includes('homeward-'+number),false);
    await page.locator('#resetButton').click();await page.clock.runFor(50);assert.equal(await page.locator('#result').isVisible(),false);
    await page.locator('#angleInput').fill(String(angle));await page.locator('#speedInput').fill(String(speed));await page.clock.runFor(400);
    assert.equal(await page.locator('#previewStatus').textContent(),'ゴール到達予測');
    if(number==='04'){
     await page.locator('#openMenuSettings').click();await page.locator('#gameMode').selectOption('live');await page.locator('#cameraMode').selectOption('overview');await page.locator('[data-launch-mode="slingshot"]').click();await page.locator('#closeMenuSettings').click();await page.clock.runFor(100);
     const coords=await page.evaluate(()=>{const b=document.querySelector('#gameCanvas').getBoundingClientRect(),[a,,,d,e,f]=matrix;return [120,15].map(x=>({x:b.left+(a*x+e)/devicePixelRatio,y:b.top+(d*1100+f)/devicePixelRatio}));});
     await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();await page.mouse.move(coords[1].x,coords[1].y,{steps:5});await page.mouse.up();await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('cinematic');await page.locator('#closeMenuSettings').click();await page.locator('#flightRate').selectOption('100');await page.clock.runFor(1200);
    }else await fly();
    assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR',`${number}: ${await page.locator('#resultReason').textContent()}`);assert.ok((await state()).cleared.includes('homeward-'+number));
    await page.waitForFunction(id=>Boolean(JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')).journal[id]?.clearFlightId),'homeward-'+number);
    if(number==='07'){
     await page.reload();await page.clock.runFor(100);assert.equal((await state()).choices['homeward-07'],'avoid');assert.ok((await state()).cleared.includes('homeward-07'));
     await page.locator('[data-sector="homeward-08"]').click();
    }else await page.locator('#nextStage').click();
   }
   assert.equal(await page.locator('#homeward-map').isVisible(),true);assert.equal((await state()).cleared.length,8);
   await page.locator('summary').filter({hasText:'航海日誌・航行の再生'}).click();await page.screenshot({path:fileURLToPath(new URL('journal-375x667.png',dir))});
   await page.locator('#homewardJournal article').filter({hasText:'08 帰れない航路'}).getByRole('button',{name:'到着の航行をCINEMATIC再生'}).click();await page.clock.runFor(7500);
   assert.equal(await page.locator('#replayCamera').inputValue(),'cinematic');assert.equal(await page.locator('#replayResult').textContent(),'CLEAR');await page.screenshot({path:fileURLToPath(new URL('journal-cinematic-375x667.png',dir))});await page.locator('#closeGallery').click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1')),classic);
   const rows=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return new GalleryStore().list();});assert.equal(rows.find(r=>r.id==='old-homeward-favorite').favorite,true);
   assert.equal(rows.filter(r=>r.result==='clear'&&['homeward-04','homeward-05','homeward-06','homeward-07','homeward-08'].includes(r.stageId)).length,5);
   await writeFile(new URL('browser-save.json',dir),JSON.stringify(await state(),null,2));
  }
  assert.deepEqual(errors,[]);const scroll=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight,width:document.documentElement.scrollWidth}));assert.ok(scroll.height<=height+1);assert.ok(scroll.width<=width);
  results.push({width,height,board,panel,scroll,flow:width===375?'Five default failures → adjusted successes; live+slingshot; choice+reload; journal CINEMATIC; favorite and Classic preserved':'Map locks, briefing, skip and main controls',errors,status:'PASS',device:'PC Chrome viewport emulation; iPhone UNVERIFIED'});await context.close();
 }
 await writeFile(new URL('ui-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
