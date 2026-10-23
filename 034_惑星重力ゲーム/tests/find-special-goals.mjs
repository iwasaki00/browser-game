import{SPECIAL_CHALLENGES}from'../js/special-challenges.js';
import{simulateTrajectory}from'../js/physics.js';
import{planetExtent}from'../js/planets.js';
for(const s of SPECIAL_CHALLENGES.filter(s=>['stage-14','stage-19','stage-20'].includes(s.id))){
 let best=null;
 for(let angleDeg=-72;angleDeg<=-35;angleDeg+=2)for(let speed=140;speed<=220;speed+=4){
  const path=simulateTrajectory({...s,goal:{id:'g',x:-999,y:-999,radius:1}},{angleDeg,speed});
  for(let i=160;i<path.points.length;i+=20){const p=path.points[i];
   if(p.x<35||p.x>340||p.y<35||p.y>270||Math.hypot(p.x-48,p.y-430)<180)continue;
   const goal={...s.goal,x:Math.round(p.x),y:Math.round(p.y)};
   if(s.planets.some(q=>Math.hypot(q.x-goal.x,q.y-goal.y)<planetExtent(q)+goal.radius+14))continue;
   const stage={...s,goal},r=simulateTrajectory(stage,{angleDeg,speed});if(r.state.status!=='cleared')continue;
   const removed=s.planets.map(q=>simulateTrajectory({...stage,planets:stage.planets.filter(k=>k.id!==q.id)},{angleDeg,speed}).state.status);
   if(removed.includes('cleared'))continue;
   const score=Math.hypot(goal.x-s.goal.x,goal.y-s.goal.y)+Math.abs(speed-170)*.2;
   if(!best||score<best.score)best={angleDeg,speed,goal,time:r.state.elapsed,removed,score};
  }
 }console.log(s.id,JSON.stringify(best));
}
