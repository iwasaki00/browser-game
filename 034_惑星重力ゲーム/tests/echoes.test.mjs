import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {ECHO_CLUES,resolveEchoes,signalUnlocked,SIGNAL_ID} from '../js/echoes.js';
import {normalizeFrontier,targetAvailable} from '../js/frontier.js';
import {HomewardProgress,HOMEWARD_KEY} from '../js/homeward-progress.js';
import {HOMEWARD_SECTORS} from '../js/homeward-data.js';
import {createOpenVoyage,normalizeVoyage} from '../js/open-voyage.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {velocityFromAngleSpeed} from '../js/launch.js';
import {FlightClock} from '../js/flight-clock.js';
import {createFlightRecorder} from '../js/flight-record.js';
import {FlightReplay} from '../js/flight-replay.js';
const dir=new URL('../reports/echoes-of-the-unknown/',import.meta.url);mkdirSync(dir,{recursive:true});
function storage(raw,fail=false){const values=new Map([[HOMEWARD_KEY,JSON.stringify(raw)],['classic','KEEP']]);return {values,getItem:k=>values.get(k),setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}};}
const base=()=>({version:1,currentSector:'homeward-09',cleared:HOMEWARD_SECTORS.slice(0,8).map(s=>s.id),openingSeen:true,active:true,eventsSeen:[],journal:{'homeward-01':{importantFlightId:'old-first'}},extra:'KEEP'});
function flight(p,target,angle,speed=220,rate=1){
 assert.ok(p.selectDestination(target));const stage=createOpenVoyage(p.state.voyage);let state=createSimulation(stage,{angleDeg:angle,speed}),steps=0;const clock=new FlightClock({now:()=>0}),events=[],rec=createFlightRecorder(stage,state,{playType:'homeward',gameMode:'design',launchMode:'precision'},1);p.beginSurvey();clock.setRate(rate);
 while(state.status==='flying')clock.advance(1/60,dt=>{const before=state;state=stepSimulation(state,dt);p.observeSurvey(before,state,()=>123456789);events.push(...p.lastStoryEvents);rec.capture(state);assert.ok(++steps<21601);return state.status==='flying';});
 assert.equal(state.status,'cleared',`${stage.launch.position.x},${stage.launch.position.y} > ${target}`);assert.ok(p.dock(state));
 const preview=createPreview(stage,velocityFromAngleSpeed(angle,speed));while(!preview.done)advancePreview(preview,2000);assert.deepEqual(preview.state,state);
 const record={...rec.finish(state),storyEvents:events};return {state,record,events,steps};
}
test('手掛かりは全6順序で同じ情報を開示し、再計算・再訪で重複しない',()=>{
 for(const order of [['D01','D03','D04'],['D01','D04','D03'],['D03','D01','D04'],['D03','D04','D01'],['D04','D01','D03'],['D04','D03','D01']]){
  let raw,frontier=normalizeFrontier();for(const id of order){frontier.targets[id].state='INVESTIGATED';raw=resolveEchoes(raw,frontier,{}, {now:()=>42}).story;}
  assert.ok(signalUnlocked(raw));assert.deepEqual(Object.keys(raw.clues).sort(),['CLUE-01','CLUE-02','CLUE-03','CLUE-04']);assert.equal(new Set(raw.events.map(e=>e.id)).size,raw.events.length);assert.deepEqual(resolveEchoes(raw,frontier,{}).events,[]);
 }
 const f=normalizeFrontier();f.targets.D01.state='INVESTIGATED';let r=resolveEchoes(null,f,{});assert.equal(signalUnlocked(r.story),false);assert.equal(r.story.events.length,1);f.targets.D03.state='INVESTIGATED';r=resolveEchoes(r.story,f,{});assert.ok(r.story.events.some(e=>e.id==='match-pattern'));assert.ok(!r.story.events.some(e=>e.id==='match-vessel'));assert.equal(r.story.clues['CLUE-05'],undefined);
});
test('旧v1.4の知識・記録・チェックポイントを保護し、読み込みだけでは書かない',()=>{
 const frontier=normalizeFrontier();for(const id of ['D01','D03','D04'])frontier.targets[id]={id,state:'INVESTIGATED',investigatedFlightId:'protected-'+id};
 const raw={...base(),frontier,voyage:{checkpoint:'station',selected:'gate',visited:['station'],records:{station:'old-record'}}},s=storage(raw),before=s.getItem(HOMEWARD_KEY),p=new HomewardProgress(s);assert.ok(signalUnlocked(p.state.echoes));assert.equal(p.state.echoes.clues['CLUE-01'].flightId,'protected-D01');assert.equal(p.state.echoes.clues['CLUE-01'].at,null);assert.equal(p.state.echoes.clues['CLUE-05'],undefined);assert.equal(s.getItem(HOMEWARD_KEY),before);assert.equal(p.state.extra,'KEEP');assert.equal(p.state.voyage.checkpoint,'station');assert.equal(p.state.journal['homeward-01'].importantFlightId,'old-first');
});
test('三つの判断は可逆で、目的地と履歴だけを変え、重複選択を記録しない',()=>{
 const p=new HomewardProgress(storage(base()));assert.equal(p.chooseStory('follow'),null);assert.equal(p.selectDestination(SIGNAL_ID),false);assert.equal(targetAvailable(p.state.frontier,SIGNAL_ID,p.state.echoes),false);assert.equal(p.chooseStory('return'),'gate');
 p.state.frontier=normalizeFrontier();for(const id of ['D01','D03','D04'])p.state.frontier.targets[id].state='INVESTIGATED';p.state.echoes=resolveEchoes(p.state.echoes,p.state.frontier,{}).story;
 assert.equal(p.chooseStory('follow'),SIGNAL_ID);assert.equal(p.chooseStory('follow'),SIGNAL_ID);assert.equal(p.chooseStory('explore'),'probe');assert.equal(p.chooseStory('return'),'gate');assert.equal(p.chooseStory('follow'),SIGNAL_ID);assert.equal(p.state.echoes.choices.length,5);assert.ok(signalUnlocked(p.state.echoes));assert.deepEqual(new HomewardProgress(p.storage).state,p.state);
});
test('実航行で手掛かりを集め、発信源へ到達、再探索・帰還。1/100倍・予測一致',()=>{
 const p=new HomewardProgress(storage(base())),q=new HomewardProgress(storage(base())),metrics=[];
 for(const [target,angle] of [['probe',-48],['rescue',-174],['planet',-19],['station',-77],[SIGNAL_ID,98],['anomaly',89],['gate',-98]]){
  // Internal route tests may select known v1.4 sites before sensor discovery;
  // the new story destination is always locked until real investigations complete.
  if(target===SIGNAL_ID){assert.ok(signalUnlocked(p.state.echoes));assert.equal(p.chooseStory('follow'),SIGNAL_ID);assert.equal(q.chooseStory('follow'),SIGNAL_ID);}
  if(target==='anomaly'){assert.equal(p.chooseStory('explore'),'anomaly');assert.equal(q.chooseStory('explore'),'anomaly');}
  const r=flight(p,target,angle),high=flight(q,target,angle,220,100);assert.deepEqual(high.state,r.state);assert.deepEqual(high.events,r.events);assert.equal(high.steps,r.steps);
  for(const event of r.events)p.attachStoryRecord(event.id,`first-${event.id}`);for(const event of high.events)q.attachStoryRecord(event.id,`first-${event.id}`);
  const copy=JSON.stringify(r.record),replay=new FlightReplay(r.record);replay.setMode('cinematic');replay.restart();for(let n=0;n<5000&&replay.time<r.record.duration;n++)replay.advance(.1);assert.equal(replay.time,r.record.duration);assert.equal(JSON.stringify(r.record),copy);
  assert.deepEqual(new HomewardProgress(p.storage).state,p.state);metrics.push({target,angle,speed:220,time:r.state.elapsed,end:r.state.rocket.position,events:r.events,steps:r.steps});writeFileSync(new URL(`${target}.json`,dir),JSON.stringify(r.record));
 }
 assert.ok(p.state.echoes.clues['CLUE-05']);assert.ok(p.state.voyage.completed);assert.equal(Object.keys(p.state.echoes.clues).length,5);assert.equal(p.storage.getItem('classic'),'KEEP');assert.deepEqual(p.state.echoes,q.state.echoes);writeFileSync(new URL('route-results.json',dir),JSON.stringify(metrics,null,2));writeFileSync(new URL('save-example.json',dir),JSON.stringify(p.state,null,2));
});
test('新寄港地から帰還優先も再調査も通常の到達判定で成立する',()=>{
 const frontier=normalizeFrontier();for(const id of ['D01','D03','D04'])frontier.targets[id].state='INVESTIGATED';
 for(const [choice,target,angle] of [['return','gate',-105],['explore','station',-85]]){
  const raw={...base(),frontier,voyage:{checkpoint:SIGNAL_ID,visited:[SIGNAL_ID],selected:'gate'}},p=new HomewardProgress(storage(raw));
  if(choice==='return')assert.equal(p.chooseStory(choice),target);const r=flight(p,target,angle);assert.equal(r.state.target,target);assert.ok(p.state.echoes.clues['CLUE-05']);
 }
});
test('容量不足でも手掛かりをメモリに保持し、元セーブや他キーを削除しない',()=>{
 const raw=base(),s=storage(raw,true),before=s.getItem(HOMEWARD_KEY),p=new HomewardProgress(s);flight(p,'probe',-48);assert.ok(p.state.echoes.clues['CLUE-01']);assert.match(p.notice,/保存できません/);assert.equal(s.getItem(HOMEWARD_KEY),before);assert.equal(s.getItem('classic'),'KEEP');
});
test('v1.3代表4航路の終端は既存JSONと完全一致（新しい地点を通過しても未選択なら終了しない）',()=>{
 for(const route of JSON.parse(readFileSync(new URL('../reports/open-voyage/route-results.json',import.meta.url),'utf8'))){let voyage={};for(const leg of route.legs){const stage=createOpenVoyage({...voyage,checkpoint:leg.from,selected:leg.target});let state=createSimulation(stage,{angleDeg:leg.angleDeg,speed:leg.speed});while(state.status==='flying')state=stepSimulation(state,1/120);assert.equal(state.status,'cleared');assert.equal(state.elapsed,leg.time);assert.deepEqual(state.rocket.position,leg.end);voyage={elapsed:(voyage.elapsed??0)+state.elapsed,planets:state.planets};}}
});
