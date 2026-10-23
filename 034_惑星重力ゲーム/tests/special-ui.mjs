import {chromium}from'../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer}from'node:http';
import {readFile,mkdir,writeFile}from'node:fs/promises';
import {fileURLToPath}from'node:url';
import assert from'node:assert/strict';
const root=new URL('../',import.meta.url),report=new URL('reports/special/',root);await mkdir(report,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;
 if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();
 res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,isMobile:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const progress=await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1'));
 await page.locator('#planetPanel').evaluate(el=>el.open=true);
 assert.equal(await page.locator('#planetType option:enabled').count(),7);
 const statuses={blackhole:'ブラックホールに吸収',repulsor:'航行エリアを逸脱',star:'恒星の熱領域へ侵入',dense:'ゲート到達！'};
 for(const type of Object.keys(statuses)){
  await page.locator('#specialSample').selectOption(type);
  assert.equal(await page.locator('#planetType').inputValue(),type);assert.ok((await page.locator('#planetFeature').textContent()).length>0);
  await page.locator('#planetPanel').evaluate(el=>el.open=false);
  await page.waitForTimeout(100);await page.screenshot({path:fileURLToPath(new URL(`${type}-375.png`,report))});
  await page.locator('#launchButton').click();await page.locator('#result').waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator('#resultReason').textContent(),statuses[type]);
  await page.locator('#resetButton').click();await page.locator('#planetPanel').evaluate(el=>el.open=true);
  assert.equal(await page.locator('#planetType').inputValue(),type);
 }
 await page.locator('#planetType').selectOption('repulsor');await page.locator('#planetType').selectOption('earth');
 assert.match(await page.locator('#planetFeature').textContent(),/地球型/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('orbit-maker.stage-progress.v1')),progress);
 await page.setViewportSize({width:320,height:568});await page.locator('#specialSample').scrollIntoViewIfNeeded();
 const box=await page.locator('#specialSample').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=320);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#openStages').click();await page.locator('#stageList button').first().click();
 assert.equal(await page.locator('#planetType option:disabled').count(),6);assert.ok(await page.locator('#specialSample').isDisabled());
 assert.deepEqual(errors,[]);console.log('Special UI: 7 types, 4 samples, outcomes, RESET, progress isolation, 320px, stage restrictions PASS');
 await writeFile(new URL('ui-result.json',report),JSON.stringify({browser:'Windows Chrome, mobile viewport/touch emulation; not iPhone Safari',sizes:['375x667','320x568'],sampleOutcomes:statuses,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
