import {automationFixture,collectAutomationSand} from './dev-automation';
import {plot,stored,reward,sortSand,tick,type State} from './engine';
import {collectGravel,beginGoldWork,goldMotion,goldTick,availableGrains,collectGrain} from './gold';
import {riverStart,riverPull,riverCapabilities} from './river';
import {machines,auto,enqueueMaterial,setMachineRunning,automationTick,automationReport,liveJobs,type MachineId} from './automation';
export const autoModelTimes={sandAction:.6,riverStart:.5,riverPull:.75,goldLoad:1,goldMotion:.2,precision:.45,wash:1.4,register:.6,start:.4};
export type AutoMode='manual'|'semi'|'combo'|'starved'|'screenLimited';
export function automationBenchmark(seed:number,field:'B'|'R'|'G',mode:AutoMode){
 const combo=mode==='combo',s=automationFixture(seed,field,combo),id:MachineId=field==='B'?'B301':field==='R'?'R301':'G304';let operations=0,seconds=0,stamina=0,processed=0,failures=0;const initial:number[]=[];
 // All comparisons start with an identical, already gathered inventory (combo adds its stated tools).
 if(field==='B')collectAutomationSand(s);
 if(field==='G'){for(const site of plot(s).goldSites!.slice(0,3))for(let n=0;n<4;n++)collectGravel(s,'G101',site.x,site.y,24);}
 s.playerStats.stamina=100;const initialInventory=field==='B'?s.sandBatches.reduce((n,b)=>n+b.cells,0):field==='R'?6:(s.gravelBatches??[]).reduce((n,b)=>n+b.amount,0);const initialIds=field==='B'?s.sandBatches.flatMap(b=>b.items):field==='R'?plot(s).items.slice(0,6).map(f=>f.uid):s.gravelBatches!.flatMap(b=>b.contents);
 const step=(dt:number)=>{seconds+=dt;tick(s,dt,true);if(mode!=='manual')automationTick(s,dt);};
 const act=<T>(fn:()=>T,dt:number)=>{const before=s.playerStats.stamina;const r=fn();operations++;stamina+=Math.max(0,before-s.playerStats.stamina);step(dt);return r;};
 const drain=()=>{for(const b of s.gravelBatches??[])for(const f of availableGrains(s,b))for(let n=0;n<3&&f.state==='batch';n++)act(()=>collectGrain(s,b.id,f.uid,combo?'G204':'hand'),autoModelTimes.precision);for(const f of stored(s))act(()=>reward(s,f.uid),autoModelTimes.wash);};
 if(mode==='manual'){
  if(field==='B'){for(let n=0;n<1000&&s.sandBatches.some(b=>!b.processed);n++){const r=act(()=>sortSand(s,'sieve','B104'),.6);processed+=r.units;drain();if(!r.units)break;}}
  if(field==='R')for(const f of plot(s).items.slice(0,6)){const r=act(()=>riverStart(s,'R104',f.x,f.y,true),.5);if(!r.ok){failures++;continue;}for(let n=0;n<100&&s.riverSession?.uid;n++){const r=act(()=>riverPull(s,70),.75);if(!r.ok){failures++;break;}if(r.recovered)processed++;}drain();}
  if(field==='G')for(const b of s.gravelBatches??[]){for(const tool of ['G103','G203'])for(let n=0;n<100&&(tool==='G103'?b.screened:b.processed)<b.amount-1e-8;n++){act(()=>beginGoldWork(s,b.id,tool),1);for(let k=0;k<1000&&s.goldWork;k++){const w=s.goldWork;if(w.mode==='sluice')step(.2),goldTick(s,.2);else act(()=>goldMotion(s,8,.2),.2);}drain();}processed+=b.processed;}
 }else{
  const sources=field==='B'?s.sandBatches.map(b=>b.id):field==='R'?plot(s).items.slice(0,6).map(f=>f.uid):s.gravelBatches!.map(b=>b.id);const supplied=mode==='starved'?sources.slice(0,1):sources;
  for(const source of supplied){const primary=field==='R'?(combo?'R201':'R104'):field==='G'?(mode==='screenLimited'?'G102':'G203'):'';const tools=field==='R'?(combo?['R104','R110','R206']:['R110']):field==='G'?(combo?['G202','G108','G205']:['G103']):[];act(()=>enqueueMaterial(s,id,source,primary,tools),.6);}
  act(()=>setMachineRunning(s,id,true),.4);
  // A visible-session model, with regular manual unloading. No income comes from ticking itself.
  for(let n=0;n<3600&&liveJobs(s,id).some(j=>j.state!=='failed');n++){step(.2);if(n%10===0)drain();}drain();processed=auto(s).machines[id]!.processed;failures=liveJobs(s,id).filter(j=>j.state==='failed').length;
 }
 const pending=field==='B'?s.sandBatches.reduce((n,b)=>n+Math.max(0,b.cells-(b.screenedUnits??0)),0):field==='R'?plot(s).items.slice(0,6).filter(f=>f.state==='buried').length:s.gravelBatches!.reduce((n,b)=>n+b.amount-b.processed,0);const r=automationReport(s,id);const outputIds=[...s.collectedTreasures];
 return {seed,field,mode,combo,initialInventory,initialIds,operations,processed,stamina,seconds,fn:s.totalEarnedFN,fnPerMinute:s.totalEarnedFN/Math.max(1,seconds)*60,pending,recovered:outputIds.length,outputIds,utilization:mode==='manual'?null:r.utilization,bottleneck:mode==='manual'?'手作業':r.bottleneck,failures,unfinished:liveJobs(s,id).filter(j=>j.state!=='failed').length,jackpots:s.jackpotHistory.length,saveBytes:JSON.stringify(s).length,playerBusySeconds:operations*.6};
}
export function summarizeAutomation(rows:ReturnType<typeof automationBenchmark>[]){return Object.fromEntries((['B','R','G'] as const).map(field=>[field,Object.fromEntries((['manual','semi','combo','starved','screenLimited'] as const).map(mode=>{const group=rows.filter(r=>r.field===field&&r.mode===mode),mean=(key:'operations'|'processed'|'stamina'|'seconds'|'fn'|'fnPerMinute'|'pending'|'recovered'|'saveBytes')=>group.reduce((n,r)=>n+r[key],0)/group.length;const before=rows.filter(r=>r.field===field&&r.mode==='manual'),manualOps=before.reduce((n,r)=>n+r.operations,0)/before.length;return [mode,{runs:group.length,operations:mean('operations'),operationReduction:1-mean('operations')/manualOps,processed:mean('processed'),stamina:mean('stamina'),seconds:mean('seconds'),fn:mean('fn'),fnPerMinute:mean('fnPerMinute'),pending:mean('pending'),recovered:mean('recovered'),saveBytes:mean('saveBytes'),unfinished:group.filter(r=>r.unfinished>0).length,jackpots:group.reduce((n,r)=>n+r.jackpots,0),investmentPaybackMinutes:null,paybackReason:'同じ固定材料だけを比較。継続的な追加採取・追加収入の実測がなく算出不可'}];}))]));}
