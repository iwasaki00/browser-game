import {CHALLENGES} from '../js/challenges.js';
import {simulateTrajectory,createSimulation} from '../js/physics.js';
import {stepLiveFlight} from '../js/live-gravity.js';
import {placementAllowed} from '../js/planets.js';
import {rateClear} from '../js/progress.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir=new URL('../reports/balance/',import.meta.url);await mkdir(dir,{recursive:true});
function run(stage,launch=stage.solution){return simulateTrajectory(stage,launch);}
function closest(points,p){let min=Infinity;for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 min=Math.min(min,Math.hypot(a.x+t*dx-p.x,a.y+t*dy-p.y)-p.radius-6);
}return min;}
function analyze(stage){
 const result=run(stage);let turn=0,net=0,signs=[];
 for(let i=2;i<result.points.length;i++){
  const [a,b,c]=result.points.slice(i-2,i+1);const u=Math.atan2(b.y-a.y,b.x-a.x),v=Math.atan2(c.y-b.y,c.x-b.x);
  const delta=Math.atan2(Math.sin(v-u),Math.cos(v-u))*180/Math.PI;turn+=Math.abs(delta);net+=delta;
  if(Math.abs(delta)>1e-6)signs.push(Math.sign(delta));
 }
 const placement=stage.planets.map((p,index)=>{
  const levels=[2,4,8,12].map(radius=>{let valid=0,hits=0;const successes=[];
   for(const dx of [-radius,0,radius])for(const dy of [-radius,0,radius]){
    const s=structuredClone(stage);s.planets[index].x+=dx;s.planets[index].y+=dy;
    if(!s.planets.every(q=>placementAllowed(q,s)))continue;valid++;
    if(run(s).state.status==='cleared'){hits++;successes.push([dx,dy]);}
   }return {radius,valid,hits,successes};
  });return {id:p.id,levels};
 });
 let valid=0,hits=0,three=0;const launchHits=[];
 for(const da of [-2,-1,0,1,2])for(const dv of [-8,-4,0,4,8]){
  const angleDeg=stage.solution.angleDeg+da,speed=stage.solution.speed+dv;
  if(angleDeg< -72||angleDeg> -35||speed<120||speed>220)continue;valid++;
  const r=run(stage,{angleDeg,speed});if(r.state.status==='cleared'){
   hits++;launchHits.push([angleDeg,speed]);if(rateClear(stage,'cleared',{elapsed:r.state.elapsed,movement:0},'design')===3)three++;
  }
 }
 // Remove one planet at a time to measure whether the reference route actually needs it.
 const removal=stage.planets.map(p=>({id:p.id,status:run({...stage,planets:stage.planets.filter(q=>q.id!==p.id)}).state.status}));
 return {id:stage.id,name:stage.name,time:result.state.elapsed,status:result.state.status,count:stage.planets.length,
  types:stage.planets.map(p=>`${p.type}/${p.size}`),angle:stage.solution.angleDeg,speed:stage.solution.speed,
  turn,net,signChanges:signs.filter((s,i)=>i&&s!==signs[i-1]).length,clearance:stage.planets.map(p=>closest(result.points,p)),
  placement,launch:{valid,hits,three,launchHits},removal,rating:stage.rating};
}
function liveAlternative(stage){
 for(const da of [-2,-1,0,1,2])for(const dv of [-8,-4,0,4,8]){
  const angleDeg=stage.solution.angleDeg+da,speed=stage.solution.speed+dv;
  if(angleDeg< -72||angleDeg> -35||speed<120||speed>220||run(stage,{angleDeg,speed}).state.status==='cleared')continue;
  for(const p of stage.planets)for(const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]]){
   let state=createSimulation(stage,{angleDeg,speed}),movement=0;
   const target={x:p.x+dx,y:p.y+dy};
   for(let n=0;n<1441&&state.status==='flying';n++){
    const old=state;state=stepLiveFlight(state,n>=24&&n<72?{[p.id]:target}:{},stage,'live');
    movement+=state.planets.reduce((s,q,i)=>s+Math.hypot(q.x-old.planets[i].x,q.y-old.planets[i].y),0);
   }
   if(state.status==='cleared')return {angleDeg,speed,planet:p.id,target,startStep:24,endStep:72,time:state.elapsed,movement,stars:rateClear(stage,'cleared',{elapsed:state.elapsed,movement},'live')};
  }
 }return null;
}
const after=process.argv.includes('--after');
const measurements=CHALLENGES.map(analyze);
const live=CHALLENGES.map(s=>({id:s.id,example:liveAlternative(s)}));
await writeFile(new URL(after?'after.json':'before.json',dir),JSON.stringify({stages:CHALLENGES,measurements,live},null,2));
console.log(JSON.stringify(measurements.map(m=>({id:m.id,t:+m.time.toFixed(3),turn:+m.turn.toFixed(1),clear:m.clearance.map(x=>+x.toFixed(1)),pos:m.placement.map(p=>p.levels.map(l=>`${l.hits}/${l.valid}`)),launch:`${m.launch.hits}/${m.launch.valid}`,three:m.launch.three,removal:m.removal.map(r=>r.status)})),null,2));
console.log('live alternatives',JSON.stringify(live));
if(after){
 const before=JSON.parse(await readFile(new URL('before.json',dir),'utf8'));
 // Recompute metrics from the preserved original stage snapshots, never the edited data.
 before.measurements=before.stages.map(analyze);
 await writeFile(new URL('before.json',dir),JSON.stringify(before,null,2));
 const fmt=x=>x.toFixed(2),pos=m=>m.placement.map(p=>`${p.levels[1].hits}/${p.levels[1].valid}`).join('・');
 const lines=['# v0.5.1 STAGE BALANCE 検証','','## 測定方法と限界','',
 '物理エンジンは変更せず1/120秒刻みで計算。解答例の各惑星を個別にx/y各±2・4・8・12の3×3格子で移動し、他の惑星・発射条件を固定。配置制約に違反する試行は除外。位置許容率は全空間の連続領域の保証ではありません。',
 '発射許容率は基準解答の角度±2°（1°刻み）・推力±8（4刻み）の25候補のうちUI範囲内だけを対象。角度・推力が範囲端にあると母数が異なるため、率の単純比較はできません。',
 '最接近は各線分から惑星表面までの距離からロケット半径6を引いた安全余裕。方向変化は航路の累積絶対旋回角、括弧内は正負の反転回数。配置・目標の調整により基準解答の到達時間も変わります。Stage10のみ基準解答を−72°/132から−69°/160へ変更したため前後で発射近傍の中心が異なります。',
 '難易度は数値代理指標による評価であり、人間のプレイ試験による確定順位ではありません。特にすべての設定・配置を含めた最適攻略の難しさを測定したものではありません。','',
 '## ステージ別の変更前後','',
 '| Stage | 惑星（前→後） | 発射 ANGLE/THRUST 前→後 | 到達秒 前→後 | 旋回角 前→後 | 最接近余裕 前→後 | ±4位置成功/試行（惑星順） 前→後 | 発射成功/試行 前→後 | ★2 / ★3 秒 前→後 |',
 '|---|---|---|---|---|---|---|---|---|'];
 for(const m of measurements){const b=before.measurements.find(q=>q.id===m.id);lines.push(`| ${m.id} ${m.name} | ${b.count}: ${b.types.join(',')} → ${m.count}: ${m.types.join(',')} | ${b.angle}/${b.speed} → ${m.angle}/${m.speed} | ${fmt(b.time)} → ${fmt(m.time)} | ${fmt(b.turn)}°(${b.signChanges}) → ${fmt(m.turn)}°(${m.signChanges}) | ${b.clearance.map(fmt).join('/')} → ${m.clearance.map(fmt).join('/')} | ${pos(b)} → ${pos(m)} | ${b.launch.hits}/${b.launch.valid} → ${m.launch.hits}/${m.launch.valid} | ${b.rating.two.maxTime}/${b.rating.three.maxTime} → ${m.rating.two.maxTime}/${m.rating.three.maxTime} |`);}
 lines.push('','## 調整判断','',
 '01・02・04：配置・制約・評価は変更なし。01は基礎、02は小ゲート、04は小惑星の弱い引力による微調整を維持。',
 '03：ゲート半径22→28。初心者帯で発射・配置の局所許容率を広げる。★3は3→2.6秒とし速い航路も試す目標に分離。',
 '05：配置は維持、★3のみ3→2.55秒。大サイズの惑星の引力と速度を組み合わせる。',
 '06〜08：ゲート半径22→18、20→16、20→14。2惑星の合成重力と位置調整を段階的に要求。07は符号反転のある軌道、08は異種惑星の橋。',
 '09〜10：第3惑星を(290,390)→(270,190)へ移動。基準軌道に近づけ、終盤にも寄与させる。ゲート半径20→14、16→12。10は局所許容率を確保する基準解答へ更新。',
 '★2は06〜10で3.6/3.5/3.4/3.3/3.1秒、★3は2.65/2.55/2.45/2.35/2.25秒。単なる到達を★1として残し、全ステージの★3解答を保つ。重力操作の移動上限30は変更せず、強制移動は追加しない。',
 'Stage01〜03の導入、04〜05の種類・サイズ、06〜08の2惑星、09〜10の3惑星という段階は維持。ただし個別の許容率は完全な単調減少にはならず、発射設定や惑星ごとに違いがある。極端な一点解ではないことは小摂動テストで確認する。','',
 '## ★3の局所難易度','',
 '下表は通常解答近傍の発射格子のうち★3に達した数。0でも専用の高速解答が存在し、THREE_STARS.mdで全ステージを検証しています。','',
 '| Stage | 通常解答近傍での★3数/有効試行 前→後 |','|---|---|',
 ...measurements.map(m=>{const b=before.measurements.find(q=>q.id===m.id);return `| ${m.id} | ${b.launch.three}/${b.launch.valid} → ${m.launch.three}/${m.launch.valid} |`;}),
 '', '## 重力操作による別解','',
 '以下は同じ初期配置・発射で固定惑星では失敗し、惑星を移動すると成功した例。開始24ステップ(0.2秒)〜終了72ステップ(0.6秒)だけ目標へ移動し、その後は停止。移動なしの既存解答も維持。','',
 '| Stage | 発射 | 対象・目標 | 総移動 | 到達秒 | 星 |','|---|---|---|---:|---:|---:|');
 for(const row of live){const a=row.example;lines.push(a?`| ${row.id} | ${a.angleDeg}°/${a.speed} | ${a.planet} → (${a.target.x},${a.target.y}) | ${fmt(a.movement)} | ${fmt(a.time)} | ${a.stars} |`:`| ${row.id} | 探索範囲内では未確認 | | | | |`);}
 lines.push('','## 保存互換性と引き継ぎ','',
 'ステージID、localStorageキー、design/live別の最高星保存構造を維持。過去の星は減点・消去せず、新条件は新しいプレイの評価に適用する。',
 '生データ（各摂動の成功座標、解答、星条件、別解）はbefore.json / after.json。実機iPhone・人による難易度評価は未実施。今後は操作回数・試行回数を含む実プレイ評価で順位を補正する。');
 await writeFile(new URL('BALANCE.md',dir),lines.join('\n'));
}
