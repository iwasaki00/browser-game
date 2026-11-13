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

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:1000},deviceScaleFactor:1,hasTouch:true,isMobile:true}),p=await context.newPage();
 await p.goto('http://localhost:5176/');await p.locator('#start').click();await fixture(p,['B046','R026','G049']);
 await p.locator('[data-panel="collection"]').click();await p.locator('#book-status').selectOption('found');
 for(const id of ['B046','R026','G049']){
  await p.locator('#book-field').selectOption(id[0]);await p.locator('#book-search').fill(treasure(id).name);
  await checkImage(p.locator('#book-list img'),id);
  await p.locator('[data-book-detail="'+id+'"]').click();await checkImage(p.locator('#book-detail img'),id);
  await p.locator('#book-list').evaluate(e=>{e.scrollIntoView({block:'start'});const sheet=e.closest('.sheet');sheet.scrollTop-=sheet.querySelector('.sheet-head').offsetHeight+8;});
  await p.screenshot({path:output+'/book-'+id[0]+'.png'});
  await p.locator('[data-book-detail="'+id+'"]').click();await checkImage(p.locator('#book-detail img'),id);await p.screenshot({path:output+'/detail-'+id+'.png'});
  await p.locator('#book-search').fill('');
 }
 await p.locator('#close').click();await p.locator('#wash').click();
 for(const [i,id] of ['B046','R026','G049'].entries()){
  await checkImage(p.locator('.wash-card img'),id);await p.screenshot({path:output+'/dirty-'+id+'.png'});
  await p.locator('#clean').click();await p.locator('#next-find').waitFor({state:'visible'});await checkImage(p.locator('.wash-card img'),id);await p.screenshot({path:output+'/washed-'+id+'.png'});
  if(i<2)await p.locator('#next-find').click();
 }
 await context.close();console.log('Representative book/detail/dirty/washed screenshots: B046, R026, G049');
}finally{await browser.close();}
