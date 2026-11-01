import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import {harness,dir} from './mobile-polish-harness.mjs';
import {CHALLENGES} from '../js/challenges.js';
const h=await harness(),result={browser:h.browser.version(),environment:{os:os.platform(),cpu:os.cpus()[0].model,viewport:'375x667',dpr:3},method:'PC Chrome, real wall clock, Stage01 actual flight at 1x repeated six times; not iPhone',errors:[]};
try{
 const context=await h.browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true,deviceScaleFactor:3}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.on('pageerror',e=>result.errors.push(e.stack));await page.goto(h.url);
 await page.locator('#openMenuSettings').click();await page.locator('#openStages').click();await page.locator('#stageList button').first().click();
 await page.locator('#angleInput').fill(String(CHALLENGES[0].threeStarSolution.angleDeg));await page.locator('#speedInput').fill(String(CHALLENGES[0].threeStarSolution.speed));
 await cdp.send('Performance.enable');await page.evaluate(()=>{window.acceptanceFrames=0;const f=()=>{acceptanceFrames++;requestAnimationFrame(f);};requestAnimationFrame(f);});
 const sample=async()=>{await cdp.send('HeapProfiler.collectGarbage');const m=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));return{time:Date.now(),frames:await page.evaluate(()=>acceptanceFrames),heap:(await cdp.send('Runtime.getHeapUsage')).usedSize,dom:await cdp.send('Memory.getDOMCounters'),task:m.TaskDuration};};
 const before=await sample();
 for(let i=0;i<6;i++){if(i)await page.locator('#retryButton').click();await page.locator('#launchButton').click();assert.equal(await page.locator('#flightRate').inputValue(),'1');await page.locator('#result.success').waitFor({timeout:15000});}
 const after=await sample(),seconds=(after.time-before.time)/1000;
 Object.assign(result,{status:'PASS',seconds,fps:(after.frames-before.frames)/seconds,rendererTaskPercent:100*(after.task-before.task)/seconds,before,after,heapDelta:after.heap-before.heap,domDelta:after.dom.nodes-before.dom.nodes,clears:6});
 assert.deepEqual(result.errors,[]);await writeFile(new URL('classic-performance.json',dir),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await context.close();
}finally{await h.close();}
