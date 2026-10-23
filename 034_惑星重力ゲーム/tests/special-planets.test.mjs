import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePlanet,PLANET_TYPES,placementAllowed} from '../js/planets.js';
import {gravitationalAcceleration,createSimulation,stepSimulation,simulateTrajectory}from'../js/physics.js';
import {createPreview,advancePreview}from'../js/preview.js';
import {stepLiveFlight,movePlanets}from'../js/live-gravity.js';
import {getSpecialSample,SPECIAL_SAMPLES}from'../js/special-samples.js';
import {CHALLENGES}from'../js/challenges.js';
import {readFile}from'node:fs/promises';
const origin={x:0,y:0},p={id:'p',x:100,y:0};
test('7種類の設定とサイズ変更・特殊→通常でパラメータを残さない',()=>{
 assert.equal(Object.keys(PLANET_TYPES).length,7);
 for(const type of Object.keys(PLANET_TYPES))for(const size of ['small','medium','large']){
  const q=configurePlanet(p,type,size);assert.ok(q.mass>0&&q.radius>0);
 }
 const regular=configurePlanet(configurePlanet(p,'repulsor'),'earth');
 assert.equal(regular.gravityDirection,undefined);assert.equal(regular.hazards,undefined);
 assert.deepEqual(regular,configurePlanet(p,'earth'));
});
test('ブラックホール・高密度惑星の引力と有限性',()=>{
 const earth=configurePlanet(p,'earth'),hole=configurePlanet(p,'blackhole'),dense=configurePlanet(p,'dense');
 assert.ok(gravitationalAcceleration(origin,[hole]).x>gravitationalAcceleration(origin,[earth]).x*3);
 assert.ok(dense.radius<earth.radius&&dense.mass>earth.mass);
 assert.ok(gravitationalAcceleration(origin,[dense]).x>gravitationalAcceleration(origin,[earth]).x);
 assert.ok(Number.isFinite(gravitationalAcceleration({x:100.001,y:0},[hole]).x));
});
test('反重力は同質量・同倍率の通常加速度と逆符号',()=>{
 const rep=configurePlanet(p,'repulsor'),normal={...rep,gravityDirection:1};
 const a=gravitationalAcceleration({x:0,y:20},[rep]),b=gravitationalAcceleration({x:0,y:20},[normal]);
 assert.equal(a.x,-b.x);assert.equal(a.y,-b.y);
});
test('複数特殊惑星と通常惑星を合算',()=>{
 const planets=['blackhole','repulsor','star','dense','earth'].map((type,i)=>configurePlanet({...p,id:String(i),x:100+i*10,y:i*5},type));
 const total=planets.map(q=>gravitationalAcceleration(origin,[q])).reduce((a,b)=>({x:a.x+b.x,y:a.y+b.y}),{x:0,y:0});
 assert.deepEqual(gravitationalAcceleration(origin,planets),total);
 assert.deepEqual(gravitationalAcceleration(origin,[...planets].reverse()),total);
});
for(const [type,reason,y]of[['blackhole','absorbed',0],['star','overheated',40],['dense',undefined,0]])test(`${type}高速通過で危険/衝突を検出`,()=>{
 const s=getSpecialSample(type);s.planets=[configurePlanet({id:'p',x:100,y:200},type)];
 // Zero mass isolates the swept-contact test from acceleration.
 s.planets[0].mass=0;s.launch.position={x:0,y:200+y};s.goal={id:'g',x:350,y:450,radius:5};
 const next=stepSimulation(createSimulation(s,{velocity:{x:24000,y:0}}),1/120);
 assert.equal(next.status,'crashed');assert.equal(next.reason,reason);
});
for(const type of Object.keys(SPECIAL_SAMPLES))test(`${type}サンプル・予測と実飛行の全ステップ一致・入力不変`,()=>{
 const s=getSpecialSample(type),before=structuredClone(s);assert.ok(placementAllowed(s.planets[0],s));
 const initial=createSimulation(s),job=createPreview(s,initial.rocket.velocity);
 while(!job.done)advancePreview(job);
 let state=createSimulation(s),live=createSimulation(s);
 for(const point of job.points.slice(1)){
  state=stepSimulation(state,1/120);live=stepLiveFlight(live,{},s,'live');
  assert.deepEqual({...state.rocket.position,time:state.elapsed},point);assert.deepEqual(live,state);
 }
 assert.deepEqual(state,job.state);assert.deepEqual(s,before);
 const snapshot=createSimulation(s);s.planets[0].hazards?.push({radius:999,reason:'test'});assert.deepEqual(snapshot.planets,before.planets);
});
test('恒星の危険外周も配置・移動制約で保護',()=>{
 const s=getSpecialSample('star'),q=s.planets[0];
 assert.equal(placementAllowed({...q,x:40,y:200},s),false);
 const moved=movePlanets(s.planets,{[q.id]:{x:0,y:200}},s,2,1000);
 assert.ok(placementAllowed(moved[0],{...s,planets:moved}));
});
test('重力操作中の特殊領域にも同じ失敗理由を適用',()=>{
 const s=getSpecialSample('star');s.planets[0].mass=0;s.launch.position={x:70,y:320};
 let state=createSimulation(s,{velocity:{x:200,y:0}});
 for(let i=0;i<120&&state.status==='flying';i++)state=stepLiveFlight(state,{},s,'live');
 assert.equal(state.status,'crashed');assert.equal(state.reason,'overheated');
});
test('移動する恒星がロケットを横切る場合の熱領域も検出',()=>{
 const s=getSpecialSample('star');s.planets[0].x=100;s.planets[0].y=200;s.planets[0].mass=0;
 const state=createSimulation(s,{velocity:{x:0,y:0}});state.rocket.position={x:180,y:200};
 const next=stepLiveFlight(state,{'sample-planet':{x:260,y:200}},s,'live',1,1000);
 assert.equal(next.status,'crashed');assert.equal(next.reason,'overheated');
});
test('全10ステージのデータと通常惑星の軌道はv0.5.1と不変',async()=>{
 const baseline=JSON.parse(await readFile(new URL('../reports/balance/after.json',import.meta.url),'utf8'));
 assert.deepEqual(CHALLENGES.slice(0,10),baseline.stages);
 // Shared force/contact changes affect all stages, so verify all reference and ★3 routes.
 for(const s of CHALLENGES.slice(0,10)){
  const r=simulateTrajectory(s,s.solution);assert.equal(r.state.status,'cleared');assert.ok(Math.abs(r.state.elapsed-s.verification.elapsed)<1e-9);
  const old=baseline.stages.find(q=>q.id===s.id);
  assert.deepEqual(r,simulateTrajectory(old,old.solution));
  assert.equal(simulateTrajectory(s,s.threeStarSolution).state.status,'cleared');
 }
});
