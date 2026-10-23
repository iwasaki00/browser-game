import test from'node:test';
import assert from'node:assert/strict';
import {createFlightRecorder,replayFrame,ReplayClock}from'../js/flight-record.js';
import {GalleryStore,galleryErrorMessage}from'../js/gallery-store.js';
import {createSimulation,stepSimulation}from'../js/physics.js';
import {stepLiveFlight}from'../js/live-gravity.js';
import {getStage}from'../js/stages.js';
import {CHALLENGES}from'../js/challenges.js';
function recordFlight(stage,launch={},live=false){
 let state=createSimulation(stage,launch);const recorder=createFlightRecorder(stage,state,{gameMode:live?'live':'design',launchMode:'precision',playType:stage.rules?'challenge':'free'},123456);
 const states=[structuredClone(state)];
 for(let n=0;n<1441&&state.status==='flying';n++){
  state=live?stepLiveFlight(state,n>24&&n<72?{[stage.planets[0].id]:{x:280,y:300}}:{},stage,'live'):stepSimulation(state,1/120);
  recorder.capture(state);states.push(state);
 }return {record:recorder.finish(state),states,recorder};
}
for(const outcome of ['clear','fail'])test(`軌道${outcome}記録と全固定ステップの再生一致`,()=>{
 const stage=outcome==='clear'?structuredClone(CHALLENGES[0]):getStage(),before=structuredClone(stage);
 const {record,states,recorder}=recordFlight(stage,outcome==='clear'?stage.solution:{});
 assert.equal(record.result,outcome);assert.equal(record.frames.length,states.length);assert.deepEqual(stage,before);
 for(let i=0;i<states.length;i++){
  const frame=replayFrame(record,states[i].elapsed);assert.deepEqual(frame.rocket,states[i].rocket.position);
  for(let j=0;j<frame.planets.length;j++)assert.equal(frame.planets[j].x,states[i].planets[j].x);
 }
 assert.equal(recorder.finish(states.at(-1)),null);assert.ok(record.frames.length<=1443);
});
test('重力操作の移動履歴とサブステップ補間を再現',()=>{
 const {record,states}=recordFlight(getStage(),{},true);
 assert.ok(states.some(s=>s.planets[0].x!==states[0].planets[0].x));
 for(let i=0;i<states.length;i++)assert.deepEqual(replayFrame(record,states[i].elapsed).planets,states[i].planets);
 const a=record.frames[25],b=record.frames[26],frame=replayFrame(record,(a[0]+b[0])/2);
 assert.ok(Math.abs(frame.rocket.x-(a[1]+b[1])/2)<1e-9);
});
test('再生速度・一時停止・最初から・終端',()=>{
 const {record}=recordFlight(getStage());const clock=new ReplayClock(record);
 assert.equal(clock.advance(.1).time,0);clock.restart();
 for(const speed of [.5,1,2,4]){clock.time=0;clock.playing=true;clock.setSpeed(speed);assert.equal(clock.advance(.1).time,.1*speed);}
 clock.playing=false;const paused=clock.time;clock.advance(1);assert.equal(clock.time,paused);
 clock.restart();assert.equal(clock.time,0);clock.advance(99);assert.equal(clock.time,record.duration);assert.equal(clock.playing,false);
});
test('RESET中断記録とメタデータ・初期状態を独立保存',()=>{
 const stage=getStage(),state=createSimulation(stage),rec=createFlightRecorder(stage,state,{gameMode:'live',launchMode:'slingshot'});
 stage.planets[0].mass=0;state.planets[0].x=999;
 const result=rec.finish(state,'reset');assert.equal(result.result,'fail');assert.equal(result.reason,'reset');
 assert.notEqual(result.planets[0].mass,0);assert.notEqual(result.planets[0].x,999);assert.equal(result.launchMode,'slingshot');
});
test('IndexedDB非対応・容量不足でも例外を通知用に扱える',async()=>{
 await assert.rejects(new GalleryStore(null).list(),/ゲームは続けられます/);
 assert.match(galleryErrorMessage({name:'QuotaExceededError'}),/保存容量/);
});
