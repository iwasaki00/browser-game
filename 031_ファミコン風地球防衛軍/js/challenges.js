import {ACHIEVEMENTS,ACHIEVEMENT_BY_ID,CHALLENGE_MISSIONS,CHALLENGE_CLASSES,CHALLENGE_WEAPONS} from './achievement-master.js?v=0.8.0';

const MAX=Number.MAX_SAFE_INTEGER,number=v=>typeof v==='number'&&Number.isFinite(v)?Math.min(MAX,Math.max(0,Math.floor(v))):0;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),add=(o,k,n=1)=>o[k]=Math.min(MAX,o[k]+n);
const specialIds=ACHIEVEMENTS.filter(a=>a.method==='special').map(a=>a.id);
export const emptyAchievements=()=>({schemaVersion:1,sinceVersion:'0.8.0',unlocked:{},selectedTitle:null,totals:{runs:0,kills:0,bestRunKills:0,bestStreak:0},observed:[],completed:[],b05Orders:[],failedMissions:[],coreExposures:null});
export function sanitizeAchievements(raw,missionIds=CHALLENGE_MISSIONS){
 const s=emptyAchievements();if(!object(raw)||raw.schemaVersion!==1)return s;
 if(object(raw.unlocked))for(const a of ACHIEVEMENTS){const t=raw.unlocked[a.id];if(typeof t==='number'&&Number.isFinite(t)&&t>0&&t<=8640000000000000)s.unlocked[a.id]=t}
 for(const k of Object.keys(s.totals))s.totals[k]=number(raw.totals?.[k]);
 const ids=(v,allowed)=>Array.isArray(v)?[...new Set(v.filter(x=>allowed.includes(x)))]:[];
 s.observed=ids(raw.observed,specialIds);s.completed=ids(raw.completed,specialIds);s.b05Orders=ids(raw.b05Orders,['left','right']);s.failedMissions=ids(raw.failedMissions,missionIds);
 s.coreExposures=typeof raw.coreExposures==='number'&&Number.isFinite(raw.coreExposures)?number(raw.coreExposures):null;
 if(ACHIEVEMENT_BY_ID.get(raw.selectedTitle)?.title&&Object.hasOwn(s.unlocked,raw.selectedTitle))s.selectedTitle=raw.selectedTitle;
 return s;
}
export function achievementProgress(a,save){
 const s=save.achievements,c=save.campaignStats,known=s.totals.runs>0;
 switch(a.method){
 case 'mission':return save.clearedMissions.includes(a.scope)?1:0;
 case 'campaign':return CHALLENGE_MISSIONS.filter(id=>save.clearedMissions.includes(id)).length;
 case 'class':return c.classes[a.scope]?Math.min(1,c.classes[a.scope].clears):null;
 case 'classes':{const rows=CHALLENGE_CLASSES.map(id=>c.classes[id]);return rows.some(Boolean)?rows.filter(r=>r?.clears>0).length:null}
 case 'collection':return a.id==='ACH-W03'?CHALLENGE_WEAPONS.filter(id=>save.unlocked.includes(id)).length:save.unlocked.length;
 case 'weaponsUsed':{const ids=a.id==='ACH-W06'?CHALLENGE_WEAPONS:Object.keys(c.weapons);return Object.keys(c.weapons).length?ids.filter(id=>save.unlocked.includes(id)&&c.weapons[id]?.uses>0).length:null}
 case 'firstKill':{const rows=Object.values(c.classes);if(rows.some(r=>r.kills>0)||['M05','M06'].some(id=>save.missionStats[id]?.kills>0)||s.totals.kills>0)return 1;return rows.length||known?0:null}
 case 'runKills':return known?s.totals.bestRunKills:null;
 case 'streak':return known?s.totals.bestStreak:null;
 case 'kills':return known?s.totals.kills:null;
 case 'special':return s.completed.includes(a.id)?1:s.observed.includes(a.id)?0:null;
 case 'orders':return s.b05Orders.length||s.totals.runs>0?s.b05Orders.length:null;
 case 'exposures':return s.coreExposures;
 default:return null;
 }
}
export function reconcileAchievements(save,now=Date.now()){
 const added=[];for(const a of ACHIEVEMENTS){if(!a.implemented||Object.hasOwn(save.achievements.unlocked,a.id))continue;
  const value=achievementProgress(a,save);if(value!==null&&value>=a.target){save.achievements.unlocked[a.id]=Math.max(1,Math.min(8640000000000000,now));added.push(a.id)}
 }return added;
}
export function selectAchievementTitle(save,id){if(id!==null&&(!ACHIEVEMENT_BY_ID.get(id)?.title||!Object.hasOwn(save.achievements.unlocked,id)))return false;save.achievements.selectedTitle=id;return true}
export function achievementSummary(save){const available=ACHIEVEMENTS.filter(a=>a.implemented),done=available.filter(a=>Object.hasOwn(save.achievements.unlocked,a.id));return {total:available.length,done:done.length,percent:available.length?Math.round(done.length/available.length*100):0}}
export function recommendAchievements(save,missionId='M01'){
 return ACHIEVEMENTS.filter(a=>a.implemented&&!Object.hasOwn(save.achievements.unlocked,a.id)).map(a=>{
  const value=achievementProgress(a,save),ready=value!==null&&value>=a.target,ratio=value===null?0:Math.min(1,value/a.target);
  const accessible=!a.scope||CHALLENGE_CLASSES.includes(a.scope)||save.unlockedMissions.includes(a.scope),novel=a.method==='class'&&!save.campaignStats.classes[a.scope]||a.method==='weaponsUsed';
  return {a,ready,ratio,accessible,novel,current:a.scope===missionId}
 }).sort((x,y)=>Number(y.ready)-Number(x.ready)||y.ratio-x.ratio||Number(y.accessible)-Number(x.accessible)||Number(y.novel)-Number(x.novel)||Number(y.current)-Number(x.current)||x.a.order-y.a.order).slice(0,3).map(x=>x.a);
}

