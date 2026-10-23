import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES as ALL_CHALLENGES,getChallenge} from '../js/challenges.js';
const CHALLENGES=ALL_CHALLENGES.slice(0,10);
import {placementAllowed,addPlanet} from '../js/planets.js';
import {createSimulation,simulateTrajectory} from '../js/physics.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {slingshotLaunch,velocityFromAngleSpeed} from '../js/launch.js';
import {loadProgress,isUnlocked,recordClear,rateClear} from '../js/progress.js';
import {getStage} from '../js/stages.js';
import {writeFile,mkdir} from 'node:fs/promises';
const report=[];
for(const stage of CHALLENGES)test(`${stage.id} データ・制約・両モード解答・両発射`,()=>{
 assert.ok(stage.description&&stage.solution&&stage.verification);
 assert.ok(stage.planets.length<=stage.rules.maxPlanets&&stage.rules.maxPlanets<=3);
 const s=getChallenge(stage.id);s.planets=structuredClone(s.solution.planets);
 for(const p of s.planets)assert.ok(placementAllowed(p,s),`${stage.id} invalid ${p.id}`);
 const {angleDeg,speed}=s.solution;
 const design=simulateTrajectory(s,{angleDeg,speed});assert.equal(design.state.status,'cleared');
 assert.ok(Math.abs(design.state.elapsed-s.verification.elapsed)<1e-9);
 let live=createSimulation(s,{angleDeg,speed});
 for(let i=0;i<1441&&live.status==='flying';i++)live=stepLiveFlight(live,{},s,'live');
 assert.equal(live.status,'cleared');assert.deepEqual(live.rocket,design.state.rocket);
 const vector=velocityFromAngleSpeed(angleDeg,1);
 const distance=14+Math.max(1e-7,(speed-120)/100*91);
 const shot=slingshotLaunch(s.launch.position,{x:s.launch.position.x-vector.x*distance,y:s.launch.position.y-vector.y*distance});
 assert.equal(simulateTrajectory(s,{velocity:shot.velocity}).state.status,'cleared');
 assert.equal(addPlanet(s),null);
 const stars=rateClear(s,'cleared',{elapsed:live.elapsed,movement:0},'live');
 const best=simulateTrajectory(s,s.threeStarSolution);
 assert.equal(rateClear(s,best.state.status,{elapsed:best.state.elapsed,movement:0},'live'),3);
 report.push({id:s.id,title:s.name,angleDeg,speed,time:live.elapsed,design:'cleared',live:'cleared',slingshot:'cleared',stars});
});
test('進行解放・最高星・独立記録・保存復元・壊れた保存',()=>{
 const map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let p=loadProgress(store);assert.equal(isUnlocked(p,0,CHALLENGES),true);assert.equal(isUnlocked(p,1,CHALLENGES),false);
 p=recordClear(p,store,'stage-01','design',3);p=recordClear(p,store,'stage-01','design',1);
 assert.equal(isUnlocked(p,1,CHALLENGES),true);assert.equal(isUnlocked(p,2,CHALLENGES),false);
 p=recordClear(p,store,'stage-01','live',2);assert.equal(p.design['stage-01'],3);assert.equal(p.live['stage-01'],2);
 assert.deepEqual(loadProgress(store),p);assert.deepEqual(loadProgress({getItem:()=>'{broken'}),{design:{},live:{}});
});
test('10ステージのIDは一意、発射条件と制約データが整合',()=>{
 assert.equal(CHALLENGES.length,10);assert.equal(new Set(CHALLENGES.map(s=>s.id)).size,10);
 for(const s of CHALLENGES){assert.ok(s.solution.angleDeg>=s.launchConditions.precisionAngleRange[0]&&s.solution.angleDeg<=s.launchConditions.precisionAngleRange[1]);assert.ok(s.solution.speed>=120&&s.solution.speed<=220);}
});
test('星評価の境界と未クリア',()=>{
 const s=CHALLENGES[0];
 assert.equal(rateClear(s,'crashed',{elapsed:1,movement:0},'design'),0);
 for(const [elapsed,movement,mode,stars] of [[5,0,'design',1],[4,0,'design',2],[3,999,'design',3],[3,30,'live',3],[3,31,'live',2]])
 assert.equal(rateClear(s,'cleared',{elapsed,movement},mode),stars);
});
test('フリープレイは元のステージと3惑星を維持、ステージ複製は独立',()=>{
 const free=getStage();assert.equal(free.rules,undefined);assert.ok(addPlanet(free));assert.ok(addPlanet(free));assert.equal(addPlanet(free),null);
 const s=getChallenge('stage-01');s.planets[0].x=0;assert.notEqual(getChallenge('stage-01').planets[0].x,0);
});
test('検証レポート出力',async()=>{
 assert.equal(report.length,10);
 const dir=new URL('../reports/stages/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('verification.json',dir),JSON.stringify(report,null,2));
 const lines=['# v0.5.0 ステージ到達検証','','既存物理エンジン・1/120秒刻みで検証。解答配置は challenges.js の solution.planets。重力操作は移動なしで到達。実機タッチ検証ではありません。','','| Stage | タイトル | ANGLE | THRUST | 到達秒 | 設計 / 重力操作 / スリング | 星 |','|---|---|---:|---:|---:|---|---:|',...report.map(r=>`| ${r.id} | ${r.title} | ${r.angleDeg} | ${r.speed} | ${r.time.toFixed(3)} | 成功 / 成功 / 成功 | ${r.stars} |`)];
 await writeFile(new URL('VERIFICATION.md',dir),lines.join('\n'));
 await writeFile(new URL('THREE_STARS.md',dir),['# 全ステージの★3達成例','','初期惑星配置を使用。惑星移動0のため両ゲームモードで★3条件を満たします。','',...CHALLENGES.map(s=>`${s.id}: ANGLE ${s.threeStarSolution.angleDeg} / THRUST ${s.threeStarSolution.speed}`)].join('\n'));
});
