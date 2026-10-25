import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/expanded-space/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const [width,height]of[[320,568],[375,667],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const proto=CanvasRenderingContext2D.prototype,transform=proto.setTransform,translate=proto.translate;
   proto.setTransform=function(...a){if(this.canvas.id==='gameCanvas'&&a[0]!==1)window.worldMatrix=a;return transform.apply(this,a);};
   proto.translate=function(x,y){if(this.canvas.id==='gameCanvas')window.rocketPoint={x,y};return translate.call(this,x,y);};
  });
  await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.runFor(100);
  const board=await page.locator('#spaceFrame').boundingBox();
  await page.locator('#openMenuSettings').click();await page.locator('#hugeSample').selectOption('voyage');await page.clock.runFor(1800);
  assert.equal(await page.locator('#cameraZoom').textContent(),'0.10×');assert.equal(await page.locator('#minimap').isVisible(),true);
  assert.deepEqual(await page.locator('#spaceFrame').boundingBox(),board);
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]),[width,height]);
  await page.screenshot({path:fileURLToPath(new URL(`huge-overview-${width}x${height}.png`,dir))});
  if(width===375){
   const world=async(x,y)=>page.evaluate(([x,y])=>{const b=document.querySelector('#gameCanvas').getBoundingClientRect(),[a,,,d,e,f]=worldMatrix;return {x:b.left+(a*x+e)/devicePixelRatio,y:b.top+(d*y+f)/devicePixelRatio};},[x,y]);
   // A 38-world-unit planet remains selectable at .1x using a 22 CSS-pixel hit area.
   const p=await world(1000,3300);await page.touchscreen.tap(p.x+10,p.y);assert.equal(await page.locator('#selectionBar').isVisible(),true);
   const move=async(from,to)=>{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();};
   await move(await world(2164,879),await world(2564,1279));await page.clock.runFor(2000);assert.notEqual(await page.locator('#previewStatus').textContent(),'ゴール到達予測');
   await move(await world(2564,1279),await world(2164,879));await page.clock.runFor(2000);assert.equal(await page.locator('#previewStatus').textContent(),'ゴール到達予測');
   await page.locator('#openMenuSettings').click();await page.locator('#cameraMode').selectOption('follow');await page.locator('#closeMenuSettings').click();
   await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();assert.equal(await page.locator('#cameraMode').inputValue(),'follow');
   await page.locator('#launchButton').click();await page.clock.runFor(8000);
   const following=await page.evaluate(()=>{const [a,,,d,e,f]=worldMatrix,b=document.querySelector('#gameCanvas').getBoundingClientRect();return {screen:{x:(rocketPoint.x*a+e)/devicePixelRatio,y:(rocketPoint.y*d+f)/devicePixelRatio},center:{x:b.width/2,y:b.height/2},world:rocketPoint};});
   assert.ok(Math.hypot(following.screen.x-following.center.x,following.screen.y-following.center.y)<2);assert.ok(following.world.y<3300);
   await page.screenshot({path:fileURLToPath(new URL('huge-follow-375x667.png',dir))});
   const cdp=await context.newCDPSession(page),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const a={id:1,x:100,y:250},b={id:2,x:200,y:250};await touch('touchStart',[a]);await touch('touchStart',[a,b]);await touch('touchMove',[{...a,x:110,y:260},{...b,x:220,y:260}]);await touch('touchEnd',[]);assert.equal(await page.locator('#cameraMode').inputValue(),'fixed');
   await page.locator('#fitCamera').click();await page.clock.runFor(12000);assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');
   const record=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list())[0];});
   assert.equal(record.result,'clear');assert.equal(record.world.width,3750);assert.ok(record.duration>12);assert.ok(record.frames.at(-1)[1]>2000);assert.equal(record.frames.at(-1)[0],record.duration);
   await writeFile(new URL('browser-flight.json',dir),JSON.stringify(record));
   await page.screenshot({path:fileURLToPath(new URL('huge-clear-375x667.png',dir))});
   await page.locator('#resetButton').click();assert.equal(await page.locator('#cameraZoom').textContent(),'0.10×');assert.equal(await page.locator('#launchButton').isDisabled(),false);
   await page.locator('#openMenuSettings').click();await page.locator('#openGallery').click();await page.locator('.gallery-record').first().click();await page.clock.runFor(19000);assert.equal(await page.locator('#replayResult').textContent(),'CLEAR');await page.locator('#replayBack').click();await page.getByRole('button',{name:'☆ お気に入り',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#galleryCount').textContent.includes('お気に入り 1/30'));await page.locator('#closeGallery').click();
   await page.locator('#openMenuSettings').click();await page.locator('#minimapToggle').click();await page.locator('#closeMenuSettings').click();await page.clock.runFor(50);assert.equal(await page.locator('#minimap').isVisible(),false);
   // Existing storage is only seeded inside this isolated browser context.
   const progress={design:{'stage-19':3},live:{'stage-01':2}};
   await page.evaluate(p=>localStorage.setItem('orbit-maker.stage-progress.v1',JSON.stringify(p)),progress);await page.reload();await page.clock.runFor(50);
   await page.locator('#openMenuSettings').click();await page.locator('#openStages').click();await page.locator('#stageList>button').nth(19).click();await page.locator('#openMenuSettings').click();assert.equal(await page.locator('#worldSize').isDisabled(),true);assert.equal(await page.locator('#hugeSample').isDisabled(),true);await page.locator('#closeMenuSettings').click();
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1'))),progress);
   const restored=await page.evaluate(async()=>{const {GalleryStore}=await import('./js/gallery-store.js');return (await new GalleryStore().list())[0];});assert.equal(restored.id,record.id);assert.equal(restored.favorite,true);
   results.push({browserFlight:{duration:record.duration,world:record.world,start:record.frames[0],end:record.frames.at(-1),frames:record.frames.length},follow:following});
  }
  assert.deepEqual(errors,[]);results.push({width,height,board,errors,status:'PASS'});await context.close();
 }
 await writeFile(new URL('ui-results.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
