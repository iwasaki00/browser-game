import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Camera} from '../js/camera.js';
import {CinematicCamera,CINEMATIC} from '../js/cinematic-camera.js';
import {getStage} from '../js/stages.js';
import {createFreeWorld,getHugeSample} from '../js/worlds.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {FlightClock} from '../js/flight-clock.js';
import {createFlightRecorder} from '../js/flight-record.js';
const dir=new URL('../reports/cinematic-camera/',import.meta.url);mkdirSync(dir,{recursive:true});
const fixture=()=>({status:'flying',elapsed:2,world:{width:1125,height:1500},rocket:{position:{x:300,y:1100},velocity:{x:130,y:-80},radius:6},planets:[],goal:{x:1000,y:100,radius:24}});
function setup(state=fixture()){
 const c=new Camera();c.resize(363,514);c.fit({world:state.world,launch:{position:state.rocket.position},goal:state.goal,planets:state.planets});c.setMode('cinematic');
 return {c,auto:new CinematicCamera(),s:state};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function onScreen(c,point,margin=0){const p=c.toScreen(point);assert.ok(p.x>=margin-1e-6&&p.x<=c.width-margin+1e-6&&p.y>=margin-1e-6&&p.y<=c.height-margin+1e-6,JSON.stringify(p));}
test('発射・通常・高速・到着の優先順位と滑らかなズームイン',()=>{
 const {c,auto,s}=setup();s.elapsed=0;
 auto.update(c,s,1/60);assert.equal(auto.phase,'launch');assert.ok(c.zoom<CINEMATIC.launchZoom);onScreen(c,s.rocket.position);
 s.elapsed=2;let info=auto.update(c,s,1/60);assert.equal(auto.phase,'cruise');assert.ok(info.target.x>s.rocket.position.x);assert.ok(info.target.y<s.rocket.position.y);
 s.rocket.velocity={x:500,y:0};info=auto.update(c,s,1/60);assert.equal(auto.phase,'fast');assert.ok(info.zoom<CINEMATIC.cruiseZoom);
 s.rocket.velocity.x=290;auto.update(c,s,1/60);assert.equal(auto.phase,'fast');s.rocket.velocity.x=250;auto.update(c,s,1/60);assert.equal(auto.phase,'cruise');
 s.goal={x:430,y:1050,radius:24};s.planets=[{id:'p',x:400,y:1000,radius:38}];auto.update(c,s,1/60);assert.equal(auto.phase,'goal');
 s.status='cleared';const old=c.zoom;auto.update(c,s,1/60);assert.equal(auto.phase,'arrival');assert.ok(c.zoom>=old);assert.ok(c.zoom-old<.05);
});
test('接近からスイングバイ離脱まで主要惑星を維持し、危険領域を含めて収める',()=>{
 const {c,auto,s}=setup();s.planets=[{id:'a',x:500,y:1100,radius:38,hazards:[{radius:80}]},{id:'b',x:550,y:1100,radius:30}];
 auto.update(c,s,1/60);assert.equal(auto.phase,'planet');assert.equal(auto.planetId,'a');onScreen(c,s.rocket.position);onScreen(c,s.planets[0]);
 // Planet b becomes closer, but the encounter with a remains selected.
 s.rocket.position={x:640,y:1050};auto.update(c,s,1/60);assert.equal(auto.planetId,'a');
 s.rocket.position={x:900,y:1100};auto.update(c,s,1/60);assert.equal(auto.planetId,'a');
 s.rocket.position={x:1000,y:1100};auto.update(c,s,1/60);assert.notEqual(auto.planetId,'a');
});
test('ゴール接近のヒステリシスで境界の往復に耐える',()=>{
 const {c,auto,s}=setup();s.goal={x:300,y:700,radius:24};
 // LARGE threshold = 240 * sqrt(3), retained to 1.35 times that distance.
 auto.update(c,s,1/60);assert.equal(auto.phase,'goal');s.rocket.position.y=1150;auto.update(c,s,1/60);assert.equal(auto.phase,'goal');
 s.rocket.position.y=1300;auto.update(c,s,1/60);assert.equal(auto.phase,'cruise');
});
test('STANDARD/LARGE/HUGE、全倍率上限、急な100倍移動でロケットを見失わない',()=>{
 for(const preset of ['standard','large','huge'])for(const [w,h]of[[308,415],[363,514],[378,691]]){
  const stage=createFreeWorld(preset),state=createSimulation(stage),{c,auto}=setup(state);c.resize(w,h);
  for(const rate of [1,100])for(const ratio of [0,.1,.5,.95,1]){
   state.rocket.position={x:stage.world.width*ratio,y:stage.world.height*(1-ratio)};state.elapsed=2;
   auto.update(c,state,1/60,rate);assert.ok(c.zoom>=.1&&c.zoom<=3);assert.ok(c.center.x>=c.bounds.left&&c.center.x<=c.bounds.right);assert.ok(c.center.y>=c.bounds.top&&c.center.y<=c.bounds.bottom);onScreen(c,state.rocket.position,20);
   const back=c.toWorld(c.toScreen(state.rocket.position));near(back.x,state.rocket.position.x);near(back.y,state.rocket.position.y);
  }
 }
});
test('位置・ズーム補間は表示時間に従い、同じ状態なら30/60/120fpsで一致',()=>{
 const values=[];
 for(const fps of [30,60,120]){const {c,auto,s}=setup();c.center={...s.rocket.position};c.zoom=.3;for(let i=0;i<fps*2;i++)auto.update(c,s,1/fps);values.push({center:c.center,zoom:c.zoom});}
 for(const value of values.slice(1)){near(value.center.x,values[0].center.x);near(value.center.y,values[0].center.y);near(value.zoom,values[0].zoom);}
});
test('既存3モードでは制御しない。パン・ピンチ・全体表示とCINEMATIC復帰',()=>{
 const {c,auto,s}=setup();
 for(const mode of ['fixed','follow','overview']){c.setMode(mode,{world:s.world,launch:{position:s.rocket.position},goal:s.goal,planets:[]});const before={center:{...c.center},zoom:c.zoom};auto.update(c,s,.1);assert.deepEqual({center:c.center,zoom:c.zoom},before);}
 c.setMode('cinematic');c.beginPan({x:100,y:100});c.movePan({x:130,y:110});assert.equal(c.mode,'fixed');
 c.setMode('cinematic');auto.reset();auto.update(c,s,.1);assert.equal(c.mode,'cinematic');assert.equal(auto.updates,1);
});
test('カメラ演出は状態を変更せず、1倍/100倍で全飛行記録と終端が完全一致',()=>{
 const metrics=[];
 for(const rate of [1,100]){
  const stage=getHugeSample('voyage');let state=createSimulation(stage),reference=structuredClone(state);
  const {c,auto}=setup(state),clock=new FlightClock({now:()=>0});clock.setRate(rate);
  const recorder=createFlightRecorder(stage,state,{playType:'free',gameMode:'design',launchMode:'precision'});
  let frames=0;
  while(state.status==='flying'){
   clock.advance(1/60,dt=>{state=stepSimulation(state,dt);recorder.capture(state);return state.status==='flying';});
   const before=structuredClone(state);auto.update(c,state,1/60,rate);assert.deepEqual(state,before);onScreen(c,state.rocket.position,20);frames++;
  }
  while(reference.status==='flying')reference=stepSimulation(reference,1/120);assert.deepEqual(state,reference);
  const record=recorder.finish(state);metrics.push({rate,frames,cameraUpdates:auto.updates,status:state.status,time:state.elapsed,end:state.rocket.position,record});
 }
 assert.deepEqual(metrics[0].record.frames,metrics[1].record.frames);assert.equal(metrics[1].frames,metrics[1].cameraUpdates);assert.ok(metrics[1].cameraUpdates<30);
 writeFileSync(new URL('flight-results.json',dir),JSON.stringify(metrics.map(({record,...m})=>({...m,recordFrames:record.frames.length})),null,2));
});
