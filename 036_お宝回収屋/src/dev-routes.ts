import {purchaseMachine,type MachineId} from './automation';
// Pure, development-only simulations. No save/storage APIs or normal-player references.
import {VERSION,tools,CONFIG} from './data';
import {createState,plot,addPlot,buy,refresh,dig,recover,reward,stored,scan,depthAt,tick,type State} from './engine';
import {BEACH_ADDED,beachProfiles,sieveTool} from './beach-tools';
import {sortSand} from './engine';
import {riverStart,riverPull,riverCapabilities,riverObserve,areaId} from './river';
import {collectGravel,handSortGravel,beginGoldWork,goldMotion,goldTick,feedSluice,availableGrains,collectGrain,goldAreaUnlocked,goldFinds,type GravelBatch} from './gold';
export type RouteField='B'|'R'|'G';export type RouteName='A'|'B'|'C'|'D';
export type RouteGoal='fourth'|'fifth'|'income'|'all'|'smallMagnet'|'strongMagnet'|'heavy'|'pan'|'sluice'|'gravel';
export const routeNames={A:'最短目標型',B:'低価格組み合わせ型',C:'バランス型',D:'全道具購入型'};
export const routeGoals:Record<RouteField,{id:RouteGoal;name:string}[]>={B:[{id:'fourth',name:'第4層到達'},{id:'fifth',name:'第5層到達'},{id:'income',name:'通常FN獲得'},{id:'all',name:'全砂浜道具購入'}],R:[{id:'smallMagnet',name:'小型磁石購入'},{id:'strongMagnet',name:'強力磁石購入'},{id:'heavy',name:'12kg重量物の回収'},{id:'all',name:'全川底道具購入'}],G:[{id:'pan',name:'パンニング皿購入'},{id:'sluice',name:'スルース購入'},{id:'gravel',name:'砂利の比重選別'},{id:'all',name:'全河原道具購入'}]};
export interface RouteOptions {equipmentTarget?:MachineId;seed:number;field:RouteField;goal:RouteGoal;initialFN?:number;target?:number;maxSeconds?:number;}
export interface RouteResult {version:string;seed:number;field:RouteField;route:RouteName;goal:RouteGoal;conditions:object;seconds:number;achieved:boolean;stalled:boolean|null;reason:string;purchased:string[];purchaseCost:number;purchases:{id:string;seconds:number;cost:number}[];operations:number;successes:number;failures:number;stamina:number;earned:number;fnPerMinute:number;processed:number;heavy:number;uses:Record<string,number>;jackpots:number;milestones:Record<string,number>;initialLayout:object[];}
const beachBase=['B101','B102','B104','B105','B201'];
export function purchaseOrder(field:RouteField,route:RouteName,goal:RouteGoal){
 const all=tools.filter(t=>t.category===field&&t.implementationStatus==='available').map(t=>t.id);
 let order:string[];
 if(field==='B')order=route==='D'?[...beachBase,...BEACH_ADDED]:route==='A'?['B101','B104','B105',goal==='fourth'?'B203':'B302']:route==='B'?['B101','B104','B105','B108','B103',goal==='fourth'?'B203':'B302']:['B101','B102','B104','B105','B201','B203','B208','B302'];
 else if(field==='R')order=route==='D'?['R101','R106','R103','R104','R110','R201','R206',...all]:route==='A'?(goal==='smallMagnet'?['R103']:goal==='strongMagnet'?['R103','R104','R201']:['R104','R201','R206']):route==='B'?['R102','R106','R103','R104','R110','R201','R206']:['R101','R106','R103','R104','R110','R203','R201','R206','R205','R204','R210','R202'];
 else order=route==='D'?['G101','G102','G103','G105','G110','G201','G203',...all]:route==='A'?(goal==='pan'?['G102']:['G101','G102','G203']):route==='B'?['G101','G103','G102','G104','G203']:['G101','G102','G103','G105','G110','G201','G203','G106','G202','G204','G205','G108'];
 if(goal==='all')order.push(...all);return [...new Set(order)];
}
export function simulateRoute(options:RouteOptions,route:RouteName):RouteResult {
 const {seed,field,goal}=options;if(!Number.isInteger(seed)||seed<0||seed>4294967295||!(options.equipmentTarget?{B:'B301',R:'R301',G:'G304'}[field]===options.equipmentTarget:routeGoals[field]?.some(g=>g.id===goal)))throw Error('比較条件が不正です');
 const initialFN=options.initialFN??0,target=options.target??(goal==='gravel'?100:1000),maxSeconds=options.maxSeconds??36000;
 if(![initialFN,target,maxSeconds].every(Number.isFinite)||initialFN<0||target<=0||maxSeconds<=0||maxSeconds>72000)throw Error('資金・目標量・時間上限が不正です');
 const s=createState(seed);s.currentFN=initialFN;if(field!=='B'){s.discoveredTreasures.B001={count:20,first:'',best:0,locations:['B-A'],tools:['hand']};addPlot(s,seed,true,field==='R'?'R-A':'G-A');}
 for(const f of plot(s).items)if(f.id==='B012')f.id='B007';
 const initialLayout=plot(s).items.map(f=>({id:f.id,x:f.x,y:f.y,depth:f.depth,quality:f.quality})),order=options.equipmentTarget?(field==='B'?['B101','B104','B105']:field==='R'?['R104','R110']:['G101','G103','G102','G203']):purchaseOrder(field,route,goal),purchases:RouteResult['purchases']=[],uses:Record<string,number>={},milestones:Record<string,number>={};
 let operations=0,successes=0,failures=0,stamina=0,processed=0,heavy=0,serial=0,first=0;
 const advance=(seconds:number,idle=false)=>{tick(s,seconds,idle);if(field==='G')goldTick(s,seconds);};
 const operation=<T>(id:string,fn:()=>T,seconds:number,idle=false)=>{const before=s.playerStats.stamina;operations++;uses[id]=(uses[id]??0)+1;const value=fn();stamina+=Math.max(0,before-s.playerStats.stamina);advance(seconds,idle);return value;};
 const equip=(ids:string[])=>{s.equippedTools=[...new Set(ids)].filter(id=>s.ownedTools.includes(id)).slice(0,4);};
 const shop=()=>{refresh(s);for(const id of order){if(s.ownedTools.includes(id))continue;const t=tools.find(t=>t.id===id)!;if(s.currentFN>=t.priceFN&&s.unlockedTools.includes(id)&&buy(s,id)){purchases.push({id,seconds:s.playTime,cost:t.priceFN});milestones[id]??=s.playTime;operations++;advance(2,true);}else if(route!=='D')break;}if(options.equipmentTarget&&purchaseMachine(s,options.equipmentTarget)){purchases.push({id:options.equipmentTarget,seconds:s.playTime,cost:tools.find(t=>t.id===options.equipmentTarget)!.priceFN});operations++;advance(2,true);}};
 const wash=()=>{for(const f of stored(s)){if(field==='R'&&(f.weight??0)>=10)heavy++;operation('洗浄',()=>reward(s,f.uid),1.4,true);if(!first){first=s.playTime;milestones.first=first;}}};
 const all=()=>tools.filter(t=>t.category===field&&t.implementationStatus==='available').every(t=>s.ownedTools.includes(t.id));
 const reached=()=>options.equipmentTarget?!!s.automation?.machines[options.equipmentTarget]:goal==='all'?all():goal==='income'?s.totalEarnedFN>=target:goal==='fourth'?!!milestones.fourth:goal==='fifth'?!!milestones.fifth:goal==='smallMagnet'?s.ownedTools.includes('R103'):goal==='strongMagnet'?s.ownedTools.includes('R201'):goal==='heavy'?heavy>0:goal==='pan'?s.ownedTools.includes('G102'):goal==='sluice'?s.ownedTools.includes('G203'):processed>=target;
 if(field==='B'){
  let step=0;shop();
  while(s.playTime<maxSeconds&&!reached()){
   const id=s.ownedTools.includes('B302')?'B302':s.ownedTools.includes('B203')?'B203':s.ownedTools.includes('B105')?'B105':s.ownedTools.includes('B101')?'B101':'hand';
   const x=s.exploredPlots===1&&!first?30:5+(step%18)*20,y=s.exploredPlots===1&&!first?150:5+(Math.floor(step/18)%14)*20;
   operation(id,()=>dig(s,id,x,y,5),.32);for(const f of plot(s).items)if(f.state==='buried'&&recover(s,f.uid,s.ownedTools.includes('B109')?'B109':id)){operations++;successes++;advance(.45,true);}
   if(step%3===0){const sieve=s.ownedTools.includes('B208')?'B208':s.ownedTools.includes('B104')?'B104':'hand';const r=operation(sieve,()=>sortSand(s,sieve==='hand'?'hand':'sieve',sieve),.6);processed+=r.units;}
   wash();shop();equip(s.ownedTools.includes('B209')||s.ownedTools.includes('B110')?['B110','B209','B201','B203']:['B105','B104','B108']);
   const d=depthAt(plot(s),x,y);if(d>280)milestones.fourth??=s.playTime;if(d>420)milestones.fifth??=s.playTime;
   step++;if(step%18===0)advance(.5,true);if(step%756===0){addPlot(s,seed*100000+s.exploredPlots,true);advance(4,true);}
   // If the field has no remaining work for the target, use the public center, never hidden item coordinates.
   if((goal==='fourth'&&s.ownedTools.includes('B203')||goal==='fifth'&&s.ownedTools.includes('B302'))&&!reached()){
    const deep=goal==='fourth'?'B203':'B302';if(!plot(s).beachDepthVersion){addPlot(s,seed*100000+s.exploredPlots,true);advance(4,true);}
    for(let n=0;n<16&&!reached();n++){operation(deep,()=>dig(s,deep,185,155,5),.32);const d=depthAt(plot(s),185,155);if(d>280)milestones.fourth??=s.playTime;if(d>420)milestones.fifth??=s.playTime;}
   }
  }
 }else if(field==='R'){
  shop();let rounds=0;
  while(s.playTime<maxSeconds&&!reached()&&rounds++<2000){let gained=0;
   equip(['R104','R110','R201','R206']);
   for(const f of [...plot(s).items]){if(f.state!=='buried')continue;advance(2,true);operations++;
    for(const observer of ['R204','R210'].filter(id=>s.ownedTools.includes(id)))operation(observer,()=>riverObserve(s,observer,f.x,f.y),.4);
    const candidates=['R201','R202','R104','R103','R203','R205','R106','R102','R101'].filter(id=>s.ownedTools.includes(id));candidates.push('hand');
    for(const id of candidates){if(id==='R205')equip(['R205','R204','R210']);else if(id==='R203')equip(['R203','R210']);else equip([id,'R104','R110','R201','R206']);
     const r=operation(id,()=>riverStart(s,id,f.x,f.y,riverCapabilities(s,id).rope),.5);if(!r.ok){failures++;continue;}
     for(let n=0;n<100&&s.riverSession?.uid;n++){const r=operation(id,()=>riverPull(s,70),.75);if(!r.ok){failures++;break;}}
     if(String(f.state)==='stored'){successes++;gained++;wash();shop();break;}
    }if(reached()||s.playTime>=maxSeconds)break;
   }
   if(!gained)failures++;serial++;addPlot(s,seed*10000+serial,true,s.ownedTools.some(id=>['R104','R203','R205'].includes(id))?'R-B':'R-A');advance(4,true);
  }
 }else{
  const retrieve=(b:GravelBatch)=>{for(const f of availableGrains(s,b)){const id=s.ownedTools.includes('G204')?'G204':s.ownedTools.includes('G110')?'G110':s.ownedTools.includes('G104')?'G104':'hand';for(let i=0;i<3&&f.state==='batch';i++){const r=operation(id,()=>collectGrain(s,b.id,f.uid,id),.45);if(r)successes++;}wash();}};
  const work=()=>{for(let n=0;n<10000&&s.goldWork;n++){const w=s.goldWork;if(w.mode==='sluice'){advance(.2);}else{const d=Math.min(8,(w.required-w.work)*24);const before=s.playerStats.stamina;goldMotion(s,d,d/24*.6);stamina+=Math.max(0,before-s.playerStats.stamina);advance(d/24*.6);}operations++;}if(s.goldWork)throw Error('選別の処理上限です');};
  const process=(b:GravelBatch)=>{
   const pan=s.ownedTools.includes('G203')?'G203':s.ownedTools.includes('G201')?'G201':s.ownedTools.includes('G102')?'G102':'hand';
   if(pan==='hand'){while(b.handProcessed<b.amount){operation('hand',()=>handSortGravel(s,b),1.6);wash();}return;}
   equip(['G108',pan,'G205','G204']);
   const pre=(id:string,remaining:()=>boolean)=>{for(let n=0;n<100&&remaining();n++){if(!beginGoldWork(s,b.id,id))break;operations++;advance(1,true);work();retrieve(b);}};
   if(s.ownedTools.includes('G205'))pre('G205',()=>(b.magnetized??0)<b.amount);
   const screen=s.ownedTools.includes('G202')?'G202':s.ownedTools.includes('G103')?'G103':'';
   if(screen)pre(screen,()=>b.screened<b.amount);
   const before=b.processed;if(pan==='G203'){if(feedSluice(s,b.id)){operations++;advance(1,true);work();retrieve(b);}}else pre(pan,()=>b.processed<b.amount);processed+=b.processed-before;
   for(let n=0;n<Math.ceil(b.amount/4)*4;n++){if(!b.contents.some(uid=>{const f=goldFinds(s).find(f=>f.uid===uid);return f?.state==='batch'&&!b.separated.includes(uid);}))break;const tail=s.ownedTools.includes('G102')?'G102':pan;if(!beginGoldWork(s,b.id,tail))break;operations++;advance(1,true);work();retrieve(b);}retrieve(b);
  };
  shop();let rounds=0;
  while(s.playTime<maxSeconds&&!reached()&&rounds++<3000){const p=plot(s);equip(['G108','G106','G101','G204']);
   for(const site of p.goldSites??[]){while(site.collected<site.total-1e-8&&s.playTime<maxSeconds){const id=s.ownedTools.includes('G106')?'G106':s.ownedTools.includes('G101')?'G101':'hand';const r=operation(id,()=>collectGravel(s,id,site.x,site.y,24),1.2);if(!r.amount){failures++;break;}wash();shop();if(reached())break;}
    if(!s.ownedTools.includes('G108'))for(const b of s.gravelBatches??[])if(b.plotId===p.id&&b.siteId===site.id)process(b);wash();shop();if(reached()||s.playTime>=maxSeconds)break;
   }
   if(s.ownedTools.includes('G108'))for(const b of s.gravelBatches??[])if(b.plotId===p.id){process(b);wash();shop();if(reached()||s.playTime>=maxSeconds)break;}
   if(reached())break;serial++;addPlot(s,seed*10000+serial,true,goldAreaUnlocked(s,'G-B')?'G-B':'G-A');advance(4,true);
  }
 }
 const achieved=reached();return {version:VERSION,seed,field,route,goal,conditions:{initialFN,target,maxSeconds,equipmentTarget:options.equipmentTarget,initialStamina:100,initialXP:[0,0,0,0],initialArea:field==='B'?'B-A':field==='R'?'R-A':'G-A',eligibility:field==='B'?'初期状態':'砂浜回収20個の実績のみ',jackpots:false,model:'grid-041',time:{dig:.32,search:2,cast:.5,pull:.75,wash:1.4,gather:1.2,load:1,work:.6,pick:.45,purchase:2}},seconds:s.playTime,achieved,stalled:achieved?false:null,reason:achieved?'達成':s.playTime>=maxSeconds?'計測時間上限（進行不能とは未確定）':'試行上限',purchased:[...s.ownedTools],purchaseCost:purchases.reduce((n,p)=>n+p.cost,0),purchases,operations,successes,failures,stamina,earned:s.totalEarnedFN,fnPerMinute:s.totalEarnedFN/Math.max(1,s.playTime)*60,processed,heavy,uses,jackpots:s.jackpotHistory.length+(s.goldStats?.specialSites.length??0),milestones,initialLayout};
}
export function compareRoutes(options:RouteOptions){return {version:VERSION,options,results:(['A','B','C','D'] as RouteName[]).map(route=>simulateRoute(options,route))};}
