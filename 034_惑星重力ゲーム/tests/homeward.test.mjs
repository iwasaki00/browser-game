import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {HOMEWARD,HOMEWARD_SECTORS,getHomewardSector} from '../js/homeward-data.js';
import {HOMEWARD_KEY,HomewardProgress,homewardDistance,sectorUnlocked} from '../js/homeward-progress.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {createFlightRecorder,replayFrame} from '../js/flight-record.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {slingshotLaunch} from '../js/launch.js';
import {placementAllowed} from '../js/planets.js';
const dir=new URL('../reports/first-voyage/',import.meta.url);mkdirSync(dir,{recursive:true});const metrics=[];
for(const definition of HOMEWARD_SECTORS)test(`${definition.id}: データ整合性・到達・広域予測一致・両方式と両モード・ギャラリーv1`,()=>{
 const s=getHomewardSector(definition.id),before=structuredClone(s);assert.ok(s.planets.every(p=>placementAllowed(p,s)));
 assert.equal(s.launch.speed,definition.initial.speed);assert.ok(s.world.width>375);assert.equal(definition.next,HOMEWARD_SECTORS[Number(definition.number)]?.id??null);
 let state=createSimulation(s,s.solution);const states=[state],rec=createFlightRecorder(s,state,{playType:'homeward',gameMode:'design',launchMode:'precision'},1);let distance=0;
 while(state.status==='flying'){const old=state;state=stepSimulation(state,1/120);distance+=Math.hypot(state.rocket.position.x-old.rocket.position.x,state.rocket.position.y-old.rocket.position.y);states.push(state);rec.capture(state);}
 assert.equal(state.status,'cleared');assert.ok(distance>3500);assert.ok(state.elapsed>12);
 const job=createPreview(s,states[0].rocket.velocity);while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,state);
 for(const p of job.points)assert.deepEqual({x:p.x,y:p.y},states[Math.round(p.time*120)].rocket.position);
 const record=rec.finish(state);assert.equal(record.version,1);assert.equal(record.stageId,s.id);assert.equal(record.playType,'homeward');assert.deepEqual(replayFrame(record,record.duration).rocket,state.rocket.position);
 const r=-65*Math.PI/180,shot=slingshotLaunch(s.launch.position,{x:s.launch.position.x-Math.cos(r)*105,y:s.launch.position.y-Math.sin(r)*105});
 let live=createSimulation(s,{velocity:shot.velocity});while(live.status==='flying')live=stepLiveFlight(live,{},s,'live');assert.equal(live.status,'cleared');assert.ok(Math.hypot(live.rocket.position.x-state.rocket.position.x,live.rocket.position.y-state.rocket.position.y)<1e-7);assert.deepEqual(s,before);
 metrics.push({sector:s.id,title:definition.name,elapsed:state.elapsed,status:state.status,distance,end:state.rocket.position,frames:record.frames.length,preview:'all saved prediction points and terminal state match',liveAndSlingshot:'cleared'});writeFileSync(new URL('sector-verification.json',dir),JSON.stringify(metrics,null,2));writeFileSync(new URL(`${s.id}-flight.json`,dir),JSON.stringify(record));
});
function memory(initial=[]){const values=new Map(initial);return {values,getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
test('セクターの順次解放、重複加算防止、地球未帰還、モード離脱と再読込',()=>{
 const storage=memory(),p=new HomewardProgress(storage);assert.equal(p.enter('homeward-01'),false);p.start();
 assert.equal(p.enter('homeward-03'),false);assert.equal(p.clear('homeward-02'),false);
 for(const s of HOMEWARD_SECTORS){assert.equal(p.enter(s.id),true);p.markEvent(`${s.id}:enter`);assert.equal(p.clear(s.id),true);assert.equal(p.clear(s.id),true);}
 assert.deepEqual(homewardDistance(p.state),{travelled:5400,remaining:58600,percent:8.4375});assert.equal(p.state.cleared.length,3);assert.ok(homewardDistance(p.state).percent<100);assert.equal(HOMEWARD.totalDistance,64000);
 const restored=new HomewardProgress(storage);assert.deepEqual(restored.state,p.state);p.leave();assert.equal(new HomewardProgress(storage).state.active,false);assert.equal(p.state.cleared.length,3);assert.equal(sectorUnlocked(p.state,'invalid'),false);
});
test('CLASSIC、FREE SPACE、音声の旧キーを読み書きしない。コンストラクタは保存しない',()=>{
 const storage=memory([['orbit-maker.stage-progress.v1','{"design":{"stage-20":3}}'],['orbit-maker.experience.v1','{"sound":true}'],['other-key','untouched']]);const before=[...storage.values];const p=new HomewardProgress(storage);assert.deepEqual([...storage.values],before);p.start();p.enter('homeward-01');p.clear('homeward-01');p.leave();
 for(const [key,value]of before)assert.equal(storage.values.get(key),value);assert.deepEqual([...storage.values.keys()].filter(k=>!before.some(([key])=>key===k)),[HOMEWARD_KEY]);
});
test('破損・将来形式のHOMEWARDセーブを上書きせず、一時プレイを許可',()=>{
 for(const raw of ['broken','null','{"version":2,"cleared":[]}','{"version":1,"cleared":["homeward-99"]}']){
  const storage=memory([[HOMEWARD_KEY,raw]]),p=new HomewardProgress(storage);assert.equal(p.writable,false);p.start();assert.equal(p.enter('homeward-01'),true);p.clear('homeward-01');assert.equal(storage.values.get(HOMEWARD_KEY),raw);assert.match(p.notice,/元のデータを保護/);
 }
});
test('保存容量不足・利用不可でも航行進行を保持し、保存失敗を通知',()=>{
 for(const storage of [undefined,{getItem(){return null;},setItem(){throw Error('QuotaExceededError');}}]){
  const p=new HomewardProgress(storage);p.start();assert.equal(p.enter('homeward-01'),true);p.clear('homeward-01');assert.equal(p.state.cleared.length,1);assert.match(p.notice,/保存できません/);
 }
});
test('不正な現在位置と飛び越し済みデータを安全な解放済み位置へ補正',()=>{
 const p=new HomewardProgress(memory([[HOMEWARD_KEY,JSON.stringify({version:1,currentSector:'homeward-03',cleared:['homeward-02'],openingSeen:true})]]));assert.equal(p.state.currentSector,'homeward-01');assert.deepEqual(p.state.cleared,[]);
 const a=getHomewardSector('homeward-01');a.planets[0].mass=0;assert.notEqual(getHomewardSector('homeward-01').planets[0].mass,0);
});
