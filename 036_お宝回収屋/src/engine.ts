import { CONFIG, income, treasure, tool, weights, combinations } from './data';
import {scanReading,finishQuality,recordRecovery,initializeBatch,batchRemaining,tiny,type SurveyMark,type ScanReading,type SortEvent,type RecoveryEvent} from './tool-value';
import {generateRiver,areaId,beachCount,RIVER_TOOLS,type RiverSession,type RiverMetrics} from './river';
import {logEvent,type GameEvent} from './events';
import type {HandFeedback} from './feedback';
export interface Find { evaluationFN?:number; rewardFN?:number; damageState?:'worn'|'scratched'; areaId?:string; weight?:number; magnetic?:boolean; material?:string; difficulty?:number; obstacle?:boolean; rarity?:string; recoveryOperations?:number; uid:string; id:string; x:number; y:number; depth?:number; plannedRecovery?:boolean; excavationTool?:string; initialQuality?:number; qualityFinalized?:boolean; qualityLoss?:number; damagePrevented?:boolean; recoveryRecorded?:boolean; surveyed?:boolean; quality:number; state:'buried'|'batch'|'stored'|'paid'; tool:string; }
export interface Plot {areaId?:string;  id:string; seed:number; mask:number[]; items:Find[]; surveyMarks?:SurveyMark[]; }
export interface Batch { id:string; plotId:string; items:string[]; processed:boolean; cells:number; screenedUnits?:number; residueWork?:Record<string,number>; allocations?:Record<string,number>; }
export interface State {
 events?:GameEvent[]; riverSession?:RiverSession; riverMetrics?:RiverMetrics; maxStamina?:number; lastScan?:ScanReading; sortHistory?:SortEvent[]; recoveryHistory?:RecoveryEvent[]; handFeedback?:HandFeedback[]; saveVersion:number; playerId:string; currentFN:number; totalEarnedFN:number;
 playerStats:{stamina:number;xp:number[]}; ownedTools:string[]; equippedTools:string[]; quickSlots:string[]; unlockedTools:string[];
 discoveredTreasures:Record<string,{count:number;first:string;best:number;locations:string[];tools:string[]}>;
 explorationAreas:Plot[]; currentPlot:number; exploredPlots:number; retainedFinds:Find[]; sandSampled:boolean;
 collectedTreasures:string[]; completedContracts:string[]; activeContracts:string[]; jackpotHistory:string[]; sandBatches:Batch[];
 revenueHistory:{time:number;fn:number;jackpot:boolean;area?:string;item?:string}[]; purchases:{id:string;time:number;before:number;predicted:number}[];
 playTime:number; lastSavedAt:string; digs:number; cells:number; settings:{sound:boolean;short:boolean};
}
export function rng(seed:number) { return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
// The surface position is independent of the buried depth and rarity draw.
export function surfaceY(seed:number,index:number,tutorial=false) {
 return tutorial&&index<6?150+(index%2)*55:30+Math.floor(rng(seed^Math.imul(index+1,7919))()*22)*10;
}
export function generate(seed:number,tutorial=false,noJackpot=false):Plot {
 const r=rng(seed),items:Find[]=[];const count=10+Math.floor(r()*5);
 const groups:Record<string,string[]>={C:['B001','B002','B003','B004'],U:['B005','B007'],R:['B009'],SR:['B011'],J:noJackpot?[]:['B012']};
 for(let i=0;i<count;i++) {
  let id:string;
  if(tutorial&&i<6) id=['B004','B003','B004','B003','B001','B002'][i];
  else {
   const options=Object.keys(groups).filter(k=>groups[k].length);let n=r()*options.reduce((s,k)=>s+weights[k],0);let k=options[0];
   for(const key of options){n-=weights[key];if(n<0){k=key;break;}}
   id=groups[k][Math.floor(r()*groups[k].length)];
  }
  const x=tutorial&&i<6?30+i*60:15+Math.floor(r()*33)*10;
  const depth=tutorial&&i<6?(i===0?20:25+(i%2)*20):(i<6?25+Math.floor(r()*4)*10:25+Math.floor(r()*24)*10);
  const quality=tutorial?1:0.8+r()*.4;
  items.push({uid:`${seed}:${i}`,id,x,y:surfaceY(seed,i,tutorial),depth,quality,initialQuality:quality,state:'buried',tool:'hand'});
 }
 return {id:`BA-${seed}`,seed,mask:Array(1008).fill(0),items};
}
export function createState(seed=Date.now()>>>0):State {
 return {handFeedback:[],saveVersion:2,playerId:`finder-${seed}`,currentFN:0,totalEarnedFN:0,playerStats:{stamina:100,xp:[0,0,0,0]},ownedTools:[],equippedTools:[],quickSlots:['hand','','',''],unlockedTools:[],discoveredTreasures:{},explorationAreas:[generate(seed,true)],currentPlot:0,exploredPlots:1,retainedFinds:[],sandSampled:false,collectedTreasures:[],completedContracts:[],activeContracts:[],jackpotHistory:[],sandBatches:[],revenueHistory:[],purchases:[],playTime:0,lastSavedAt:'',digs:0,cells:0,settings:{sound:false,short:false}};
}
export const plot=(s:State)=>s.explorationAreas[0];
const allFinds=(s:State)=>[...plot(s).items,...s.retainedFinds];
export function refresh(s:State) {
 const n=s.collectedTreasures.length;
 const conditions:Record<string,boolean>={B101:n>=2,B102:n>=5,B104:n>=8||s.sandSampled||s.sandBatches.length>0,B105:s.exploredPlots>=3||n>=15,B201:n>=20};
 if(beachCount(s)>=10)for(const id of RIVER_TOOLS)conditions[id]=true;
 const added=Object.keys(conditions).filter(id=>conditions[id]&&!s.unlockedTools.includes(id));s.unlockedTools.push(...added);
 for(const f of allFinds(s))if(treasure(f.id).contractOnly&&f.state!=='paid'&&!s.activeContracts.includes(f.uid))s.activeContracts.push(f.uid);
 return added;
}
export function capacity(ids:string[]) {const has=(id:string)=>ids.includes(id);return {search:has('B102')?14:has('B201')?18:8,recover:has('B105')?14:has('B101')?9:6,sort:has('B104')?12:6,transport:10};}
export function throughput(ids:string[]) { return Math.min(...Object.values(capacity(ids))); }
export const combos=(ids:string[])=>combinations.filter(c=>c.tools.every(t=>ids.includes(t)));
export function buy(s:State,id:string) {
 const t=tool(id);refresh(s);
 if(!t||t.implementationStatus!=='available'||!s.unlockedTools.includes(id)||s.ownedTools.includes(id)||s.currentFN<t.priceFN)return false;
 const before=rate(s).normal;s.currentFN-=t.priceFN;s.ownedTools.push(id);const slot=s.quickSlots.indexOf('');if(slot>=0)s.quickSlots[slot]=id;
 s.equippedTools=s.quickSlots.filter(x=>x&&x!=='hand');s.purchases.push({id,time:s.playTime,before,predicted:throughput(s.equippedTools)});logEvent(s,'道具購入',id);return true;
}
export const MAX_DEPTH=280;
export function depthAt(p:Plot,x:number,y:number){if(x<0||x>=360||y<0||y>=280)return 0;return (p.mask[Math.floor(y/10)*36+Math.floor(x/10)]??0)*MAX_DEPTH;}
export const reachedFind=(p:Plot,f:Find)=>depthAt(p,f.x,f.y)+1e-7>=(f.depth??f.y);
export function exposure(p:Plot,f:Find) {
 let n=0,total=0;const depth=f.depth??f.y;
 for(let y=Math.floor((f.y-8)/10);y<=Math.floor((f.y+8)/10);y++)for(let x=Math.floor((f.x-8)/10);x<=Math.floor((f.x+8)/10);x++){
  if(x>=0&&x<36&&y>=0&&y<28){total++;n+=Math.max(0,Math.min(1,(p.mask[y*36+x]*280-depth+12)/20));}
 }
 return total&&reachedFind(p,f)?n/total:0;
}
function cost(s:State,id:string) {s.playerStats.stamina=Math.max(0,s.playerStats.stamina-(id==='hand'?5:tool(id)!.staminaCost));s.playerStats.xp[3]++;}
const DIG_LIMITS:Record<string,number>={hand:80,B102:80,B101:180,B105:280};
export const diggingLimit=(id:string)=>DIG_LIMITS[id]??0;
export function dig(s:State,id:string,x:number,y:number,dx:number) {
 if((id!=='hand'&&!s.ownedTools.includes(id))||id==='B201'||id==='B104'||Math.abs(dx)<2||x<0||x>=360||y<0||y>=280)return 0;
 if(!diggingLimit(id))return 0;
 if(areaId(s)!=='B-A')return 0;
 const p=plot(s),maxDepth=diggingLimit(id),limit=maxDepth/MAX_DEPTH,radius=id==='B105'?26:id==='B101'?15:id==='B102'?34:7,ry=id==='B102'?7:radius;
 const low=s.playerStats.stamina<10?.5:1;let removed=0;
 for(let yy=Math.max(0,Math.floor((y-ry-4)/10));yy<=Math.min(27,Math.floor((y+ry+4)/10));yy++)for(let xx=Math.max(0,Math.floor((x-radius-4)/10));xx<=Math.min(35,Math.floor((x+radius+4)/10));xx++){
  const i=yy*36+xx;
  if(p.mask[i]>=limit||((xx*10+5-x)/(radius+4))**2+((yy*10+5-y)/(ry+4))**2>1)continue;
  const currentDepth=p.mask[i]*MAX_DEPTH;
  const strokeDepth=(id==='hand'?.45:.85)*low*(1+Math.min(.15,Math.floor(s.playerStats.xp[0]/CONFIG.xpPerLevel)*.01))*maxDepth;
  const nextDepth=Math.min(maxDepth,currentDepth+strokeDepth);
  p.mask[i]=nextDepth/MAX_DEPTH;removed+=(nextDepth-currentDepth)/maxDepth;
 }
 if(!removed)return 0;
 cost(s,id);s.digs++;s.cells+=removed;s.playerStats.xp[0]+=removed;s.playerStats.xp[1]+=.5;
 for(const f of p.items)if(f.state==='buried'&&!f.qualityFinalized&&exposure(p,f)>=CONFIG.exposure)finishQuality(s,f,id);
 if(id==='B101'||id==='B105') {
  s.sandSampled=true;
  let b=s.sandBatches.find(b=>b.plotId===p.id&&!b.processed&&b.cells<CONFIG.batchCells);
  if(!b){b={id:`${p.id}:batch-${s.digs}`,plotId:p.id,items:[],processed:false,cells:0};s.sandBatches.push(b);}
  b.cells+=removed;
  for(const f of p.items)if(f.state==='buried'&&exposure(p,f)>=CONFIG.exposure&&['B001','B002','B003','B004'].includes(f.id)){finishQuality(s,f,id);f.state='batch';f.tool=id;b.items.push(f.uid);b.allocations??={};b.allocations[f.uid]=b.cells;}
 }
 refresh(s);return removed;
}
export function scan(s:State,x:number,y:number){if(!s.ownedTools.includes('B201'))return {strength:0,band:'未装備',depthHint:'',character:''};cost(s,'B201');s.playerStats.xp[1]++;return scanReading(s,x,y);}
export function detect(s:State,x:number,y:number){return scan(s,x,y).strength;}
export function recover(s:State,uid:string,usedTool='hand') {
 const p=plot(s),f=p.items.find(f=>f.uid===uid);
 if(areaId(s)!=='B-A')return false;
 if(!f||f.state!=='buried'||exposure(p,f)<CONFIG.exposure||stored(s).length>=CONFIG.capacity)return false;
 finishQuality(s,f,usedTool);f.state='stored';f.tool=usedTool;recordRecovery(s,f);s.playerStats.xp[2]++;return true;
}
export interface SortResult {units:number;found:number;method:'hand'|'sieve';}
export function sortSand(s:State,method:'hand'|'sieve'):SortResult {
 const result:SortResult={units:0,found:0,method};if(method==='sieve'&&!s.ownedTools.includes('B104'))return result;
 let budget=method==='sieve'?15:3;
 for(const batch of s.sandBatches){if(batch.processed||budget<1e-8)continue;const r=sortBatch(s,batch,method,budget);result.units+=r.units;result.found+=r.found;budget-=r.units;}
 if(result.units>0){const stamina=method==='sieve'?4:6;s.playerStats.stamina=Math.max(0,s.playerStats.stamina-stamina);s.playerStats.xp[2]+=result.found;s.playerStats.xp[3]++;(s.sortHistory??=[]).push({time:s.playTime,...result,stamina});}
 return result;
}
function sortBatch(s:State,b:Batch,method:'hand'|'sieve',capacity:number):SortResult {
 const result:SortResult={units:0,found:0,method};initializeBatch(b);
 let budget=capacity;const beforeResidue=new Set(Object.keys(b.residueWork!));
 const amount=Math.min(budget,Math.max(0,b.cells-b.screenedUnits!));b.screenedUnits!+=amount;budget-=amount;result.units+=amount;
 const finds=allFinds(s);const due=b.items.filter(uid=>b.residueWork![uid]===undefined&&b.screenedUnits!+1e-8>=b.allocations![uid]);
 for(const uid of due){const f=finds.find(f=>f.uid===uid);if(!f||f.state!=='batch'){b.items=b.items.filter(x=>x!==uid);continue;}
  if((method==='hand'&&tiny(f))||stored(s).length>=CONFIG.capacity){const work=Math.min(1,amount/Math.max(1,due.length));if(work>0){b.residueWork![uid]=work;}continue;}
  finishQuality(s,f,f.tool);f.state='stored';if(method==='sieve')f.tool='B104';recordRecovery(s,f);result.found++;b.items=b.items.filter(x=>x!==uid);
 }
 for(const uid of Object.keys(b.residueWork!)){if(budget<=0)break;if(method==='hand'&&!beforeResidue.has(uid))continue;
  const f=finds.find(f=>f.uid===uid);if(!f||f.state!=='batch'){delete b.residueWork![uid];b.items=b.items.filter(x=>x!==uid);continue;}
  if(stored(s).length>=CONFIG.capacity)break;const n=Math.min(budget,b.residueWork![uid]);b.residueWork![uid]-=n;budget-=n;result.units+=n;
  if(b.residueWork![uid]<1e-8){delete b.residueWork![uid];finishQuality(s,f,f.tool);f.state='stored';if(method==='sieve')f.tool='B104';recordRecovery(s,f);result.found++;b.items=b.items.filter(x=>x!==uid);}
 }
 b.processed=batchRemaining(b)<1e-8&&b.items.length===0;
 return result;
}
export function sift(s:State,withSieve:boolean){return sortSand(s,withSieve?'sieve':'hand').found;}
export const stored=(s:State)=>allFinds(s).filter(f=>f.state==='stored');
export function reward(s:State,uid:string) {
 const f=stored(s).find(f=>f.uid===uid);if(!f||s.collectedTreasures.includes(uid))return 0;
 const t=treasure(f.id),fn=income[f.id]??0;f.evaluationFN=Math.round(t.baseValueFN*f.quality);f.rewardFN=fn;f.state='paid';s.collectedTreasures.push(uid);s.currentFN+=fn;s.totalEarnedFN+=fn;
 const d=s.discoveredTreasures[f.id]??={count:0,first:new Date().toISOString(),best:0,locations:[],tools:[]};d.count++;d.best=Math.max(d.best,Math.round(t.baseValueFN*f.quality));
 const location=f.areaId??(f.id.startsWith('R')?'R-A':'B-A');if(!d.locations.includes(location))d.locations.push(location);if(!d.tools.includes(f.tool))d.tools.push(f.tool);
 if(t.contractOnly){s.completedContracts.push(uid);s.activeContracts=s.activeContracts.filter(x=>x!==uid);}if(f.id==='B012')s.jackpotHistory.push(uid);
 s.revenueHistory.push({time:s.playTime,fn,jackpot:f.id==='B012',area:location,item:f.id});logEvent(s,'報酬獲得',`${f.id} / ${fn} FN`);s.retainedFinds=s.retainedFinds.filter(f=>f.state!=='paid');refresh(s);return fn;
}
export function addPlot(s:State,seed=Date.now()>>>0,noJackpot=false,area=areaId(s)) {
 const old=plot(s);
 s.retainedFinds=allFinds(s).filter(f=>f.state==='stored'||f.state==='batch');
 s.sandSampled ||= s.sandBatches.length>0;s.sandBatches=s.sandBatches.filter(b=>!b.processed);
 s.handFeedback=[];delete s.lastScan;s.exploredPlots++;delete s.riverSession;const next=area.startsWith('R-')?generateRiver(seed,area):generate(seed,false,noJackpot);
 next.id=`${area}-${seed}-${s.exploredPlots}`;next.items.forEach((f,i)=>f.uid=`${s.playerId}:${s.exploredPlots}:${seed}:${i}`);
 s.explorationAreas=[next];s.currentPlot=0;
 s.activeContracts=s.activeContracts.filter(uid=>s.retainedFinds.some(f=>f.uid===uid));refresh(s);
}
export function tick(s:State,seconds:number,idle:boolean) {s.playTime+=seconds;if(idle)s.playerStats.stamina=Math.min(maxStamina(s),s.playerStats.stamina+seconds*CONFIG.regen);}
export function rate(s:State) {const rows=s.revenueHistory.filter(r=>r.time>s.playTime-60);return {normal:rows.filter(r=>!r.jackpot).reduce((n,r)=>n+r.fn,0),total:rows.reduce((n,r)=>n+r.fn,0),finds:rows.length};}

export const maxStamina=(s:State)=>s.maxStamina??100+Math.floor(s.playerStats.xp[3]/CONFIG.xpPerLevel)*2;
