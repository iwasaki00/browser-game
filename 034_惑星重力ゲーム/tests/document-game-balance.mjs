import {readFileSync,writeFileSync} from 'node:fs';
import {balanceRoutes} from './game-balance-routes.mjs';
import {runRoute,legal} from './measure-game-balance.mjs';
const dir=new URL('../reports/game-balance/',import.meta.url),m=JSON.parse(readFileSync(new URL('measurements.json',dir),'utf8')),routes=balanceRoutes();
const controls=[];
for(const id of ['stage-01','homeward-02','FINAL:origin>earth','FINAL:network>earth']){
 const r=routes.find(r=>r.id===id),oldStep=r.group==='FINAL'?.1:1,probes=[];
 for(const offset of [-oldStep,-.01,0,.01,oldStep]){const input={angleDeg:r.input.angleDeg+offset,speed:r.input.speed};probes.push({offset,legal:legal(r.stage,input.angleDeg,input.speed),...((legal(r.stage,input.angleDeg,input.speed))?{success:runRoute(r.stage,input).success}:{})});}
 controls.push({id,oldStep,newStep:.01,probes});
}
for(const r of m.results){
 const route=routes.find(t=>t.id===r.id);r.refined={};
 for(const direction of [-1,1]){const key='angle'+(direction<0?'-':'+'),b=r.boundaries[key];if(b.firstFailure?.reason==='outside-input-range'||Math.abs(b.lastSuccess)>.1||!b.firstFailure)continue;
  let good=Math.abs(b.lastSuccess),bad=Math.abs(b.firstFailure.delta);
  while(bad-good>.001){const mid=(good+bad)/2,input={angleDeg:route.input.angleDeg+direction*mid,speed:route.input.speed};if(runRoute(route.stage,input,{metrics:false}).success)good=mid;else bad=mid;}
  r.refined[key]={successDelta:direction*good,failedDelta:direction*bad,bracketWidth:bad-good};
 }
}
writeFileSync(new URL('refined-measurements.json',dir),JSON.stringify({controls,refinements:m.results.filter(r=>Object.keys(r.refined).length).map(r=>({id:r.id,...r.refined}))},null,2));
const f=n=>Number(n).toFixed(3),pct=s=>s.valid?`${s.success}/${s.valid} (${(100*s.success/s.valid).toFixed(1)}%)`:'範囲内なし';
let text='# 航路別実測一覧 / v1.9.1\n\n';
text+='物理・配置・ゴール・評価は変更していないため、調整前後の同一入力は同じ終端です。通常帰還の表示用参考入力のみ別表で調整しました。成功率はランダムなプレイヤーの成功確率ではなく、固定配置と既知解の周囲の格子サンプルです。\n\n';
text+='角度オフセット：±0.1, ±0.25, ±0.5, ±1, ±2, ±5°。推力：±1, ±2, ±5, ±10, ±20。各軸には0を含む。全組合せ143点/航路。単独13/11点（基準を共通計上）、両方変更120点。角度は0.05°刻み、推力は0.5刻みで基準から最初の失敗まで追加測定。狭い角度境界は0.001°未満の幅へ絞った。ただし離れた別解・非単調な成功島の全探索ではない。\n\n';
const totals=m.results.flatMap(r=>r.samples),valid=totals.filter(x=>x.reason!=='outside-input-range');
text+=`対象 ${m.results.length}航路 / 格子 ${totals.length}点 / 実航行 ${valid.length}点 / 範囲外 ${totals.length-valid.length}点。境界測定・基準・制御比較は別途実行。範囲外は物理失敗へ算入しない。飛行成功でも遭遇ミッション未達なら成功扱いしない。\n\n`;
text+='|航路|基準 ANGLE / THRUST|飛行秒|角度単独|推力単独|組合せ|角度の連続測定成功デルタ|推力の連続測定成功デルタ|\n|---|---|---:|---|---|---|---|---|\n';
for(const r of m.results)text+=`|${r.id}|${r.input.angleDeg} / ${r.input.speed}|${f(r.time)}|${pct(r.angle)}|${pct(r.speed)}|${pct(r.combined)}|${f(r.boundaries['angle-'].lastSuccess)}〜+${f(r.boundaries['angle+'].lastSuccess)}°|${f(r.boundaries['speed-'].lastSuccess)}〜+${f(r.boundaries['speed+'].lastSuccess)}|\n`;
text+='\n範囲端で打ち切った方向は物理的限界ではありません。両端の実際の失敗理由・境界・全格子入力は measurements.json に記録。上表は単独変化の範囲であり、その直積すべてが成功するという意味ではありません。\n\n## 狭い角度境界の追加測定\n\n|航路|方向|成功デルタ°|失敗デルタ°|境界幅°|\n|---|---|---:|---:|---:|\n';
for(const r of m.results)for(const [key,b]of Object.entries(r.refined))text+=`|${r.id}|${key}|${b.successDelta.toFixed(6)}|${b.failedDelta.toFixed(6)}|${b.bracketWidth.toFixed(6)}|\n`;
text+='\n## 操作幅の変更前後（同じ物理）\n\n|航路|従来ボタン幅°|新しい微調整幅°|基準からの試験（角度差:成否）|\n|---|---:|---:|---|\n';
for(const c of controls)text+=`|${c.id}|${c.oldStep}|${c.newStep}|${c.probes.map(p=>`${p.offset}: ${!p.legal?'範囲外':p.success?'CLEAR':'FAIL'}`).join(' / ')}|\n`;
text+='\n## 失敗原因（格子、範囲内）\n\n|原因|件数|\n|---|---:|\n';const causes={};for(const s of valid.filter(s=>!s.success))causes[s.reason]=(causes[s.reason]??0)+1;for(const [k,v]of Object.entries(causes))text+=`|${k}|${v}|\n`;
text+='\n## CLASSIC成功・星評価条件（変更なし）\n\n全ステージで実物理によるゴール到達が★1条件。★2/3は以下の時間以下、ライブ重力の★3には総移動距離30以下も必要。衝突・危険領域・逸脱・時間切れは失敗。\n\n|Stage|惑星種類|個数|精密角度範囲°|推力範囲|ゴール半径|★2秒|★3秒|\n|---|---|---:|---|---|---:|---:|---:|\n';
for(const r of routes.filter(r=>r.group==='CLASSIC')){const s=r.stage;text+=`|${r.id}|${s.planets.map(p=>p.type).join(', ')}|${s.planets.length}|${(s.launchConditions?.precisionAngleRange??s.launch.angleRange).join('〜')}|${(s.launchConditions?.speedRange??s.launch.speedRange).join('〜')}|${s.goal.radius}|${s.rating.two.maxTime}|${s.rating.three.maxTime}|\n`;}
text+='\n## 航行時間と倍率\n\nPC Nodeで60Hz相当の時刻入力を与えたスケジューラ測定。固定ステップ数・終端は一致。scheduledWallSeconds は仮想フレームの合計であり、実機での待ち時間やFPSの測定ではありません。cpuMs は描画・記録・通信UIを含まない、各飛行1回のPC測定値です。\n\n|航路|飛行秒|1倍 仮想秒 / CPU ms|10倍 仮想秒 / CPU ms|100倍 仮想秒 / CPU ms|\n|---|---:|---|---|---|\n';
for(const t of JSON.parse(readFileSync(new URL('timings.json',dir),'utf8')))text+=`|${t.id}|${f(t.flightSeconds)}|${t.times.map(x=>`${f(x.scheduledWallSeconds)} / ${x.cpuMs.toFixed(2)}`).join('|')}|\n`;
writeFileSync(new URL('MEASUREMENTS.md',dir),text);
console.log(JSON.stringify({routes:m.results.length,grid:totals.length,valid:valid.length,excluded:totals.length-valid.length,controls,refined:m.results.filter(r=>Object.keys(r.refined).length).map(r=>({id:r.id,...r.refined}))},null,2));
