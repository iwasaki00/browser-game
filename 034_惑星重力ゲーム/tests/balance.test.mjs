import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile}from'node:fs/promises';
import {CHALLENGES as ALL_CHALLENGES}from'../js/challenges.js';
const CHALLENGES=ALL_CHALLENGES.slice(0,10);
import {simulateTrajectory,createSimulation}from'../js/physics.js';
import {stepLiveFlight}from'../js/live-gravity.js';
import {placementAllowed}from'../js/planets.js';
import {slingshotLaunch,velocityFromAngleSpeed}from'../js/launch.js';
import {loadProgress,recordClear,isUnlocked,rateClear,PROGRESS_KEY}from'../js/progress.js';
const dir=new URL('../reports/balance/',import.meta.url);
const before=JSON.parse(await readFile(new URL('before.json',dir),'utf8'));
const after=JSON.parse(await readFile(new URL('after.json',dir),'utf8'));
const changed=new Set(['stage-03','stage-05','stage-06','stage-07','stage-08','stage-09','stage-10']);
for(const stage of CHALLENGES)test(`${stage.id} ★3達成・小摂動の許容性${changed.has(stage.id)?'・変更箇所の互換性':''}`,()=>{
 const best=simulateTrajectory(stage,stage.threeStarSolution);
 assert.equal(rateClear(stage,best.state.status,{elapsed:best.state.elapsed,movement:0},'live'),3);
 const measured=after.measurements.find(m=>m.id===stage.id);
 for(const p of measured.placement)assert.ok(p.levels[0].hits>=5,'±2の配置が極端な一点解ではない');
 if(!changed.has(stage.id)){
  assert.deepEqual(stage,before.stages.find(s=>s.id===stage.id));return;
 }
 assert.ok(stage.planets.every(p=>placementAllowed(p,stage)));
 const base=simulateTrajectory(stage,stage.solution);assert.equal(base.state.status,'cleared');
 assert.ok(Math.abs(base.state.elapsed-stage.verification.elapsed)<1e-9);
 for(const launch of [stage.solution,stage.threeStarSolution]){
  let live=createSimulation(stage,launch);for(let n=0;n<1441&&live.status==='flying';n++)live=stepLiveFlight(live,{},stage,'live');
  assert.equal(live.status,'cleared');
  if(launch===stage.threeStarSolution)assert.equal(rateClear(stage,live.status,{elapsed:live.elapsed,movement:0},'live'),3);
  const direction=velocityFromAngleSpeed(launch.angleDeg,1),distance=14+Math.max(1e-7,(launch.speed-120)*.91);
  const shot=slingshotLaunch(stage.launch.position,{x:stage.launch.position.x-direction.x*distance,y:stage.launch.position.y-direction.y*distance});
  const sling=simulateTrajectory(stage,{velocity:shot.velocity});assert.equal(sling.state.status,'cleared');
  if(launch===stage.threeStarSolution)assert.equal(rateClear(stage,sling.state.status,{elapsed:sling.state.elapsed,movement:0},'live'),3);
 }
});
test('記録済み最高星と解放状態・保存形式を維持',()=>{
 const original={design:{'stage-01':3,'stage-03':3,'stage-09':3},live:{'stage-02':2,'stage-10':3}};
 const map=new Map([[PROGRESS_KEY,JSON.stringify(original)]]),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const restored=loadProgress(storage);assert.deepEqual(restored,original);
 assert.equal(isUnlocked(restored,3,CHALLENGES),true);
 const saved=recordClear(restored,storage,'stage-03','design',1);assert.deepEqual(saved,original);assert.deepEqual(loadProgress(storage),original);
});
test('移動あり別解の再現と、同条件の固定惑星での失敗',()=>{
 for(const row of after.live){
  const stage=CHALLENGES.find(s=>s.id===row.id),example=row.example;assert.ok(example);
  assert.notEqual(simulateTrajectory(stage,example).state.status,'cleared');
  let live=createSimulation(stage,example);for(let n=0;n<1441&&live.status==='flying';n++)live=stepLiveFlight(live,n>=example.startStep&&n<example.endStep?{[example.planet]:example.target}:{},stage,'live');
  assert.equal(live.status,'cleared');assert.ok(live.planets.every(p=>placementAllowed(p,{...stage,planets:live.planets})));
 }
});
test('★3検証レポート',async()=>{
 const rows=CHALLENGES.map(s=>{
  const b=before.stages.find(x=>x.id===s.id),r=simulateTrajectory(s,s.threeStarSolution);
  return `| ${s.id} | ${b.rating.three.maxTime} → ${s.rating.three.maxTime} | ${s.threeStarSolution.angleDeg} / ${s.threeStarSolution.speed} | ${r.state.elapsed.toFixed(3)} | ${(s.rating.three.maxTime-r.state.elapsed).toFixed(3)} | ★★★ |`;
 });
 await writeFile(new URL('THREE_STARS.md',dir),['# v0.5.1 ★3達成確認','','初期配置・移動なし。両モードで同一の条件を満たします。01・02・04は条件も解答も従来どおり。','','| Stage | ★3上限秒 前→後 | 角度 / 推力 | 到達秒 | 余裕秒 | 評価 |','|---|---|---|---|---|---|',...rows].join('\n'));
});
