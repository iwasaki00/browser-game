import {createState,addPlot,plot,refresh,buy,dig,exposure,recover,sortSand,stored,reward,tick} from './engine';
import {collectGravel,beginGoldWork,goldMotion,goldTick,feedSluice,availableGrains,collectGrain} from './gold';
import {riverStart,riverPull} from './river';
import {auto,purchaseMachine,enqueueMaterial,setMachineRunning,automationTick,cancelJob} from './automation';
import {createLine,configureLine,setLineRunning,lineTick,lineMachine,lineStocks,lineReport,stagePlan,type Field} from './lines';
import {recoveryCount} from './ledger';
export type LineMode='A'|'B'|'C'|'D';
export const lineModelTimes={dig:.32,recover:.45,sort:.6,cast:.5,pull:.75,gather:1.2,load:.6,shake:.2,precision:.45,wash:1.4,register:.6,move:2};
// Continuous, public-information policy. All earnings use normal collection and reward paths.
export function lineBenchmark(seed:number,field:Field,mode:LineMode,horizon=900){
 const s=createState(seed),improved=mode==='D',machine=lineMachine[field];s.currentFN=100000;s.collectedTreasures=Array.from({length:20},(_,i)=>'model-prior-'+i);s.discoveredTreasures.B001={count:20,first:'',best:0,locations:['B-A'],tools:['hand']};refresh(s);
 const base=field==='B'?['B101','B104','B105']:field==='R'?['R104','R110','R106']:['G101','G103','G102','G203','G110'];
 const extra=field==='B'?['B208','B108','B110']:field==='R'?['R201','R206','R203','R101']:['G106','G202','G108','G205','G204'];
 for(const id of [...base,...(improved?extra:[])]){if(!buy(s,id))throw Error('モデル購入失敗 '+id);}
 if(mode!=='A'&&!purchaseMachine(s,machine))throw Error('モデル設備購入失敗');
 const tools=field==='B'?[improved?'B208':'B104',...(improved?['B108','B110']:[])]:field==='R'?(improved?['R201','R104','R110','R206']:['R104','R110']):[improved?'G202':'G103','G203',...(improved?['G108','G205']:[])];s.equippedTools=tools;
 const area=field==='B'?'B-A':field==='R'?'R-B':'G-B';addPlot(s,seed,true,area);const cost=100000-s.currentFN;
 if(mode==='C'||improved){createLine(s,field);const l=s.lines![field]!;const stages=stagePlan(field,field==='G'&&improved).map(id=>l.stages.find(x=>x.id===id)??{id,input:'',output:'',mode:'auto' as const,paused:false,elapsed:0,active:0,blocked:0,processed:0,manualOperations:0});const result=configureLine(s,field,{primary:field==='B'?(improved?'B208':'B104'):field==='R'?(improved?'R201':'R104'):'G203',tools:field==='B'?[improved?'B208':'B104']:tools.filter(x=>!['B108','B110','G108'].includes(x)),support:improved?(field==='B'?['B108','B110']:field==='R'?['R101']:['G108']):[],stages});if(!result.ok)throw Error(result.reason);setLineRunning(s,field,true);}else if(mode==='B')setMachineRunning(s,machine,true);
 let seconds=0,operations=0,stamina=0,gathered=0,processed=0,failures=0,serial=0,stroke=0,idle=0,nextTrace=30;const seen=new Set<string>(),retried=new Set<string>(),trace:{seconds:number;fn:number}[]=[];
 const measureProcessed=()=>field==='B'?s.sandBatches.reduce((n,b)=>n+(b.screenedUnits??0),0):field==='G'?(s.gravelBatches??[]).reduce((n,b)=>n+b.processed,0):recoveryCount(s)-20;
 const step=(duration:number)=>{let left=Math.min(duration,horizon-seconds);while(left>1e-8){const dt=Math.min(.1,left),before=measureProcessed();automationTick(s,dt);lineTick(s,dt);goldTick(s,dt);processed+=Math.max(0,measureProcessed()-before);tick(s,dt,true);seconds+=dt;left-=dt;}if(seconds>=nextTrace){trace.push({seconds,fn:s.totalEarnedFN});nextTrace+=30;}};
 const act=(fn:()=>unknown,duration:number)=>{const before=s.playerStats.stamina,p=measureProcessed();fn();processed+=Math.max(0,measureProcessed()-p);stamina+=Math.max(0,before-s.playerStats.stamina);operations++;step(duration);};
 const move=()=>act(()=>{addPlot(s,seed+10000*(++serial),true,area);stroke=0;},lineModelTimes.move);
 while(seconds<horizon-1e-7){
  const wash=stored(s);if(wash.length>=4){act(()=>reward(s,wash[0].uid),lineModelTimes.wash);continue;}
  if(field==='G'){const ready=(s.gravelBatches??[]).reduce((n,b)=>n+availableGrains(s,b).length,0);const b=s.gravelBatches?.find(b=>availableGrains(s,b).length>0);if(b&&ready>=4){const f=availableGrains(s,b)[0];act(()=>collectGrain(s,b.id,f.uid,improved?'G204':'G110'),lineModelTimes.precision);continue;}}
  const failed=auto(s).jobs.find(j=>j.state==='failed');if(failed){failures++;const source=failed.source,reason=failed.reason;cancelJob(s,failed.id);if(field==='R'&&!retried.has(source)&&/磁|障害|隙間/.test(reason)){retried.add(source);act(()=>enqueueMaterial(s,machine,source,improved?'R203':'R106',['R104','R110']),.6);}continue;}
  if(field==='B'){
   const f=plot(s).items.find(f=>f.state==='buried'&&exposure(plot(s),f)>=.7);if(f&&wash.length<24){act(()=>recover(s,f.uid),.45);continue;}
   const raw=s.sandBatches.filter(b=>!b.processed&&!b.automationJob).reduce((n,b)=>n+b.cells-(b.screenedUnits??0),0);
   if((mode==='A'||raw>240)&&raw>0){act(()=>sortSand(s,'sieve',improved?'B208':'B104'),.6);continue;}
   if(mode==='B'){const b=s.sandBatches.find(b=>!b.processed&&!b.automationJob);if(b&&enqueueMaterial(s,machine,b.id).ok){operations++;step(.6);continue;}}
   if(stroke>=504){move();continue;}const x=5+(stroke%18)*20,y=5+Math.floor(stroke/18)%14*20;stroke++;act(()=>{gathered+=dig(s,'B105',x,y,20);},.32);
  }else if(field==='R'){
   if(mode==='A'&&s.riverSession?.uid){act(()=>riverPull(s,70),.75);continue;}
   const f=plot(s).items.find(f=>f.state==='buried'&&!seen.has(f.uid));if(f){seen.add(f.uid);act(()=>{if(mode==='A'){const r=riverStart(s,'R104',f.x,f.y,true);if(!r.ok){failures++;riverStart(s,'R106',f.x,f.y,true);}}else enqueueMaterial(s,machine,f.uid,improved?'R201':'R104',improved?['R104','R110','R206']:['R110']);gathered++;},.6);continue;}
   if(!auto(s).jobs.some(j=>j.field==='R'&&j.state!=='failed')){move();continue;}idle+=.5;step(.5);
  }else{
   if(s.goldWork&&s.goldWork.mode!=='sluice'){act(()=>goldMotion(s,8,.2),.2);continue;}
   const raw=(s.gravelBatches??[]).filter(b=>!b.automationJob&&b.processed<b.amount&&!s.sluiceFeed?.includes(b.id)&&b.id!==s.goldWork?.batchId);
   const amount=raw.reduce((n,b)=>n+b.amount-b.processed,0);
   if((mode==='A'||amount>240)&&raw.length&&!s.goldWork){const b=raw[0];act(()=>b.screened<b.amount?beginGoldWork(s,b.id,improved?'G202':'G103'):feedSluice(s,b.id),.6);continue;}
   if(mode==='B'&&raw.length&&enqueueMaterial(s,machine,raw[0].id,'G203',['G103']).ok){operations++;step(.6);continue;}
   if(amount>600){idle+=.5;step(.5);continue;}
   const site=plot(s).goldSites?.find(x=>x.collected<x.total-1e-8);if(!site){move();continue;}act(()=>{gathered+=collectGravel(s,improved?'G106':'G101',site.x,site.y,24).amount;},1.2);
  }
 }
 const line=s.lines?.[field],report=line?lineReport(s,line):null,stocks=line?lineStocks(s,line):null;trace.push({seconds,fn:s.totalEarnedFN});
 return {version:'0.6.0',seed,field,mode,initialFN:100000,seconds,operations,gathered,processed,recovered:recoveryCount(s)-20,fn:s.totalEarnedFN,fnPerMinute:s.totalEarnedFN/seconds*60,stamina,cost,tools:s.ownedTools,equipment:mode==='A'?[]:[machine],input:stocks?.input??0,middle:stocks?.middle??0,output:(stocks?.output??stored(s).length)+(stocks?.concentrate??0)+(stocks?.hopper??0),pending:field==='B'?s.sandBatches.reduce((n,b)=>n+Math.max(0,b.cells-(b.screenedUnits??0)),0):field==='G'?(s.gravelBatches??[]).reduce((n,b)=>n+b.amount-b.processed,0):auto(s).jobs.length,utilization:report?.stages.map(x=>({stage:x.id,value:x.utilization}))??[],bottleneck:report?.bottleneck??(mode==='A'?'手動工程':'個別設備'),evidence:report?.evidence??'ライン計測なし',failures,idle,stalled:s.totalEarnedFN===0&&idle>seconds*.95,jackpots:s.jackpotHistory.length,saveBytes:new TextEncoder().encode(JSON.stringify(s)).length,trace};
}
export type LineTrial=ReturnType<typeof lineBenchmark>;
export function summarizeLines(rows:LineTrial[]){return (['B','R','G'] as const).flatMap(field=>(['A','B','C','D'] as const).map(mode=>{const group=rows.filter(x=>x.field===field&&x.mode===mode),base=rows.filter(x=>x.field===field&&x.mode==='A'),mean=(xs:LineTrial[],key:'operations'|'fnPerMinute'|'cost'|'processed'|'pending'|'stamina'|'recovered'|'input'|'middle'|'output')=>xs.reduce((n,x)=>n+x[key],0)/Math.max(1,xs.length),extraRate=mean(group,'fnPerMinute')-mean(base,'fnPerMinute'),extraCost=mean(group,'cost')-mean(base,'cost');return {field,mode,runs:group.length,operations:mean(group,'operations'),operationReduction:1-mean(group,'operations')/Math.max(1,mean(base,'operations')),fnPerMinute:mean(group,'fnPerMinute'),processed:mean(group,'processed'),pending:mean(group,'pending'),stamina:mean(group,'stamina'),recovered:mean(group,'recovered'),input:mean(group,'input'),middle:mean(group,'middle'),output:mean(group,'output'),cost:mean(group,'cost'),extraFNPerMinute:extraRate,paybackModelMinutes:extraCost>0&&extraRate>0?extraCost/extraRate:null,paybackReason:extraCost>0&&extraRate>0?'測定期間の追加FN/分が継続する仮定による外挿。期間内回収の実測ではない':'追加収益なし、または比較基準。投資回収は算出しない',stalled:group.filter(x=>x.stalled).length,jackpots:group.reduce((n,x)=>n+x.jackpots,0)};}));}
