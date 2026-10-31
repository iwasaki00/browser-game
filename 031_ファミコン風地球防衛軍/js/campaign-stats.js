import {ChallengeRun} from './challenges.js?v=0.8.0';
// Bounded cumulative counters, not an event log. No DOM or combat dependency.
export const CAMPAIGN_SCHEMA=1;
const MAX=Number.MAX_SAFE_INTEGER;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const number=(v,fraction=false)=>typeof v==='number'&&Number.isFinite(v)?Math.min(MAX,Math.max(0,fraction?v:Math.floor(v))):0;
const increment=(row,key,value=1)=>row[key]=Math.min(MAX,(row[key]??0)+number(value,true));
export const emptyCampaignStats=(legacyUnrecorded=false)=>({schemaVersion:CAMPAIGN_SCHEMA,sinceVersion:'0.7.0',legacyUnrecorded,classes:{},weapons:{},firstRewards:{}});
export function sanitizeCampaignStats(value,masters,legacy=true){
  const out=emptyCampaignStats(legacy);if(!object(value)||value.schemaVersion!==CAMPAIGN_SCHEMA)return out;
  out.legacyUnrecorded=value.legacyUnrecorded===true;
  for(const id of masters.classes)if(object(value.classes?.[id])){
    const v=value.classes[id],r={sorties:number(v.sorties),clears:number(v.clears),gameOvers:number(v.gameOvers),kills:number(v.kills),playSeconds:number(v.playSeconds,true),missions:{}};
    r.clears=Math.min(r.sorties,r.clears);r.gameOvers=Math.min(Math.max(0,r.sorties-r.clears),r.gameOvers);
    for(const mid of masters.missions)if(object(v.missions?.[mid])){const m=v.missions[mid];r.missions[mid]={highScore:number(m.highScore),bestTime:Number.isFinite(m.bestTime)&&m.bestTime>0?number(m.bestTime,true):null}}
    out.classes[id]=r;
  }
  for(const id of masters.weapons)if(object(value.weapons?.[id])){const v=value.weapons[id];out.weapons[id]={};for(const key of ['equipped','uses','hits','placements','detonations','minesDetonated'])out.weapons[id][key]=number(v[key])}
  for(const id of masters.missions)if(value.firstRewards?.[id]===true)out.firstRewards[id]=true;
  return out;
}
function classRow(s,id){return s.classes[id]??={sorties:0,clears:0,gameOvers:0,kills:0,playSeconds:0,missions:{}}}
function weaponRow(s,id){return s.weapons[id]??={equipped:0,uses:0,hits:0,placements:0,detonations:0,minesDetonated:0}}
export class CampaignRun {
  constructor(save,missionId,classId,equipped,player={}){
    this.challenge=new ChallengeRun(save,missionId,classId,player.hp);
    this.missionId=missionId;this.classId=classId;this.closed=false;this.dirty=true;this.flushAfter=0;this.killed=new WeakSet();
    increment(classRow(save.campaignStats,classId),'sorties');for(const id of new Set(equipped))increment(weaponRow(save.campaignStats,id),'equipped');
  }
  time(save,dt){if(this.closed||!Number.isFinite(dt)||dt<=0||dt>.1)return;increment(classRow(save.campaignStats,this.classId),'playSeconds',dt);this.flushAfter+=dt;this.challenge.time(dt);this.dirty=true}
  use(save,id,kind){if(this.closed)return;this.challenge.use(save,id);const r=weaponRow(save.campaignStats,id);increment(r,'uses');if(kind==='mine'||kind==='turret')increment(r,'placements');this.dirty=true}
  detonate(save,count){if(this.closed||count<=0)return;this.challenge.use(save,'M-18');const r=weaponRow(save.campaignStats,'M-18');increment(r,'detonations');increment(r,'minesDetonated',count);this.dirty=true}
  hit(save,id,damage){if(this.closed||!id||!(damage>0))return;increment(weaponRow(save.campaignStats,id),'hits');this.dirty=true}
  kill(save,enemy){if(this.closed||this.killed.has(enemy))return;this.killed.add(enemy);this.challenge.kill(save);increment(classRow(save.campaignStats,this.classId),'kills');this.dirty=true}
  finish(save,outcome,score=0,time=0,firstClear=false,player={}){
    if(this.closed)return false;this.challenge.finish(save,outcome,player);this.closed=true;const r=classRow(save.campaignStats,this.classId);
    if(outcome==='CLEAR'){increment(r,'clears');const old=r.missions[this.missionId];r.missions[this.missionId]={highScore:Math.max(old?.highScore??0,number(score)),bestTime:time>0?Math.min(old?.bestTime??Infinity,number(time,true)):old?.bestTime??null};if(firstClear)save.campaignStats.firstRewards[this.missionId]=true}
    else if(outcome==='GAME_OVER')increment(r,'gameOvers');this.dirty=true;return true;
  }
}
