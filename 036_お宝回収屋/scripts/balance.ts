import {writeFileSync} from 'node:fs';
import {createState,plot,dig,recover,reward,sift,stored,buy,refresh,addPlot,tick,exposure,type State} from '../src/engine.ts';
import {tools,CONFIG} from '../src/data.ts';
const results=[];
for(let seed=1;seed<=100;seed++){
 const s=createState(seed); for(const f of plot(s).items)if(f.id==='B012')f.id='B007';const purchases:Record<string,number>={};let first=0,actions=0;
 // A systematic frontier sweep; no knowledge of buried item positions is used for digging.
 let row=0,col=0,pass=0;
 while(s.playTime<2400&&!s.ownedTools.includes('B201')){
 const id=s.ownedTools.includes('B105')?'B105':s.ownedTools.includes('B101')?'B101':'hand';
 const p=plot(s);const radius=id==='B105'?26:id==='B101'?15:7;
 const x=5+col*10,y=5+row*10;
 dig(s,id,x,y,5);actions++;tick(s,.11,true);
 for(const f of p.items)if(f.state==='buried'&&exposure(p,f)>=CONFIG.exposure)recover(s,f.uid);
 if(actions%3===0)sift(s,s.ownedTools.includes('B104'));
 for(const f of stored(s)){reward(s,f.uid);if(!first)first=s.playTime;}
 refresh(s);for(const t of ['B101','B102','B104','B105','B201'])if(!s.ownedTools.includes(t)&&buy(s,t))purchases[t]=s.playTime;
 col+=Math.max(1,Math.floor(radius/10));if(col>=36){col=0;pass++;if(pass>=3){pass=0;row++;}}
 const maxrow=id==='hand'?7:id==='B101'?17:27;
 if(row>maxrow){addPlot(s,seed*10000+s.explorationAreas.length,true);row=col=pass=0;}
 }
 results.push({seed,first,firstTool:purchases.B101??null,purchases,earned:s.totalEarnedFN,minutes:s.playTime/60,normalFNPerMin:s.totalEarnedFN/(s.playTime/60),jackpots:s.jackpotHistory.length,stalled:!s.ownedTools.includes('B201'),actions});
}
const mean=(xs:number[])=>Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*10)/10;
const summary={seeds:100,firstFindSeconds:mean(results.map(r=>r.first)),purchaseSeconds:Object.fromEntries(['B101','B102','B104','B105','B201'].map(id=>[id,mean(results.map(r=>r.purchases[id]).filter(Number.isFinite))])),normalFNPerMin:mean(results.map(r=>r.normalFNPerMin)),jackpots:results.reduce((n,r)=>n+r.jackpots,0),stalled:results.filter(r=>r.stalled).length,method:'実際の掘削・露出・回収・選別・購入を使用。0.11秒/5px動作の全面走査。初回のJ候補をB007へ置換・通常追加区画でJ候補を除外。特別依頼R/SRは通常抽選。時間はモデル内の作業時間で実機プレイヤー時間ではない。'};
writeFileSync('docs/balance-results.json',JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary,null,2));
