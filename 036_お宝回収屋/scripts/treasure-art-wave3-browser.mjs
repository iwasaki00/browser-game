import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {treasure} from '../src/data.ts';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const ids=JSON.parse(readFileSync('artwork/treasure-wave3/generation.json','utf8')).items.map(e=>e.id);
const map=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));
const washIDs=['B046','B047','R026','R029','G049','G088'];
const bookIDs=map.filter(e=>e.available).map(e=>e.treasureId);
const output='docs/treasure-art-wave3',results=[];mkdirSync(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected=Object.fromEntries(bookIDs.map(id=>{const e=map.find(e=>e.treasureId===id),p=PNG.sync.read(readFileSync('src/assets/treasures/sheets/'+e.sheet+'.png')),data=Buffer.alloc(4096);for(let y=0;y<32;y++)p.data.copy(data,y*128,((e.row*32+y)*256+e.col*32)*4,((e.row*32+y)*256+e.col*32+32)*4);return [id,hash(data)];}));
async function checkImage(locator,id){
 assert.equal(await locator.getAttribute('data-treasure-fallback'),id);
 const pixels=await locator.evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');x.drawImage(img,0,0);return Array.from(x.getImageData(-parseInt(img.style.left),-parseInt(img.style.top),32,32).data);});
 assert.equal(hash(Buffer.from(pixels)),expected[id],'wrong cell artwork for '+id);
}
async function fixture(page,finds=washIDs){
 await page.evaluate(async list=>{
  const {createState}=await import('/src/engine.ts'),{spawn}=await import('/src/dev-actions.ts'),{treasure}=await import('/src/data.ts'),{treasureSpriteMap}=await import('/src/treasure-sprite-map.ts');
  const s=createState(812);s.settings.short=true;
  for(const id of Object.values(treasureSpriteMap).filter(e=>e.available).map(e=>e.treasureId)){const t=treasure(id);s.discoveredTreasures[id]={count:1,best:t.baseValueFN,first:'2026-11-13T00:00:00Z',locations:[t.locations[0]],tools:['hand']};}
  for(const id of list)spawn(s,id,{state:'stored'});
  Object.assign(window.__finders.getState(),s);window.__finders.refresh();
 },finds);
}
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true});
 try{
  for(const [width,height] of [[320,568],[390,1000],[1280,1000]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:width<500,isMobile:width<500}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto('http://localhost:5176/');await p.locator('#start').click();await fixture(p);
   await p.locator('[data-panel="collection"]').click();await p.locator('#book-status').selectOption('found');
   for(const field of ['B','R','G']){
    await p.locator('#book-field').selectOption(field);const fieldIDs=bookIDs.filter(id=>id[0]===field);
    for(let offset=0;offset<fieldIDs.length;offset+=12){
     const pageIDs=fieldIDs.slice(offset,offset+12);
     assert.equal(await p.locator('#book-list .book-entry').count(),pageIDs.length);
     for(const id of pageIDs)await checkImage(p.locator('#book-list img[data-treasure-fallback="'+id+'"]'),id);
     if(channel==='chrome'&&width===390){await p.locator('#book-list').evaluate(e=>{e.scrollIntoView({block:'start'});const sheet=e.closest('.sheet');sheet.scrollTop-=sheet.querySelector('.sheet-head').offsetHeight+8;});await p.screenshot({path:output+'/book-'+field+'-'+(offset/12+1)+'.png'});}
     for(const id of pageIDs.filter(id=>washIDs.includes(id))){await p.locator('[data-book-detail="'+id+'"]').click();await checkImage(p.locator('#book-detail img'),id);assert.match(await p.locator('#book-detail h3').textContent(),new RegExp(treasure(id).name));}
     if(offset+12<fieldIDs.length)await p.locator('#book-next').click();
    }
   }
   await p.locator('#book-status').selectOption('missing');assert.equal(await p.locator('#book-list .treasure-unfound').count(),12);assert.equal(await p.locator('#book-list img').count(),0);
   await p.locator('#close').click();await p.locator('#wash').click();
   for(const [index,id] of washIDs.entries()){
    const art=p.locator('.wash-card img');await checkImage(art,id);const source=await art.getAttribute('src');
    assert.equal(await p.locator('.dirt-layer').evaluate(e=>+getComputedStyle(e).opacity),1);
    if(channel==='chrome'&&width===390&&['B046','R026','G049'].includes(id))await p.screenshot({path:output+'/dirty-'+id+'.png'});
    await p.locator('#clean').click();await p.locator('#next-find').waitFor({state:'visible'});
    assert.equal(await p.locator('.dirt-layer').evaluate(e=>+getComputedStyle(e).opacity),0);
    await checkImage(art,id);assert.equal(await art.getAttribute('src'),source);
    assert.match(await p.locator('#reveal-name').textContent(),new RegExp(treasure(id).name));
    const fn=await p.evaluate(()=>window.__finders.getState().currentFN);await p.locator('#clean').dispatchEvent('click');assert.equal(await p.evaluate(()=>window.__finders.getState().currentFN),fn);
    if(channel==='chrome'&&width===390&&['B046','R026','G049'].includes(id))await p.screenshot({path:output+'/washed-'+id+'.png'});
    if(index<washIDs.length-1)await p.locator('#next-find').click();
   }
   await p.locator('#skip-clean').click();assert.ok(await p.evaluate(()=>window.__finders.save()));
   const fn=await p.evaluate(()=>window.__finders.getState().currentFN);await p.reload();await p.locator('#start').click();assert.equal(await p.evaluate(()=>window.__finders.getState().currentFN),fn);
   assert.deepEqual(errors,[]);results.push({channel,width,height,ids,correctListCells:114,correctDetailCells:6,correctWashedCells:6,dirtyOverlay:true,commonUnknownSilhouette:true,saveReload:true,duplicateReward:false,errors});console.log(channel,width,'PASS');await context.close();
  }
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/beach_valuable_sheet.png*',r=>r.request().resourceType()==='image'?r.abort():r.continue());
  await p.goto('http://localhost:5176/');await p.locator('#start').click();await fixture(p,['B047']);await p.locator('#wash').click();await p.locator('.wash-card .treasure-visual>svg').waitFor();await p.locator('#skip-clean').click();assert.ok(await p.evaluate(()=>window.__finders.getState().currentFN>0));assert.ok(await p.evaluate(()=>window.__finders.save()));assert.deepEqual(errors,[]);
  results.push({channel,failure:'dedicated-art-sheet unavailable',svgFallback:true,washRewardSave:true,errors});await c.close();
 }finally{await browser.close();}
}
writeFileSync(output+'/browser-results.json',JSON.stringify(results,null,2)+'\n');console.log({cases:results.length,pass:true});
