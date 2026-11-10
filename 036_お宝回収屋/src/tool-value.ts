import {firstEvent} from './experience';
import {compactHistory} from './ledger';
import {beachProfiles,equippedBeach} from './beach-tools';
import {treasure} from './data';
import type {Find,State,Batch} from './engine';
export interface SurveyMark {precise?:boolean; x:number;y:number;strength:number;deep:boolean;character:string;targets:string[];}
export interface ScanReading {strength:number;band:string;depthHint:string;character:string;}
export interface SortEvent {time:number;method:'hand'|'sieve';units:number;found:number;stamina:number;}
export interface RecoveryEvent {time:number;surveyed:boolean;tool:string;digs:number|null;digsAt:number;evaluation:number;loss:number;protected:boolean;}
const sizes:Record<string,number>={B001:.55,B002:.35,B003:.5,B004:1.5,B005:.8,B006:.3,B007:1.1,B008:1.4,B009:.9,B010:.8,B011:.6,B012:1.7};
export function tiny(f:Find){return ['B002','B003','B006'].includes(f.id)||Number(f.id.slice(1))>=13&&treasure(f.id).size==='小';}
export function scanReading(s:State,x:number,y:number,id='B201'):ScanReading {
 const p=s.explorationAreas[0],profile=beachProfiles[id],coil=equippedBeach(s,'B209'),range=(profile?.range??95)*(coil?1.2:1)*(id==='B202'&&equippedBeach(s,'B201')&&p.surveyMarks?.some(m=>Math.hypot(m.x-x,m.y-y)<60)?1.7:1),grid=id==='B202'&&!equippedBeach(s,'B201')?20:profile?.grid??40;let strength=0,selected:Find|undefined;
 for(const f of p.items){if(f.state!=='buried'||!['metal','iron','brass','silver','gold','gold-plated','copper','aluminum','stainless'].includes(treasure(f.id).material)||(f.depth??f.y)>(profile?.senseDepth??280))continue;
  const distance=Math.hypot(f.x-x,f.y-y),size=sizes[f.id]??1,deep=(f.depth??f.y)>180;
  const value=Math.max(0,1-distance/range)*Math.min(1,.5+size*.4+(coil&&size<.75?.3:0))*(deep?.85:1);
  const wet=f.y<75&&id!=='B204'&&id!=='B201'?.85:1;if(value*wet>strength){strength=value*wet;selected=f;}
 }
 const reading:ScanReading={strength,band:strength<.12?'なし':strength<.35?'弱':strength<.7?'中':'強',depthHint:selected?((selected.depth??selected.y)>420?'かなり深そう':(selected.depth??selected.y)>180?'深そう':'浅そう'):'',character:selected?(id==='B206'?((['B002','B004'].includes(selected.id)||treasure(selected.id).material==='iron')?'鉄系の反応':'非鉄系らしい反応'):(sizes[selected.id]??1)<.75?'小さな金属':'まとまった反応'):''};
 s.lastScan=reading;
 if(selected&&strength>=.25){
  // Mark the survey location on a coarse grid, never the treasure's exact location.
  const mx=Math.max(20,Math.min(340,Math.floor(x/grid)*grid+grid/2)),my=Math.max(20,Math.min(260,Math.floor(y/grid)*grid+grid/2));
  const marks=p.surveyMarks??(p.surveyMarks=[]);let m=marks.find(m=>m.targets.includes(selected!.uid))??marks.find(m=>m.x===mx&&m.y===my);
  if(!m){m={x:mx,y:my,strength,deep:reading.depthHint.includes('深'),character:reading.character,targets:[]};marks.push(m);}
  if(strength>=m.strength){if(id==='B202')m.precise=true;m.x=mx;m.y=my;m.strength=strength;m.deep=reading.depthHint.includes('深');m.character=reading.character;}
  if(!m.targets.includes(selected.uid))m.targets.push(selected.uid);
  if(Math.hypot(selected.x-x,selected.y-y)<=40){selected.surveyed=true;if(id==='B202'&&equippedBeach(s,'B201')||id==='B206')selected.identified=true;}
 }
 return reading;
}
export function finishQuality(s:State,f:Find,id:string){
 if(f.qualityFinalized)return;
 if(f.initialQuality===undefined&&(f.state==='batch'||f.state==='stored')){f.initialQuality=f.quality;f.qualityFinalized=true;f.qualityLoss=0;return;}
 f.plannedRecovery=!!f.surveyed;f.excavationTool=id;f.initialQuality??=f.quality;
 const base=beachProfiles[id]?.damage??(id==='B105'?.08:id==='B102'?.03:id==='hand'?.015:.01);
 const loss=f.riverProtected?0:beachProfiles[id]?.damage===0?0:f.surveyed?Math.min(base,id==='B105'?.02:id==='B101'?0:.005):base;
 const before=Math.min(f.initialQuality,f.quality);f.quality=Math.max(0,before*(1-loss));f.qualityLoss=before-f.quality;f.damagePrevented=!!f.surveyed&&loss<base;f.qualityFinalized=true;
}
export function recordRecovery(s:State,f:Find){
 if(f.recoveryRecorded)return;firstEvent(s,'find');f.recoveryRecorded=true;
 const history=s.recoveryHistory??(s.recoveryHistory=[]),last=history.at(-1)?.digsAt;
 history.push({time:s.playTime,surveyed:!!(f.plannedRecovery??f.surveyed),tool:f.excavationTool??f.tool,digs:last===undefined?null:Math.max(0,s.digs-last),digsAt:s.digs,evaluation:Math.round(treasure(f.id).baseValueFN*f.quality),loss:f.qualityLoss??0,protected:!!f.damagePrevented});compactHistory(s);
}
export function batchRemaining(b:Batch){if(b.processed)return 0;return Math.max(0,b.cells-(b.screenedUnits??0))+Object.values(b.residueWork??{}).reduce((a,v)=>a+v,0);}
export const sandRemaining=(s:State)=>s.sandBatches.reduce((a,b)=>a+batchRemaining(b),0);
export function initializeBatch(b:Batch){b.screenedUnits??=b.processed?b.cells:0;b.residueWork??={};b.allocations??={};
 // Stable assignments use existing identities. Sorting never rolls an item or rarity.
 for(const uid of b.items)if(b.allocations[uid]===undefined){let h=0;for(const c of uid)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;b.allocations[uid]=Math.min(b.cells,Math.max(b.screenedUnits, b.cells*(.15+(h%700)/1000)));}
}
export function toolReport(s:State){
 const recent=(s.sortHistory??[]).filter(r=>r.time>s.playTime-60),sort=(method:string)=>{const r=recent.filter(r=>r.method===method);return r.length>=3&&s.playTime>=60?`${r.reduce((n,v)=>n+v.units,0).toFixed(1)} 単位/分・発見${r.reduce((n,v)=>n+v.found,0)}個`:'データ不足';};
 const history=s.recoveryHistory??[],group=(surveyed:boolean)=>{const r=history.filter(r=>r.surveyed===surveyed&&r.digs!==null);return r.length>=3?`${(r.reduce((n,v)=>n+(v.digs??0),0)/r.length).toFixed(1)}回 / 平均評価 ${Math.round(r.reduce((n,v)=>n+v.evaluation,0)/r.length)} FN`:'データ不足';};
 return `<section class="report tool-report"><h3>道具の仕事 / 実測</h3><p>直近1分の選別：手 ${sort('hand')} / ふるい ${sort('sieve')}<br>基準体力/単位：手 2.00 / ふるい 0.27（予測・満量時）</p><p>回収間の掘削数と評価：<br>未探知 ${group(false)}<br>探知済み ${group(true)}</p><p>品質低下を抑えた回収 ${history.filter(r=>r.protected).length}回</p><small>操作の混在を含む記録です。因果関係や将来収益の保証ではありません。3件未満の群はデータ不足。</small></section>`;
}
