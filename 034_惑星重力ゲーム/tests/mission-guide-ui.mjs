import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {harness,dir,tap} from './mobile-polish-harness.mjs';
const h=await harness(),result={browser:h.browser.version(),device:'PC Chrome CDP touch / emulated viewport, not iPhone',screens:[],navigation:[],errors:[]};
try{
 for(const [width,height]of [[320,568],[375,667],[390,844],[430,932]]){
  const context=await h.browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  page.on('pageerror',e=>result.errors.push(e.stack));
  await page.addInitScript(()=>{const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='gameCanvas'&&String(t).startsWith('T+'))window.guideFlightTime=t;return f.call(this,t,...a);};});
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
  await page.clock.install();await page.goto(h.url);await page.clock.runFor(300);
  const board=await page.locator('#gameCanvas').boundingBox();
  for(const id of ['missionGuideButton','openMenuSettings','launchButton','resetButton']){const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=width&&b.y>=59&&b.y+b.height<=height-34&&b.height>=44,id);}
  await tap(page,cdp,'#missionGuideButton');assert.equal(await page.locator('#missionGuideDialog').getAttribute('data-state'),'prepare');
  assert.match(await page.locator('#missionGuideSteps').textContent(),/ANGLE/);assert.equal(await page.locator('#gameCanvas').boundingBox().then(b=>b.height),board.height);
  const panel=await page.locator('#missionGuideDialog').boundingBox();assert.ok(panel.y>=59&&panel.y+panel.height<=height-34);
  await page.screenshot({path:fileURLToPath(new URL(`guide-${width}.png`,dir))});await tap(page,cdp,'#missionGuideAction');await page.locator('#angleInput').fill('-54.5');await page.clock.runFor(250);
  await tap(page,cdp,'#missionGuideButton');assert.equal(await page.locator('#missionGuideDialog').getAttribute('data-state'),'launch');await tap(page,cdp,'#missionGuideAction');await page.clock.runFor(100);assert.equal(await page.locator('#flightSpeed').isVisible(),true);
  await tap(page,cdp,'#missionGuideButton');assert.equal(await page.locator('#missionGuideDialog').getAttribute('data-state'),'flying');const time=await page.evaluate(()=>guideFlightTime);await page.clock.runFor(1500);assert.equal(await page.evaluate(()=>guideFlightTime),time);await tap(page,cdp,'#missionGuideClose');await page.clock.runFor(100);await tap(page,cdp,'#resetButton');
  await tap(page,cdp,'#openMenuSettings');for(const id of ['startExperience','chooseClassic','openHomeward','chooseFreeSpace','openGallery'])assert.equal(await page.locator('#'+id+' small').count(),1);await page.screenshot({path:fileURLToPath(new URL(`modes-${width}.png`,dir))});await tap(page,cdp,'#closeMenuSettings');
  await tap(page,cdp,'#scanButton');await tap(page,cdp,'#scanSearch');assert.equal(await page.locator('#scanPanel').isVisible(),true);await tap(page,cdp,'#missionGuideButton');assert.equal(await page.locator('#missionGuideDialog').getAttribute('data-state'),'scan');await tap(page,cdp,'#missionGuideClose');assert.equal(await page.locator('#scanPanel').isVisible(),true);await tap(page,cdp,'#scanButton');
  assert.ok(await page.locator('.mission-target').count()<=1);assert.deepEqual(await page.evaluate(()=>[scrollX,scrollY,document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[0,0,width,height]);
  await page.screenshot({path:fileURLToPath(new URL(`main-${width}.png`,dir))});result.screens.push({width,height,board,panel,status:'PASS'});await context.close();console.log('SCREEN',width,'PASS');
 }
 for(const sector of ['homeward-09','homeward-deep']){
  const context=await h.browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true}),page=await context.newPage(),cdp=await context.newCDPSession(page);page.on('pageerror',e=>result.errors.push(e.stack));
  await page.goto(h.url+'/setup');await page.evaluate(async sector=>{const {HOMEWARD_SECTORS}=await import('./js/homeward-data.js'),raw=await(await fetch('./reports/impossible-signal/browser-save.json')).json();raw.currentSector=sector;raw.cleared=HOMEWARD_SECTORS.slice(0,sector==='homeward-09'?8:9).map(s=>s.id);raw.active=true;raw.openingSeen=true;raw.eventsSeen.push(sector+':enter');raw.echoes={};raw.frontier={targets:{D01:{state:'DETECTED'}}};raw.voyage={selected:'gate',checkpoint:'origin'};raw.deep={selected:'return',checkpoint:'origin',targets:{DS01:{state:'DETECTED'}}};localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify(raw));localStorage.setItem('classic-sentinel','KEEP');},sector);
  await page.clock.install();await page.goto(h.url);await page.clock.runFor(500);await tap(page,cdp,'#openDestinations');
  const section=sector==='homeward-09'?'#voyageNavigation':'#deepNavigation',policy=sector==='homeward-09'?'data-echo-route':'data-deep-policy',destination=sector==='homeward-09'?'[data-destination="probe"]':'[data-deep-destination="DS01"]';
  assert.equal(await page.locator(section+' .route-step').count(),4);assert.equal(await page.locator(section+' ['+policy+']').count(),3);
  assert.ok(!(await page.locator(section).textContent()).includes('時間異常観測点'));
  for(let i=0;i<4;i++){await tap(page,cdp,section+' ['+policy+'="'+(sector==='homeward-09'?'return':'direct')+'"]');await page.clock.runFor(50);assert.equal(await page.locator(section+' .route-guide').count(),1);assert.equal(await page.locator(section+' ['+policy+']').count(),3);}
  await tap(page,cdp,section+' '+destination);await page.clock.runFor(100);assert.match(await page.locator(section+' .route-step').nth(2).textContent(),/検出済み・未調査/);
  await page.screenshot({path:fileURLToPath(new URL(`route-${sector}.png`,dir))});await tap(page,cdp,section+' [data-route-continue]');assert.equal(await page.locator('#homewardDialog').isVisible(),false);
  const title=await page.locator('#missionGuideButton').getAttribute('aria-label');await page.reload();await page.clock.runFor(500);assert.equal(await page.locator('#missionGuideButton').getAttribute('aria-label'),title);assert.equal(await page.evaluate(()=>localStorage.getItem('classic-sentinel')),'KEEP');
  result.navigation.push({sector,status:'PASS',checks:'four steps, actual selection handlers, no duplicates, unknown identity hidden, return to flight, restore guide and destination, classic sentinel'});await context.close();console.log('ROUTE',sector,'PASS');
 }
 assert.deepEqual(result.errors,[]);result.status='PASS';await writeFile(new URL('browser.json',dir),JSON.stringify(result,null,2)+'\n');
}finally{await h.close();}
