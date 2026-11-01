import { CONFIG, income, treasure, tool, weights, combinations } from './data';
export interface Find { uid:string; id:string; x:number; y:number; depth?:number; quality:number; state:'buried'|'batch'|'stored'|'paid'; tool:string; }
export interface Plot { id:string; seed:number; mask:number[]; items:Find[]; }
export interface Batch { id:string; plotId:string; items:string[]; processed:boolean; cells:number; }
export interface State {
 saveVersion:number; playerId:string; currentFN:number; totalEarnedFN:number;
 playerStats:{stamina:number;xp:number[]}; ownedTools:string[]; equippedTools:string[]; quickSlots:string[]; unlockedTools:string[];
 discoveredTreasures:Record<string,{count:number;first:string;best:number;locations:string[];tools:string[]}>;
 explorationAreas:Plot[]; currentPlot:number; exploredPlots:number; retainedFinds:Find[]; sandSampled:boolean;
 collectedTreasures:string[]; completedContracts:string[]; activeContracts:string[]; jackpotHistory:string[]; sandBatches:Batch[];
 revenueHistory:{time:number;fn:number;jackpot:boolean}[]; purchases:{id:string;time:number;before:number;predicted:number}[];
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
  items.push({uid:`${seed}:${i}`,id,x,y:surfaceY(seed,i,tutorial),depth,quality:tutorial?1:0.8+r()*0.4,state:'buried',tool:'hand'});
 }
 return {id:`BA-${seed}`,seed,mask:Array(1008).fill(0),items};
}
export function createState(seed=Date.now()>>>0):State {
 return {saveVersion:2,playerId:`finder-${seed}`,currentFN:0,totalEarnedFN:0,playerStats:{stamina:100,xp:[0,0,0,0]},ownedTools:[],equippedTools:[],quickSlots:['hand','','',''],unlockedTools:[],discoveredTreasures:{},explorationAreas:[generate(seed,true)],currentPlot:0,exploredPlots:1,retainedFinds:[],sandSampled:false,collectedTreasures:[],completedContracts:[],activeContracts:[],jackpotHistory:[],sandBatches:[],revenueHistory:[],purchases:[],playTime:0,lastSavedAt:'',digs:0,cells:0,settings:{sound:false,short:false}};
}
export const plot=(s:State)=>s.explorationAreas[0];
const allFinds=(s:State)=>[...plot(s).items,...s.retainedFinds];
export function refresh(s:State) {
 const n=s.collectedTreasures.length;
 const conditions:Record<string,boolean>={B101:n>=2,B102:n>=5,B104:n>=8||s.sandSampled||s.sandBatches.length>0,B105:s.exploredPlots>=3||n>=15,B201:n>=20};
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
 s.equippedTools=s.quickSlots.filter(x=>x&&x!=='hand');s.purchases.push({id,time:s.playTime,before,predicted:throughput(s.equippedTools)});return true;
}
export const depthAt=(p:Plot,x:number,y:number)=>p.mask[Math.floor(y/10)*36+Math.floor(x/10)]*280||0;
export function exposure(p:Plot,f:Find) {
 let n=0,total=0;const depth=f.depth??f.y;
 for(let y=Math.floor((f.y-8)/10);y<=Math.floor((f.y+8)/10);y++)for(let x=Math.floor((f.x-8)/10);x<=Math.floor((f.x+8)/10);x++){
  if(x>=0&&x<36&&y>=0&&y<28){total++;n+=Math.max(0,Math.min(1,(p.mask[y*36+x]*280-depth+12)/20));}
 }
 return total?n/total:0;
}
function cost(s:State,id:string) {s.playerStats.stamina=Math.max(0,s.playerStats.stamina-(id==='hand'?5:tool(id)!.staminaCost));s.playerStats.xp[3]++;}
export const diggingLimit=(id:string)=>id==='B105'?280:id==='B101'?180:80;
export function dig(s:State,id:string,x:number,y:number,dx:number) {
 if((id!=='hand'&&!s.ownedTools.includes(id))||id==='B201'||id==='B104'||Math.abs(dx)<2||x<0||x>=360||y<0||y>=280)return 0;
 const p=plot(s),limit=diggingLimit(id)/280,radius=id==='B105'?26:id==='B101'?15:id==='B102'?34:7,ry=id==='B102'?7:radius;
 const low=s.playerStats.stamina<10?.5:1;let removed=0;
 for(let yy=Math.max(0,Math.floor((y-ry-4)/10));yy<=Math.min(27,Math.floor((y+ry+4)/10));yy++)for(let xx=Math.max(0,Math.floor((x-radius-4)/10));xx<=Math.min(35,Math.floor((x+radius+4)/10));xx++){
  const i=yy*36+xx;
  if(p.mask[i]>=limit||((xx*10+5-x)/(radius+4))**2+((yy*10+5-y)/(ry+4))**2>1)continue;
  const amount=Math.min(limit-p.mask[i],(id==='hand'?.45:.85)*low*(1+Math.min(.15,Math.floor(s.playerStats.xp[0]/CONFIG.xpPerLevel)*.01))*limit);
  p.mask[i]+=amount;removed+=amount/limit;
 }
 if(!removed)return 0;
 cost(s,id);s.digs++;s.cells+=removed;s.playerStats.xp[0]+=removed;s.playerStats.xp[1]+=.5;
 if(id==='B101'||id==='B105') {
  s.sandSampled=true;
  let b=s.sandBatches.find(b=>b.plotId===p.id&&!b.processed&&b.cells<CONFIG.batchCells);
  if(!b){b={id:`${p.id}:batch-${s.digs}`,plotId:p.id,items:[],processed:false,cells:0};s.sandBatches.push(b);}
  b.cells+=removed;
  for(const f of p.items)if(f.state==='buried'&&exposure(p,f)>=CONFIG.exposure&&['B001','B002','B003','B004'].includes(f.id)){f.state='batch';f.tool=id;b.items.push(f.uid);}
 }
 refresh(s);return removed;
}
export function detect(s:State,x:number,y:number) {
 if(!s.ownedTools.includes('B201'))return 0;cost(s,'B201');s.playerStats.xp[1]++;
 return Math.max(0,...plot(s).items.filter(f=>f.state==='buried'&&treasure(f.id).material==='metal').map(f=>1-Math.hypot(f.x-x,f.y-y)/(95+Math.min(15,Math.floor(s.playerStats.xp[1]/CONFIG.xpPerLevel)))));
}
export function recover(s:State,uid:string,usedTool='hand') {
 const p=plot(s),f=p.items.find(f=>f.uid===uid);
 if(!f||f.state!=='buried'||exposure(p,f)<CONFIG.exposure||stored(s).length>=CONFIG.capacity)return false;
 f.state='stored';f.tool=usedTool;s.playerStats.xp[2]++;return true;
}
export function sift(s:State,withSieve:boolean) {
 if(withSieve&&!s.ownedTools.includes('B104'))return 0;
 const b=s.sandBatches.find(b=>!b.processed);if(!b)return 0;
 const limit=withSieve?8+Math.min(2,Math.floor(s.playerStats.xp[2]/CONFIG.xpPerLevel/5)):1;let n=0;
 for(const uid of [...b.items]){
  const f=allFinds(s).find(f=>f.uid===uid);
  if(!f||f.state!=='batch'){b.items=b.items.filter(x=>x!==uid);continue;}
  if(stored(s).length>=CONFIG.capacity)break;
  f.state='stored';f.tool=withSieve?'B104':f.tool;n++;b.items=b.items.filter(x=>x!==uid);if(n>=limit)break;
 }
 if(!b.items.length)b.processed=true;
 cost(s,withSieve?'B104':'hand');s.playerStats.xp[2]+=n;return n;
}
export const stored=(s:State)=>allFinds(s).filter(f=>f.state==='stored');
export function reward(s:State,uid:string) {
 const f=stored(s).find(f=>f.uid===uid);if(!f||s.collectedTreasures.includes(uid))return 0;
 const t=treasure(f.id),fn=income[f.id]??0;f.state='paid';s.collectedTreasures.push(uid);s.currentFN+=fn;s.totalEarnedFN+=fn;
 const d=s.discoveredTreasures[f.id]??={count:0,first:new Date().toISOString(),best:0,locations:[],tools:[]};d.count++;d.best=Math.max(d.best,Math.round(t.baseValueFN*f.quality));
 if(!d.locations.includes('B-A'))d.locations.push('B-A');if(!d.tools.includes(f.tool))d.tools.push(f.tool);
 if(t.contractOnly){s.completedContracts.push(uid);s.activeContracts=s.activeContracts.filter(x=>x!==uid);}if(f.id==='B012')s.jackpotHistory.push(uid);
 s.revenueHistory.push({time:s.playTime,fn,jackpot:f.id==='B012'});s.retainedFinds=s.retainedFinds.filter(f=>f.state!=='paid');refresh(s);return fn;
}
export function addPlot(s:State,seed=Date.now()>>>0,noJackpot=false) {
 const old=plot(s);if(seed===old.seed)seed=(seed+1)>>>0;
 s.retainedFinds=allFinds(s).filter(f=>f.state==='stored'||f.state==='batch');
 s.sandSampled ||= s.sandBatches.length>0;s.sandBatches=s.sandBatches.filter(b=>!b.processed);
 s.exploredPlots++;const next=generate(seed,false,noJackpot);
 next.id=`BA-${seed}-${s.exploredPlots}`;next.items.forEach((f,i)=>f.uid=`${s.playerId}:${s.exploredPlots}:${seed}:${i}`);
 s.explorationAreas=[next];s.currentPlot=0;
 s.activeContracts=s.activeContracts.filter(uid=>s.retainedFinds.some(f=>f.uid===uid));refresh(s);
}
export function tick(s:State,seconds:number,idle:boolean) {s.playTime+=seconds;if(idle)s.playerStats.stamina=Math.min(100+Math.floor(s.playerStats.xp[3]/CONFIG.xpPerLevel)*2,s.playerStats.stamina+seconds*CONFIG.regen);}
export function rate(s:State) {const rows=s.revenueHistory.filter(r=>r.time>s.playTime-60);return {normal:rows.filter(r=>!r.jackpot).reduce((n,r)=>n+r.fn,0),total:rows.reduce((n,r)=>n+r.fn,0),finds:rows.length};}
