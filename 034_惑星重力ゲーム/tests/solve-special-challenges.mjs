import{SPECIAL_CHALLENGES}from'../js/special-challenges.js';
import{simulateTrajectory}from'../js/physics.js';
for(const s of SPECIAL_CHALLENGES){let best=null;
 for(let angleDeg=-72;angleDeg<=-35;angleDeg++)for(let speed=120;speed<=220;speed+=2){
  const r=simulateTrajectory(s,{angleDeg,speed});if(r.state.status!=='cleared')continue;
  const removed=s.planets.map(p=>simulateTrajectory({...s,planets:s.planets.filter(q=>q.id!==p.id)},{angleDeg,speed}).state.status);
  if(removed.some(status=>status==='cleared'))continue;
  const score=Math.abs(speed-170)*.001+Math.abs(angleDeg+55)*.001;
  if(!best||score<best.score)best={angleDeg,speed,time:r.state.elapsed,score,removed};
 }console.log(s.id,JSON.stringify(best));}
