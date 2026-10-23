import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlanets,stepLiveFlight,loadGameMode,saveGameMode} from '../js/live-gravity.js';
import {getStage} from '../js/stages.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {placementAllowed} from '../js/planets.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';
test('設計モードは固定・既存の飛行と一致',()=>{
 const s=getStage(),state=createSimulation(s);
 assert.deepEqual(stepLiveFlight(state,{'planet-a':{x:80,y:80}},s,'design'),stepSimulation(state,1/120));
});
test('移動速度上限と不変入力',()=>{
 const s=getStage(),before=structuredClone(s);
 const p=movePlanets(s.planets,{'planet-a':{x:300,y:300}},s,1/120)[0];
 assert.ok(Math.hypot(p.x-196,p.y-282)<=90/120+1e-10);assert.notEqual(p.x,196);assert.deepEqual(s,before);
});
for(const obstacle of ['planet','goal','launch','edge'])test(`高速な移動でも${obstacle}の制約をすり抜けない`,()=>{
 const s=getStage();s.planets[0].x=150;s.planets[0].y=250;
 if(obstacle==='planet')s.planets.push({id:'b',x:270,y:250,radius:20,mass:0});
 const target=obstacle==='planet'?{x:350,y:250}:obstacle==='goal'?s.goal:obstacle==='launch'?s.launch.position:{x:-999,y:250};
 const result=movePlanets(s.planets,{'planet-a':target},s,1,10000);
 assert.equal(placementAllowed(result[0],{...s,planets:result}),true);
});
for(const method of ['precision','slingshot'])test(`${method}と重力操作の共存、惑星移動で軌道変化`,()=>{
 const s=getStage(),v=method==='precision'?velocityFromAngleSpeed(-55,170):slingshotLaunch(s.launch.position,{x:0,y:490}).velocity;
 let fixed=createSimulation(s,{velocity:v}),live=createSimulation(s,{velocity:v});
 for(let i=0;i<50;i++){fixed=stepSimulation(fixed,1/120);live=stepLiveFlight(live,{'planet-a':{x:280,y:300}},s,'live');}
 assert.notDeepEqual(live.rocket.position,fixed.rocket.position);
});
test('フレーム分割が異なっても同じ固定ステップ数なら一致',()=>{
 const s=getStage();
 function run(stepsPerFrame){let state=createSimulation(s),steps=0;while(steps<60){for(let i=0;i<stepsPerFrame&&steps<60;i++,steps++)state=stepLiveFlight(state,{'planet-a':{x:280,y:300}},s,'live');}return state;}
 assert.deepEqual(run(2),run(4));assert.deepEqual(run(1),run(8));
});
test('モード保存復元・例外耐性',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 assert.equal(loadGameMode(storage),'design');saveGameMode(storage,'live');assert.equal(loadGameMode(storage),'live');
 assert.equal(loadGameMode({getItem(){throw Error();}}),'design');
});
