import type {Find,State} from './engine';
export interface RewardLedger {version:1;issued:number;active:Record<string,true>;legacy:Record<string,true>;settledLegacyRefs:Record<string,true>;paidCount:number;contractCount:number;jackpotCount:number;goldCount:number;archivedRevenue:{area:Record<string,number>;item:Record<string,number>;records:number};window:{time:number;normal:number;total:number;count:number}[];}
export const HISTORY_LIMIT=200;
const finds=(s:State)=>[...s.explorationAreas.flatMap(p=>p.items),...s.retainedFinds];
export const recoveryCount=(s:State)=>s.rewardLedger?.paidCount??s.collectedTreasures.length;
function ordinal(s:State,uid:string){const prefix=s.playerId+':v6:';if(!uid.startsWith(prefix))return null;const n=Number(uid.slice(prefix.length));return Number.isSafeInteger(n)&&n>0&&String(n)===uid.slice(prefix.length)?n:-1;}
export function sealLedger(s:State){if(s.rewardLedger)return s.rewardLedger;const paid=new Set(s.collectedTreasures),legacy:Record<string,true>={};for(const f of finds(s))if(f.state!=='paid'&&!paid.has(f.uid))legacy[f.uid]=true;
 return s.rewardLedger={version:1,issued:0,active:{},legacy,settledLegacyRefs:Object.fromEntries((s.gravelBatches??[]).flatMap(b=>b.recovered).filter(uid=>paid.has(uid)).map(uid=>[uid,true as const])),paidCount:s.collectedTreasures.length,contractCount:s.completedContracts.length,jackpotCount:s.jackpotHistory.length,goldCount:Object.entries(s.discoveredTreasures).filter(([id])=>id.startsWith('G')).reduce((n,[,v])=>n+v.count,0),archivedRevenue:{area:{},item:{},records:0},window:[]};
}
export function issueUID(s:State){const l=sealLedger(s);if(l.issued>=Number.MAX_SAFE_INTEGER)throw Error('個体IDの発行上限です');const n=++l.issued;l.active[n]=true;return s.playerId+':v6:'+n;}
export function rewardEligible(s:State,uid:string){if(!s.rewardLedger)return !s.collectedTreasures.includes(uid);const n=ordinal(s,uid);return n===null?!!s.rewardLedger.legacy[uid]:n>0&&n<=s.rewardLedger.issued&&!!s.rewardLedger.active[n];}
export function retireUID(s:State,uid:string){if(!s.rewardLedger)return;const n=ordinal(s,uid);if(n===null)delete s.rewardLedger.legacy[uid];else if(n>0)delete s.rewardLedger.active[n];}
export function retiredUID(s:State,uid:string){if(s.collectedTreasures.includes(uid))return true;if(!s.rewardLedger)return false;const n=ordinal(s,uid);return !!s.rewardLedger.settledLegacyRefs[uid]||n!==null&&n>0&&n<=s.rewardLedger.issued&&!s.rewardLedger.active[n];}
export function confirmReward(s:State,f:Find,contract:boolean,jackpot:boolean){if(!s.rewardLedger)return;retireUID(s,f.uid);if(ordinal(s,f.uid)===null&&(s.gravelBatches??[]).some(b=>b.contents.includes(f.uid)))s.rewardLedger.settledLegacyRefs[f.uid]=true;s.rewardLedger.paidCount++;if(contract)s.rewardLedger.contractCount++;if(jackpot)s.rewardLedger.jackpotCount++;if(f.id.startsWith('G'))s.rewardLedger.goldCount++;}
export function compactHistory(s:State){
 if(!s.rewardLedger&&s.collectedTreasures.length<=HISTORY_LIMIT&&s.revenueHistory.length<=HISTORY_LIMIT&&(s.recoveryHistory?.length??0)<=HISTORY_LIMIT&&(s.sortHistory?.length??0)<=HISTORY_LIMIT&&(s.goldStats?.found.length??0)<=HISTORY_LIMIT&&(s.goldStats?.specialSites.length??0)<=100)return;
 const l=sealLedger(s);
 const removed=s.revenueHistory.splice(0,Math.max(0,s.revenueHistory.length-HISTORY_LIMIT));
 for(const r of removed){l.archivedRevenue.area[r.area??'B-A']=(l.archivedRevenue.area[r.area??'B-A']??0)+r.fn;l.archivedRevenue.item[r.item??'旧記録']=(l.archivedRevenue.item[r.item??'旧記録']??0)+r.fn;l.archivedRevenue.records++;if(r.time>s.playTime-60){let bucket=l.window.find(b=>b.time===r.time);if(!bucket){bucket={time:r.time,normal:0,total:0,count:0};l.window.push(bucket);}bucket.total+=r.fn;bucket.normal+=r.jackpot?0:r.fn;bucket.count++;}}
 l.window=l.window.filter(r=>r.time>s.playTime-60);
 s.collectedTreasures=s.collectedTreasures.slice(-HISTORY_LIMIT);s.completedContracts=s.completedContracts.slice(-HISTORY_LIMIT);s.jackpotHistory=s.jackpotHistory.slice(-100);
 if(s.recoveryHistory)s.recoveryHistory=s.recoveryHistory.slice(-HISTORY_LIMIT);if(s.sortHistory)s.sortHistory=s.sortHistory.slice(-HISTORY_LIMIT);if(s.goldStats){s.goldStats.totalFound??=s.goldStats.found.length;s.goldStats.totalSpecialSites??=s.goldStats.specialSites.length;s.goldStats.found=s.goldStats.found.slice(-HISTORY_LIMIT);s.goldStats.specialSites=s.goldStats.specialSites.slice(-100);}
 // Recovered entries in still-live gravel are exact references, not an unbounded historical blacklist.
 const retainedPaid=new Set((s.gravelBatches??[]).flatMap(b=>b.recovered));for(const f of finds(s))if(f.state==='paid')retainedPaid.add(f.uid);
 const live=new Set(finds(s).filter(f=>f.state!=='paid').map(f=>f.uid));for(const uid of Object.keys(l.legacy))if(!live.has(uid))delete l.legacy[uid];for(const uid of Object.keys(l.settledLegacyRefs))if(!retainedPaid.has(uid))delete l.settledLegacyRefs[uid];
}
export function validateLedger(s:State){const l=s.rewardLedger;if(!l)return;if(l.version!==1||!Number.isSafeInteger(l.issued)||l.issued<0||![l.paidCount,l.contractCount,l.jackpotCount,l.goldCount].every(n=>Number.isSafeInteger(n)&&n>=0)||!l.active||!l.legacy||!l.archivedRevenue||!Array.isArray(l.window))throw Error('報酬台帳が不正です');
 const ids=new Set<string>();for(const f of finds(s)){if(ids.has(f.uid))throw Error('個体IDが重複しています');ids.add(f.uid);if(f.state!=='paid'&&!rewardEligible(s,f.uid))throw Error('寿命終了した個体が未回収状態で再出現しています');}
 for(const key of Object.keys(l.active)){const n=Number(key);if(!Number.isSafeInteger(n)||n<=0||n>l.issued||!ids.has(s.playerId+':v6:'+n))throw Error('発行済み個体の参照が不正です');}
 for(const uid of Object.keys(l.legacy))if(!ids.has(uid))throw Error('旧個体の参照が不正です');
}
