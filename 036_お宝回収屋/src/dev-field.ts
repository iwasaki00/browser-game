import {createState,addPlot,plot,reward,stored,refresh,type State} from './engine';
import {RIVER_ADDED,GOLD_ADDED} from './field-tools';
import {grant} from './dev-actions';
import {collectGravel,grainProfile,beginGoldWork,goldMotion,goldTick,availableGrains,collectGrain,type GravelBatch} from './gold';
import {riverObserve,riverStart,riverPull,riverCapabilities} from './river';
export const fieldScenarios=[...RIVER_ADDED,...GOLD_ADDED].map(id=>({id:'F-TEST-'+id,name:id+' 購入前／購入後',tool:id}));
export function applyFieldScenario(s:State,id:string,phase:'before'|'after'='after'){
 const scenario=fieldScenarios.find(t=>t.id===id);if(!scenario)throw Error('未知の新道具シナリオ');const tool=scenario.tool,seed=941000+fieldScenarios.indexOf(scenario),fresh=createState(seed);for(const key of Object.keys(s))delete (s as unknown as Record<string,unknown>)[key];Object.assign(s,fresh);
 const after=phase==='after';addPlot(s,seed,true,tool.startsWith('R')?'R-B':'G-B');
 let active=tool;let ids:string[]=[];
 if(tool.startsWith('R')){
  const baseline:Record<string,string>={R102:'R101',R202:'R103',R203:'R106',R204:'R205',R205:'R104',R210:'R203'};active=after?tool:baseline[tool];ids=[active,...(['R204','R210'].includes(tool)?[baseline[tool]]:[])];
  const f=plot(s).items[0];plot(s).items=[f];Object.assign(f,{id:tool==='R202'?'R006':'R009',x:180,y:tool==='R102'?100:tool==='R205'||tool==='R204'?5:tool==='R202'?200:170,depth:30,weight:tool==='R102'?.5:tool==='R205'?2:tool==='R204'?4:5,magnetic:tool==='R202',material:tool==='R202'?'iron':'brass',obstacle:['R203','R204'].includes(tool),quality:1,initialQuality:1,state:'buried',tool:'hand'});
 }else{
  const baseline:Record<string,string>={G104:'hand',G106:'G101',G108:'G101',G202:'G103',G204:'G110',G205:'G203'};active=after?tool:baseline[tool];ids=['G101','G102',active,...(tool==='G108'?['G108']:tool==='G205'?['G203']:[])].filter(t=>after||t!==tool);
  const p=plot(s),site=p.goldSites![0];site.total=24;site.collected=0;site.coarse=.75;
  const finds=p.items.filter(f=>f.goldSite===site.id);for(const [i,f] of finds.entries()){f.id=i===2?'G002':i===1?'G008':'G007';Object.assign(f,grainProfile[f.id]);f.magnetic=f.id==='G002';f.goldOffset=1+i*7;f.captureRank=tool==='G205'?.70:.98;f.quality=f.initialQuality=1;}
  if(!['G106','G108'].includes(tool)){
   if(!s.ownedTools.includes('G101'))grant(s,'G101');for(let n=0;n<4;n++)collectGravel(s,'G101',site.x,site.y,24);
   const b=s.gravelBatches![0];if(tool==='G104'||tool==='G204'){b.processed=b.amount;b.separated=[...b.contents];}
  }
 }
 ids.filter(t=>t!=='hand').forEach(t=>grant(s,t));s.quickSlots=[...new Set([active,...ids,'hand'])].slice(0,4);while(s.quickSlots.length<4)s.quickSlots.push('');s.equippedTools=s.quickSlots.filter(t=>t&&t!=='hand');s.activeContracts=[];refresh(s);return {tool:active,phase,seed};
}
export function compareFieldScenario(id:string){return {id,results:(['before','after'] as const).map(phase=>{
 const s=createState(1),fixture=applyFieldScenario(s,id,phase),tool=id.replace('F-TEST-','');let operations=0,successes=0,failures=0,seconds=0,stamina=0,processed=0;
 const act=<T>(fn:()=>T,time:number)=>{const before=s.playerStats.stamina;operations++;const r=fn();stamina+=before-s.playerStats.stamina;seconds+=time;return r;};
 const layout=plot(s).items.map(f=>({id:f.id,x:f.x,y:f.y,depth:f.depth,quality:f.quality,grain:f.grain,weight:f.weight}));
 const wash=()=>{for(const f of stored(s))act(()=>reward(s,f.uid),1.4);};
 const work=(batchId:string,usedTool:string)=>{if(!beginGoldWork(s,batchId,usedTool))return;operations++;seconds++;for(let n=0;n<1000&&s.goldWork;n++){const w=s.goldWork;if(w.mode==='sluice')act(()=>goldTick(s,.2),.2);else{const distance=Math.min(8,(w.required-w.work)*24);act(()=>goldMotion(s,distance,distance/24*.6),distance/24*.6);}}};
 const pick=(b:GravelBatch)=>{const used=s.ownedTools.includes('G204')?'G204':s.ownedTools.includes('G110')?'G110':s.ownedTools.includes('G104')?'G104':'hand';for(const f of availableGrains(s,b))for(let n=0;n<3&&f.state==='batch';n++){if(act(()=>collectGrain(s,b.id,f.uid,used),.45))successes++;}wash();};
 if(tool.startsWith('R')){const f=plot(s).items[0];if(['R204','R210'].includes(fixture.tool))act(()=>riverObserve(s,fixture.tool,f.x,f.y),.4);const active=fixture.tool==='R204'?'R205':fixture.tool==='R210'?'R203':fixture.tool;const start=act(()=>riverStart(s,active,f.x,f.y,riverCapabilities(s,active).rope),.5);if(start.ok){for(let n=0;n<100&&s.riverSession?.uid;n++){const r=act(()=>riverPull(s,70),.75);if(!r.ok){failures++;break;}if(r.recovered)successes++;}}else failures++;wash();}
 else if(tool==='G106'){const site=plot(s).goldSites![0];const r=act(()=>collectGravel(s,fixture.tool,site.x,site.y,24),1.2);processed=r.amount;}
 else if(tool==='G108'){for(const site of plot(s).goldSites!.slice(0,2))act(()=>collectGravel(s,'G101',site.x,site.y,24),1.2);for(const b of s.gravelBatches??[]){for(let n=0;n<20&&b.processed<b.amount;n++)work(b.id,'G102');processed+=b.processed;pick(b);}}
 else{const b=s.gravelBatches![0];if(tool==='G104'||tool==='G204')pick(b);else{const screen=tool==='G202'?fixture.tool:phase==='after'?'G205':'';if(screen)for(let n=0;n<10&&(screen==='G205'?(b.magnetized??0):b.screened)<b.amount;n++)work(b.id,screen);for(let n=0;n<20&&b.processed<b.amount;n++)work(b.id,tool==='G205'?'G203':'G102');processed=b.processed;pick(b);}}
 return {phase,seed:fixture.seed,tool:fixture.tool,layout,operations,successes,failures,seconds,stamina,recovered:s.collectedTreasures.length,processed,fn:s.totalEarnedFN,fnPerMinute:s.totalEarnedFN/Math.max(1,seconds)*60,bags:s.gravelBatches?.length??0,quality:plot(s).items.filter(f=>f.state==='paid').map(f=>f.quality),metrics:s.operationMetrics};
 })};}
