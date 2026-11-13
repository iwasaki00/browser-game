import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {treasure} from '../src/data.ts';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const ids=JSON.parse(readFileSync('artwork/treasure-wave2/generation.json','utf8')).items.map(e=>e.id);
const map=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));
const bookIDs=map.filter(e=>e.available).map(e=>e.treasureId);
const output='docs/treasure-art-wave2',results=[];mkdirSync(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected=Object.fromEntries(bookIDs.map(id=>{const e=map.find(e=>e.treasureId===id),p=PNG.sync.read(readFileSync('src/assets/treasures/sheets/'+e.sheet+'.png')),data=Buffer.alloc(4096);for(let y=0;y<32;y++)p.data.copy(data,y*128,((e.row*32+y)*256+e.col*32)*4,((e.row*32+y)*256+e.col*32+32)*4);return [id,hash(data)];}));
async function checkImage(locator,id){
 assert.equal(await locator.getAttribute('data-treasure-fallback'),id);
 const pixels=await locator.evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=256;c.height=160;const x=c.getContext('2d');x.drawImage(img,0,0);return Array.from(x.getImageData(-parseInt(img.style.left),-parseInt(img.style.top),32,32).data);});
 assert.equal(hash(Buffer.from(pixels)),expected[id],'wrong cell artwork for '+id);
}
async function fixture(page,finds=ids){
 await page.evaluate(async list=>{
  const {createState}=await import('/src/engine.ts'),{spawn}=await import('/src/dev-actions.ts'),{treasure}=await import('/src/data.ts');
  const s=createState(812);s.settings.short=true;
  for(const id of ["B001","B002","B004","B005","B006","B007","B009","B010","B011","B012","B013","B014","B020","B025","B026","B032","B033","B045","G001","G002","G003","G004","G005","G006","G007","G008","G009","G010","G011","G012","G013","G014","G025","G060","G061","G084","R001","R002","R003","R004","R005","R006","R007","R008","R009","R010","R011","R012","R013","R025","R059","R079","R089","R100"]){const t=treasure(id);s.discoveredTreasures[id]={count:1,best:t.baseValueFN,first:'2026-11-13T00:00:00Z',locations:[t.locations[0]],tools:['hand']};}
  for(const id of list)spawn(s,id,{state:'stored'});
  Object.assign(window.__finders.getState(),s);window.__finders.refresh();
 },finds);
}

const samples=['B','R','G'].map(f=>map.find(e=>e.field===f&&!e.available).treasureId);
for(const channel of ['chrome','msedge']){
 const b=await chromium.launch({channel,headless:true});
 try{const c=await b.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:5176/');await p.locator('#start').click();await fixture(p,samples);await p.locator('#wash').click();
 for(const [i,id] of samples.entries()){
  await p.locator('.wash-card .treasure-visual>svg').waitFor();assert.equal(await p.locator('.wash-card img').count(),0);
  await p.locator('#skip-clean').click();assert.match(await p.locator('#reveal-name').textContent(),new RegExp(treasure(id).name));
  if(i<samples.length-1)await p.locator('#next-find').click();
 }
 assert.deepEqual(errors,[]);results.push({channel,unmadeIDs:samples,svgFallback:true,washReward:true,errors});await c.close();
 }finally{await b.close();}
}
writeFileSync(output+'/fallback-results.json',JSON.stringify(results,null,2)+'\n');console.log({cases:results.length,pass:true});
