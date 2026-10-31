import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {HomewardExperience} from '../js/homeward-experience.js';
import {previewFeatures,VoyageFeedback,discoveryStyle} from '../js/voyage-presentation.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';
import {FlightClock} from '../js/flight-clock.js';
import {createFlightRecorder} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
import {Camera} from '../js/camera.js';import {CinematicCamera} from '../js/cinematic-camera.js';
import {createOpenVoyage,destination} from '../js/open-voyage.js';import {getHomewardSector} from '../js/homeward-data.js';
const dir=new URL('../reports/homeward-experience/',import.meta.url);mkdirSync(dir,{recursive:true});const results=[];
function fly(model,target,angle,rate=1,kind='precision'){
 const stage=model.stage();let velocity=velocityFromAngleSpeed(angle,220);if(kind==='slingshot'){const d=105,r=angle*Math.PI/180,s=slingshotLaunch(stage.launch.position,{x:stage.launch.position.x-Math.cos(r)*d,y:stage.launch.position.y-Math.sin(r)*d});assert.ok(Math.hypot(s.velocity.x-velocity.x,s.velocity.y-velocity.y)<1e-8);velocity=s.velocity;}
 let state=createSimulation(stage,{velocity}),steps=0,changedAt=null,maxTurn=0;const clock=new FlightClock({now:()=>0}),events=[],rec=createFlightRecorder(stage,state,{playType:'experience',gameMode:'design',launchMode:kind},1);clock.setRate(rate);
 while(state.status==='flying')clock.advance(1/60,dt=>{const previous=state;state=stepSimulation(state,dt);maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(state.rocket.velocity.y,state.rocket.velocity.x)-angle*Math.PI/180));events.push(...model.observe(previous,state));rec.capture(state);assert.ok(++steps<21601);if(target!=='gate'&&state.status==='flying'&&state.goal.id!==target&&model.select(target)){state={...state,goal:{...model.target}};changedAt=state.elapsed;}return state.status==='flying';});
 assert.equal(state.status,'cleared');assert.equal(state.target,target);assert.ok(model.dock(state));const job=createPreview({...stage,goal:{...state.goal}},velocity);while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,state);
 const record={...rec.finish(state),goal:{...state.goal},frontierEvents:events,experience:true};const copy=JSON.stringify(record),replay=new FlightReplay(record);replay.setMode('cinematic');replay.restart();for(let n=0;n<4000&&replay.time<record.duration;n++)replay.advance(.1);assert.equal(replay.time,record.duration);assert.equal(JSON.stringify(record),copy);return {state,events,record,changedAt,steps,maxTurn,features:previewFeatures(job,state.goal)};
}
for(const [name,targets,angles]of [['direct',['gate'],[-59]],['detour',['probe','gate'],[-48,-59]]])test(`${name}: 調整・発見・任意寄り道・到達・予測・1/100倍・両発射方式・再生`,()=>{
 const a=new HomewardExperience(),b=new HomewardExperience(),c=new HomewardExperience(),legs=[];for(let i=0;i<targets.length;i++){if(i){assert.ok(a.select(targets[i]));assert.ok(b.select(targets[i]));assert.ok(c.select(targets[i]));}const r=fly(a,targets[i],angles[i]),fast=fly(b,targets[i],angles[i],100),sling=fly(c,targets[i],angles[i],1,'slingshot');assert.equal(sling.state.elapsed,r.state.elapsed);assert.ok(Math.hypot(sling.state.rocket.position.x-r.state.rocket.position.x,sling.state.rocket.position.y-r.state.rocket.position.y)<1e-6);assert.deepEqual(fast.state,r.state);assert.equal(fast.steps,r.steps);assert.deepEqual(fast.events.map(({at,...e})=>e),r.events.map(({at,...e})=>e));assert.equal(r.features.kind,'clear');if(i===0)assert.ok(r.maxTurn>Math.PI/36);legs.push({target:targets[i],angle:angles[i],speed:220,time:r.state.elapsed,maxTurnDegrees:r.maxTurn*180/Math.PI,end:r.state.rocket.position,changedAt:r.changedAt,events:r.events});writeFileSync(new URL(`${name}-${i}.json`,dir),JSON.stringify(r.record));}assert.ok(a.voyage.completed);assert.ok(legs[0].events.length);if(name==='detour')assert.ok(legs[0].changedAt>0);results.push({name,legs,totalTime:legs.reduce((n,l)=>n+l.time,0)});writeFileSync(new URL('route-results.json',dir),JSON.stringify(results,null,2));
});
test('体験はロック・通常進行のない使い捨て。未検出地点は選べず、初期設定は自動成功しない',()=>{
 const demo=new HomewardExperience();assert.equal(demo.select('probe'),false);assert.equal(demo.select('temporal-anomaly'),false);const s=demo.stage(),copy=structuredClone(s);let state=createSimulation(s,s.launch);while(state.status==='flying')state=stepSimulation(state,1/120);assert.notEqual(state.status,'cleared');assert.deepEqual(s,copy);assert.equal(s.openVoyage,false);assert.equal(s.experience,true);
});
test('表示特徴・通知強調は不変な入力から作り、マーカーと寿命を制限する',()=>{
 const job={done:true,state:{status:'crashed'},points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]},copy=structuredClone(job),features=previewFeatures(job,{x:0,y:100,radius:10});assert.equal(features.kind,'danger');assert.ok(features.turns.length<=3);assert.ok(features.near);assert.deepEqual(job,copy);const feedback=new VoyageFeedback();feedback.publish([{id:'D01',state:'DETECTED'}],()=>({x:15,y:20}));assert.equal(feedback.cue.kind,'discovery');feedback.update(3);assert.equal(feedback.cue,null);assert.equal(discoveryStyle({id:'CLUE-08'}),'route');assert.equal(discoveryStyle({id:'CLUE-06'}),'decode');
});
test('CINEMATICの発見構図は一時的。手動を変えず、物理スナップショットも変更しない',()=>{
 const stage=createOpenVoyage(),state=createSimulation(stage,{angleDeg:-59,speed:220}),copy=structuredClone(state),camera=new Camera(),cine=new CinematicCamera();camera.resize(375,500);camera.fit(stage);camera.mode='fixed';const before=structuredClone(camera.center);cine.cue({x:state.rocket.position.x+300,y:state.rocket.position.y-50});cine.update(camera,state,.016);assert.deepEqual(camera.center,before);camera.mode='cinematic';const flight={...state,status:'flying',elapsed:3};cine.update(camera,flight,.1);assert.equal(cine.phase,'discovery');for(let n=0;n<20;n++)cine.update(camera,flight,.1);assert.notEqual(cine.phase,'discovery');assert.deepEqual(state,copy);
});
test('通常Sector09とSector01〜08の基準終端を変更しない',()=>{
 for(const route of JSON.parse(readFileSync(new URL('../reports/open-voyage/route-results.json',import.meta.url),'utf8'))){let v={};for(const l of route.legs){let s=createSimulation(createOpenVoyage({...v,checkpoint:l.from,selected:l.target}),{angleDeg:l.angleDeg,speed:l.speed});while(s.status==='flying')s=stepSimulation(s,1/120);assert.equal(s.elapsed,l.time);assert.deepEqual(s.rocket.position,l.end);v={elapsed:(v.elapsed??0)+s.elapsed,planets:s.planets};}}
 for(let i=1;i<=8;i++){const id='homeward-'+String(i).padStart(2,'0'),stage=getHomewardSector(id),old=JSON.parse(readFileSync(new URL(`../reports/${i<=3?'first-voyage':'lost-sectors'}/${id}-flight.json`,import.meta.url),'utf8'));let s=createSimulation(stage,stage.solution);while(s.status==='flying')s=stepSimulation(s,1/120);assert.equal(s.elapsed,old.duration);assert.deepEqual(s.rocket.position,{x:old.frames.at(-1)[1],y:old.frames.at(-1)[2]});}
});
