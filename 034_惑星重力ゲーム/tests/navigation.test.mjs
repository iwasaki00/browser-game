import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {FlightClock,FLIGHT_RATES} from '../js/flight-clock.js';
import {Starfield} from '../js/starfield.js';
import {Camera} from '../js/camera.js';
import {getStage} from '../js/stages.js';
import {getChallenge} from '../js/challenges.js';
import {getHomewardSector} from '../js/homeward-data.js';
import {getHugeSample} from '../js/worlds.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {createFlightRecorder} from '../js/flight-record.js';
const dir=new URL('../reports/navigation-ux/',import.meta.url);mkdirSync(dir,{recursive:true});
const metrics=[];
const cases=[getStage(),getChallenge('stage-01'),getChallenge('stage-10'),getChallenge('stage-20'),...['01','02','03'].map(n=>getHomewardSector(`homeward-${n}`)),getHugeSample('voyage')];
for(const stage of cases)test(`${stage.id}: 6倍率で全ステップ・終了状態・時刻・座標が完全一致`,()=>{
 const launch=stage.solution??stage.launch;
 let reference=createSimulation(stage,launch),referenceSteps=0;
 while(reference.status==='flying'){reference=stepSimulation(reference,1/120);referenceSteps++;}
 for(const rate of FLIGHT_RATES){
  const clock=new FlightClock({now:()=>0});clock.setRate(rate);
  let state=createSimulation(stage,launch),steps=0,frames=0;
  while(state.status==='flying'&&frames++<30000)clock.advance(1/60,dt=>{assert.equal(dt,1/120);steps++;state=stepLiveFlight(state,{},stage,'design',dt);return state.status==='flying';});
  assert.equal(steps,referenceSteps);assert.deepEqual(state,reference);
 }
 metrics.push({id:stage.id,status:reference.status,time:reference.elapsed,steps:referenceSteps,end:reference.rocket.position,rates:FLIGHT_RATES});
 writeFileSync(new URL('flight-results.json',dir),JSON.stringify(metrics,null,2));
});
test('処理予算・ステップ上限、未処理時間保存、倍率変更・リセット',()=>{
 let now=0,count=0;const c=new FlightClock({now:()=>now,budgetMs:4});c.setRate(100);
 c.advance(.1,()=>{now+=1;count++;});assert.equal(count,4);assert.ok(c.lastCost<=4);
 assert.ok(Math.abs(c.pending+count*c.dt-10)<1e-10);
 c.setRate(1);c.advance(1/60,()=>{now+=1;count++;});assert.equal(c.lastSteps,2);
 assert.ok(Math.abs(c.pending+count*c.dt-(10+1/60))<1e-10);
 c.setRate(999);assert.equal(c.rate,1);c.reset();assert.equal(c.pending,0);assert.equal(c.rate,1);
 const capped=new FlightClock({now:()=>0});capped.setRate(100);capped.advance(10,()=>{});assert.equal(capped.lastSteps,240);assert.ok(capped.pending>990);
});
test('倍率切替中もライブ移動・特殊領域の衝突・予測・記録が一致',()=>{
 const s=getHomewardSector('homeward-03');
 // Initial flight crashes; the solution clears, covering both terminal paths.
 for(const launch of [s.launch,s.solution]){
  let state=createSimulation(s,launch),baseline=structuredClone(state),count=0;
  const preview=createPreview(s,state.rocket.velocity);while(!preview.done)advancePreview(preview,2000);
  const clock=new FlightClock({now:()=>0}),rec=createFlightRecorder(s,state,{playType:'homeward',gameMode:'design',launchMode:'precision'});
  while(state.status==='flying'){clock.setRate(FLIGHT_RATES[count++%6]);clock.advance(1/60,dt=>{state=stepLiveFlight(state,{},s,'live',dt);rec.capture(state);return state.status==='flying';});}
  while(baseline.status==='flying')baseline=stepSimulation(baseline,1/120);
  assert.deepEqual(state,baseline);assert.deepEqual(preview.state,baseline);
  const record=rec.finish(state);assert.equal(record.duration,state.elapsed);assert.equal(record.frames.at(-1)[0],state.elapsed);assert.equal(record.frames.at(-1)[1],state.rocket.position.x);
 }
 const targets={'homeward-planet-1':{x:1100,y:3250}};
 let a=createSimulation(s,s.solution),b=structuredClone(a);
 const c=new FlightClock({now:()=>0});c.setRate(100);
 while(a.status==='flying')a=stepLiveFlight(a,targets,s,'live');
 while(b.status==='flying')c.advance(1/60,dt=>{b=stepLiveFlight(b,targets,s,'live',dt);return b.status==='flying';});
 assert.deepEqual(a,b);
});
test('星の座標・色がカメラ往復/再生成で安定、HUGE表示の密度・キャッシュ上限',()=>{
 const f=new Starfield(),world={width:3750,height:5000},a={x:0,y:0},b={x:3750,y:5000};
 const first=structuredClone(f.tile(0,0));for(let i=1;i<150;i++)f.tile(i,0);
 assert.equal(f.cache.size,128);assert.deepEqual(f.tile(0,0),first);assert.deepEqual(new Starfield().tile(0,0),first);
 const list=f.visible(a,b,world,.1),generated=f.generated;assert.ok(list.length>100&&list.length<1000);
 assert.deepEqual(f.visible(a,b,world,.1),list);assert.equal(f.generated,generated);
 const zoom=f.visible({x:600,y:600},{x:1100,y:1100},world,1);
 for(const s of list.filter(s=>s.x>=600&&s.x<=1100&&s.y>=600&&s.y<=1100))assert.ok(zoom.some(z=>z.x===s.x&&z.y===s.y&&z.color===s.color));
 const start=performance.now();for(let i=0;i<100;i++)f.visible(a,b,world,.1);const ms=(performance.now()-start)/100;
 writeFileSync(new URL('starfield-performance.json',dir),JSON.stringify({stars:list.length,cache:f.cache.size,generated:f.generated,meanQueryMs:ms,environment:'Node / PC, not iPhone'},null,2));
});
test('1指パンの逆変換、FOLLOW解除・復帰、境界とピンチ遷移',()=>{
 for(const zoom of [.1,1,3]){
  const c=new Camera(),s=getHomewardSector('homeward-01');c.resize(363,514);c.fit(s);c.zoomAt(zoom);c.setMode('follow',s);
  const before={...c.center};c.beginPan({x:200,y:200});c.movePan({x:220,y:210});assert.equal(c.mode,'fixed');
  assert.ok(Math.abs(c.center.x-(before.x-20/c.scale))<1e-9);
  c.movePan({x:1e6,y:-1e6});assert.equal(c.center.x,c.bounds.left);assert.equal(c.center.y,c.bounds.bottom);
  c.endPan();const center={...c.center};c.movePan({x:0,y:0});assert.deepEqual(c.center,center);
  c.setMode('follow',s);c.follow({x:1000,y:2000});assert.deepEqual(c.center,{x:1000,y:2000});
  c.beginGesture([{x:100,y:200},{x:200,y:200}]);c.moveGesture([{x:90,y:220},{x:210,y:220}]);assert.ok(c.zoom>=.1&&c.zoom<=3);
 }
});
