import {GOLD_ADDED,goldScreen,goldProcessing} from './field-tools';
import {CONFIG,treasure} from './data';
import type {State,Plot,Find} from './engine';
import {finishQuality,recordRecovery} from './tool-value';
import {logEvent} from './events';
import {measure,measureSeconds} from './measure';

export const GOLD_TOOLS=[...GOLD_ADDED,'G101','G102','G103','G105','G110','G201','G203'];
export interface GravelSite {id:string;x:number;y:number;total:number;collected:number;coarse:number;items:string[];rich:boolean;announced?:boolean;}
export interface GravelBatch {automationJob?:string;fineScreened?:number;magnetized?:number;magnetRecovered?:string[]; id:string;plotId:string;siteId:string;x:number;y:number;amount:number;coarse:number;collectedTool:string;screened:number;processed:number;handProcessed:number;contents:string[];separated:string[];recovered:string[];losses:Record<string,number>;passes:number;reprocessCursor?:number;}
export interface GoldWork {prepared?:boolean;fineFraction?:number;magneticFraction?:number; batchId:string;tool:string;mode:'pan'|'screen'|'sluice'|'magnet';start:number;load:number;work:number;required:number;rough:number;strokes:number;reprocess:boolean;}
export interface GoldStatistics {found:string[];panCompleted:number;specialSites:{plotId:string;siteId:string;time:number}[];}
export const isGold=(s:State)=>s.explorationAreas[0].areaId?.startsWith('G-')??false;
export function goldStats(s:State){return s.goldStats??={found:[],panCompleted:0,specialSites:[]};}
const bookCount=(s:State,prefix:string)=>Object.entries(s.discoveredTreasures).filter(([id])=>id.startsWith(prefix)).reduce((n,[,d])=>n+d.count,0);
export function goldAreaUnlocked(s:State,id:string){return s.goldUnlockedAreas?.includes(id)||id==='G-A'&&(bookCount(s,'B')>=20||bookCount(s,'R')>=5)||id==='G-B'&&(Math.max(bookCount(s,'G'),s.goldStats?.found.length??0)>=10||(s.goldStats?.panCompleted??0)>=5);}
function random(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const grainProfile:Record<string,{grain:number;density:number}>={G001:{grain:2.4,density:2.65},G002:{grain:.7,density:5.2},G003:{grain:1,density:5},G004:{grain:4,density:2.7},G005:{grain:3,density:2.6},G006:{grain:2,density:2.65},G007:{grain:.12,density:19.3},G008:{grain:.45,density:19.3},G009:{grain:1.6,density:19.3},G010:{grain:8,density:2.65},G011:{grain:4,density:19.3},G012:{grain:12,density:19.3}};
export function generateGold(seed:number,area='G-A',noJackpot=false):Plot {
 const r=random(seed),items:Find[]=[],sites:GravelSite[]=[];const rich=area==='G-B'&&!noJackpot&&r()<.025?Math.floor(r()*8):-1;
 for(let i=0;i<8;i++){
  const x=55+(i%3)*120+(r()-.5)*22,y=45+Math.floor(i/3)*85+(r()-.5)*15,total=18+Math.floor(r()*7);
  const site:GravelSite={id:`site-${i}`,x,y,total,collected:0,coarse:.35+r()*.45,items:[],rich:i===rich};
  const count=site.rich?7:3;
  for(let n=0;n<count;n++){
   const roll=r()*100;
   let id=area==='G-A'?(roll<20?'G001':roll<35?'G002':roll<55?'G003':roll<85?'G004':roll<95?'G005':'G006'):(roll<20?'G001':roll<35?'G002':roll<60?'G003':roll<70?'G005':roll<95?'G007':'G008');
   if(site.rich)id=n<5?'G007':'G008';const t=treasure(id),quality=.85+r()*.3,uid=`${area}:${seed}:${i}:${n}`;
   const f:Find={uid,id,x,y,depth:0,state:'buried',quality,initialQuality:quality,tool:'hand',areaId:area,...grainProfile[id],goldSite:site.id,goldOffset:total*(n+.3+r()*.3)/count,goldCapture:0,captureRank:.1+r()*.85,goldRich:site.rich,magnetic:id==='G002'};
   items.push(f);site.items.push(uid);
  }sites.push(site);
 }
 return {id:`${area}-${seed}`,areaId:area,seed,mask:Array(1008).fill(0),items,goldSites:sites};
}
export const goldFinds=(s:State)=>[...s.explorationAreas[0].items,...s.retainedFinds];
export const gravelRemaining=(s:State)=>(s.gravelBatches??[]).reduce((n,b)=>n+Math.max(0,b.amount-b.processed),0);
export const availableGrains=(s:State,b:GravelBatch)=>b.separated.map(uid=>goldFinds(s).find(f=>f.uid===uid)).filter((f):f is Find=>!!f&&f.state==='batch'&&!b.recovered.includes(f.uid));
const owns=(s:State,id:string)=>id==='hand'||GOLD_TOOLS.includes(id)&&s.ownedTools.includes(id);
function spend(s:State,n:number){const before=s.playerStats.stamina;s.playerStats.stamina=Math.max(0,before-n);s.playerStats.xp[3]+=.2;return before-s.playerStats.stamina;}
export function storeGold(s:State,b:GravelBatch,f:Find,id:string){
 if(f.state!=='batch'||b.recovered.includes(f.uid)||!b.separated.includes(f.uid)||goldFinds(s).filter(f=>f.state==='stored').length>=CONFIG.capacity)return false;
 finishQuality(s,f,id);f.state='stored';f.tool=id;recordRecovery(s,f);b.recovered.push(f.uid);const stats=goldStats(s);if(!stats.found.includes(f.uid))stats.found.push(f.uid);s.playerStats.xp[2]+=.5;logEvent(s,'鉱物回収',f.uid);return true;
}
export function collectGravel(s:State,id:string,x:number,y:number,stroke:number){
 const result={amount:0,found:0,reason:''};if(!isGold(s)||!owns(s,id)||!['hand','G101','G106'].includes(id)||!Number.isFinite(stroke)||stroke<12)return result;
 const p=s.explorationAreas[0],site=p.goldSites?.filter(t=>t.collected<t.total-1e-8&&Math.hypot(t.x-x,t.y-y)<(id==='G106'?52:38)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
 if(!site){result.reason='採取できる砂利の輪をなぞろう。';return result;}
 if((s.gravelBatches?.filter(b=>b.processed<b.amount||availableGrains(s,b).length).length??0)>=300){result.reason='砂利袋がいっぱい。選別台で処理しよう。';return result;}
 const bucket=s.equippedTools.includes('G108')&&s.ownedTools.includes('G108'),from=site.collected,amount=Math.min(site.total-from,id==='G106'?10:id==='G101'?6:1);site.collected+=amount;
 const existing=['G101','G106'].includes(id)?s.gravelBatches?.find(b=>b.plotId===p.id&&(bucket||b.siteId===site.id)&&b.collectedTool===id&&!b.automationJob&&b.processed===0&&b.screened===0&&b.amount<(bucket?86:42)&&b.id!==s.goldWork?.batchId&&!s.sluiceFeed?.includes(b.id)):undefined;
 const b:GravelBatch=existing??{id:`${p.id}:${site.id}:${from.toFixed(3)}`,plotId:p.id,siteId:site.id,x:site.x,y:site.y,amount:0,coarse:site.coarse,collectedTool:id,screened:0,processed:0,handProcessed:0,contents:[],separated:[],recovered:[],losses:{},passes:0};
 const priorAmount=b.amount;b.amount+=amount;if(bucket){b.coarse=(b.coarse*priorAmount+site.coarse*amount)/b.amount;if(b.siteId!==site.id)b.siteId='mixed';}
 for(const f of p.items)if(f.goldSite===site.id&&f.state==='buried'&&(f.goldOffset??0)>=from-1e-8&&(f.goldOffset??0)<site.collected+1e-8){f.state='batch';f.tool=id;f.goldAllocation=priorAmount+(f.goldOffset??from)-from;b.contents.push(f.uid);}
 if(!existing)(s.gravelBatches??=[]).push(b);result.amount=amount;
 if(id==='hand'){b.handProcessed=amount;for(const uid of b.contents){const f=p.items.find(f=>f.uid===uid)!;if((f.grain??1)>=.6){b.separated.push(uid);if(storeGold(s,b,f,id))result.found++;}}}
 if(id==='hand'&&(!b.contents.length||b.contents.every(uid=>b.recovered.includes(uid))))b.processed=amount;
 const used=spend(s,id==='G106'?6:id==='G101'?4:1.5);measure(s,id,'採取',amount,used,result.found);s.playerStats.xp[0]+=.2*amount;
 if(site.rich&&!site.announced){site.announced=true;goldStats(s).specialSites.push({plotId:p.id,siteId:site.id,time:s.playTime});result.reason='砂金が集まる特別な採取地点を発見！';logEvent(s,'特別採取地点',`${p.id}/${site.id}`);}
 return result;
}
export function handSortGravel(s:State,b:GravelBatch){if(!s.gravelBatches?.includes(b)||b.automationJob)return 0;const previous=b.handProcessed,amount=Math.min(2,b.amount-b.handProcessed);if(amount<=0)return 0;b.handProcessed+=amount;let found=0;
 for(const uid of b.contents){const f=goldFinds(s).find(f=>f.uid===uid);if(f&&((f.goldAllocation??0)<previous||(f.goldAllocation??0)>=b.handProcessed))continue;if(f&&f.state==='batch'&&(f.grain??1)>=.6&&!b.separated.includes(uid))b.separated.push(uid);if(f&&storeGold(s,b,f,'hand'))found++;}
 if(b.handProcessed>=b.amount-1e-8&&b.contents.every(uid=>b.recovered.includes(uid)))b.processed=b.amount;measure(s,'hand','手選別',amount,spend(s,2),found);return amount;
}
export function goldProcessingRate(tool:string,screened:number,coarse:number,grain=.12,density=19.3,rough=0){
 if(grain>=.6)return 1;
 const base=tool==='G201'?.64:tool==='G203'?.74:.82;
 return Math.max(.3,Math.min(.99,(base+.15*screened)*(density>=10?1:.9)-coarse*(1-screened)*.08-Math.min(.05,rough*.05)));
}
export function beginGoldWork(s:State,batchId:string,id:string){
 const b=s.gravelBatches?.find(b=>b.id===batchId);if(!b||b.automationJob&&b.automationJob!==s.automationAccess||!owns(s,id)||!goldProcessing(id))return false;
 if(s.goldWork)return s.goldWork.batchId===batchId&&s.goldWork.tool===id;
 const screen=goldScreen(id),magnet=id==='G205',reprocess=!screen&&!magnet&&b.processed>=b.amount-1e-8;
 if(magnet&&(b.magnetized??0)>=b.amount-1e-8||screen&&(id==='G202'?(b.fineScreened??0):b.screened)>=b.amount-1e-8||reprocess&&!b.contents.some(uid=>{const f=goldFinds(s).find(f=>f.uid===uid);return f?.state==='batch'&&!b.separated.includes(uid);}))return false;
 const start=magnet?(b.magnetized??0):screen?(id==='G202'?(b.fineScreened??0):b.screened):reprocess?(b.reprocessCursor??0):b.processed,baseCapacity=magnet?12:id==='G202'?16:screen?8:id==='G201'?14:id==='G203'?20:4,screenedLoad=Math.min(Math.max(0,b.screened-start),baseCapacity/(1-b.coarse*.65)),load=Math.min(!screen&&!magnet&&id!=='G203'?Math.max(baseCapacity,screenedLoad):baseCapacity,b.amount-start);if(load<=0)return false;
 const screened=Math.max(0,Math.min(1,(b.screened-start)/load));
 const magneticFraction=(b.magnetRecovered??[]).some(uid=>{const f=goldFinds(s).find(f=>f.uid===uid),at=f?.goldAllocation??-1;return at>=start&&at<start+load;})?Math.max(0,Math.min(1,((b.magnetized??0)-start)/load)):0;
 s.goldWork={batchId,tool:id,prepared:s.equippedTools.includes('G108')&&s.ownedTools.includes('G108'),fineFraction:Math.max(0,Math.min(1,((b.fineScreened??0)-start)/load)),magneticFraction,mode:magnet?'magnet':screen?'screen':id==='G203'?'sluice':'pan',start,load,work:0,required:magnet?Math.max(.6,load*.16):screen?Math.max(.8,load*(id==='G202'?.24:.3)):id==='G203'?load*(.45+b.coarse*.25*(1-screened))*(1-.18*magneticFraction):load*(1-screened*b.coarse*.65)*(id==='G201'?1.12:1)*(1+(1-screened)*b.coarse*4),rough:0,strokes:0,reprocess};
 measure(s,id,magnet?'砂鉄分離':screen?'粒径選別':id==='G203'?'水流選別':'比重選別',0,0,0,false);logEvent(s,'選別開始',`${id}/${batchId}`);return true;
}
function finishGoldWork(s:State){const w=s.goldWork,b=s.gravelBatches?.find(b=>b.id===w?.batchId);if(!w||!b)return false;
 if(s.automationOutputLimit!==undefined&&availableGrains(s,b).length+b.contents.filter(uid=>!b.separated.includes(uid)&&!b.recovered.includes(uid)&&(()=>{const f=goldFinds(s).find(f=>f.uid===uid);return f?.state==='batch'&&(f.goldAllocation??0)>=w.start&&(f.goldAllocation??0)<w.start+w.load;})()).length>s.automationOutputLimit)return false;
 const screened=Math.max(0,Math.min(1,(b.screened-w.start)/w.load));
 if(w.mode==='magnet')b.magnetized=Math.max(b.magnetized??0,w.start+w.load);else if(w.mode==='screen'){b.screened=Math.max(b.screened,w.start+w.load);if(w.tool==='G202')b.fineScreened=Math.max(b.fineScreened??0,w.start+w.load);}
 else{if(!w.reprocess)b.processed=Math.max(b.processed,w.start+w.load);else b.reprocessCursor=w.start+w.load>=b.amount-1e-8?0:w.start+w.load;b.passes++;if(!w.reprocess&&w.mode==='pan')goldStats(s).panCompleted++;}
 for(const uid of b.contents){const f=goldFinds(s).find(f=>f.uid===uid);if(!f||f.state!=='batch'||b.separated.includes(uid))continue;
  // The content and its capture rank are fixed. A paid reprocessing pass concentrates tailings; no new draw occurs.
  const allocation=f.goldAllocation??(f.goldAllocation=((f.goldOffset??0)%Math.max(1,b.amount)));if(allocation<w.start-1e-8||allocation>=w.start+w.load+1e-8)continue;
  if(w.mode==='magnet'){if((f.magnetic??(f.id==='G002'))&&!b.separated.includes(uid)){b.separated.push(uid);(b.magnetRecovered??=[]).push(uid);}continue;}
  if(w.mode==='screen'){if((f.grain??1)>=.6&&!b.separated.includes(uid))b.separated.push(uid);continue;}
  const rate=Math.min(.99,.06*(w.fineFraction??0)+.04*(w.magneticFraction??0)+goldProcessingRate(w.tool,screened,b.coarse,f.grain??1,f.density??2.7,w.rough/Math.max(1,w.strokes)));f.goldCapture=1-(1-(f.goldCapture??0))*(1-rate);b.losses[uid]=1-f.goldCapture;
  if(f.goldCapture+1e-8>=(f.captureRank??.5)){b.separated.push(uid);b.losses[uid]=0;}
 }
 const used=spend(s,w.mode==='sluice'?.5:w.mode==='magnet'?1:w.load*.35*(w.prepared?.75:1));const key=`G:${w.tool}:${w.mode==='magnet'?'砂鉄分離':w.mode==='screen'?'粒径選別':w.mode==='sluice'?'水流選別':'比重選別'}`;const m=s.operationMetrics?.[key];if(m){m.amount+=w.load;m.stamina+=used;m.successes++;}
 logEvent(s,'選別完了',`${w.tool}/${w.load.toFixed(1)}単位`);delete s.goldWork;return true;
}
export function goldMotion(s:State,distance:number,seconds:number){const w=s.goldWork;if(!w||w.mode==='sluice'||!Number.isFinite(distance)||distance<=0)return false;
 const d=Math.min(120,distance),rough=seconds>0&&d/seconds>1500?1:0;w.work+=d/24;w.rough+=rough;w.strokes++;measureSeconds(s,Math.max(0,Math.min(.25,seconds)),`G:${w.tool}:${w.mode==='magnet'?'砂鉄分離':w.mode==='screen'?'粒径選別':'比重選別'}`);if(w.work+1e-8>=w.required)return finishGoldWork(s);return false;
}
export function feedSluice(s:State,batchId:string){if(!owns(s,'G203'))return false;const b=s.gravelBatches?.find(b=>b.id===batchId);if(!b||b.automationJob||b.processed>=b.amount-1e-8)return false;const q=s.sluiceFeed??=[];if(!q.includes(batchId))q.push(batchId);if(!s.goldWork)beginGoldWork(s,batchId,'G203');return true;}
export function goldTick(s:State,seconds:number){if(!Number.isFinite(seconds)||seconds<=0)return;let remaining=Math.min(10,seconds);for(let i=0;i<40&&remaining>0;i++){
 if(!s.goldWork){const q=s.sluiceFeed??=[];while(q.length){const b=s.gravelBatches?.find(b=>b.id===q[0]);if(b&&b.processed<b.amount-1e-8)break;q.shift();}if(q.length)beginGoldWork(s,q[0],'G203');else break;}
 const w=s.goldWork;if(!w||w.mode!=='sluice')break;const used=Math.min(remaining,w.required-w.work);w.work+=used;remaining-=used;measureSeconds(s,used,`G:${w.tool}:水流選別`);if(w.work+1e-8>=w.required)finishGoldWork(s);else break;
 }}
export function collectGrain(s:State,batchId:string,uid:string,id='hand'){const b=s.gravelBatches?.find(b=>b.id===batchId),f=goldFinds(s).find(f=>f.uid===uid);if(!b||!f||!owns(s,id)||!['hand','G104','G110','G204'].includes(id)||!b.separated.includes(uid)||f.state!=='batch')return false;
 const effort=id==='G110'||id==='G204'?1:id==='G104'?((f.grain??1)<.2?2:1):(f.grain??1)<.2?3:(f.grain??1)<.6?2:1;f.pickWork=(f.pickWork??0)+1;const success=f.pickWork>=effort&&storeGold(s,b,f,id);let count=Number(success);if(success&&id==='G204')for(const other of availableGrains(s,b).filter(t=>t.uid!==uid).slice(0,3))if(storeGold(s,b,other,id))count++;measure(s,id,'精密回収',count,spend(s,id==='G204'?.18:id==='G104'?.2:id==='G110'?.3:.5),count,success);return success;
}
export function observeGrain(s:State,uid:string){const f=goldFinds(s).find(f=>f.uid===uid);if(!f||!owns(s,'G105')||f.state!=='batch'||!s.gravelBatches?.some(b=>b.separated.includes(uid)))return '選別した粒を虫眼鏡で観察しよう。';f.observed=true;measure(s,'G105','観察',1,spend(s,.2));return grainDescription(f);}
export function grainDescription(f:Find){if(!f.observed)return ['G003','G007','G008','G009','G011','G012'].includes(f.id)?'金色の粒。正体はまだ分からない。':'小さな鉱物片。洗浄して確認しよう。';return f.id==='G003'?'淡い金色・角のある粒・鏡のような強い光沢。黄鉄鉱の特徴。':f.id.startsWith('G00')&&['G007','G008','G009'].includes(f.id)?'濃い黄金色・丸い輪郭・柔らかな光沢。天然金の特徴。':`${treasure(f.id).name}：${treasure(f.id).description}`;}
export function goldPipeline(ids:string[],coarse=.65){const scoop=ids.includes('G106')?5:ids.includes('G101')?3:.65,sieve=ids.includes('G202')?5:ids.includes('G103')?4:Infinity,tool=ids.includes('G203')?'G203':ids.includes('G201')?'G201':ids.includes('G102')?'G102':'hand',load=tool==='G203'?20:tool==='G201'?14:4,screened=ids.includes('G103')||ids.includes('G202')?1:0;
 const rawLoad=tool==='G203'?load:load/(1-screened*coarse*.65);
 const work=tool==='hand'?Infinity:tool==='G203'?load*(.45+coarse*.25*(1-screened))*(ids.includes('G205')?.82:1):rawLoad*(1-screened*coarse*.65)*(tool==='G201'?1.12:1)*(1+(1-screened)*coarse*4);
 const separation=tool==='hand'?.45:rawLoad/(1+work*(tool==='G203'?1:.6));return {collect:scoop,screen:sieve===Infinity?null:sieve,separate:separation,throughput:Math.min(scoop,sieve,separation),fineCapture:Math.min(.99,goldProcessingRate(tool,screened,coarse)+(ids.includes('G202')?.06:0)+(ids.includes('G205')?.04:0)),capacity:load};}
export function validateGold(s:State){
 if((s.goldVersion??0)>1)throw Error('新しい砂利セーブ形式です');s.goldVersion=1;
 for(const site of s.explorationAreas[0].goldSites??[])if(![site.x,site.y,site.total,site.collected,site.coarse].every(Number.isFinite)||site.total<=0||site.collected<0||site.collected>site.total+1e-6||site.coarse<0||site.coarse>1)throw Error('採取地点データが不正です');
 const finds=goldFinds(s),ids=new Set(finds.map(f=>f.uid)),seen=new Set<string>(),assigned=new Set<string>();
 for(const f of finds){for(const n of [f.grain,f.density,f.goldOffset,f.goldAllocation,f.captureRank,f.goldCapture])if(n!==undefined&&(!Number.isFinite(n)||n<0))throw Error('鉱物の粒径・選別データが不正です');if(f.grain!==undefined&&f.grain<=0||f.density!==undefined&&f.density<=0||(f.captureRank??0)>1||(f.goldCapture??0)>1)throw Error('鉱物の粒径・選別データが不正です');}
 for(const b of s.gravelBatches??[]){if(seen.has(b.id)||![b.amount,b.screened,b.processed,b.handProcessed,b.coarse].every(Number.isFinite)||b.amount<=0||[b.screened,b.processed,b.handProcessed].some(v=>v<0||v>b.amount+1e-6)||b.coarse<0||b.coarse>1||new Set(b.contents).size!==b.contents.length)throw Error('砂利バッチが不正です');seen.add(b.id);
  if((b.magnetRecovered??[]).some(uid=>!b.separated.includes(uid))||new Set(b.magnetRecovered??[]).size!==(b.magnetRecovered??[]).length)throw Error('砂鉄回収の参照が不正です');
  for(const n of [b.fineScreened,b.magnetized])if(n!==undefined&&(!Number.isFinite(n)||n<0||n>b.amount+1e-6))throw Error('砂利の前処理量が不正です');
  if(b.contents.some(uid=>!ids.has(uid)&&!s.collectedTreasures.includes(uid))||[...b.separated,...b.recovered].some(uid=>!b.contents.includes(uid)))throw Error('砂利個体の参照が不正です');for(const uid of b.contents){if(assigned.has(uid))throw Error('砂利個体が重複しています');assigned.add(uid);}if(new Set(b.separated).size!==b.separated.length||new Set(b.recovered).size!==b.recovered.length)throw Error('砂利の回収記録が重複しています');}
 const w=s.goldWork;if(w&&([w.fineFraction,w.magneticFraction].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0||v>1))||w.prepared!==undefined&&typeof w.prepared!=='boolean'))throw Error('前処理中の状態が不正です');
 if(w&&(!s.gravelBatches?.some(b=>b.id===w.batchId)||![w.start,w.load,w.work,w.required].every(Number.isFinite)||w.start<0||w.load<=0||w.start+w.load>(s.gravelBatches!.find(b=>b.id===w.batchId)!.amount)+1e-6||!goldProcessing(w.tool)||!['pan','screen','sluice','magnet'].includes(w.mode)||w.required<=0||w.work<0||w.work>w.required+1e-6||!owns(s,w.tool)))throw Error('選別中の状態が不正です');
 s.sluiceFeed=(s.sluiceFeed??[]).filter(id=>s.gravelBatches?.some(b=>b.id===id));
}
