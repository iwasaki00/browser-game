import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {treasures} from '../src/data';
import {treasureSpriteMap,SHEET_NAMES,validSpriteCell,type TreasureSprite} from '../src/treasure-sprite-map';
import {resolveTreasureSprite} from '../src/treasure-assets';
import {treasureShape,treasureSilhouette} from '../src/reveal';
import {createState} from '../src/engine';
import {migrate} from '../src/save';

test('all 300 treasures have unique, valid genre sheet cells and matching master metadata',()=>{
 assert.equal(Object.keys(treasureSpriteMap).length,300);
 const cells=new Set<string>();
 for(const t of treasures){
  const e=treasureSpriteMap[t.id];assert.ok(validSpriteCell(e));
  assert.equal(e.treasureId,t.id);assert.equal(e.field,t.category);
  assert.equal(e.category,t.kind);assert.equal(e.rarity,t.rarity);
  assert.equal(e.sheet.split('_')[0],({B:'beach',R:'river',G:'gold'})[t.category]);
  const cell=e.sheet+':'+e.col+':'+e.row;assert.ok(!cells.has(cell));cells.add(cell);
 }
});
test('nine sheets reserve 300 cells with 60 spare and 114 dedicated sprites evenly across fields',()=>{
 const all=Object.values(treasureSpriteMap);
 assert.equal(SHEET_NAMES.length,9);assert.equal(9*40-all.length,60);
 for(const name of SHEET_NAMES){const entries=all.filter(e=>e.sheet===name);assert.ok(entries.length<=40);assert.ok(entries.filter(e=>e.available).length>=6);}
 for(const field of ['B','R','G'])assert.equal(all.filter(e=>e.field===field&&e.available).length,38);
 assert.equal(all.filter(e=>!e.available).length,186);
});
test('rarity never changes the 32px source cell size',()=>{
 for(const rarity of ['C','U','R','SR','J']){
  const entries=Object.values(treasureSpriteMap).filter(e=>e.rarity===rarity);
  assert.ok(entries.length);assert.ok(entries.every(e=>e.size===32));
 }
});
test('available dedicated sprite resolves a full sheet URL and cell offset metadata',()=>{
 const e=treasureSpriteMap.B001;
 const resolved=resolveTreasureSprite('B001',treasureSpriteMap,{[e.sheet]:'/atlas.png'},new Set());
 assert.ok(resolved);assert.equal(resolved.url,'/atlas.png');assert.equal(resolved.width,256);assert.equal(resolved.height,160);
 assert.equal(resolved.col,e.col);assert.equal(resolved.row,e.row);
});
test('unpainted, unknown, missing sheet and failed sheet entries fall back',()=>{
 const urls=Object.fromEntries(SHEET_NAMES.map(s=>[s,'/'+s+'.png']));
 const planned=Object.values(treasureSpriteMap).find(e=>!e.available)!;
 assert.equal(resolveTreasureSprite(planned.treasureId,treasureSpriteMap,urls),undefined);
 assert.equal(resolveTreasureSprite('unknown',treasureSpriteMap,urls),undefined);
 assert.equal(resolveTreasureSprite('B001',treasureSpriteMap,{}),undefined);
 assert.equal(resolveTreasureSprite('B001',treasureSpriteMap,urls,new Set([treasureSpriteMap.B001.sheet])),undefined);
});
test('out of bounds, wrong size and mismatched ID never become crop coordinates',()=>{
 const e=treasureSpriteMap.B001,urls={[e.sheet]:'/atlas.png'};
 for(const change of [{col:-1},{col:8},{row:5},{row:1.5},{size:48},{sheet:'bad'},{treasureId:'B002'}]){
  const invalid={...e,...change} as TreasureSprite;
  assert.equal(resolveTreasureSprite('B001',{B001:invalid},urls),undefined);
 }
});
test('forced SVG fallback remains available for every treasure without individual image files',()=>{
 for(const t of treasures){const html=treasureShape(t.id,true);assert.match(html,/<svg/);assert.doesNotMatch(html,/<img/);assert.match(html,new RegExp('data-rarity="'+t.rarity+'"'));}
});
test('undiscovered silhouette contains no treasure ID, rarity or sheet information',()=>{
 const html=treasureSilhouette();assert.match(html,/treasure-unfound/);assert.match(html,/<svg/);
 assert.doesNotMatch(html,/data-treasure-id|data-rarity|data-sheet|<img/);
});
for(const name of SHEET_NAMES)test(name+' is a 256x160 transparent RGBA PNG',()=>{
 const b=readFileSync('src/assets/treasures/sheets/'+name+'.png');
 assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),256);assert.equal(b.readUInt32BE(20),160);
 assert.equal(b[25],6,'RGBA preserves transparent empty cells');
});
test('sprite rendering and fallback do not mutate or add fields to existing saves',()=>{
 const s=migrate(createState(321)),before=JSON.stringify(s);
 for(const t of treasures)treasureShape(t.id,true);
 assert.equal(JSON.stringify(s),before);assert.doesNotMatch(before,/treasureSpriteMap|sheetURLs|spriteAvailable/);
});
