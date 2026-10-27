import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {DESTINATIONS,newVoyage,normalizeVoyage,createOpenVoyage,dockVoyage,departurePosition,safeDeparture} from '../js/open-voyage.js';
import {VOYAGE_COURSES} from '../js/voyage-courses.js';
import {HomewardProgress,HOMEWARD_KEY,homewardDistance,sectorUnlocked} from '../js/homeward-progress.js';
import {HOMEWARD_SECTORS,getHomewardSector} from '../js/homeward-data.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {FlightClock} from '../js/flight-clock.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';
import {createFlightRecorder,replayFrame} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
import {HomewardArchive,migrateHomewardRecords} from '../js/homeward-archive.js';
const dir=new URL('../reports/open-voyage/',import.meta.url);mkdirSync(dir,{recursive:true});const results=[];
const prior=HOMEWARD_SECTORS.slice(0,8).map(s=>s.id);
function memory(raw){const values=new Map([[HOMEWARD_KEY,JSON.stringify(raw)],['classic','stars'],['audio','on']]);return {values,getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
function progress(){return new HomewardProgress(memory({version:1,openingSeen:true,active:true,currentSector:'homeward-09',cleared:prior,eventsSeen:[],journal:{'homeward-01':{clearFlightId:'old-record'}},custom:{kept:true}}));}
function fly(stage,answer,{rate=1,live=false}={}){
 const [angleDeg,speed]=answer;let state=createSimulation(stage,{angleDeg,speed}),steps=0,distance=0;
 const initial=structuredClone(state),rec=createFlightRecorder(stage,state,{playType:'homeward',gameMode:live?'live':'design',launchMode:'precision',destinationId:stage.goal.id},1),clock=new FlightClock({now:()=>0});clock.setRate(rate);
 while(state.status==='flying')clock.advance(1/60,dt=>{const previous=state;state=stepLiveFlight(state,{},stage,live?'live':'design',dt);rec.capture(state);distance+=Math.hypot(state.rocket.position.x-previous.rocket.position.x,state.rocket.position.y-previous.rocket.position.y);assert.ok(++steps<22000);return state.status==='flying';});
 return {state,initial,steps,distance,record:rec.finish(state)};
}
for(const [name,route]of Object.entries({A:['gate'],B:['rescue','gate'],C:['planet','gate'],D:['rescue','planet','station','gate']}))test(`${name}: 実物理で探索・安全な寄港再発射・予測/100倍一致・保存復元・重要記録用のCINEMATIC`,()=>{
 let p=progress();const legs=[];
 for(const target of route){
  const v=normalizeVoyage(p.state.voyage),from=v.checkpoint;assert.ok(p.selectDestination(target));const stage=createOpenVoyage(p.state.voyage),before=structuredClone(stage),course=VOYAGE_COURSES[from+'>'+target];
  assert.deepEqual(stage.world,{width:3750,height:5000});const flight=fly(stage,course);assert.equal(flight.state.status,'cleared');assert.equal(flight.state.target,target);assert.ok(flight.distance>500);assert.deepEqual(stage,before);
  const high=fly(stage,course,{rate:100});assert.deepEqual(high.state,flight.state);assert.equal(high.steps,flight.steps);
  const job=createPreview(stage,velocityFromAngleSpeed(...course));while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,flight.state);
  const live=fly(stage,course,{live:true});assert.deepEqual(live.state,flight.state);
  assert.ok(p.dock(flight.state));assert.equal(p.dock(flight.state),false);assert.deepEqual(p.state.cleared.slice(0,8),prior);
  const reload=new HomewardProgress(p.storage);assert.deepEqual(reload.state,p.state);p=reload;
  const next=createOpenVoyage(p.state.voyage);assert.deepEqual(next.launch.position,departurePosition(p.state.voyage));assert.ok(next.planets.every(q=>Math.hypot(q.x-next.launch.position.x,q.y-next.launch.position.y)>q.radius+34));
  const record=flight.record,saved=JSON.stringify(record),replay=new FlightReplay(record);replay.setMode('cinematic');replay.restart();for(let i=0;i<600&&replay.time<record.duration;i++)replay.advance(.1);
  assert.equal(replay.time,record.duration);assert.deepEqual(replayFrame(record,record.duration).rocket,flight.state.rocket.position);assert.equal(JSON.stringify(record),saved);
  legs.push({from,target,angleDeg:course[0],speed:course[1],time:flight.state.elapsed,distance:flight.distance,steps:flight.steps,end:flight.state.rocket.position,nextLaunch:next.launch.position});
  writeFileSync(new URL(`${name}-${from}-${target}-flight.json`,dir),JSON.stringify(record));
 }
 assert.equal(p.state.voyage.completed,true);assert.ok(p.state.cleared.includes('homeward-09'));assert.equal(p.storage.getItem('classic'),'stars');assert.equal(p.storage.getItem('audio'),'on');assert.deepEqual(p.state.custom,{kept:true});
 results.push({route:name,legs,totalTime:legs.reduce((n,l)=>n+l.time,0),totalDistance:legs.reduce((n,l)=>n+l.distance,0),visited:p.state.voyage.visited,rewards:p.state.voyage.rewards,status:'PASS',preview:'exact state',rate100:'exact state and step count'});writeFileSync(new URL('route-results.json',dir),JSON.stringify(results,null,2));
});
test('全16区間の参考航路は自己完結した物理シミュレーションで到達する',()=>{
 for(const [key,course]of Object.entries(VOYAGE_COURSES)){const [checkpoint,selected]=key.split('>');assert.equal(fly(createOpenVoyage({checkpoint,selected}),course).state.status,'cleared',key);}
});
test('非選択地点は終了させず、飛行中の変更でも位置・速度・経過時刻は保持する',()=>{
 const stage=createOpenVoyage({selected:'rescue'}),course=VOYAGE_COURSES['origin>rescue'];let state=createSimulation({...stage,goal:{...DESTINATIONS[0]}},{angleDeg:course[0],speed:course[1]});
 while(state.status==='flying'&&state.elapsed<6.2)state=stepSimulation(state,1/120);
 assert.equal(state.status,'flying');assert.ok(Math.hypot(state.rocket.position.x-stage.goal.x,state.rocket.position.y-stage.goal.y)<stage.goal.radius);
 const before=structuredClone(state);state={...state,goal:{...stage.goal}};assert.deepEqual(state.rocket,before.rocket);assert.equal(state.elapsed,before.elapsed);state=stepSimulation(state,1/120);assert.equal(state.status,'cleared');assert.equal(state.target,'rescue');
});
test('報酬は再訪で重複せず、参考航路・距離短縮・情報を保存、チェックポイントは失敗で変わらない',()=>{
 const p=progress();let time=0;
 for(const target of ['rescue','planet','rescue','planet','station']){
  const v=normalizeVoyage(p.state.voyage),stage=createOpenVoyage({...v,selected:target}),flight=fly(stage,VOYAGE_COURSES[v.checkpoint+'>'+target]);p.selectDestination(target);assert.ok(p.dock(flight.state));time+=flight.state.elapsed;
 }
 assert.equal(p.state.voyage.rewards.filter(r=>r==='navigation-tech').length,1);assert.equal(p.state.voyage.rewards.filter(r=>r==='route-charts').length,1);assert.equal(homewardDistance(p.state).travelled,HOMEWARD_SECTORS.slice(0,8).reduce((n,s)=>n+s.distance,0)+900);
 assert.ok(Math.abs(p.state.voyage.elapsed-time)<1e-9);const before=structuredClone(p.state.voyage);assert.equal(p.dock({...createSimulation(createOpenVoyage(p.state.voyage)),status:'crashed'}),false);assert.deepEqual(p.state.voyage,before);
});
test('危険な寄港発射位置を選ばず、未知の旧フィールドと08までのセーブを維持',()=>{
 const stage=createOpenVoyage({checkpoint:'rescue'}),blocked={...stage.planets[0],x:900,y:3260},point=safeDeparture({checkpoint:'rescue'},[blocked]);assert.notDeepEqual(point,{x:900,y:3260});assert.ok(Math.hypot(point.x-blocked.x,point.y-blocked.y)>blocked.radius+34);
 const p=progress(),raw=p.storage.getItem(HOMEWARD_KEY);new HomewardProgress(p.storage);assert.equal(p.storage.getItem(HOMEWARD_KEY),raw);assert.equal(sectorUnlocked(p.state,'homeward-09'),true);assert.equal(p.clear('homeward-09'),false);assert.ok(!p.state.voyage);
});
test('既存01〜08の保存済み基準到達時間と終点を維持',()=>{
 for(const def of HOMEWARD_SECTORS.slice(0,8)){
  const folder=Number(def.number)<=3?'first-voyage':'lost-sectors',old=JSON.parse(readFileSync(new URL(`../reports/${folder}/${def.id}-flight.json`,import.meta.url),'utf8')),stage=getHomewardSector(def.id),answer=[stage.solution.angleDeg,stage.solution.speed],end=fly(stage,answer).state,last=old.frames.at(-1);
  assert.equal(end.elapsed,old.duration);assert.deepEqual(end.rocket.position,{x:last[1],y:last[2]});
 }
});
test('旧日誌から残存記録だけを非破壊移行、重要記録の再移行・初回スロットは上書きしない',async()=>{
 const p=progress(),record=JSON.parse(readFileSync(new URL('../reports/first-voyage/homeward-01-flight.json',import.meta.url),'utf8'));record.id='old-record';const snapshot=JSON.stringify(record),rows=new Map();
 const archive={list:async()=>[...rows],find:async id=>[...rows.values()].find(r=>r.id===id),saveFirst:async(key,value)=>{if(!rows.has(key))rows.set(key,structuredClone(value));return rows.get(key).id;}};
 p.log('homeward-02',{clearFlightId:'deleted'});let result=await migrateHomewardRecords(p,{list:async()=>[record]},archive);assert.equal(result.migrated,1);assert.deepEqual(result.missing,['homeward-02']);assert.equal(p.state.journal['homeward-01'].importantFlightId,'old-record');assert.equal(p.state.journal['homeward-02'].importantFlightId,undefined);assert.equal(JSON.stringify(record),snapshot);
 result=await migrateHomewardRecords(p,{list:async()=>[]},archive);assert.equal(result.migrated,0);assert.equal(rows.size,1);
 await assert.rejects(new HomewardArchive(null).list(),/IndexedDB/);
});
test('惑星調査の参考航路は引力と反発で曲がり、重力を除いた対照では到達しない',()=>{
 const stage=createOpenVoyage({selected:'planet'}),course=VOYAGE_COURSES['origin>planet'],actual=fly(stage,course),control=fly({...stage,planets:[]},course);
 assert.equal(actual.state.status,'cleared');assert.notEqual(control.state.status,'cleared');
 assert.ok(Math.abs(Math.atan2(actual.state.rocket.velocity.y,actual.state.rocket.velocity.x)*180/Math.PI-course[0])>2);
});
test('スリングショットでも同じ速度ベクトルを使い直接帰還できる',()=>{
 const stage=createOpenVoyage(),[angle,speed]=VOYAGE_COURSES['origin>gate'],r=angle*Math.PI/180,shot=slingshotLaunch(stage.launch.position,{x:250-Math.cos(r)*105,y:4500-Math.sin(r)*105});let state=createSimulation(stage,{velocity:shot.velocity});while(state.status==='flying')state=stepSimulation(state,1/120);
 const precision=fly(stage,[angle,speed]).state;assert.equal(state.status,'cleared');assert.equal(state.elapsed,precision.elapsed);assert.ok(Math.hypot(state.rocket.position.x-precision.rocket.position.x,state.rocket.position.y-precision.rocket.position.y)<1e-7);
});
