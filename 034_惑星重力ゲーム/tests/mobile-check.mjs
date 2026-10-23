// Focused local Chrome viewport check; uses the repository's existing Playwright.
import { chromium } from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=process.argv.includes('--baseline');
const reportDir=path.join(root,'reports','mobile');
await mkdir(reportDir,{recursive:true});
const server=createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const [width,height] of [[375,667],[390,844],[393,852],[320,568]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForTimeout(350);
  const metrics=await page.evaluate(()=>({
   viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
   board:document.querySelector('#spaceFrame').getBoundingClientRect().toJSON(),
   controls:[...document.querySelectorAll('button,select,input,summary')].filter(el=>el.checkVisibility()).map(el=>({id:el.id||el.textContent.trim(),...el.getBoundingClientRect().toJSON()})),
  }));
  await page.screenshot({path:path.join(reportDir,`${baseline?'before':'after'}-${width}x${height}.png`)});
  results.push({size:`${width}x${height}`,metrics,errors});
  if(!baseline) {
   const assert=(condition,message)=>{if(!condition)throw Error(`${width}x${height}: ${message}`);};
   assert(metrics.document[0]<=width,'horizontal overflow');
   assert(metrics.document[1]<=height,'page overflow');
   assert(metrics.board.height>=240,'board too short');
   for(const selector of ['#gameMode','[data-launch-mode="precision"]','[data-launch-mode="slingshot"]','#angleInput','#speedInput','#resetButton','#launchButton']) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const box=await page.locator(selector).boundingBox();
    assert(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`control unreachable: ${selector}`);
   }
   for(const panel of ['planetPanel','displayPanel']) {
    await page.locator(`#${panel}`).evaluate(el=>el.open=true);
    for(const control of await page.locator(`#${panel} button,#${panel} select`).all()) {
     await control.scrollIntoViewIfNeeded(); const box=await control.boundingBox();
     assert(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`expanded control clipped: ${panel}`);
     assert(box.height>=44,'touch target too small');
    }
    await page.locator(`#${panel}`).evaluate(el=>el.open=false);
   }
   await page.locator('[data-launch-mode="slingshot"]').click();
   assert(await page.locator('#slingshotGuide').isVisible(),'slingshot guide hidden');
   assert(await page.locator('#launchButton').isHidden(),'precision launch not hidden');
   await page.locator('[data-launch-mode="precision"]').click();
   await page.locator('#gameMode').selectOption('live');
   assert((await page.locator('#gameModeHelp').textContent()).includes('重力操作'),'mode switch failed');
   await page.locator('#launchButton').click();
   assert(await page.locator('#gameMode').isDisabled(),'mode unlocked in flight');
   await page.locator('#resetButton').click();
   assert(await page.locator('#launchButton').isEnabled(),'reset did not restore launch');
   assert(await page.locator('#gameMode').inputValue()==='live','reset lost mode');
   assert(errors.length===0,`runtime errors: ${errors}`);
   if(width===375) {
    await page.evaluate(async()=>{
     const {PreviewController}=await import('./js/preview.js');
     window.mobileQA={arcs:[],predictionMs:[],frames:[]};
     const original=PreviewController.prototype.update;
     PreviewController.prototype.update=function(...args){const start=performance.now();const result=original.apply(this,args);window.mobileQA.predictionMs.push(performance.now()-start);return result;};
     const arc=CanvasRenderingContext2D.prototype.arc;
     CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){if(r===38)window.mobileQA.arcs.push({x,y});return arc.call(this,x,y,r,...rest);};
     let last=performance.now();function sample(now){window.mobileQA.frames.push(now-last);last=now;if(window.mobileQA.frames.length<180)requestAnimationFrame(sample);}requestAnimationFrame(sample);
    });
    const cdp=await context.newCDPSession(page);
    const screen=async(x,y)=>page.locator('#gameCanvas').evaluate((el,{x,y})=>{const r=el.getBoundingClientRect(),s=Math.min(r.width/375,r.height/500);return {x:r.x+(r.width-375*s)/2+x*s,y:r.y+(r.height-500*s)/2+y*s};},{x,y});
    const touch=async(type,x,y)=>{const point=await screen(x,y);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{...point,id:1}]});};
    await touch('touchStart',196,282);
    for(let i=1;i<=12;i++){await touch('touchMove',196+i*3,282+i);await page.waitForTimeout(16);}
    await touch('touchEnd',232,294);
    assert(await page.evaluate(()=>mobileQA.arcs.some(p=>p.x>225)),'touch planet drag failed');
    assert(await page.evaluate(()=>scrollY===0&&getSelection().toString()===''),'page scrolled or selected during drag');
    await page.locator('#resetButton').click();
    await page.locator('#displayPanel').evaluate(el=>el.open=true);
    await page.locator('#gravityToggle').click();await page.locator('#previewToggle').click();
    assert(await page.locator('#previewToggle').getAttribute('aria-pressed')==='false','preview off failed');
    await page.locator('#previewToggle').click();
    await page.locator('#displayPanel').evaluate(el=>el.open=false);
    await page.locator('[data-launch-mode="slingshot"]').click();
    await touch('touchStart',48,430);await touch('touchMove',0,490);await page.waitForTimeout(100);
    await touch('touchEnd',0,490);
    assert(await page.locator('#gameMode').isDisabled(),'touch slingshot failed');
    await page.evaluate(()=>mobileQA.arcs=[]);
    await touch('touchStart',196,282);await touch('touchMove',280,310);await page.waitForTimeout(150);
    await touch('touchEnd',280,310);
    assert(await page.evaluate(()=>mobileQA.arcs.some(p=>p.x>198)),'live touch movement failed');
    await page.locator('#resetButton').click();
    await page.waitForTimeout(80);
    assert(await page.evaluate(()=>mobileQA.arcs.at(-1).x===196),'reset position failed');
    results.at(-1).performance=await page.evaluate(()=>{
     const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b);return {samples:a.length,p95:sorted[Math.floor(sorted.length*.95)]??0,max:Math.max(0,...a)};};
     return {predictionUpdateMs:stats(mobileQA.predictionMs),frameIntervalMs:stats(mobileQA.frames)};
    });
   }
   await page.locator('.controls-body').evaluate(el=>el.scrollTop=0);
  }
  await context.close();
 }
 await writeFile(path.join(reportDir,baseline?'before.json':'after.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({size:r.size,document:r.metrics.document,boardHeight:r.metrics.board.height,errors:r.errors})),null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
