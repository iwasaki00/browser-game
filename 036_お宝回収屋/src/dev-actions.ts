import {issueUID} from './ledger';
import {isGold,grainProfile,storeGold,type GravelBatch} from './gold';
// Loaded exclusively through the development-only DEBUG LAB import.
import {tools,treasure,CONFIG} from './data';
import {addPlot,plot,reward,refresh,maxStamina,type State,type Find} from './engine';
import {riverCapabilities} from './river';
import {logEvent} from './events';
import {finishQuality,recordRecovery} from './tool-value';
export const bounded=(v:number,min=0,max=1e9)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):min;
export function setMoney(s:State,amount:number,add=false){s.currentFN=bounded((add?s.currentFN:0)+amount);logEvent(s,'DEBUG FN',String(s.currentFN));}
export function setStats(s:State,stamina:number,max:number,levels:number[]){s.maxStamina=bounded(max,1,10000);s.playerStats.stamina=bounded(stamina,0,maxStamina(s));s.playerStats.xp=Array.from({length:4},(_,i)=>i<3?(bounded(Math.floor(levels[i]),1,10000)-1)*CONFIG.xpPerLevel:s.playerStats.xp[3]);}
export function grant(s:State,id:string){const t=tools.find(t=>t.id===id);if(!t||t.implementationStatus!=='available')return false;if(!s.ownedTools.includes(id))s.ownedTools.push(id);if(!s.unlockedTools.includes(id))s.unlockedTools.push(id);logEvent(s,'DEBUG 道具付与',id);return true;}
export function equip(s:State,id:string){if(id!=='hand'&&!grant(s,id))return false;if(!s.quickSlots.includes(id))s.quickSlots=[id,...s.quickSlots].slice(0,4);s.equippedTools=s.quickSlots.filter(id=>id&&id!=='hand');logEvent(s,'道具変更',id);return true;}
let serial=0;
export function spawn(s:State,id:string,options:Partial<Find>={}){
 const t=treasure(id);if(!t)throw Error('未知のお宝ID');const state=options.state??'buried';
 const f:Find={...options,id,uid:s.rewardLedger?issueUID(s):`lab:${s.playerId}:${Date.now()}:${++serial}`,x:bounded(options.x??180,0,359),y:bounded(options.y??245,0,279),depth:bounded(options.depth??20,0,plot(s).beachDepthVersion===1?600:280),weight:bounded(options.weight??t.weight,.01,10000),material:options.material??t.material,magnetic:options.magnetic??t.magnetic,quality:bounded(options.quality??1,.01,2),initialQuality:bounded(options.quality??1,.01,2),rarity:options.rarity??t.rarity,areaId:plot(s).areaId??'B-A',state:'buried',tool:'hand'};
 if(isGold(s)){f.grain??=grainProfile[id]?.grain??1;f.density??=grainProfile[id]?.density??2.7;f.captureRank??=.5;f.goldCapture??=0;
  if(state==='buried'){const p=plot(s);let site=p.goldSites?.find(t=>t.id===f.goldSite);if(!site){site={id:'lab-site:'+f.uid,x:f.x,y:f.y,total:8,collected:0,coarse:.5,items:[],rich:false};(p.goldSites??=[]).push(site);}f.goldSite=site.id;f.goldOffset??=site.collected+.3;if(!site.items.includes(f.uid))site.items.push(f.uid);}
 }
 plot(s).items.push(f);if(isGold(s)&&state!=='buried'){const b:GravelBatch={id:'lab-batch:'+f.uid,plotId:plot(s).id,siteId:f.goldSite??'lab',x:f.x,y:f.y,amount:1,coarse:.5,collectedTool:'hand',screened:0,processed:state==='batch'?0:1,handProcessed:0,contents:[f.uid],separated:state==='batch'?[]:[f.uid],recovered:[],losses:{},passes:0};f.state='batch';f.goldAllocation=.3;(s.gravelBatches??=[]).push(b);if(state==='stored'||state==='paid'){storeGold(s,b,f,'hand');if(state==='paid')reward(s,f.uid);}}
 else if(state==='batch'){f.state='batch';s.sandBatches.push({id:f.uid,plotId:plot(s).id,items:[f.uid],processed:false,cells:3,allocations:{[f.uid]:3}});}else if(state==='stored'||state==='paid'){finishQuality(s,f,'hand');f.state='stored';recordRecovery(s,f);if(state==='paid')reward(s,f.uid);}
 refresh(s);logEvent(s,'お宝出現',`${id} / ${f.uid}`);return f;
}
export const scenarios=[
 {id:'hand',name:'軽い鉄製品 / 素手',item:'R001',tool:'hand',y:250,weight:.12},
 {id:'tongs',name:'少し遠い物 / トング',item:'R004',tool:'R101',y:180,weight:.9},
 {id:'hook',name:'障害物の隙間 / フック',item:'R009',tool:'R106',y:155,weight:1.7,obstacle:true},
 {id:'magnetic',name:'磁石で回収できる物',item:'R002',tool:'R103',y:200,weight:.25},
 {id:'brass',name:'磁石に付かない金属',item:'R009',tool:'R103',y:200,weight:1.7},
 {id:'weak',name:'磁石が弱い',item:'R006',tool:'R103',y:200,weight:5},
 {id:'short',name:'ロープが短い',item:'R002',tool:'R104',y:2,weight:.25},
 {id:'heavy',name:'重くて引けない',item:'R005',tool:'R104',y:150,weight:3.5},
 {id:'strong',name:'強力磁石で成功',item:'R006',tool:'R201',y:90,weight:5,extra:['R104']},
 {id:'pulley',name:'滑車との組み合わせ',item:'R007',tool:'R201',y:90,weight:12,extra:['R104','R206']},
];
export function applyScenario(s:State,id:string){const scenario=scenarios.find(x=>x.id===id);if(!scenario)throw Error('未知のシナリオ');addPlot(s,42000+scenarios.indexOf(scenario),false,'R-B');for(const f of plot(s).items)f.x=30;
 const ids=[scenario.tool,...(scenario.extra??[])];ids.filter(id=>id!=='hand').forEach(id=>grant(s,id));s.quickSlots=[...ids,'','','',''].slice(0,4);s.equippedTools=ids.filter(id=>id!=='hand');
 const f=spawn(s,scenario.item,{x:180,y:scenario.y,weight:scenario.weight,obstacle:scenario.obstacle??false});logEvent(s,'シナリオ',id);return {find:f,tool:scenario.tool,capabilities:riverCapabilities(s,scenario.tool)};
}
export function debugSnapshot(s:State){return {version:'0.4.1',save:s,events:s.events??[]};}
