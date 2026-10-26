import {tailExposure,encounterPosition,encounterGravity} from './encounters.js';
import {segmentCircleHit} from './physics.js';
// Campaign observations only. No assignments to a simulation or its objects.
export const newMission=()=>({encounters:[],cometBoostSeconds:0,anomalyImpulse:0,station:false,ufo:false});
export function observeMission(evidence,previous,next){
 const result={...evidence,encounters:[...evidence.encounters]},dt=next.elapsed-previous.elapsed;
 for(const e of next.encounters??[]){
  const a=encounterPosition(e,previous.elapsed),b=encounterPosition(e,next.elapsed);
  const from={x:previous.rocket.position.x-a.x,y:previous.rocket.position.y-a.y},to={x:next.rocket.position.x-b.x,y:next.rocket.position.y-b.y};
  const seen=segmentCircleHit(from,to,{x:0,y:0,radius:e.type==='meteor'?180:e.type==='ufo'?140:e.reactionRadius})!==null;
  if(seen&&!result.encounters.includes(e.id))result.encounters.push(e.id);
  if(e.type==='ufo'&&seen)result.ufo=true;
  if(e.type==='station'&&next.encounterEvents?.some(event=>event.id===e.id))result.station=true;
  if(e.type==='comet'&&e.tailMode==='boost'&&e.strength>0)result.cometBoostSeconds+=tailExposure(e,previous.rocket.position,next.rocket.position,previous.elapsed,next.elapsed)*dt;
  if(e.type==='unknown'){const force=encounterGravity(previous.rocket.position,[e],previous.elapsed);result.anomalyImpulse+=Math.hypot(force.x,force.y)*dt;}
 }
 return result;
}
export function missionSatisfied(stage,evidence={},choice){
 if(!stage.mission)return true;
 switch(stage.mission.kind){
  case 'meteor':return evidence.encounters?.includes(stage.mission.id)===true;
  case 'comet':return evidence.cometBoostSeconds>0;
  case 'station':return evidence.station===true;
  case 'ufo':return evidence.ufo===true&&['pursue','avoid'].includes(choice);
  case 'unknown':return evidence.anomalyImpulse>1;
  default:return false;
 }
}
export const MISSION_HINT='航路条件が未達成です。遭遇対象と攻略ヒントを確認してください。';
