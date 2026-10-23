import test from'node:test';
import assert from'node:assert/strict';
import {readFile,writeFile,mkdir}from'node:fs/promises';
import {SPECIAL_CHALLENGES,launchAllowed}from'../js/special-challenges.js';
import {CHALLENGES}from'../js/challenges.js';
import {createSimulation,simulateTrajectory,stepSimulation}from'../js/physics.js';
import {stepLiveFlight}from'../js/live-gravity.js';
import {configurePlanet,placementAllowed}from'../js/planets.js';
import {velocityFromAngleSpeed,slingshotLaunch}from'../js/launch.js';
import {rateClear,loadProgress,recordClear,isUnlocked,PROGRESS_KEY}from'../js/progress.js';
const report=[];
for(const stage of SPECIAL_CHALLENGES)test(`${stage.id} データ・到達・★3・発射/モード互換・特殊惑星の寄与`,()=>{
 const s=structuredClone(stage),answer=s.solution;
 assert.ok(s.description&&s.rules.fixedPlanets.length===s.planets.length&&s.planets.length<=3);
 assert.ok(s.planets.every(p=>placementAllowed(p,s)));
 const r=simulateTrajectory(s,answer);assert.equal(r.state.status,'cleared');assert.equal(r.state.elapsed,answer.elapsed);
 let live=createSimulation(s,answer);for(let n=0;n<1441&&live.status==='flying';n++)live=stepLiveFlight(live,{},s,'live');
 assert.deepEqual(live,r.state);assert.equal(rateClear(s,live.status,{elapsed:live.elapsed,movement:0},'live'),3);
 const velocity=velocityFromAngleSpeed(answer.angleDeg,answer.speed);assert.ok(launchAllowed(s,velocity));
 assert.equal(launchAllowed(s,velocityFromAngleSpeed(s.launchConditions.precisionAngleRange[0]-1,answer.speed)),false);
 assert.equal(launchAllowed(s,velocityFromAngleSpeed(answer.angleDeg,s.launchConditions.speedRange[0]-1),'slingshot'),false);
 const unit=velocityFromAngleSpeed(answer.angleDeg,1),distance=14+(answer.speed-120)*.91;
 const shot=slingshotLaunch(s.launch.position,{x:s.launch.position.x-unit.x*distance,y:s.launch.position.y-unit.y*distance});
 assert.ok(launchAllowed(s,shot.velocity,'slingshot'));
 const sling=simulateTrajectory(s,{velocity:shot.velocity});assert.equal(sling.state.status,'cleared');
 assert.equal(rateClear(s,sling.state.status,{elapsed:sling.state.elapsed,movement:0},'design'),3);
 const evidence=[];
 for(const p of s.planets){
  const removed=simulateTrajectory({...s,planets:s.planets.filter(q=>q.id!==p.id)},answer).state.status;
  const disabled=simulateTrajectory({...s,planets:s.planets.map(q=>q.id===p.id?{...q,gravityMultiplier:0}:q)},answer).state.status;
  assert.notEqual(removed,'cleared');assert.notEqual(disabled,'cleared');
  let tries=0,hits=0;
  if(p.effect)for(let a=s.launchConditions.precisionAngleRange[0];a<=s.launchConditions.precisionAngleRange[1];a+=.5)for(let v=s.launchConditions.speedRange[0];v<=s.launchConditions.speedRange[1];v+=2){
   tries++;if(simulateTrajectory({...s,planets:s.planets.map(q=>q.id===p.id?{...q,gravityMultiplier:0}:q)},{angleDeg:a,speed:v}).state.status==='cleared')hits++;
  }
  assert.equal(hits,0,'対象特殊惑星なしの発射格子に迂回解');
  let tolerance=0;
  for(const dx of [-2,0,2])for(const dy of [-2,0,2]){
   const t=structuredClone(s),q=t.planets.find(q=>q.id===p.id);q.x+=dx;q.y+=dy;
   if(t.planets.every(q=>placementAllowed(q,t))&&simulateTrajectory(t,answer).state.status==='cleared')tolerance++;
  }
  assert.ok(tolerance>=4,'小さな配置変化の許容域が狭すぎる');
  const replacement=configurePlanet(p,'asteroid');assert.equal(placementAllowed(replacement,s),false);
  const out={...p,x:p.x+13};assert.equal(placementAllowed(out,s),false);
  const clearance=Math.min(...r.points.map(q=>Math.hypot(q.x-p.x,q.y-p.y)-(p.hazards?.[0]?.radius??p.collisionRadius??p.radius)-s.rocketRadius));
  evidence.push({id:p.id,type:p.type,removed,gravityDisabled:disabled,counterfactualGrid:{tries,hits},placementTolerance:{hits:tolerance,tries:9},closestClearance:clearance});
 }
 report.push({id:s.id,name:s.name,solution:s.solution,status:r.state.status,time:r.state.elapsed,stars:3,live:'cleared',slingshot:'cleared',evidence});
});
test('特殊危険領域の高速横断は新ステージでも失敗',()=>{
 for(const s of SPECIAL_CHALLENGES.filter(s=>s.planets.some(p=>p.hazards?.length))){
  const stage=structuredClone(s),p=stage.planets.find(p=>p.hazards?.length);stage.planets=[{...p,mass:0}];
  stage.launch.position={x:p.x-100,y:p.y};stage.goal={id:'g',x:1,y:1,radius:1};
  const state=stepSimulation(createSimulation(stage,{velocity:{x:24000,y:0}}),1/120);
  assert.equal(state.status,'crashed');assert.equal(state.reason,p.hazards[0].reason);
 }
});
test('旧セーブ維持・10→11→20解放・モード別最高星・保存復元',()=>{
 const old={design:Object.fromEntries(Array.from({length:10},(_,i)=>[`stage-${String(i+1).padStart(2,'0')}`,3])),live:{'stage-01':2}};
 const map=new Map([[PROGRESS_KEY,JSON.stringify(old)]]),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let p=loadProgress(store);assert.deepEqual(p,old);assert.ok(isUnlocked(p,10,CHALLENGES));assert.equal(isUnlocked(p,11,CHALLENGES),false);
 for(const s of SPECIAL_CHALLENGES){const index=CHALLENGES.findIndex(q=>q.id===s.id);assert.ok(isUnlocked(p,index,CHALLENGES));p=recordClear(p,store,s.id,'live',3);}
 assert.equal(p.design['stage-10'],3);assert.equal(p.design['stage-11'],undefined);assert.equal(p.live['stage-20'],3);
 p=recordClear(p,store,'stage-20','live',1);assert.equal(p.live['stage-20'],3);assert.deepEqual(loadProgress(store),p);
});
test('既存01〜10・星条件とデータを維持',async()=>{
 const old=JSON.parse(await readFile(new URL('../reports/balance/after.json',import.meta.url),'utf8'));
 assert.deepEqual(CHALLENGES.slice(0,10),old.stages);assert.equal(CHALLENGES.length,20);
 assert.equal(new Set(CHALLENGES.map(s=>s.id)).size,20);
 assert.ok(launchAllowed(old.stages[0],{x:200,y:0})); // Legacy launch handling remains unchanged.
});
test('レポート出力',async()=>{
 assert.equal(report.length,10);const dir=new URL('../reports/special-challenges/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('verification.json',dir),JSON.stringify(report,null,2));
 const lines=['# v0.6.1 SPECIAL CHALLENGES 検証','','既存物理・1/120秒。解答の位置/種類/サイズ/角度/速度/終了状態はspecial-challenges.jsとverification.json。全て移動なしで両モード到達。','','| Stage | 名称 | 惑星 | 角度 / 推力 | 到達秒 | 評価 | 両モード / スリング |','|---|---|---|---|---|---|---|',...report.map(r=>`| ${r.id} | ${r.name} | ${r.solution.planets.map(p=>p.type).join(' + ')} | ${r.solution.angleDeg} / ${r.solution.speed} | ${r.time.toFixed(3)} | ★★★ | 成功 / 成功 |`),
 '', '## 特殊惑星の寄与と許容幅','',
 '全ての基準解答について、各惑星を削除またはその重力を無効化すると到達しないことを検証。さらに、初期配置を固定し、許可発射角を0.5°刻み・推力を2刻みで探索したところ、対象特殊惑星の重力無効化では全試行が失敗。Stage14の通常惑星は格子全域の必須性ではなく、基準航路への寄与を確認。',
 '種類・サイズ・個数を固定し、惑星中心の移動を初期位置から各軸±12に制限。Stage19〜20は発射角±1°・推力±4以内に制限する一方、惑星位置は調整可能。両発射方式に同じ条件を適用する。',
 'これは初期配置の有限格子と解答の因果比較による検証であり、全ての連続配置や飛行中の操作に対する数学的必須性の証明ではない。数値結果を超えて「特殊惑星以外では絶対に攻略不能」とは主張しない。','',
 '| Stage | 惑星 | 削除 / 重力無効 | 無効化時の成功/格子数 | ±2位置の成功/9 | 危険/表面からの最接近余裕 |','|---|---|---|---|---|---|',
 ...report.flatMap(r=>r.evidence.map(e=>`| ${r.id} | ${e.type} | ${e.removed} / ${e.gravityDisabled} | ${e.counterfactualGrid.hits}/${e.counterfactualGrid.tries} | ${e.placementTolerance.hits}/9 | ${e.closestClearance.toFixed(2)} |`)),
 '', '## 危険領域・保護対象','',
 '恒星とブラックホールを含む新ステージで、高速横断時のoverheated/absorbed失敗を検証。物理エンジン・予測・特殊惑星設定を変更していない。Stage01〜10はv0.5.1の保存済みデータと完全一致。localStorageキーとdesign/liveの保存構造を維持し、読込対象を20件へ拡張。',
 '', '## 実機での確認項目（未実施）','',
 'Stage10クリア済みセーブでStage11が解放されること、Stage11〜20のテーマ・星・ロック表示、種類固定、惑星ドラッグと両発射方式の範囲制約、重力操作の危険領域、RESETでステージ初期配置へ戻ることを確認する。Chrome viewport再現とiPhone実機は区別する。'];
 await writeFile(new URL('VERIFICATION.md',dir),lines.join('\n'));
});
