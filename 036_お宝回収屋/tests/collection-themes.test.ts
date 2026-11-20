import test from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTION_THEMES,validateCollectionThemes,themeProgress,themeSnapshot,newlyCompletedThemes} from '../src/collection-themes';
import {createState,reward} from '../src/engine';
import {treasure} from '../src/data';
import {migrate} from '../src/save';
import {instantRecovery} from '../src/dev-treasure-check';
import {themeFixture} from '../src/dev-theme-fixture';
import {eligibleTreasures,generateWorld} from '../src/world-generation';
import {bookRows} from '../src/collection';

test('three themes use unique valid master IDs, early common/uncommon and no jackpot',()=>{
 assert.ok(validateCollectionThemes());assert.equal(COLLECTION_THEMES.length,3);
 for(const t of COLLECTION_THEMES){assert.ok(t.ids.length>=3&&t.ids.length<=5);assert.ok(t.ids.some(id=>['C','U'].includes(treasure(id).rarity)));for(const id of t.ids){const m=treasure(id);assert.notEqual(m.rarity,'J');assert.ok(m.locations.some(a=>eligibleTreasures(a).some(x=>x.id===id)));assert.ok(m.locations.some(a=>Array.from({length:200},(_,seed)=>generateWorld(seed,a,true)).some(p=>p.items.some(f=>f.id===id))),id+' actually spawns');}}
});
test('invalid, wrong-field, duplicate item and duplicate theme IDs are rejected',()=>{
 const t=COLLECTION_THEMES[0];
 for(const ids of [['B002','B003','NOPE'],['B002','B003','R004'],['B002','B002','B005'],['B002']])assert.throws(()=>validateCollectionThemes([{...t,ids}]));
 assert.throws(()=>validateCollectionThemes([t,t]));
});
for(const theme of COLLECTION_THEMES){
 test(theme.id+' old saves immediately reflect partial and complete progress without new save fields',()=>{
  const s=createState(11),originalFN=s.currentFN;
  s.discoveredTreasures[theme.ids[0]]={count:5,first:'2026-01-01T00:00:00Z',best:100,locations:[treasure(theme.ids[0]).locations[0]],tools:['hand']};
  const old=migrate(s);assert.equal(themeProgress(old,theme).found,1);assert.equal(old.currentFN,originalFN);
  for(const id of theme.ids.slice(1))reward(old,instantRecovery(old,id).uid);
  const before=JSON.stringify(old),snap=themeSnapshot(old);assert.ok(themeProgress(old,theme).complete);assert.deepEqual(newlyCompletedThemes(snap,migrate(migrate(old))),[]);assert.equal(JSON.stringify(old),before);assert.ok(!('themeProgress' in old));
 });
 test(theme.id+' only last first registration completes; recovery, other items, reload and duplicates do not notify',()=>{
  const {state:s,missing}=themeFixture(theme.id);assert.equal(themeProgress(s,theme).found,theme.ids.length-1);
  const before=themeSnapshot(s),f=instantRecovery(s,missing);assert.deepEqual(newlyCompletedThemes(before,s),[]);
  reward(s,instantRecovery(s,'B001').uid);assert.deepEqual(newlyCompletedThemes(before,s),[]);
  const progressBefore=themeSnapshot(s);reward(s,f.uid);assert.deepEqual(newlyCompletedThemes(progressBefore,s).map(t=>t.id),[theme.id]);
  const complete=themeSnapshot(s);assert.equal(reward(s,f.uid),0);reward(s,instantRecovery(s,missing).uid);assert.deepEqual(newlyCompletedThemes(complete,s),[]);
  const restored=migrate(migrate(s));assert.ok(themeProgress(restored,theme).complete);assert.deepEqual(newlyCompletedThemes(themeSnapshot(restored),restored),[]);
 });
 test(theme.id+' revealing all 300 rows is strictly read-only for theme progress',()=>{
  const {state:s}=themeFixture(theme.id),before=JSON.stringify(s);
  assert.equal(bookRows(s,{field:'',rarity:'',status:'all',search:'',sort:'id'},true).length,300);
  assert.equal(JSON.stringify(s),before);assert.equal(themeProgress(s,theme).complete,false);
 });
}
test('fixture rejects unknown theme and gives independently created, registered test states',()=>{
 assert.throws(()=>themeFixture('invalid'));const a=themeFixture(COLLECTION_THEMES[0].id),b=themeFixture(COLLECTION_THEMES[0].id);a.state.currentFN=999;assert.notEqual(b.state.currentFN,999);assert.equal(b.state.discoveredTreasures[b.missing],undefined);
});
