import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {TEMPORAL_SITE,TRANSMISSION_OFFSET_HOURS,resolveImpossible,temporalUnlocked} from '../js/impossible-signal.js';
import {HomewardProgress,HOMEWARD_KEY} from '../js/homeward-progress.js';
import {targetAvailable,targetLabel} from '../js/frontier.js';
import {createOpenVoyage} from '../js/open-voyage.js';
import {getHomewardSector} from '../js/homeward-data.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed} from '../js/launch.js';
import {FlightClock} from '../js/flight-clock.js';
import {createFlightRecorder} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
const dir=new URL('../reports/impossible-signal/',import.meta.url);mkdirSync(dir,{recursive:true});const metrics=[];
const oldSave=()=>JSON.parse(readFileSync(new URL('../reports/echoes-of-the-unknown/save-example.json',import.meta.url),'utf8'));
function memory(raw,fail=false){const values=new Map([[HOMEWARD_KEY,JSON.stringify(raw)],['classic','KEEP'],['favorite','KEEP']]);return {getItem:k=>values.get(k),setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}};}
function progress(from='echo-signal',fail=false){const raw=oldSave();raw.voyage={...raw.voyage,checkpoint:from,selected:'gate',elapsed:0};delete raw.voyage.launchPosition;return new HomewardProgress(memory(raw,fail));}
function analyze(p){assert.ok(p.analyzeSignal('identity',0,()=>1).length);assert.ok(p.analyzeSignal('timestamp',0,()=>2).length);}
function leg(p,target,angle,choice,rate=1){
 assert.ok(p.selectDestination(target,{requireDiscovered:true}));assert.equal(p.chooseImpossible(choice,()=>3),target);
 const stage=createOpenVoyage(p.state.voyage);let state=createSimulation(stage,{angleDeg:angle,speed:220}),steps=0;const events=[],clock=new FlightClock({now:()=>0}),rec=createFlightRecorder(stage,state,{playType:'homeward',gameMode:'design',launchMode:'precision'},1);clock.setRate(rate);p.beginSurvey();
 while(state.status==='flying')clock.advance(1/60,dt=>{const before=state;state=stepSimulation(state,dt);p.observeSurvey(before,state,()=>123456789);events.push(...p.lastStoryEvents);rec.capture(state);assert.ok(++steps<21601);return state.status==='flying';});
 assert.equal(state.status,'cleared');p.endImpossibleFlight(state);assert.ok(p.dock(state));const job=createPreview(stage,velocityFromAngleSpeed(angle,220));while(!job.done)advancePreview(job,2000);assert.deepEqual(job.state,state);
 const record={...rec.finish(state),storyEvents:events,impossibleDisplay:{visibleFrom:0},impossibleChoices:structuredClone(p.state.echoes.impossible.choices)};
 const copy=JSON.stringify(record),replay=new FlightReplay(record);replay.setMode('cinematic');replay.restart();for(let i=0;i<4000&&replay.time<record.duration;i++)replay.advance(.1);assert.equal(replay.time,record.duration);assert.equal(JSON.stringify(record),copy);
 return {state,steps,events,record};
}
test('CLUE-05が前提。段階解析・固定72時間・情報の組合せ・重複防止',()=>{
 assert.equal(TRANSMISSION_OFFSET_HOURS,72);assert.equal(resolveImpossible(null,{analysis:'identity'}).story.clues['CLUE-06'],undefined);
 const p=progress();assert.equal(temporalUnlocked(p.state.echoes),false);assert.equal(p.selectDestination(TEMPORAL_SITE.id),false);assert.deepEqual(p.analyzeSignal('timestamp'),[]);analyze(p);
 for(const id of ['CLUE-06','CLUE-07','CLUE-08']){assert.ok(p.state.echoes.clues[id]);assert.ok(p.state.echoes.clues[id].related.length);}
 assert.deepEqual(p.analyzeSignal('identity'),[]);assert.deepEqual(p.analyzeSignal('timestamp'),[]);assert.equal(p.state.echoes.clues['CLUE-09'],undefined);
 assert.equal(targetLabel(null,TEMPORAL_SITE.id,p.state.echoes),'UNKNOWN ANOMALY');assert.ok(targetAvailable(null,TEMPORAL_SITE.id,p.state.echoes));
 const raw={...p.state.echoes,impossible:{analysis:{timestamp:true,identity:true},choices:[]}};delete raw.clues['CLUE-08'];const restored=resolveImpossible(raw,{restoring:true}).story;assert.ok(restored.clues['CLUE-08']);assert.equal(restored.clues['CLUE-08'].at,null);assert.equal(resolveImpossible(restored).events.length,0);
 const received=resolveImpossible({...restored,clues:{...restored.clues,'CLUE-09':{id:'CLUE-09',at:123}},impossible:{}},{restoring:true}).story;assert.equal(received.impossible.investigated,true);assert.equal(received.impossible.approached,true);assert.equal(received.clues['CLUE-09'].at,123);
});
test('三判断は可逆。OBSERVEは現在の目的地を変えず、位置・速度・条件を補正しない',()=>{
 const p=progress();analyze(p);assert.equal(p.chooseImpossible('avoid',()=>1),'gate');assert.equal(p.chooseImpossible('observe',()=>2),'gate');assert.equal(p.chooseImpossible('investigate',()=>3),TEMPORAL_SITE.id);assert.equal(p.chooseImpossible('investigate',()=>4),TEMPORAL_SITE.id);assert.equal(p.chooseImpossible('avoid',()=>5),'gate');assert.equal(p.state.echoes.impossible.choices.length,4);assert.equal(p.state.echoes.impossible.choices[0].result,'superseded');assert.equal(p.state.echoes.clues['CLUE-09'],undefined);assert.deepEqual(new HomewardProgress(p.storage).state,p.state);
});
for(const [name,from,course,choice]of [['signal-investigate','echo-signal',-129,'investigate'],['station-investigate','station',-159,'investigate'],['station-observe','station',-159,'observe'],['direct-avoid','echo-signal',-105,'avoid']])test(`${name}: 実航行・予測・1/100倍・日誌/再生・復元`,()=>{
 const p=progress(from),q=progress(from);analyze(p);analyze(q);const target=choice==='avoid'?'gate':TEMPORAL_SITE.id,r=leg(p,target,course,choice),high=leg(q,target,course,choice,100);assert.deepEqual(high.state,r.state);assert.deepEqual(high.events,r.events);assert.equal(high.steps,r.steps);assert.deepEqual(q.state.echoes.impossible,p.state.echoes.impossible);
 assert.equal(p.state.echoes.impossible.choices.at(-1).result,choice==='avoid'?'returned':choice==='observe'?'observed':'investigated');
 if(choice==='avoid'){assert.equal(p.state.echoes.clues['CLUE-09'],undefined);assert.equal(p.state.echoes.impossible.approached,false);}else{assert.ok(p.state.echoes.clues['CLUE-09']);assert.ok(r.events.some(e=>e.id==='impossible-ending'));assert.match(targetLabel(null,TEMPORAL_SITE.id,p.state.echoes),/未確定/);}
 assert.deepEqual(new HomewardProgress(p.storage).state,p.state);writeFileSync(new URL(name+'.json',dir),JSON.stringify(r.record));const route={name,from,target,angle:course,speed:220,time:r.state.elapsed,steps:r.steps,end:r.state.rocket.position,events:r.events,choice:p.state.echoes.impossible.choices.at(-1)};
 if(choice!=='avoid'){const back=leg(p,'gate',-20,'avoid'),fastBack=leg(q,'gate',-20,'avoid',100);assert.deepEqual(back.state,fastBack.state);assert.deepEqual(back.events,fastBack.events);route.return={angle:-20,speed:220,time:back.state.elapsed,end:back.state.rocket.position};assert.ok(p.state.echoes.clues['CLUE-09']);}
 metrics.push(route);writeFileSync(new URL('route-results.json',dir),JSON.stringify(metrics,null,2));
});
test('高速ステップの両端が範囲外でも接近・詳細調査を検出。物理入力不変',()=>{
 const p=progress();analyze(p);p.chooseImpossible('investigate');const stage=createOpenVoyage(p.state.voyage);stage.planets=[];stage.encounters=[];stage.launch.position={x:1500,y:800};let before=createSimulation(stage,{velocity:{x:168000,y:0}}),next=stepSimulation(before,1/120);const copy=structuredClone([before,next]);p.beginSurvey();p.observeSurvey(before,next,()=>1);assert.ok(p.state.echoes.clues['CLUE-09']);assert.equal(p.state.echoes.impossible.approached,true);assert.deepEqual([before,next],copy);const events=p.lastStoryEvents;p.observeSurvey(before,next,()=>2);assert.equal(p.lastStoryEvents.length,0);assert.ok(events.some(e=>e.id==='impossible-ending'));
 const onlyApproach=progress();analyze(onlyApproach);onlyApproach.beginSurvey();onlyApproach.observeSurvey(before,next,()=>1);assert.equal(onlyApproach.state.echoes.clues['CLUE-09'],undefined);assert.equal(onlyApproach.state.echoes.impossible.approached,true);
});
test('OBSERVEは連続した帯域内時間だけを集計。内側や帯域外・RESETを跨いで加算しない',()=>{
 const p=progress();analyze(p);p.chooseImpossible('observe');const story=p.state.echoes,point=(x,t)=>({elapsed:t,status:'flying',goal:{id:'gate'},rocket:{position:{x:TEMPORAL_SITE.x+x,y:TEMPORAL_SITE.y}}});
 let result=resolveImpossible(story,{previous:point(-600,0),next:point(600,1.2),now:()=>1});assert.equal(result.story.clues['CLUE-09'],undefined);
 let raw=story;for(let i=0;i<120;i++)raw=resolveImpossible(raw,{previous:point(300,i/120),next:point(300,(i+1)/120),now:()=>2}).story;assert.ok(raw.clues['CLUE-09']);assert.equal(raw.impossible.choices.at(-1).result,'observed');
 p.impossibleTracking=.9;p.beginSurvey();assert.equal(p.impossibleTracking,0);p.endImpossibleFlight(point(300,1),'reset');assert.equal(p.state.echoes.impossible.choices.at(-1).result,'reset');
});
test('旧v1.5の全情報・記録を保持し、欠落項目は未解析。容量不足でも継続',()=>{
 const p=progress(),before=p.storage.getItem(HOMEWARD_KEY);assert.equal(p.storage.getItem(HOMEWARD_KEY),before);assert.equal(p.state.echoes.impossible,undefined);const oldClues=structuredClone(p.state.echoes.clues);analyze(p);for(const id of Object.keys(oldClues))assert.deepEqual(p.state.echoes.clues[id],oldClues[id]);assert.equal(p.storage.getItem('classic'),'KEEP');assert.equal(p.storage.getItem('favorite'),'KEEP');
 const q=progress('echo-signal',true),saved=q.storage.getItem(HOMEWARD_KEY);analyze(q);leg(q,TEMPORAL_SITE.id,-129,'investigate');assert.ok(q.state.echoes.clues['CLUE-09']);assert.match(q.notice,/保存できません/);assert.equal(q.storage.getItem(HOMEWARD_KEY),saved);
});
test('Sector09代表4航路とSector01〜08の基準終端を維持',()=>{
 for(const route of JSON.parse(readFileSync(new URL('../reports/open-voyage/route-results.json',import.meta.url),'utf8'))){let voyage={};for(const l of route.legs){let state=createSimulation(createOpenVoyage({...voyage,checkpoint:l.from,selected:l.target}),{angleDeg:l.angleDeg,speed:l.speed});while(state.status==='flying')state=stepSimulation(state,1/120);assert.equal(state.elapsed,l.time);assert.deepEqual(state.rocket.position,l.end);assert.equal(state.status,'cleared');voyage={elapsed:(voyage.elapsed??0)+state.elapsed,planets:state.planets};}}
 for(let i=1;i<=8;i++){const id='homeward-'+String(i).padStart(2,'0'),stage=getHomewardSector(id),reference=JSON.parse(readFileSync(new URL(`../reports/${i<=3?'first-voyage':'lost-sectors'}/${id}-flight.json`,import.meta.url),'utf8'));let state=createSimulation(stage,stage.solution);while(state.status==='flying')state=stepSimulation(state,1/120);assert.equal(state.status,'cleared');assert.equal(state.elapsed,reference.duration);assert.deepEqual(state.rocket.position,{x:reference.frames.at(-1)[1],y:reference.frames.at(-1)[2]});}
});
