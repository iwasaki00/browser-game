import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {HOMEWARD_SECTORS,getHomewardSector} from '../js/homeward-data.js';
import {HomewardProgress,HOMEWARD_KEY,homewardDistance,sectorUnlocked} from '../js/homeward-progress.js';
import {newMission,observeMission,missionSatisfied} from '../js/homeward-mission.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {FlightClock} from '../js/flight-clock.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';
import {launchAllowed} from '../js/special-challenges.js';
import {createFlightRecorder,replayFrame} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
import {Camera} from '../js/camera.js';
import {CinematicCamera} from '../js/cinematic-camera.js';
import {encounterPosition} from '../js/encounters.js';
import {TUTORIAL_STEPS,tutorialEntry,tutorialTransition} from '../js/homeward-tutorial.js';
const dir=new URL('../reports/lost-sectors/',import.meta.url);mkdirSync(dir,{recursive:true});
const metrics=[];
function run(stage,launch=stage.solution,{rate=1,mode='design'}={}){
 let state=createSimulation(stage,launch),evidence=newMission(),steps=0;const rec=createFlightRecorder(stage,state,{playType:'homeward',gameMode:mode,launchMode:'precision'});
 const clock=new FlightClock({now:()=>0});clock.setRate(rate);
 while(state.status==='flying')clock.advance(1/60,dt=>{const previous=state;state=stepLiveFlight(state,{},stage,mode,dt);evidence=observeMission(evidence,previous,state);rec.capture(state);steps++;assert.ok(steps<23000);return state.status==='flying';});
 return {state,evidence,steps,record:rec.finish(state)};
}
for(const definition of HOMEWARD_SECTORS.slice(3,8))test(`${definition.id}: 初期失敗→操作調整→成功・予測一致・両方式/両モード・100倍・記録再生`,()=>{
 const s=getHomewardSector(definition.id),before=structuredClone(s),choice=definition.choices?'pursue':undefined;
 for(const field of ['enter','departure','encounterLog','discovery','arrival','hint'])assert.ok(definition[field]);
 assert.equal(definition.next,HOMEWARD_SECTORS[Number(definition.number)]?.id??null);
 assert.ok(s.encounters.every(e=>e.fixed));assert.equal(s.rules.maxPlanets,0);
 const initial=run(s,s.launch);assert.notEqual(initial.state.status,'cleared');
 const success=run(s);assert.equal(success.state.status,'cleared');assert.equal(missionSatisfied(s,success.evidence,choice),true);
 assert.equal(success.steps,Math.round(success.state.elapsed*120));
 const job=createPreview(s,velocityFromAngleSpeed(s.solution.angleDeg,s.solution.speed));while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,success.state);
 const high=run(s,s.solution,{rate:100}),live=run(s,s.solution,{mode:'live'});assert.deepEqual(high.state,success.state);assert.deepEqual(high.evidence,success.evidence);assert.deepEqual(live.state,success.state);
 const angle=s.solution.angleDeg*Math.PI/180,pull=14+(s.solution.speed-120)/100*91;
 const sling=slingshotLaunch(s.launch.position,{x:120-Math.cos(angle)*pull,y:1100-Math.sin(angle)*pull});assert.ok(launchAllowed(s,sling.velocity,'slingshot'));
 const shot=run(s,{velocity:sling.velocity});assert.equal(shot.state.status,'cleared');assert.ok(Math.hypot(shot.state.rocket.position.x-success.state.rocket.position.x,shot.state.rocket.position.y-success.state.rocket.position.y)<1e-7);
 const record=success.record,unchanged=JSON.stringify(record),view=new FlightReplay(record);view.resize(320,400);view.setMode('cinematic');view.restart();for(let i=0;i<180;i++)view.advance(.1);assert.equal(view.time,record.duration);assert.deepEqual(replayFrame(record,record.duration).rocket,success.state.rocket.position);assert.equal(JSON.stringify(record),unchanged);assert.deepEqual(s,before);
 metrics.push({sector:s.id,name:definition.name,initial:{...definition.initial,status:initial.state.status,reason:initial.state.reason??initial.state.status,time:initial.state.elapsed},solution:{...s.solution,status:success.state.status,time:success.state.elapsed,end:success.state.rocket.position},evidence:success.evidence,steps:success.steps,preview:'exact terminal state',rate100:'exact state and evidence',live:'exact state',slingshot:'clear (<1e-7 world-unit difference)',cinematic:'record unchanged'});
 writeFileSync(new URL('sector-results.json',dir),JSON.stringify(metrics,null,2));writeFileSync(new URL(`${s.id}-flight.json`,dir),JSON.stringify(record));
});
test('彗星なしでは全許可推力で時間内に届かず、異常重力なしでは許可角度で出口に届かない',()=>{
 const comet=getHomewardSector('homeward-05');comet.encounters=[];assert.ok(220*comet.flightLimits.maxFlightTime<comet.goal.x-comet.goal.radius-comet.launch.position.x);
 assert.notEqual(run(comet,{angleDeg:0,speed:220}).state.status,'cleared');
 const unknown=getHomewardSector('homeward-08');unknown.encounters=[];const dx=unknown.goal.x-unknown.launch.position.x;
 assert.ok(dx*Math.tan(Math.PI/180)+unknown.goal.radius<unknown.goal.y-unknown.launch.position.y);
 for(const angleDeg of [-1,0,1])for(const speed of [120,170,200,220])assert.notEqual(run(unknown,{angleDeg,speed}).state.status,'cleared');
 assert.equal(missionSatisfied(getHomewardSector('homeward-05'),newMission()),false);assert.equal(missionSatisfied(getHomewardSector('homeward-08'),newMission()),false);
});
test('ステーション未受信は物理ゴールに到達しても解放されず、UFO選択なしも不可',()=>{
 const stage=getHomewardSector('homeward-06');stage.encounters=[];const bypass=run(stage);assert.equal(bypass.state.status,'cleared');assert.equal(missionSatisfied(stage,bypass.evidence),false);
 const p=ready();for(const id of ['homeward-04','homeward-05']){p.enter(id);p.clear(id,run(getHomewardSector(id)).evidence);}p.enter('homeward-06');assert.equal(p.clear('homeward-06',bypass.evidence),false);assert.equal(sectorUnlocked(p.state,'homeward-07'),false);
 assert.equal(missionSatisfied(getHomewardSector('homeward-07'),{ufo:true}),false);
});
function memory(initial=[]){const map=new Map(initial);return {map,getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function ready(storage=memory()){
 const p=new HomewardProgress(storage);p.start();for(const id of ['homeward-01','homeward-02','homeward-03']){p.enter(id);assert.ok(p.clear(id));}return p;
}
test('追跡・回避の別解、距離増加、日誌、順次解放、保存復元、旧進行・他キー保護',()=>{
 for(const choice of ['pursue','avoid']){
  const original={version:1,currentSector:'homeward-03',cleared:['homeward-01','homeward-02','homeward-03'],openingSeen:true,active:true,eventsSeen:['homeward-01:enter'],tutorial:{'homeward-03':{status:'completed',step:5}},futureExtension:{keep:true}};
  const storage=memory([[HOMEWARD_KEY,JSON.stringify(original)],['classic','stars'],['audio','on']]),raw=storage.getItem(HOMEWARD_KEY),p=new HomewardProgress(storage);assert.equal(storage.getItem(HOMEWARD_KEY),raw);assert.deepEqual(p.state.cleared,original.cleared);assert.deepEqual(homewardDistance(p.state),{travelled:5400,remaining:58600,percent:8.4375});assert.equal(sectorUnlocked(p.state,'homeward-04'),true);
  for(const def of HOMEWARD_SECTORS.slice(3,8)){
   assert.ok(p.enter(def.id));assert.equal(p.enter(HOMEWARD_SECTORS[Number(def.number)]?.id??'bad'),false);
   const s=getHomewardSector(def.id);let answer=s.solution;
   if(def.choices){const before=homewardDistance(p.state).remaining;assert.ok(p.choose(def.id,choice));assert.equal(homewardDistance(p.state).remaining-before,choice==='pursue'?600:0);p.choose(def.id,choice);assert.equal(homewardDistance(p.state).remaining-before,choice==='pursue'?600:0);answer=def.choices.find(c=>c.id===choice).answer??answer;}
   const result=run(s,answer);assert.equal(result.state.status,'cleared');assert.ok(missionSatisfied(s,result.evidence,def.choices?choice:undefined));assert.ok(p.clear(def.id,result.evidence));
   p.recordFlight(def.id,result.state,result.evidence,choice,'record-'+def.number);assert.ok(p.state.journal[def.id].discovery);assert.equal(p.state.journal[def.id].clearFlightId,'record-'+def.number);
   assert.deepEqual(new HomewardProgress(storage).state,p.state);
  }
  assert.equal(p.state.cleared.length,8);assert.equal(p.state.choices['homeward-07'],choice);assert.equal(storage.getItem('classic'),'stars');assert.equal(storage.getItem('audio'),'on');assert.deepEqual(p.state.futureExtension,{keep:true});
 }
});
test('新ガイドの段階進行・スキップ・復元とRESET時の初期配置',()=>{
 for(const def of HOMEWARD_SECTORS.slice(3,8)){
  const s=getHomewardSector(def.id),steps=TUTORIAL_STEPS[def.id],entry=tutorialEntry({cleared:[],tutorial:{}},def.id);
  const input=steps[0].id,next=tutorialTransition(entry,def.id,input,{angleDeg:def.initial.angleDeg+1,speed:220},def.initial);assert.equal(next.step,1);
  const launch=tutorialTransition(next,def.id,'next');assert.equal(launch.step,2);assert.equal(tutorialTransition(launch,def.id,'launch').step,3);assert.equal(tutorialTransition(entry,def.id,'skip').status,'skipped');
  assert.equal(tutorialTransition(tutorialTransition(launch,def.id,'launch'),def.id,'restore').step,2);s.encounters[0].x=-999;assert.notEqual(getHomewardSector(def.id).encounters[0].x,-999);
 }
});
test('HOMEWARD01〜03の保存済み基準終点・到達時間を維持、旧記録のCINEMATICも不変',()=>{
 for(const def of HOMEWARD_SECTORS.slice(0,3)){
  const old=JSON.parse(readFileSync(new URL(`../reports/first-voyage/${def.id}-flight.json`,import.meta.url),'utf8')),last=old.frames.at(-1),s=getHomewardSector(def.id),end=run(s).state;
  assert.equal(end.elapsed,old.duration);assert.deepEqual(end.rocket.position,{x:last[1],y:last[2]});const before=JSON.stringify(old),replay=new FlightReplay(old);replay.setMode('cinematic');replay.restart();replay.advance(1);assert.equal(JSON.stringify(old),before);
 }
});
test('各新セクターに複数の成功条件があり、一点だけの正解に限定しない',()=>{
 for(const [number,answers]of [['04',[[0,120],[0,219]]],['05',[[0,170],[0,220]]],['06',[[-12,170],[-14,170]]],['07',[[-3,200],[3,170]]],['08',[[0,190],[0,210]]]]){
  const stage=getHomewardSector('homeward-'+number);for(const [angleDeg,speed]of answers){const result=run(stage,{angleDeg,speed});assert.equal(result.state.status,'cleared',`${number}/${angleDeg}/${speed}`);assert.ok(missionSatisfied(stage,result.evidence,'avoid'));}
 }
});
test('隕石・UFOを取り除いた場合だけ初期航路が通り、移動障害物が攻略に意味を持つ',()=>{
 for(const number of ['04','07']){const stage=getHomewardSector('homeward-'+number);assert.equal(run(stage,stage.launch).state.status,'crashed');stage.encounters=[];assert.equal(run(stage,stage.launch).state.status,'cleared');}
});
test('遅れて完了したIndexedDB保存が、直近の別航行の日誌を上書きしない',()=>{
 const p=ready();p.enter('homeward-04');const result=run(getHomewardSector('homeward-04'));
 p.recordFlight('homeward-04',result.state,result.evidence,null,null,'older');p.recordFlight('homeward-04',{...result.state,status:'crashed',elapsed:1},newMission(),null,null,'newer');
 p.attachFlight('homeward-04','newer',false);p.attachFlight('homeward-04','older',true);
 assert.equal(p.state.journal['homeward-04'].flightId,'newer');assert.equal(p.state.journal['homeward-04'].elapsed,1);assert.equal(p.state.journal['homeward-04'].clearFlightId,'older');
});
test('遭遇対象を実飛行と同じ時刻の位置でCINEMATICに収め、状態を変更しない',()=>{
 const stage=getHomewardSector('homeward-04'),state=createSimulation(stage);state.elapsed=2;state.rocket.position={x:500,y:1100};
 const before=structuredClone(state),camera=new Camera(),auto=new CinematicCamera();camera.resize(320,417);camera.fit(stage);camera.setMode('cinematic');
 for(let i=0;i<120;i++)auto.update(camera,state,1/60);
 assert.equal(auto.planetId,stage.encounters[0].id);
 for(const point of [state.rocket.position,encounterPosition(stage.encounters[0],state.elapsed)]){const screen=camera.toScreen(point);assert.ok(screen.x>=0&&screen.x<=320&&screen.y>=0&&screen.y<=417);}
 assert.deepEqual(state,before);
});
