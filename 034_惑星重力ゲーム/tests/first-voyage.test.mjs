import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {HOMEWARD_SECTORS,getHomewardSector} from '../js/homeward-data.js';
import {HomewardProgress,HOMEWARD_KEY,homewardDistance} from '../js/homeward-progress.js';
import {TUTORIAL_STEPS,tutorialEntry,tutorialTransition} from '../js/homeward-tutorial.js';
import {simulateTrajectory,createSimulation,stepSimulation} from '../js/physics.js';
const dir=new URL('../reports/first-voyage/',import.meta.url);mkdirSync(dir,{recursive:true});const rows=[];
for(const def of HOMEWARD_SECTORS)test(`${def.id}: 初期難易度と解答・近接余裕・調整許容範囲`,()=>{
 const s=getHomewardSector(def.id),initial=simulateTrajectory(s),answer=simulateTrajectory(s,s.solution);
 assert.equal(answer.state.status,'cleared');if(def.number==='01')assert.equal(initial.state.status,'cleared');else assert.notEqual(initial.state.status,'cleared');
 const closest=s.planets.map(p=>({type:p.type,clearance:Math.min(...answer.points.map(q=>Math.hypot(p.x-q.x,p.y-q.y)-Math.max(p.collisionRadius??p.radius,...(p.hazards??[]).map(h=>h.radius))-s.rocketRadius))}));
 assert.ok(closest.every(p=>p.clearance>0));
 const speeds=def.number==='01'?[220]:def.number==='02'?[218,220]:[216,218,220];for(const speed of speeds)assert.equal(simulateTrajectory(s,{angleDeg:-65,speed}).state.status,'cleared');
 const ablation=s.planets.map((p,i)=>({type:p.type,status:simulateTrajectory({...s,planets:s.planets.filter((_,j)=>i!==j)},s.solution).state.status}));
 if(def.number==='02')assert.ok(ablation.slice(0,2).every(p=>p.status!=='cleared'));
 if(def.number==='03')assert.ok(ablation.every(p=>p.status!=='cleared'));
 rows.push({sector:s.id,initial:{angle:s.launch.angleDeg,speed:s.launch.speed,status:initial.state.status,reason:initial.state.reason,elapsed:initial.state.elapsed},answer:{angle:-65,speed:220,status:answer.state.status,elapsed:answer.state.elapsed,end:answer.state.rocket.position},closest,ablation,clearingSpeeds:speeds});writeFileSync(new URL('balance-verification.json',dir),JSON.stringify(rows,null,2));
});
for(const [index,reason]of [[1,'absorbed'],[2,'overheated']])test(`03の新配置で危険領域の高速通過を検出：${reason}`,()=>{
 const s=getHomewardSector('homeward-03'),p=s.planets[index];s.launch.position={x:p.x-100,y:p.y};const next=stepSimulation(createSimulation(s,{velocity:{x:30000,y:0}}),1/120);assert.equal(next.status,'crashed');assert.equal(next.reason,reason);
});
test('チュートリアルは順に進み、発射観察・再試行・スキップ・完了を保存復元',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},p=new HomewardProgress(storage);p.start();p.enter('homeward-03');
 const update=(event,settings={})=>{const old=tutorialEntry(p.state,'homeward-03');p.setTutorial('homeward-03',tutorialTransition(old,'homeward-03',event,settings,{angleDeg:-60,speed:200}));};
 assert.equal(tutorialEntry(p.state,'homeward-03').step,0);update('angle',{angleDeg:-65});assert.equal(tutorialEntry(p.state,'homeward-03').step,0);update('select');update('angle',{angleDeg:-65});update('thrust',{speed:220});assert.equal(tutorialEntry(p.state,'homeward-03').step,3);update('next');update('launch');assert.equal(tutorialEntry(p.state,'homeward-03').step,5);
 const restored=new HomewardProgress(storage);assert.deepEqual(restored.state,p.state);update('restore');assert.equal(tutorialEntry(p.state,'homeward-03').step,4);update('retry');assert.equal(tutorialEntry(p.state,'homeward-03').step,0);update('skip');update('angle',{angleDeg:-66});assert.equal(tutorialEntry(p.state,'homeward-03').status,'skipped');assert.equal(new HomewardProgress(storage).state.tutorial['homeward-03'].status,'skipped');
});
test('旧v1の02・03クリア済み進行と既読を保持。起動だけでは書き換えない',()=>{
 const legacy={version:1,currentSector:'homeward-03',cleared:HOMEWARD_SECTORS.map(s=>s.id),openingSeen:true,active:true,eventsSeen:['homeward-02:arrival','homeward-03:arrival']};let raw=JSON.stringify(legacy),writes=0;
 const p=new HomewardProgress({getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,HOMEWARD_KEY);raw=v;writes++;}});
 assert.equal(writes,0);assert.deepEqual(p.state.cleared,legacy.cleared);assert.deepEqual(p.state.eventsSeen,legacy.eventsSeen);assert.equal(homewardDistance(p.state).remaining,58600);
 for(const s of HOMEWARD_SECTORS)assert.equal(tutorialEntry(p.state,s.id).status,'completed');p.enter('homeward-03');assert.deepEqual(JSON.parse(raw).cleared,legacy.cleared);
});
test('ガイドと設定の状態遷移は物理ステージを変更しない',()=>{
 const s=getHomewardSector('homeward-02'),before=structuredClone(s),entry={status:'active',step:0};const changed=tutorialTransition(entry,s.id,'thrust',{angleDeg:-65,speed:220},s.launch);assert.equal(changed.step,1);assert.deepEqual(s,before);assert.deepEqual(entry,{status:'active',step:0});assert.equal(TUTORIAL_STEPS[s.id][changed.step].manual,true);
});
