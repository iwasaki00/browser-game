import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {staticPreview} from './static-debug-server.mjs';
import {COLLECTION_THEMES} from '../src/collection-themes.ts';
import {themeFixture} from '../src/dev-theme-fixture.ts';
import {instantRecovery} from '../src/dev-treasure-check.ts';
const output='docs/theme-collection';fs.mkdirSync(output,{recursive:true});
const server=await staticPreview(0),results=[];
const keys=['finders-v1','finders-dev-v1','finders-debug-v1'];
async function stores(p){return p.evaluate(async keys=>{const out={};for(const key of keys){out[key]={backup:localStorage.getItem(key),primary:await new Promise((resolve,reject)=>{const q=indexedDB.open(key,1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('saves').objectStore('saves').get('current');r.onsuccess=()=>{db.close();resolve(r.result);};};})};}return JSON.stringify(out);},keys);}
async function seed(p,s){await p.goto(server.origin+'/__audit');await p.waitForTimeout(250);await p.evaluate(async s=>{localStorage.setItem('finders-v1',JSON.stringify(s));await new Promise((resolve,reject)=>{const q=indexedDB.open('finders-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('saves');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,t=db.transaction('saves','readwrite');t.objectStore('saves').put(s,'current');t.objectStore('saves').delete('session');t.oncomplete=()=>{db.close();resolve();};};});},s);}
async function resume(p){await p.waitForFunction(()=>typeof document.querySelector('#start')?.onclick==='function');await p.locator('#start').click();await p.locator('#title').waitFor({state:'hidden'});}
async function start(p,url){await p.goto(url);await resume(p);}
async function themes(p,id){await p.locator('[data-panel="collection"]').click();await p.locator('#collection-themes>summary').click();await p.locator('[data-theme="'+id+'"]>summary').click();}
async function wash(p,complete){await p.locator('#clean').click();await p.locator('#next-find').waitFor({state:'visible'});assert.equal(await p.locator('.theme-completed').count(),complete?1:0);}
async function lab(p){await p.locator('#debug-open').click();await p.locator('[data-tab="2"]').click();}
function record(r){results.push(r);fs.writeFileSync(output+'/browser-results.json',JSON.stringify(results,null,2)+'\n');console.log('PASS',JSON.stringify(r));}
try{for(const [channel,width]of [['chrome',390],['msedge',320],['chrome',1280]]){
 const browser=await chromium.launch({channel,headless:true});try{const context=await browser.newContext({viewport:{width,height:920},hasTouch:width<500,isMobile:width<500}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 // Exercise normal production washing, including old partial saves and repeat registration.
 for(const theme of COLLECTION_THEMES){const {state:s,missing}=themeFixture(theme.id);instantRecovery(s,missing);await seed(p,s);await start(p,server.normal+'?debug=1');assert.equal(await p.evaluate(()=>typeof window.__finders),'undefined');await themes(p,theme.id);assert.match(await p.locator('[data-theme-progress="'+theme.id+'"]').textContent(),/2 \/ 3/);assert.equal(await p.locator('[data-theme="'+theme.id+'"] .treasure-unfound').count(),1);await p.locator('#close').click();await p.locator('#wash').click();await wash(p,true);assert.match(await p.locator('.theme-completed').textContent(),new RegExp(theme.title));await p.locator('#skip-clean').click();await themes(p,theme.id);assert.match(await p.locator('[data-theme-progress="'+theme.id+'"]').textContent(),/完成/);await p.locator('[data-theme-detail="'+missing+'"]').click();assert.equal(await p.locator('#book-detail img').getAttribute('data-treasure-fallback'),missing);await p.locator('#close').click();await p.reload();await resume(p);await themes(p,theme.id);assert.match(await p.locator('[data-theme-progress="'+theme.id+'"]').textContent(),/完成/);assert.equal(await p.locator('.theme-completed').count(),0);await p.locator('#close').click();record({channel,width,mode:'normal',theme:theme.id,oldPartial:true,washComplete:true,reloadComplete:true});}
 await p.goto(server.origin+'/__audit');await p.waitForTimeout(250);const normal=await stores(p);
 await start(p,server.debug);
 for(const theme of COLLECTION_THEMES){
  await lab(p);await p.locator('#lab-theme-fixture>summary').click();await p.locator('#lab-theme-select').selectOption(theme.id);await p.locator('#lab-theme-prepare').click();await p.locator('#close').click();await themes(p,theme.id);
  const progress=p.locator('[data-theme-progress="'+theme.id+'"]');assert.match(await progress.textContent(),/2 \/ 3/);assert.equal(await p.locator('[data-theme="'+theme.id+'"] .treasure-unfound').count(),1);
  const before=await p.evaluate(()=>JSON.stringify(window.__finders.getState().discoveredTreasures));
  let seen=0;for(const field of ['B','R','G']){await p.locator('#book-field').selectOption(field);do{seen+=await p.locator('#book-list [data-book-detail]').count();if(await p.locator('#book-next').isDisabled())break;await p.locator('#book-next').click();}while(true);}assert.equal(seen,300);assert.equal(await p.evaluate(()=>JSON.stringify(window.__finders.getState().discoveredTreasures)),before);
  await p.locator('#collection-themes').evaluate(e=>e.scrollIntoView({block:'start'}));if(channel==='chrome'&&width===390)await p.screenshot({path:output+'/'+theme.field+'-before.png'});
  await p.locator('#close').click();await lab(p);await p.locator('#lab-quick-query').fill(theme.ids.at(-1));await p.locator('#lab-quick-recover').click();assert.equal(await p.evaluate(id=>!!window.__finders.getState().discoveredTreasures[id],theme.ids.at(-1)),false);
  await p.locator('#close').click();await themes(p,theme.id);assert.match(await progress.textContent(),/2 \/ 3/);await p.locator('#close').click();await p.locator('#wash').click();await wash(p,true);
  if(channel==='chrome'&&width===390)await p.screenshot({path:output+'/'+theme.field+'-wash-complete.png'});
  await p.locator('#skip-clean').click();await themes(p,theme.id);assert.match(await progress.textContent(),/完成/);await p.locator('#collection-themes').evaluate(e=>e.scrollIntoView({block:'start'}));if(channel==='chrome'&&width===390)await p.screenshot({path:output+'/'+theme.field+'-after.png'});
  await p.locator('#close').click();await p.evaluate(()=>window.__finders.save());await p.reload();await resume(p);await themes(p,theme.id);assert.match(await progress.textContent(),/完成/);assert.equal(await p.locator('.theme-completed').count(),0);await p.locator('#close').click();
  await lab(p);await p.locator('#lab-quick-query').fill(theme.ids.at(-1));await p.locator('#lab-quick-recover').click();await p.locator('#lab-quick-wash').click();await wash(p,false);await p.locator('#skip-clean').click();assert.equal(await stores(p),normal);
  record({channel,width,mode:'debug',theme:theme.id,viewed300ReadOnly:true,unwashedNotCounted:true,washComplete:true,reloadComplete:true,duplicateSilent:true,normalSaveUnchanged:true});
 }
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);record({channel,width,layout:true,errors});await context.close();
 }finally{await browser.close();}
}}finally{await new Promise(r=>server.server.close(r));}
