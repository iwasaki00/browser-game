import {writeFileSync} from 'node:fs';
import {createState,plot,addPlot,buy,refresh,reward,stored,tick,type State} from '../src/engine';
import {collectGravel,handSortGravel,beginGoldWork,goldMotion,feedSluice,goldTick,availableGrains,collectGrain,goldFinds,goldAreaUnlocked,goldPipeline,observeGrain,type GravelBatch} from '../src/gold';
const order=['G101','G102','G103','G105','G110','G201','G203'];
function advance(s:State,seconds:number,idle=false){tick(s,seconds,idle);goldTick(s,seconds);}
function wash(s:State){for(const f of stored(s)){reward(s,f.uid);advance(s,1.4,true);}}
function work(s:State){let steps=0;while(s.goldWork&&steps++<5000){const w=s.goldWork;if(w.mode==='sluice'){advance(s,.2);}else{const distance=Math.min(8,(w.required-w.work)*24);goldMotion(s,distance,distance/24*.6);advance(s,distance/24*.6);}}if(steps>=5000)throw Error('work stalled');}
function retrieve(s:State,b:GravelBatch){for(const f of availableGrains(s,b)){if(s.ownedTools.includes('G105')&&!f.observed&&['G003','G007','G008'].includes(f.id)){observeGrain(s,f.uid);advance(s,.4);}for(let i=0;i<3&&f.state==='batch';i++){collectGrain(s,b.id,f.uid,s.ownedTools.includes('G110')?'G110':'hand');advance(s,.45);}wash(s);}}
function process(s:State,b:GravelBatch){
 const pan=s.ownedTools.includes('G203')?'G203':s.ownedTools.includes('G201')&&(b.amount>=10||!s.ownedTools.includes('G102'))?'G201':s.ownedTools.includes('G102')?'G102':'hand';
 if(pan==='hand'){while(b.handProcessed<b.amount){handSortGravel(s,b);advance(s,1.6);wash(s);}return;}
 if(s.ownedTools.includes('G103')&&pan!=='G203'){while(b.screened<b.amount){beginGoldWork(s,b.id,'G103');advance(s,1,true);work(s);retrieve(s,b);}}
 if(pan==='G203'){feedSluice(s,b.id);advance(s,1,true);work(s);retrieve(s,b);}
 else while(b.processed<b.amount){if(!beginGoldWork(s,b.id,pan))throw Error('pan could not begin');advance(s,1,true);work(s);retrieve(s,b);}
 // Tailings keep their original IDs and capture ranks. At most four complete additional passes.
 for(let pass=0;pass<Math.ceil(b.amount/4)*4;pass++){
  if(!b.contents.some(uid=>{const f=goldFinds(s).find(f=>f.uid===uid);return f?.state==='batch'&&!b.separated.includes(uid);}))break;
  const tailTool=s.ownedTools.includes('G102')?'G102':pan;if(!beginGoldWork(s,b.id,tailTool))break;advance(s,1,true);work(s);retrieve(s,b);
 }
 retrieve(s,b);
}
function run(seed:number){
 const s=createState(seed);s.discoveredTreasures.B001={count:20,first:'',best:0,locations:[],tools:[]};addPlot(s,seed,true,'G-A');
 const purchases:Record<string,number>={},first={seconds:0},metrics:Record<string,{amount:number;seconds:number;earned:number}>={};let serial=0,afterSluice=Infinity,rounds=0;
 const shop=()=>{refresh(s);for(const id of order){if(s.ownedTools.includes(id))continue;if(buy(s,id)){purchases[id]=s.playTime;advance(s,2,true);if(id==='G203')afterSluice=s.playTime+120;}else break;}};
 while(s.playTime<7200&&s.playTime<afterSluice&&rounds++<2000){const before=s.totalEarnedFN;
  for(const site of [...plot(s).goldSites!]){
   const id=s.ownedTools.includes('G101')?'G101':'hand',start=s.playTime,earned=s.totalEarnedFN;let amount=0;
   while(site.collected<site.total-1e-8){const r=collectGravel(s,id,site.x,site.y,24);if(!r.amount)throw Error('collection stopped');amount+=r.amount;advance(s,1.2);wash(s);if(!first.seconds&&s.totalEarnedFN)first.seconds=s.playTime;shop();}
   for(const b of s.gravelBatches??[])if(b.plotId===plot(s).id&&b.siteId===site.id)process(s,b);
   wash(s);if(!first.seconds&&s.totalEarnedFN)first.seconds=s.playTime;shop();const m=metrics[id]??={amount:0,seconds:0,earned:0};m.amount+=amount;m.seconds+=s.playTime-start;m.earned+=s.totalEarnedFN-earned;
   if(s.playTime>=afterSluice)break;
  }
  if(s.totalEarnedFN===before&&s.ownedTools.length===0)throw Error('no hand income');serial++;addPlot(s,seed*10000+serial,true,goldAreaUnlocked(s,'G-B')?'G-B':'G-A');advance(s,4,true);
 }
 return {seed,firstSeconds:first.seconds,purchases,normalFNPerMinute:s.totalEarnedFN/(s.playTime/60),earned:s.totalEarnedFN,seconds:s.playTime,stalled:!s.ownedTools.includes('G203'),jackpots:s.goldStats?.specialSites.length??0,metrics,operations:s.operationMetrics};
}
const results=Array.from({length:100},(_,i)=>run(i+1));
const mean=(values:number[])=>Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10;
const comparisons=[[],['G102'],['G101','G102'],['G101','G103','G102'],['G201'],['G101','G201'],['G203'],['G101','G203','G110']].map(ids=>{
 const rows=Array.from({length:100},(_,i)=>{const s=createState(i+1);s.ownedTools=[...ids];s.equippedTools=[...ids];addPlot(s,i+1,true,'G-B');let amount=0;
  // A reproducible coarse-gravel condition. Contents, qualities and capture ranks remain unchanged.
  for(const site of plot(s).goldSites!){site.coarse=.75;while(site.collected<site.total-1e-8){amount+=collectGravel(s,ids.includes('G101')?'G101':'hand',site.x,site.y,24).amount;advance(s,1.2);wash(s);}for(const b of s.gravelBatches??[])if(b.siteId===site.id)process(s,b);wash(s);}
  return {fnPerMinute:s.totalEarnedFN/(s.playTime/60),unitsPerMinute:amount/(s.playTime/60),finds:s.collectedTreasures.length,seconds:s.playTime};
 });return {equipment:ids,fnPerMinute:mean(rows.map(r=>r.fnPerMinute)),unitsPerMinute:mean(rows.map(r=>r.unitsPerMinute)),finds:mean(rows.map(r=>r.finds)),seconds:mean(rows.map(r=>r.seconds))};
});
const summary={version:'0.3.0',seeds:results.length,firstSeconds:mean(results.map(r=>r.firstSeconds)),purchaseSeconds:Object.fromEntries(order.map(id=>[id,mean(results.map(r=>r.purchases[id]).filter(Number.isFinite))])),normalFNPerMinute:mean(results.map(r=>r.normalFNPerMinute)),stalled:results.filter(r=>r.stalled).length,jackpots:results.reduce((n,r)=>n+r.jackpots,0),pipelineComparison:{cheapC09:goldPipeline(['G101','G103','G102'],.75),largeOnly:goldPipeline(['G201'],.75),sluiceOnly:goldPipeline(['G203'],.75),suppliedSluice:goldPipeline(['G101','G203'],.75)},toolVolumes:Object.fromEntries(order.map(id=>[id,results.reduce((n,r)=>n+Object.entries(r.operations??{}).filter(([key])=>key.includes(':'+id+':')).reduce((m,[,op])=>m+op.amount,0),0)])),method:'砂浜20個実績・FN0から開始。全操作・報酬・購入に通常ロジックを使用。G-A→条件達成後G-B、Jイベント除外。採取ストローク1.2秒、投入1秒、皿の作業単位0.6秒、手選別1.6秒、粒回収0.45秒、洗浄1.4秒、購入2秒、区画移動4秒。各地点を採取し、所有する工程道具で処理。大型皿は10単位以上、スルース購入後120秒まで継続。残渣は固定個体を上限4巡再選別。正確な操作のボットで人間の購入時間を保証しない。'};
writeFileSync('docs/gold-balance-v030.json',JSON.stringify({summary,comparisons,results},null,2));console.log(JSON.stringify({summary,comparisons},null,2));
