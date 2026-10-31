import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {FRONTIER_TARGETS,normalizeFrontier,observeFrontier,targetAvailable,targetLabel,legacyFrontier} from '../js/frontier.js';
import {createOpenVoyage,DESTINATIONS,normalizeVoyage} from '../js/open-voyage.js';
import {HomewardProgress,HOMEWARD_KEY} from '../js/homeward-progress.js';
import {HOMEWARD_SECTORS} from '../js/homeward-data.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {FlightClock} from '../js/flight-clock.js';
import {VOYAGE_COURSES} from '../js/voyage-courses.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed} from '../js/launch.js';
import {createFlightRecorder} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
const dir=new URL('../reports/unknown-frontier/',import.meta.url);mkdirSync(dir,{recursive:true});const metrics=[];
function memory(raw,fail=false){const values=new Map([[HOMEWARD_KEY,JSON.stringify(raw)],['classic','keep'],['favorite-sentinel','keep']]);return {values,getItem:k=>values.get(k),setItem:(k,v)=>{if(fail)throw Error('QuotaExceededError');values.set(k,v);}};}
function progress(storage){return new HomewardProgress(storage??memory({version:1,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),openingSeen:true,active:true,eventsSeen:[],oldExtra:{keep:true}}));}
function leg(p,target,{rate=1,waitForTwo=false}={}){
 const from=normalizeVoyage(p.state.voyage).checkpoint,course=VOYAGE_COURSES[from+'>'+target];assert.ok(course,from+'>'+target);
 const initialTarget=targetAvailable(p.state.frontier,target)?target:'gate';assert.ok(p.selectDestination(initialTarget,{requireDiscovered:true}));
 const stage=createOpenVoyage(p.state.voyage);let state=createSimulation(stage,{angleDeg:course[0],speed:course[1]}),steps=0,changedAt=null;const events=[],clock=new FlightClock({now:()=>0}),rec=createFlightRecorder(stage,state,{playType:'homeward',gameMode:'design',launchMode:'precision'},1);clock.setRate(rate);p.beginSurvey();
 while(state.status==='flying')clock.advance(1/60,dt=>{
  const before=state;state=stepSimulation(state,dt);events.push(...p.observeSurvey(before,state,()=>123456789));rec.capture(state);steps++;assert.ok(steps<21601);
  const enough=!waitForTwo||Object.values(p.state.frontier?.targets??{}).filter(e=>e.state!=='UNKNOWN').length>=2;
  if(state.status==='flying'&&state.goal.id!==target&&enough&&targetAvailable(p.state.frontier,target)){
   const position={...state.rocket.position},velocity={...state.rocket.velocity},elapsed=state.elapsed;assert.ok(p.selectDestination(target,{requireDiscovered:true}));state={...state,goal:{...DESTINATIONS.find(d=>d.id===target)}};changedAt=elapsed;assert.deepEqual(state.rocket.position,position);assert.deepEqual(state.rocket.velocity,velocity);assert.equal(state.elapsed,elapsed);
  }
  return state.status==='flying';
 });
 assert.equal(state.status,'cleared',from+'>'+target);assert.equal(state.target,target);assert.ok(p.dock(state));
 const record={...rec.finish(state),goal:{...state.goal},frontierEvents:events};
 // The exact same initial velocity and final selected goal through the original preview.
 const prediction=createPreview({...stage,goal:{...state.goal}},velocityFromAngleSpeed(...course));while(!prediction.done)advancePreview(prediction,2000);assert.deepEqual(prediction.state,state);
 return {state,events,record,changedAt,steps,from,target,course};
}
for(const [name,targets]of Object.entries({A:['gate'],B:['probe','gate'],C:['rescue','gate'],D:['planet','station','gate'],E:['probe','station','gate']}))test(`${name}: 実航行・検出後の目的地変更・予測/100倍一致・チェックポイント復元`,()=>{
 const p=progress(),q=progress(),legs=[];
 for(const target of targets){
  const result=leg(p,target,{waitForTwo:name==='E'}),high=leg(q,target,{rate:100,waitForTwo:name==='E'});assert.deepEqual(high.state,result.state);assert.deepEqual(high.events,result.events);assert.equal(high.steps,result.steps);assert.deepEqual(q.state.frontier,p.state.frontier);
  assert.deepEqual(new HomewardProgress(p.storage).state,p.state);const copy=JSON.stringify(result.record),view=new FlightReplay(result.record);view.setMode('cinematic');view.restart();for(let n=0;n<600&&view.time<result.record.duration;n++)view.advance(.1);assert.equal(view.time,result.record.duration);assert.equal(JSON.stringify(result.record),copy);
  legs.push({from:result.from,target,angle:result.course[0],speed:result.course[1],elapsed:result.state.elapsed,changedAt:result.changedAt,end:result.state.rocket.position,events:result.events.map(({id,state,source,elapsed})=>({id,state,source,elapsed}))});writeFileSync(new URL(`${name}-${result.from}-${target}.json`,dir),JSON.stringify(result.record));
 }
 assert.ok(p.state.cleared.includes('homeward-09'));if(name==='A')assert.equal(Object.values(p.state.frontier.targets).filter(t=>t.state==='INVESTIGATED').length,0);
 if(['B','E'].includes(name)){assert.equal(p.state.frontier.targets.D01.state,'INVESTIGATED');assert.ok(p.state.frontier.rewards.includes('probe-routes'));assert.notEqual(p.state.frontier.targets.D04.state,'UNKNOWN');}
 if(name==='C')assert.equal(p.state.frontier.targets.D02.state,'INVESTIGATED');if(name==='D'){assert.equal(p.state.frontier.targets.D03.state,'INVESTIGATED');assert.equal(p.state.frontier.targets.D04.state,'INVESTIGATED');}
 if(name==='E')assert.ok(legs[0].changedAt>0);assert.equal(p.storage.getItem('classic'),'keep');
 metrics.push({route:name,legs,totalTime:legs.reduce((n,l)=>n+l.elapsed,0),frontier:p.state.frontier,status:'PASS'});writeFileSync(new URL('route-results.json',dir),JSON.stringify(metrics,null,2));
});
test('D05は実際の追跡で調査し、未検出の探査機への手掛かりを開示する',()=>{
 const old={version:1,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),openingSeen:true,active:true,voyage:{checkpoint:'station',selected:'station',visited:['station'],elapsed:0}};
 const p=progress(memory(old));assert.equal(p.state.frontier.targets.D01.state,'UNKNOWN');const result=leg(p,'anomaly');assert.equal(p.state.frontier.targets.D05.state,'INVESTIGATED');assert.ok(p.state.frontier.rewards.includes('anomaly-clue'));assert.equal(p.state.frontier.targets.D01.state,'DETECTED');assert.ok(result.events.some(e=>e.id==='D01'&&e.source==='chart'));
 const tracked=structuredClone(p.state.frontier),probe=leg(p,'probe');assert.equal(p.state.frontier.targets.D01.state,'INVESTIGATED');const gate=leg(p,'gate');
 writeFileSync(new URL('tracking-results.json',dir),JSON.stringify({state:tracked,legs:[result,probe,gate].map(r=>({from:r.from,target:r.target,course:r.course,elapsed:r.state.elapsed,end:r.state.rocket.position,events:r.events}))},null,2));writeFileSync(new URL('D05-station-anomaly.json',dir),JSON.stringify(result.record));
});
test('高速の1固定ステップで範囲を横断してもUNKNOWN→DETECTED→INVESTIGATEDを取りこぼさない',()=>{
 const stage=createOpenVoyage();stage.launch.position={x:1000,y:3000};stage.planets=[];stage.encounters=[];
 const before=createSimulation(stage,{velocity:{x:120000,y:0}}),next=stepSimulation(before,1/120),saved=structuredClone(next),result=observeFrontier(null,before,next,()=>1);
 assert.ok(Math.abs(next.rocket.position.x-1500)>100);assert.equal(result.frontier.targets.D01.state,'INVESTIGATED');assert.deepEqual(result.events.filter(e=>e.id==='D01').map(e=>e.state),['DETECTED','INVESTIGATED']);assert.deepEqual(next,saved);
 const again=observeFrontier(result.frontier,before,next,()=>2);assert.equal(again.events.filter(e=>e.id==='D01').length,0);assert.equal(again.frontier.rewards.filter(r=>r==='probe-routes').length,1);
});
test('未発見名称を隠し目的地設定を制限、ゲート・実際の重力情報を維持する',()=>{
 const p=progress();assert.equal(p.selectDestination('rescue',{requireDiscovered:true}),false);assert.equal(p.selectDestination('gate',{requireDiscovered:true}),true);
 for(const t of FRONTIER_TARGETS){assert.equal(targetAvailable(p.state.frontier,t.destination),false);assert.ok(!targetLabel(p.state.frontier,t.destination).includes(t.name));}
 const stage=createOpenVoyage();assert.equal(stage.planets.length,3);assert.ok(stage.planets.find(p=>p.type==='repulsor'));assert.equal(stage.encounters.find(e=>e.type==='unknown').strength,45);
});
test('旧v1.3の寄港・選択・記録参照を保持し、未知の日時を捏造しない',()=>{
 const raw={version:1,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),openingSeen:true,active:true,journal:{'homeward-09':{importantFlightId:'kept'}},voyage:{checkpoint:'rescue',selected:'planet',visited:['rescue'],rewards:['route-charts'],records:{rescue:'keep-flight'},elapsed:6.1}};
 const storage=memory(raw),before=storage.getItem(HOMEWARD_KEY),p=progress(storage);assert.equal(storage.getItem(HOMEWARD_KEY),before);assert.equal(p.state.frontier.targets.D02.state,'INVESTIGATED');assert.equal(p.state.frontier.targets.D03.state,'DETECTED');assert.equal(p.state.frontier.targets.D02.firstDetectedAt,undefined);assert.equal(p.state.voyage.records.rescue,'keep-flight');assert.equal(p.state.frontier.targets.D02.investigatedFlightId,'keep-flight');assert.equal(p.state.journal['homeward-09'].importantFlightId,'kept');
 leg(p,'planet');assert.equal(p.state.frontier.targets.D03.state,'INVESTIGATED');assert.equal(p.state.frontier.targets.D03.firstDetectedAt,undefined);assert.equal(p.state.frontier.targets.D03.investigatedAt,123456789);
});
test('保存容量不足でも調査・報酬・寄港を継続し、元データを削除しない',()=>{
 const raw={version:1,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),openingSeen:true,active:true},storage=memory(raw,true),saved=storage.getItem(HOMEWARD_KEY),p=progress(storage);leg(p,'probe');assert.equal(p.state.frontier.targets.D01.state,'INVESTIGATED');assert.match(p.notice,/保存できません/);assert.equal(storage.getItem(HOMEWARD_KEY),saved);
});
test('遅延した重要記録参照が次の固定ステップや再訪で消えず、報酬が重複しない',()=>{
 const p=progress(),r=leg(p,'probe');p.attachDiscoveryRecord('D01','INVESTIGATED','protected');p.attachDiscoveryRecord('D01','INVESTIGATED','must-not-replace');p.observeSurvey(r.state,r.state,()=>2);assert.equal(p.state.frontier.targets.D01.investigatedFlightId,'protected');assert.equal(p.frontierRuntime.targets.D01.investigatedFlightId,'protected');assert.equal(p.state.frontier.rewards.filter(r=>r==='probe-routes').length,1);
});
test('v1.3代表4航路の物理結果は保存済み基準終点・時間と一致',()=>{
 for(const route of JSON.parse(readFileSync(new URL('../reports/open-voyage/route-results.json',import.meta.url),'utf8'))){let voyage={};for(const l of route.legs){const stage=createOpenVoyage({...voyage,checkpoint:l.from,selected:l.target});let state=createSimulation(stage,{angleDeg:l.angleDeg,speed:l.speed});while(state.status==='flying')state=stepSimulation(state,1/120);assert.equal(state.status,'cleared');assert.equal(state.elapsed,l.time);assert.deepEqual(state.rocket.position,l.end);voyage={elapsed:(voyage.elapsed??0)+state.elapsed,planets:state.planets};}}
});
