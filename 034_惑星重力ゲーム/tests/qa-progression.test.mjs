import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {CHALLENGES} from '../js/challenges.js';import {loadProgress,recordClear,isUnlocked,rateClear,PROGRESS_KEY} from '../js/progress.js';
import {HomewardProgress,HOMEWARD_KEY} from '../js/homeward-progress.js';import {getHomewardSector} from '../js/homeward-data.js';
import {createSimulation,stepSimulation} from '../js/physics.js';import {newMission,observeMission} from '../js/homeward-mission.js';
import {VOYAGE_COURSES} from '../js/voyage-courses.js';
import {targetAvailable} from '../js/frontier.js';import {destination} from '../js/open-voyage.js';
const dir=new URL('../reports/quality-assurance/',import.meta.url);mkdirSync(dir,{recursive:true});
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
function fly(stage,input,observe=()=>{}){let state=createSimulation(stage,input),evidence=newMission();while(state.status==='flying'){const old=state;state=stepSimulation(state,1/120);evidence=observeMission(evidence,old,state);state=observe(old,state)??state;}return {state,evidence};}
test('CLASSIC: 初回から20まで順次解放・失敗・再挑戦・最高星・毎回復元',()=>{
 const storage=memory(),rows=[];let p=loadProgress(storage);assert.ok(isUnlocked(p,0,CHALLENGES));assert.equal(isUnlocked(p,1,CHALLENGES),false);
 for(const [i,stage]of CHALLENGES.entries()){
  assert.ok(isUnlocked(p,i,CHALLENGES));const failed=fly(stage,{angleDeg:180,speed:120});assert.notEqual(failed.state.status,'cleared');const before=JSON.stringify(p);p=recordClear(p,storage,stage.id,'design',rateClear(stage,failed.state.status,{elapsed:failed.state.elapsed,movement:0},'design'));assert.equal(JSON.stringify(p),before);
  const r=fly(stage,stage.threeStarSolution);assert.equal(r.state.status,'cleared');const stars=rateClear(stage,r.state.status,{elapsed:r.state.elapsed,movement:0},'design');assert.equal(stars,3);p=recordClear(p,storage,stage.id,'design',stars);p=recordClear(p,storage,stage.id,'design',1);assert.equal(p.design[stage.id],3);assert.deepEqual(loadProgress(storage),p);p=loadProgress(storage);rows.push({id:stage.id,failure:failed.state.status,retry:r.state.status,stars,elapsed:r.state.elapsed,reload:'PASS'});
 }
 assert.equal(Object.keys(p.design).length,20);writeFileSync(new URL('classic-progression.json',dir),JSON.stringify(rows,null,2));
});
test('HOMEWARD: 新規開始→全セクター→実探索・解析→DEEP全6対象→全5結末',()=>{
 const storage=memory();let p=new HomewardProgress(storage),legs=[];p.start();
 const reload=()=>{const old=structuredClone(p.state);p=new HomewardProgress(storage);assert.deepEqual(p.state,old);};
 for(let i=1;i<=8;i++){const id=`homeward-0${i}`;assert.ok(p.enter(id));if(i===7)assert.ok(p.choose(id,'pursue'));const stage=getHomewardSector(id),r=fly(stage,stage.solution);assert.equal(r.state.status,'cleared');assert.ok(p.clear(id,r.evidence));reload();legs.push({id,time:r.state.elapsed,status:r.state.status});}
 assert.ok(p.enter('homeward-09'));
 for(const target of ['probe','rescue','planet','station','echo-signal','temporal-anomaly','gate']){
  const from=p.state.voyage?.checkpoint??'origin';
  if(target==='echo-signal'){assert.equal(p.chooseStory('follow'),target);}
  if(target==='temporal-anomaly'){assert.ok(p.analyzeSignal('identity').length);assert.ok(p.analyzeSignal('timestamp').length);assert.equal(p.chooseImpossible('investigate'),target);}
  const selected=targetAvailable(p.state.frontier,target,p.state.echoes)?target:'gate';assert.ok(p.selectDestination(selected,{requireDiscovered:true}));const course=VOYAGE_COURSES[from+'>'+target];assert.ok(course,from+'>'+target);const stage=getHomewardSector('homeward-09',p.state.voyage);p.beginSurvey();let changedAt=null;
  const r=fly(stage,{angleDeg:course[0],speed:course[1]},(a,b)=>{p.observeSurvey(a,b);if(b.status==='flying'&&b.goal.id!==target&&targetAvailable(p.state.frontier,target,p.state.echoes)){assert.ok(p.selectDestination(target,{requireDiscovered:true}));changedAt=b.elapsed;return {...b,goal:{...destination(target)}};}});assert.equal(r.state.status,'cleared');assert.equal(r.state.target,target);p.endImpossibleFlight(r.state);assert.ok(p.dock(r.state));reload();legs.push({id:'09:'+from+'>'+target,time:r.state.elapsed,status:r.state.status,changedAt});
 }
 for(let i=1;i<=9;i++)assert.ok(p.state.echoes.clues[`CLUE-0${i}`]);assert.ok(p.enter('homeward-deep'));
 const deepRoutes=JSON.parse(readFileSync(new URL('../deep-space/routes.json',dir),'utf8'));
 for(const target of ['DS01','DS02','DS03','DS04','DS05','return','DS06','return']){const from=p.state.deep?.checkpoint??'origin';assert.ok(p.selectDeep(target),target);const input=deepRoutes.find(r=>r.from===from&&r.target===target);assert.ok(input);const stage=getHomewardSector('homeward-deep',null,p.state.deep),r=fly(stage,input,(a,b)=>{p.surveyDeep(a,b);});assert.equal(r.state.status,'cleared');assert.ok(p.dockDeep(r.state));reload();legs.push({id:'DEEP:'+from+'>'+target,time:r.state.elapsed,status:r.state.status});}
 assert.ok(p.enter('homeward-final'));const beginning=storage.getItem(HOMEWARD_KEY),finalRoutes=JSON.parse(readFileSync(new URL('../final-voyage/routes.json',dir),'utf8')),endings=[];
 for(const [id,decision,targets]of [['END-01','home',['earth']],['END-02','rescue',['earth']],['END-03','truth',['network','earth']],['END-04','other',['network','passage']],['END-05','continue',['observatory']]]){
  storage.setItem(HOMEWARD_KEY,beginning);p=new HomewardProgress(storage);p.chooseFinalDecision('continue');assert.ok(p.chooseFinalDecision(decision));let from='origin';
  for(const target of targets){assert.ok(p.selectFinal(target));const input=finalRoutes.find(r=>r.from===from&&r.target===target);assert.ok(input);const stage=getHomewardSector('homeward-final',null,null,p.state.finalVoyage),r=fly(stage,input);assert.equal(r.state.status,'cleared');assert.ok(p.dockFinal(r.state));reload();from=target;}
  assert.ok(p.state.finalVoyage.endings[id],id);assert.equal(Object.keys(p.state.finalVoyage.endings).length,1);endings.push({id,decision,targets,status:'PASS',preconditions:'derived from new-game physical journey; no granted clues/unlocks'});
 }
 writeFileSync(new URL('homeward-progression.json',dir),JSON.stringify({legs,endings,clues:'01–09 physically acquired',deepTargets:6},null,2));
});
