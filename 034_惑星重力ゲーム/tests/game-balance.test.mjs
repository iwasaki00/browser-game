import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {balanceRoutes} from './game-balance-routes.mjs';
import {runRoute,legal} from './measure-game-balance.mjs';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {FlightClock} from '../js/flight-clock.js';
import {FINAL_COURSES} from '../js/final-courses.js';
import {velocityFromAngleSpeed} from '../js/launch.js';
import {adjustInput,inputStep,segmentDistance,observeApproach,goalKey,launchInput,flightFeedback,attemptKey} from '../js/navigation-feedback.js';
const dir=new URL('../reports/game-balance/',import.meta.url),measurements=JSON.parse(readFileSync(new URL('measurements.json',dir),'utf8')),timings=[];
test('測定表の単独・組合せ試験、合法範囲、保護ファイル',()=>{
 assert.equal(measurements.results.length,balanceRoutes().length);
 for(const [file,hash]of Object.entries(measurements.hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),hash,file);
 for(const r of measurements.results){assert.equal(r.samples.length,143);assert.equal(r.angle.tested,13);assert.equal(r.speed.tested,11);assert.equal(r.combined.tested,120);for(const kind of ['angle','speed','combined'])assert.equal(r[kind].valid+r[kind].excluded,r[kind].tested);assert.ok(r.samples.find(s=>s.da===0&&s.ds===0).success);}
});
for(const route of balanceRoutes())test(`${route.id}: 同じ攻略入力・最接近・予測・1/10/100倍`,()=>{
 const {stage,input}=route,before=structuredClone(stage),baseline=runRoute(stage,input),old=measurements.results.find(r=>r.id===route.id);
 assert.ok(baseline.success);assert.equal(baseline.state.elapsed,old.time);assert.deepEqual(baseline.state.rocket.position,old.end);
 const times=[];
 for(const rate of [1,10,100]){let state=createSimulation(stage,input),steps=0,frames=0,approach=null;const clock=new FlightClock({now:()=>0}),start=performance.now();clock.setRate(rate);
  while(state.status==='flying'){frames++;clock.advance(1/60,dt=>{const prev=state;state=stepSimulation(state,dt);approach=observeApproach(approach,prev,state);steps++;return state.status==='flying';});}
  const cost=performance.now()-start;assert.deepEqual(state,baseline.state);assert.equal(steps,baseline.steps);assert.equal(approach.minimum,baseline.minimum);times.push({rate,frames,scheduledWallSeconds:frames/60,cpuMs:cost,effective:state.elapsed/(frames/60)});
 }
 const job=createPreview(stage,velocityFromAngleSpeed(input.angleDeg,input.speed));while(!job.done)advancePreview(job,2000);
 assert.deepEqual(job.state,baseline.state);assert.equal(job.approach.minimum,baseline.minimum);assert.deepEqual(stage,before);
 timings.push({id:route.id,flightSeconds:baseline.state.elapsed,times});writeFileSync(new URL('timings.json',dir),JSON.stringify(timings,null,2));
});
test('微調整は範囲内・累積誤差なし・粗調整と切替',()=>{
 assert.equal(inputStep('angle',true),.01);assert.equal(inputStep('angle',false),1);assert.equal(inputStep('speed',true),1);assert.equal(inputStep('speed',false),10);
 let angle=-65;for(let i=0;i<10;i++)angle=adjustInput(angle,1,'angle',true,-180,180);assert.equal(angle,-64.9);
 assert.equal(adjustInput(219,1,'speed',false,120,220),220);assert.equal(adjustInput(-72,-1,'angle',true,-72,-35),-72);
 const route=balanceRoutes().find(r=>r.id==='homeward-02');assert.equal(runRoute(route.stage,{angleDeg:-64.99,speed:220}).success,true);assert.equal(runRoute(route.stage,{angleDeg:-64,speed:220}).success,false);
});
test('線分最接近・目標変更・不変性・失敗理由',()=>{
 assert.equal(segmentDistance({x:-10,y:0},{x:10,y:0},{x:0,y:3}),3);assert.equal(segmentDistance({x:0,y:0},{x:0,y:0},{x:3,y:4}),5);
 const a={rocket:{position:{x:-10,y:0}},elapsed:0},b={rocket:{position:{x:10,y:0}},elapsed:1,goal:{id:'a',x:0,y:3,radius:1},status:'timeout'},before=structuredClone([a,b]);
 const m=observeApproach(null,a,b);assert.equal(m.minimum,3);assert.deepEqual([a,b],before);assert.equal(flightFeedback(b,m).gap,2);
 const changed={...b,goal:{id:'b',x:100,y:100,radius:1}},next=observeApproach(m,a,changed);assert.notEqual(next.key,m.key);assert.equal(next.key,goalKey(changed.goal));assert.ok(next.minimum>100);
 for(const [reason,text]of [['absorbed','吸収'],['overheated','熱'],['encounter-meteor','隕石'],['encounter-ufo','UFO']])assert.ok(flightFeedback({...b,status:'crashed',reason},m).reason.includes(text));
 assert.match(flightFeedback(b,m,true).reason,/未達成/);assert.match(flightFeedback({...b,status:'escaped'},m).reason,/逸脱/);
});
test('共通速度ベクトル・復元キーは別ステージや寄港地点を混同しない',()=>{
 const velocity=velocityFromAngleSpeed(-65.123,217.3),input=launchInput(velocity),again=velocityFromAngleSpeed(input.angleDeg,input.speed);assert.ok(Math.hypot(again.x-velocity.x,again.y-velocity.y)<1e-12);
 const r=balanceRoutes()[0],s=structuredClone(r.stage);assert.equal(attemptKey(s,'challenge'),attemptKey(r.stage,'challenge'));s.launch.position.x++;assert.notEqual(attemptKey(s,'challenge'),attemptKey(r.stage,'challenge'));assert.notEqual(attemptKey(s,'free'),attemptKey(s,'challenge'));
 assert.equal(legal(r.stage,-180,220),false);
});
test('通常帰還の参考入力は旧攻略を維持し、同じ摂動格子で許容性を比較',()=>{
 const route=balanceRoutes().find(r=>r.id==='FINAL:origin>earth'),report=JSON.parse(readFileSync(new URL('reference-adjustment.json',dir),'utf8')),[angleDeg,speed,time]=FINAL_COURSES['origin>earth'];
 assert.equal(report[0].combined.total,report[1].combined.total);assert.ok(report[1].combined.success>report[0].combined.success);assert.ok(report[1].angle.success>report[0].angle.success);
 const result=runRoute(route.stage,{angleDeg,speed});assert.ok(result.success);assert.equal(result.state.elapsed,time);assert.equal(report[1].angleDeg,angleDeg);assert.ok(runRoute(route.stage,route.input).success);
 for(const rate of [1,10,100]){let state=createSimulation(route.stage,{angleDeg,speed});const clock=new FlightClock({now:()=>0});clock.setRate(rate);while(state.status==='flying')clock.advance(1/60,dt=>{state=stepSimulation(state,dt);return state.status==='flying';});assert.deepEqual(state,result.state);}
 const job=createPreview(route.stage,velocityFromAngleSpeed(angleDeg,speed));while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,result.state);
});
