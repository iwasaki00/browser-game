import {writeFileSync} from 'node:fs';
import {createState,addPlot,plot,buy,reward,tick} from '../src/engine';
import {riverStart,riverPull,riverCapabilities,metrics} from '../src/river';
const order=['R101','R106','R103','R104','R110','R201','R206'];
function run(seed:number,investment=0){
 const s=createState(seed);s.currentFN=investment;s.discoveredTreasures.B001={count:20,first:'',best:0,locations:['B-A'],tools:['hand']};addPlot(s,seed,false,'R-A');
 const purchases:Record<string,number>={},uses:Record<string,{count:number;seconds:number;income:number}>={};let first=0,plots=0;
 while(s.playTime<3600&&!s.ownedTools.includes('R206')){
  let successes=0;
  for(const f of [...plot(s).items]){
   if(f.state!=='buried')continue;tick(s,2,true); // search a visible, unidentified silhouette
   const magnet=s.ownedTools.includes('R201')?'R201':s.ownedTools.includes('R104')?'R104':s.ownedTools.includes('R103')?'R103':'';
   const candidates=[...(magnet?[magnet]:[]),...['R106','R101'].filter(id=>s.ownedTools.includes(id)),'hand'];
   s.equippedTools=['R104','R110','R201','R206'].filter(id=>s.ownedTools.includes(id));
   for(const id of candidates){const start=s.playTime;const result=riverStart(s,id,f.x,f.y,riverCapabilities(s,id).rope);tick(s,.5,false);if(!result.ok)continue;
    for(let i=0;i<100&&s.riverSession?.uid;i++){const r=riverPull(s,70);tick(s,.75,false);if(!r.ok)break;}
    if(f.state!=='stored')continue;
    tick(s,1.4,true);const fn=reward(s,f.uid);if(!first)first=s.playTime;successes++;const u=uses[id]??={count:0,seconds:0,income:0};u.count++;u.seconds+=s.playTime-start;u.income+=fn;
    for(const item of order)if(!s.ownedTools.includes(item)){if(buy(s,item)){purchases[item]=s.playTime;tick(s,2,true);}else break;}
    break;
   }
  }
  if(!successes)throw Error(`stalled seed=${seed}`);plots++;addPlot(s,seed*10000+plots,false,s.ownedTools.includes('R104')?'R-B':'R-A');tick(s,4,true);
 }
 const m=metrics(s),weightFailures=Object.entries(m.failures).filter(([r])=>/重く|磁石が弱く/.test(r)).reduce((n,[,v])=>n+v,0);
 return {seed,investment,firstSeconds:first,purchases,normalFNPerMinute:s.totalEarnedFN/(s.playTime/60),earned:s.totalEarnedFN,minutes:s.playTime/60,uses,attempts:m.attempts,weightFailures,stalled:!s.ownedTools.includes('R206'),jackpots:s.jackpotHistory.length};
}
const results=Array.from({length:100},(_,i)=>run(i+1)),invested=Array.from({length:100},(_,i)=>run(i+1,1000));
const mean=(n:number[])=>Math.round(n.reduce((a,b)=>a+b,0)/n.length*10)/10;
const summarize=(rows:typeof results)=>({seeds:rows.length,firstSeconds:mean(rows.map(r=>r.firstSeconds)),purchaseSeconds:Object.fromEntries(order.map(id=>[id,mean(rows.map(r=>r.purchases[id]).filter(Number.isFinite))])),normalFNPerMinute:mean(rows.map(r=>r.normalFNPerMinute)),weightFailureRate:rows.reduce((n,r)=>n+r.weightFailures,0)/rows.reduce((n,r)=>n+r.attempts,0),stalled:rows.filter(r=>r.stalled).length,jackpots:rows.reduce((n,r)=>n+r.jackpots,0),toolEfficiency:Object.fromEntries(['hand',...order].map(id=>{const data=rows.map(r=>r.uses[id]).filter(Boolean);return[id,{recoveries:data.reduce((n,r)=>n+r.count,0),secondsPerRecovery:data.length?data.reduce((n,r)=>n+r.seconds,0)/data.reduce((n,r)=>n+r.count,0):null}];}))});
const summary={version:'0.2.0',zeroInvestment:summarize(results),beachInvestment1000:summarize(invested),method:'砂浜実績20個を持つプレイヤーの川底開始。FN0または砂浜資金1000から開始。正体不明の影の座標を順に試し、磁石→フック→トング→手で判定。照準は正確なボット。探索2秒、試行0.5秒、引く操作0.75秒、洗浄1.4秒、購入2秒、区画移動4秒。低体力は速度半減。回収・購入・報酬は通常ロジック。R-Aからロープ購入後R-Bへ。J・強制報酬なし。時間は人間の所要時間ではない。'};
writeFileSync('docs/river-balance-v020.json',JSON.stringify({summary,results,invested},null,2));console.log(JSON.stringify(summary,null,2));
