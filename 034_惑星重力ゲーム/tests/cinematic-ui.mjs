import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/cinematic-camera/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const url=`http://127.0.0.1:${server.address().port}`;
async function telemetry(page){await page.evaluate(async()=>{
 const {CinematicCamera}=await import('./js/cinematic-camera.js'),original=CinematicCamera.prototype.update;window.cameraSamples=[];
 CinematicCamera.prototype.update=function(camera,state,...args){const started=performance.now(),value=original.call(this,camera,state,...args),cost=performance.now()-started,p=camera.toScreen(state.rocket.position);if(cameraSamples.length<10000)cameraSamples.push({phase:this.phase,status:state.status,time:state.elapsed,mode:camera.mode,zoom:camera.zoom,center:{...camera.center},screen:p,width:camera.width,height:camera.height,cost});return value;};
});}
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(url);await page.clock.runFor(50);await telemetry(page);
  const board=await page.locator('#spaceFrame').boundingBox();
  const choose=async mode=>{await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption(mode);await page.locator('#closeMenuSettings').click();};
  await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await choose('cinematic');await page.clock.runFor(1800);
  assert.equal(await page.locator('#cameraModeBadge').textContent(),'CINEMATIC');
  assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  await page.locator('#launchButton').click();await page.clock.runFor(200);
  await page.screenshot({path:fileURLToPath(new URL(`launch-${width}x${height}.png`,dir))});
  if(width===375){
   // Take only the selected camera feature through its manual override paths.
   const cdp=await context.newCDPSession(page),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
   const a={id:1,x:70,y:230},b={id:2,x:190,y:230};
   await touch('touchStart',[a]);await touch('touchMove',[{...a,x:73}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'cinematic');
   await touch('touchStart',[a]);await touch('touchMove',[{...a,x:100,y:250}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
   await choose('cinematic');await page.clock.runFor(20);assert.equal(await page.locator('#cameraModeBadge').textContent(),'CINEMATIC');
   await touch('touchStart',[a]);await touch('touchStart',[a,b]);await touch('touchMove',[{...a,x:55,y:240},{...b,x:205,y:240}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
   await choose('cinematic');await page.locator('#zoomOut').click();assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
   await choose('cinematic');await page.locator('#fitCamera').click();assert.equal(await page.locator('#cameraMode').inputValue(),'overview');
   await choose('cinematic');await page.evaluate(()=>{cameraSamples=[];});
   // Capture a real encounter in the same flight; camera changes do not touch it.
   for(let i=0;i<36;i++){
    await page.clock.runFor(500);
    if(await page.evaluate(()=>cameraSamples.at(-1)?.phase==='planet')){await page.clock.runFor(650);await page.screenshot({path:fileURLToPath(new URL('planet-encounter-375x667.png',dir))});break;}
   }
   await page.clock.runFor(19000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');
   const list=()=>page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list())[0];});
   const reference=await list();assert.equal(reference.duration,17.749999999999634);
   const phases=await page.evaluate(()=>[...new Set(cameraSamples.map(x=>x.phase))]);assert.ok(phases.includes('planet')&&phases.includes('goal')&&phases.includes('arrival'));
   await page.screenshot({path:fileURLToPath(new URL('arrival-375x667.png',dir))});
   await page.locator('#resetButton').click();assert.equal(await page.locator('#cameraMode').inputValue(),'cinematic');
   await page.clock.runFor(800);await page.evaluate(()=>{cameraSamples=[];});await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');await page.clock.runFor(500);
   assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');const fast=await list();assert.deepEqual(fast.frames,reference.frames);
   const samples=await page.evaluate(()=>cameraSamples.filter(x=>x.status==='flying'));
   assert.ok(samples.length<100);for(const s of samples){assert.ok(s.zoom>=.1&&s.zoom<=3);assert.ok(s.screen.x>=19&&s.screen.x<=s.width-19&&s.screen.y>=19&&s.screen.y<=s.height-19);}
   results.push({rates:[1,100],duration:fast.duration,end:fast.frames.at(-1),frames:fast.frames.length,phases,fastCameraFrames:samples.length,manualOverrides:'tap threshold / pan / pinch / zoom buttons / overview / resume PASS'});
  }else{await page.locator('#flightRate').selectOption('100');await page.clock.runFor(500);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');}
  assert.deepEqual(errors,[]);results.push({width,height,board,errors,status:'PASS'});await context.close();
 }
 // Additional camera cost only, PC Chrome real time (no emulated timer).
 const context=await browser.newContext({viewport:{width:375,height:667}}),page=await context.newPage();await page.goto(url);await telemetry(page);
 await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('cinematic');await page.locator('#closeMenuSettings').click();
 await page.locator('#launchButton').click();await page.locator('#flightRate').selectOption('100');await page.waitForFunction(()=>!document.querySelector('#result').hidden);
 const cost=await page.evaluate(()=>{const samples=cameraSamples.filter(s=>s.status==='flying'||s.status==='cleared');return {samples:samples.length,maxMs:Math.max(...samples.map(s=>s.cost)),meanMs:samples.reduce((a,s)=>a+s.cost,0)/samples.length};});
 results.push({cameraCost:cost,environment:'PC Chrome headless real time; not iPhone'});await context.close();
 await writeFile(new URL('browser-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
