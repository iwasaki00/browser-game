import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {harness,root,dir} from './mobile-polish-harness.mjs';
const h=await harness(),rows=[],errors=[];
try{
 // Use the frozen rc.1 runtime copy, never rebuild it from the candidate.
 const manifest=JSON.parse(await readFile(new URL('reports/final-acceptance/release-audit.json',root),'utf8')).manifest;
 for(const file of manifest)assert.equal(createHash('sha256').update(await readFile(new URL('release-preview/'+file.file,root))).digest('hex'),file.sha256,'baseline '+file.file);
 for(let trial=0;trial<3;trial++)for(const candidate of trial%2?[true,false]:[false,true]){
  const context=await h.browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(h.url+'/setup');await page.evaluate(async()=>{const {HOMEWARD_SECTORS}=await import('./js/homeward-data.js'),raw=await(await fetch('./reports/impossible-signal/browser-save.json')).json();raw.currentSector='homeward-deep';raw.active=true;raw.openingSeen=true;raw.cleared=HOMEWARD_SECTORS.slice(0,9).map(s=>s.id);raw.eventsSeen.push('homeward-deep:enter');raw.deep={selected:'return',checkpoint:'origin',targets:Object.fromEntries(['DS01','DS02','DS03','DS04','DS05','DS06'].map(id=>[id,{state:'INVESTIGATED'}]))};localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify(raw));});
  await page.goto(h.url+(candidate?'/':'/release-preview/'));await page.locator('#scanButton').click();await page.locator('#scanCollapse').click();await page.waitForTimeout(2000);
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await page.evaluate(()=>{window.benchFrames=0;window.guideMutations=0;const f=()=>{benchFrames++;requestAnimationFrame(f);};requestAnimationFrame(f);const observer=new MutationObserver(m=>guideMutations+=m.length);for(const id of ['missionGuideButton','missionGuideDialog']){const e=document.getElementById(id);if(e)observer.observe(e,{subtree:true,attributes:true,childList:true,characterData:true});}});
  const sample=async()=>{const m=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));return{wall:Date.now(),frames:await page.evaluate(()=>benchFrames),task:m.TaskDuration};};
  const a=await sample();await page.waitForTimeout(8000);const b=await sample(),seconds=(b.wall-a.wall)/1000;await cdp.send('HeapProfiler.collectGarbage');const row={trial:trial+1,candidate,seconds,fps:(b.frames-a.frames)/seconds,rendererTaskPercent:100*(b.task-a.task)/seconds,heap:(await cdp.send('Runtime.getHeapUsage')).usedSize,guideMutations:await page.evaluate(()=>guideMutations)};rows.push(row);console.log(JSON.stringify(row));assert.equal(row.guideMutations,0,'stable guide must not rewrite DOM');await context.close();
 }
 const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],baseline=median(rows.filter(r=>!r.candidate).map(r=>r.fps)),candidate=median(rows.filter(r=>r.candidate).map(r=>r.fps));
 assert.deepEqual(errors,[]);const result={browser:h.browser.version(),environment:{os:os.platform(),cpu:os.cpus()[0].model,viewport:'375x667',dpr:3},method:'real wall clock, alternating rc.1 / rc.2 order, 3 paired DEEP SPACE SCAN trials; fixed baseline hash verified; PC only; 8 seconds each after warmup',rows,baselineMedianFps:baseline,candidateMedianFps:candidate,ratio:candidate/baseline,comparison:candidate>=baseline*.9?'within 10 percent of baseline in this measurement':'candidate slower by over 10 percent; investigate',guideStableDom:'PASS: zero mutations during stable state',errors,iPhone:'UNVERIFIED'};
 await writeFile(new URL('performance.json',dir),JSON.stringify(result,null,2)+'\n');
}finally{await h.close();}