// One normal sortie, composed into the existing CampaignRun. No combat or DOM.
export class ChallengeRun {
 constructor(save,missionId,classId,hp){const s=save.achievements;add(s.totals,'runs');this.runId=s.totals.runs;this.missionId=missionId;this.classId=classId;this.usedWeaponIds=new Set();this.killsThisRun=0;this.maxKillStreak=0;this.streak=0;this.activeTime=0;this.lastKillActiveTime=null;this.damageTaken=0;this.startHp=hp;this.clearHp=null;this.bossSpecialEvents={b05Order:[],coreExposures:0};this.phaseEvents=0;this.completionState='RUNNING';this.devices=new WeakSet()}
 time(dt){if(this.completionState==='RUNNING')this.activeTime+=dt}
 use(save,id){if(this.completionState==='RUNNING'&&save.unlocked.includes(id))this.usedWeaponIds.add(id)}
 damage(amount){if(this.completionState==='RUNNING'&&Number.isFinite(amount)&&amount>0)this.damageTaken+=amount}
 kill(save){if(this.completionState!=='RUNNING')return;const s=save.achievements;this.killsThisRun++;this.streak=this.lastKillActiveTime!==null&&this.activeTime-this.lastKillActiveTime<=5+1e-9?this.streak+1:1;this.lastKillActiveTime=this.activeTime;this.maxKillStreak=Math.max(this.maxKillStreak,this.streak);add(s.totals,'kills');s.totals.bestRunKills=Math.max(s.totals.bestRunKills,this.killsThisRun);s.totals.bestStreak=Math.max(s.totals.bestStreak,this.maxKillStreak)}
 special(kind,key,entity){if(this.completionState!=='RUNNING')return;
  if(kind==='mobile-device'&&this.missionId==='M05'&&['left','right'].includes(key)&&entity&&!this.devices.has(entity)){this.devices.add(entity);if(!this.bossSpecialEvents.b05Order.includes(key))this.bossSpecialEvents.b05Order.push(key)}
  if(kind==='core-open'&&this.missionId==='M06'){this.bossSpecialEvents.coreExposures++;this.phaseEvents++}
 }
 finish(save,outcome,player){if(this.completionState!=='RUNNING')return false;this.completionState=outcome;const s=save.achievements;
  if(outcome==='GAME_OVER'&&!s.failedMissions.includes(this.missionId))s.failedMissions.push(this.missionId);
  if(outcome==='CLEAR'){
   this.clearHp=player?.hp??null;const used=this.usedWeaponIds,starter=used.size>0&&[...used].every(id=>id==='A-01'||id==='S-02');
   const conditions={'ACH-S01':this.missionId==='M01'&&starter,'ACH-S02':['M03','M04','M05','M06'].includes(this.missionId)&&starter,'ACH-S03':this.damageTaken===0,'ACH-S04':this.missionId==='M02'&&used.size===1,'ACH-S05':player?.hp>0&&player.hp<=player.maxHp*.25,'ACH-T03':s.failedMissions.includes(this.missionId)};
   for(const [id,passed] of Object.entries(conditions)){const a=ACHIEVEMENT_BY_ID.get(id);if(a.scope&&a.scope!==this.missionId||id==='ACH-S02'&&!['M03','M04','M05','M06'].includes(this.missionId))continue;if(!s.observed.includes(id))s.observed.push(id);if(passed&&!s.completed.includes(id))s.completed.push(id)}
   const order=this.bossSpecialEvents.b05Order;if(this.missionId==='M05'&&order.length===2&&!s.b05Orders.includes(order[0]))s.b05Orders.push(order[0]);
   if(this.missionId==='M06')s.coreExposures=Math.max(s.coreExposures??0,this.bossSpecialEvents.coreExposures);
  }
  this.streak=0;this.lastKillActiveTime=null;return true;
 }
}

// Notifications are cosmetic, bounded and never own/save achievement state.
export class AchievementNotices {
 constructor(){this.queue=[];this.current=null;this.elapsed=0;this.seen=new Set()}
 enqueue(ids){for(const id of ids)if(ACHIEVEMENT_BY_ID.has(id)&&!this.seen.has(id)){this.seen.add(id);this.queue.push(id)}}
 tick(dt,visible=true){if(!visible)return null;if(!this.current){this.current=this.queue.shift()??null;this.elapsed=0}else this.elapsed+=Math.max(0,Math.min(.1,dt));if(this.elapsed>=3){this.current=this.queue.shift()??null;this.elapsed=0}return this.current}
 skip(){this.current=null;this.elapsed=0}
}
