import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/big-space/',root),before=process.argv.includes('--before');
await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(150);
  const board=await page.locator('#spaceFrame').boundingBox();
  await page.screenshot({path:fileURLToPath(new URL(`${before?'before':'after'}-${width}x${height}.png`,dir))});
  results.push({width,height,board,errors});
  if(!before){
   assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
   assert.ok(board.height>height*.7);
   await page.locator('#openPlanetSettings').click();
   const panel=await page.locator('#planetPanel').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=height);
   assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
   await page.screenshot({path:fileURLToPath(new URL(`add-panel-${width}x${height}.png`,dir))});
   await page.locator('#closePlanetSettings').click();
   for(const selector of ['#openMenuSettings','#openPlanetSettings','#resetButton','#launchButton','#zoomIn','#zoomOut','#fitCamera']){
    assert.ok(await page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect(),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&(target===el||el.contains(target));}),`${width}: ${selector} clipped/covered`);
   }
   await page.locator('#openMenuSettings').click();
   const menuBox=await page.locator('#menuPanel').boundingBox();assert.ok(menuBox.y>=0&&menuBox.y+menuBox.height<=height);
   assert.equal(await page.locator('#menuPanel .settings-content').evaluate(e=>getComputedStyle(e).overflowY),'auto');
   assert.ok((await page.locator('#gameMode').boundingBox()).width>=150,'mode select should show its full label');
   await page.screenshot({path:fileURLToPath(new URL(`menu-${width}x${height}.png`,dir))});
   await page.locator('#openDisplaySettings').click();assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
   const displayBox=await page.locator('#displayPanel').boundingBox();assert.ok(displayBox.y>=0&&displayBox.y+displayBox.height<=height);
   await page.locator('#closeDisplaySettings').click();
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 if(!before){
  const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const proto=CanvasRenderingContext2D.prototype;
   window.probe={arcs:[],lines:[],rocket:null,matrix:null};
   for(const name of ['clearRect','setTransform','arc','lineTo','translate']){
    const original=proto[name];proto[name]=function(...args){
     if(this.canvas.id==='gameCanvas'){
      if(name==='clearRect'){probe.arcs=[];probe.lines=[];}
      if(name==='setTransform'&&args[0]!==1)probe.matrix=args;
      if(name==='arc')probe.arcs.push(args.slice(0,3));
      if(name==='lineTo')probe.lines.push(args.slice(0,2));
      if(name==='translate')probe.rocket=args;
     }
     return original.apply(this,args);
    };
   }
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(200);
  const world=async(x,y)=>page.evaluate(([x,y])=>{const b=document.querySelector('#gameCanvas').getBoundingClientRect(),[a,,,d,e,f]=probe.matrix,ratio=devicePixelRatio;return {x:b.left+(a*x+e)/ratio,y:b.top+(d*y+f)/ratio};},[x,y]);
  const tapWorld=async(x,y)=>{const p=await world(x,y);await page.touchscreen.tap(p.x,p.y);};
  const cdp=await context.newCDPSession(page);
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({id:p.id??i+1,x:p.x,y:p.y,radiusX:2,radiusY:2}))});
  const drag=async(a,b)=>{await touch('touchStart',[a]);await touch('touchMove',[b]);await touch('touchEnd',[]);await page.waitForTimeout(40);};
  const menu=()=>page.locator('#openMenuSettings').click();
  const closeMenu=()=>page.locator('#closeMenuSettings').click();
  // Add creates the chosen configuration; changing the panel choices never edits an existing body.
  await page.locator('#openPlanetSettings').click();await page.locator('#planetType').selectOption('dense');await page.locator('#planetSize').selectOption('small');await page.locator('#addPlanet').click();
  assert.equal(await page.locator('#planetPanel').evaluate(e=>e.open),false);assert.match(await page.locator('#planetSelection').textContent(),/高密度/);
  await page.locator('#deletePlanet').click();assert.equal(await page.locator('#selectionBar').isVisible(),false);
  // Zoom/pan transform and planet dragging use the same inverse matrix.
  await page.locator('#zoomIn').click();await page.waitForTimeout(30);const mousePlanet=await world(196,282);await page.mouse.click(mousePlanet.x,mousePlanet.y);assert.match(await page.locator('#planetSelection').textContent(),/地球型/);
  await drag(await world(196,282),await world(216,282));
  assert.ok(await page.evaluate(()=>probe.arcs.some(([x,y,r])=>Math.abs(x-216)<1&&Math.abs(y-282)<1&&r===38)));
  const beforeLines=await page.evaluate(()=>probe.lines);await page.locator('#zoomIn').click();await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>probe.lines),beforeLines,'camera must preserve prediction world points');
  await page.locator('#fitCamera').click();await page.waitForTimeout(30);
  await menu();await page.locator('[data-launch-mode="slingshot"]').click();await closeMenu();
  const origin=await world(48,430),second={x:origin.x+80,y:origin.y-40,id:2};
  const rocketBefore=await page.evaluate(()=>probe.rocket);
  await touch('touchStart',[origin]);await touch('touchStart',[origin,second]);
  await touch('touchMove',[{x:origin.x-12,y:origin.y+8},{...second,x:second.x+30,y:second.y-10}]);
  assert.notEqual(await page.locator('#cameraZoom').textContent(),'1.0×');
  await touch('touchEnd',[second]);await touch('touchMove',[{...second,x:second.x+10}]);await touch('touchEnd',[]);
  assert.equal(await page.locator('#launchButton').isDisabled(),false,'pinch must never fire slingshot');
  assert.deepEqual(await page.evaluate(()=>probe.rocket),rocketBefore,'camera must not change rocket world position');
  await page.locator('#fitCamera').click();await page.waitForTimeout(30);
  // Pointer cancel must not launch; subsequent drag remains usable.
  await touch('touchStart',[await world(48,430)]);await touch('touchCancel',[]);assert.equal(await page.locator('#launchButton').isDisabled(),false);
  await drag(await world(48,430),await world(0,490));assert.equal(await page.locator('#launchButton').isDisabled(),true);
  await page.locator('#resetButton').click();assert.equal(await page.locator('#launchButton').isDisabled(),false);assert.equal(await page.locator('#cameraZoom').textContent(),'1.0×');
  // Both launch modes remain available with live gravity; dialog open/close preserves tuners.
  await menu();await page.locator('#gameMode').selectOption('live');await page.locator('[data-launch-mode="precision"]').click();await closeMenu();
  await page.locator('#angleInput').fill('-64');const angle=await page.locator('#angleInput').inputValue();
  await menu();await page.locator('#openDisplaySettings').click();await page.locator('#soundToggle').click();
  await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
  await page.locator('#closeDisplaySettings').click();assert.equal(await page.locator('#angleInput').inputValue(),angle);
  await page.locator('#launchButton').click();await drag(await world(216,282),await world(230,282));await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>probe.arcs.some(([x,y,r])=>x>217&&Math.abs(y-282)<1&&r===38)),'live planet moves');
  await page.locator('#resetButton').click();
  await menu();await page.screenshot({path:fileURLToPath(new URL('menu-375x667.png',dir))});await page.locator('#openGallery').click();await page.waitForFunction(()=>document.querySelector('#galleryDialog').open);await page.locator('#closeGallery').click();
  // Seed only a disposable browser context. Real user saves and gallery are never touched.
  const originalProgress={design:{'stage-19':3,'stage-01':3},live:{'stage-10':2}};
  await page.evaluate(async progress=>{
   localStorage.setItem('orbit-maker.stage-progress.v1',JSON.stringify(progress));
   const {GalleryStore}=await import('./js/gallery-store.js');const store=new GalleryStore();
   await store.save({id:'protected-fixture',createdAt:1,fixture:true});await store.setFavorite('protected-fixture',true);
  },originalProgress);
  await page.reload();await menu();await page.locator('#openStages').click();assert.equal(await page.locator('#stageList>button').count(),20);
  await page.locator('#stageList>button').nth(19).click();await page.locator('#openPlanetSettings').click();
  assert.equal(await page.locator('#addPlanet').isDisabled(),true);assert.equal(await page.locator('#planetType').isDisabled(),true);assert.match(await page.locator('#addReason').textContent(),/固定/);
  await page.locator('#closePlanetSettings').click();
  const special=await page.evaluate(async()=>{const {getChallenge}=await import('./js/challenges.js');return getChallenge('stage-20').planets[0];});await tapWorld(special.x,special.y);assert.equal(await page.locator('#deletePlanet').isDisabled(),true);
  await page.locator('#resetButton').click();await page.locator('#zoomIn').click();await page.locator('#fitCamera').click();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1'))),originalProgress);
  assert.equal(await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list()).find(r=>r.id==='protected-fixture').favorite;}),true);
  await menu();await page.locator('#openStages').click();await page.locator('#freePlay').click();
  await menu();await page.locator('#specialSample').selectOption('blackhole');assert.equal(await page.locator('#menuPanel').evaluate(e=>e.open),false);
  await page.screenshot({path:fileURLToPath(new URL('special-camera-375x667.png',dir))});
  assert.deepEqual(errors,[]);results.push({interaction:'add/select/drag/delete; pinch/pan/cancel/slingshot; live gravity; Stage20 restrictions; RESET; prediction coordinates; sound route; old saves/favorites protected',status:'PASS',errors});
  await context.close();
  const html='<!doctype html><meta charset="utf-8"><style>body{margin:20px;background:#07101d;color:#dcf5ff;font:16px sans-serif}h1{font-size:22px}section{display:flex;gap:20px}img{width:320px}h2{font-size:16px}</style><h1>ORBIT MAKER — 375×667 / v0.9.1 → v0.9.2</h1><section><div><h2>変更前：351×328</h2><img src="before-375x667.png"></div><div><h2>変更後：365×516</h2><img src="after-375x667.png"></div></section>';
  await writeFile(new URL('comparison.html',dir),html);
  const compare=await browser.newPage({viewport:{width:700,height:700}});await compare.goto(`http://127.0.0.1:${server.address().port}/reports/big-space/comparison.html`);await compare.screenshot({path:fileURLToPath(new URL('comparison-375x667.png',dir)),fullPage:true});await compare.close();
 }
 await writeFile(new URL(`${before?'before':'after'}-measurements.json`,dir),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
