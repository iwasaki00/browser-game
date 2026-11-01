import {writeFileSync} from 'node:fs';
import {createState,plot,dig,recover,reward,sift,stored,buy,refresh,addPlot,tick,exposure} from '../src/engine.ts';
import {CONFIG} from '../src/data.ts';
const results=[];
for(let seed=1;seed<=100;seed++){
 const s=createState(seed);for(const f of plot(s).items)if(f.id==='B012')f.id='B007';const purchases:Record<string,number>={};let first=0,actions=0,row=14,col=0,pass=0,rowsVisited=0;
 while(s.playTime<3600&&!s.ownedTools.includes('B201')){
  const id=s.ownedTools.includes('B105')?'B105':s.ownedTools.includes('B101')?'B101':'hand',p=plot(s),radius=id==='B105'?26:id==='B101'?15:7;
  dig(s,id,5+col*10,5+row*10,5);actions++;tick(s,.11,false);
  for(const f of p.items)if(f.state==='buried'&&exposure(p,f)>=CONFIG.exposure&&recover(s,f.uid,id))tick(s,.15,true);
  if(actions%3===0)sift(s,s.ownedTools.includes('B104'));
  for(const f of stored(s)){reward(s,f.uid);tick(s,.25,true);if(!first)first=s.playTime;}
  refresh(s);for(const t of ['B101','B102','B104','B105','B201'])if(!s.ownedTools.includes(t)&&buy(s,t)){purchases[t]=s.playTime;tick(s,2,true);}
  col+=Math.max(1,Math.floor(radius/10));if(col>=36){col=0;pass++;tick(s,.5,true);if(pass>=3){pass=0;row++;rowsVisited++;}}
  if(row>27)row=0;
  if(rowsVisited>=28){addPlot(s,seed*10000+s.exploredPlots,true);row=col=pass=rowsVisited=0;tick(s,1,true);}
 }
 results.push({seed,first,purchases,earned:s.totalEarnedFN,minutes:s.playTime/60,normalFNPerMin:s.totalEarnedFN/(s.playTime/60),jackpots:s.jackpotHistory.length,stalled:!s.ownedTools.includes('B201'),actions});
}
const mean=(xs:number[])=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*10)/10:null;
const summary={version:'0.1.1',seeds:100,firstFindSeconds:mean(results.map(r=>r.first).filter(n=>n>0)),purchaseSeconds:Object.fromEntries(['B101','B102','B104','B105','B201'].map(id=>[id,mean(results.map(r=>r.purchases[id]).filter(Number.isFinite))])),normalFNPerMin:mean(results.map(r=>r.normalFNPerMin)),jackpots:results.reduce((n,r)=>n+r.jackpots,0),stalled:results.filter(r=>r.stalled).length,method:'初回は公開された初心者ガイド付近の列から開始し、新しい平面の全域を3往復相当ずつ走査。5px作業0.11秒。作業中は体力回復なし、行末0.5秒休憩、回収0.15秒、洗浄0.25秒、購入2秒。J除外。R/SR依頼は通常抽選。最長60分のボット時間で到達確認し、人間の所要時間を保証しない。'};
writeFileSync('docs/balance-results-v011.json',JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary,null,2));
