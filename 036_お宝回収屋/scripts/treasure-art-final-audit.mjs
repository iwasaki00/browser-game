import fs from 'node:fs';
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {treasures} from '../src/data.ts';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const before=json('artwork/treasure-final/map-before.json'),map=json('src/treasure-sprite-map.json'),plan=json('artwork/treasure-final/plan.json'),final=process.argv.includes('--final');
assert.equal(treasures.length,300);assert.equal(map.length,300);assert.equal(new Set(map.map(e=>e.treasureId)).size,300);assert.equal(new Set(map.map(e=>e.sheet+':'+e.col+':'+e.row)).size,300);
for(let i=0;i<300;i++){assert.deepEqual({...map[i],available:before[i].available},before[i]);assert.equal(treasures.find(t=>t.id===map[i].treasureId).name,plan.find(e=>e.treasureId===map[i].treasureId).name);}
const base=json('artwork/treasure-wave4/baseline.json');for(const [file,sha] of Object.entries(base.protected))assert.equal(hash(fs.readFileSync(file)),sha,'protected runtime changed '+file);
const targets=plan.filter(e=>e.lot!=='prior'),pixels=[4,5,6].flatMap(w=>json('artwork/treasure-wave'+w+'/pixels.json'));
const pngs=new Map(),oldPngs=new Map();for(const f of base.sheets){const p=PNG.sync.read(fs.readFileSync('src/assets/treasures/sheets/'+f));assert.equal(p.width,256);assert.equal(p.height,160);pngs.set(f.slice(0,-4),p);oldPngs.set(f.slice(0,-4),PNG.sync.read(fs.readFileSync('artwork/treasure-final/before/'+f)));}
function cell(p,col,row){const b=Buffer.alloc(4096);for(let y=0;y<32;y++)p.data.copy(b,y*128,((row*32+y)*256+col*32)*4,((row*32+y)*256+col*32+32)*4);return b;}
let protectedCells=0,changedNew=0;const used=new Map(map.map(e=>[e.sheet+':'+e.col+':'+e.row,e]));
for(const [sheet,p] of pngs)for(let row=0;row<5;row++)for(let col=0;col<8;col++){
 const e=used.get(sheet+':'+col+':'+row),a=cell(oldPngs.get(sheet),col,row),b=cell(p,col,row),target=e&&targets.some(t=>t.treasureId===e.treasureId);
 if(!target){assert.ok(a.equals(b),'protected cell changed '+sheet+':'+col+':'+row);protectedCells++;}
 if(!e){assert.ok(b.every(v=>v===0),'spare cell not transparent');continue;}
 const opaque=Array.from({length:1024},(_,i)=>b[i*4+3]).filter(v=>v>0).length;
 assert.equal(opaque>0,e.available,'available/empty mismatch '+e.treasureId);
 if(target&&e.available){assert.ok(!a.equals(b));changedNew++;const record=pixels.find(t=>t.id===e.treasureId);assert.ok(record);const sprite=PNG.sync.read(fs.readFileSync('artwork/treasure-wave'+plan.find(t=>t.treasureId===e.treasureId).lot+'/sprites/'+e.treasureId+'.png'));assert.equal(sprite.width,32);assert.equal(sprite.height,32);assert.ok(sprite.data.equals(b));for(let y=0;y<32;y++)for(let x=0;x<32;x++){const alpha=b[(y*32+x)*4+3];assert.ok(alpha===0||alpha===255);if(alpha)assert.ok(x>=2&&x<30&&y>=2&&y<30);}}
 if(final)assert.ok(e.available,'missing dedicated art '+e.treasureId);
}
assert.equal(protectedCells,174);assert.equal(pixels.length,changedNew);if(final){assert.equal(changedNew,186);assert.equal(map.filter(e=>e.available).length,300);for(const f of ['B','R','G'])assert.equal(map.filter(e=>e.field===f&&e.available).length,100);}
const result={complete:final,newIntegrated:changedNew,priorDedicatedPreserved:114,sparePreserved:60,protectedRGBAExact:protectedCells,nonTargetChangedPixels:0,available:map.filter(e=>e.available).length,pending:targets.length-changedNew,protectedRuntimeFiles:Object.keys(base.protected).length,fields:Object.fromEntries(['B','R','G'].map(f=>[f,map.filter(e=>e.field===f&&e.available).length]))};
fs.writeFileSync('docs/treasure-art-final/pixel-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(result);
