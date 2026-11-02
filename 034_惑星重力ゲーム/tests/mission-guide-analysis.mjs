import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness,dir,tap} from './mobile-polish-harness.mjs';
const h=await harness(),errors=[];
try{
 const context=await h.browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true}),page=await context.newPage(),cdp=await context.newCDPSession(page);page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(h.url+'/setup');await page.evaluate(async()=>{const {HOMEWARD_SECTORS}=await import('./js/homeward-data.js'),raw=await(await fetch('./reports/impossible-signal/browser-save.json')).json();raw.currentSector='homeward-09';raw.cleared=HOMEWARD_SECTORS.slice(0,8).map(s=>s.id);raw.active=true;raw.openingSeen=true;raw.eventsSeen.push('homeward-09:enter');raw.echoes={clues:{'CLUE-05':{at:1}}};raw.frontier={};raw.voyage={checkpoint:'origin',selected:'gate'};localStorage.setItem('orbit-maker.homeward.v1',JSON.stringify(raw));localStorage.setItem('classic-sentinel','KEEP');});
 await page.goto(h.url);await tap(page,cdp,'#missionGuideButton');assert.equal(await page.locator('#missionGuideDialog').getAttribute('data-state'),'analysis');assert.ok(!(await page.locator('#missionGuideDescription').textContent()).includes('72時間'));
 await tap(page,cdp,'#missionGuideAction');await page.waitForTimeout(500);assert.equal(await page.locator('[data-signal-analysis="identity"]').evaluate(e=>e.classList.contains('mission-target')),true);assert.ok(await page.locator('.mission-target').count()<=1);
 await tap(page,cdp,'[data-signal-analysis="identity"]');await page.waitForTimeout(500);assert.equal(await page.locator('[data-signal-analysis="timestamp"]').evaluate(e=>e.classList.contains('mission-target')),true);
 await tap(page,cdp,'[data-signal-analysis="timestamp"]');await tap(page,cdp,'#closeHomeward');await page.reload();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.homeward.v1')));for(const id of ['CLUE-05','CLUE-06','CLUE-07','CLUE-08'])assert.ok(saved.echoes.clues[id]);assert.equal(await page.evaluate(()=>localStorage.getItem('classic-sentinel')),'KEEP');assert.deepEqual(errors,[]);
 await writeFile(new URL('analysis-browser.json',dir),JSON.stringify({status:'PASS',fixture:'old save with CLUE-05 acquired; no new flight asserted here',checks:['unknown analysis result hidden','guide navigates to real identity button','one persistent highlight','next timestamp button after identity','existing analysis logic acquires 06/07/08','reload and classic sentinel'],errors,iPhone:'UNVERIFIED'},null,2)+'\n');console.log('GUIDED ANALYSIS PASS');await context.close();
}finally{await h.close();}
