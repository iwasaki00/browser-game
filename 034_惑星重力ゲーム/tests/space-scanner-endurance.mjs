import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import {harness,root,tap} from './mobile-polish-harness.mjs';

// Three real minutes of scanner/catalogue/DOM reuse. No virtual clock, no save
// deletion, no change to physical limits, and no claim about iPhone thermals.
const h=await harness(),dir=new URL(process.argv.includes('--acceptance')?'reports/final-acceptance/':'reports/space-scanner/',root);
const result={version:process.argv.includes('--acceptance')?'2.0.0-rc.1':'1.9.4',browser:h.browser.version(),environment:{os:os.platform(),cpu:os.cpus()[0].model,viewport:'375x667',dpr:3},method:'6 x 30 real seconds, editing DEEP SPACE 12000x10000; CDP touch; memory sampled while menu-paused after forced GC; PC only',samples:[],errors:[]};
try{
 const context=await h.browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true,deviceScaleFactor:3}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.on('pageerror',e=>result.errors.push(e.stack));
 await page.goto(h.url+'/setup');
 await page.evaluate(async()=>{const {HOMEWARD_SECTORS}=await import('./js/homeward-data.js'),raw=await(await fetch('./reports/impossible-signal/browser-save.json')).json();raw.currentSector='homeward-deep';raw.active=true;raw.openingSeen=true;raw.cleared=HOMEWARD_SECTORS.slice(0,9).map(s=>s.id);raw.eventsSeen.push('homeward-deep:enter');raw.deep={checkpoint:'origin',selected:'return',targets:Object.fromEntries(['DS01','DS02','DS03','DS04','DS05','DS06'].map(id=>[id,{state:'INVESTIGATED'}]))};localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify(raw));});
 await page.goto(h.url);await page.waitForTimeout(3000);await cdp.send('Performance.enable');
 await page.evaluate(()=>{window.enduranceFrames=0;const f=()=>{enduranceFrames++;requestAnimationFrame(f);};requestAnimationFrame(f);});
 const saved=await page.evaluate(()=>localStorage.getItem('orbit-maker.homeward.v1'));
 const metrics=async()=>{const m=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(v=>[v.name,v.value]));return{time:Date.now(),frames:await page.evaluate(()=>enduranceFrames),task:m.TaskDuration};};
 const retained=async()=>{await tap(page,cdp,'#openMenuSettings');await page.waitForTimeout(150);await cdp.send('HeapProfiler.collectGarbage');const heap=(await cdp.send('Runtime.getHeapUsage')).usedSize,dom=await cdp.send('Memory.getDOMCounters');await tap(page,cdp,'#closeMenuSettings');return{heap,dom};};
 await tap(page,cdp,'#scanButton');await tap(page,cdp,'#scanCollapse');result.initial=await retained();const started=Date.now();
 for(let i=0;i<6;i++){
  const before=await metrics(),cycle=Date.now();
  await tap(page,cdp,'#scanSearch');await tap(page,cdp,'#scanNext');await tap(page,cdp,'#scanShow');await page.waitForTimeout(400);await tap(page,cdp,'#scanBack');await page.waitForTimeout(400);await tap(page,cdp,'#scanButton');await tap(page,cdp,'#scanButton');await tap(page,cdp,'#scanCollapse');
  await page.waitForTimeout(Math.max(0,30000-(Date.now()-cycle)));
  const after=await metrics(),memory=await retained(),seconds=(after.time-before.time)/1000;
  const row={cycle:i+1,elapsedSeconds:(Date.now()-started)/1000,seconds,fps:(after.frames-before.frames)/seconds,rendererTaskPercent:100*(after.task-before.task)/seconds,...memory};result.samples.push(row);
  assert.equal(await page.locator('#scanButton').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#launchButton').isEnabled(),true);assert.deepEqual(result.errors,[]);
  await writeFile(new URL('endurance.json',dir),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(row));
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('orbit-maker.homeward.v1')),saved);
 result.heapDelta=result.samples.at(-1).heap-result.initial.heap;result.domDelta=result.samples.at(-1).dom.nodes-result.initial.dom.nodes;
 // Broad growth guard for this bounded test, not a proof of leak absence.
 assert.ok(result.heapDelta<8*1048576,'retained heap exceeded +8 MiB');assert.ok(result.domDelta<300,'unexpected retained DOM growth');
 result.status='PASS';result.progress='unchanged';result.iPhone='UNVERIFIED';await writeFile(new URL('endurance.json',dir),JSON.stringify(result,null,2)+'\n');await context.close();console.log('SCANNER 3-MINUTE ENDURANCE PASS');
}finally{await h.close();}
