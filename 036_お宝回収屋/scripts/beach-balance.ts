import {writeFileSync} from 'node:fs';
import {createState,plot,dig,scan,recover,reward,stored,sortSand,buy,refresh,addPlot,tick,depthAt} from '../src/engine';
import {BEACH_ADDED,beachProfiles,sieveTool} from '../src/beach-tools';import {compareBeach} from '../src/dev-beach';
import {tools,combinations,VERSION} from '../src/data';
const order=['B101','B102','B104','B105','B201',...BEACH_ADDED];
const runs=[];
for(let seed=1;seed<=100;seed++){if(seed%10===0)console.error('BEACH progression seed '+seed+'/100');
 const s=createState(seed);for(const f of plot(s).items)if(f.id==='B012')f.id='B007';const purchases:Record<string,number>={},uses:Record<string,number>={};let first=0,fourth=0,fifth=0,stamina=0,step=0;
 const act=(id:string,x:number,y:number)=>{uses[id]=(uses[id]??0)+1;const before=s.playerStats.stamina;if(beachProfiles[id]?.kind==='探知')scan(s,x,y,id);else if(sieveTool(id))sortSand(s,'sieve',id);else if(beachProfiles[id]?.limit)dig(s,id,x,y,5);else if(id==='B109'){const f=plot(s).items.find(f=>f.state==='buried'&&Math.hypot(f.x-x,f.y-y)<20);if(f)recover(s,f.uid,id);}stamina+=before-s.playerStats.stamina;};
 while(s.playTime<36000&&s.ownedTools.length<20){const digger=s.ownedTools.includes('B302')?'B302':s.ownedTools.includes('B203')?'B203':s.ownedTools.includes('B105')?'B105':s.ownedTools.includes('B101')?'B101':'hand';
  const row=Math.floor(step/18)%14,x=s.exploredPlots===1&&!first?30:5+(step%18)*20,y=s.exploredPlots===1&&!first?150:5+row*20;act(digger,x,y);tick(s,.32,false);
  for(const f of plot(s).items)if(f.state==='buried'&&recover(s,f.uid,s.ownedTools.includes('B109')?'B109':digger))tick(s,.45,true);
  if(step%3===0){const id=s.ownedTools.includes('B208')?'B208':s.ownedTools.includes('B104')?'B104':'hand';if(id==='hand')sortSand(s,'hand');else act(id,x,y);tick(s,.6,false);}
  for(const f of stored(s)){reward(s,f.uid);tick(s,1.4,true);if(!first)first=s.playTime;}
  refresh(s);for(const id of order)if(!s.ownedTools.includes(id)&&buy(s,id)){purchases[id]=s.playTime;tick(s,2,true);uses[id]??=0;
   // Try each purchased tool on the current visible grid; support tools act through their equipped slots.
   s.equippedTools=['B105','B104','B108'].filter(t=>s.ownedTools.includes(t));if(['B209','B110'].includes(id))s.equippedTools=[id,'B201','B203','B208'].filter(t=>s.ownedTools.includes(t));act(id,x,y);}
  const depth=depthAt(plot(s),x,y);if(depth>280&&!fourth)fourth=s.playTime;if(depth>420&&!fifth)fifth=s.playTime;
  step++;if(step%18===0)tick(s,.5,true);if(step%(18*14*3)===0){addPlot(s,seed*100000+s.exploredPlots,true);tick(s,4,true);}
 }
 // Reach each deep layer by continuing the same public grid with the purchased tool.
 for(const id of ['B203','B302'])if(s.ownedTools.includes(id)){addPlot(s,seed*100000+s.exploredPlots,true);for(let n=0;n<16;n++){act(id,185,155);tick(s,.32,false);const depth=depthAt(plot(s),185,155);if(depth>280&&!fourth)fourth=s.playTime;if(depth>420&&!fifth)fifth=s.playTime;}}
 runs.push({seed,first,fourth,fifth,purchases,uses,stamina,earned:s.totalEarnedFN,seconds:s.playTime,fnPerMinute:s.totalEarnedFN/s.playTime*60,stalled:s.ownedTools.length<20,jackpots:s.jackpotHistory.length});
}
const mean=(xs:number[])=>+(xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length)).toFixed(2);
const configs=[['B302'],['B207','B104'],['B105','B104','B108'],['B103','B208'],['B107','B106'],['B206','B106'],['B201','B202'],['B205','B209']];
const comparisons=['surface','bulk','precision','natural'].map(condition=>{const data=Array.from({length:100},(_,i)=>compareBeach(i+1,configs,condition as 'surface',condition==='natural'?6:3));return {condition,configurations:configs.map((tools,i)=>({tools,...Object.fromEntries(['uses','excavation','maxDepth','area','stamina','finds','quality','processed','sortCalls','fn','seconds','fnPerMinute'].map(key=>[key,mean(data.map(d=>d.results[i][key as 'uses']))]))})),runs:data};});
const summary={version:VERSION,seeds:100,firstSeconds:mean(runs.map(r=>r.first)),fourthSeconds:mean(runs.map(r=>r.fourth)),fifthSeconds:mean(runs.map(r=>r.fifth)),purchases:Object.fromEntries(order.map(id=>[id,{seconds:mean(runs.map(r=>r.purchases[id]).filter(Number.isFinite)),success:runs.filter(r=>Number.isFinite(r.purchases[id])).length,uses:runs.reduce((n,r)=>n+(r.uses[id]??0),0)}])),fnPerMinute:mean(runs.map(r=>r.fnPerMinute)),stamina:mean(runs.map(r=>r.stamina)),stalled:runs.filter(r=>r.stalled).length,jackpots:runs.reduce((n,r)=>n+r.jackpots,0),method:'FN0・通常購入・J除外。20px格子を3巡して区画更新。1掘削0.32秒、選別0.6秒、回収0.45秒、洗浄1.4秒、購入2秒、移動4秒。上限600分。初回は公開ガイド30,150をなぞり、その後20px格子。最初は旧チュートリアル、次区画から深層。所持全20道具を目指し、購入直後の1試行も記録。補助道具は対応作業へ装備。深度の最終確認は公開中心座標の同じ穴で行う。時間は模擬操作で実プレイではない。'};
writeFileSync('docs/beach-balance-v040.json',JSON.stringify({summary,runs,comparisons},null,2));
writeFileSync('docs/tool-master-audit-v040.json',JSON.stringify({version:VERSION,total:tools.length,added:BEACH_ADDED,tools:tools.map(t=>({...t,performance:beachProfiles[t.id]??null,recipes:combinations.filter(c=>c.tools.includes(t.id)).map(c=>c.id)})),combinations},null,2));console.log(JSON.stringify({summary,comparisons:comparisons.map(c=>({condition:c.condition,results:c.configurations}))},null,2));
