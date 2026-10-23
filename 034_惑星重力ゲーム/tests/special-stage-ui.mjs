import{chromium}from'../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import{createServer}from'node:http';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import assert from'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/special-challenges/',root);await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;
 if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();
 res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('orbit-maker.stage-progress.v1'))localStorage.setItem('orbit-maker.stage-progress.v1',JSON.stringify({design:{'stage-10':3},live:{'stage-05':2}}));});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#openStages').click();assert.equal(await page.locator('#stageList button').count(),20);
 assert.ok(await page.locator('#stageList button').nth(10).isEnabled());assert.ok(await page.locator('#stageList button').nth(11).isDisabled());
 await page.locator('#stageList button').nth(10).click();assert.match(await page.locator('.mission strong').textContent(),/11 小さな巨人/);
 assert.match(await page.locator('#statusText').textContent(),/高密度惑星/);
 await page.locator('#planetPanel').evaluate(el=>el.open=true);
 for(const id of ['planetType','planetSize','deletePlanet','addPlanet'])assert.ok(await page.locator('#'+id).isDisabled());
 assert.match(await page.locator('#challengeConditions').textContent(),/±12/);
 await page.locator('#planetPanel').evaluate(el=>el.open=false);
 await page.locator('#angleInput').fill('-70');await page.locator('#speedInput').fill('170');await page.locator('#launchButton').click();
 await page.locator('#result.success').waitFor({timeout:10000});assert.equal(await page.locator('#clearStars').textContent(),'★★★');
 await page.locator('#nextStage').click();assert.match(await page.locator('.mission strong').textContent(),/12 重力の針穴/);
 // Record drawing positions without exposing or mutating the game model.
 await page.evaluate(()=>{const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){if(r===18)window.lastDense={x,y};return arc.call(this,x,y,r,...rest);};});
 const point=async(x,y)=>page.locator('#gameCanvas').evaluate((el,{x,y})=>{const b=el.getBoundingClientRect(),f=document.querySelector('#spaceFrame').getBoundingClientRect(),s=Math.min(f.width/375,f.height/500);return{x:b.x+(f.width-375*s)/2+x*s,y:b.y+(f.height-500*s)/2+y*s};},{x,y});
 const start=await point(180,240),end=await point(186,246);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y);await page.mouse.up();await page.waitForTimeout(60);
 // Browser mouse coordinates are quantized to screen pixels on the scaled board.
 const moved=await page.evaluate(()=>lastDense);assert.ok(moved.x>182&&moved.y>242&&Math.hypot(moved.x-186,moved.y-246)<3,JSON.stringify(moved));
 await page.locator('#resetButton').click();await page.waitForTimeout(60);assert.deepEqual(await page.evaluate(()=>lastDense),{x:180,y:240});
 await page.locator('#gameMode').selectOption('live');await page.locator('#angleInput').fill('-68');await page.locator('#speedInput').fill('208');
 await page.locator('#launchButton').click();await page.locator('#result.success').waitFor({timeout:10000});assert.equal(await page.locator('#clearStars').textContent(),'★★★');
 await page.locator('#retryButton').click();await page.locator('#openStages').click();await page.locator('#freePlay').click();
 assert.equal(await page.locator('#angleInput').getAttribute('min'),'-72');assert.equal(await page.locator('#angleInput').getAttribute('max'),'-35');
 assert.equal(await page.locator('#speedInput').getAttribute('min'),'120');assert.equal(await page.locator('#speedInput').getAttribute('max'),'220');
 await page.reload();await page.locator('#openStages').click();assert.ok(await page.locator('#stageList button').nth(12).isEnabled());
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1')));assert.equal(saved.design['stage-10'],3);assert.equal(saved.live['stage-05'],2);assert.equal(saved.live['stage-12'],3);
 await page.locator('#stageList button').nth(10).scrollIntoViewIfNeeded();
 await page.screenshot({path:fileURLToPath(new URL('selection-375.png',dir))});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await writeFile(new URL('ui-result.json',dir),JSON.stringify({browser:'Windows Chrome, mobile viewport 375x667; iPhone Safari not tested',oldSavePreserved:true,unlock10to11:true,reset:true,modeRecords:true,errors},null,2));
 console.log('Special stage UI PASS: 375px, old save, 10→11 unlock, constraints, clear/next, drag/RESET, live, free play, reload');
}finally{await browser.close();await new Promise(r=>server.close(r));}
