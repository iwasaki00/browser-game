import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createEncounter,addEncounter,encounterPosition,encounterBodies,encounterPlacementAllowed,encounterGravity,tailExposure} from '../js/encounters.js';
import {getEncounterSample} from '../js/encounter-samples.js';
import {createSimulation,stepSimulation,simulateTrajectory} from '../js/physics.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {createFlightRecorder,replayFrame} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
import {FlightClock} from '../js/flight-clock.js';
import {failureKind} from '../js/space-experience.js';
import {CHALLENGES,getChallenge} from '../js/challenges.js';
import {getHomewardSector} from '../js/homeward-data.js';
import {getStage} from '../js/stages.js';
const dir=new URL('../reports/space-encounters/',import.meta.url);mkdirSync(dir,{recursive:true});const metrics=[];
const types=['meteor','comet','unknown','ufo','station'];
const setup=type=>{const s=getEncounterSample(type);s.launch.position={x:100,y:900};s.goal={id:'goal',x:1000,y:900,radius:10};s.encounters=[createEncounter(type,'object',500,900,{speed:0,count:1})];return s;};
test('5種類の追加・数量/速度/強度制限、配置・上限・固定物体',()=>{
 const s=getEncounterSample('station');s.encounters=[];
 for(const type of types){const e=addEncounter(s,type,{count:99,speed:999,strength:999});assert.equal(e.type,type);assert.ok(e.speed<=160&&e.count<=12&&e.strength<=120);assert.ok(encounterPlacementAllowed(e,s));const p={...e,x:e.x+10};if(encounterPlacementAllowed(p,s))Object.assign(e,p);}
 assert.ok(addEncounter(s,'meteor'));assert.equal(addEncounter(s,'ufo'),null);
 const fixed=s.encounters[0];fixed.fixed=true;assert.equal(encounterPlacementAllowed({...fixed,x:fixed.x+50},s),false);
 assert.equal(encounterPlacementAllowed({...fixed,x:-20},s),false);assert.equal(encounterPlacementAllowed({...s.encounters[1],x:s.launch.position.x,y:s.launch.position.y},s),false);
 assert.equal(addEncounter({...s,encounters:[]},'invalid'),null);
});
test('移動は時刻の純粋関数。隕石は一定方向、UFO航路は周期境界でも連続',()=>{
 const e=createEncounter('meteor','m',100,200,{speed:40,count:12});assert.deepEqual(encounterPosition(e,10),{x:500,y:200});assert.equal(encounterBodies(e,10).length,12);
 assert.deepEqual(encounterBodies(e,10),encounterBodies(structuredClone(e),10));
 const u=createEncounter('ufo','u',500,500,{speed:40}),period=220/40;
 assert.deepEqual(encounterPosition(u,0),encounterPosition(u,period));const a=encounterPosition(u,period-1e-8),b=encounterPosition(u,period+1e-8);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5);
});
for(const type of ['meteor','ufo'])test(`${type}: 高速通過の相対連続衝突とゴール優先順位`,()=>{
 const s=setup(type);if(type==='ufo'){s.encounters[0].route=[{x:0,y:0},{x:0,y:100},{x:100,y:100},{x:100,y:0}];s.encounters[0].speed=160;}
 const result=stepSimulation(createSimulation(s,{velocity:{x:120000,y:0}}),1/120);
 assert.equal(result.status,'crashed');assert.equal(result.reason,`encounter-${type}`);assert.ok(result.rocket.position.x<520);assert.equal(failureKind(result),'collision');
 s.goal.x=300;assert.equal(stepSimulation(createSimulation(s,{velocity:{x:120000,y:0}}),1/120).status,'cleared');
});
test('彗星の加速・減速、尾の高速横断でも効果を落とさない',()=>{
 for(const mode of ['boost','brake']){
  const s=setup('comet');s.encounters[0].y=921;s.encounters[0].tailMode=mode;s.launch.position.x=400;
  const r=stepSimulation(createSimulation(s),1/120);assert.equal(r.status,'flying');assert.ok(mode==='boost'?r.rocket.velocity.x>170:r.rocket.velocity.x<170);
 }
 const s=setup('comet');s.encounters[0].y=921;
 assert.ok(tailExposure(s.encounters[0],{x:100,y:900},{x:1100,y:900},0,1/120)>0);
 const r=stepSimulation(createSimulation(s,{velocity:{x:120000,y:0}}),1/120);assert.ok(r.rocket.velocity.x>120000);
});
test('未知物体の重力異常は局所的・強度依存。惑星重力とは合算',()=>{
 const e=createEncounter('unknown','x',500,900,{strength:60}),p={x:400,y:900};
 const a=encounterGravity(p,[e],0),b=encounterGravity(p,[{...e,strength:120}],0);assert.ok(a.x>0);assert.equal(b.x,a.x*2);assert.deepEqual(encounterGravity({x:0,y:0},[e],0),{x:0,y:0});
 const s=setup('unknown');s.launch.position=p;let state=createSimulation(s),next=stepSimulation(state,1/120);assert.ok(next.rocket.velocity.x>state.rocket.velocity.x);assert.equal(next.encounterEvents[0].type,'unknown');
 s.planets=[{id:'p',x:400,y:1100,radius:20,mass:1000}];next=stepSimulation(createSimulation(s),1/120);assert.ok(next.rocket.velocity.y>0);
});
test('ステーション発見は透過・一度だけ。高速通過も記録',()=>{
 const s=setup('station');let r=stepSimulation(createSimulation(s,{velocity:{x:120000,y:0}}),1/120);assert.equal(r.status,'cleared');assert.equal(r.encounterEvents.length,1);assert.equal(r.encounterEvents[0].type,'station');
 r=createSimulation(s);while(r.status==='flying')r=stepSimulation(r,1/120);assert.equal(r.encounterEvents.length,1);
});
for(const type of types)test(`${type}: サンプル到達、予測一致、1〜100倍、ギャラリーv1拡張`,()=>{
 const s=getEncounterSample(type),original=JSON.stringify(s),states=[];let r=createSimulation(s),rec=createFlightRecorder(s,r,{playType:'free',gameMode:'design',launchMode:'precision'},1);
 while(r.status==='flying'){r=stepSimulation(r,1/120);states.push(r);rec.capture(r);}assert.equal(r.status,'cleared');
 const preview=createPreview(s,createSimulation(s).rocket.velocity);while(!preview.done)advancePreview(preview,2000);assert.deepEqual(preview.state,r);
 for(const point of preview.points.slice(1)){const state=states[Math.round(point.time*120)-1];assert.deepEqual({x:point.x,y:point.y},state.rocket.position);}
 for(const rate of [1,2,5,10,50,100]){const clock=new FlightClock({now:()=>0});clock.setRate(rate);let live=createSimulation(s);while(live.status==='flying')clock.advance(1/60,dt=>{live=stepLiveFlight(live,{},s,'live',dt);return live.status==='flying';});assert.deepEqual(live,r);}
 const record=rec.finish(r),before=JSON.stringify(record);assert.equal(record.version,1);assert.equal(record.encounterVersion,1);
 for(const row of record.frames){const f=replayFrame(record,row[0]);assert.deepEqual(f.encounterStates[0].bodies,encounterBodies(s.encounters[0],row[0]));}
 const viewer=new FlightReplay(record);for(const mode of ['normal','follow','cinematic','overview']){viewer.setMode(mode);viewer.restart();while(viewer.playing)viewer.advance(.25);assert.equal(viewer.time,record.duration);}
 assert.equal(JSON.stringify(record),before);assert.equal(JSON.stringify(s),original);
 metrics.push({sample:s.name,status:r.status,time:r.elapsed,end:r.rocket.position,velocity:r.rocket.velocity,events:r.encounterEvents,frames:record.frames.length});writeFileSync(new URL('sample-results.json',dir),JSON.stringify(metrics,null,2));writeFileSync(new URL(`${type}-flight.json`,dir),JSON.stringify(record));
});
test('ギミックなしは旧エンジンと完全一致：Stage01〜20、HOMEWARD01〜03、FREE',async()=>{
 const source=execFileSync('git',['show','8ba5aa8:034_惑星重力ゲーム/js/physics.js'],{encoding:'utf8'});
 const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const s of [...CHALLENGES.map(s=>getChallenge(s.id)),...['01','02','03'].map(n=>getHomewardSector(`homeward-${n}`)),getStage()]){
  const launch=s.solution??{};let a=baseline.createSimulation(s,launch),b=createSimulation(s,launch);
  while(a.status==='flying'){a=baseline.stepSimulation(a,1/120);b=stepSimulation(b,1/120);}assert.deepEqual(b,a,s.id);
 }
});
test('ギミック併用時も移動惑星の連続衝突を維持',()=>{
 const s=setup('station');s.planets=[{id:'moving',x:700,y:875,radius:16,mass:0}];
 const state=createSimulation(s,{velocity:{x:0,y:0}});state.rocket.position={x:700,y:900};
 const r=stepLiveFlight(state,{moving:{x:700,y:925}},s,'live',1/120,6000);assert.equal(r.status,'crashed');assert.equal(r.target,'moving');
});
test('惑星操作と未知物体の併用でも1倍/100倍で終端一致',()=>{
 const s=getEncounterSample('unknown');s.planets=[{id:'moving',x:650,y:700,radius:22,mass:1800}];const results=[];
 for(const rate of [1,100]){const clock=new FlightClock({now:()=>0});clock.setRate(rate);let state=createSimulation(s);while(state.status==='flying')clock.advance(1/60,dt=>{state=stepLiveFlight(state,{moving:{x:730,y:740}},s,'live',dt);return state.status==='flying';});results.push(state);}
 assert.deepEqual(results[0],results[1]);
});
