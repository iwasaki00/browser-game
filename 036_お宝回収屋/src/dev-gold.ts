// Development-only fixtures assemble their state through the normal gathering and processing APIs.
import type {State} from './engine';
import {addPlot,plot} from './engine';
import {grant,spawn} from './dev-actions';
import {collectGravel,beginGoldWork,goldMotion,feedSluice,grainProfile,goldPipeline,availableGrains,goldFinds} from './gold';
import {migrate} from './save';
export const goldScenarios=[
 ['G-TEST-01','素手で小石を回収','hand'],['G-TEST-02','小型スコップで採取','G101'],['G-TEST-03','ふるいで粒径選別','G103'],['G-TEST-04','皿で砂金を選別','G102'],['G-TEST-05','黄鉄鉱と砂金の識別','G105'],['G-TEST-06','微細な砂金を吸引','G110'],['G-TEST-07','大型皿の大量処理','G201'],['G-TEST-08','スルース連続選別','G203'],['G-TEST-09','C09の工程連携','G102'],['G-TEST-10','選別途中の保存・復元','G102'],['G-TEST-11','特別な砂金採取地点','G102'],['G-TEST-12','大量の未処理砂利','G203'],
].map(([id,name,tool])=>({id,name,tool}));
function complete(s:State){for(let i=0;i<500&&s.goldWork;i++)goldMotion(s,120,.15);}
export function applyGoldScenario(s:State,id:string){
 const scenario=goldScenarios.find(x=>x.id===id);if(!scenario)throw Error('未知の河原シナリオ');const n=goldScenarios.indexOf(scenario)+1;
 delete s.goldWork;s.sluiceFeed=[];s.gravelBatches=[];s.retainedFinds=s.retainedFinds.filter(f=>!f.id.startsWith('G')||f.state==='stored');
 addPlot(s,93000+n,true,n<=3?'G-A':'G-B');const p=plot(s),site=p.goldSites![0];p.items=p.items.filter(f=>f.goldSite!==site.id);site.items=[];site.total=24;site.collected=0;site.coarse=.72;site.rich=n===11;
 const ids=n===1?['G001','G004','G003']:['G007','G003','G008'];
 ids.forEach((item,i)=>{const f=spawn(s,item,{x:site.x,y:site.y,depth:0,...grainProfile[item],goldSite:site.id,goldOffset:n===1?.3+i*7:1+i*7,captureRank:.35,goldCapture:0,goldRich:n===11});site.items.push(f.uid);});
 const tools=n===1?[]:['G101',...(n>=3?['G102']:[]),...(n===3||n===9?['G103']:[]),...(n===5?['G105']:[]),...(n===6?['G110']:[]),...(n===7?['G201']:[]),...(n===8||n===12?['G203']:[])];tools.forEach(id=>grant(s,id));
 s.quickSlots=[scenario.tool,...tools.filter(t=>t!==scenario.tool),'','','',''].slice(0,4);s.equippedTools=s.quickSlots.filter(Boolean).filter(id=>id!=='hand');
 if(n>=3){for(let i=0;i<4;i++)collectGravel(s,'G101',site.x,site.y,24);const b=s.gravelBatches![0];
  if(n===3)beginGoldWork(s,b.id,'G103');
  if(n===9){while(b.screened<b.amount){beginGoldWork(s,b.id,'G103');complete(s);}}
  if(n===4||n===7||n===9||n===10||n===11)beginGoldWork(s,b.id,n===7?'G201':'G102');
  if(n===10){goldMotion(s,50,.1);const copy=migrate(JSON.parse(JSON.stringify(s)));Object.assign(s,copy);}
  if(n===5||n===6){while(b.processed<b.amount){beginGoldWork(s,b.id,'G102');complete(s);}}
  if(n===8)feedSluice(s,b.id);
 }
 if(n===12){for(let index=0;index<16;index++){addPlot(s,95000+index,true,'G-B');for(const site of plot(s).goldSites!)for(let pass=0;pass<4;pass++)collectGravel(s,'G101',site.x,site.y,24);}}
 return {tool:scenario.tool};
}
export function goldDebugInfo(s:State){const finds=goldFinds(s);return {goldVersion:s.goldVersion,unlocked:s.goldUnlockedAreas,sites:plot(s).goldSites,work:s.goldWork,queue:s.sluiceFeed,pipeline:goldPipeline(s.equippedTools),metrics:s.operationMetrics,batches:(s.gravelBatches??[]).map(b=>({id:b.id,plot:b.plotId,site:b.siteId,amount:b.amount,unprocessed:b.amount-b.processed,processed:b.processed,screened:b.screened,stage:s.goldWork?.batchId===b.id?s.goldWork.mode:b.processed>=b.amount?'濃縮・残渣':'採取済',contents:b.contents.map(uid=>({uid,id:finds.find(f=>f.uid===uid)?.id??'支払済',grain:finds.find(f=>f.uid===uid)?.grain,density:finds.find(f=>f.uid===uid)?.density})),captureRate:b.contents.length?b.separated.length/b.contents.length:0,tailings:Object.values(b.losses).reduce((n,x)=>n+x,0),ready:availableGrains(s,b).map(f=>f.uid),recovered:b.recovered}))};}
