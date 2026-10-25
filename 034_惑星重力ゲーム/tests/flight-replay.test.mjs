import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FlightReplay,replaySnapshot,REPLAY_HOLD} from '../js/flight-replay.js';
import {replayFrame,createFlightRecorder} from '../js/flight-record.js';
const legacy=()=>({version:1,id:'old',stageName:'旧記録',createdAt:1,favorite:true,result:'clear',duration:2,
 world:{width:375,height:500},goal:{x:50,y:50,radius:24},planets:[{id:'p',x:60,y:40,radius:12,color:'#ace'}],
 frames:[[0,10,90,60,40],[1,20,70,65,45],[2,50,50,70,50]]});
function freeze(value){if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;}
const finite=c=>{assert.ok(Number.isFinite(c.zoom));assert.ok(Number.isFinite(c.center.x));assert.ok(Number.isFinite(c.center.y));assert.ok(c.zoom>=.1&&c.zoom<=3);};
test('速度未記録の旧v1座標から速度を推定し、保存位置・移動惑星は従来の補間と一致',()=>{
 const record=freeze(legacy());
 for(const time of [0,.5,1,1.5,2]){
  const s=replaySnapshot(record,time),f=replayFrame(record,time);
  assert.deepEqual(s.rocket.position,f.rocket);assert.deepEqual(s.planets,f.planets);
  assert.deepEqual(s.rocket.velocity,{x:time<1?10:30,y:-20});
 }
 assert.equal(replaySnapshot(record,2).status,'cleared');
});
test('一件のみ・同時刻・欠落速度/惑星座標に安全な表示用代替を用いる',()=>{
 const record=legacy();record.frames=[[0,10,90]];record.duration=0;
 let s=replaySnapshot(record,0);assert.deepEqual(s.rocket.velocity,{x:0,y:0});assert.equal(s.planets[0].x,60);
 record.launch={velocity:{x:30,y:-5}};assert.deepEqual(replaySnapshot(record,0).rocket.velocity,{x:30,y:-5});
 record.frames=[[0,10,90,60,40],[0,10,90,60,40]];assert.deepEqual(replaySnapshot(record,0).rocket.velocity,{x:30,y:-5});
 const replay=new FlightReplay(record);replay.setMode('cinematic');replay.restart();replay.advance(1);replay.advance(1);finite(replay.camera);assert.equal(replay.playing,false);
});
test('出航待機と到着余韻、途中の一時停止・再開、終了後の再生',()=>{
 const r=new FlightReplay(legacy());r.setMode('cinematic');r.restart();r.advance(.3);assert.equal(r.time,0);assert.equal(r.phase,'intro');
 r.pause();const camera=structuredClone(r.camera),remaining=r.remaining;r.advance(9);assert.deepEqual(structuredClone(r.camera),camera);assert.equal(r.remaining,remaining);
 r.toggle();r.advance(REPLAY_HOLD.intro-.3);assert.equal(r.phase,'flight');assert.ok(r.time<1e-8);
 r.seek(1.9);r.advance(.2);assert.equal(r.time,2);assert.equal(r.phase,'outro');assert.equal(r.playing,true);
 r.pause();r.advance(3);assert.equal(r.phase,'outro');r.toggle();r.advance(1);assert.equal(r.phase,'ended');assert.equal(r.playing,false);
 r.toggle();assert.equal(r.phase,'intro');assert.equal(r.time,0);
});
test('全カメラモード切替・再生速度は時刻を巻き戻さず、航行倍率とは独立',()=>{
 const r=new FlightReplay(legacy());r.restart();r.advance(.3);
 for(const mode of ['follow','cinematic','overview','normal']){r.setMode(mode);assert.equal(r.time,.3);assert.equal(r.playing,true);assert.equal(r.mode,mode);finite(r.camera);}
 for(const speed of [.5,1,2,4]){r.seek(0);r.setSpeed(speed);r.playing=true;r.advance(.1);assert.equal(r.time,.1*speed);}
 r.setSpeed(100);assert.equal(r.speed,4);r.pause();const time=r.time;r.setMode('follow');assert.equal(r.playing,false);assert.equal(r.time,time);
 assert.deepEqual(r.camera.center,r.snapshot.rocket.position);
});
test('シーク・最初からで判定状態を初期化。手動構図は優先し、自動へ戻せる',()=>{
 const r=new FlightReplay(legacy());r.setMode('cinematic');r.restart();r.cinematic.planetId='stale';r.seek(1.5);assert.notEqual(r.cinematic.planetId,'stale');assert.equal(r.phase,'flight');finite(r.camera);
 r.manual();r.camera.beginPan({x:100,y:100});r.camera.movePan({x:125,y:110});const center={...r.camera.center};r.seek(.5);r.advance(.1);assert.deepEqual(r.camera.center,center);assert.equal(r.mode,'manual');
 r.setMode('cinematic');r.advance(.1);assert.equal(r.mode,'cinematic');r.restart();assert.equal(r.time,0);assert.equal(r.phase,'intro');
});
test('既存HOMEWARD v1の全点再生と新規記録、全操作による記録の非破壊性',()=>{
 const old=JSON.parse(readFileSync(new URL('../reports/first-voyage/homeward-01-flight.json',import.meta.url),'utf8'));
 const state={elapsed:0,status:'flying',rocket:{radius:6,position:{x:10,y:90},velocity:{x:10,y:-20}},planets:legacy().planets};
 const recorder=createFlightRecorder({id:'new',name:'新記録',world:legacy().world,goal:legacy().goal},state,{gameMode:'live',launchMode:'slingshot'},2);
 const end={...state,elapsed:1,status:'cleared',rocket:{...state.rocket,position:{x:20,y:70}},planets:[{...state.planets[0],x:65}]};recorder.capture(end);
 for(const record of [old,recorder.finish(end)]){
  const before=JSON.stringify(record);freeze(record);const r=new FlightReplay(record);r.resize(288,280);r.setMode('cinematic');r.restart();
  for(const row of record.frames){r.seek(row[0]);assert.deepEqual(r.snapshot.rocket.position,{x:row[1],y:row[2]});finite(r.camera);}
  for(const mode of ['normal','follow','overview','cinematic']){r.setMode(mode);r.restart();r.setSpeed(4);for(let i=0;i<200&&r.playing;i++)r.advance(.25);assert.equal(r.time,record.duration);assert.equal(r.playing,false);}
  assert.equal(JSON.stringify(record),before);
 }
});
