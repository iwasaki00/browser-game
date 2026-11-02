// This module is loaded only by DEBUG LAB. Simulations never mutate its live save.
import {VERSION,CONFIG,tool} from './data';
import {createState,generate,plot,dig,scan,recover,reward,stored,sortSand,depthAt,exposure,tick,type State} from './engine';
import {beachProfiles,detectorTool,sieveTool,beachCapacity,sieveSettings} from './beach-tools';
import {sandRemaining} from './tool-value';
import {migrate} from './save';
import {logEvent} from './events';
export type BeachCondition='natural'|'surface'|'bulk'|'precision';
export function comparisonPlot(seed:number,condition:BeachCondition){const p=generate(seed,false,true,true);
 if(condition!=='natural')for(const [i,f] of p.items.entries()){f.x=35+(i%6)*55;f.y=65+Math.floor(i/6)*65;f.depth=condition==='surface'?35:condition==='bulk'?140:235;f.id=condition==='precision'?'B007':i%2?'B003':'B004';}
 return p;}
export function compareBeach(seed:number,configurations:string[][],condition:BeachCondition='natural',passes=3){
 const template=comparisonPlot(seed,condition),layout=template.items.map(f=>({uid:f.uid,id:f.id,x:f.x,y:f.y,depth:f.depth}));
 const results=configurations.map(ids=>{if(ids.length>4||ids.some(id=>id!=='hand'&&(!beachProfiles[id]||tool(id)?.implementationStatus!=='available')))throw Error('使用可能な砂浜道具を4枠以内で指定してください');
  const s=createState(seed);s.explorationAreas=[structuredClone(template)];s.ownedTools=[...ids.filter(id=>id!=='hand')];s.equippedTools=s.ownedTools.slice();let uses=0,stamina=0,volume=0;
  const time=(seconds:number)=>tick(s,seconds,false);
  const collect=()=>{for(const f of plot(s).items)if(f.state==='buried'&&exposure(plot(s),f)>=CONFIG.exposure){const id=ids.includes('B109')?'B109':ids.find(id=>beachProfiles[id]?.limit)??'hand';recover(s,f.uid,id);uses++;time(.45);}for(const f of stored(s)){reward(s,f.uid);time(1.4);}};
  const detectors=ids.filter(detectorTool);for(const id of detectors)for(let y=20;y<280;y+=40)for(let x=20;x<360;x+=40){const before=s.playerStats.stamina;scan(s,x,y,id);stamina+=before-s.playerStats.stamina;uses++;time(.3);}
  const digger=ids.filter(id=>beachProfiles[id]?.limit).sort((a,b)=>(beachProfiles[b].limit??0)-(beachProfiles[a].limit??0))[0]??'hand';
  for(let pass=0;pass<passes;pass++)for(let y=15;y<280;y+=20)for(let x=15;x<360;x+=20){const before=s.playerStats.stamina;volume+=dig(s,digger,x,y,5);stamina+=before-s.playerStats.stamina;uses++;time(.32);collect();}
  const sieve=ids.find(sieveTool),settings=sieveSettings(s,sieve??'hand');let sortCalls=0;
  for(let n=0;n<1000&&sandRemaining(s)>1e-8;n++){const before=s.playerStats.stamina,r=sortSand(s,sieve?'sieve':'hand',sieve);if(!r.units)break;stamina+=before-s.playerStats.stamina;uses++;sortCalls++;time(settings.seconds);collect();}
  collect();const paid=plot(s).items.filter(f=>f.state==='paid'),depths=plot(s).mask.map((_,i)=>depthAt(plot(s),i%36*10+5,Math.floor(i/36)*10+5));
  return {tools:ids,uses,excavation:depths.reduce((n,d)=>n+d,0),legacyWork:volume,maxDepth:Math.max(...depths),area:depths.filter(d=>d>0).length*100,stamina,finds:paid.length,quality:paid.length?paid.reduce((n,f)=>n+f.quality/(f.initialQuality??1),0)/paid.length:0,processed:s.sortHistory?.reduce((n,r)=>n+r.units,0)??0,sortCalls,fn:s.totalEarnedFN,seconds:s.playTime,fnPerMinute:s.totalEarnedFN/Math.max(.001,s.playTime)*60,capacity:beachCapacity(s)};
 });return {version:VERSION,seed,area:'B-A',condition,passes,operation:{grid:20,strokeSeconds:.32,scanSeconds:.3,pickupSeconds:.45,washSeconds:1.4,idleRecovery:false},layout,results};
}
export const beachScenarios=[
 ['B-TEST-01','第1層：素手','hand',60],['B-TEST-02','第2層への到達','B101',150],['B-TEST-03','第3層への到達','B105',240],['B-TEST-04','第4層への到達','B203',370],['B-TEST-05','第5層への到達','B302',550],['B-TEST-06','深度制限で停止','B105',330],['B-TEST-07','同じ穴を持替えて深掘り','B203',370],['B-TEST-08','深いお宝を回収','B302',520],['B-TEST-09','深層探知','B205',540],['B-TEST-10','深層の保存・復元','B302',520],
].map(([id,name,tool,depth])=>({id:String(id),name:String(name),tool:String(tool),depth:Number(depth)}));
export function applyBeachScenario(s:State,id:string){const v=beachScenarios.find(v=>v.id===id);if(!v)throw Error('未知の砂浜シナリオ');
 const fresh=createState(4040);for(const key of Object.keys(s))delete (s as unknown as Record<string,unknown>)[key];Object.assign(s,fresh);s.explorationAreas=[generate(4040,false,true,true)];plot(s).items=[{uid:s.playerId+':'+id,id:'B007',x:185,y:155,depth:v.depth,quality:1,initialQuality:1,state:'buried',tool:'hand'}];s.ownedTools=['B101','B105','B203','B302','B205'];s.quickSlots=['B101','B105','B203','B302'];s.equippedTools=s.quickSlots.slice();
 if(id==='B-TEST-06'||id==='B-TEST-07')for(let n=0;n<10;n++)dig(s,'B105',185,155,5);
 if(id==='B-TEST-10'){for(let n=0;n<5;n++)dig(s,'B302',185,155,5);Object.assign(s,migrate(JSON.parse(JSON.stringify(s))));}
 logEvent(s,'シナリオ',id);return {tool:v.tool};}
